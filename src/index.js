
import { remove, readJson } from 'fs-extra';
import { resolve, dirname, relative, join, parse } from 'path';
import { optimize, LoaderTargetPlugin, JsonpTemplatePlugin } from 'webpack';
import { ConcatSource } from 'webpack-sources';
import globby from 'globby';
import { defaults, values } from 'lodash';
import MultiEntryPlugin from 'webpack/lib/MultiEntryPlugin';
import SingleEntryPlugin from 'webpack/lib/SingleEntryPlugin';
import FunctionModulePlugin from 'webpack/lib/FunctionModulePlugin';
import NodeSourcePlugin from 'webpack/lib/node/NodeSourcePlugin';

const { CommonsChunkPlugin } = optimize;

const stripExt = (path) => {
	const { dir, name } = parse(path);
	return join(dir, name);
};

const miniProgramTarget = (compiler) => {
	const { options } = compiler;
	compiler.apply(
		new JsonpTemplatePlugin(options.output),
		new FunctionModulePlugin(options.output),
		new NodeSourcePlugin(options.node),
		new LoaderTargetPlugin('web'),
	);
};

export const Targets = {
	Wechat(compiler) { return miniProgramTarget(compiler); },
	Alipay(compiler) { return miniProgramTarget(compiler); },
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
			forceTarget: true,
			assetsChunkName: '__assets_chunk_name__',
			// base: undefined,
		});
		this.options.include = [].concat(this.options.include);
		this.options.exclude = [].concat(this.options.exclude);
	}

	apply(compiler) {
		const { clear } = this.options;
		let isFirst = true;

		this.forceTarget(compiler);

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

	forceTarget(compiler) {
		const { forceTarget } = this.options;
		const { options } = compiler;

		if (forceTarget) {
			const { target } = options;
			if (target !== Targets.Wechat && target !== Targets.Alipay) {
				options.target = Targets.Wechat;
			}
			if (!options.node || options.node.global) {
				options.node = options.node || {};
				options.node.global = false;
			}
		}
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

	async getEntryResource() {
		const appJSONFile = resolve(this.base, 'app.json');
		const { pages = [] } = await readJson(appJSONFile);
		const components = new Set();
		for (const page of pages) {
			await this.getComponents(components, resolve(this.base, page));
		}
		return ['app', ...pages, ...components];
	}

	async getComponents(components, instance) {
		const { usingComponents = {} } =
			await readJson(`${instance}.json`).catch(::console.error);
		const componentBase = parse(instance).dir;
		for (const relativeComponent of values(usingComponents)) {
			const component = resolve(componentBase, relativeComponent);
			if (!components.has(component)) {
				components.add(relative(this.base, component));
				await this.getComponents(components, component);
			}
		}
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
					return /\.js$/.test(resource) && scripts.indexOf(resource) < 0;
				}
				return false;
			},
		}));
	}

	addScriptEntry(compiler, entry, name) {
		compiler.plugin('make', (compilation, callback) => {
			const dep = SingleEntryPlugin.createDependency(entry, name);
			compilation.addEntry(this.base, dep, name, callback);
		});
	}

	compileScripts(compiler) {
		this.applyCommonsChunk(compiler);
		this.entryResources
			.filter((resource) => resource !== 'app')
			.forEach((resource) => {
				const fullPath = this.getFullScriptPath(resource);
				this.addScriptEntry(compiler, fullPath, resource);
			})
		;
	}

	toModifyTemplate(compilation) {
		const { commonModuleName } = this.options;
		const { target } = compilation.options;
		const commonChunkName = stripExt(commonModuleName);
		const globalVar = target.name === 'Alipay' ? 'my' : 'wx';

		// inject chunk entries
		compilation.chunkTemplate.plugin('render', (core, { name }) => {
			if (this.entryResources.indexOf(name) >= 0) {
				const relativePath = relative(dirname(name), `./${commonModuleName}`);
				const posixPath = relativePath.replace(/\\/g, '/');
				const source = core.source();

				// eslint-disable-next-line max-len
				const injectContent = `; function webpackJsonp() { require("./${posixPath}"); ${globalVar}.webpackJsonp.apply(null, arguments); }`;

				if (source.indexOf(injectContent) < 0) {
					const concatSource = new ConcatSource(core);
					concatSource.add(injectContent);
					return concatSource;
				}
			}
			return core;
		});

		// replace `window` to `global` in common chunk
		compilation.mainTemplate.plugin('bootstrap', (source, chunk) => {
			const windowRegExp = new RegExp('window', 'g');
			if (chunk.name === commonChunkName) {
				return source.replace(windowRegExp, globalVar);
			}
			return source;
		});

		// override `require.ensure()`
		compilation.mainTemplate.plugin('require-ensure', () =>
			'throw new Error("Not chunk loading available");'
		);
	}

	async run(compiler) {
		this.base = this.getBase(compiler);
		this.entryResources = await this.getEntryResource();

		compiler.plugin('compilation', ::this.toModifyTemplate);

		this.compileScripts(compiler);
		await this.compileAssets(compiler);
	}
}
