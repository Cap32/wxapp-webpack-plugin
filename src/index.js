
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
			includes: ['**/*'],
			excludes: [],
			dot: false, // Include `.dot` files
			base: undefined,
			bundleFileName: 'bundle.js',
			forceWebTarget: true,
			assetsChunkName: '__assets_chunk_name__',
		});
	}

	apply(compiler) {
		const { forceWebTarget } = this.options;
		const { options } = compiler;

		if (forceWebTarget && options.target !== 'web') {
			options.target = 'web';
		}

		compiler.plugin('run', async (compiler, callback) => {
			try {
				await this.run(compiler);
				callback();
			}
			catch (err) {
				callback(err);
			}
		});

		compiler.plugin('watch-run', async (compiler, callback) => {
			try {
				await this.run(compiler.compiler);
				callback();
			}
			catch (err) {
				callback(err);
			}
		});
	}

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

	async getPages() {
		const { base } = this;
		const appJSONFile = resolve(base, 'app.json');
		const { pages = [] } = await readJson(appJSONFile);
		return pages.map((page) => {
			const { dir, name } = parse(page);
			const filename = join(dir, name);
			const filenameWithExt = `${filename}.js`;
			return {
				absolutePath: resolve(base, filenameWithExt),
				filename,
			};
		});
	}

	async clear(compiler) {
		const { path } = compiler.options.output;
		await remove(path);
	}

	addEntries(compiler, entries, chunkName) {
		compiler.apply(new MultiEntryPlugin(this.base, entries, chunkName));
	}

	compileAssets = (async (compiler) => {
		const {
			includes,
			excludes,
			dot,
			assetsChunkName,
		} = this.options;

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

		const entries = await globby(includes, {
			cwd: this.base,
			nodir: true,
			realpath: true,
			ignore: ['**/*.js', ...excludes],
			dot,
		});

		this.addEntries(compiler, entries, assetsChunkName);
	});

	applyCommonsChunk(compiler, pages) {
		const {
			options: { bundleFileName },
		} = this;

		const allPages = [resolve(this.base, 'app.js')]
			.concat(pages.map(({ absolutePath }) => absolutePath))
		;

		compiler.apply(new CommonsChunkPlugin({
			name: stripExt(bundleFileName),
			minChunks: ({ resource }) => {
				if (resource) {
					return /\.js$/.test(resource) && !allPages.includes(resource);
				}
				return false;
			},
		}));
	}

	async compileJS(compiler) {
		const pages = await this.getPages();

		this.applyCommonsChunk(compiler, pages);

		pages.forEach(({ absolutePath, filename }) => {
			this.addEntries(compiler, [absolutePath], filename);
		});
	}

	toModifyTemplate(compilation) {
		const { bundleFileName } = this.options;
		const { jsonpFunction } = compilation.options.output;

		const injectModule = (filePath) => {
			const relativePath = relative(dirname(filePath), './');
			const bundle = join(relativePath, bundleFileName);
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
						const isBundleFile = chunk.name === 'bundle';
						const inject = isBundleFile ? injectWindow : injectModule(file);
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

		// await this.clear(compiler);

		compiler.plugin('compilation', ::this.toModifyTemplate);

		await this.compileAssets(compiler);
		await this.compileJS(compiler);
	}
}
