
import { remove, readJson } from 'fs-promise';
import { resolve, dirname, relative, join, parse } from 'path';
import { optimize } from 'webpack';
import { ConcatSource } from 'webpack-sources';
import globby from 'globby';
import { defaults } from 'lodash';
import MultiEntryPlugin from 'webpack/lib/MultiEntryPlugin';

const { CommonsChunkPlugin } = optimize;

const stripExt = (path) => {
	const { dir, name } = parse(path);
	return join(dir, name);
};

export default class WXAppPlugin {
	constructor(options = {}) {
		this.options = defaults(options || {}, {
			clear: true,
			include: [],
			exclude: [],
			dot: false, // Include `.dot` files
			scriptExt: '.js',
			commonModuleName: 'common.js',
			forceWebTarget: true,
			assetsChunkName: '__assets_chunk_name__',
			// base: undefined,
		});
		this.options.include = [].concat(this.options.include);
		this.options.exclude = [].concat(this.options.exclude);
	}

	apply(compiler) {
		const { forceWebTarget, clear } = this.options;
		const { options } = compiler;
		let isFirst = true;

		if (forceWebTarget && options.target !== 'web') {
			options.target = 'web';
		}

		compiler.plugin('run', this.try(async (compiler) => {
			await this.run(compiler);
		}));

		compiler.plugin('watch-run', this.try(async (compiler) => {
			await this.run(compiler.compiler);
		}));

		compiler.plugin('emit', this.try(async (compilation) => {
			if (clear && isFirst) {
				isFirst = false;
				await this.clear(compilation);
			}
		}));
	}

	try = (handler) => async (arg, callback) => {
		try {
			await handler(arg);
			callback();
		}
		catch (err) {
			callback(err);
		}
	};

	getBase(compiler) {
		const { base } = this.options;
		if (base) { return resolve(base); }

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

				for (const key in entry) {
					if (!entry.hasOwnProperty(key)) { continue; }

					const val = entry[key];
					if (typeof val === 'string') {
						return val;
					}
					if (Array.isArray(val)) {
						return findAppJS(val);
					}
				}
			}
		};

		const entryFromCompiler = getEntryFromCompiler();

		if (entryFromCompiler) {
			return dirname(entryFromCompiler);
		}

		return context;
	}

	async getEntryResource() {
		const appJSONFile = resolve(this.base, 'app.json');
		const { pages = [] } = await readJson(appJSONFile);
		return ['app'].concat(pages);
	}

	getFullScriptPath(path) {
		const { base, options: { scriptExt } } = this;
		return resolve(base, path + scriptExt);
	}

	async clear(compilation) {
		const { path } = compilation.options.output;
		await remove(path);
	}

	addEntries(compiler, entries, chunkName) {
		compiler.apply(new MultiEntryPlugin(this.base, entries, chunkName));
	}

	async compileAssets(compiler) {
		const {
			options: {
				include,
				exclude,
				dot,
				assetsChunkName,
				scriptExt,
			},
			entryResources,
		} = this;

		compiler.plugin('compilation', (compilation) => {
			compilation.plugin('before-chunk-assets', () => {
				const assetsChunkIndex = compilation.chunks.findIndex(({ name }) =>
					name === assetsChunkName
				);
				if (assetsChunkIndex > -1) {
					compilation.chunks.splice(assetsChunkIndex, 1);
				}
			});
		});

		const patterns = entryResources
			.map((resource) => `${resource}.*`)
			.concat(include)
		;

		const entries = await globby(patterns, {
			cwd: this.base,
			nodir: true,
			realpath: true,
			ignore: [`**/*${scriptExt}`, ...exclude],
			dot,
		});

		this.addEntries(compiler, entries, assetsChunkName);
	}

	applyCommonsChunk(compiler) {
		const {
			options: { commonModuleName },
			entryResources,
		} = this;

		const scripts = entryResources.map(::this.getFullScriptPath);

		compiler.apply(new CommonsChunkPlugin({
			name: stripExt(commonModuleName),
			minChunks: ({ resource }) => {
				if (resource) {
					return /\.js$/.test(resource) && !scripts.includes(resource);
				}
				return false;
			},
		}));
	}

	compileScripts(compiler) {
		this.applyCommonsChunk(compiler);

		this.entryResources
			.filter((resource) => resource !== 'app')
			.forEach((resource) => {
				const fullPath = this.getFullScriptPath(resource);
				this.addEntries(compiler, [fullPath], resource);
			})
		;
	}

	toModifyTemplate(compilation) {
		const { commonModuleName } = this.options;
		const { jsonpFunction } = compilation.options.output;
		const commonChunkName = stripExt(commonModuleName);

		const injectModule = (filePath) => {
			const relativePath = relative(dirname(filePath), './');
			const bundle = join(relativePath, commonModuleName);
			return '' +
				`require("./${bundle}");` +
				`var ${jsonpFunction}=global.${jsonpFunction};`
			;
		};

		const injectWindow = 'var window=global;';

		compilation.plugin('optimize-chunk-assets', (chunks, callback) => {
			chunks.forEach((chunk) => {
				if (!chunk.isInitial()) { return; }

				chunk
					.files
					.filter((file) => !compilation.assets[file].hasInjectedModule)
					.forEach((file) => {
						const isCommonFile = chunk.name === commonChunkName;
						const inject = isCommonFile ? injectWindow : injectModule(file);
						const asset = new ConcatSource(
							inject,
							compilation.assets[file],
						);
						compilation.assets[file] = asset;

						// add a flag
						asset.hasInjectedModule = true;
					})
				;
			});

			callback();
		});
	}

	async run(compiler) {
		this.base = this.getBase(compiler);
		this.entryResources = await this.getEntryResource();

		compiler.plugin('compilation', ::this.toModifyTemplate);

		await this.compileAssets(compiler);
		this.compileScripts(compiler);
	}
}
