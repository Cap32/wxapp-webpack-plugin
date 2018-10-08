
// import { flow } from 'lodash';

// const delay = (t = 0) => new Promise((resolve) => setTimeout(resolve, t));
import Product from './product.service';
const productService = new Product();
//获取应用实例
const app = getApp(); // eslint-disable-line no-undef

Page({
	data: {
		motto: 'Hello List',
		userInfo: {},
	},
	//事件处理函数
	bindViewTap() {
		wx.navigateTo({
			url: './productDetail',
		});
	},
	onLoad() {

		// await delay();

		// const log = flow(() => {
		// 	console.log('onLoad');
		// });

		// log();
		this.setData({
			productName: productService.getProductName()
		})
	},
});
