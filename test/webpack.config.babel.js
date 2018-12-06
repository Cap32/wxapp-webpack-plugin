
import path from 'path';
import WXAppWebpackPlugin, { Targets } from '../src';

const ext = process.env.TEST_EXT || 'js';

const include = new RegExp('src');

export default {
	entry: {
		app: [`./src/${ext}/utils/bomPolyfill.js`, `./src/${ext}/app.${ext}`],
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'dist', ext),
	},
	target: Targets.Wechat,
	module: {
		rules: [
			{
				test: /\.(ts|js)$/,
				include,
				loader: 'babel-loader',
				options: {
					presets: ['es2015', 'stage-0'],
					babelrc: false,
				}
			},
			{
				test: /\.(wxss|wxml|json|png)$/,
				include,
				loader: 'file-loader',
				options: {
					useRelativePath: true,
					name: '[name].[ext]',
				}
			},
			{
				test: /\.(wxss|wxml|json|png)$/,
				include: /node_modules/,
				loader: 'file-loader',
				options: {
					useRelativePath: false,
					name: (filePath) => {
						const flag = 'node_modules/';
						const index = filePath.indexOf(flag);
						if (index !== -1) {
							const targetPath = filePath.substring(index + flag.length).split('.')[0];
							return `./components/${targetPath}.[ext]`;
						}
						return `[name].[ext]`;
					},
				}
			},
		],
	},
	plugins: [
		new WXAppWebpackPlugin({
			extensions: [`.${ext}`, '.js'],
			externalComponents: ['iview-weapp'],
			externalComponentsDirectory: '../../../node_modules/',
		}),
	],
	devtool: 'source-map',
	resolve: {
		modules: [`src/${ext}`, 'node_modules'],
		extensions: ['.js', '.ts', '.json'],
	},
};
