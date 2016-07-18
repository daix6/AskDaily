(function (w, d, u) {
  'use strict'

  function addEvent (ele, event, handler) {
    if (ele.addEventListener) {
      ele.addEventListener(event, handler, false)
    } else if (ele.attachEvent) {
      ele.attachEvent('on' + event, handler)
    } else {
      ele['on' + event] = handler
    }
  }

  function toArray (arr) {
    return Array.from
      ? Array.from(arr)
      : Array.prototype.slice.call(arr)
  }

  function init () {
    var headers = toArray(d.getElementsByTagName('h2'))
      .concat(toArray(d.getElementsByTagName('h3')))

    headers.forEach(item => {
      addEvent(item, 'click', (e) => {
        w.location.hash = e.target.getAttribute('id')
      })
    })
  }

  window.onload = init
})(window, document, undefined)
