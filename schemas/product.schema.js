const Joi = require("joi");

exports.insertProductSchema = Joi.object({
	name: Joi.string().min(3).required(),
	sku: Joi.string().min(3).required(),
	price: Joi.number().required(),
	image: Joi.required(),
	qty: Joi.number().required(),
	description: Joi.optional(),
});

exports.updateProductSchema = Joi.object({
	name: Joi.string().min(3).required(),
	sku: Joi.string().min(3).required(),
	price: Joi.number().required(),
	image: Joi.required(),
	description: Joi.optional(),
});

exports.updateProductStockSchema = Joi.object({
	sku: Joi.string().min(3).required(),
	qty: Joi.number().required()
});