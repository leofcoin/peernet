const path = require('path');
const webpack = require('webpack');
module.exports = [{
  entry: './src/peernet.js',
  mode: 'production',
  plugins: [
    // Work around for Buffer is undefined:
    // https://github.com/webpack/changelog-v5/issues/10
    new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
        process: 'process/browser',
  }),
  new webpack.DefinePlugin({
    HTTP_IMPORT: '',
		"import fetch from 'node-fetch'": ''
  }),
  new webpack.IgnorePlugin({
    checkResource(resource, context) {
      if (resource.includes('./wordlists') && !resource.includes('english')) return true
      // console.log(resource, context);
    }
  }) // bi39 wordlist (mnemonic) only english
],
optimization: {
  minimize: false
},
experiments: {
  outputModule: true
},
resolve: {
        extensions: [ '.ts', '.js' ],
        fallback: {
          fs: false,
          util: false,
          "stream": require.resolve("stream-browserify"),
          "buffer": require.resolve("buffer"),
          "path": require.resolve("path-browserify"),
          "os": require.resolve("os-browserify"),
          "crypto": require.resolve("crypto-browserify"),
          "vm": require.resolve("vm-browserify")
        }
    },
  output: {
    library: {
      type: 'module'
    },
    chunkFilename: '[name].js',
    filename: 'peernet.js',
    path: path.resolve(__dirname, 'dist', 'browser'),
  },
}];
