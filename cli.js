const fs = require('fs')
const path = require('path')

const [_year, _month, _day] = process.argv.slice(2).map(item => +item)

// fs.open can only open existing directory.

function createDirectory (path) {
  try {
    let stats = fs.statSync(path) // If the path does not exist, it will throw error.
    if (stats.isDirectory()) {
      console.error(path, 'already exists.')
    } else {
      console.error(path, 'exists and is not a directory.')
    }
  } catch (e) {
    fs.mkdirSync(path)
    console.log(path, 'created.')
  }
}

function createFile (path) {
  try {
    let stats = fs.statSync(path)
    if (stats.isFile()) {
      console.error(path, 'already exists.')
    } else {
      console.error(path, 'already exists and is not a file.')
    }
  } catch (e) {
    let file = fs.openSync(path, 'w')
    fs.writeSync(file, '---\nquestion: \ntags: \n---\n')
    fs.closeSync(file)
    console.log(path, 'created.')
  }
}

function createQuestion (year, month, day) {
  let date = formatDate(year, month, day)
  createDirectory(path.resolve('questions', date.y))
  createDirectory(path.resolve('questions', date.y, date.m))
  createFile(path.resolve('questions', date.y, date.m, `${date.y}-${date.m}-${date.d}.md`))
}

function formatDate (year, month, day) {
  let y = '' + year
  let m = month < 10 ? '0' + month : '' + month
  let d = day < 10 ? '0' + day : '' + day
  return {y, m, d}
}

if (_year === 'today' || _year === undefined) {
  let now = new Date()
  let [year, month, day] = [now.getFullYear(), now.getMonth() + 1, now.getDate()]

  createQuestion(year, month, day)
} else if (/\d{4}/.test(_year) && /\d{1,2}/.test(_month) && /\d{1,2}/.test(_day)) {

  if (_month > 12 || _month < 1) {
    console.error('Invalid month.')
    process.abort()
  }
  let dayOfMonth = new Date(_year, _month, 0)
  if (+_day < 1 || +_day > dayOfMonth) {
    console.error('Invalid date.')
    process.abort()
  }

  createQuestion(_year, _month, _day)
} else {
  console.error('Wrong arguments for creating a question.')
  process.abort()
}

module.exports = {
  createQuestion
}
