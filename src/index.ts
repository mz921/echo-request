import 'reflect-metadata';
import Joi from 'joi';
import curry from 'just-curry-it';
import _mergeWith from 'lodash.mergewith';
import { arrayFrom, runAll, mergeArray, skipFirstRun, isNotEmptyObject, assertIsDefined } from './utils';
import {
	HttpClientMetadataManager,
	InfoMetadataManager,
	MergeMetadataManager,
	MockMetadataManager,
	ParamMetadataManager,
	HeaderMetadataManager,
	RequestMetadataManager,
	ResponseMetadataManager,
} from './metadata';
import type {
	Validator,
	Transformer,
	HttpClient,
	GetSchema,
	HttpClientGetWithConfig,
	HttpClientGet,
	HttpClientGetWithUrlAndConfig,
} from './types';

const GlobalTarget = {};

const httpClientMetadataManager = new HttpClientMetadataManager({}, GlobalTarget);

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
	httpClientMetadataManager.replace({
		httpClient,
		signature: signature || 'position',
	});
}

function Get({ request, response }: GetSchema) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const { url, params, headers, wait, key: requestKey } = request;

		const innerMethod = descriptor.value;

		const requestMetadataManager = new RequestMetadataManager({}, target, propertyKey);
		_mergeWith(
			requestMetadataManager.get(),
			{
				get: [{ url, params, headers }],
			},
			mergeArray
		);

		const innerMethodIsOriginalMethod =
			Object.values(requestMetadataManager.get()).reduce((res, cur) => {
				return res + cur.length;
			}, 0) === 1
				? true
				: false;

		const infoMetadataManager = new InfoMetadataManager(
			{ resolveTimes: 0, originalMethod: descriptor.value },
			target,
			propertyKey
		);

		const paramMetadataManager = new ParamMetadataManager({}, target, propertyKey);
		const headerMetadataManager = new HeaderMetadataManager({}, target, propertyKey);
		const mergeMetadataManager = new MergeMetadataManager([], target, propertyKey);
		const mockMetadataManager = new MockMetadataManager({}, target);

		const {
			validators,
			transformers,
			beforeValidate,
			afterValidate,
			beforeTransform,
			afterTransform,
			catcher,
			key: responseKey,
		} = response || {};

		const validatorList = validators && arrayFrom(validators);
		const transformerList = transformers && arrayFrom(transformers);
		const beforeValidateList = beforeValidate && arrayFrom(beforeValidate);
		const afterValidateList = afterValidate && arrayFrom(afterValidate);
		const beforeTransformList = beforeTransform && arrayFrom(beforeTransform);
		const afterTransformList = afterTransform && arrayFrom(afterTransform);

		//TODO: handle merge funcs
		const invisibleMergeFuncs = mergeMetadataManager.get();

		descriptor.value = async function (this: any, ...parameters: any[]) {
			const requestMetadata = requestMetadataManager.get();
			const httpClientMetadata = httpClientMetadataManager.get();
			const mergeMetadata = mergeMetadataManager.get().filter((f) => !invisibleMergeFuncs.includes(f))[0];
			const mockMetadata = mockMetadataManager.get();

			isNotEmptyObject(requestMetadata, 'request metadata can not be empty');
			isNotEmptyObject(
				httpClientMetadata,
				'No Http Client! Maybe forgot to call useHttpClient before using this'
			);

			const innerP = Promise.resolve(
				!innerMethodIsOriginalMethod ? innerMethod.call(this, ...parameters) : undefined
			);

			if (wait) {
				await innerP;
			}

			const { httpClient, signature } = httpClientMetadata;

			const paramMetadata = paramMetadataManager.get();

			const reqParams =
				params &&
				Object.keys(params).reduce((res: { [index: string]: any }, k) => {
					const { index, cb, value } = paramMetadata[params[k]] || {};
					res[k] =
						typeof params[k] === 'symbol'
							? value
								? value
								: cb
								? cb(parameters[index!])
								: parameters[index!]
							: params[k];
					return res;
				}, {});

			const headerMetadata = headerMetadataManager.get();

			const reqHeaders = {
				...(headers || {}),
				...(requestKey ? headerMetadata[requestKey] || {} : {}),
			};

			let resp;
			const resMockData = (mockMetadata as any)[propertyKey];

			if (resMockData) resp = Promise.resolve(resMockData.find(({ url: u }: { url: string }) => u === url));
			else {
				switch (signature) {
					case 'name':
						resp = (httpClient.get as HttpClientGetWithConfig)({
							url,
							params: reqParams,
							headers: reqHeaders,
						});
						break;
					case 'position':
						resp = (httpClient.get as HttpClientGet)(url, reqParams, headers);
						break;
					case 'mix':
						resp = (httpClient.get as HttpClientGetWithUrlAndConfig)(url, {
							params: reqParams,
							headers: reqHeaders,
						});
						break;
					default:
						break;
				}
			}

			assertIsDefined(resp);

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

			if (!mergeMetadata) {
				return innerP.then(() => {
					infoMetadataManager.set((info) => {
						info.resolveTimes += 1;
					});
					return p.then((res: any) => {
						if (responseKey) {
							paramMetadataManager.set((m) => {
								m[Symbol.for(responseKey)] = { value: res };
							});
						}
						return res;
					});
				});
			}

			return innerP.then((innerValue) => {
				infoMetadataManager.set((info) => {
					info.resolveTimes += 1;
				});
				const next = mergeMetadata.merge(innerValue);
				mergeMetadataManager.replace(next);
				return p.then((res: any) => {
					if (responseKey) {
						paramMetadataManager.set((m) => {
							m[Symbol.for(responseKey)] = { value: res };
						});
					}
					return infoMetadataManager.get().resolveTimes >= mergeMetadata.requestCount ? next(res) : res;
				});
			});
		};
	};
}

