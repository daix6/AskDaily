module.exports = {
  postcss: [
    require('postcss-import')({ root: './src/css'}),
    require('cssnext')(),
    require('autoprefixer')({ browsers: ['last 5 version'] }),
    require('cssnano')()]
};
