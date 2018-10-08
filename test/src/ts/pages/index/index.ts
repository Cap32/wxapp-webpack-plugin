
// import { flow } from 'lodash';

// const delay = (t = 0) => new Promise((resolve) => setTimeout(resolve, t));

//获取应用实例
const app = getApp(); // eslint-disable-line no-undef

Page({
	data: {
		motto: 'Hello World',
	},
	goToSubList1() {
		wx.navigateTo({
			url: '../product/productList',
		});
	},
	goToSubList2() {
		wx.navigateTo({
			url: '../product2/productList',
		});
	},
	onLoad() {

		// await delay();

		// const log = flow(() => {
		// 	console.log('onLoad');
		// });

		// log();
	},
});
