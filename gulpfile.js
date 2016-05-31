'use strict';

const path = require('path');

const gulp = require('gulp');
const $ = require('gulp-load-plugins')();

const merge = require('merge-stream');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const vueify = require('vueify');
const babelify = require('babelify');

const ls = require('bluebird').promisify(require('node-dir').files);

const _ = require('lodash');
const highlight = require('highlight.js');
const moment = require('moment');

const bs = require('browser-sync').create();

const src = {
  root: './src',
  qs: './questions',
  index: './src/index.jade',
  templates: './src/templates',
  css: './src/css',
  js: './src/js',
  components: './src/components',
  vueConfig: './vue.config.js'
};

const dest = {
  root: './dest',
  css: './dest/css',
  js: './dest/js'
};

vueify.compiler.applyConfig(require(src.vueConfig));

function packCSS() {
  let highlightCSS = ['tomorrow.css', 'tomorrow-night.css']
    .map((item) => './node_modules/highlight.js/styles/' + item);

  let code = gulp.src(highlightCSS)
    .pipe(gulp.dest(dest.css));

  let processors = [
    require('postcss-import'),
    require('cssnext')(),
    require('autoprefixer')({ browsers: ['last 5 version'] }),
    require('cssnano')()
  ];

  let css = [`${src.css}/question.css`, `${src.css}/index.css`];
  let normal = gulp.src(css)
    .pipe($.sourcemaps.init())
    .pipe($.postcss(processors))
      .on('error', (e) => console.log(e.stack))
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

gulp.task('calendar', () => {
  let b = browserify({
    entries: `${src.components}/calendar.js`,
    debug: true,
    transform: [babelify, vueify]
  });

  return b
    .bundle()
      .on('error', (e) => console.error(e))
    .pipe(source('calendar.js'))
    .pipe(buffer())
    .pipe(gulp.dest(dest.js))
    .pipe(bs.stream());
});

gulp.task('index', () => {
  return gulp.src(src.index)
    .pipe($.data(ls(src.qs)
      .then((files) => {
        let data = files.map((item) => path.basename(item, '.md')).join(',');
        return {data};
      }))
    )
    .pipe($.jade())
    .pipe(gulp.dest(dest.root))
    .pipe(bs.stream());
});

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
    .pipe($.changed(dest.root, { extension: '.html' }))
    .pipe($.frontMatter())
    .pipe($.markdown({ highlight: hl }))
    .pipe($.layout(layoutQ))
    .pipe(gulp.dest(dest.root))
    .pipe(bs.stream());
}

gulp.task('questions', () => markdwon2html());

gulp.task('build-index', ['calendar', 'index']);

gulp.task('build-qs', ['questions', 'css', 'js']);

gulp.task('build', ['build-index', 'build-qs']);

gulp.task('serve', ['build'], () => {
  bs.init({
    server: {
      baseDir: dest.root
    }
  });

  gulp.watch(`${src.qs}/**/*.md`, ['questions', 'calendar']);
  gulp.watch(`${src.templates}/**/*.jade`, ['questions']);
  gulp.watch(`${src.css}/**/*.css`, ['css']);
  gulp.watch(`${src.js}/**/*.js`, ['js']);
  gulp.watch([src.vueConfig, `${src.components}/*`], ['calendar']);
  gulp.watch(src.index, ['index']);
  gulp.watch(`${dest.root}/**/*`).on('change', bs.reload);
});
