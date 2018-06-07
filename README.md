# wxapp-webpack-plugin

[![Build Status](https://travis-ci.org/Cap32/wxapp-webpack-plugin.svg?branch=master)](https://travis-ci.org/Cap32/wxapp-webpack-plugin) [![Build status](https://ci.appveyor.com/api/projects/status/7scpj8g00a4cacpr/branch/master?svg=true)](https://ci.appveyor.com/project/Cap32/wxapp-webpack-plugin/branch/master)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](http://makeapullrequest.com)


微信小程序 webpack 插件


###### 为什么要使用 webpack

很多前端开发者都使用过 [webpack](https://webpack.js.org/)，通过 webpack 开发 JavaScript 项目可以带来很多好处

- 支持通过 `yarn` 或 `npm` 引入和使用 `node_modules` 模块
- 支持丰富且灵活的 `loaders` 和 `plugins`
- 支持 `alias`
- 还有很多...


###### 为什么要使用这个插件

- 微信小程序开发需要有多个入口文件（如 `app.js`, `app.json`, `pages/index/index.js` 等等），使用这个插件只需要引入 `app.js` 即可，其余文件将会被自动引入
- 若多个入口文件（如 `pages/index/index.js` 和 `pages/logs/logs.js`）引入有相同的模块，这个插件能避免重复打包相同模块
- 支持自动复制 `app.json` 上的 `tabbar` 图片 (v0.17.0 或以上)


## 使用方法

#### 安装

```bash
yarn add -D wxapp-webpack-plugin
```

#### 配置 webpack

1. 在 `entry` 上引入 `{ app: './src/app.js' }`, 这里的 `./src/app.js` 为微信小程序开发所需的 `app.js`。**注意** `key` 必须为 `app`，`value` 支持[数组](https://webpack.js.org/configuration/entry-context/#entry)）

2. 在 `output` 上设置 `filename: '[name].js'。` **注意** 这里 `[name].js` 是因为 `webpack` 将会打包生成多个文件，文件名称将以 `[name]` 规则来输出

3. 添加 `new WXAppWebpackPlugin()` 到 `plugins`

###### `loader` 的使用提示

为了使 `webpack` 能编译和输出非 `.js` 文件，配置时要按需添加各种 `loaders`。这里作者推荐使用以下几个对微信小程序开发很有用的 `loaders`：

- [file-loader](https://github.com/webpack-contrib/file-loader): 用于输出 `*.json`，`*.wxss`，`*.jpg` 之类的文件
- [css-loader](https://github.com/webpack-contrib/css-loader): 使 `webpack` 能编译或处理 `*.wxss` 上引用的文件
- [wxml-loader](https://github.com/Cap32/wxml-loader): 使 `webpack` 能编译或处理 `*.wxml` 上引用的文件

开发者也可以根据自身需求和习惯，使用 `sass-loader` 之类的 `loader`。


**完整的项目开发脚手架，请查看 [wxapp-boilerplate](https://github.com/cantonjs/wxapp-boilerplate)**


## API

#### WXAppWebpackPlugin

###### 用法

webpack.config.babel.js

```js
import WXAppWebpackPlugin from 'wxapp-webpack-plugin';
export default {
  // ...configs,
  plugins: [
    // ...other,
    new WXAppWebpackPlugin(options)
  ],
};
```


###### Options

所有 `Options` 均为可选

- `clear` (\<Boolean\>): 在启动 `webpack` 时清空 `dist` 目录。默认为 `true`
- `commonModuleName` (\<String\>): 公共 `js` 文件名。默认为 `common.js`
- `extensions` (\<Array\<String\>\>): 脚本文件后缀名。默认为 `['.js']`

#### `Targets`

Webpack target 值，目前有 `Targets.Wechat` 和 `Targets.Alipay`，如果不配置，webpack target 将会自动设为 `Targets.Wechat`。如果需要开发支付宝小程序，则改为 `Targets.Alipay`。开发者也可以通过 `process.env.TARGET` 之类的配置来动态输出。

###### 示例

webpack.config.babel.js

```js
import WXAppWebpackPlugin, { Targets } from 'wxapp-webpack-plugin';
export default {
  // ...configs,
  target: Targets[process.env.TARGET || 'Wechat'],
};
```

## 提示

- 程序的开发方式与 [微信小程序开发文档](https://mp.weixin.qq.com/debug/wxadoc/dev/) 一样，开发者需要在 `src` （源）目录创建 `app.js`、`app.json`、`app.wxss`、`pages/index/index.js` 之类的文件进行开发


## License

MIT © Cap32
