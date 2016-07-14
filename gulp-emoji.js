'use strict'

const through = require('through2')
const gutil = require('gulp-util')
const PluginError = gutil.PluginError

const PLUGIN_NAME = 'gulp-emoji'

const path = require('path')
const fs = require('fs')
const Buffer = require('buffer').Buffer
const emojiData = require('./node_modules/node-emoji/lib/emojifile').data
const parsed = shortname2unicode(emojiData)
// const shortnamePattern = /:([a-zA-Z0-9_\-\+]+):/g

function shortname2unicode (emoji) {
  let parsed = {}
  for (let key in emoji) {
    if (emoji.hasOwnProperty(key)) {
      let names = emoji[key][3]
      names = Array.isArray(names) ? names : [names]
      for (let name of names) { // :+1:, :-1:
        parsed[name] = key
      }
    }
  }
  return parsed
}

function replaceShortnameWithSVG (html, svgPath) {
  return html
    .split(':')
    .map(item => parsed[item]
      ? getSVG(path.resolve(svgPath, parsed[item] + '.svg'))
      : item
    )
    .join('')
}

function getSVG (svgPath) {
  return fs.readFileSync(svgPath).toString()
}

module.exports = function (imagePath) {
  if (!imagePath) {
    throw new PluginError(PLUGIN_NAME, 'Please specify an image path!')
  }

  return through.obj(function (file, enc, cb) {
    if (file.isNull()) {
      return cb(null, file)
    }

    if (file.isStream()) {
      throw new PluginError(PLUGIN_NAME, 'Streams are not supported now!')
    }

    file.contents = Buffer.from(replaceShortnameWithSVG(file.contents.toString(), imagePath))

    cb(null, file)
  })
}
