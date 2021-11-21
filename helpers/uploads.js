const fs = require("fs");
const { randomString } = require("./utils");

//trigger upload process
const uploader = function (file, options) {
	if (!file) throw new Error("no file(s)");
	return fileHandler(file, options);
};

const fileHandler = function (file, options) {
	if (!file) throw new Error("no file");

	const originalname = file.hapi.filename;
	const filename = randomString(10) + "_" + Date.now() + "." + originalname.split(".")[1];
	const path = `${options.dest}${filename}`;
	const fileStream = fs.createWriteStream(path);

	return new Promise((resolve, reject) => {
		file.on("error", function (err) {
			reject(err);
		});

		file.pipe(fileStream);
		file.on("end", function (err) {
			const fileDetails = {
				fieldname: file.hapi.name,
				originalname,
				filename,
				mimetype: file.hapi.headers["content-type"],
				destination: `${options.dest}`,
				path,
			};

			if (err) {
				console.log(err);
				reject(err);
			}

			resolve(fileDetails);
		});
	});
};

module.exports = uploader;
