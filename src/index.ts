import 'reflect-metadata';
import Joi from 'joi';
import curry from 'just-curry-it';
import _mergeWith from 'lodash.mergewith';
import { arrayFrom, runAll, mergeArray, runOnce, skipFirstRun } from './utils';
import { HttpClientSymbol, RequestSymbol, ParamSymbol, MockSymbol, MergeSymbol, InfoSymbol } from './symbols';
import type { Validator, Transformer, HttpClient, GetSchema } from './types';

const GlobalTarget = {};

const validate = (validators: Validator[] | undefined, data: any, ...parameters: any[]) => {
	if (!validators) return data;

	arrayFrom(validators).forEach((validator: Validator) => {
		if (!Joi.isSchema(validator)) {
			if (typeof validator !== 'function') {
				console.warn('Invalid Validator Type. The type must be Joi schema or function');
				return;
			}

			const { error } = validator(data, ...parameters) || {};
			if (!error) return;

			throw error;
		}

		const { error } = validator.validate(data);
		if (!error) return;

		throw error;
	});

	return data;
};

const transform = (transformers: Transformer[] | undefined, data: any, ...parameters: any[]) => {
	if (!transformers) return data;

	return arrayFrom(transformers).reduce((res, transformer) => {
		if (typeof transformer !== 'function') {
			console.warn('The transformer must be a function');
			return;
		}
		try {
			return transformer(res, ...parameters);
		} catch (e) {
			console.warn('Transform failed. Try to add a validator to solve this. ');
			console.warn(e);
			return res;
		}
	}, data);
};

function useHttpClient(httpClient: HttpClient, signature?: string) {
	Reflect.defineMetadata(
		HttpClientSymbol,
		{
			httpClient,
			signature: signature || "position",
		},
		GlobalTarget
	);
}

function Get({ request: { url, params, headers }, response }: GetSchema) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const innerMethod = descriptor.value;

		if (!Reflect.getMetadata(InfoSymbol, target, propertyKey)) {
			Reflect.defineMetadata(
				InfoSymbol,
				{
					_resolveTimes: 0,
				},
				target,
				propertyKey
			);
		}

		if (!Reflect.getMetadata(RequestSymbol, target, propertyKey)) {
			Reflect.defineMetadata(RequestSymbol, {}, target, propertyKey);
		}

		_mergeWith(
			Reflect.getMetadata(RequestSymbol, target, propertyKey),
			{
				get: [{ url, params, headers }],
			},
			mergeArray
		);

		const { validators, transformers, beforeValidate, afterValidate, beforeTransform, afterTransform, catcher } =
			response || {};

		const validatorList = validators && arrayFrom(validators);
		const transformerList = transformers && arrayFrom(transformers);
		const beforeValidateList = beforeValidate && arrayFrom(beforeValidate);
		const afterValidateList = afterValidate && arrayFrom(afterValidate);
		const beforeTransformList = beforeTransform && arrayFrom(beforeTransform);
		const afterTransformList = afterTransform && arrayFrom(afterTransform);

		descriptor.value = function (this: any, ...parameters: any[]) {
			const requestCounts = Reflect.getMetadata(RequestSymbol, target, propertyKey)?.get?.length;

			const innerP = Promise.resolve(innerMethod.call(this, ...parameters));

			const { httpClient, signature } = Reflect.getMetadata(HttpClientSymbol, GlobalTarget);

			if (!httpClient) throw new Error('No Http Client! Maybe forgot to call useHttpClient before using this');

			const paramsMetaData = Reflect.getMetadata(ParamSymbol, target, propertyKey) || {};

			const reqParams =
				params &&
				Object.keys(params).reduce((res: { [index: string]: any }, k) => {
					const { index, cb } = paramsMetaData[params[k]] || {};

					res[k] =
						typeof params[k] === 'symbol' ? (cb ? cb(parameters[index]) : parameters[index]) : params[k];

					return res;
				}, {});

			let resp;
			const resMockData = (Reflect.getMetadata(MockSymbol, target) || {})[propertyKey];

			if (resMockData) resp = Promise.resolve(resMockData.find(({ url: u }: { url: string }) => u === url));
			else {
				switch (signature) {
					case "name": 
						resp = httpClient.get({
							url,
							params: reqParams,
							headers
						});
						break;
					case "position":
						resp = httpClient.get(url, reqParams, headers);
						break;
					case "mix":
						resp = httpClient.get(url, {
							params: reqParams,
							headers
						})
						break;
					default:
						break;
				}
			}

			let responseData: unknown;

			let p = resp
				.then((res: any) => (responseData = res))
				.then(() => {
					if (beforeValidateList) {
						runAll(beforeValidateList, responseData);
					}
				})
				.then(() => {
					validate(validatorList, responseData, ...parameters);
				})
				.then(() => {
					if (afterValidateList) {
						runAll(afterValidateList, responseData);
					}
				})
				.then(() => {
					if (beforeTransformList) {
						return beforeTransformList.reduce((res, cur) => cur(res), responseData);
					}
				})
				.then((res: any) => transform(transformerList, res || responseData, ...parameters))
				.then((transformedData: any) => {
					if (afterTransformList) {
						runAll(afterTransformList, transformedData);
					}
					return transformedData;
				});

			if (catcher) p = p.catch(catcher);

			const merge = Reflect.getMetadata(MergeSymbol, target, propertyKey);

			if (!merge && requestCounts >= 2) {
				runOnce(() => {
					console.warn(
						'Use merge decorator to merge multiple request responses, otherwise outer request response would cover the inner request response as the final result.'
					);
				});
			}

			let info = Reflect.getMetadata(InfoSymbol, target, propertyKey);

			if (!merge) {
				return innerP.then(() => {
					info._resolveTimes += 1;

					return p;
				});
			}

			return innerP.then((innerValue) => {
				info._resolveTimes += 1;

				const next = merge(innerValue);
				Reflect.defineMetadata(MergeSymbol, next, target, propertyKey);

				return p.then((res: any) => (info._resolveTimes >= requestCounts ? next(res) : res));
			});
		};
	};
}

