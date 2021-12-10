import 'reflect-metadata';
import curry from 'just-curry-it';
import _mergeWith from 'lodash.mergewith';
import { mergeArray, skipFirstRun, isNotEmptyObject, assertIsDefined } from './utils';
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
	HttpClient,
	GetDecoratorConfig,
	PostDecoratorConfig,
	RequestDecoratorConfig,
} from './types';
import { initRequest } from './init';
import { GlobalTarget } from './constants';
import { DeepOmit } from 'ts-essentials';

const httpClientMetadataManager = new HttpClientMetadataManager({}, GlobalTarget);

function useHttpClient(httpClient: HttpClient, signature?: string) {
	httpClientMetadataManager.replace({
		httpClient,
		signature: signature || 'position',
	});
}

function Req(reqDecoratorConfig: RequestDecoratorConfig) {
	return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
		const innerMethod = descriptor.value;
		const requestMetadataManager = new RequestMetadataManager({}, target, propertyKey);

		_mergeWith(
			requestMetadataManager.get(),
			{
				// push placeholders, since the merge decorator needs that to determine merged request counts.
				placeholder: [1],
				// push Get prop, since the mock decorator needs that to set mock data.
				GET: (reqDecoratorConfig as any).request?.method === 'GET' ? [{url: (reqDecoratorConfig as any).request.url}] : []
			},
			mergeArray
		);

		const infoMetadataManager = new InfoMetadataManager(
			{ resolveTimes: 0, originalMethod: descriptor.value },
			target,
			propertyKey
		);

		const mergeMetadataManager = new MergeMetadataManager([], target, propertyKey);
		const paramMetadataManager = new ParamMetadataManager({}, target, propertyKey);

		const invisibleMergeFuncs = mergeMetadataManager.get();

		const innerMethodIsOriginalMethod = innerMethod === infoMetadataManager.get().originalMethod;

		descriptor.value = async function (this: any, ...parameters: any[]) {
			const innerP = Promise.resolve(
				!innerMethodIsOriginalMethod ? innerMethod.call(this, ...parameters) : undefined
			);

			if ((reqDecoratorConfig as any).request?.wait) {
				await innerP;
			}

			const request: { [index: string]: any } = initRequest(reqDecoratorConfig, {
				target,
				propertyKey,
				parameters,
			});

			// clear request metadata
			if ((requestMetadataManager.get() as any).placeholder) {
				requestMetadataManager.set((requestMetadata) => ({}));
			}

			_mergeWith(
				requestMetadataManager.get(),
				{
					[request.method || 'ANONYMOUS']: [request],
				},
				mergeArray
			);

			const mergeMetadata = mergeMetadataManager.get().filter((f) => !invisibleMergeFuncs.includes(f))[0];

			const p = request.send(...(request.sendArguments || []));
			const responseKey = request.responseKey;

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

function Get(getDecoratorConfig: DeepOmit<GetDecoratorConfig, {request: {method: never}}>) {
	return Req({
		request: {
			method: 'GET',
			...getDecoratorConfig.request
		},
		response: {
			...getDecoratorConfig.response
		}
	})
}

function Post(postDecoratorConfig: DeepOmit<PostDecoratorConfig, {request: {method: never}}>) {
	return Req({
		request: {
			method: 'POST',
			...postDecoratorConfig.request
		},
		response: {
			...postDecoratorConfig.response
		}
	})
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

			return requestMetadata.GET.map(({ url }: { url: string }) => {
				if (!mockData[url]) {
					console.warn(`Can not find mock data for ${url}`);
					return null;
				}
				return {
					url,
					mockData: mockData[url],
				};
			}).filter((d: object | null) => d);
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

		const requestCount = Object.values(requestMetadata).reduce((res, cur) => res + cur.length, 0);

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

		descriptor.value = (...parameters: any[]) => request(...parameters).catch(catcher);
	};
}

export { useHttpClient, Req, Get, Post, Params, Headers, Mock, Merge, Res, InjectRes, Catch };
