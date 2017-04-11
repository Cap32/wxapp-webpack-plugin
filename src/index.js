
import { remove, ensureDir, readJson } from 'fs-promise';
import { resolve, dirname, relative, join, parse as parsePath } from 'path';
import webpack, { DllPlugin, DllReferencePlugin } from 'webpack';
import { ConcatSource } from 'webpack-sources';
import globby from 'globby';
import { defaults, dropWhile, pull, once } from 'lodash';
import MultiEntryPlugin from 'webpack/lib/MultiEntryPlugin';
import readPkgUp from 'read-pkg-up';

export default class WXAppPlugin {
	constructor(options = {}) {
		this.options = defaults(options || {}, {
			forceNodeTarget: true,
			includes: ['**/*'],
			excludes: [],
			dot: false, // Include `.dot` files
			base: undefined,
			bundleFileName: 'bundle.js',
			bundleModuleName: '__webpack_wxapp_bundle__',
			assetsChunkName: '__assets_chunk_name__',
		});
	}

	apply(compiler) {
		const { forceNodeTarget } = this.options;
		const { options } = compiler;

		if (forceNodeTarget && options.target !== 'node') {
			options.target = 'node';
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
			const { dir, name } = parsePath(page);
			const filename = join(dir, name);
			const filenameWithExt = `${filename}.js`;
			this.ignoredModules.push(filenameWithExt);
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

	async applyDll(compiler) {
		const {
			modules,
			options: { bundleModuleName, bundleFileName },
		} = this;
		const { options } = compiler;
		const { output, plugins } = options;
		const outputPath = output.path;
		const manifestFilepath = resolve(outputPath, 'manifest.json');

		await ensureDir(outputPath);

		const dllCompiler = webpack({
			...options,
			entry: {
				modules,
			},
			output: {
				...output,
				filename: bundleFileName,
				libraryTarget: 'global',
				library: bundleModuleName,
			},
			plugins: [
				...dropWhile(plugins, (plugin) => plugin instanceof WXAppPlugin),
				new DllPlugin({
					name: bundleModuleName,
					path: manifestFilepath,
				}),
			],
			watch: false,
		});

		await new Promise((resolve, reject) => {
			dllCompiler.run((err) => {
				if (err) { reject(err); }
				else { resolve(); }
			});
		});

		compiler.apply(new DllReferencePlugin({
			manifest: manifestFilepath,
			sourceType: 'global',
		}));

		// to avoid trigger `watch-run` again
		compiler.plugin('before-compile', (params, callback) => {
			pull(params.compilationDependencies, manifestFilepath);
			return callback();
		});

	}

	compileJS = once(async (compiler) => {
		const { base, options: { dot } } = this;
		const jsFiles = await globby(['**/*.js'], {
			cwd: base,
			nodir: true,
			dot,
		});
		const pages = await this.getPages();

		const { pkg } = await readPkgUp();
		const dependencieModules = Object.keys(pkg.dependencies || {});

		this.modules.push(...jsFiles, ...dependencieModules);

		this.modules = dropWhile(
			this.modules,
			(file) => this.ignoredModules.indexOf(file) > -1,
		);

		await this.applyDll(compiler);

		pages.forEach(({ absolutePath, filename }) => {
			this.addEntries(compiler, [absolutePath], filename);
		});
	});

	toInjectDllModule = (compilation) => {
		const { bundleFileName } = this.options;

		const injectDllModule = (filePath) => {
			const relativePath = relative(dirname(filePath), './');
			const dllModulePath = join(relativePath, bundleFileName);
			return `require("./${dllModulePath}");`;
		};

		compilation.plugin('optimize-chunk-assets', (chunks, callback) => {
			chunks.forEach((chunk) => {
				if (!chunk.isInitial()) { return; }

				chunk
					.files
					.filter((file) => !compilation.assets[file].hasInjectedDllModule)
					.forEach((file) => {
						const asset = new ConcatSource(
							injectDllModule(file),
							compilation.assets[file],
						);
						compilation.assets[file] = asset;

						// add a flag
						asset.hasInjectedDllModule = true;
					})
				;
			});

			callback();
		});
	};

	async run(compiler) {
		this.modules = [];
		this.ignoredModules = ['app.js'];

		this.base = this.getBase(compiler);

		// await this.clear(compiler);

		compiler.plugin('compilation', ::this.toInjectDllModule);

		await this.compileAssets(compiler);
		await this.compileJS(compiler);

		// compiler.plugin('compilation', (compilation) => {
		// 	compilation.plugin('after-optimize-chunk-assets', (chunks) => {
		// 		chunks.forEach((chunk) => {
		// 			chunk.modules.forEach((module) => {
		// 				console.log('module', module);
		// 				// console.log('module', Object.keys(module));
		// 			});
		// 		});
		// 	});
		// });
	}
}
