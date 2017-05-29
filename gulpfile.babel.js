import gulp from 'gulp'
import del from 'del'

import gulpWebpack from 'webpack-stream'
import webpack from 'webpack'

import browserSync from 'browser-sync'
import webpackConfig from './webpack.config.js'

const paths = {
  index: 'src/index.html',
  entry: 'src/app.js',
  dest: 'dest/'
}

const bs = browserSync.create()

/**
 * Clean dest folder for build process
 */
export const clean = () => del([paths.dest])

/**
 * Move static files
 */
function moveStatics() {
  return gulp.src(paths.index)
    .pipe(gulp.dest(paths.dest))
    .pipe(bs.reload({ stream: true }))
}

/**
 * Pack javascript files with webpack
 */
function packJS() {
  return gulp.src(paths.entry)
    .pipe(gulpWebpack(webpackConfig, webpack))
    .pipe(gulp.dest(paths.dest))
    .pipe(bs.reload({ stream: true }))
}

/**
 * Watch files and reload browser when changes happen
 */
function watch() {
  bs.init({
    server: {
      baseDir: paths.dest
    }
  });

  gulp.watch(paths.entry, packJS);
  gulp.watch(paths.index, moveStatics);
  gulp.watch(`${paths.dest}**/*`).on('change', bs.reload);
}

export const build = gulp.series(clean, gulp.parallel(moveStatics, packJS));
export const serve = gulp.series(build, watch);

export default build;
