const {
	getTransactions,
	getTransaction,
	insertTransaction,
	deleteTransaction,
	updateTransactionStatus,
	updateTransactionAWB,
} = require("../handlers/transaction.handler");
const { respBad } = require("../helpers/response");
const {
	transactionSchema,
	updateTransactionStatusSchema,
	updateTransactionAWBSchema,
} = require("../schemas/transaction.schema");

const routes = [
	{
		method: "GET",
		path: "/transactions",
		handler: getTransactions,
	},
	{
		method: "GET",
		path: "/transactions/{trn_id}",
		handler: getTransaction,
	},
	{
		method: "POST",
		path: "/transactions",
		options: {
			validate: {
				payload: transactionSchema,
				failAction: (request, h, source, error) => {
					return h
						.response(respBad(source.details[0].message, null))
						.code(400)
						.takeover();
				},
			},
		},
		handler: insertTransaction,
	},
	{
		method: "DELETE",
		path: "/transactions/{trn_id}",
		handler: deleteTransaction,
	},
	{
		method: "PUT",
		path: "/transactions/{trn_id}/update-status",
		options: {
			validate: {
				payload: updateTransactionStatusSchema,
				failAction: (request, h, source, error) => {
					return h
						.response(respBad(source.details[0].message, null))
						.code(400)
						.takeover();
				},
			},
		},
		handler: updateTransactionStatus,
	},
	{
		method: "PUT",
		path: "/transactions/{trn_id}/update-awb",
		options: {
			validate: {
				payload: updateTransactionAWBSchema,
				failAction: (request, h, source, error) => {
					return h
						.response(respBad(source.details[0].message, null))
						.code(400)
						.takeover();
				},
			},
		},
		handler: updateTransactionAWB,
	},
];

module.exports = routes;
