module.exports = {
  plugins: [
    require('postcss-cssnext')({ browsers: ['last 5 version'] })
  ],
  sourceMap: true
}
