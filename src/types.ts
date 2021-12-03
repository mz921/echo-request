import { AnySchema } from 'joi';

type Validator = ((response: any, parameters?: any[]) => any) | AnySchema;

type Transformer = (data: any, parameters?: any[]) => any;

type HttpClientGet = (url: string, params?: { [prop: string]: any }, headers?: { [prop: string]: any }) => Promise<any>;
type HttpClientGetWithConfig = (config: {
	url: string;
	params: { [index: string]: any } | undefined;
	headers: { [prop: string]: any } | undefined;
}) => Promise<any>;
type HttpClientGetWithUrlAndConfig = (
	url: string,
	config: {
		params: { [index: string]: any } | undefined;
		headers: { [prop: string]: any } | undefined;
	}
) => Promise<any>;

type HttpClientPost = (url: string, data?: { [prop: string]: any }, headers?: { [prop: string]: any }) => Promise<any>;
type HttpClientPostWithConfig = (config: {
	url: string;
	data: { [index: string]: any } | undefined;
	headers: { [prop: string]: any } | undefined;
}) => Promise<any>;
type HttpClientPostWithUrlAndConfig = (
	url: string,
	config: {
		data: { [index: string]: any } | undefined;
		headers: { [prop: string]: any } | undefined;
	}
) => Promise<any>;

interface HttpClient {
	get: HttpClientGet | HttpClientGetWithConfig | HttpClientGetWithUrlAndConfig;
	post: HttpClientPost | HttpClientPostWithConfig | HttpClientPostWithUrlAndConfig;
}

type HttpRequestMethods = 'GET' | 'POST';

interface BaseRequestCofig {
	method: HttpRequestMethods;
	url: string;
	params?: { [prop: string]: any };
	headers?: { [prop: string]: any };
	wait?: boolean;
	key?: string;
}

interface GetRequestConfig extends BaseRequestCofig {
	method: 'GET';
}

interface PostRequestConfig extends BaseRequestCofig {
	method: 'POST';
	data: { [prop: string]: any } | FormData | symbol;
}
interface BaseRequestDecoratorConfig<T extends HttpRequestMethods> {
	request: T extends 'GET' ? GetRequestConfig : T extends 'POST' ? PostRequestConfig : never;

	response?: {
		validators?: Validator | Validator[];
		transformers?: Transformer | Transformer[];
		beforeValidate?: ((response: any) => void) | ((response: any) => void)[];
		afterValidate?: ((response: any) => void) | ((response: any) => void)[];
		beforeTransform?: ((response: any) => any) | ((response: any) => any)[];
		afterTransform?: ((transformedResponse: any) => void) | ((transformedResponse: any) => void)[];
		catcher?: (transformedResponse: any) => void;
		key?: string;
	};
}

type GetDecoratorConfig = BaseRequestDecoratorConfig<'GET'>;

type PostDecoratorConfig = BaseRequestDecoratorConfig<'POST'>;

type AnonymousDecoratorConfig = {
	request: { send: (...args: any[]) => Promise<any>; sendArguments?: any[]; wait?: boolean };
	response?: { key?: string };
};

type RequestDecoratorConfig =
	| GetDecoratorConfig
	| PostDecoratorConfig
	| ((...args: any[]) => Promise<any>)
	| AnonymousDecoratorConfig;

type RequestHostConfig = {
	target: any;
	propertyKey: string;
	parameters: any[];
};

interface HttpClientMetadata {
	httpClient: HttpClient;
	signature: string;
}

interface ParamMetadata {
	[index: symbol]: {
		index?: number;
		cb?: (param: any) => any;
		value?: any;
	};
}

interface HeaderMetadata {
	[index: string | symbol]: {
		index: number;
	};
}

interface RequestMetadata {
	GET: {
		url: string;
		params:
			| {
					[prop: string]: any;
			  }
			| undefined;
		headers:
			| {
					[prop: string]: any;
			  }
			| undefined;
	}[];

	POST: {
		url: string;
		data:
			| {
					[prop: string]: any;
			  }
			| FormData
			| undefined;
		headers: {
			[prop: string]: any;
		};
	};
}

interface ResponseMetadata {
	index: number;
}

type MockMetadata = Record<string, any>;

type MergeInfo = {
	requestCount: number;
};

type MergeMetadata = ({ merge: Function } & MergeInfo)[];

interface InfoMetadata {
	resolveTimes: number;

	originalMethod: Function;
}

export type {
	Validator,
	Transformer,
	HttpClient,
	HttpClientGet,
	HttpClientGetWithConfig,
	HttpClientGetWithUrlAndConfig,
	HttpClientPost,
	HttpClientPostWithConfig,
	HttpClientPostWithUrlAndConfig,
	GetDecoratorConfig,
	PostDecoratorConfig,
	AnonymousDecoratorConfig,
	RequestDecoratorConfig,
	RequestHostConfig,
	HttpClientMetadata,
	ParamMetadata,
	HeaderMetadata,
	RequestMetadata,
	ResponseMetadata,
	MergeMetadata,
	MockMetadata,
	InfoMetadata,
};
