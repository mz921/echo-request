import {
	ParamMetadataManager,
	HeaderMetadataManager,
	MockMetadataManager,
	GlobalConfigMetadataManager,
	ConfigMetadataManager, 
} from './metadata';
import {
	RequestDecoratorConfig,
	RequestHostConfig,
	GetDecoratorConfig,
	PostDecoratorConfig,
	AnonymousDecoratorConfig,
	HttpClientGet,
	HttpClientGetWithConfig,
	HttpClientGetWithUrlAndConfig,
	HttpClientPost,
	HttpClientPostWithConfig,
	HttpClientPostWithUrlAndConfig,
	GlobalRequestConfig,
} from './types';
import { arrayFrom, assertIsDefined, assertIsSpecifiedType, isNotEmptyObject, runAll } from './utils';
import { GlobalTarget } from './constants';
import { bridge } from './bridge';
import validate from './validate';
import transform from './transform';
import { createStaleWhileRevalidateCache } from 'stale-while-revalidate-cache'

const globalConfigMetadataManager = new GlobalConfigMetadataManager({}, GlobalTarget);

function createRequest(
	sendRequest: () => Promise<any>,
	config?: GetDecoratorConfig | PostDecoratorConfig | AnonymousDecoratorConfig
) {
	return {
		...(config || {}).request,
		send: sendRequest,
		responseKey: (config || {}).response?.key,
	};
}

function initRequest(reqDecoratorConfig: RequestDecoratorConfig, reqHostConfig: RequestHostConfig) {
	let r: (() => Promise<any>) | undefined;

	const { target, propertyKey, parameters } = reqHostConfig;

	const paramMetadata = new ParamMetadataManager({}, target, propertyKey).get();

	const configMetadata = new ConfigMetadataManager({}, target, propertyKey).get()

	const { httpClient, signature } = configMetadata as GlobalRequestConfig;

	if (typeof reqDecoratorConfig !== 'function' && !(reqDecoratorConfig.request as any).send) {
		assertIsSpecifiedType<GetDecoratorConfig | PostDecoratorConfig>(reqDecoratorConfig);

		const { request, response } = reqDecoratorConfig;

		const { method, url, params, headers, key: requestKey } = request;
		const data = request.method === 'POST' ? request.data : undefined;

		// TODO: validate data from outside here.

		const { validators, transformers, beforeValidate, afterValidate, beforeTransform, afterTransform, catcher } =
			response || {};

		const validatorList = validators && arrayFrom(validators);
		const transformerList = transformers && arrayFrom(transformers);
		const beforeValidateList = beforeValidate && arrayFrom(beforeValidate);
		const afterValidateList = afterValidate && arrayFrom(afterValidate);
		const beforeTransformList = beforeTransform && arrayFrom(beforeTransform);
		const afterTransformList = afterTransform && arrayFrom(afterTransform);

		const headerMetadata = new HeaderMetadataManager({}, target, propertyKey).get();
		const mockMetadata = new MockMetadataManager({}, target).get();

		isNotEmptyObject(
			configMetadata,
			'No Config! Maybe forgot to call createRequestConfig or use ReqConfig before request'
		);

		const reqParams = params && bridge(params, paramMetadata, parameters);

		const reqData = data && bridge(data, paramMetadata, parameters);

		const reqHeaders = {
			...(headers || {}),
			...(requestKey ? headerMetadata[requestKey] || {} : {}),
		};

		const resMockData = (mockMetadata as any)[propertyKey];

		if (resMockData)
			r = () => Promise.resolve(resMockData.find(({ url: u }: { url: string }) => u === url).mockData);
		else {
			if (method === 'GET') {
				switch (signature) {
					case 'name':
						r = () =>
							(httpClient.get as HttpClientGetWithConfig)({
								url,
								params: reqParams,
								headers: reqHeaders,
							});
						break;
					case 'position':
						r = () => (httpClient.get as HttpClientGet)(url, reqParams, headers);
						break;
					case 'mix':
						r = () =>
							(httpClient.get as HttpClientGetWithUrlAndConfig)(url, {
								params: reqParams,
								headers: reqHeaders,
							});
						break;
					default:
						break;
				}
			} else if (method === 'POST') {
				switch (signature) {
					case 'name':
						r = () =>
							(httpClient.post as HttpClientPostWithConfig)({
								url,
								data: reqData,
								headers: reqHeaders,
							});
						break;
					case 'position':
						r = () => (httpClient.post as HttpClientPost)(url, reqData, headers);
						break;
					case 'mix':
						r = () =>
							(httpClient.post as HttpClientPostWithUrlAndConfig)(url, {
								data: reqData,
								headers: reqHeaders,
							});
						break;
					default:
						break;
				}
			} else {
				throw new Error('Unsupported Request Method');
			}
		}

		assertIsDefined(r, 'Unsupported HttpClient Signature');

		let responseData: unknown;
		const mountHooks = (p: Promise<any>) => {
			let m = p
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
			{
			}

			if (catcher) m = m.catch(catcher);

			return m;
		};

		const t = r;
		r = () => mountHooks(t());

		return createRequest(r, reqDecoratorConfig);
	} else if (typeof reqDecoratorConfig !== 'function') {
		assertIsSpecifiedType<AnonymousDecoratorConfig>(reqDecoratorConfig);

		return createRequest(reqDecoratorConfig.request.send, {
			request: {
				...reqDecoratorConfig.request,
				sendArguments: bridge(reqDecoratorConfig.request.sendArguments || [], paramMetadata, parameters),
			},
			response: reqDecoratorConfig.response,
		});
	}

	return createRequest(reqDecoratorConfig);
}

export { initRequest };
