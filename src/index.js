import { remove, readJson, existsSync, stat, readFile } from 'fs-extra';
import { resolve, dirname, relative, join, parse } from 'path';
import { optimize, LoaderTargetPlugin, JsonpTemplatePlugin } from 'webpack';
import { ConcatSource } from 'webpack-sources';
import globby from 'globby';
import { defaults, values, uniq } from 'lodash';
import MultiEntryPlugin from 'webpack/lib/MultiEntryPlugin';
import SingleEntryPlugin from 'webpack/lib/SingleEntryPlugin';
import FunctionModulePlugin from 'webpack/lib/FunctionModulePlugin';
import NodeSourcePlugin from 'webpack/lib/node/NodeSourcePlugin';

const { CommonsChunkPlugin } = optimize;

const deprecated = function deprecated(obj, key, adapter, explain) {
	if (deprecated.warned.has(key)) {
		return;
	}
	const val = obj[key];
	if (typeof val === 'undefined') {
		return;
	}
	deprecated.warned.add(key);
	adapter(val);
	console.warn('[WXAppPlugin]', explain);
};
deprecated.warned = new Set();

const stripExt = path => {
	const { dir, name } = parse(path);
	return join(dir, name);
};

export const createTarget = function createTarget(name) {
	const miniProgramTarget = compiler => {
		const { options } = compiler;
		compiler.apply(
			new JsonpTemplatePlugin(options.output),
			new FunctionModulePlugin(options.output),
			new NodeSourcePlugin(options.node),
			new LoaderTargetPlugin('web')
		);
	};

	// eslint-disable-next-line no-new-func
	const creater = new Function(
		`var t = arguments[0]; return function ${name}(c) { return t(c); }`
	);
	return creater(miniProgramTarget);
};

export const Targets = {
	Wechat: createTarget('Wechat'),
	Alipay: createTarget('Alipay'),
	Baidu: createTarget('Baidu')
};

export default class WXAppPlugin {
	constructor(options = {}) {
		this.options = defaults(options || {}, {
			clear: true,
			include: [],
			exclude: [],
			dot: false, // Include `.dot` files
			extensions: ['.js'],
			commonModuleName: 'common.js',
			enforceTarget: true,
			assetsChunkName: '__assets_chunk_name__'
			// base: undefined,
		});

		deprecated(
			this.options,
			'scriptExt',
			val => this.options.extensions.unshift(val),
			'Option `scriptExt` is deprecated. Please use `extensions` instead'
		);

		deprecated(
			this.options,
			'forceTarge',
			val => (this.options.enforceTarget = val),
			'Option `forceTarge` is deprecated. Please use `enforceTarget` instead'
		);

		this.options.extensions = uniq([...this.options.extensions, '.js']);
		this.options.include = [].concat(this.options.include);
		this.options.exclude = [].concat(this.options.exclude);
	}

	apply(compiler) {
		const { clear } = this.options;
		let isFirst = true;

		this.enforceTarget(compiler);

		compiler.plugin(
			'run',
			this.try(async compiler => {
				await this.run(compiler);
			})
		);

		compiler.plugin(
			'watch-run',
			this.try(async compiler => {
				await this.run(compiler.compiler);
			})
		);

		compiler.plugin(
			'emit',
			this.try(async compilation => {
				if (clear && isFirst) {
					isFirst = false;
					await this.clear(compilation);
				}

				await this.toEmitTabBarIcons(compilation);
			})
		);

		compiler.plugin(
			'after-emit',
			this.try(async compilation => {
				await this.toAddTabBarIconsDependencies(compilation);
			})
		);
	}

	try = handler => async (arg, callback) => {
		try {
			await handler(arg);
			callback();
		} catch (err) {
			callback(err);
		}
	};

