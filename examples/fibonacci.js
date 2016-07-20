'use strict'

function nsTime (hrtime) {
  return hrtime[0] * 1e9 + hrtime[1]
}

class Fibonacci {
  constructor () {
    this.count = 0
  }

  v1 (n) {
    if (n < 0) throw Error('Wrong arguments')
    this.count++
    return n < 2 ? n : this.v1(n - 1) + this.v1(n - 2)
  }

  v2 (n) {
    function iter (cur, next, count) {
      if (count === 0) return cur
      this.count++
      return iter.call(this, next, cur + next, count - 1)
    }
    return iter.call(this, 0, 1, n)
  }

  v3 (n) {
    let memo = {}

    function f (count) {
      if (count < 0) throw Error('Wrong arguments')
      if (count in memo) return memo[count]
      else {
        this.count++
        let cache
        if (count < 2) cache = count
        else cache = f.call(this, count - 1) + f.call(this, count - 2)
        memo[count] = cache
        return cache
      }
    }

    return f.call(this, n)
  }

  v4 (n) {
    if (n < 0) throw Error('Wrong arguments')

    let cur = 0
    let next = 1
    while (n--) {
      this.count++
      [cur, next] = [next, cur + next]
    }

    return cur
  }

  runner (f, ...args) {
    console.log('Fibonacci: ', args[0])
    this.count = 0
    let start = process.hrtime()
    let result = f.apply(this, args)
    console.log(f.name, 'takes', nsTime(process.hrtime(start)), 'ns')
    console.log(f.name, 'caculates', this.count, 'times')
    console.log('Result:', result)
    console.log(process.memoryUsage())
  }
}

let foo = new Fibonacci()

foo.runner(foo.v1, 50)
foo.runner(foo.v2, 50)
foo.runner(foo.v3, 50)
foo.runner(foo.v4, 50)
foo.runner(foo.v2, 1000)
foo.runner(foo.v3, 1000)
foo.runner(foo.v4, 1000)
