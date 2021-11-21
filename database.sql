-- create table product
CREATE TABLE IF NOT EXISTS product(
	id serial PRIMARY KEY, 
	name VARCHAR(100) NOT NULL, 
	sku VARCHAR(50) UNIQUE NOT NULL,
	image VARCHAR(100) NOT NULL, 
	price INTEGER NOT NULL, 
	description VARCHAR(100), 
	created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- create table stock
CREATE TABLE IF NOT EXISTS stock (
	id serial PRIMARY KEY,
	product_id INT NOT NULL,
	qty_in INT NOT NULL DEFAULT 0,
	qty_out INT NOT NULL DEFAULT 0,
	final_stock INT NOT NULL DEFAULT 0,
	description VARCHAR(100),
	created_at TIMESTAMP NOT NULL DEFAULT NOW(),
	FOREIGN KEY (product_id) REFERENCES product (id) ON DELETE CASCADE
);

-- create table transactions
CREATE TABLE IF NOT EXISTS transactions (
	id SERIAL PRIMARY KEY,
	trn_id VARCHAR(50) UNIQUE NOT NULL,
	sku VARCHAR(50) NOT NULL,
	qty INT NOT NULL,
	amount INT NOT NULL,
	status VARCHAR(50) DEFAULT 'pending',
	awb VARCHAR(50),
	created_at TIMESTAMP NOT NULL DEFAULT NOW()
);