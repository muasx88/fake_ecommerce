const { respBad } = require('../helpers/response')

const { getProducts, getProduct, insertProduct, updateProduct, deleteProduct, updateProductStock, eleveniaAPI } = require("../handlers/product.handler");
const { insertProductSchema, updateProductSchema, updateProductStockSchema } = require('../schemas/product.schema');
const routes = [
	{
		method: "GET",
		path: "/products",
		handler: getProducts,
	},
	{
		method: "GET",
		path: "/products/{id}",
		handler: getProduct,
	},
	{
		method: "POST",
		path: "/products",
		options: {
			payload: {
				output: "stream",
				multipart: true
			},
			validate: {
				payload: insertProductSchema,
				failAction: (request, h, source, error) => {           
					return h.response(respBad(source.details[0].message, null)).code(400).takeover();                      
				}
			}
		},
		handler: insertProduct,
	},
	{
		method: "PUT",
		path: "/products/{id}",
		options: {
			payload: {
				output: "stream",
				multipart: true
			},
			validate: {
				payload: updateProductSchema,
				failAction: (request, h, source, error) => {           
					return h.response(respBad(source.details[0].message, null)).code(400).takeover();                      
				}
			}
		},
		handler: updateProduct,
	},
	{
		method: "POST",
		path: "/products/update-stock",
		options: {
			validate: {
				payload: updateProductStockSchema,
				failAction: (request, h, source, error) => {           
					return h.response(respBad(source.details[0].message, null)).code(400).takeover();                      
				}
			}
		},
		handler: updateProductStock,
	},
	{
		method: "DELETE",
		path: "/products/{id}",
		handler: deleteProduct,
	},
	{
		method: "GET",
		path: "/products/elevenia-api",
		handler: eleveniaAPI,
	},
];

module.exports = routes;
