'use strict'

const through = require('through2')
const gutil = require('gulp-util')
const PluginError = gutil.PluginError

const PLUGIN_NAME = 'gulp-html-emojify'

const path = require('path')
const fs = require('fs')
const Buffer = require('buffer').Buffer
const emojiData = require('../node_modules/node-emoji/lib/emojifile').data
const parsed = shortname2unicode(emojiData)
// const shortnamePattern = /:([a-zA-Z0-9_\-\+]+):/g
const svgSrc = path.resolve(__dirname, 'svg');

function shortname2unicode (emoji) {
  var parsed = {}
  for (var key in emoji) {
    if (emoji.hasOwnProperty(key)) {
      let names = emoji[key][3]
      names = Array.isArray(names) ? names : [names]
      for (let name of names) {
        parsed[name] = key
      }
    }
  }
  return parsed
}

function replaceShortnameWithSVG (html, svgPath) {
  return html
    .split(':')
    .map((item, index, array) => parsed[item]
      ? getSVG(path.resolve(svgPath, parsed[item] + '.svg'))
      : (parsed[array[index + 1]] ? item : item + ':')
    )
    .join('')
}

function getSVG (svgPath) {
  return fs.readFileSync(svgPath).toString()
}

module.exports = function () {

  return through.obj(function (file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file)
    }

    if (file.isStream()) {
      throw new PluginError(PLUGIN_NAME, 'Streams are not supported now!')
    }

    if (file.isBuffer()) {
      try {
        file.contents = Buffer.from(replaceShortnameWithSVG(file.contents.toString(), svgSrc))
      } catch (e) {
        console.log(e.stack)
      }
    }

    cb(null, file)
  })
}
