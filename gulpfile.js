'use strict';

const path = require('path');

const gulp = require('gulp');
const $ = require('gulp-load-plugins')();

const merge = require('merge-stream');
const webpack = require('webpack-stream');

const _ = require('lodash');
const highlight = require('highlight.js');
const moment = require('moment');

const bs = require('browser-sync').create();

const src = {
  root: './src',
  qs: './questions',
  index: './src/index.html',
  templates: './src/templates',
  css: './src/css',
  js: './src/js'
};

const dest = {
  root: './dest',
  css: './dest/css',
  js: './dest/js'
};

function packCSS() {
  let highlightCSS = ['tomorrow.css', 'tomorrow-night.css']
    .map((item) => './node_modules/highlight.js/styles/' + item);

  let code = gulp.src(highlightCSS)
    .pipe(gulp.dest(dest.css));

  let processors = [
    require('cssnext')(),
    require('autoprefixer')({ browsers: ['last 5 version'] }),
    require('cssnano')()
  ];

  let normal = gulp.src(`${src.css}/**/*.css`)
    .pipe($.sourcemaps.init())
    .pipe($.postcss(processors))
      .on('error', (e) => console.log(e))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest(dest.css))
    .pipe(bs.stream());

  return merge(code, normal);
}

gulp.task('css', () => packCSS());

function packJS() {
  return gulp.src(`${src.js}/**/*.js`)
    .pipe(gulp.dest(dest.js))
    .pipe(bs.stream());
}

gulp.task('js', () => packJS());

function layoutQ(file) {
  let date = path.basename(file.path, '.html');
  let title = moment(date, "YYYY-MM-DD").format('MMMM D, YYYY');

  return _.assign(file.frontMatter, {
    layout: `${src.templates}/layout.jade`,
    title
  });
}

function markdwon2html() {
  let hl = (code) => highlight.highlightAuto(code).value;

  return gulp.src(`${src.qs}/**/*.md`)
    .pipe($.frontMatter())
    .pipe($.markdown({ highlight: hl }))
    .pipe($.layout(layoutQ))
    .pipe(gulp.dest(dest.root))
    .pipe(bs.stream());
}

gulp.task('questions', () => markdwon2html());

gulp.task('build', ['css', 'questions', 'js']);

gulp.task('serve', ['build'], () => {
  bs.init({
    server: {
      baseDir: dest.root
    }
  });

  gulp.watch(`${src.qs}/**/*.md`, ['questions']);
  gulp.watch(`${src.templates}/**/*.jade`, ['questions']);
  gulp.watch(`${src.css}/**/*.css`, ['css']);
  gulp.watch(`${src.js}/**/*.js`, ['js']);
  gulp.watch(`${dest.root}/**/*`).on('change', bs.reload);
});
