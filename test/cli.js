const assert = require('assert')
const fs = require('fs')
const cli = require('../cli')

describe('cli - createQuestion(year, month, day)', function () {
  after(function () {
    fs.unlinkSync('./questions/1899/01/1899-01-05.md')
    fs.rmdirSync('./questions/1899/01')
    fs.rmdirSync('./questions/1899')
  })

  it('should create a question', () => {
    cli.createQuestion(1899, 1, 5) // A date that would never be used
    let stats = fs.statSync('./questions/1899/01/1899-01-05.md')
    assert(stats.isFile(), 'it should create 2015-01-05.md')
  })
})
