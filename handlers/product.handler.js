const client = require("../config/db");
const axios = require("axios")
const xml2js = require('xml2js');
const { respOk, respBad } = require("../helpers/response");
const uploads = require("../helpers/uploads");
const { getProductBy, getItemStock } = require("../helpers/utils");

require('dotenv').config()

const getProducts = async (request, h) => {
	const currentPage = parseInt(request.query.page)|| 1;
	const perPage = parseInt(request.query.perPage) || 10;

	const offset = (currentPage - 1) * perPage;
	const limit = perPage;
	let result = {};

	try {
		const totalProductQ = await client.query("SELECT count(id) FROM product");
		const totalProduct = parseInt(totalProductQ.rows[0].count);

		const sql = `
			SELECT id, name, sku, image, price, 
			(SELECT coalesce(final_stock, 0 ) FROM stock WHERE product_id = product.id ORDER BY created_at DESC LIMIT 1) as stock
			FROM product OFFSET $1 LIMIT $2;
		`;
		const products = await client.query(sql, [offset, limit]);

		result.total = totalProduct;
		result.current_page = currentPage;
		result.per_page = perPage;
		result.products = products.rows.map((product) => {
			return {
				id: product.id,
				name: product.name,
				sku: product.sku,
				price: product.price,
				image_url: `${request.url.origin}/uploads/${product.image}`,
				stock: product.stock,
			};
		});

		if (currentPage * perPage < totalProduct) {
			result.next = {
				url: `${request.url.origin}${request.url.pathname}?page=${
					currentPage + 1
				}&perPage=${perPage}`,
			};
		}

		if (offset > 0) {
			result.previous = {
				url: `${request.url.origin}${request.url.pathname}?page=${
					currentPage - 1
				}&perPage=${perPage}`,
			};
		}

		return h.response(respOk("Product Lists", result));
	} catch (error) {
		return h.response(respBad("Error get product", error.message)).code(400);
	}
};

const getProduct = async (request, h) => {
	try {
		const sql = `
			SELECT name, sku, image, price, description,
			(SELECT coalesce(final_stock, 0 ) FROM stock WHERE product_id = product.id ORDER BY created_at ASC LIMIT 1) as stock
			FROM product WHERE id = $1
		`;

		const product = await client.query(sql, [request.params.id]);

		if (product.rowCount == 0) {
			return h.response(respBad("Product Not Found", null, 404)).code(404);
		}

		product.rows[0].image_url = `${request.url.origin}/uploads/${product.rows[0].image}`

		return h.response(respOk("Product Detail", product.rows[0]));
	} catch (error) {
		return h.response(respBad("Error get product", error.message)).code(400);
	}
};

const insertProduct = async (request, h) => {
	const { name, sku, image, price, qty, description } = request.payload;

	// check if product sku exits
	const productExist = await getProductBy("sku", sku);
	if (productExist.rowCount > 0) {
		return h.response(respBad("Product SKU already exists", null)).code(400);
	}

	// upload image
	let fileName = "";
	try {
		const uploadImage = await uploads(request.payload.image, {
			dest: "uploads/",
		});
		fileName = uploadImage.filename;
	} catch (error) {
		console.log(error);
		return h.response(respBad("Error upload image product", error.message)).code(400);
	}

	try {
		const sql =
			"INSERT INTO product(name, sku, image, price, description) VALUES($1, $2, $3, $4, $5) RETURNING *";

		await client.query("BEGIN");
		const insertedProduct = await client.query(sql, [
			name,
			sku,
			fileName,
			price,
			description,
		]);

		// insert product stok
		await client.query(
			"INSERT INTO stock(product_id, qty_in, final_stock, description) VALUES($1, $2, $3, $4) RETURNING final_stock",
			[insertedProduct.rows[0].id, qty, qty, 'new']
		);
		await client.query("COMMIT");

		return h.response(respOk("Insert product success", insertedProduct.rows[0], 201)).code(201);
	} catch (error) {
		await client.query("ROLLBACK");
		return h.response(respBad("Error insert product", error.message)).code(400);
	}
};

