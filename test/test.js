
import rimraf from 'rimraf';
import { execSync } from 'child_process';
import { resolve } from 'path';

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
		stdout && console.log(stdout);
	}
	catch (err) {
		err.stdout && console.error(err.stdout);
		expect(err).toBe(undefined);
	}

	global.wx = {};
	global.getApp = jest.fn();
	global.App = jest.fn();
	global.Page = jest.fn();

	require('./dist/app');
	require('./dist/pages/index/index');
	require('./dist/pages/logs/logs');

	expect(global.App.mock.calls.length).toBe(1);
	expect(global.Page.mock.calls.length).toBe(2);
};

afterEach(() => {
	rimraf.sync(resolve('test/dist'));
	Reflect.deleteProperty(global, 'wx');
	Reflect.deleteProperty(global, 'getApp');
	Reflect.deleteProperty(global, 'App');
	Reflect.deleteProperty(global, 'Page');
	delete require.cache[require.resolve('./dist/app')];
	delete require.cache[require.resolve('./dist/pages/index/index')];
	delete require.cache[require.resolve('./dist/pages/logs/logs')];
});

test('js', () => {
	createTest('js');
});

// TODO
// test('ts', () => {
// 	createTest('ts');
// });
