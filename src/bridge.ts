import { assertIsDefined } from './utils';
import { ParamMetadata } from './types';

function bridge(
	placeholder: { [prop: string]: any } | symbol | any[],
	paramMetadata: ParamMetadata,
	runtimeParameters: any[]
) {
	if (typeof placeholder !== 'symbol' && !Array.isArray(placeholder)) {
		return Object.keys(placeholder).reduce((res: { [index: string]: any }, k) => {
			const { index, cb, value } = paramMetadata[placeholder[k]] || {};

			if (typeof placeholder[k] === 'symbol') {
				assertIsDefined(
					value || index,
					`The symbol ${String(placeholder[k])} is not defined in parameters or response`
				);

				res[k] = value || (cb ? cb(runtimeParameters[index!]) : runtimeParameters[index!]);
			} else {
				res[k] = placeholder[k];
			}
			return res;
		}, {});
	} else if (!Array.isArray(placeholder)) {
		const { index, cb, value } = paramMetadata[placeholder];

		assertIsDefined(value || index, `The symbol ${String(placeholder)} is not defined in parameters or response`);

		return value || (cb ? cb(runtimeParameters[index!]) : runtimeParameters[index!]);
	}

	return placeholder.map((param: any) => {
		const { index, cb, value } = paramMetadata[param] || {};

		if (typeof param === 'symbol') {
			assertIsDefined(
				value || index !== undefined,
				`The symbol ${String(param)} is not defined in parameters or response`
			);
            return value || (cb ? cb(runtimeParameters[index!]) : runtimeParameters[index!]); 
		}
        return param;
	});
}

export { bridge };
