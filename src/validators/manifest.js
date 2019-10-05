import { Joi } from 'celebrate';

export const manifest = {
    params: Joi.object({
        project: Joi.string()
            .min(1)
            .max(36)
            .required()
    })
};
