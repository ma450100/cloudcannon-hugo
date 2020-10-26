/* eslint-disable quotes */
/* eslint-disable quote-props */
/* eslint-disable dot-notation */
const csvParse = require('csv-parse/lib/sync');
const Path = require('path');
const { runProcess } = require('../helpers/helpers');

const { cloudCannonMeta, markdownMeta } = require('../helpers/metadata');

async function getMarkdownMetadata(config) {
	if (config.markup) {
		return config.markup;
	}
	return markdownMeta;
}

async function getGeneratorDetails(config) {
	const hugoVersion = await runProcess('hugo', ['version']);
	const versionNumber = hugoVersion.match(/[0-9]+\.[0-9]+\.[0-9]+/g);

	const markdownDetails = await getMarkdownMetadata(config);

	const generator = {
		"name": "hugo",
		"version": versionNumber ? versionNumber[0] : "0.0.0",
		"metadata": markdownDetails
	};

	return Promise.resolve(generator);
}

function getCollectionName(path) {
	const fileName = Path.basename(path);
	let dir = Path.dirname(path);
	if (fileName.search(/^(_?)index/g) >= 0) {
		dir = Path.dirname(dir);
	}
	const nameFilter = /.*\//g; // the unimportant part
	const extraPart = dir.match(nameFilter);

	return extraPart ? dir.replace(extraPart[0], '') : '';
}

async function getCollections(baseurl) {
	const fileCsv = await runProcess('hugo', ['list', 'all']);
	const fileList = csvParse(fileCsv, {
		columns: true,
		skipEmptyLines: true
	});

	const collections = {};
	fileList.forEach((file) => {
		const { path } = file;
		let { permalink: url } = file;
		url = `/${url.replace(baseurl, "")}`;
		const collectionName = getCollectionName(path);
		if (collectionName) {
			if (collections[collectionName]) {
				collections[collectionName].push({ "path": path, "url": url });
			} else {
				collections[collectionName] = [{ "path": path, "url": url }];
			}
		}
	});
	return Promise.resolve(collections);
}

async function getPages() {
	// get index.html and 404.html
	// Then need to get all leaf pages.
	return ['layouts/index.html'];
}

module.exports = {
	generateDetails: async function (hugoConfig) {
		const baseurl = hugoConfig["baseURL"] || "";
		const collections = await getCollections(baseurl);
		const generator = await getGeneratorDetails(hugoConfig);
		const pages = await getPages();

		return {
			"time": "",
			"cloudcannon": cloudCannonMeta,
			"generator": generator,
			"collections": collections,
			"pages": pages,
			"baseurl": hugoConfig["baseURL"] || ""
		};
	}
};