function Params(key: string, cb?: (param: any) => any) {
	return function (target: any, propertyKey: string, parameterIndex: number) {
		const paramMetadataManager = new ParamMetadataManager({}, target, propertyKey);
		paramMetadataManager.set((paramMetadata) => {
			paramMetadata[Symbol.for(key)] = {
				index: parameterIndex,
				cb,
			};
		});
	};
}

function Headers(key: string) {
	return function (target: any, propertyKey: string, parameterIndex: number) {
		const headerMetadataManager = new HeaderMetadataManager({}, target, propertyKey);
		headerMetadataManager.set((headerMetadata) => {
			headerMetadata[key] = {
				index: parameterIndex,
			};
		});
	};
}

function Req

function Res(target: any, propertyKey: string, parameterIndex: number) {
	const responseMetadataManager = new ResponseMetadataManager({ index: 0 }, target, propertyKey);

	responseMetadataManager.set((m) => {
		m.index = parameterIndex;
	});
}

// Must be used on the top of decorators chain
function InjectRes(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
	const request = descriptor.value;
	const originalMethod = new InfoMetadataManager({} as any, target, propertyKey).get().originalMethod;

	assertIsDefined(originalMethod, 'InjectRes must be used on the top of decorators chain');

	const injectedIndex = new ResponseMetadataManager({} as any, target, propertyKey).get().index;

	assertIsDefined(injectedIndex, 'InjectRes must be used with Res decorator');

	descriptor.value = () =>
		request().then((res: any) =>
			originalMethod(
				...new Array(injectedIndex + 1).fill(undefined).map((v, i) => (i !== injectedIndex ? v : res))
			)
		);
}

function Mock(mockData: { [index: string]: any }) {
	return function (target: any, propertyKey: string) {
		if (process.env.NODE_ENV !== 'development') return;

		const mockMetadataManager = new MockMetadataManager({}, target);

		const returnMockData = (method: string) => {
			const requestMetadataManager = new RequestMetadataManager({}, target, method);
			const requestMetadata = requestMetadataManager.get();

			isNotEmptyObject(requestMetadata);

			return requestMetadata.get
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

				mockMetadataManager.set((mockMetadata) => {
					(mockMetadata as any)[prop] = returnMockData(prop);
				});
			});
		} else {
			mockMetadataManager.set((mockMetadata) => {
				(mockMetadata as any)[propertyKey] = returnMockData(propertyKey);
			});
		}
	};
}

function Merge(merge: (...args: any[]) => any) {
	return function (target: any, propertyKey: string) {
		const requestMetadataManager = new RequestMetadataManager({}, target, propertyKey);
		const requestMetadata = requestMetadataManager.get();

		isNotEmptyObject(requestMetadata);

		const requestCount = requestMetadata.get.length;

		const mergeMetadataManager = new MergeMetadataManager([], target, propertyKey);

		mergeMetadataManager.set((mergeFuncs) => {
			if (mergeFuncs.length === 0) {
				// Use skipFirstRun to skip the execution of the bottom method
				mergeFuncs.push({
					merge: skipFirstRun(curry(merge)),
					requestCount,
				});
			} else {
				mergeFuncs.push({
					merge: curry(merge),
					requestCount,
				});
			}
		});
	};
}

function Catch(catcher: Function) {
	return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
		const request = descriptor.value;

		descriptor.value = () => request().catch(catcher);
	};
}

// TODO: Req decorator: reuse other request

export { useHttpClient, Get, Params, Headers, Mock, Merge, Res, InjectRes, Catch };
