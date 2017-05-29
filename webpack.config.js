module.exports = {
  entry: {
    app: './src/app.js'
  },
  output: {
    filename: '[name].js'
  },
  module: {
    loaders: [{
      test: /\.js$/,
      exclude: ['node_modules'],
      loader: 'babel-loader'
    }]
  },
  resolve: {
    extensions: ['.js'],
    alias: { vue: 'vue/dist/vue.js' }
  },
  devtool: 'source-map'
}
