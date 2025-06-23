const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');

module.exports = (env) => {
  const isProduction = env.mode === 'production';
  const version = env.version || 'admin'; // admin or user
  const browser = env.browser || 'chrome'; // chrome or edge
  
  console.log(`Building ${version} version for ${browser} in ${env.mode} mode`);

  const config = {
    mode: env.mode || 'development',
    devtool: isProduction ? 'source-map' : 'cheap-module-source-map',
    
    entry: {
      popup: './src/popup.js',
      content: './src/content.js',
      background: './src/background.js',
      ...(version === 'admin' && {
        'auth/auth-service': './src/auth/auth-service.js',
        'sync/sync-manager': './src/sync/sync-manager.js'
      })
    },
    
    output: {
      path: path.resolve(__dirname, `../dist/${version}/${browser}`),
      filename: '[name].js',
      clean: true
    },
    
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['@babel/preset-env']
            }
          }
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader'
          ]
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg)$/,
          type: 'asset/resource',
          generator: {
            filename: 'icons/[name][ext]'
          }
        }
      ]
    },
    
    plugins: [
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, `../src/manifest.${version}.json`),
            to: 'manifest.json',
            transform(content) {
              const manifest = JSON.parse(content);
              
              // Browser-specific manifest adjustments
              if (browser === 'edge') {
                // Edge-specific modifications
                manifest.background = manifest.background || {};
                manifest.background.persistent = false;
              }
              
              // Environment-specific adjustments
              if (isProduction) {
                delete manifest.content_security_policy?.extension_pages;
              }
              
              return JSON.stringify(manifest, null, 2);
            }
          },
          {
            from: 'src/icons',
            to: 'icons'
          },
          ...(version === 'admin' && [
            {
              from: 'src/lib',
              to: 'lib'
            }
          ])
        ]
      }),
      
      new HtmlWebpackPlugin({
        template: `./src/popup.${version}.html`,
        filename: 'popup.html',
        chunks: ['popup'],
        inject: 'body'
      }),
      
      ...(isProduction && [
        new MiniCssExtractPlugin({
          filename: 'styles/[name].css'
        })
      ]),
      
      ...(isProduction && env.zip && [
        new ZipPlugin({
          filename: `dom-style-injector-${version}-${browser}.zip`,
          pathPrefix: '',
          exclude: [/\.map$/]
        })
      ])
    ],
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '../src'),
        '@auth': path.resolve(__dirname, '../src/auth'),
        '@sync': path.resolve(__dirname, '../src/sync'),
        '@config': path.resolve(__dirname, '../config')
      }
    },
    
    optimization: {
      splitChunks: {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all'
          }
        }
      }
    },
    
    ...(env.mode === 'development' && {
      devServer: {
        static: {
          directory: path.join(__dirname, `../dist/${version}/${browser}`)
        },
        compress: true,
        port: 9000,
        hot: true,
        open: false
      }
    })
  };
  
  return config;
};