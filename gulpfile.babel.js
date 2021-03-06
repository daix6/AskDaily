import gulp from 'gulp'
import gulpLoadPlugins from 'gulp-load-plugins'
import emoji from './lib/gulp-html-emojify'
import merge from 'merge-stream'
import del from 'del'

import browserify from 'browserify'
import source from 'vinyl-source-stream'
import buffer from 'vinyl-buffer'
import vueify from 'vueify'
import babelify from 'babelify'

import marked from 'marked'
import path from 'path'
import nodeDir from 'node-dir'
import frontMatter from 'front-matter'
import { promisify } from 'bluebird'

import _ from 'lodash'
import highlight from 'highlight.js'
import moment from 'moment'

import bs from 'browser-sync'
import ghPages from 'gh-pages'

const src = {
  root: './src',
  qs: './questions',
  index: './src/index.pug',
  archive: './src/archive.pug',
  templates: './src/templates',
  css: './src/css',
  js: './src/js',
  images: './public/images',
  components: './src/components',
  vueConfig: './vue.config.js'
}

const dest = {
  root: './dest',
  css: './dest/css',
  js: './dest/js',
  images: './dest/images'
}

const $ = gulpLoadPlugins()
const ls = promisify(nodeDir.files)
const lsContent = promisify(nodeDir.readFiles)

vueify.compiler.applyConfig(require(src.vueConfig))

const renderer = new marked.Renderer()

renderer.heading = function (text, level) {
  if (+level > 2) return `<h${level}>${text}</h${level}>`
  let escapedText = encodeURI(text.toLowerCase().replace(/\s/, '-'))
  return `<h${level} id="${escapedText}">${text}</h${level}>`
}

renderer.image = function (href, title, text) {
  return `<a href=${href}><img src=${href} alt=${text}></a>`
}

function styles () {
  let highlightCSS = ['tomorrow.css', 'tomorrow-night.css']
    .map((item) => './node_modules/highlight.js/styles/' + item)

  let code = gulp.src(highlightCSS)
    .pipe(gulp.dest(dest.css))

  let processors = [
    require('postcss-import'),
    require('cssnext')(),
    require('autoprefixer')({ browsers: ['last 5 versions'] }),
    require('cssnano')()
  ]

  let css = [`${src.css}/question.css`, `${src.css}/index.css`, `${src.css}/archive.css`]
  let normal = gulp.src(css)
    .pipe($.sourcemaps.init())
    .pipe($.postcss(processors))
      .on('error', (e) => console.log(e.stack))
    .pipe($.sourcemaps.write())
    .pipe(gulp.dest(dest.css))
    .pipe(bs.stream())

  return merge(code, normal)
}

function scripts () {
  return gulp.src(`${src.js}/**/*.js`)
    .pipe($.changed(dest.js, { extension: '.js' }))
    .pipe(gulp.dest(dest.js))
    .pipe(bs.stream())
}

function images () {
  return gulp.src(`${src.images}/**/*`)
    .pipe($.changed(dest.images))
    .pipe($.imagemin())
    .pipe(gulp.dest(dest.images))
    .pipe(bs.stream())
}

function calendar () {
  let b = browserify({
    entries: `${src.components}/calendar.js`,
    debug: true,
    transform: [babelify, vueify]
  })

  return b
    .bundle()
      .on('error', (e) => console.error(e))
    .pipe(source('calendar.js'))
    .pipe(buffer())
    .pipe(gulp.dest(dest.js))
    .pipe(bs.stream())
}

function index () {
  return gulp.src(src.index)
    .pipe($.data(ls(src.qs)
      .then(files => {
        let data = files.map((item) => path.basename(item, '.md')).join(',')
        return {data}
      }))
    )
    .pipe($.pug())
    .pipe(gulp.dest(dest.root))
    .pipe(bs.stream())
}

function archive () {
  let questions = []

  return gulp.src(src.archive)
    .pipe($.data(lsContent(src.qs, (err, content, filename, next) => {
      if (err) throw err
      let question = frontMatter(content).attributes.question
      let [, year, month, day] = filename.split('.')[0].split('\\')

      questions.push({
        day,
        question,
        range: moment(`${year}${month}`, 'YYYYMM').format('YYYY MMMM'),
        month: `${year}${month}`,
        link: `./${year}/${month}/${day}.html`
      })

      next()
    })
      .then(files => {
        let grouped = _.groupBy(questions, 'range')
        let data = []

        for (let key of Object.keys(grouped)) {
          data.push({ questions: _.orderBy(grouped[key], 'day', 'desc'), month: grouped[key][0].month })
        }

        return { data: _.orderBy(data, 'month', 'desc') }
      })
    ))
    .pipe($.pug())
    .pipe(gulp.dest(dest.root))
    .pipe(bs.stream())
}

function layoutQ (file) {
  let date = path.basename(file.path, '.html')
  let title = moment(date, 'YYYY-MM-DD').format('MMMM D, YYYY')

  let tags = file.frontMatter.tags.split(',').map(item => item.trim())
  file.frontMatter.tags = tags
  file.frontMatter.d3 = Boolean(file.frontMatter.d3)

  return _.assign(file.frontMatter, {
    layout: `${src.templates}/layout.pug`,
    title
  })
}

function md2html (layout) {
  let hl = (code) => highlight.highlightAuto(code).value

  return gulp.src(`${src.qs}/**/*.md`)
    .pipe($.if(!layout, $.changed(dest.root, { extension: '.html' })))
    .pipe($.frontMatter())
    .pipe($.markdown({ highlight: hl, renderer }))
    .pipe($.layout(layoutQ))
    .pipe(emoji())
    .pipe(gulp.dest(dest.root))
    .pipe(bs.stream())
}

const questions = () => md2html()
const questionsLayout = () => md2html(true)

const buildIndex = gulp.parallel(calendar, index, archive)
const buildQS = gulp.parallel(questions, styles, scripts, images)
const build = gulp.series(clean, gulp.parallel(buildIndex, buildQS))

function watch (done) {
  bs.init({
    server: {
      baseDir: dest.root
    }
  })

  gulp.watch(`${src.qs}/**/*.md`, questions)
  gulp.watch(`${src.templates}/layout.pug`, questionsLayout)
  gulp.watch(`${src.css}/**/*.css`, styles)
  gulp.watch(`${src.js}/**/*.js`, scripts)
  gulp.watch(`${src.images}/**/*`, images)
  gulp.watch([src.vueConfig, `${src.components}/*`], calendar)
  gulp.watch(src.index, index)
  gulp.watch(src.archive, archive)
  gulp.watch(`${dest.root}/**/*`).on('change', bs.reload)

  done()
}

function clean () {
  return del(`${dest.root}/*`, `!${dest.root}/20*`)
}

const push2ghPages = (done) => {
  return ghPages.publish(path.resolve(__dirname, dest.root), {
    remote: 'github',
    branch: 'gh-pages'
  }, () => done())
}

const serve = gulp.series(build, watch)
const deploy = gulp.series(build, push2ghPages)

export { build, serve, deploy }

export default build
