// build/webpack.config.js

const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'production',
  // The entry points now clearly map to their source locations.
  entry: {
    'popup/popup': './src/popup/popup.js',
    'scripts/service-worker': './src/scripts/service-worker.js'
  },
  output: {
    path: path.resolve(__dirname, '..', 'dist'),
    // The [name] placeholder will use the key from the entry object,
    // preserving the directory structure.
    filename: '[name].js',
    clean: true, // Clean the dist folder before each build
  },
  plugins: [
    // This plugin now only needs to copy assets and the main popup HTML.
    // CSS and other files can be imported directly into the JS if needed.
    new CopyPlugin({
      patterns: [
        // Look inside the 'src' folder for these assets
        { from: 'src/assets', to: 'assets' },
        { from: 'src/manifest.json', to: 'manifest.json' },
    
        // These paths were already correct
        { from: 'src/popup/popup.html', to: 'src/popup/popup.html' },
        { from: 'src/popup/popup.css', to: 'src/popup/popup.css' },
      ],
    }),
  ],
  resolve: {
    extensions: ['.js'],
  },
  // Optional: A source map for easier debugging in the browser.
  devtool: 'cheap-module-source-map',
};