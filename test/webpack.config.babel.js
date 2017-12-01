
import path from 'path';
import WXAppWebpackPlugin, { Targets } from '../src';

const ext = process.env.TEST_EXT || 'js';

const include = new RegExp(`src_${ext}`);

export default {
	entry: {
		app: [`./src_${ext}/utils/bomPolyfill.js`, `./src_${ext}/app`],
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'dist'),
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
				test: /\.(wxss|wxml|json)$/,
				include,
				loader: 'file-loader',
				options: {
					useRelativePath: true,
					name: '[name].[ext]',
				}
			},
		],
	},
	plugins: [
		new WXAppWebpackPlugin({
			scriptExt: `.${ext}`,
		}),
	],
	devtool: 'source-map',
	resolve: {
		modules: [`src_${ext}`, 'node_modules'],
		extensions: ['.js', '.ts', '.json'],
	},
};
