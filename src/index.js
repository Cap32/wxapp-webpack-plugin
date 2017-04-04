
import { isString, isObject, isArray, find } from 'lodash';
import { basename } from 'path';
import { ConcatSource } from 'webpack-sources';

const isAppJs = (filename) => basename(filename) === 'app.js';

const parseEntry = (options) => {
	// let appJS;
	// let replace;
	// const entry = options.entry;
	// if (isString(entry)) {
	// 	if (isAppJs(entry)) {
	// 		appJS = entry;
	// 		replace = (modulePath) => options.entry = modulePath;
	// 	}
	// }
	// else if (isObject(entry)) {
	// 	appJS = find(entry, (filename) => {
	// 		if (isArray(filename)) {
	// 			filename = filename[filename.length - 1];
	// 		}
	// 		return isAppJs(filename);
	// 	});

	// }

	options.entry.index.push(
		'./src/pages/index/index.js',
		'./src/pages/logs/logs.js',
	);
};

export default class WXAppPlugin {
	constructor(options) {
		this.options = options;
	}

	apply(compiler) {
		parseEntry(compiler.options);

		// console.log(compiler.options);

		// compiler.plugin('run', (compiler) => {
		// 	console.log(compiler);
		// });

		// compiler.plugin('before-compile', (compilationParams) => {
		// 	console.log(compilationParams);
		// });

		compiler.plugin('compilation', (compilation) => {
			// console.log('compilation', compilation);

			compilation.plugin('normal-module-loader', (loaderContext, module) => {
				// if (/logs\.js$/.test(module.resource)) {
				// 	console.log('module', module._source._value);
				// }
			});

			// compilation.plugin('optimize-tree', (chunks, modules) => {
			// 	modules.forEach((module) => {
			// 		if (/logs\.js$/.test(module.resource)) {
			// 			console.log('module', module._source._value);
			// 		}
			// 	});
			// });

			compilation.plugin('optimize-modules', (modules) => {
				modules.forEach((module) => {
					if (/pages\/(logs\/logs|index\/index)\.js$/.test(module.resource)) {
						// const { _source } = module;
						// const { _value } = _source;
						// _source._value = `             module.exports = function () {\n${_value}\n};`;
						// console.log('module', module._source._value);
						console.log('module', module);
						// console.log('module', module);
					}
				});
			});

			compilation.plugin("optimize-chunk-assets", (chunks, callback) => {
				chunks.forEach((chunk) => {

					// console.log('chunk', chunk.entryModule.dependencies);

					if (!chunk.isInitial()) { return; }

					// chunk.entryModule.dependencies.forEach((module) => {
					// 	module.chunks
					// })

					// console.log('compilation.assets[file]', compilation.assets[chunk.files[0]]);

					// chunk.files
					// 	.filter((file) => console.log(file))
						// .forEach((file) =>
						// 	compilation.assets[file] = new ConcatSource(
						// 		'module.exports = function () {',
						// 		'\n',
						// 		compilation.assets[file],
						// 		'\n',
						// 		'};',
						// 	)
						// )
					;
				});
				callback();
			});

		});
	}
}
