module.exports = {
  entry: {
    app: './src/app.js'
  },
  output: {
    filename: '[name].js'
  },
  module: {
    rules: [{
      test: /\.js$/,
      exclude: ['node_modules'],
      loader: 'babel-loader',
      options: {
        presets: ['es2015']
      }
    }, {
      test: /\.vue$/,
      exclude: ['node_modules'],
      loader: 'vue-loader',
      options: {
        loaders: {
          postcss: 'postcss-loader',
        }
      }
    }]
  },
  resolve: {
    extensions: ['.js', '.vue', '.css'],
    alias: { vue: 'vue/dist/vue.js' }
  },
  devtool: 'source-map'
}