const updateProduct = async (request, h) => {
	const id = request.params.id;
	const { name, sku, image, price, description } = request.payload;

	// check product exits
	const product = await getProductBy("id", id);
	if (product.rowCount == 0) {
		return h.response(respBad("Product Not Found", null, 404)).code(404);
	}

	// check sku exists
	const skuExists = await client.query(`
		SELECT count(*) as aggregate FROM product where sku = $1 and id <> $2
	`, [sku, id])

	if(skuExists.rows[0].aggregate != '0') {
		return h.response(respBad("Product SKU already exists", null)).code(400);
	}

	// upload image
	let fileName = "";
	try {
		const uploadImage = await uploads(request.payload.image, {
			dest: "uploads/",
		});
		fileName = uploadImage.filename;
	} catch (error) {
		console.log(error);
		return h.response(respBad("Error upload image product", error.message)).code(400);
	}

	try {
		const sql = `UPDATE product
			SET name = $1, sku = $2, image = $3, price = $4, description = $5
			WHERE id = $6
			RETURNING *
		`;
		const updatedProduct = await client.query(sql, [name, sku, fileName, price, description, id]);

		return h.response(respOk("Update product success", updatedProduct.rows[0]));
	} catch (error) {
		return h.response(respBad("Error update product", error.message)).code(400);
	}
};

const updateProductStock = async (request, h) => {

	const { sku, qty } = request.payload;

	// check product exits
	const product = await getProductBy("sku", sku);
	if (product.rowCount == 0) {
		return h.response(respBad("Invalid product", null, 404)).code(404);
	}

	const oldStock = await getItemStock(product.rows[0].id);
	const newStock = oldStock + qty;

	try {
		const sql = `INSERT INTO stock (product_id, qty_in, final_stock) VALUES ($1, $2, $3) RETURNING product_id, qty_in, final_stock`;
		const updatedProductStock = await client.query(sql, [product.rows[0].id, qty, newStock]);

		return h.response(respOk("Update product success", updatedProductStock.rows[0]));
	} catch (error) {
		return h.response(respBad("Error update product", error.message)).code(400);
	}

}

const deleteProduct = async (request, h) => {
	const id = request.params.id;
	// check product exits
	const product = await getProductBy("id", id);
	if (product.rowCount == 0) {
		return h.response(respBad("Product Not Found", null, 404)).code(404);
	}

	await client.query('BEGIN')
	try {
		await client.query("DELETE FROM product WHERE id = $1", [id]);
		await client.query("DELETE FROM transactions WHERE sku = $1", [product.rows[0].sku])

		await client.query('COMMIT')

		return h.response(respOk("Product deleted"));
	} catch (error) {
		await client.query("ROLLBACK");
		return h.response(respBad("Error delete product", error.message)).code(400);
	}
};

const eleveniaAPI = async (request, h) => {
	const URL = 'http://api.elevenia.co.id/rest/prodservices/product/listing';

	let products = [];

	try {
		const request = await axios.get(URL, { 
			headers:  {
				'Content-Type': 'application/xml',
				'Accept-Charset': 'utf-8',
				'openapikey': process.env.ELEVANIA_KEY
			}
		})

		const response = await request.data

		const parser = new xml2js.Parser();
		const result = await parser.parseStringPromise(response)

		result.Products.product.forEach( val => {
			const product = {
				name: val.prdNm[0], 
				sku: val.prdNo[0], 
				image: 'item.jpg', 
				price: parseInt(val.selPrc[0]),
				qty: parseInt(val.prdSelQty[0])
			}

			products.push(product)
		})

	} catch (error) {
		return h.response(respBad("Error get products endpoint", error.message)).code(400);
	}

	if(products.length == 0){
		return h.response(respBad("Error get products endpoint", null)).code(400);
	}

	let errors = []
	let xErrors = Promise.all(products.map(value =>
		getProductBy("sku", value.sku).then(product => {
			if(product.rowCount > 0) {
				errors.push(value.sku)
			}else {
				return client.query('BEGIN', err => {
					client.query("INSERT INTO product(name, sku, image, price) VALUES($1, $2, $3, $4) RETURNING id",[
						value.name, value.sku, value.image, value.price
					], (err, res) => {
						if(err) client.query('ROLLBACK')

						client.query("INSERT INTO stock(product_id, qty_in, final_stock) VALUES($1, $2, $3)",[
							res.rows[0].id, value.qty, value.qty
						], (err, res) => {
							if(err) client.query('ROLLBACK')
							client.query('COMMIT')
						})
					})
				})

			}
		}).catch(err => {
			console.log(err)
		})
	)).then(() => errors)

	let message = "All products inserted to DB";
	if((await xErrors).length > 0) {
		message = "Not all products inserted to DB"
	}

	let results = {
		unique: await xErrors,
		message
	}

	return h.response(respOk(results,null, 201)).code(201);
	
}

module.exports = {
	getProducts,
	getProduct,
	insertProduct,
	updateProduct,
	deleteProduct,
	updateProductStock,
	eleveniaAPI
};
