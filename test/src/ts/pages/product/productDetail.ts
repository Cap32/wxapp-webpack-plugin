
import { formatTime } from '../../utils/util';
import Product from './product.service';
const productService = new Product();

Page({
	data: {
		logs: [],
	},
	onLoad() {
		this.setData({
			logs: (wx.getStorageSync('logs') || []).map(function (log) {
				return formatTime(new Date(log));
			}),
			productName: productService.getProductName()
		});
	}
});
