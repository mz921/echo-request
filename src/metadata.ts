import 'reflect-metadata';
import ScopedSingleton from 'scoped-singleton-decorator';
import produce from 'immer';
import {
	InfoMetadata,
	MergeMetadata,
	MockMetadata,
	ParamMetadata,
	HeaderMetadata,
	RequestMetadata,
	ResponseMetadata,
	GlobalRequestConfig,
} from './types';
import {
	HeaderSymbol,
	GlobalConfigSymbol,
	ConfigSymbol,
	InfoSymbol,
	MergeSymbol,
	MockSymbol,
	ParamSymbol,
	RequestSymbol,
	ResponseSymbol,
} from './symbols';
import { GlobalTarget } from './constants';

export interface IMetadataManager<T> {
	get(): T;
	replace(metadata: T): void;
	set(recipe: (draft: T) => void): void;
}

class MetadataManager {
	constructor(metadataKey: symbol, metadata: any, protected target: Object, protected propertyKey?: string | symbol) {
		this.defineMetadata(metadataKey, metadata);
	}

	protected defineMetadata(metadataKey: symbol, metadata: any) {
		if (this.propertyKey) Reflect.defineMetadata(metadataKey, metadata, this.target, this.propertyKey);
		else Reflect.defineMetadata(metadataKey, metadata, this.target);
	}

	protected getMetadata(metadataKey: symbol) {
		return this.propertyKey
			? Reflect.getMetadata(metadataKey, this.target, this.propertyKey)
			: Reflect.getMetadata(metadataKey, this.target);
	}
}

export function metadataManagerFactory<T>(
	metadataKey: symbol
): new (metadata: T, target: Object, propertyKey?: string | symbol) => IMetadataManager<T> {
	@ScopedSingleton(($1, target: Object, propertyKey?: string | symbol) => [target, propertyKey])
	class DerivedMetadataManager extends MetadataManager implements IMetadataManager<T> {
		constructor(metadata: T, target: Object, propertyKey?: string | symbol) {
			super(metadataKey, metadata, target, propertyKey);
		}

		get(): T {
			return this.getMetadata(metadataKey);
		}

		replace(metadata: T) {
			this.defineMetadata(metadataKey, metadata);
		}

		set(recipe: (draft: T) => void) {
			this.defineMetadata(metadataKey, produce(this.getMetadata(metadataKey), recipe));
		}
	}

	return DerivedMetadataManager;
}

export const ParamMetadataManager = metadataManagerFactory<ParamMetadata>(ParamSymbol);
export const HeaderMetadataManager = metadataManagerFactory<HeaderMetadata>(HeaderSymbol);
export const RequestMetadataManager = metadataManagerFactory<RequestMetadata | {}>(RequestSymbol);
export const GlobalConfigMetadataManager = metadataManagerFactory<GlobalRequestConfig | {}>(GlobalConfigSymbol);
export const ResponseMetadataManager = metadataManagerFactory<ResponseMetadata>(ResponseSymbol);
export const MockMetadataManager = metadataManagerFactory<MockMetadata | {}>(MockSymbol);
export const MergeMetadataManager = metadataManagerFactory<MergeMetadata>(MergeSymbol);
export const InfoMetadataManager = metadataManagerFactory<InfoMetadata>(InfoSymbol);

export const ConfigMetadataManager = class extends metadataManagerFactory<Record<string, GlobalRequestConfig> | {}>(ConfigSymbol) {
	get() {
		const config = (this as any).getMetadata(ConfigSymbol)
		if (config.length === 0) {
			const globalConfigMetadata = new GlobalConfigMetadataManager({}, GlobalTarget).get();

			return globalConfigMetadata
		}
		return config
	}
} 
