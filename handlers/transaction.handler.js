const client = require("../config/db");
const { respOk, respBad } = require("../helpers/response");
const { getProductBy, getItemStock, randomString } = require("../helpers/utils");

const getTransactions = async (request, h) => {
	const currentPage = parseInt(request.query.page) || 1;
	const perPage = parseInt(request.query.perPage) || 10;

	const offset = (currentPage - 1) * perPage;
	const limit = perPage;
	let result = {};

	try {
		const totalTransactionQ = await client.query("SELECT count(id) FROM transactions");
		const totalTransaction = parseInt(totalTransactionQ.rows[0].count);

		const sql = `
			SELECT trn_id, sku, qty, amount, status, awb
			FROM transactions OFFSET $1 LIMIT $2;
		`;
		const transactions = await client.query(sql, [offset, limit]);

		result.total = totalTransaction;
		result.current_page = currentPage;
		result.per_page = perPage;
		result.transactions = transactions.rows

		if (currentPage * perPage < totalTransaction) {
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

		return h.response(respOk("Transaction Lists", result));
	} catch (error) {
		return h.response(respBad("Error get Transaction", error.message)).code(400);
	}
};

const getTransaction = async (request, h) => {
	try {
		const transaction = await getDetailTransaction(request.params.trn_id);
		if (transaction.rowCount == 0) {
			return h.response(respBad("Transaction Not Found", null, 404)).code(404);
		}

		return h.response(respOk("Transaction Detail", transaction.rows[0]));
	} catch (error) {
		return h.response(respBad("Error get Transaction", error.message)).code(400);
	}
};

const insertTransaction = async (request, h) => {
	const { sku, qty } = request.payload

	// get product data
	let product = await getProductBy('sku', sku)
	if(product.rowCount == 0 ) {
		return h.response(respBad("Invalid Product", null)).code(400);
	}

	const _product = product.rows[0];

	// get product stock
	const stock = await getItemStock(_product.id)

	if(stock == 0) {
		return h.response(respBad(`Product out of stock`, null)).code(400);
	}

	if(stock < qty) {
		return h.response(respBad(`Error qty. Maximum qty for this product is ${stock}`, null)).code(400);
	}

	await client.query('BEGIN')
	try {
		const trn_id = randomString(4)
		const amount = qty * _product.price;

		const sql = `
			INSERT INTO transactions (trn_id, sku, qty, amount) VALUES ($1, $2, $3, $4)
			RETURNING *
		`;
		const insertedTransaction = await client.query(sql, [trn_id.toUpperCase(), sku, qty, amount]);

		// insert new stock
		const newStock = stock - qty;
		await client.query('INSERT INTO stock (product_id, qty_in, qty_out, final_stock, description) VALUES ($1,$2,$3,$4, $5)',[
			_product.id, 0, qty, newStock, "product ordered"
		]);

		await client.query('COMMIT')

		return h.response(respOk("Insert transaction success", insertedTransaction.rows[0], 201)).code(201);
		
	} catch (error) {
		await client.query("ROLLBACK");
		return h.response(respBad("Error insert transaction", error.message)).code(400);
	}
};

const deleteTransaction = async (request, h) => {

	try {
		const transaction = await getDetailTransaction(request.params.trn_id);
		if (transaction.rowCount == 0) {
			return h.response(respBad("Transaction Not Found", null, 404)).code(404);
		}

		await client.query("DELETE FROM transactions WHERE trn_id = $1", [request.params.trn_id]);
		return h.response(respOk("Transaction deleted"));
	} catch (error) {
		return h.response(respBad("Error delete transaction", error.message)).code(400);
	}
}

const updateTransactionStatus = async (request, h) => {
	const {trn_id} = request.params
	const {status} = request.payload

	const transaction = await getDetailTransaction(trn_id);
	if (transaction.rowCount == 0) {
		return h.response(respBad("Transaction Not Found", null, 404)).code(404);
	}

	const _transaction = transaction.rows[0]
	
	// cannot change status transaction if already completed or cancelled
	if(_transaction.status == 'completed' || _transaction.status == 'cancelled') {
		return h.response(respBad(`Transaction ${_transaction.status} and cannot be changed`, null, 404)).code(404);
	}
	
	// cannot re-processing the transaction that already being processing
	if(_transaction.status == 'processing' && status == 'processing') {
		return h.response(respBad(`Transaction in processing`, null, 404)).code(404);
	}

	// cannot cancel transacation that already being process
	if(_transaction.status == 'processing' && status == 'cancelled') {
		return h.response(respBad(`Transaction in processing and cannot cancel`, null, 404)).code(404);
	}

	// transaction must be processing before completed
	if(_transaction.status == 'pending' && status == 'completed') {
		return h.response(respBad(`Transaction pending and must be processing to get awb`, null, 404)).code(404);
	}
 
	await client.query("BEGIN")
	try {

		if(status == "cancelled") {

			const product = await getProductBy('sku', _transaction.sku);
			const oldStock = await getItemStock(product.rows[0].id)

			await client.query('INSERT INTO stock (product_id, qty_in, final_stock, description) VALUES ($1, $2, $3, $4) RETURNING product_id', [
				product.rows[0].id, _transaction.qty, oldStock +  _transaction.qty, "order cancelled"
			])

		}

		if(status == "processing") {
			const awb = randomString(8)
			await client.query("UPDATE transactions SET awb = $1 WHERE trn_id = $2 RETURNING awb" ,[
				awb.toUpperCase(), trn_id
			]);
		}

		const updated = await client.query("UPDATE transactions SET status = $1 WHERE trn_id = $2 RETURNING *" ,[
			status, trn_id
		])
		
		await client.query("COMMIT")
		
		return h.response(respOk("Update status transaction success", updated.rows[0]))
	} catch (error) {
		await client.query("ROLLBACK")
		return h.response(respBad("Error update transaction status", error.message)).code(400);
	}

}

const updateTransactionAWB = async (request, h) => {

	const { trn_id } = request.params
	const { awb } = request.payload

	const transaction = await getDetailTransaction(trn_id);
	if (transaction.rowCount == 0) {
		return h.response(respBad("Transaction Not Found", null, 404)).code(404);
	}

	const _transaction = transaction.rows[0]

	// only transaction processing able to change awb
	if( _transaction.status != 'processing' ) {
		return h.response(respBad("Cannot change transaction airwaybill. Only transaction that being processing can change the airwaybill", null, 404)).code(404);
	}

	// check if new AWB is already used
	const awbExists = await client.query(`
		SELECT count(*) as aggregate FROM transactions where awb = $1 and trn_id <> $2
	`, [awb.toUpperCase(), trn_id])

	if(awbExists.rows[0].aggregate != '0') {
		return h.response(respBad("Airwaybill already used", null)).code(400);
	}

	try {
		const updateAWB = await client.query("UPDATE transactions SET awb = $1 WHERE trn_id = $2 RETURNING *", [
			awb.toUpperCase(), trn_id
		])
		
		return h.response(respOk("Update airwaybill transaction success", updateAWB.rows[0]))
	} catch (error) {
		return h.response(respBad("Error update transaction airwaybill", error.message)).code(400);
	}

}

const getDetailTransaction = async (trn_id) => {
	return client.query('SELECT * FROM transactions WHERE trn_id = $1', [trn_id])
}

module.exports = {
	getTransactions,
	getTransaction,
	insertTransaction,
	deleteTransaction,
	updateTransactionStatus,
	updateTransactionAWB
}