const path = require('path');
const webpack = require('webpack');
module.exports = {
  entry: './dist/browser/peernet.js',
  plugins: [
    // Work around for Buffer is undefined:
    // https://github.com/webpack/changelog-v5/issues/10
    new webpack.ProvidePlugin({
        Buffer: ['buffer', 'Buffer'],
    }),
    new webpack.ProvidePlugin({
        process: 'process/browser',
  })
],
optimization: {
  minimize: false
},
resolve: {
        extensions: [ '.ts', '.js' ],
        fallback: {
          "stream": require.resolve("stream-browserify"),
          "buffer": require.resolve("buffer"),
          "path": require.resolve("path-browserify"),
          "os": require.resolve("os-browserify")
        }
    },
  output: {
    library: {
      name: 'Peernet',
      type: 'global'
    },
    filename: 'peernet.js',
    path: path.resolve(__dirname, 'dist', 'browser'),
  },
};
