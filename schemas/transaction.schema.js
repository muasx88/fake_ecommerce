const Joi = require("joi");

exports.transactionSchema = Joi.object({
	sku: Joi.string().min(3).required(),
	qty: Joi.number().required(),
});

exports.updateTransactionStatusSchema = Joi.object({
	status: Joi.string().valid("processing", "completed", "cancelled").required(),
});

exports.updateTransactionAWBSchema = Joi.object({
	awb: Joi.string().length(8).required()
});
