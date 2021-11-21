const client = require("../config/db");

exports.randomString = (length) => {
	let result  = '';
	const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	const charactersLength = characters.length;
	for ( var i = 0; i < length; i++ ) {
		result += characters.charAt(Math.floor(Math.random() * charactersLength));
	}
	return result.toLocaleLowerCase();
}

exports.getProductBy = async (column, value) => {
	return await client.query(`SELECT * FROM product WHERE ${column} = $1`, [
		value,
	]);
};

exports.getItemStock = async (id) => {
	const stock = await client.query(`
		SELECT COALESCE(final_stock, 0 ) as final_stock FROM stock WHERE product_id = $1 ORDER BY created_at DESC LIMIT 1
	`, [id])
	return parseInt(stock.rows[0].final_stock);
}