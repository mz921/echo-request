import type { Schema } from 'joi';

type Validator = ((response: any, parameters?: any[]) => any) | Schema;

type Transformer = (data: any, parameters?: any[]) => any;

interface HttpClient {
    get: (url: string, params?: {[prop: string]: any}, headers?: {[prop: string]: any}) => Promise<any>
}

interface GetSchema {
    request: {
        url: string,
        params?:  {[prop: string]: any},
        headers?: {[prop: string]: any}
    },

    response?: {
        validators?: Validator | Validator[],
        transformers?: Transformer | Transformer[],
        beforeValidate?: ((response: any) => void) | ((response: any) => void)[],
        afterValidate?: ((response: any) => void) | ((response: any) => void)[],
        beforeTransform?: ((response: any) => any) | ((response: any) => any)[],
        afterTransform?: ((transformedResponse: any) => void) | ((transformedResponse: any) => void)[],
        catcher: (transformedResponse: any) => void
    }
}

export type {
    Validator,
    Transformer,
    HttpClient,
    GetSchema
}