function Params(key: string, cb?: (param: any) => any) {
	return function (target: any, propertyKey: string, parameterIndex: number) {
		if (key) {
			const params = Reflect.getMetadata(ParamSymbol, target, propertyKey);
			Reflect.defineMetadata(
				ParamSymbol,
				{
					...params,
					[Symbol.for(key)]: {
						index: parameterIndex,
						cb,
					},
				},
				target,
				propertyKey
			);
		}
	};
}

function Mock(mockData: { [index: string]: any }) {
	return function (target: any, propertyKey: string) {
		if (process.env.NODE_ENV !== 'development') return;

		const returnMockData = (method: string) => {
			const { get } = Reflect.getMetadata(RequestSymbol, target, method);

			return get
				.map(({ url }: { url: string }) => {
					if (!mockData[url]) {
						console.warn(`Can not find mock data for ${url}`);
						return null;
					}
					return {
						url,
						mockData: mockData[url],
					};
				})
				.filter((d: object | null) => d);
		};

		if (!propertyKey) {
			const NATIVE_PROPS = ['length', 'name', 'arguments', 'caller', 'prototype'];

			Object.getOwnPropertyNames(target).forEach((prop) => {
				if (NATIVE_PROPS.includes(prop)) return;

				Reflect.defineMetadata(
					MockSymbol,
					{
						...Reflect.getMetadata(MockSymbol, target),
						[prop]: returnMockData(prop),
					},
					target
				);
			});
		} else {
			Reflect.defineMetadata(
				MockSymbol,
				{
					...Reflect.getMetadata(MockSymbol, target),
					[propertyKey]: returnMockData(propertyKey),
				},
				target
			);
		}
	};
}

function Merge(merge: (...args: any[]) => any) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		Reflect.defineMetadata(MergeSymbol, skipFirstRun(curry(merge)), target, propertyKey);
	};
}

export { useHttpClient, Get, Params, Mock, Merge };
