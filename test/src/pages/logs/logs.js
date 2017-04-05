
import { formatTime } from '../../utils/util.js';

console.log('fork');

Page({
	data: {
		logs: [],
	},
	onLoad() {
		this.setData({
			logs: (wx.getStorageSync('logs') || []).map(function (log) {
				return formatTime(new Date(log));
			}),
		});
	}
});
