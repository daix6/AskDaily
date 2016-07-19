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

  // function removeEvent (ele, event, handler) {
  //   if (ele.removeEventListener) {
  //     ele.removeEventListener(event, handler, false)
  //   } else if (ele.detachEvent) {
  //     ele.detachEvent('on'+event, handler)
  //   } else {
  //     ele['on'+event] = handler
  //   }
  // }

  function getClass (ele) {
    return ele.getAttribute && ele.getAttribute('class') || ''
  }

  function hasClass (ele, classname) {
    return getClass(ele).indexOf(classname) >= 0
  }

  function addClass (ele, classname) {
    if (hasClass(ele, classname)) return

    ele.setAttribute('class', (' ' + getClass(ele) + ' ' + classname).trim())
  }

  function removeClass (ele, classname) {
    if (!hasClass(ele, classname)) return

    var reg = new RegExp('(\\s|^)' + classname + '(\\s|$)', 'g')
    ele.setAttribute('class', getClass(ele).replace(reg, ' ').trim())
  }

  function toggle (ele, on, off) {
    if (hasClass(ele, on)) {
      removeClass(ele, on)
      addClass(ele, off)
    } else {
      removeClass(ele, off)
      addClass(ele, on)
    }
  }

  function init () {
    var theme = d.getElementsByClassName('theme')[0]
    var highlight = d.getElementsByTagName('link')[0]

    addEvent(theme, 'click', function (e) {
      toggle(d.body, 'light', 'dark')

      if (hasClass(d.body, 'light')) {
        highlight.setAttribute('href', '../../css/tomorrow.css')
      } else if (hasClass(d.body, 'dark')) {
        highlight.setAttribute('href', '../../css/tomorrow-night.css')
      }
    })
  }

  window.onload = init
})(window, document, undefined)
