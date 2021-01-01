const webpack = require('webpack');
const {resolve} = require('path');




/*
 * SplitChunksPlugin is enabled by default and replaced
 * deprecated CommonsChunkPlugin. It automatically identifies modules which
 * should be splitted of chunk by heuristics using module duplication count and
 * module category (i. e. node_modules). And splits the chunks…
 *
 * It is safe to remove "splitChunks" from the generated configuration
 * and was added as an educational example.
 *
 * https://webpack.js.org/plugins/split-chunks-plugin/
 *
 */

/*
 * We've enabled TerserPlugin for you! This minifies your app
 * in order to load faster and run less javascript.
 *
 * https://github.com/webpack-contrib/terser-webpack-plugin
 *
 */

const TerserPlugin = require('terser-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const {CleanWebpackPlugin} = require('clean-webpack-plugin');

const webcomponentsjs = './node_modules/@webcomponents/webcomponentsjs';

const polyfills = [
  {
    from: resolve(`${webcomponentsjs}/webcomponents-*.{js,map}`),
    to: 'vendor',
  },
  {
    from: resolve(`${webcomponentsjs}/bundles/*.{js,map}`),
    to: 'vendor/bundles',
  },
  {
    from: resolve(`${webcomponentsjs}/custom-elements-es5-adapter.js`),
    to: 'vendor',
  }
];


module.exports = {
  mode: 'development',
  entry: './src/index.ts',
  plugins: [
    new CleanWebpackPlugin(),
    new webpack.ProgressPlugin(),
    new HtmlWebpackPlugin({
      template: 'public/index.html'
    }),
    new CopyWebpackPlugin({patterns: polyfills})
  ],

  module: {
    rules: [{
      test: /\.(ts|tsx)$/,
      loader: 'ts-loader',
      include: [
        resolve(__dirname, 'src'),
        /node_modules(?:\/|\\)lit-element|lit-html/
      ],
      exclude: [/node_modules/]
    }, {
      test: /.(scss|css)$/,

      use: [{
        loader: "style-loader"
      }, {
        loader: "css-loader",

        options: {
          sourceMap: true
        }
      }, {
        loader: "sass-loader",

        options: {
          sourceMap: true
        }
      }]
    }]
  },

  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },

  optimization: {
    minimizer: [new TerserPlugin()],

    splitChunks: {
      cacheGroups: {
        vendors: {
          priority: -10,
          test: /[\\/]node_modules[\\/]/
        }
      },

      chunks: 'async',
      minChunks: 1,
      minSize: 30000,
      name: false
    }
  }
}