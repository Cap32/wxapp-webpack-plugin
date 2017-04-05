
import { readFileSync, writeFileSync, ensureDirSync } from 'fs-extra';
import { basename, resolve, dirname } from 'path';
import VirtualModuleWebpackPlugin from 'virtual-module-webpack-plugin';
import CopyWebpackPlugin from 'copy-webpack-plugin';
import { ProvidePlugin, DefinePlugin } from 'webpack';

export default class WXAppPlugin {
	constructor(options) {
		this.options = options || {};
		this._filesToWrite = [];
	}

	apply(compiler) {
		compiler.plugin('run', (compiler, callback) => {
			this.applyPlugins(compiler);
			callback();
		});

		compiler.plugin('watch-run', (compiler, callback) => {
			this.applyPlugins(compiler.compiler);
			callback();
		});

		compiler.plugin('after-emit', (compilation, callback) => {
			this._filesToWrite.forEach(({ path, content }) => {
				try {
					ensureDirSync(dirname(path));
					writeFileSync(path, content, 'utf8');
				}
				catch (err) {
					console.error(err);
				}
			});
			callback(null, compilation);
		});
	}

	addFileToWrite(path, content) {
		this._filesToWrite.push({ path, content });
	}

	getEntryBase(compiler) {
		const { options } = this;
		if (options.base) { return resolve(options.base); }

		const { options: compilerOptions } = compiler;
		const { context, entry } = compilerOptions;

		const getEntryFromCompiler = () => {
			if (typeof entry === 'string') {
				return entry;
			}

			const appJSRegExp = /\bapp(\.js)?$/;
			const findAppJS = (arr) => arr.find((path) => appJSRegExp.test(path));

			if (Array.isArray(entry)) {
				return findAppJS(entry);
			}
			if (typeof entry === 'object') {
				return Object.keys(entry).find((key, val) => {
					if (typeof val === 'string') {
						return val;
					}
					if (Array.isArray(val)) {
						return findAppJS(val);
					}
				});
			}
		};

		const entryFromCompiler = getEntryFromCompiler();

		if (entryFromCompiler) {
			return dirname(entryFromCompiler);
		}

		return context;
	}

	applyPlugins(compiler) {
		const { options } = this;
		const globalInjectName = options.globalInjectName || '__wxapp_webpack__';

		const { output } = compiler.options;
		const base = this.getEntryBase(compiler);

		const providedModule = resolve(base, '__wx_pages__.js');

		const appJSONFile = resolve(base, 'app.json');
		const appJSONStr = readFileSync(appJSONFile, 'utf8');
		const { pages } = JSON.parse(appJSONStr);

		const resolveOutputFile = (file) => {
			if (!/\.js$/.test(file)) { file += '.js'; }
			return resolve(output.path, file);
		};

		const pagesCode = pages.map((pagePathname) => {
			const page = basename(pagePathname, '.js');
			const outputPageFile = resolveOutputFile(pagePathname);
			const pageContent = `global.${globalInjectName}.${page}();`;
			this.addFileToWrite(outputPageFile, pageContent);
			return `"${page}": function () { require("./${pagePathname}"); }`;
		}).join(',');

		const outputAppFile = resolveOutputFile('app.js');
		const appContent = `require("./${output.filename}");`;
		this.addFileToWrite(outputAppFile, appContent);

		const virtualModule = new VirtualModuleWebpackPlugin({
			moduleName: providedModule,
			contents:
				`global.${globalInjectName} = {\n\t${pagesCode}\n};` +
				'module.exports = __WX_APP_FUNCTION__'
			,
		});

		const copy = new CopyWebpackPlugin(
			[{ from: base }],
			{ ignore: ['**/*.js', '.*'] },
		);

		const provide = new ProvidePlugin({
			App: providedModule,
		});

		const define = new DefinePlugin({
			__WX_APP_FUNCTION__: 'App',
		});

		compiler.apply(copy);
		compiler.apply(virtualModule);
		compiler.apply(provide);
		compiler.apply(define);
	}
}