	enforceTarget(compiler) {
		const { enforceTarget } = this.options;
		const { options } = compiler;

		if (enforceTarget) {
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
		const { base, extensions } = this.options;
		if (base) {
			return resolve(base);
		}

		const { options: compilerOptions } = compiler;
		const { context, entry } = compilerOptions;

		const getEntryFromCompiler = () => {
			if (typeof entry === 'string') {
				return entry;
			}

			const extRegExpStr = extensions
				.map(ext => ext.replace(/\./, '\\.'))
				.map(ext => `(${ext})`)
				.join('|');

			const appJSRegExp = new RegExp(`\\bapp(${extRegExpStr})?$`);
			const findAppJS = arr => arr.find(path => appJSRegExp.test(path));

			if (Array.isArray(entry)) {
				return findAppJS(entry);
			}
			if (typeof entry === 'object') {
				for (const key in entry) {
					if (!entry.hasOwnProperty(key)) {
						continue;
					}

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

	async getTabBarIcons(tabBar) {
		const tabBarIcons = new Set();
		const tabBarList = tabBar.list || [];
		for (const tabBarItem of tabBarList) {
			if (tabBarItem.iconPath) {
				tabBarIcons.add(tabBarItem.iconPath);
			}
			if (tabBarItem.selectedIconPath) {
				tabBarIcons.add(tabBarItem.selectedIconPath);
			}
		}

		this.tabBarIcons = tabBarIcons;
	}

	async toEmitTabBarIcons(compilation) {
		const emitIcons = [];
		this.tabBarIcons.forEach(iconPath => {
			const iconSrc = resolve(this.base, iconPath);
			const toEmitIcon = async () => {
				const iconStat = await stat(iconSrc);
				const iconSource = await readFile(iconSrc);
				compilation.assets[iconPath] = {
					size: () => iconStat.size,
					source: () => iconSource
				};
			};
			emitIcons.push(toEmitIcon());
		});
		await Promise.all(emitIcons);
	}

	toAddTabBarIconsDependencies(compilation) {
		const { fileDependencies } = compilation;
		this.tabBarIcons.forEach(iconPath => {
			if (!~fileDependencies.indexOf(iconPath)) {
				fileDependencies.push(iconPath);
			}
		});
	}

	async getEntryResource() {
		const appJSONFile = resolve(this.base, 'app.json');
		const { pages = [], subPackages = [], tabBar = {} } = await readJson(
			appJSONFile
		);

		const components = new Set();
		await this.getComponents(components, resolve(this.base, 'app'))
		for (const page of pages) {
			await this.getComponents(components, resolve(this.base, page));
		}

		for (const subPackage of subPackages) {
			const { root, pages = [] } = subPackage;

			await Promise.all(
				pages.map(async page =>
					this.getComponents(components, resolve(this.base, join(root, page)))
				)
			);
		}

		this.getTabBarIcons(tabBar);

		return [
			'app',
			...pages,
			...[].concat(...subPackages.map(v => v.pages.map(w => join(v.root, w)))),
			...components
		];
	}

	async getComponents(components, instance) {
		const { usingComponents = {} } =
			(await readJson(`${instance}.json`).catch(
				err => err && err.code !== 'ENOENT' && console.error(err)
			)) || {};
		const componentBase = parse(instance).dir;
		for (const relativeComponent of values(usingComponents)) {
			if (relativeComponent.indexOf('plugin://') === 0) continue;
			const component = resolve(componentBase, relativeComponent);
			if (!components.has(component)) {
				components.add(relative(this.base, component));
				await this.getComponents(components, component);
			}
		}
	}

	getFullScriptPath(path) {
		const {
			base,
			options: { extensions }
		} = this;
		for (const ext of extensions) {
			const fullPath = resolve(base, path + ext);
			if (existsSync(fullPath)) {
				return fullPath;
			}
		}
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
			options: { include, exclude, dot, assetsChunkName, extensions },
			entryResources
		} = this;

		compiler.plugin('compilation', compilation => {
			compilation.plugin('before-chunk-assets', () => {
				const assetsChunkIndex = compilation.chunks.findIndex(
					({ name }) => name === assetsChunkName
				);
				if (assetsChunkIndex > -1) {
					compilation.chunks.splice(assetsChunkIndex, 1);
				}
			});
		});

		const patterns = entryResources
			.map(resource => `${resource}.*`)
			.concat(include);

		const entries = await globby(patterns, {
			cwd: this.base,
			nodir: true,
			realpath: true,
			ignore: [...extensions.map(ext => `**/*${ext}`), ...exclude],
			dot
		});

		this.addEntries(compiler, entries, assetsChunkName);
	}

	getChunkResourceRegExp() {
		if (this._chunkResourceRegex) {
			return this._chunkResourceRegex;
		}

		const {
			options: { extensions }
		} = this;
		const exts = extensions
			.map(ext => ext.replace(/\./g, '\\.'))
			.map(ext => `(${ext}$)`)
			.join('|');
		return new RegExp(exts);
	}

	applyCommonsChunk(compiler) {
		const {
			options: { commonModuleName },
			entryResources
		} = this;

		const scripts = entryResources.map(::this.getFullScriptPath);

		compiler.apply(
			new CommonsChunkPlugin({
				name: stripExt(commonModuleName),
				minChunks: ({ resource }) => {
					if (resource) {
						const regExp = this.getChunkResourceRegExp();
						return regExp.test(resource) && scripts.indexOf(resource) < 0;
					}
					return false;
				}
			})
		);
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
			.filter(resource => resource !== 'app')
			.forEach(resource => {
				const fullPath = this.getFullScriptPath(resource);
				this.addScriptEntry(compiler, fullPath, resource);
			});
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
		compilation.mainTemplate.plugin(
			'require-ensure',
			() => 'throw new Error("Not chunk loading available");'
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
