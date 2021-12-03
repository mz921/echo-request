import { Transformer } from './types';
import { arrayFrom } from './utils';

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

export default transform;