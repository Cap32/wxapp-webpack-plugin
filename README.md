# wxapp-webpack-plugin
微信小程序 webpack 插件


###### 为什么要使用 webpack

很多前端开发者都使用过 [webpack](https://webpack.js.org/)，通过 webpack 开发 JavaScript 项目可以带来很多好处

- 支持通过 `yarn` 或 `npm` 引入和使用 `node_modules` 模块
- 支持丰富且灵活的 `loaders` 和 `plugins`
- 支持 `alias`
- 还有很多...


###### 为什么要使用这个插件

- 微信小程序开发需要有多个入口文件（如 `app.js`, `app.json`, `pages/index/index.js` 等等），使用这个插件只需要引入 `app.js` 即可，其余文件将会被自动引入
- 若多个入口文件（如 `pages/index/index.js` 和 `pages/logs/logs.js`）引入有相同的模块，这个插件能避免重复打包相同模块。


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
- [wxml-loader](https://github.com/webpack-contrib/file-loader): 使 `webpack` 能编译或处理 `*.wxml` 上引用的文件

开发者也可以根据自身需求和习惯，使用 `sass-loader` 之类的 `loader`。


###### 完整 webpack.config.js 示例

```js
const path = require('path');
const WXAppWebpackPlugin = require('wxapp-webpack-plugin');

module.exports = {

  // 引入 `app.js`
  entry: {
    app: './src/app.js',
  },

  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist'),
  },
  plugins: [

    // 引入插件
    new WXAppWebpackPlugin(),

  ],
  module: {
    rules: [
      {
        test: /\.(jpg|png|gif|json)$/,
        include: /src/,
        loader: 'file-loader',
        options: {
          useRelativePath: true,
          name: '[name].[ext]',
        }
      },
      {
        test: /\.wxss$/,
        include: /src/,
        use: [
          {
            loader: 'file-loader',
            options: {
              useRelativePath: true,
              name: '[name].wxss',
            }
          },
          {
            loader: 'css-loader',
          },
        ],
      },
      {
        test: /\.wxml$/,
        include: /src/,
        loader: 'wxml-loader',
      },
    ],
  },
  devtool: 'source-map', // 在开发时，推荐使用 `source-map` 辅助调试
};
```

#### 开始开发小程序

现在可以通过在终端输入 `webpack -w` 开始使用 webpack 开发微信小程序


## API

`new WXAppWebpackPlugin(options)`

###### options

- `clear` (Boolean): 在启动 `webpack` 时清空 `dist` 目录。默认为 `true`
- `commonModuleName` (String): 公共 `js` 文件名。默认为 `common.js`


## 注意

- 暂时只在 `webpack@v2.3.2` 测试通过，不确定其他版本下是否兼容性，欢迎提交反馈
- 程序的开发方式与 [微信小程序开发文档](https://mp.weixin.qq.com/debug/wxadoc/dev/) 一样，开发者需要在 `src` （源）目录创建 `app.js`、`app.json`、`app.wxss`、`pages/index/index.js` 之类的文件进行开发


## License

MIT © Cap32
