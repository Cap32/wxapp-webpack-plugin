
import { isString, isObject, isArray, find } from 'lodash';
import { basename } from 'path';
import { ConcatSource } from 'webpack-sources';
import VirtualModuleWebpackPlugin from 'virtual-module-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { ProvidePlugin, DefinePlugin } from 'webpack';
import SingleEntryDependency from 'webpack/lib/dependencies/SingleEntryDependency';

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
		// './src/pages/index/index.js',
		// './src/pages/logs/logs.js',

		// './src/pages'
	);
};

// console.log('typeof dependencies', typeof SingleEntryDependency);

export default class WXAppPlugin {
	constructor(options) {
		this.options = options;
	}

	apply(compiler) {
		// compiler.plugin('before-compile', (compilationParams) => {
		// 	console.log(compilationParams);
		// });

		const copy = new CopyWebpackPlugin(
			[{ from: 'src' }],
			{ ignore: ['**/*.js'] },
		);


		const virtualModule = new VirtualModuleWebpackPlugin({
			moduleName: 'src/pages',
			contents: '' +
				'global.__wxapp_webpack__ = {' +
					'index: () => require("./pages/index/index"),' +
					'logs: () => require("./pages/logs/logs"),' +
				'};' +
				'module.exports = __WX_APP_FUNCTION__',
		});

		const provide = new ProvidePlugin({
			App: '/Users/webber/www/node/wxapp-webpack-plugin/test/src/pages',
		});

		const define = new DefinePlugin({
			__WX_APP_FUNCTION__: 'App',
		});

		compiler.apply(copy);
		compiler.apply(virtualModule);
		compiler.apply(provide);
		compiler.apply(define);

		// compiler.plugin('normal-module-factory', (nmf) => {
		// 	nmf.plugin('after-resolve', (data, callback) => {
		// 		if (data.resource === '/Users/webber/www/node/wxapp-webpack-plugin/test/src/app.js' && data.dependencies[0] instanceof SingleEntryDependency) {
		// 			data.resource = '/Users/webber/www/node/wxapp-webpack-plugin/test/src/pages';
		// 		}
		// 		callback(null, data);
		// 	});
		// });

		// compiler.plugin('compilation', (compilation, params) => {
		// 	params.normalModuleFactory.plugin('parser', (parser) => {
		// 		parser.plugin('call App', (expr) => {
		// 			console.log('call App()', expr);
		// 			return false;
		// 		});
		// 	});
		// });

		// compiler.plugin('compilation', (compilation) => {
		// 	// console.log('compilation', compilation);

		// 	compilation.plugin('normal-module-loader', (loaderContext, module) => {
		// 		// if (/logs\.js$/.test(module.resource)) {
		// 		// 	console.log('module', module._source._value);
		// 		// }
		// 	});

		// 	// compilation.plugin('optimize-tree', (chunks, modules) => {
		// 	// 	modules.forEach((module) => {
		// 	// 		if (/logs\.js$/.test(module.resource)) {
		// 	// 			console.log('module', module._source._value);
		// 	// 		}
		// 	// 	});
		// 	// });

		// 	compilation.plugin('optimize-modules', (modules) => {
		// 		modules.forEach((module) => {
		// 			if (/pages\/(logs\/logs|index\/index)\.js$/.test(module.resource)) {
		// 				// const { _source } = module;
		// 				// const { _value } = _source;
		// 				// _source._value = `             module.exports = function () {\n${_value}\n};`;
		// 				// console.log('module', module._source._value);
		// 				// console.log('module', module);
		// 				// console.log('module', module);
		// 			}
		// 		});
		// 	});

		// 	compilation.plugin("optimize-chunk-assets", (chunks, callback) => {
		// 		chunks.forEach((chunk) => {

		// 			// console.log('chunk', chunk.entryModule.dependencies);

		// 			if (!chunk.isInitial()) { return; }

		// 			// chunk.entryModule.dependencies.forEach((module) => {
		// 			// 	module.chunks
		// 			// })

		// 			// console.log('compilation.assets[file]', compilation.assets[chunk.files[0]]);

		// 			// chunk.files
		// 			// 	.filter((file) => console.log(file) || true)
		// 			// 	.forEach((file) =>
		// 			// 		compilation.assets[file] = new ConcatSource(
		// 			// 			'/*CAP32*/\n',
		// 			// 			'require("./src/pages/index/index.js");\n',
		// 			// 			'module.exports = function () {',
		// 			// 			'\n',
		// 			// 			compilation.assets[file],
		// 			// 			'\n',
		// 			// 			'};',
		// 			// 		)
		// 			// 	)
		// 			// ;
		// 		});
		// 		callback();
		// 	});

		// });
	}
}
