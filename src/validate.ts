import Joi from 'joi';
import { arrayFrom } from './utils';
import { Validator } from './types';

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

export default validate;