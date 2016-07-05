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

const del = require('del');
const frontMatter = require('front-matter');
const nodeDir = require('node-dir');
const ls = require('bluebird').promisify(nodeDir.files);
const lsContent = require('bluebird').promisify(nodeDir.readFiles);

const _ = require('lodash');
const highlight = require('highlight.js');
const moment = require('moment');

const bs = require('browser-sync').create();
const ghPages = require('gh-pages');

const src = {
  root: './src',
  qs: './questions',
  index: './src/index.jade',
  archive: './src/archive.jade',
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

  let css = [`${src.css}/question.css`, `${src.css}/index.css`, `${src.css}/archive.css`];
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
      .then(files => {
        let data = files.map((item) => path.basename(item, '.md')).join(',');
        return {data};
      }))
    )
    .pipe($.jade())
    .pipe(gulp.dest(dest.root))
    .pipe(bs.stream());
});

gulp.task('archive', () => {
  let questions = [];

  return gulp.src(src.archive)
    .pipe($.data(lsContent(src.qs, (err, content, filename, next) => {
      if (err) throw err;
      let question = frontMatter(content).attributes.question;
      let [undefined, year, month, day] = filename.split('.')[0].split('\\');

      questions.push({
        day,
        question,
        range: moment(`${year}${month}`, 'YYYYMM').format('YYYY MMMM'),
        link: `./questions/${year}/${month}/${day}.md`
      });

      next();
    })
      .then(files => {
        return {data: _.groupBy(questions, 'range')};
      })
    ))
    .pipe($.jade())
    .pipe(gulp.dest(dest.root))
    .pipe(bs.stream());
});

function layoutQ(file) {
  let date = path.basename(file.path, '.html');
  let title = moment(date, "YYYY-MM-DD").format('MMMM D, YYYY');

  let tags = file.frontMatter.tags.split(',').map(item => item.trim());
  file.frontMatter.tags = tags;

  return _.assign(file.frontMatter, {
    layout: `${src.templates}/layout.jade`,
    title
  });
}

function markdwon2html(layout) {
  let hl = (code) => highlight.highlightAuto(code).value;

  return gulp.src(`${src.qs}/**/*.md`)
    .pipe($.if(!layout, $.changed(dest.root, { extension: '.html' })))
    .pipe($.frontMatter())
    .pipe($.markdown({ highlight: hl }))
    .pipe($.layout(layoutQ))
    .pipe(gulp.dest(dest.root))
    .pipe(bs.stream());
}

gulp.task('questions', () => markdwon2html());
gulp.task('questions-layout', () => markdwon2html(true))

gulp.task('build-index', ['calendar', 'index', 'archive']);

gulp.task('build-qs', ['questions', 'css', 'js']);

gulp.task('build', ['build-index', 'build-qs']);

gulp.task('serve', ['build'], () => {
  bs.init({
    server: {
      baseDir: dest.root
    }
  });

  gulp.watch(`${src.qs}/**/*.md`, ['questions', 'calendar']);
  gulp.watch(`${src.templates}/layout.jade`, ['questions-layout']);
  gulp.watch(`${src.css}/**/*.css`, ['css']);
  gulp.watch(`${src.js}/**/*.js`, ['js']);
  gulp.watch([src.vueConfig, `${src.components}/*`], ['calendar']);
  gulp.watch(src.index, ['index']);
  gulp.watch(src.archive, ['archive']);
  gulp.watch(`${dest.root}/**/*`).on('change', bs.reload);
});

gulp.task('clean', () => {
  return del(`${dest.root}/*`)
});

gulp.task('deploy', ['build'], () => {
  return ghPages.publish(path.resolve(__dirname, dest.root), {
    remote: 'github',
    branch: 'gh-pages'
  });
});
