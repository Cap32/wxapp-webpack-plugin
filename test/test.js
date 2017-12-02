
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

	require(`./dist/${ext}/app`);
	require(`./dist/${ext}/pages/index/index`);
	require(`./dist/${ext}/pages/logs/logs`);

	expect(global.App.mock.calls.length).toBe(1);
	expect(global.Page.mock.calls.length).toBe(2);
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
