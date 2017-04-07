
import path from 'path';
import WXAppWebpackPlugin from '../src';

export default {
	entry: {
		app: ['./src/utils/bomPolyfill.js', './src/app.js'],
	},
	output: {
		filename: '[name].js',
		path: path.resolve(__dirname, 'dist'),
	},
	module: {
		rules: [
			{
				test: /\.js$/,
				include: /src/,
				loader: 'babel-loader',
				options: {
					presets: ['es2015', 'stage-0'],
					babelrc: false,
				}
			},
			{
				test: /\.(wxss|wxml|json)$/,
				include: /src/,
				loader: 'file-loader',
				options: {
					useRelativePath: true,
					name: '[name].[ext]',
				}
			},
		],
	},
	plugins: [
		new WXAppWebpackPlugin(),
	],
	devtool: 'source-map',
	resolve: {
		modules: ['src', 'node_modules'],
	},
};
