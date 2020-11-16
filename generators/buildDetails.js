/* eslint-disable quotes */
/* eslint-disable quote-props */
/* eslint-disable dot-notation */
const csvParse = require('csv-parse/lib/sync');
const Path = require('path');

const helpers = require('../helpers/helpers');
const pathHelper = require('../helpers/paths');

const { cloudCannonMeta, markdownMeta } = require('../helpers/metadata');

module.exports = {

	getMarkdownMetadata: function (config) {
		if (config.markup) {
			return config.markup;
		}
		return markdownMeta;
	},

	getGeneratorDetails: function (config) {
		const hugoVersion = helpers.runProcess('hugo', ['version']);
		const versionNumber = hugoVersion.match(/[0-9]+\.[0-9]+\.[0-9]+/g);

		const markdownDetails = this.getMarkdownMetadata(config);

		const generator = {
			"name": "hugo",
			"version": versionNumber ? versionNumber[0] : "0.0.0",
			"metadata": markdownDetails
		};

		return generator;
	},

	getCollectionName: function (path) {
		const fileName = Path.basename(path);
		let dir = Path.dirname(path);
		if (fileName.search(/^(_?)index/g) >= 0) {
			dir = Path.dirname(dir);
		}
		const nameFilter = /.*\//g; // the unimportant part
		const extraPart = dir.match(nameFilter);

		return extraPart ? dir.replace(extraPart[0], '') : '';
	},

	getPageUrl: function (path, hugoUrls, contentDir) {
		if (hugoUrls[path]) {
			return hugoUrls[path].replace('//', '/');
		}
		if (path.indexOf('index') >= 0) {
			return path
				.replace(`${contentDir || ''}/`, '/')
				.replace(/\/_?index\.md/, '/')
				.replace('//', '/');
		}
		return '';
	},

	getHugoUrls: function (baseurl) {
		const fileCsv = helpers.runProcess('hugo', ['list', 'all']);
		const fileList = csvParse(fileCsv, {
			columns: true,
			skipEmptyLines: true
		});

		const urlsPerPath = {};
		fileList.forEach((file) => {
			const { path, permalink } = file;
			const url = `/${permalink.replace(baseurl, '')}`;

			urlsPerPath[path] = url;
		});

		return urlsPerPath;
	},

	getDataFiles: async function (dataPath) {
		const data = [];
		const dataFiles = await pathHelper.getDataPaths(dataPath);
		dataFiles.forEach(async (path) => {
			const collectionItem = {
				"url": '',
				"path": path.replace(`${dataPath}/`, ''),
				collection: 'data',
				output: false
			};
			const itemDetails = await helpers.getItemDetails(path);
			Object.assign(collectionItem, itemDetails);

			data.push(collectionItem);
		});
		return data;
	},

	getCollections: async function (config, urlsPerPath) {
		const collections = {};
		const paths = helpers.getPaths(config);
		const collectionPaths = await pathHelper.getCollectionPaths(paths);

		collectionPaths.forEach(async (path) => {
			const collectionName = this.getCollectionName(path);
			if (collectionName) {
				const url = this.getPageUrl(path, urlsPerPath, paths.content);
				const collectionItem = {
					"url": url || '',
					"path": path.replace(`${paths.content}/`, ''),
					collection: collectionName
				};
				const itemDetails = await helpers.getItemDetails(path);
				Object.assign(collectionItem, itemDetails);

				if (collectionItem.draft) {
					delete collectionItem.draft;
					collectionItem.published = false;
				}

				if (collectionItem.headless || (!url && path.indexOf('index') < 0)) {
					delete collectionItem.headless;
					collectionItem.output = false;
				}

				if (collections[collectionName]) {
					collections[collectionName].push(collectionItem);
				} else {
					collections[collectionName] = [collectionItem];
				}
			}
		});

		collections.data = await this.getDataFiles(paths.data);

		return collections;
	},

	getPages: async function (config, urlsPerPath) {
		const paths = helpers.getPaths(config);
		const pagePaths = await pathHelper.getPagePaths(paths);

		const pages = Promise.all(pagePaths.map(async (path) => {
			const itemDetails = await helpers.getItemDetails(path);
			const url = this.getPageUrl(path, urlsPerPath, paths.content);
			const item = {
				name: Path.basename(path),
				path: path.replace(`${paths.content}/`, ''),
				url: url || '',
				title: Path.basename(path)
			};
			Object.assign(item, itemDetails);
			if (item.draft) {
				delete item.draft;
				item.published = false;
			}

			if (item.headless) {
				delete item.headless;
				item.output = false;
			}
			return item;
		}));

		return pages;
	},

	generateDetails: async function (hugoConfig) {
		const urlsPerPath = this.getHugoUrls(hugoConfig.baseURL);
		const collections = await this.getCollections(hugoConfig, urlsPerPath);
		const pages = await this.getPages(hugoConfig, urlsPerPath);
		const generator = this.getGeneratorDetails(hugoConfig);
		const baseURL = new URL(hugoConfig['baseURL'] || '');

		return {
			"time": "",
			"cloudcannon": cloudCannonMeta,
			"generator": generator,
			"collections": collections,
			"pages": pages,
			"baseurl": baseURL || ''
		};
	}
};
