
import { execSync } from 'child_process';

test('wxapp-webpack-plugin', () => {
	const stdout = execSync('webpack', { cwd: __dirname, encoding: 'utf8' });

	stdout && console.log(stdout);

	global.getApp = jest.fn();
	global.App = jest.fn();
	global.Page = jest.fn();

	require('./dist/app');
	require('./dist/pages/index/index');
	require('./dist/pages/logs/logs');

	expect(global.App.mock.calls.length).toBe(1);
	expect(global.Page.mock.calls.length).toBe(2);
});
