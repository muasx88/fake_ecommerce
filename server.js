const Hapi = require("@hapi/hapi");
const Routes = require("./routes");

const start = async () => {
	const server = Hapi.server({
		port: process.env.PORT || 5000,
		host: process.env.HOST || "localhost",
	});

	server.route({
		method: "GET",
		path: "/",
		handler: (request, h) => {
			return "Root Project";
		},
	});

	server.route(Routes);

	await server.start();
	console.log("Server running on %s", server.info.uri);
};

process.on("unhandledRejection", (err) => {
	console.log(err);
	process.exit(1);
});

start();
