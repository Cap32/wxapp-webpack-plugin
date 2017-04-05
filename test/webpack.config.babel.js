
import path from 'path';
import WXAppWebpackPlugin from '../src';

export default {
	entry: './src/app.js',
	output: {
		filename: 'index.js',
		path: path.resolve(__dirname, 'dist'),
	},
	target: 'node',
	module: {
		rules: [
			{
				test: /\.js$/,
				include: /src/,
				loader: 'babel-loader',
			},
		],
	},
	plugins: [
		new WXAppWebpackPlugin(),
	],
	resolve: {
		modules: ['src', 'node_modules'],
		extensions: ['.js'],
	},
	resolveLoader: {
		moduleExtensions: ['-loader'],
	},
};
