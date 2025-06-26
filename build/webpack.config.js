// build/webpack.config.js - Fixed to match actual file structure

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  // Updated entry points to match actual file locations
  entry: {
    'popup/popup': './src/popup/popup.js',
    'background': './src/background.js',  // Fixed: points to actual background.js file
    'scripts/content': './src/scripts/content.js'  // Added content script if it exists
  },
  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    // The [name] placeholder will use the key from the entry object,
    // preserving the directory structure.
    filename: '[name].js',
    clean: true, // Clean the dist folder before each build
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        // Copy assets
        { from: 'src/assets', to: 'assets', noErrorOnMissing: true },

        // Copy manifest.json
        { from: 'src/manifest.json', to: 'manifest.json' },

        // Copy popup files
        { from: 'src/popup/popup.html', to: 'popup/popup.html' },
        { from: 'src/popup/popup.css', to: 'popup/popup.css' },

        // Copy other static files if they exist
        { from: 'src/options', to: 'options', noErrorOnMissing: true },
        { from: 'src/styles', to: 'styles', noErrorOnMissing: true },

        // Copy content script if it exists in a different location
        { from: 'src/scripts/content.js', to: 'scripts/content.js', noErrorOnMissing: true },
      ],
    }),
  ],
  resolve: {
    extensions: ['.js'],
  },
  // Source map for easier debugging
  devtool: 'cheap-module-source-map',
};