require("dotenv").config();

const respOk = (message, data, code = 200) => {
	return {
		code,
		message,
		data,
	};
};
const respBad = (message, error_message, code = 400) => {
	if (process.env.NODE_ENV == "production") {
		error_message = "🍰 🍰  🍰";
	}
	return {
		code,
		message,
		error_message: error_message == null ? "" : error_message,
	};
};

module.exports = { respOk, respBad };
