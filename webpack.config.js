const { resolve, posix } = require('path')
const Webpack = require('webpack')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const LodashWebpackPlugin = require('lodash-webpack-plugin')
const ProgressBarPlugin = require('progress-bar-webpack-plugin')
const UglifyJsWebpackPlugin = require('uglifyjs-webpack-plugin')

const IS_PROD = process.env.NODE_ENV === 'production'

process.noDeprecation = true

const config = {
  entry: {
    music: 'index.js',
    vendor: ['fastclick']
  },
  output: {
    path: resolve(__dirname, 'dist'),
    filename: posix.join('assets', '[name]-[chunkhash:7].js')
  },
  devtool: 'cheap-module-eval-source-map',
  stats: {
    chunks: false,
    modules: false,
    children: false
  },
  devServer: {
    port: '3001',
    host: '127.0.0.1',
    stats: 'errors-only',
    contentBase: resolve(__dirname, 'src'),
    hot: true,
    watchContentBase: true,
    historyApiFallback: true,
    watchOptions: {
      poll: 1000,
      aggregateTimeout: 300,
      ignored: /node_modules/
    }
  },
  performance: {
    hints: false
  },
  resolve: {
    extensions: ['.js'],
    modules: [resolve(__dirname, 'src'), 'node_modules']
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        enforce: 'pre',
        loader: 'eslint-loader',
        exclude: /node_modules/,
        options: {
          formatter: require('eslint-friendly-formatter')
        }
      },
      {
        test: /\.js$/,
        loader: 'babel-loader',
        exclude: /node_modules/,
        options: {
          babelrc: false,
          plugins: [
            'lodash',
            'transform-runtime',
            'transform-async-to-generator'
          ],
          presets: [
            [
              'env',
              {
                modules: false,
                useBuiltIns: true
              }
            ],
            'stage-0'
          ],
          cacheDirectory: true
        }
      },
      {
        test: /\.pug$/,
        use: [
          {
            loader: 'pug-loader',
            options: {
              pretty: true
            }
          }
        ]
      },
      {
        test: /\.styl$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            {
              loader: 'css-loader',
              options: {
                minimize: IS_PROD
              }
            },
            {
              loader: 'postcss-loader',
              options: {
                sourceMap: 'inline'
              }
            },
            'stylus-loader'
          ]
        })
      },
      {
        test: /\.(gif|png|jpe?g)$/,
        use: [
          {
            loader: 'url-loader',
            options: {
              limit: 5120,
              name: posix.join('assets', '[name]-[hash:7].[ext]')
            }
          }
        ]
      }
    ]
  },
  plugins: [
    new LodashWebpackPlugin({
      paths: true,
      guards: true,
      cloning: true,
      exotics: true,
      unicode: true,
      chaining: true,
      metadata: true,
      currying: true,
      memoizing: true,
      deburring: true,
      coercions: true,
      shorthands: true,
      flattening: true,
      collections: true,
      placeholders: true
    }),
    new HtmlWebpackPlugin({
      title: 'music',
      filename: 'index.html',
      template: resolve(__dirname, 'src/index.pug'),
      inject: true,
      minify: IS_PROD && {
        html5: true,
        minifyJS: true,
        minifyCSS: true,
        minifyURLs: true,
        sortAttributes: true,
        removeComments: true,
        useShortDoctype: true,
        collapseWhitespace: true,
        removeOptionalTags: true,
        trimCustomFragments: true,
        removeEmptyAttributes: true,
        removeRedundantAttributes: true,
        collapseBooleanAttributes: true,
        removeScriptTypeAttributes: true,
        processConditionalComments: true,
        collapseInlineTagWhitespace: true,
        removeStyleLinkTypeAttributes: true
      }
    }),
    new ProgressBarPlugin(),
    new ExtractTextPlugin({
      disable: false,
      allChunks: true,
      filename: posix.join('assets', '[name]-[contenthash:7].css')
    }),
    new Webpack.optimize.CommonsChunkPlugin({
      name: 'vendor',
      filename: posix.join('assets', '[name]-[hash:7].js')
    }),
    new Webpack.optimize.OccurrenceOrderPlugin(),
    new Webpack.optimize.AggressiveMergingPlugin()
  ]
}

if (IS_PROD) {
  config.devtool = false
  config.plugins = config.plugins.concat([
    new CleanWebpackPlugin(['dist'], {
      dry: false,
      verbose: true,
      exclude: ['.gitkeep'],
      root: resolve(__dirname)
    }),
    new UglifyJsWebpackPlugin({
      /*eslint camelcase: 0*/
      mangle: true,
      beautify: false,
      comments: false,
      sourceMap: false,
      compress: {
        unsafe: true,
        warnings: false,
        drop_console: true,
        drop_debugger: true
      },
      output: {
        comments: false,
        ascii_only: true
      }
    })
  ])
} else {
  config.plugins = config.plugins.concat([
    new Webpack.NamedModulesPlugin(),
    new Webpack.HotModuleReplacementPlugin()
  ])
}

module.exports = config
