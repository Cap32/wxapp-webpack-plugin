import rimraf from 'rimraf';
import { execSync } from 'child_process';
import { resolve } from 'path';
import { existsSync } from 'fs-extra';

const createTest = function createTest(ext) {
	try {
		const stdout = execSync('webpack', {
			cwd: __dirname,
			encoding: 'utf8',
			env: {
				...process.env,
				TEST_EXT: ext,
			},
		});

		if (stdout) {
			console.log(stdout);
		}
	} catch (err) {
		if (err.stdout) {
			console.error(err.stdout);
		}

		expect(err).toBe(undefined);
	}

	global.wx = {};
	global.getApp = jest.fn();
	global.App = jest.fn();
	global.Page = jest.fn();

	require(`./dist/${ext}/app`);
	require(`./dist/${ext}/pages/index/index`);
	require(`./dist/${ext}/pages/logs/logs`);
	require(`./dist/${ext}/pages/product/productDetail`);
	require(`./dist/${ext}/pages/product/productList`);
	require(`./dist/${ext}/pages/product2/productDetail`);
	require(`./dist/${ext}/pages/product2/productList`);

	expect(global.App.mock.calls.length).toBe(1);
	expect(global.Page.mock.calls.length).toBe(6);

	const getVendorPath = path => resolve(__dirname, path, 'common.js');
	expect(existsSync(getVendorPath(`dist/${ext}/pages/product`))).toBe(true);
	expect(existsSync(getVendorPath(`dist/${ext}/pages/product2`))).toBe(true);
	expect(existsSync(getVendorPath(`dist/${ext}`))).toBe(true);

	const inImagesDir = name => resolve(__dirname, `dist/${ext}/images`, name);
	expect(existsSync(inImagesDir('wechat.png'))).toBe(true);
	expect(existsSync(inImagesDir('wechat_selected.png'))).toBe(true);
	expect(existsSync(inImagesDir('twitter.png'))).toBe(true);
	expect(existsSync(inImagesDir('twitter_selected.png'))).toBe(true);
};

afterEach(() => {
	rimraf.sync(resolve('test/dist'));
	delete global.wx;
	delete global.getApp;
	delete global.App;
	delete global.Page;
});

test('js', () => {
	createTest('js');
});

test('ts', () => {
	createTest('ts');
});
