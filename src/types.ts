import type { Schema } from 'joi';

type Validator = ((response: any, parameters?: any[]) => any) | Schema;

type Transformer = (data: any, parameters?: any[]) => any;

type HttpClientGet = (url: string, params?: { [prop: string]: any }, headers?: { [prop: string]: any }) => Promise<any>;
type HttpClientGetWithConfig = (config: {
	url: string;
	params: { [index: string]: any } | undefined;
	headers: { [prop: string]: any } | undefined;
}) => Promise<any>;
type HttpClientGetWithUrlAndConfig = (
	url: string,
	confih: {
		params: { [index: string]: any } | undefined;
		headers: { [prop: string]: any } | undefined;
	}
) => Promise<any>;

interface HttpClient {
	get: HttpClientGet | HttpClientGetWithConfig | HttpClientGetWithUrlAndConfig
}

interface GetSchema {
	request: {
		url: string;
		params?: { [prop: string]: any };
		headers?: { [prop: string]: any };
	};

	response?: {
		validators?: Validator | Validator[];
		transformers?: Transformer | Transformer[];
		beforeValidate?: ((response: any) => void) | ((response: any) => void)[];
		afterValidate?: ((response: any) => void) | ((response: any) => void)[];
		beforeTransform?: ((response: any) => any) | ((response: any) => any)[];
		afterTransform?: ((transformedResponse: any) => void) | ((transformedResponse: any) => void)[];
		catcher?: (transformedResponse: any) => void;
        name ?: string;
	};
}

interface HttpClientMetadata {
	httpClient: HttpClient;
	signature: string;
}

interface ParamMetadata {
	[index: symbol]: {
		index: number;
		cb?: (param: any) => any;
	};
}

interface RequestMetadata {
	get: {
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
}

type MockMetadata = Record<string, any>;

type MergeInfo = {
    requestCount: number,
}

type MergeMetadata = ({merge: Function} & MergeInfo)[]

interface InfoMetadata {
	_resolveTimes: number;
}

export type {
	Validator,
	Transformer,
	HttpClient,
	HttpClientGet,
	HttpClientGetWithConfig,
    HttpClientGetWithUrlAndConfig,
	GetSchema,
	HttpClientMetadata,
	ParamMetadata,
	RequestMetadata,
	MergeMetadata,
	MockMetadata,
	InfoMetadata,
};
