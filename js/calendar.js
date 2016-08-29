(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = function(opts) {
  return new ElementClass(opts)
}

function indexOf(arr, prop) {
  if (arr.indexOf) return arr.indexOf(prop)
  for (var i = 0, len = arr.length; i < len; i++)
    if (arr[i] === prop) return i
  return -1
}

function ElementClass(opts) {
  if (!(this instanceof ElementClass)) return new ElementClass(opts)
  var self = this
  if (!opts) opts = {}

  // similar doing instanceof HTMLElement but works in IE8
  if (opts.nodeType) opts = {el: opts}

  this.opts = opts
  this.el = opts.el || document.body
  if (typeof this.el !== 'object') this.el = document.querySelector(this.el)
}

ElementClass.prototype.add = function(className) {
  var el = this.el
  if (!el) return
  if (el.className === "") return el.className = className
  var classes = el.className.split(' ')
  if (indexOf(classes, className) > -1) return classes
  classes.push(className)
  el.className = classes.join(' ')
  return classes
}

ElementClass.prototype.remove = function(className) {
  var el = this.el
  if (!el) return
  if (el.className === "") return
  var classes = el.className.split(' ')
  var idx = indexOf(classes, className)
  if (idx > -1) classes.splice(idx, 1)
  el.className = classes.join(' ')
  return classes
}

ElementClass.prototype.has = function(className) {
  var el = this.el
  if (!el) return
  var classes = el.className.split(' ')
  return indexOf(classes, className) > -1
}

ElementClass.prototype.toggle = function(className) {
  var el = this.el
  if (!el) return
  if (this.has(className)) this.remove(className)
  else this.add(className)
}

},{}],2:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;

function cleanUpNextTick() {
    if (!draining || !currentQueue) {
        return;
    }
    draining = false;
    if (currentQueue.length) {
        queue = currentQueue.concat(queue);
    } else {
        queueIndex = -1;
    }
    if (queue.length) {
        drainQueue();
    }
}

function drainQueue() {
    if (draining) {
        return;
    }
    var timeout = setTimeout(cleanUpNextTick);
    draining = true;

    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        while (++queueIndex < len) {
            if (currentQueue) {
                currentQueue[queueIndex].run();
            }
        }
        queueIndex = -1;
        len = queue.length;
    }
    currentQueue = null;
    draining = false;
    clearTimeout(timeout);
}

process.nextTick = function (fun) {
    var args = new Array(arguments.length - 1);
    if (arguments.length > 1) {
        for (var i = 1; i < arguments.length; i++) {
            args[i - 1] = arguments[i];
        }
    }
    queue.push(new Item(fun, args));
    if (queue.length === 1 && !draining) {
        setTimeout(drainQueue, 0);
    }
};

// v8 likes predictible objects
function Item(fun, array) {
    this.fun = fun;
    this.array = array;
}
Item.prototype.run = function () {
    this.fun.apply(null, this.array);
};
process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues
process.versions = {};

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],3:[function(require,module,exports){
var Vue // late bind
var map = Object.create(null)
var shimmed = false
var isBrowserify = false

/**
 * Determine compatibility and apply patch.
 *
 * @param {Function} vue
 * @param {Boolean} browserify
 */

exports.install = function (vue, browserify) {
  if (shimmed) return
  shimmed = true

  Vue = vue
  isBrowserify = browserify

  exports.compatible = !!Vue.internalDirectives
  if (!exports.compatible) {
    console.warn(
      '[HMR] vue-loader hot reload is only compatible with ' +
      'Vue.js 1.0.0+.'
    )
    return
  }

  // patch view directive
  patchView(Vue.internalDirectives.component)
  console.log('[HMR] Vue component hot reload shim applied.')
  // shim router-view if present
  var routerView = Vue.elementDirective('router-view')
  if (routerView) {
    patchView(routerView)
    console.log('[HMR] vue-router <router-view> hot reload shim applied.')
  }
}

/**
 * Shim the view directive (component or router-view).
 *
 * @param {Object} View
 */

function patchView (View) {
  var unbuild = View.unbuild
  View.unbuild = function (defer) {
    if (!this.hotUpdating) {
      var prevComponent = this.childVM && this.childVM.constructor
      removeView(prevComponent, this)
      // defer = true means we are transitioning to a new
      // Component. Register this new component to the list.
      if (defer) {
        addView(this.Component, this)
      }
    }
    // call original
    return unbuild.call(this, defer)
  }
}

/**
 * Add a component view to a Component's hot list
 *
 * @param {Function} Component
 * @param {Directive} view - view directive instance
 */

function addView (Component, view) {
  var id = Component && Component.options.hotID
  if (id) {
    if (!map[id]) {
      map[id] = {
        Component: Component,
        views: [],
        instances: []
      }
    }
    map[id].views.push(view)
  }
}

/**
 * Remove a component view from a Component's hot list
 *
 * @param {Function} Component
 * @param {Directive} view - view directive instance
 */

function removeView (Component, view) {
  var id = Component && Component.options.hotID
  if (id) {
    map[id].views.$remove(view)
  }
}

/**
 * Create a record for a hot module, which keeps track of its construcotr,
 * instnaces and views (component directives or router-views).
 *
 * @param {String} id
 * @param {Object} options
 */

exports.createRecord = function (id, options) {
  if (typeof options === 'function') {
    options = options.options
  }
  if (typeof options.el !== 'string' && typeof options.data !== 'object') {
    makeOptionsHot(id, options)
    map[id] = {
      Component: null,
      views: [],
      instances: []
    }
  }
}

/**
 * Make a Component options object hot.
 *
 * @param {String} id
 * @param {Object} options
 */

function makeOptionsHot (id, options) {
  options.hotID = id
  injectHook(options, 'created', function () {
    var record = map[id]
    if (!record.Component) {
      record.Component = this.constructor
    }
    record.instances.push(this)
  })
  injectHook(options, 'beforeDestroy', function () {
    map[id].instances.$remove(this)
  })
}

/**
 * Inject a hook to a hot reloadable component so that
 * we can keep track of it.
 *
 * @param {Object} options
 * @param {String} name
 * @param {Function} hook
 */

function injectHook (options, name, hook) {
  var existing = options[name]
  options[name] = existing
    ? Array.isArray(existing)
      ? existing.concat(hook)
      : [existing, hook]
    : [hook]
}

/**
 * Update a hot component.
 *
 * @param {String} id
 * @param {Object|null} newOptions
 * @param {String|null} newTemplate
 */

exports.update = function (id, newOptions, newTemplate) {
  var record = map[id]
  // force full-reload if an instance of the component is active but is not
  // managed by a view
  if (!record || (record.instances.length && !record.views.length)) {
    console.log('[HMR] Root or manually-mounted instance modified. Full reload may be required.')
    if (!isBrowserify) {
      window.location.reload()
    } else {
      // browserify-hmr somehow sends incomplete bundle if we reload here
      return
    }
  }
  if (!isBrowserify) {
    // browserify-hmr already logs this
    console.log('[HMR] Updating component: ' + format(id))
  }
  var Component = record.Component
  // update constructor
  if (newOptions) {
    // in case the user exports a constructor
    Component = record.Component = typeof newOptions === 'function'
      ? newOptions
      : Vue.extend(newOptions)
    makeOptionsHot(id, Component.options)
  }
  if (newTemplate) {
    Component.options.template = newTemplate
  }
  // handle recursive lookup
  if (Component.options.name) {
    Component.options.components[Component.options.name] = Component
  }
  // reset constructor cached linker
  Component.linker = null
  // reload all views
  record.views.forEach(function (view) {
    updateView(view, Component)
  })
  // flush devtools
  if (window.__VUE_DEVTOOLS_GLOBAL_HOOK__) {
    window.__VUE_DEVTOOLS_GLOBAL_HOOK__.emit('flush')
  }
}

/**
 * Update a component view instance
 *
 * @param {Directive} view
 * @param {Function} Component
 */

function updateView (view, Component) {
  if (!view._bound) {
    return
  }
  view.Component = Component
  view.hotUpdating = true
  // disable transitions
  view.vm._isCompiled = false
  // save state
  var state = extractState(view.childVM)
  // remount, make sure to disable keep-alive
  var keepAlive = view.keepAlive
  view.keepAlive = false
  view.mountComponent()
  view.keepAlive = keepAlive
  // restore state
  restoreState(view.childVM, state, true)
  // re-eanble transitions
  view.vm._isCompiled = true
  view.hotUpdating = false
}

/**
 * Extract state from a Vue instance.
 *
 * @param {Vue} vm
 * @return {Object}
 */

function extractState (vm) {
  return {
    cid: vm.constructor.cid,
    data: vm.$data,
    children: vm.$children.map(extractState)
  }
}

/**
 * Restore state to a reloaded Vue instance.
 *
 * @param {Vue} vm
 * @param {Object} state
 */

function restoreState (vm, state, isRoot) {
  var oldAsyncConfig
  if (isRoot) {
    // set Vue into sync mode during state rehydration
    oldAsyncConfig = Vue.config.async
    Vue.config.async = false
  }
  // actual restore
  if (isRoot || !vm._props) {
    vm.$data = state.data
  } else {
    Object.keys(state.data).forEach(function (key) {
      if (!vm._props[key]) {
        // for non-root, only restore non-props fields
        vm.$data[key] = state.data[key]
      }
    })
  }
  // verify child consistency
  var hasSameChildren = vm.$children.every(function (c, i) {
    return state.children[i] && state.children[i].cid === c.constructor.cid
  })
  if (hasSameChildren) {
    // rehydrate children
    vm.$children.forEach(function (c, i) {
      restoreState(c, state.children[i])
    })
  }
  if (isRoot) {
    Vue.config.async = oldAsyncConfig
  }
}

function format (id) {
  return id.match(/[^\/]+\.vue$/)[0]
}

},{}],4:[function(require,module,exports){
(function (process,global){
/*!
 * Vue.js v1.0.24
 * (c) 2016 Evan You
 * Released under the MIT License.
 */
'use strict';

function set(obj, key, val) {
  if (hasOwn(obj, key)) {
    obj[key] = val;
    return;
  }
  if (obj._isVue) {
    set(obj._data, key, val);
    return;
  }
  var ob = obj.__ob__;
  if (!ob) {
    obj[key] = val;
    return;
  }
  ob.convert(key, val);
  ob.dep.notify();
  if (ob.vms) {
    var i = ob.vms.length;
    while (i--) {
      var vm = ob.vms[i];
      vm._proxy(key);
      vm._digest();
    }
  }
  return val;
}

/**
 * Delete a property and trigger change if necessary.
 *
 * @param {Object} obj
 * @param {String} key
 */

function del(obj, key) {
  if (!hasOwn(obj, key)) {
    return;
  }
  delete obj[key];
  var ob = obj.__ob__;
  if (!ob) {
    if (obj._isVue) {
      delete obj._data[key];
      obj._digest();
    }
    return;
  }
  ob.dep.notify();
  if (ob.vms) {
    var i = ob.vms.length;
    while (i--) {
      var vm = ob.vms[i];
      vm._unproxy(key);
      vm._digest();
    }
  }
}

var hasOwnProperty = Object.prototype.hasOwnProperty;
/**
 * Check whether the object has the property.
 *
 * @param {Object} obj
 * @param {String} key
 * @return {Boolean}
 */

function hasOwn(obj, key) {
  return hasOwnProperty.call(obj, key);
}

/**
 * Check if an expression is a literal value.
 *
 * @param {String} exp
 * @return {Boolean}
 */

var literalValueRE = /^\s?(true|false|-?[\d\.]+|'[^']*'|"[^"]*")\s?$/;

function isLiteral(exp) {
  return literalValueRE.test(exp);
}

/**
 * Check if a string starts with $ or _
 *
 * @param {String} str
 * @return {Boolean}
 */

function isReserved(str) {
  var c = (str + '').charCodeAt(0);
  return c === 0x24 || c === 0x5F;
}

/**
 * Guard text output, make sure undefined outputs
 * empty string
 *
 * @param {*} value
 * @return {String}
 */

function _toString(value) {
  return value == null ? '' : value.toString();
}

/**
 * Check and convert possible numeric strings to numbers
 * before setting back to data
 *
 * @param {*} value
 * @return {*|Number}
 */

function toNumber(value) {
  if (typeof value !== 'string') {
    return value;
  } else {
    var parsed = Number(value);
    return isNaN(parsed) ? value : parsed;
  }
}

/**
 * Convert string boolean literals into real booleans.
 *
 * @param {*} value
 * @return {*|Boolean}
 */

function toBoolean(value) {
  return value === 'true' ? true : value === 'false' ? false : value;
}

/**
 * Strip quotes from a string
 *
 * @param {String} str
 * @return {String | false}
 */

function stripQuotes(str) {
  var a = str.charCodeAt(0);
  var b = str.charCodeAt(str.length - 1);
  return a === b && (a === 0x22 || a === 0x27) ? str.slice(1, -1) : str;
}

/**
 * Camelize a hyphen-delmited string.
 *
 * @param {String} str
 * @return {String}
 */

var camelizeRE = /-(\w)/g;

function camelize(str) {
  return str.replace(camelizeRE, toUpper);
}

function toUpper(_, c) {
  return c ? c.toUpperCase() : '';
}

/**
 * Hyphenate a camelCase string.
 *
 * @param {String} str
 * @return {String}
 */

var hyphenateRE = /([a-z\d])([A-Z])/g;

function hyphenate(str) {
  return str.replace(hyphenateRE, '$1-$2').toLowerCase();
}

/**
 * Converts hyphen/underscore/slash delimitered names into
 * camelized classNames.
 *
 * e.g. my-component => MyComponent
 *      some_else    => SomeElse
 *      some/comp    => SomeComp
 *
 * @param {String} str
 * @return {String}
 */

var classifyRE = /(?:^|[-_\/])(\w)/g;

function classify(str) {
  return str.replace(classifyRE, toUpper);
}

/**
 * Simple bind, faster than native
 *
 * @param {Function} fn
 * @param {Object} ctx
 * @return {Function}
 */

function bind(fn, ctx) {
  return function (a) {
    var l = arguments.length;
    return l ? l > 1 ? fn.apply(ctx, arguments) : fn.call(ctx, a) : fn.call(ctx);
  };
}

/**
 * Convert an Array-like object to a real Array.
 *
 * @param {Array-like} list
 * @param {Number} [start] - start index
 * @return {Array}
 */

function toArray(list, start) {
  start = start || 0;
  var i = list.length - start;
  var ret = new Array(i);
  while (i--) {
    ret[i] = list[i + start];
  }
  return ret;
}

/**
 * Mix properties into target object.
 *
 * @param {Object} to
 * @param {Object} from
 */

function extend(to, from) {
  var keys = Object.keys(from);
  var i = keys.length;
  while (i--) {
    to[keys[i]] = from[keys[i]];
  }
  return to;
}

/**
 * Quick object check - this is primarily used to tell
 * Objects from primitive values when we know the value
 * is a JSON-compliant type.
 *
 * @param {*} obj
 * @return {Boolean}
 */

function isObject(obj) {
  return obj !== null && typeof obj === 'object';
}

/**
 * Strict object type check. Only returns true
 * for plain JavaScript objects.
 *
 * @param {*} obj
 * @return {Boolean}
 */

var toString = Object.prototype.toString;
var OBJECT_STRING = '[object Object]';

function isPlainObject(obj) {
  return toString.call(obj) === OBJECT_STRING;
}

/**
 * Array type check.
 *
 * @param {*} obj
 * @return {Boolean}
 */

var isArray = Array.isArray;

/**
 * Define a property.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 * @param {Boolean} [enumerable]
 */

function def(obj, key, val, enumerable) {
  Object.defineProperty(obj, key, {
    value: val,
    enumerable: !!enumerable,
    writable: true,
    configurable: true
  });
}

/**
 * Debounce a function so it only gets called after the
 * input stops arriving after the given wait period.
 *
 * @param {Function} func
 * @param {Number} wait
 * @return {Function} - the debounced function
 */

function _debounce(func, wait) {
  var timeout, args, context, timestamp, result;
  var later = function later() {
    var last = Date.now() - timestamp;
    if (last < wait && last >= 0) {
      timeout = setTimeout(later, wait - last);
    } else {
      timeout = null;
      result = func.apply(context, args);
      if (!timeout) context = args = null;
    }
  };
  return function () {
    context = this;
    args = arguments;
    timestamp = Date.now();
    if (!timeout) {
      timeout = setTimeout(later, wait);
    }
    return result;
  };
}

/**
 * Manual indexOf because it's slightly faster than
 * native.
 *
 * @param {Array} arr
 * @param {*} obj
 */

function indexOf(arr, obj) {
  var i = arr.length;
  while (i--) {
    if (arr[i] === obj) return i;
  }
  return -1;
}

/**
 * Make a cancellable version of an async callback.
 *
 * @param {Function} fn
 * @return {Function}
 */

function cancellable(fn) {
  var cb = function cb() {
    if (!cb.cancelled) {
      return fn.apply(this, arguments);
    }
  };
  cb.cancel = function () {
    cb.cancelled = true;
  };
  return cb;
}

/**
 * Check if two values are loosely equal - that is,
 * if they are plain objects, do they have the same shape?
 *
 * @param {*} a
 * @param {*} b
 * @return {Boolean}
 */

function looseEqual(a, b) {
  /* eslint-disable eqeqeq */
  return a == b || (isObject(a) && isObject(b) ? JSON.stringify(a) === JSON.stringify(b) : false);
  /* eslint-enable eqeqeq */
}

var hasProto = ('__proto__' in {});

// Browser environment sniffing
var inBrowser = typeof window !== 'undefined' && Object.prototype.toString.call(window) !== '[object Object]';

// detect devtools
var devtools = inBrowser && window.__VUE_DEVTOOLS_GLOBAL_HOOK__;

// UA sniffing for working around browser-specific quirks
var UA = inBrowser && window.navigator.userAgent.toLowerCase();
var isIE9 = UA && UA.indexOf('msie 9.0') > 0;
var isAndroid = UA && UA.indexOf('android') > 0;
var isIos = UA && /(iphone|ipad|ipod|ios)/i.test(UA);
var isWechat = UA && UA.indexOf('micromessenger') > 0;

var transitionProp = undefined;
var transitionEndEvent = undefined;
var animationProp = undefined;
var animationEndEvent = undefined;

// Transition property/event sniffing
if (inBrowser && !isIE9) {
  var isWebkitTrans = window.ontransitionend === undefined && window.onwebkittransitionend !== undefined;
  var isWebkitAnim = window.onanimationend === undefined && window.onwebkitanimationend !== undefined;
  transitionProp = isWebkitTrans ? 'WebkitTransition' : 'transition';
  transitionEndEvent = isWebkitTrans ? 'webkitTransitionEnd' : 'transitionend';
  animationProp = isWebkitAnim ? 'WebkitAnimation' : 'animation';
  animationEndEvent = isWebkitAnim ? 'webkitAnimationEnd' : 'animationend';
}

/**
 * Defer a task to execute it asynchronously. Ideally this
 * should be executed as a microtask, so we leverage
 * MutationObserver if it's available, and fallback to
 * setTimeout(0).
 *
 * @param {Function} cb
 * @param {Object} ctx
 */

var nextTick = (function () {
  var callbacks = [];
  var pending = false;
  var timerFunc;
  function nextTickHandler() {
    pending = false;
    var copies = callbacks.slice(0);
    callbacks = [];
    for (var i = 0; i < copies.length; i++) {
      copies[i]();
    }
  }

  /* istanbul ignore if */
  if (typeof MutationObserver !== 'undefined' && !(isWechat && isIos)) {
    var counter = 1;
    var observer = new MutationObserver(nextTickHandler);
    var textNode = document.createTextNode(counter);
    observer.observe(textNode, {
      characterData: true
    });
    timerFunc = function () {
      counter = (counter + 1) % 2;
      textNode.data = counter;
    };
  } else {
    // webpack attempts to inject a shim for setImmediate
    // if it is used as a global, so we have to work around that to
    // avoid bundling unnecessary code.
    var context = inBrowser ? window : typeof global !== 'undefined' ? global : {};
    timerFunc = context.setImmediate || setTimeout;
  }
  return function (cb, ctx) {
    var func = ctx ? function () {
      cb.call(ctx);
    } : cb;
    callbacks.push(func);
    if (pending) return;
    pending = true;
    timerFunc(nextTickHandler, 0);
  };
})();

var _Set = undefined;
/* istanbul ignore if */
if (typeof Set !== 'undefined' && Set.toString().match(/native code/)) {
  // use native Set when available.
  _Set = Set;
} else {
  // a non-standard Set polyfill that only works with primitive keys.
  _Set = function () {
    this.set = Object.create(null);
  };
  _Set.prototype.has = function (key) {
    return this.set[key] !== undefined;
  };
  _Set.prototype.add = function (key) {
    this.set[key] = 1;
  };
  _Set.prototype.clear = function () {
    this.set = Object.create(null);
  };
}

function Cache(limit) {
  this.size = 0;
  this.limit = limit;
  this.head = this.tail = undefined;
  this._keymap = Object.create(null);
}

var p = Cache.prototype;

/**
 * Put <value> into the cache associated with <key>.
 * Returns the entry which was removed to make room for
 * the new entry. Otherwise undefined is returned.
 * (i.e. if there was enough room already).
 *
 * @param {String} key
 * @param {*} value
 * @return {Entry|undefined}
 */

p.put = function (key, value) {
  var removed;
  if (this.size === this.limit) {
    removed = this.shift();
  }

  var entry = this.get(key, true);
  if (!entry) {
    entry = {
      key: key
    };
    this._keymap[key] = entry;
    if (this.tail) {
      this.tail.newer = entry;
      entry.older = this.tail;
    } else {
      this.head = entry;
    }
    this.tail = entry;
    this.size++;
  }
  entry.value = value;

  return removed;
};

/**
 * Purge the least recently used (oldest) entry from the
 * cache. Returns the removed entry or undefined if the
 * cache was empty.
 */

p.shift = function () {
  var entry = this.head;
  if (entry) {
    this.head = this.head.newer;
    this.head.older = undefined;
    entry.newer = entry.older = undefined;
    this._keymap[entry.key] = undefined;
    this.size--;
  }
  return entry;
};

/**
 * Get and register recent use of <key>. Returns the value
 * associated with <key> or undefined if not in cache.
 *
 * @param {String} key
 * @param {Boolean} returnEntry
 * @return {Entry|*}
 */

p.get = function (key, returnEntry) {
  var entry = this._keymap[key];
  if (entry === undefined) return;
  if (entry === this.tail) {
    return returnEntry ? entry : entry.value;
  }
  // HEAD--------------TAIL
  //   <.older   .newer>
  //  <--- add direction --
  //   A  B  C  <D>  E
  if (entry.newer) {
    if (entry === this.head) {
      this.head = entry.newer;
    }
    entry.newer.older = entry.older; // C <-- E.
  }
  if (entry.older) {
    entry.older.newer = entry.newer; // C. --> E
  }
  entry.newer = undefined; // D --x
  entry.older = this.tail; // D. --> E
  if (this.tail) {
    this.tail.newer = entry; // E. <-- D
  }
  this.tail = entry;
  return returnEntry ? entry : entry.value;
};

var cache$1 = new Cache(1000);
var filterTokenRE = /[^\s'"]+|'[^']*'|"[^"]*"/g;
var reservedArgRE = /^in$|^-?\d+/;

/**
 * Parser state
 */

var str;
var dir;
var c;
var prev;
var i;
var l;
var lastFilterIndex;
var inSingle;
var inDouble;
var curly;
var square;
var paren;
/**
 * Push a filter to the current directive object
 */

function pushFilter() {
  var exp = str.slice(lastFilterIndex, i).trim();
  var filter;
  if (exp) {
    filter = {};
    var tokens = exp.match(filterTokenRE);
    filter.name = tokens[0];
    if (tokens.length > 1) {
      filter.args = tokens.slice(1).map(processFilterArg);
    }
  }
  if (filter) {
    (dir.filters = dir.filters || []).push(filter);
  }
  lastFilterIndex = i + 1;
}

/**
 * Check if an argument is dynamic and strip quotes.
 *
 * @param {String} arg
 * @return {Object}
 */

function processFilterArg(arg) {
  if (reservedArgRE.test(arg)) {
    return {
      value: toNumber(arg),
      dynamic: false
    };
  } else {
    var stripped = stripQuotes(arg);
    var dynamic = stripped === arg;
    return {
      value: dynamic ? arg : stripped,
      dynamic: dynamic
    };
  }
}

/**
 * Parse a directive value and extract the expression
 * and its filters into a descriptor.
 *
 * Example:
 *
 * "a + 1 | uppercase" will yield:
 * {
 *   expression: 'a + 1',
 *   filters: [
 *     { name: 'uppercase', args: null }
 *   ]
 * }
 *
 * @param {String} s
 * @return {Object}
 */

function parseDirective(s) {
  var hit = cache$1.get(s);
  if (hit) {
    return hit;
  }

  // reset parser state
  str = s;
  inSingle = inDouble = false;
  curly = square = paren = 0;
  lastFilterIndex = 0;
  dir = {};

  for (i = 0, l = str.length; i < l; i++) {
    prev = c;
    c = str.charCodeAt(i);
    if (inSingle) {
      // check single quote
      if (c === 0x27 && prev !== 0x5C) inSingle = !inSingle;
    } else if (inDouble) {
      // check double quote
      if (c === 0x22 && prev !== 0x5C) inDouble = !inDouble;
    } else if (c === 0x7C && // pipe
    str.charCodeAt(i + 1) !== 0x7C && str.charCodeAt(i - 1) !== 0x7C) {
      if (dir.expression == null) {
        // first filter, end of expression
        lastFilterIndex = i + 1;
        dir.expression = str.slice(0, i).trim();
      } else {
        // already has filter
        pushFilter();
      }
    } else {
      switch (c) {
        case 0x22:
          inDouble = true;break; // "
        case 0x27:
          inSingle = true;break; // '
        case 0x28:
          paren++;break; // (
        case 0x29:
          paren--;break; // )
        case 0x5B:
          square++;break; // [
        case 0x5D:
          square--;break; // ]
        case 0x7B:
          curly++;break; // {
        case 0x7D:
          curly--;break; // }
      }
    }
  }

  if (dir.expression == null) {
    dir.expression = str.slice(0, i).trim();
  } else if (lastFilterIndex !== 0) {
    pushFilter();
  }

  cache$1.put(s, dir);
  return dir;
}

var directive = Object.freeze({
  parseDirective: parseDirective
});

var regexEscapeRE = /[-.*+?^${}()|[\]\/\\]/g;
var cache = undefined;
var tagRE = undefined;
var htmlRE = undefined;
/**
 * Escape a string so it can be used in a RegExp
 * constructor.
 *
 * @param {String} str
 */

function escapeRegex(str) {
  return str.replace(regexEscapeRE, '\\$&');
}

function compileRegex() {
  var open = escapeRegex(config.delimiters[0]);
  var close = escapeRegex(config.delimiters[1]);
  var unsafeOpen = escapeRegex(config.unsafeDelimiters[0]);
  var unsafeClose = escapeRegex(config.unsafeDelimiters[1]);
  tagRE = new RegExp(unsafeOpen + '((?:.|\\n)+?)' + unsafeClose + '|' + open + '((?:.|\\n)+?)' + close, 'g');
  htmlRE = new RegExp('^' + unsafeOpen + '.*' + unsafeClose + '$');
  // reset cache
  cache = new Cache(1000);
}

/**
 * Parse a template text string into an array of tokens.
 *
 * @param {String} text
 * @return {Array<Object> | null}
 *               - {String} type
 *               - {String} value
 *               - {Boolean} [html]
 *               - {Boolean} [oneTime]
 */

function parseText(text) {
  if (!cache) {
    compileRegex();
  }
  var hit = cache.get(text);
  if (hit) {
    return hit;
  }
  if (!tagRE.test(text)) {
    return null;
  }
  var tokens = [];
  var lastIndex = tagRE.lastIndex = 0;
  var match, index, html, value, first, oneTime;
  /* eslint-disable no-cond-assign */
  while (match = tagRE.exec(text)) {
    /* eslint-enable no-cond-assign */
    index = match.index;
    // push text token
    if (index > lastIndex) {
      tokens.push({
        value: text.slice(lastIndex, index)
      });
    }
    // tag token
    html = htmlRE.test(match[0]);
    value = html ? match[1] : match[2];
    first = value.charCodeAt(0);
    oneTime = first === 42; // *
    value = oneTime ? value.slice(1) : value;
    tokens.push({
      tag: true,
      value: value.trim(),
      html: html,
      oneTime: oneTime
    });
    lastIndex = index + match[0].length;
  }
  if (lastIndex < text.length) {
    tokens.push({
      value: text.slice(lastIndex)
    });
  }
  cache.put(text, tokens);
  return tokens;
}

/**
 * Format a list of tokens into an expression.
 * e.g. tokens parsed from 'a {{b}} c' can be serialized
 * into one single expression as '"a " + b + " c"'.
 *
 * @param {Array} tokens
 * @param {Vue} [vm]
 * @return {String}
 */

function tokensToExp(tokens, vm) {
  if (tokens.length > 1) {
    return tokens.map(function (token) {
      return formatToken(token, vm);
    }).join('+');
  } else {
    return formatToken(tokens[0], vm, true);
  }
}

/**
 * Format a single token.
 *
 * @param {Object} token
 * @param {Vue} [vm]
 * @param {Boolean} [single]
 * @return {String}
 */

function formatToken(token, vm, single) {
  return token.tag ? token.oneTime && vm ? '"' + vm.$eval(token.value) + '"' : inlineFilters(token.value, single) : '"' + token.value + '"';
}

/**
 * For an attribute with multiple interpolation tags,
 * e.g. attr="some-{{thing | filter}}", in order to combine
 * the whole thing into a single watchable expression, we
 * have to inline those filters. This function does exactly
 * that. This is a bit hacky but it avoids heavy changes
 * to directive parser and watcher mechanism.
 *
 * @param {String} exp
 * @param {Boolean} single
 * @return {String}
 */

var filterRE = /[^|]\|[^|]/;
function inlineFilters(exp, single) {
  if (!filterRE.test(exp)) {
    return single ? exp : '(' + exp + ')';
  } else {
    var dir = parseDirective(exp);
    if (!dir.filters) {
      return '(' + exp + ')';
    } else {
      return 'this._applyFilters(' + dir.expression + // value
      ',null,' + // oldValue (null for read)
      JSON.stringify(dir.filters) + // filter descriptors
      ',false)'; // write?
    }
  }
}

var text = Object.freeze({
  compileRegex: compileRegex,
  parseText: parseText,
  tokensToExp: tokensToExp
});

var delimiters = ['{{', '}}'];
var unsafeDelimiters = ['{{{', '}}}'];

var config = Object.defineProperties({

  /**
   * Whether to print debug messages.
   * Also enables stack trace for warnings.
   *
   * @type {Boolean}
   */

  debug: false,

  /**
   * Whether to suppress warnings.
   *
   * @type {Boolean}
   */

  silent: false,

  /**
   * Whether to use async rendering.
   */

  async: true,

  /**
   * Whether to warn against errors caught when evaluating
   * expressions.
   */

  warnExpressionErrors: true,

  /**
   * Whether to allow devtools inspection.
   * Disabled by default in production builds.
   */

  devtools: process.env.NODE_ENV !== 'production',

  /**
   * Internal flag to indicate the delimiters have been
   * changed.
   *
   * @type {Boolean}
   */

  _delimitersChanged: true,

  /**
   * List of asset types that a component can own.
   *
   * @type {Array}
   */

  _assetTypes: ['component', 'directive', 'elementDirective', 'filter', 'transition', 'partial'],

  /**
   * prop binding modes
   */

  _propBindingModes: {
    ONE_WAY: 0,
    TWO_WAY: 1,
    ONE_TIME: 2
  },

  /**
   * Max circular updates allowed in a batcher flush cycle.
   */

  _maxUpdateCount: 100

}, {
  delimiters: { /**
                 * Interpolation delimiters. Changing these would trigger
                 * the text parser to re-compile the regular expressions.
                 *
                 * @type {Array<String>}
                 */

    get: function get() {
      return delimiters;
    },
    set: function set(val) {
      delimiters = val;
      compileRegex();
    },
    configurable: true,
    enumerable: true
  },
  unsafeDelimiters: {
    get: function get() {
      return unsafeDelimiters;
    },
    set: function set(val) {
      unsafeDelimiters = val;
      compileRegex();
    },
    configurable: true,
    enumerable: true
  }
});

var warn = undefined;
var formatComponentName = undefined;

if (process.env.NODE_ENV !== 'production') {
  (function () {
    var hasConsole = typeof console !== 'undefined';

    warn = function (msg, vm) {
      if (hasConsole && !config.silent) {
        console.error('[Vue warn]: ' + msg + (vm ? formatComponentName(vm) : ''));
      }
    };

    formatComponentName = function (vm) {
      var name = vm._isVue ? vm.$options.name : vm.name;
      return name ? ' (found in component: <' + hyphenate(name) + '>)' : '';
    };
  })();
}

/**
 * Append with transition.
 *
 * @param {Element} el
 * @param {Element} target
 * @param {Vue} vm
 * @param {Function} [cb]
 */

function appendWithTransition(el, target, vm, cb) {
  applyTransition(el, 1, function () {
    target.appendChild(el);
  }, vm, cb);
}

/**
 * InsertBefore with transition.
 *
 * @param {Element} el
 * @param {Element} target
 * @param {Vue} vm
 * @param {Function} [cb]
 */

function beforeWithTransition(el, target, vm, cb) {
  applyTransition(el, 1, function () {
    before(el, target);
  }, vm, cb);
}

/**
 * Remove with transition.
 *
 * @param {Element} el
 * @param {Vue} vm
 * @param {Function} [cb]
 */

function removeWithTransition(el, vm, cb) {
  applyTransition(el, -1, function () {
    remove(el);
  }, vm, cb);
}

/**
 * Apply transitions with an operation callback.
 *
 * @param {Element} el
 * @param {Number} direction
 *                  1: enter
 *                 -1: leave
 * @param {Function} op - the actual DOM operation
 * @param {Vue} vm
 * @param {Function} [cb]
 */

function applyTransition(el, direction, op, vm, cb) {
  var transition = el.__v_trans;
  if (!transition ||
  // skip if there are no js hooks and CSS transition is
  // not supported
  !transition.hooks && !transitionEndEvent ||
  // skip transitions for initial compile
  !vm._isCompiled ||
  // if the vm is being manipulated by a parent directive
  // during the parent's compilation phase, skip the
  // animation.
  vm.$parent && !vm.$parent._isCompiled) {
    op();
    if (cb) cb();
    return;
  }
  var action = direction > 0 ? 'enter' : 'leave';
  transition[action](op, cb);
}

var transition = Object.freeze({
  appendWithTransition: appendWithTransition,
  beforeWithTransition: beforeWithTransition,
  removeWithTransition: removeWithTransition,
  applyTransition: applyTransition
});

/**
 * Query an element selector if it's not an element already.
 *
 * @param {String|Element} el
 * @return {Element}
 */

function query(el) {
  if (typeof el === 'string') {
    var selector = el;
    el = document.querySelector(el);
    if (!el) {
      process.env.NODE_ENV !== 'production' && warn('Cannot find element: ' + selector);
    }
  }
  return el;
}

/**
 * Check if a node is in the document.
 * Note: document.documentElement.contains should work here
 * but always returns false for comment nodes in phantomjs,
 * making unit tests difficult. This is fixed by doing the
 * contains() check on the node's parentNode instead of
 * the node itself.
 *
 * @param {Node} node
 * @return {Boolean}
 */

function inDoc(node) {
  if (!node) return false;
  var doc = node.ownerDocument.documentElement;
  var parent = node.parentNode;
  return doc === node || doc === parent || !!(parent && parent.nodeType === 1 && doc.contains(parent));
}

/**
 * Get and remove an attribute from a node.
 *
 * @param {Node} node
 * @param {String} _attr
 */

function getAttr(node, _attr) {
  var val = node.getAttribute(_attr);
  if (val !== null) {
    node.removeAttribute(_attr);
  }
  return val;
}

/**
 * Get an attribute with colon or v-bind: prefix.
 *
 * @param {Node} node
 * @param {String} name
 * @return {String|null}
 */

function getBindAttr(node, name) {
  var val = getAttr(node, ':' + name);
  if (val === null) {
    val = getAttr(node, 'v-bind:' + name);
  }
  return val;
}

/**
 * Check the presence of a bind attribute.
 *
 * @param {Node} node
 * @param {String} name
 * @return {Boolean}
 */

function hasBindAttr(node, name) {
  return node.hasAttribute(name) || node.hasAttribute(':' + name) || node.hasAttribute('v-bind:' + name);
}

/**
 * Insert el before target
 *
 * @param {Element} el
 * @param {Element} target
 */

function before(el, target) {
  target.parentNode.insertBefore(el, target);
}

/**
 * Insert el after target
 *
 * @param {Element} el
 * @param {Element} target
 */

function after(el, target) {
  if (target.nextSibling) {
    before(el, target.nextSibling);
  } else {
    target.parentNode.appendChild(el);
  }
}

/**
 * Remove el from DOM
 *
 * @param {Element} el
 */

function remove(el) {
  el.parentNode.removeChild(el);
}

/**
 * Prepend el to target
 *
 * @param {Element} el
 * @param {Element} target
 */

function prepend(el, target) {
  if (target.firstChild) {
    before(el, target.firstChild);
  } else {
    target.appendChild(el);
  }
}

/**
 * Replace target with el
 *
 * @param {Element} target
 * @param {Element} el
 */

function replace(target, el) {
  var parent = target.parentNode;
  if (parent) {
    parent.replaceChild(el, target);
  }
}

/**
 * Add event listener shorthand.
 *
 * @param {Element} el
 * @param {String} event
 * @param {Function} cb
 * @param {Boolean} [useCapture]
 */

function on(el, event, cb, useCapture) {
  el.addEventListener(event, cb, useCapture);
}

/**
 * Remove event listener shorthand.
 *
 * @param {Element} el
 * @param {String} event
 * @param {Function} cb
 */

function off(el, event, cb) {
  el.removeEventListener(event, cb);
}

/**
 * For IE9 compat: when both class and :class are present
 * getAttribute('class') returns wrong value...
 *
 * @param {Element} el
 * @return {String}
 */

function getClass(el) {
  var classname = el.className;
  if (typeof classname === 'object') {
    classname = classname.baseVal || '';
  }
  return classname;
}

/**
 * In IE9, setAttribute('class') will result in empty class
 * if the element also has the :class attribute; However in
 * PhantomJS, setting `className` does not work on SVG elements...
 * So we have to do a conditional check here.
 *
 * @param {Element} el
 * @param {String} cls
 */

function setClass(el, cls) {
  /* istanbul ignore if */
  if (isIE9 && !/svg$/.test(el.namespaceURI)) {
    el.className = cls;
  } else {
    el.setAttribute('class', cls);
  }
}

/**
 * Add class with compatibility for IE & SVG
 *
 * @param {Element} el
 * @param {String} cls
 */

function addClass(el, cls) {
  if (el.classList) {
    el.classList.add(cls);
  } else {
    var cur = ' ' + getClass(el) + ' ';
    if (cur.indexOf(' ' + cls + ' ') < 0) {
      setClass(el, (cur + cls).trim());
    }
  }
}

/**
 * Remove class with compatibility for IE & SVG
 *
 * @param {Element} el
 * @param {String} cls
 */

function removeClass(el, cls) {
  if (el.classList) {
    el.classList.remove(cls);
  } else {
    var cur = ' ' + getClass(el) + ' ';
    var tar = ' ' + cls + ' ';
    while (cur.indexOf(tar) >= 0) {
      cur = cur.replace(tar, ' ');
    }
    setClass(el, cur.trim());
  }
  if (!el.className) {
    el.removeAttribute('class');
  }
}

/**
 * Extract raw content inside an element into a temporary
 * container div
 *
 * @param {Element} el
 * @param {Boolean} asFragment
 * @return {Element|DocumentFragment}
 */

function extractContent(el, asFragment) {
  var child;
  var rawContent;
  /* istanbul ignore if */
  if (isTemplate(el) && isFragment(el.content)) {
    el = el.content;
  }
  if (el.hasChildNodes()) {
    trimNode(el);
    rawContent = asFragment ? document.createDocumentFragment() : document.createElement('div');
    /* eslint-disable no-cond-assign */
    while (child = el.firstChild) {
      /* eslint-enable no-cond-assign */
      rawContent.appendChild(child);
    }
  }
  return rawContent;
}

/**
 * Trim possible empty head/tail text and comment
 * nodes inside a parent.
 *
 * @param {Node} node
 */

function trimNode(node) {
  var child;
  /* eslint-disable no-sequences */
  while ((child = node.firstChild, isTrimmable(child))) {
    node.removeChild(child);
  }
  while ((child = node.lastChild, isTrimmable(child))) {
    node.removeChild(child);
  }
  /* eslint-enable no-sequences */
}

function isTrimmable(node) {
  return node && (node.nodeType === 3 && !node.data.trim() || node.nodeType === 8);
}

/**
 * Check if an element is a template tag.
 * Note if the template appears inside an SVG its tagName
 * will be in lowercase.
 *
 * @param {Element} el
 */

function isTemplate(el) {
  return el.tagName && el.tagName.toLowerCase() === 'template';
}

/**
 * Create an "anchor" for performing dom insertion/removals.
 * This is used in a number of scenarios:
 * - fragment instance
 * - v-html
 * - v-if
 * - v-for
 * - component
 *
 * @param {String} content
 * @param {Boolean} persist - IE trashes empty textNodes on
 *                            cloneNode(true), so in certain
 *                            cases the anchor needs to be
 *                            non-empty to be persisted in
 *                            templates.
 * @return {Comment|Text}
 */

function createAnchor(content, persist) {
  var anchor = config.debug ? document.createComment(content) : document.createTextNode(persist ? ' ' : '');
  anchor.__v_anchor = true;
  return anchor;
}

/**
 * Find a component ref attribute that starts with $.
 *
 * @param {Element} node
 * @return {String|undefined}
 */

var refRE = /^v-ref:/;

function findRef(node) {
  if (node.hasAttributes()) {
    var attrs = node.attributes;
    for (var i = 0, l = attrs.length; i < l; i++) {
      var name = attrs[i].name;
      if (refRE.test(name)) {
        return camelize(name.replace(refRE, ''));
      }
    }
  }
}

/**
 * Map a function to a range of nodes .
 *
 * @param {Node} node
 * @param {Node} end
 * @param {Function} op
 */

function mapNodeRange(node, end, op) {
  var next;
  while (node !== end) {
    next = node.nextSibling;
    op(node);
    node = next;
  }
  op(end);
}

/**
 * Remove a range of nodes with transition, store
 * the nodes in a fragment with correct ordering,
 * and call callback when done.
 *
 * @param {Node} start
 * @param {Node} end
 * @param {Vue} vm
 * @param {DocumentFragment} frag
 * @param {Function} cb
 */

function removeNodeRange(start, end, vm, frag, cb) {
  var done = false;
  var removed = 0;
  var nodes = [];
  mapNodeRange(start, end, function (node) {
    if (node === end) done = true;
    nodes.push(node);
    removeWithTransition(node, vm, onRemoved);
  });
  function onRemoved() {
    removed++;
    if (done && removed >= nodes.length) {
      for (var i = 0; i < nodes.length; i++) {
        frag.appendChild(nodes[i]);
      }
      cb && cb();
    }
  }
}

/**
 * Check if a node is a DocumentFragment.
 *
 * @param {Node} node
 * @return {Boolean}
 */

function isFragment(node) {
  return node && node.nodeType === 11;
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 *
 * @param {Element} el
 * @return {String}
 */

function getOuterHTML(el) {
  if (el.outerHTML) {
    return el.outerHTML;
  } else {
    var container = document.createElement('div');
    container.appendChild(el.cloneNode(true));
    return container.innerHTML;
  }
}

var commonTagRE = /^(div|p|span|img|a|b|i|br|ul|ol|li|h1|h2|h3|h4|h5|h6|code|pre|table|th|td|tr|form|label|input|select|option|nav|article|section|header|footer)$/i;
var reservedTagRE = /^(slot|partial|component)$/i;

var isUnknownElement = undefined;
if (process.env.NODE_ENV !== 'production') {
  isUnknownElement = function (el, tag) {
    if (tag.indexOf('-') > -1) {
      // http://stackoverflow.com/a/28210364/1070244
      return el.constructor === window.HTMLUnknownElement || el.constructor === window.HTMLElement;
    } else {
      return (/HTMLUnknownElement/.test(el.toString()) &&
        // Chrome returns unknown for several HTML5 elements.
        // https://code.google.com/p/chromium/issues/detail?id=540526
        !/^(data|time|rtc|rb)$/.test(tag)
      );
    }
  };
}

/**
 * Check if an element is a component, if yes return its
 * component id.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Object|undefined}
 */

function checkComponentAttr(el, options) {
  var tag = el.tagName.toLowerCase();
  var hasAttrs = el.hasAttributes();
  if (!commonTagRE.test(tag) && !reservedTagRE.test(tag)) {
    if (resolveAsset(options, 'components', tag)) {
      return { id: tag };
    } else {
      var is = hasAttrs && getIsBinding(el, options);
      if (is) {
        return is;
      } else if (process.env.NODE_ENV !== 'production') {
        var expectedTag = options._componentNameMap && options._componentNameMap[tag];
        if (expectedTag) {
          warn('Unknown custom element: <' + tag + '> - ' + 'did you mean <' + expectedTag + '>? ' + 'HTML is case-insensitive, remember to use kebab-case in templates.');
        } else if (isUnknownElement(el, tag)) {
          warn('Unknown custom element: <' + tag + '> - did you ' + 'register the component correctly? For recursive components, ' + 'make sure to provide the "name" option.');
        }
      }
    }
  } else if (hasAttrs) {
    return getIsBinding(el, options);
  }
}

/**
 * Get "is" binding from an element.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Object|undefined}
 */

function getIsBinding(el, options) {
  // dynamic syntax
  var exp = el.getAttribute('is');
  if (exp != null) {
    if (resolveAsset(options, 'components', exp)) {
      el.removeAttribute('is');
      return { id: exp };
    }
  } else {
    exp = getBindAttr(el, 'is');
    if (exp != null) {
      return { id: exp, dynamic: true };
    }
  }
}

/**
 * Option overwriting strategies are functions that handle
 * how to merge a parent option value and a child option
 * value into the final value.
 *
 * All strategy functions follow the same signature:
 *
 * @param {*} parentVal
 * @param {*} childVal
 * @param {Vue} [vm]
 */

var strats = config.optionMergeStrategies = Object.create(null);

/**
 * Helper that recursively merges two data objects together.
 */

function mergeData(to, from) {
  var key, toVal, fromVal;
  for (key in from) {
    toVal = to[key];
    fromVal = from[key];
    if (!hasOwn(to, key)) {
      set(to, key, fromVal);
    } else if (isObject(toVal) && isObject(fromVal)) {
      mergeData(toVal, fromVal);
    }
  }
  return to;
}

/**
 * Data
 */

strats.data = function (parentVal, childVal, vm) {
  if (!vm) {
    // in a Vue.extend merge, both should be functions
    if (!childVal) {
      return parentVal;
    }
    if (typeof childVal !== 'function') {
      process.env.NODE_ENV !== 'production' && warn('The "data" option should be a function ' + 'that returns a per-instance value in component ' + 'definitions.', vm);
      return parentVal;
    }
    if (!parentVal) {
      return childVal;
    }
    // when parentVal & childVal are both present,
    // we need to return a function that returns the
    // merged result of both functions... no need to
    // check if parentVal is a function here because
    // it has to be a function to pass previous merges.
    return function mergedDataFn() {
      return mergeData(childVal.call(this), parentVal.call(this));
    };
  } else if (parentVal || childVal) {
    return function mergedInstanceDataFn() {
      // instance merge
      var instanceData = typeof childVal === 'function' ? childVal.call(vm) : childVal;
      var defaultData = typeof parentVal === 'function' ? parentVal.call(vm) : undefined;
      if (instanceData) {
        return mergeData(instanceData, defaultData);
      } else {
        return defaultData;
      }
    };
  }
};

/**
 * El
 */

strats.el = function (parentVal, childVal, vm) {
  if (!vm && childVal && typeof childVal !== 'function') {
    process.env.NODE_ENV !== 'production' && warn('The "el" option should be a function ' + 'that returns a per-instance value in component ' + 'definitions.', vm);
    return;
  }
  var ret = childVal || parentVal;
  // invoke the element factory if this is instance merge
  return vm && typeof ret === 'function' ? ret.call(vm) : ret;
};

/**
 * Hooks and param attributes are merged as arrays.
 */

strats.init = strats.created = strats.ready = strats.attached = strats.detached = strats.beforeCompile = strats.compiled = strats.beforeDestroy = strats.destroyed = strats.activate = function (parentVal, childVal) {
  return childVal ? parentVal ? parentVal.concat(childVal) : isArray(childVal) ? childVal : [childVal] : parentVal;
};

/**
 * Assets
 *
 * When a vm is present (instance creation), we need to do
 * a three-way merge between constructor options, instance
 * options and parent options.
 */

function mergeAssets(parentVal, childVal) {
  var res = Object.create(parentVal || null);
  return childVal ? extend(res, guardArrayAssets(childVal)) : res;
}

config._assetTypes.forEach(function (type) {
  strats[type + 's'] = mergeAssets;
});

/**
 * Events & Watchers.
 *
 * Events & watchers hashes should not overwrite one
 * another, so we merge them as arrays.
 */

strats.watch = strats.events = function (parentVal, childVal) {
  if (!childVal) return parentVal;
  if (!parentVal) return childVal;
  var ret = {};
  extend(ret, parentVal);
  for (var key in childVal) {
    var parent = ret[key];
    var child = childVal[key];
    if (parent && !isArray(parent)) {
      parent = [parent];
    }
    ret[key] = parent ? parent.concat(child) : [child];
  }
  return ret;
};

/**
 * Other object hashes.
 */

strats.props = strats.methods = strats.computed = function (parentVal, childVal) {
  if (!childVal) return parentVal;
  if (!parentVal) return childVal;
  var ret = Object.create(null);
  extend(ret, parentVal);
  extend(ret, childVal);
  return ret;
};

/**
 * Default strategy.
 */

var defaultStrat = function defaultStrat(parentVal, childVal) {
  return childVal === undefined ? parentVal : childVal;
};

/**
 * Make sure component options get converted to actual
 * constructors.
 *
 * @param {Object} options
 */

function guardComponents(options) {
  if (options.components) {
    var components = options.components = guardArrayAssets(options.components);
    var ids = Object.keys(components);
    var def;
    if (process.env.NODE_ENV !== 'production') {
      var map = options._componentNameMap = {};
    }
    for (var i = 0, l = ids.length; i < l; i++) {
      var key = ids[i];
      if (commonTagRE.test(key) || reservedTagRE.test(key)) {
        process.env.NODE_ENV !== 'production' && warn('Do not use built-in or reserved HTML elements as component ' + 'id: ' + key);
        continue;
      }
      // record a all lowercase <-> kebab-case mapping for
      // possible custom element case error warning
      if (process.env.NODE_ENV !== 'production') {
        map[key.replace(/-/g, '').toLowerCase()] = hyphenate(key);
      }
      def = components[key];
      if (isPlainObject(def)) {
        components[key] = Vue.extend(def);
      }
    }
  }
}

/**
 * Ensure all props option syntax are normalized into the
 * Object-based format.
 *
 * @param {Object} options
 */

function guardProps(options) {
  var props = options.props;
  var i, val;
  if (isArray(props)) {
    options.props = {};
    i = props.length;
    while (i--) {
      val = props[i];
      if (typeof val === 'string') {
        options.props[val] = null;
      } else if (val.name) {
        options.props[val.name] = val;
      }
    }
  } else if (isPlainObject(props)) {
    var keys = Object.keys(props);
    i = keys.length;
    while (i--) {
      val = props[keys[i]];
      if (typeof val === 'function') {
        props[keys[i]] = { type: val };
      }
    }
  }
}

/**
 * Guard an Array-format assets option and converted it
 * into the key-value Object format.
 *
 * @param {Object|Array} assets
 * @return {Object}
 */

function guardArrayAssets(assets) {
  if (isArray(assets)) {
    var res = {};
    var i = assets.length;
    var asset;
    while (i--) {
      asset = assets[i];
      var id = typeof asset === 'function' ? asset.options && asset.options.name || asset.id : asset.name || asset.id;
      if (!id) {
        process.env.NODE_ENV !== 'production' && warn('Array-syntax assets must provide a "name" or "id" field.');
      } else {
        res[id] = asset;
      }
    }
    return res;
  }
  return assets;
}

/**
 * Merge two option objects into a new one.
 * Core utility used in both instantiation and inheritance.
 *
 * @param {Object} parent
 * @param {Object} child
 * @param {Vue} [vm] - if vm is present, indicates this is
 *                     an instantiation merge.
 */

function mergeOptions(parent, child, vm) {
  guardComponents(child);
  guardProps(child);
  if (process.env.NODE_ENV !== 'production') {
    if (child.propsData && !vm) {
      warn('propsData can only be used as an instantiation option.');
    }
  }
  var options = {};
  var key;
  if (child['extends']) {
    parent = typeof child['extends'] === 'function' ? mergeOptions(parent, child['extends'].options, vm) : mergeOptions(parent, child['extends'], vm);
  }
  if (child.mixins) {
    for (var i = 0, l = child.mixins.length; i < l; i++) {
      parent = mergeOptions(parent, child.mixins[i], vm);
    }
  }
  for (key in parent) {
    mergeField(key);
  }
  for (key in child) {
    if (!hasOwn(parent, key)) {
      mergeField(key);
    }
  }
  function mergeField(key) {
    var strat = strats[key] || defaultStrat;
    options[key] = strat(parent[key], child[key], vm, key);
  }
  return options;
}

/**
 * Resolve an asset.
 * This function is used because child instances need access
 * to assets defined in its ancestor chain.
 *
 * @param {Object} options
 * @param {String} type
 * @param {String} id
 * @param {Boolean} warnMissing
 * @return {Object|Function}
 */

function resolveAsset(options, type, id, warnMissing) {
  /* istanbul ignore if */
  if (typeof id !== 'string') {
    return;
  }
  var assets = options[type];
  var camelizedId;
  var res = assets[id] ||
  // camelCase ID
  assets[camelizedId = camelize(id)] ||
  // Pascal Case ID
  assets[camelizedId.charAt(0).toUpperCase() + camelizedId.slice(1)];
  if (process.env.NODE_ENV !== 'production' && warnMissing && !res) {
    warn('Failed to resolve ' + type.slice(0, -1) + ': ' + id, options);
  }
  return res;
}

var uid$1 = 0;

/**
 * A dep is an observable that can have multiple
 * directives subscribing to it.
 *
 * @constructor
 */
function Dep() {
  this.id = uid$1++;
  this.subs = [];
}

// the current target watcher being evaluated.
// this is globally unique because there could be only one
// watcher being evaluated at any time.
Dep.target = null;

/**
 * Add a directive subscriber.
 *
 * @param {Directive} sub
 */

Dep.prototype.addSub = function (sub) {
  this.subs.push(sub);
};

/**
 * Remove a directive subscriber.
 *
 * @param {Directive} sub
 */

Dep.prototype.removeSub = function (sub) {
  this.subs.$remove(sub);
};

/**
 * Add self as a dependency to the target watcher.
 */

Dep.prototype.depend = function () {
  Dep.target.addDep(this);
};

/**
 * Notify all subscribers of a new value.
 */

Dep.prototype.notify = function () {
  // stablize the subscriber list first
  var subs = toArray(this.subs);
  for (var i = 0, l = subs.length; i < l; i++) {
    subs[i].update();
  }
};

var arrayProto = Array.prototype;
var arrayMethods = Object.create(arrayProto)

/**
 * Intercept mutating methods and emit events
 */

;['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse'].forEach(function (method) {
  // cache original method
  var original = arrayProto[method];
  def(arrayMethods, method, function mutator() {
    // avoid leaking arguments:
    // http://jsperf.com/closure-with-arguments
    var i = arguments.length;
    var args = new Array(i);
    while (i--) {
      args[i] = arguments[i];
    }
    var result = original.apply(this, args);
    var ob = this.__ob__;
    var inserted;
    switch (method) {
      case 'push':
        inserted = args;
        break;
      case 'unshift':
        inserted = args;
        break;
      case 'splice':
        inserted = args.slice(2);
        break;
    }
    if (inserted) ob.observeArray(inserted);
    // notify change
    ob.dep.notify();
    return result;
  });
});

/**
 * Swap the element at the given index with a new value
 * and emits corresponding event.
 *
 * @param {Number} index
 * @param {*} val
 * @return {*} - replaced element
 */

def(arrayProto, '$set', function $set(index, val) {
  if (index >= this.length) {
    this.length = Number(index) + 1;
  }
  return this.splice(index, 1, val)[0];
});

/**
 * Convenience method to remove the element at given index or target element reference.
 *
 * @param {*} item
 */

def(arrayProto, '$remove', function $remove(item) {
  /* istanbul ignore if */
  if (!this.length) return;
  var index = indexOf(this, item);
  if (index > -1) {
    return this.splice(index, 1);
  }
});

var arrayKeys = Object.getOwnPropertyNames(arrayMethods);

/**
 * By default, when a reactive property is set, the new value is
 * also converted to become reactive. However in certain cases, e.g.
 * v-for scope alias and props, we don't want to force conversion
 * because the value may be a nested value under a frozen data structure.
 *
 * So whenever we want to set a reactive property without forcing
 * conversion on the new value, we wrap that call inside this function.
 */

var shouldConvert = true;

function withoutConversion(fn) {
  shouldConvert = false;
  fn();
  shouldConvert = true;
}

/**
 * Observer class that are attached to each observed
 * object. Once attached, the observer converts target
 * object's property keys into getter/setters that
 * collect dependencies and dispatches updates.
 *
 * @param {Array|Object} value
 * @constructor
 */

function Observer(value) {
  this.value = value;
  this.dep = new Dep();
  def(value, '__ob__', this);
  if (isArray(value)) {
    var augment = hasProto ? protoAugment : copyAugment;
    augment(value, arrayMethods, arrayKeys);
    this.observeArray(value);
  } else {
    this.walk(value);
  }
}

// Instance methods

/**
 * Walk through each property and convert them into
 * getter/setters. This method should only be called when
 * value type is Object.
 *
 * @param {Object} obj
 */

Observer.prototype.walk = function (obj) {
  var keys = Object.keys(obj);
  for (var i = 0, l = keys.length; i < l; i++) {
    this.convert(keys[i], obj[keys[i]]);
  }
};

/**
 * Observe a list of Array items.
 *
 * @param {Array} items
 */

Observer.prototype.observeArray = function (items) {
  for (var i = 0, l = items.length; i < l; i++) {
    observe(items[i]);
  }
};

/**
 * Convert a property into getter/setter so we can emit
 * the events when the property is accessed/changed.
 *
 * @param {String} key
 * @param {*} val
 */

Observer.prototype.convert = function (key, val) {
  defineReactive(this.value, key, val);
};

/**
 * Add an owner vm, so that when $set/$delete mutations
 * happen we can notify owner vms to proxy the keys and
 * digest the watchers. This is only called when the object
 * is observed as an instance's root $data.
 *
 * @param {Vue} vm
 */

Observer.prototype.addVm = function (vm) {
  (this.vms || (this.vms = [])).push(vm);
};

/**
 * Remove an owner vm. This is called when the object is
 * swapped out as an instance's $data object.
 *
 * @param {Vue} vm
 */

Observer.prototype.removeVm = function (vm) {
  this.vms.$remove(vm);
};

// helpers

/**
 * Augment an target Object or Array by intercepting
 * the prototype chain using __proto__
 *
 * @param {Object|Array} target
 * @param {Object} src
 */

function protoAugment(target, src) {
  /* eslint-disable no-proto */
  target.__proto__ = src;
  /* eslint-enable no-proto */
}

/**
 * Augment an target Object or Array by defining
 * hidden properties.
 *
 * @param {Object|Array} target
 * @param {Object} proto
 */

function copyAugment(target, src, keys) {
  for (var i = 0, l = keys.length; i < l; i++) {
    var key = keys[i];
    def(target, key, src[key]);
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 *
 * @param {*} value
 * @param {Vue} [vm]
 * @return {Observer|undefined}
 * @static
 */

function observe(value, vm) {
  if (!value || typeof value !== 'object') {
    return;
  }
  var ob;
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__;
  } else if (shouldConvert && (isArray(value) || isPlainObject(value)) && Object.isExtensible(value) && !value._isVue) {
    ob = new Observer(value);
  }
  if (ob && vm) {
    ob.addVm(vm);
  }
  return ob;
}

/**
 * Define a reactive property on an Object.
 *
 * @param {Object} obj
 * @param {String} key
 * @param {*} val
 */

function defineReactive(obj, key, val) {
  var dep = new Dep();

  var property = Object.getOwnPropertyDescriptor(obj, key);
  if (property && property.configurable === false) {
    return;
  }

  // cater for pre-defined getter/setters
  var getter = property && property.get;
  var setter = property && property.set;

  var childOb = observe(val);
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    get: function reactiveGetter() {
      var value = getter ? getter.call(obj) : val;
      if (Dep.target) {
        dep.depend();
        if (childOb) {
          childOb.dep.depend();
        }
        if (isArray(value)) {
          for (var e, i = 0, l = value.length; i < l; i++) {
            e = value[i];
            e && e.__ob__ && e.__ob__.dep.depend();
          }
        }
      }
      return value;
    },
    set: function reactiveSetter(newVal) {
      var value = getter ? getter.call(obj) : val;
      if (newVal === value) {
        return;
      }
      if (setter) {
        setter.call(obj, newVal);
      } else {
        val = newVal;
      }
      childOb = observe(newVal);
      dep.notify();
    }
  });
}



var util = Object.freeze({
	defineReactive: defineReactive,
	set: set,
	del: del,
	hasOwn: hasOwn,
	isLiteral: isLiteral,
	isReserved: isReserved,
	_toString: _toString,
	toNumber: toNumber,
	toBoolean: toBoolean,
	stripQuotes: stripQuotes,
	camelize: camelize,
	hyphenate: hyphenate,
	classify: classify,
	bind: bind,
	toArray: toArray,
	extend: extend,
	isObject: isObject,
	isPlainObject: isPlainObject,
	def: def,
	debounce: _debounce,
	indexOf: indexOf,
	cancellable: cancellable,
	looseEqual: looseEqual,
	isArray: isArray,
	hasProto: hasProto,
	inBrowser: inBrowser,
	devtools: devtools,
	isIE9: isIE9,
	isAndroid: isAndroid,
	isIos: isIos,
	isWechat: isWechat,
	get transitionProp () { return transitionProp; },
	get transitionEndEvent () { return transitionEndEvent; },
	get animationProp () { return animationProp; },
	get animationEndEvent () { return animationEndEvent; },
	nextTick: nextTick,
	get _Set () { return _Set; },
	query: query,
	inDoc: inDoc,
	getAttr: getAttr,
	getBindAttr: getBindAttr,
	hasBindAttr: hasBindAttr,
	before: before,
	after: after,
	remove: remove,
	prepend: prepend,
	replace: replace,
	on: on,
	off: off,
	setClass: setClass,
	addClass: addClass,
	removeClass: removeClass,
	extractContent: extractContent,
	trimNode: trimNode,
	isTemplate: isTemplate,
	createAnchor: createAnchor,
	findRef: findRef,
	mapNodeRange: mapNodeRange,
	removeNodeRange: removeNodeRange,
	isFragment: isFragment,
	getOuterHTML: getOuterHTML,
	mergeOptions: mergeOptions,
	resolveAsset: resolveAsset,
	checkComponentAttr: checkComponentAttr,
	commonTagRE: commonTagRE,
	reservedTagRE: reservedTagRE,
	get warn () { return warn; }
});

var uid = 0;

function initMixin (Vue) {
  /**
   * The main init sequence. This is called for every
   * instance, including ones that are created from extended
   * constructors.
   *
   * @param {Object} options - this options object should be
   *                           the result of merging class
   *                           options and the options passed
   *                           in to the constructor.
   */

  Vue.prototype._init = function (options) {
    options = options || {};

    this.$el = null;
    this.$parent = options.parent;
    this.$root = this.$parent ? this.$parent.$root : this;
    this.$children = [];
    this.$refs = {}; // child vm references
    this.$els = {}; // element references
    this._watchers = []; // all watchers as an array
    this._directives = []; // all directives

    // a uid
    this._uid = uid++;

    // a flag to avoid this being observed
    this._isVue = true;

    // events bookkeeping
    this._events = {}; // registered callbacks
    this._eventsCount = {}; // for $broadcast optimization

    // fragment instance properties
    this._isFragment = false;
    this._fragment = // @type {DocumentFragment}
    this._fragmentStart = // @type {Text|Comment}
    this._fragmentEnd = null; // @type {Text|Comment}

    // lifecycle state
    this._isCompiled = this._isDestroyed = this._isReady = this._isAttached = this._isBeingDestroyed = this._vForRemoving = false;
    this._unlinkFn = null;

    // context:
    // if this is a transcluded component, context
    // will be the common parent vm of this instance
    // and its host.
    this._context = options._context || this.$parent;

    // scope:
    // if this is inside an inline v-for, the scope
    // will be the intermediate scope created for this
    // repeat fragment. this is used for linking props
    // and container directives.
    this._scope = options._scope;

    // fragment:
    // if this instance is compiled inside a Fragment, it
    // needs to reigster itself as a child of that fragment
    // for attach/detach to work properly.
    this._frag = options._frag;
    if (this._frag) {
      this._frag.children.push(this);
    }

    // push self into parent / transclusion host
    if (this.$parent) {
      this.$parent.$children.push(this);
    }

    // merge options.
    options = this.$options = mergeOptions(this.constructor.options, options, this);

    // set ref
    this._updateRef();

    // initialize data as empty object.
    // it will be filled up in _initData().
    this._data = {};

    // call init hook
    this._callHook('init');

    // initialize data observation and scope inheritance.
    this._initState();

    // setup event system and option events.
    this._initEvents();

    // call created hook
    this._callHook('created');

    // if `el` option is passed, start compilation.
    if (options.el) {
      this.$mount(options.el);
    }
  };
}

var pathCache = new Cache(1000);

// actions
var APPEND = 0;
var PUSH = 1;
var INC_SUB_PATH_DEPTH = 2;
var PUSH_SUB_PATH = 3;

// states
var BEFORE_PATH = 0;
var IN_PATH = 1;
var BEFORE_IDENT = 2;
var IN_IDENT = 3;
var IN_SUB_PATH = 4;
var IN_SINGLE_QUOTE = 5;
var IN_DOUBLE_QUOTE = 6;
var AFTER_PATH = 7;
var ERROR = 8;

var pathStateMachine = [];

pathStateMachine[BEFORE_PATH] = {
  'ws': [BEFORE_PATH],
  'ident': [IN_IDENT, APPEND],
  '[': [IN_SUB_PATH],
  'eof': [AFTER_PATH]
};

pathStateMachine[IN_PATH] = {
  'ws': [IN_PATH],
  '.': [BEFORE_IDENT],
  '[': [IN_SUB_PATH],
  'eof': [AFTER_PATH]
};

pathStateMachine[BEFORE_IDENT] = {
  'ws': [BEFORE_IDENT],
  'ident': [IN_IDENT, APPEND]
};

pathStateMachine[IN_IDENT] = {
  'ident': [IN_IDENT, APPEND],
  '0': [IN_IDENT, APPEND],
  'number': [IN_IDENT, APPEND],
  'ws': [IN_PATH, PUSH],
  '.': [BEFORE_IDENT, PUSH],
  '[': [IN_SUB_PATH, PUSH],
  'eof': [AFTER_PATH, PUSH]
};

pathStateMachine[IN_SUB_PATH] = {
  "'": [IN_SINGLE_QUOTE, APPEND],
  '"': [IN_DOUBLE_QUOTE, APPEND],
  '[': [IN_SUB_PATH, INC_SUB_PATH_DEPTH],
  ']': [IN_PATH, PUSH_SUB_PATH],
  'eof': ERROR,
  'else': [IN_SUB_PATH, APPEND]
};

pathStateMachine[IN_SINGLE_QUOTE] = {
  "'": [IN_SUB_PATH, APPEND],
  'eof': ERROR,
  'else': [IN_SINGLE_QUOTE, APPEND]
};

pathStateMachine[IN_DOUBLE_QUOTE] = {
  '"': [IN_SUB_PATH, APPEND],
  'eof': ERROR,
  'else': [IN_DOUBLE_QUOTE, APPEND]
};

/**
 * Determine the type of a character in a keypath.
 *
 * @param {Char} ch
 * @return {String} type
 */

function getPathCharType(ch) {
  if (ch === undefined) {
    return 'eof';
  }

  var code = ch.charCodeAt(0);

  switch (code) {
    case 0x5B: // [
    case 0x5D: // ]
    case 0x2E: // .
    case 0x22: // "
    case 0x27: // '
    case 0x30:
      // 0
      return ch;

    case 0x5F: // _
    case 0x24:
      // $
      return 'ident';

    case 0x20: // Space
    case 0x09: // Tab
    case 0x0A: // Newline
    case 0x0D: // Return
    case 0xA0: // No-break space
    case 0xFEFF: // Byte Order Mark
    case 0x2028: // Line Separator
    case 0x2029:
      // Paragraph Separator
      return 'ws';
  }

  // a-z, A-Z
  if (code >= 0x61 && code <= 0x7A || code >= 0x41 && code <= 0x5A) {
    return 'ident';
  }

  // 1-9
  if (code >= 0x31 && code <= 0x39) {
    return 'number';
  }

  return 'else';
}

/**
 * Format a subPath, return its plain form if it is
 * a literal string or number. Otherwise prepend the
 * dynamic indicator (*).
 *
 * @param {String} path
 * @return {String}
 */

function formatSubPath(path) {
  var trimmed = path.trim();
  // invalid leading 0
  if (path.charAt(0) === '0' && isNaN(path)) {
    return false;
  }
  return isLiteral(trimmed) ? stripQuotes(trimmed) : '*' + trimmed;
}

/**
 * Parse a string path into an array of segments
 *
 * @param {String} path
 * @return {Array|undefined}
 */

function parse(path) {
  var keys = [];
  var index = -1;
  var mode = BEFORE_PATH;
  var subPathDepth = 0;
  var c, newChar, key, type, transition, action, typeMap;

  var actions = [];

  actions[PUSH] = function () {
    if (key !== undefined) {
      keys.push(key);
      key = undefined;
    }
  };

  actions[APPEND] = function () {
    if (key === undefined) {
      key = newChar;
    } else {
      key += newChar;
    }
  };

  actions[INC_SUB_PATH_DEPTH] = function () {
    actions[APPEND]();
    subPathDepth++;
  };

  actions[PUSH_SUB_PATH] = function () {
    if (subPathDepth > 0) {
      subPathDepth--;
      mode = IN_SUB_PATH;
      actions[APPEND]();
    } else {
      subPathDepth = 0;
      key = formatSubPath(key);
      if (key === false) {
        return false;
      } else {
        actions[PUSH]();
      }
    }
  };

  function maybeUnescapeQuote() {
    var nextChar = path[index + 1];
    if (mode === IN_SINGLE_QUOTE && nextChar === "'" || mode === IN_DOUBLE_QUOTE && nextChar === '"') {
      index++;
      newChar = '\\' + nextChar;
      actions[APPEND]();
      return true;
    }
  }

  while (mode != null) {
    index++;
    c = path[index];

    if (c === '\\' && maybeUnescapeQuote()) {
      continue;
    }

    type = getPathCharType(c);
    typeMap = pathStateMachine[mode];
    transition = typeMap[type] || typeMap['else'] || ERROR;

    if (transition === ERROR) {
      return; // parse error
    }

    mode = transition[0];
    action = actions[transition[1]];
    if (action) {
      newChar = transition[2];
      newChar = newChar === undefined ? c : newChar;
      if (action() === false) {
        return;
      }
    }

    if (mode === AFTER_PATH) {
      keys.raw = path;
      return keys;
    }
  }
}

/**
 * External parse that check for a cache hit first
 *
 * @param {String} path
 * @return {Array|undefined}
 */

function parsePath(path) {
  var hit = pathCache.get(path);
  if (!hit) {
    hit = parse(path);
    if (hit) {
      pathCache.put(path, hit);
    }
  }
  return hit;
}

/**
 * Get from an object from a path string
 *
 * @param {Object} obj
 * @param {String} path
 */

function getPath(obj, path) {
  return parseExpression(path).get(obj);
}

/**
 * Warn against setting non-existent root path on a vm.
 */

var warnNonExistent;
if (process.env.NODE_ENV !== 'production') {
  warnNonExistent = function (path, vm) {
    warn('You are setting a non-existent path "' + path.raw + '" ' + 'on a vm instance. Consider pre-initializing the property ' + 'with the "data" option for more reliable reactivity ' + 'and better performance.', vm);
  };
}

/**
 * Set on an object from a path
 *
 * @param {Object} obj
 * @param {String | Array} path
 * @param {*} val
 */

function setPath(obj, path, val) {
  var original = obj;
  if (typeof path === 'string') {
    path = parse(path);
  }
  if (!path || !isObject(obj)) {
    return false;
  }
  var last, key;
  for (var i = 0, l = path.length; i < l; i++) {
    last = obj;
    key = path[i];
    if (key.charAt(0) === '*') {
      key = parseExpression(key.slice(1)).get.call(original, original);
    }
    if (i < l - 1) {
      obj = obj[key];
      if (!isObject(obj)) {
        obj = {};
        if (process.env.NODE_ENV !== 'production' && last._isVue) {
          warnNonExistent(path, last);
        }
        set(last, key, obj);
      }
    } else {
      if (isArray(obj)) {
        obj.$set(key, val);
      } else if (key in obj) {
        obj[key] = val;
      } else {
        if (process.env.NODE_ENV !== 'production' && obj._isVue) {
          warnNonExistent(path, obj);
        }
        set(obj, key, val);
      }
    }
  }
  return true;
}

var path = Object.freeze({
  parsePath: parsePath,
  getPath: getPath,
  setPath: setPath
});

var expressionCache = new Cache(1000);

var allowedKeywords = 'Math,Date,this,true,false,null,undefined,Infinity,NaN,' + 'isNaN,isFinite,decodeURI,decodeURIComponent,encodeURI,' + 'encodeURIComponent,parseInt,parseFloat';
var allowedKeywordsRE = new RegExp('^(' + allowedKeywords.replace(/,/g, '\\b|') + '\\b)');

// keywords that don't make sense inside expressions
var improperKeywords = 'break,case,class,catch,const,continue,debugger,default,' + 'delete,do,else,export,extends,finally,for,function,if,' + 'import,in,instanceof,let,return,super,switch,throw,try,' + 'var,while,with,yield,enum,await,implements,package,' + 'protected,static,interface,private,public';
var improperKeywordsRE = new RegExp('^(' + improperKeywords.replace(/,/g, '\\b|') + '\\b)');

var wsRE = /\s/g;
var newlineRE = /\n/g;
var saveRE = /[\{,]\s*[\w\$_]+\s*:|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*\$\{|\}(?:[^`\\]|\\.)*`|`(?:[^`\\]|\\.)*`)|new |typeof |void /g;
var restoreRE = /"(\d+)"/g;
var pathTestRE = /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\['.*?'\]|\[".*?"\]|\[\d+\]|\[[A-Za-z_$][\w$]*\])*$/;
var identRE = /[^\w$\.](?:[A-Za-z_$][\w$]*)/g;
var booleanLiteralRE = /^(?:true|false)$/;

/**
 * Save / Rewrite / Restore
 *
 * When rewriting paths found in an expression, it is
 * possible for the same letter sequences to be found in
 * strings and Object literal property keys. Therefore we
 * remove and store these parts in a temporary array, and
 * restore them after the path rewrite.
 */

var saved = [];

/**
 * Save replacer
 *
 * The save regex can match two possible cases:
 * 1. An opening object literal
 * 2. A string
 * If matched as a plain string, we need to escape its
 * newlines, since the string needs to be preserved when
 * generating the function body.
 *
 * @param {String} str
 * @param {String} isString - str if matched as a string
 * @return {String} - placeholder with index
 */

function save(str, isString) {
  var i = saved.length;
  saved[i] = isString ? str.replace(newlineRE, '\\n') : str;
  return '"' + i + '"';
}

/**
 * Path rewrite replacer
 *
 * @param {String} raw
 * @return {String}
 */

function rewrite(raw) {
  var c = raw.charAt(0);
  var path = raw.slice(1);
  if (allowedKeywordsRE.test(path)) {
    return raw;
  } else {
    path = path.indexOf('"') > -1 ? path.replace(restoreRE, restore) : path;
    return c + 'scope.' + path;
  }
}

/**
 * Restore replacer
 *
 * @param {String} str
 * @param {String} i - matched save index
 * @return {String}
 */

function restore(str, i) {
  return saved[i];
}

/**
 * Rewrite an expression, prefixing all path accessors with
 * `scope.` and generate getter/setter functions.
 *
 * @param {String} exp
 * @return {Function}
 */

function compileGetter(exp) {
  if (improperKeywordsRE.test(exp)) {
    process.env.NODE_ENV !== 'production' && warn('Avoid using reserved keywords in expression: ' + exp);
  }
  // reset state
  saved.length = 0;
  // save strings and object literal keys
  var body = exp.replace(saveRE, save).replace(wsRE, '');
  // rewrite all paths
  // pad 1 space here becaue the regex matches 1 extra char
  body = (' ' + body).replace(identRE, rewrite).replace(restoreRE, restore);
  return makeGetterFn(body);
}

/**
 * Build a getter function. Requires eval.
 *
 * We isolate the try/catch so it doesn't affect the
 * optimization of the parse function when it is not called.
 *
 * @param {String} body
 * @return {Function|undefined}
 */

function makeGetterFn(body) {
  try {
    /* eslint-disable no-new-func */
    return new Function('scope', 'return ' + body + ';');
    /* eslint-enable no-new-func */
  } catch (e) {
    process.env.NODE_ENV !== 'production' && warn('Invalid expression. ' + 'Generated function body: ' + body);
  }
}

/**
 * Compile a setter function for the expression.
 *
 * @param {String} exp
 * @return {Function|undefined}
 */

function compileSetter(exp) {
  var path = parsePath(exp);
  if (path) {
    return function (scope, val) {
      setPath(scope, path, val);
    };
  } else {
    process.env.NODE_ENV !== 'production' && warn('Invalid setter expression: ' + exp);
  }
}

/**
 * Parse an expression into re-written getter/setters.
 *
 * @param {String} exp
 * @param {Boolean} needSet
 * @return {Function}
 */

function parseExpression(exp, needSet) {
  exp = exp.trim();
  // try cache
  var hit = expressionCache.get(exp);
  if (hit) {
    if (needSet && !hit.set) {
      hit.set = compileSetter(hit.exp);
    }
    return hit;
  }
  var res = { exp: exp };
  res.get = isSimplePath(exp) && exp.indexOf('[') < 0
  // optimized super simple getter
  ? makeGetterFn('scope.' + exp)
  // dynamic getter
  : compileGetter(exp);
  if (needSet) {
    res.set = compileSetter(exp);
  }
  expressionCache.put(exp, res);
  return res;
}

/**
 * Check if an expression is a simple path.
 *
 * @param {String} exp
 * @return {Boolean}
 */

function isSimplePath(exp) {
  return pathTestRE.test(exp) &&
  // don't treat true/false as paths
  !booleanLiteralRE.test(exp) &&
  // Math constants e.g. Math.PI, Math.E etc.
  exp.slice(0, 5) !== 'Math.';
}

var expression = Object.freeze({
  parseExpression: parseExpression,
  isSimplePath: isSimplePath
});

// we have two separate queues: one for directive updates
// and one for user watcher registered via $watch().
// we want to guarantee directive updates to be called
// before user watchers so that when user watchers are
// triggered, the DOM would have already been in updated
// state.

var queue = [];
var userQueue = [];
var has = {};
var circular = {};
var waiting = false;

/**
 * Reset the batcher's state.
 */

function resetBatcherState() {
  queue.length = 0;
  userQueue.length = 0;
  has = {};
  circular = {};
  waiting = false;
}

/**
 * Flush both queues and run the watchers.
 */

function flushBatcherQueue() {
  var _again = true;

  _function: while (_again) {
    _again = false;

    runBatcherQueue(queue);
    runBatcherQueue(userQueue);
    // user watchers triggered more watchers,
    // keep flushing until it depletes
    if (queue.length) {
      _again = true;
      continue _function;
    }
    // dev tool hook
    /* istanbul ignore if */
    if (devtools && config.devtools) {
      devtools.emit('flush');
    }
    resetBatcherState();
  }
}

/**
 * Run the watchers in a single queue.
 *
 * @param {Array} queue
 */

function runBatcherQueue(queue) {
  // do not cache length because more watchers might be pushed
  // as we run existing watchers
  for (var i = 0; i < queue.length; i++) {
    var watcher = queue[i];
    var id = watcher.id;
    has[id] = null;
    watcher.run();
    // in dev build, check and stop circular updates.
    if (process.env.NODE_ENV !== 'production' && has[id] != null) {
      circular[id] = (circular[id] || 0) + 1;
      if (circular[id] > config._maxUpdateCount) {
        warn('You may have an infinite update loop for watcher ' + 'with expression "' + watcher.expression + '"', watcher.vm);
        break;
      }
    }
  }
  queue.length = 0;
}

/**
 * Push a watcher into the watcher queue.
 * Jobs with duplicate IDs will be skipped unless it's
 * pushed when the queue is being flushed.
 *
 * @param {Watcher} watcher
 *   properties:
 *   - {Number} id
 *   - {Function} run
 */

function pushWatcher(watcher) {
  var id = watcher.id;
  if (has[id] == null) {
    // push watcher into appropriate queue
    var q = watcher.user ? userQueue : queue;
    has[id] = q.length;
    q.push(watcher);
    // queue the flush
    if (!waiting) {
      waiting = true;
      nextTick(flushBatcherQueue);
    }
  }
}

var uid$2 = 0;

/**
 * A watcher parses an expression, collects dependencies,
 * and fires callback when the expression value changes.
 * This is used for both the $watch() api and directives.
 *
 * @param {Vue} vm
 * @param {String|Function} expOrFn
 * @param {Function} cb
 * @param {Object} options
 *                 - {Array} filters
 *                 - {Boolean} twoWay
 *                 - {Boolean} deep
 *                 - {Boolean} user
 *                 - {Boolean} sync
 *                 - {Boolean} lazy
 *                 - {Function} [preProcess]
 *                 - {Function} [postProcess]
 * @constructor
 */
function Watcher(vm, expOrFn, cb, options) {
  // mix in options
  if (options) {
    extend(this, options);
  }
  var isFn = typeof expOrFn === 'function';
  this.vm = vm;
  vm._watchers.push(this);
  this.expression = expOrFn;
  this.cb = cb;
  this.id = ++uid$2; // uid for batching
  this.active = true;
  this.dirty = this.lazy; // for lazy watchers
  this.deps = [];
  this.newDeps = [];
  this.depIds = new _Set();
  this.newDepIds = new _Set();
  this.prevError = null; // for async error stacks
  // parse expression for getter/setter
  if (isFn) {
    this.getter = expOrFn;
    this.setter = undefined;
  } else {
    var res = parseExpression(expOrFn, this.twoWay);
    this.getter = res.get;
    this.setter = res.set;
  }
  this.value = this.lazy ? undefined : this.get();
  // state for avoiding false triggers for deep and Array
  // watchers during vm._digest()
  this.queued = this.shallow = false;
}

/**
 * Evaluate the getter, and re-collect dependencies.
 */

Watcher.prototype.get = function () {
  this.beforeGet();
  var scope = this.scope || this.vm;
  var value;
  try {
    value = this.getter.call(scope, scope);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production' && config.warnExpressionErrors) {
      warn('Error when evaluating expression ' + '"' + this.expression + '": ' + e.toString(), this.vm);
    }
  }
  // "touch" every property so they are all tracked as
  // dependencies for deep watching
  if (this.deep) {
    traverse(value);
  }
  if (this.preProcess) {
    value = this.preProcess(value);
  }
  if (this.filters) {
    value = scope._applyFilters(value, null, this.filters, false);
  }
  if (this.postProcess) {
    value = this.postProcess(value);
  }
  this.afterGet();
  return value;
};

/**
 * Set the corresponding value with the setter.
 *
 * @param {*} value
 */

Watcher.prototype.set = function (value) {
  var scope = this.scope || this.vm;
  if (this.filters) {
    value = scope._applyFilters(value, this.value, this.filters, true);
  }
  try {
    this.setter.call(scope, scope, value);
  } catch (e) {
    if (process.env.NODE_ENV !== 'production' && config.warnExpressionErrors) {
      warn('Error when evaluating setter ' + '"' + this.expression + '": ' + e.toString(), this.vm);
    }
  }
  // two-way sync for v-for alias
  var forContext = scope.$forContext;
  if (forContext && forContext.alias === this.expression) {
    if (forContext.filters) {
      process.env.NODE_ENV !== 'production' && warn('It seems you are using two-way binding on ' + 'a v-for alias (' + this.expression + '), and the ' + 'v-for has filters. This will not work properly. ' + 'Either remove the filters or use an array of ' + 'objects and bind to object properties instead.', this.vm);
      return;
    }
    forContext._withLock(function () {
      if (scope.$key) {
        // original is an object
        forContext.rawValue[scope.$key] = value;
      } else {
        forContext.rawValue.$set(scope.$index, value);
      }
    });
  }
};

/**
 * Prepare for dependency collection.
 */

Watcher.prototype.beforeGet = function () {
  Dep.target = this;
};

/**
 * Add a dependency to this directive.
 *
 * @param {Dep} dep
 */

Watcher.prototype.addDep = function (dep) {
  var id = dep.id;
  if (!this.newDepIds.has(id)) {
    this.newDepIds.add(id);
    this.newDeps.push(dep);
    if (!this.depIds.has(id)) {
      dep.addSub(this);
    }
  }
};

/**
 * Clean up for dependency collection.
 */

Watcher.prototype.afterGet = function () {
  Dep.target = null;
  var i = this.deps.length;
  while (i--) {
    var dep = this.deps[i];
    if (!this.newDepIds.has(dep.id)) {
      dep.removeSub(this);
    }
  }
  var tmp = this.depIds;
  this.depIds = this.newDepIds;
  this.newDepIds = tmp;
  this.newDepIds.clear();
  tmp = this.deps;
  this.deps = this.newDeps;
  this.newDeps = tmp;
  this.newDeps.length = 0;
};

/**
 * Subscriber interface.
 * Will be called when a dependency changes.
 *
 * @param {Boolean} shallow
 */

Watcher.prototype.update = function (shallow) {
  if (this.lazy) {
    this.dirty = true;
  } else if (this.sync || !config.async) {
    this.run();
  } else {
    // if queued, only overwrite shallow with non-shallow,
    // but not the other way around.
    this.shallow = this.queued ? shallow ? this.shallow : false : !!shallow;
    this.queued = true;
    // record before-push error stack in debug mode
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.debug) {
      this.prevError = new Error('[vue] async stack trace');
    }
    pushWatcher(this);
  }
};

/**
 * Batcher job interface.
 * Will be called by the batcher.
 */

Watcher.prototype.run = function () {
  if (this.active) {
    var value = this.get();
    if (value !== this.value ||
    // Deep watchers and watchers on Object/Arrays should fire even
    // when the value is the same, because the value may
    // have mutated; but only do so if this is a
    // non-shallow update (caused by a vm digest).
    (isObject(value) || this.deep) && !this.shallow) {
      // set new value
      var oldValue = this.value;
      this.value = value;
      // in debug + async mode, when a watcher callbacks
      // throws, we also throw the saved before-push error
      // so the full cross-tick stack trace is available.
      var prevError = this.prevError;
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.debug && prevError) {
        this.prevError = null;
        try {
          this.cb.call(this.vm, value, oldValue);
        } catch (e) {
          nextTick(function () {
            throw prevError;
          }, 0);
          throw e;
        }
      } else {
        this.cb.call(this.vm, value, oldValue);
      }
    }
    this.queued = this.shallow = false;
  }
};

/**
 * Evaluate the value of the watcher.
 * This only gets called for lazy watchers.
 */

Watcher.prototype.evaluate = function () {
  // avoid overwriting another watcher that is being
  // collected.
  var current = Dep.target;
  this.value = this.get();
  this.dirty = false;
  Dep.target = current;
};

/**
 * Depend on all deps collected by this watcher.
 */

Watcher.prototype.depend = function () {
  var i = this.deps.length;
  while (i--) {
    this.deps[i].depend();
  }
};

/**
 * Remove self from all dependencies' subcriber list.
 */

Watcher.prototype.teardown = function () {
  if (this.active) {
    // remove self from vm's watcher list
    // this is a somewhat expensive operation so we skip it
    // if the vm is being destroyed or is performing a v-for
    // re-render (the watcher list is then filtered by v-for).
    if (!this.vm._isBeingDestroyed && !this.vm._vForRemoving) {
      this.vm._watchers.$remove(this);
    }
    var i = this.deps.length;
    while (i--) {
      this.deps[i].removeSub(this);
    }
    this.active = false;
    this.vm = this.cb = this.value = null;
  }
};

/**
 * Recrusively traverse an object to evoke all converted
 * getters, so that every nested property inside the object
 * is collected as a "deep" dependency.
 *
 * @param {*} val
 */

var seenObjects = new _Set();
function traverse(val, seen) {
  var i = undefined,
      keys = undefined;
  if (!seen) {
    seen = seenObjects;
    seen.clear();
  }
  var isA = isArray(val);
  var isO = isObject(val);
  if (isA || isO) {
    if (val.__ob__) {
      var depId = val.__ob__.dep.id;
      if (seen.has(depId)) {
        return;
      } else {
        seen.add(depId);
      }
    }
    if (isA) {
      i = val.length;
      while (i--) traverse(val[i], seen);
    } else if (isO) {
      keys = Object.keys(val);
      i = keys.length;
      while (i--) traverse(val[keys[i]], seen);
    }
  }
}

var text$1 = {

  bind: function bind() {
    this.attr = this.el.nodeType === 3 ? 'data' : 'textContent';
  },

  update: function update(value) {
    this.el[this.attr] = _toString(value);
  }
};

var templateCache = new Cache(1000);
var idSelectorCache = new Cache(1000);

var map = {
  efault: [0, '', ''],
  legend: [1, '<fieldset>', '</fieldset>'],
  tr: [2, '<table><tbody>', '</tbody></table>'],
  col: [2, '<table><tbody></tbody><colgroup>', '</colgroup></table>']
};

map.td = map.th = [3, '<table><tbody><tr>', '</tr></tbody></table>'];

map.option = map.optgroup = [1, '<select multiple="multiple">', '</select>'];

map.thead = map.tbody = map.colgroup = map.caption = map.tfoot = [1, '<table>', '</table>'];

map.g = map.defs = map.symbol = map.use = map.image = map.text = map.circle = map.ellipse = map.line = map.path = map.polygon = map.polyline = map.rect = [1, '<svg ' + 'xmlns="http://www.w3.org/2000/svg" ' + 'xmlns:xlink="http://www.w3.org/1999/xlink" ' + 'xmlns:ev="http://www.w3.org/2001/xml-events"' + 'version="1.1">', '</svg>'];

/**
 * Check if a node is a supported template node with a
 * DocumentFragment content.
 *
 * @param {Node} node
 * @return {Boolean}
 */

function isRealTemplate(node) {
  return isTemplate(node) && isFragment(node.content);
}

var tagRE$1 = /<([\w:-]+)/;
var entityRE = /&#?\w+?;/;

/**
 * Convert a string template to a DocumentFragment.
 * Determines correct wrapping by tag types. Wrapping
 * strategy found in jQuery & component/domify.
 *
 * @param {String} templateString
 * @param {Boolean} raw
 * @return {DocumentFragment}
 */

function stringToFragment(templateString, raw) {
  // try a cache hit first
  var cacheKey = raw ? templateString : templateString.trim();
  var hit = templateCache.get(cacheKey);
  if (hit) {
    return hit;
  }

  var frag = document.createDocumentFragment();
  var tagMatch = templateString.match(tagRE$1);
  var entityMatch = entityRE.test(templateString);

  if (!tagMatch && !entityMatch) {
    // text only, return a single text node.
    frag.appendChild(document.createTextNode(templateString));
  } else {
    var tag = tagMatch && tagMatch[1];
    var wrap = map[tag] || map.efault;
    var depth = wrap[0];
    var prefix = wrap[1];
    var suffix = wrap[2];
    var node = document.createElement('div');

    node.innerHTML = prefix + templateString + suffix;
    while (depth--) {
      node = node.lastChild;
    }

    var child;
    /* eslint-disable no-cond-assign */
    while (child = node.firstChild) {
      /* eslint-enable no-cond-assign */
      frag.appendChild(child);
    }
  }
  if (!raw) {
    trimNode(frag);
  }
  templateCache.put(cacheKey, frag);
  return frag;
}

/**
 * Convert a template node to a DocumentFragment.
 *
 * @param {Node} node
 * @return {DocumentFragment}
 */

function nodeToFragment(node) {
  // if its a template tag and the browser supports it,
  // its content is already a document fragment. However, iOS Safari has
  // bug when using directly cloned template content with touch
  // events and can cause crashes when the nodes are removed from DOM, so we
  // have to treat template elements as string templates. (#2805)
  /* istanbul ignore if */
  if (isRealTemplate(node)) {
    return stringToFragment(node.innerHTML);
  }
  // script template
  if (node.tagName === 'SCRIPT') {
    return stringToFragment(node.textContent);
  }
  // normal node, clone it to avoid mutating the original
  var clonedNode = cloneNode(node);
  var frag = document.createDocumentFragment();
  var child;
  /* eslint-disable no-cond-assign */
  while (child = clonedNode.firstChild) {
    /* eslint-enable no-cond-assign */
    frag.appendChild(child);
  }
  trimNode(frag);
  return frag;
}

// Test for the presence of the Safari template cloning bug
// https://bugs.webkit.org/showug.cgi?id=137755
var hasBrokenTemplate = (function () {
  /* istanbul ignore else */
  if (inBrowser) {
    var a = document.createElement('div');
    a.innerHTML = '<template>1</template>';
    return !a.cloneNode(true).firstChild.innerHTML;
  } else {
    return false;
  }
})();

// Test for IE10/11 textarea placeholder clone bug
var hasTextareaCloneBug = (function () {
  /* istanbul ignore else */
  if (inBrowser) {
    var t = document.createElement('textarea');
    t.placeholder = 't';
    return t.cloneNode(true).value === 't';
  } else {
    return false;
  }
})();

/**
 * 1. Deal with Safari cloning nested <template> bug by
 *    manually cloning all template instances.
 * 2. Deal with IE10/11 textarea placeholder bug by setting
 *    the correct value after cloning.
 *
 * @param {Element|DocumentFragment} node
 * @return {Element|DocumentFragment}
 */

function cloneNode(node) {
  /* istanbul ignore if */
  if (!node.querySelectorAll) {
    return node.cloneNode();
  }
  var res = node.cloneNode(true);
  var i, original, cloned;
  /* istanbul ignore if */
  if (hasBrokenTemplate) {
    var tempClone = res;
    if (isRealTemplate(node)) {
      node = node.content;
      tempClone = res.content;
    }
    original = node.querySelectorAll('template');
    if (original.length) {
      cloned = tempClone.querySelectorAll('template');
      i = cloned.length;
      while (i--) {
        cloned[i].parentNode.replaceChild(cloneNode(original[i]), cloned[i]);
      }
    }
  }
  /* istanbul ignore if */
  if (hasTextareaCloneBug) {
    if (node.tagName === 'TEXTAREA') {
      res.value = node.value;
    } else {
      original = node.querySelectorAll('textarea');
      if (original.length) {
        cloned = res.querySelectorAll('textarea');
        i = cloned.length;
        while (i--) {
          cloned[i].value = original[i].value;
        }
      }
    }
  }
  return res;
}

/**
 * Process the template option and normalizes it into a
 * a DocumentFragment that can be used as a partial or a
 * instance template.
 *
 * @param {*} template
 *        Possible values include:
 *        - DocumentFragment object
 *        - Node object of type Template
 *        - id selector: '#some-template-id'
 *        - template string: '<div><span>{{msg}}</span></div>'
 * @param {Boolean} shouldClone
 * @param {Boolean} raw
 *        inline HTML interpolation. Do not check for id
 *        selector and keep whitespace in the string.
 * @return {DocumentFragment|undefined}
 */

function parseTemplate(template, shouldClone, raw) {
  var node, frag;

  // if the template is already a document fragment,
  // do nothing
  if (isFragment(template)) {
    trimNode(template);
    return shouldClone ? cloneNode(template) : template;
  }

  if (typeof template === 'string') {
    // id selector
    if (!raw && template.charAt(0) === '#') {
      // id selector can be cached too
      frag = idSelectorCache.get(template);
      if (!frag) {
        node = document.getElementById(template.slice(1));
        if (node) {
          frag = nodeToFragment(node);
          // save selector to cache
          idSelectorCache.put(template, frag);
        }
      }
    } else {
      // normal string template
      frag = stringToFragment(template, raw);
    }
  } else if (template.nodeType) {
    // a direct node
    frag = nodeToFragment(template);
  }

  return frag && shouldClone ? cloneNode(frag) : frag;
}

var template = Object.freeze({
  cloneNode: cloneNode,
  parseTemplate: parseTemplate
});

var html = {

  bind: function bind() {
    // a comment node means this is a binding for
    // {{{ inline unescaped html }}}
    if (this.el.nodeType === 8) {
      // hold nodes
      this.nodes = [];
      // replace the placeholder with proper anchor
      this.anchor = createAnchor('v-html');
      replace(this.el, this.anchor);
    }
  },

  update: function update(value) {
    value = _toString(value);
    if (this.nodes) {
      this.swap(value);
    } else {
      this.el.innerHTML = value;
    }
  },

  swap: function swap(value) {
    // remove old nodes
    var i = this.nodes.length;
    while (i--) {
      remove(this.nodes[i]);
    }
    // convert new value to a fragment
    // do not attempt to retrieve from id selector
    var frag = parseTemplate(value, true, true);
    // save a reference to these nodes so we can remove later
    this.nodes = toArray(frag.childNodes);
    before(frag, this.anchor);
  }
};

/**
 * Abstraction for a partially-compiled fragment.
 * Can optionally compile content with a child scope.
 *
 * @param {Function} linker
 * @param {Vue} vm
 * @param {DocumentFragment} frag
 * @param {Vue} [host]
 * @param {Object} [scope]
 * @param {Fragment} [parentFrag]
 */
function Fragment(linker, vm, frag, host, scope, parentFrag) {
  this.children = [];
  this.childFrags = [];
  this.vm = vm;
  this.scope = scope;
  this.inserted = false;
  this.parentFrag = parentFrag;
  if (parentFrag) {
    parentFrag.childFrags.push(this);
  }
  this.unlink = linker(vm, frag, host, scope, this);
  var single = this.single = frag.childNodes.length === 1 &&
  // do not go single mode if the only node is an anchor
  !frag.childNodes[0].__v_anchor;
  if (single) {
    this.node = frag.childNodes[0];
    this.before = singleBefore;
    this.remove = singleRemove;
  } else {
    this.node = createAnchor('fragment-start');
    this.end = createAnchor('fragment-end');
    this.frag = frag;
    prepend(this.node, frag);
    frag.appendChild(this.end);
    this.before = multiBefore;
    this.remove = multiRemove;
  }
  this.node.__v_frag = this;
}

/**
 * Call attach/detach for all components contained within
 * this fragment. Also do so recursively for all child
 * fragments.
 *
 * @param {Function} hook
 */

Fragment.prototype.callHook = function (hook) {
  var i, l;
  for (i = 0, l = this.childFrags.length; i < l; i++) {
    this.childFrags[i].callHook(hook);
  }
  for (i = 0, l = this.children.length; i < l; i++) {
    hook(this.children[i]);
  }
};

/**
 * Insert fragment before target, single node version
 *
 * @param {Node} target
 * @param {Boolean} withTransition
 */

function singleBefore(target, withTransition) {
  this.inserted = true;
  var method = withTransition !== false ? beforeWithTransition : before;
  method(this.node, target, this.vm);
  if (inDoc(this.node)) {
    this.callHook(attach);
  }
}

/**
 * Remove fragment, single node version
 */

function singleRemove() {
  this.inserted = false;
  var shouldCallRemove = inDoc(this.node);
  var self = this;
  this.beforeRemove();
  removeWithTransition(this.node, this.vm, function () {
    if (shouldCallRemove) {
      self.callHook(detach);
    }
    self.destroy();
  });
}

/**
 * Insert fragment before target, multi-nodes version
 *
 * @param {Node} target
 * @param {Boolean} withTransition
 */

function multiBefore(target, withTransition) {
  this.inserted = true;
  var vm = this.vm;
  var method = withTransition !== false ? beforeWithTransition : before;
  mapNodeRange(this.node, this.end, function (node) {
    method(node, target, vm);
  });
  if (inDoc(this.node)) {
    this.callHook(attach);
  }
}

/**
 * Remove fragment, multi-nodes version
 */

function multiRemove() {
  this.inserted = false;
  var self = this;
  var shouldCallRemove = inDoc(this.node);
  this.beforeRemove();
  removeNodeRange(this.node, this.end, this.vm, this.frag, function () {
    if (shouldCallRemove) {
      self.callHook(detach);
    }
    self.destroy();
  });
}

/**
 * Prepare the fragment for removal.
 */

Fragment.prototype.beforeRemove = function () {
  var i, l;
  for (i = 0, l = this.childFrags.length; i < l; i++) {
    // call the same method recursively on child
    // fragments, depth-first
    this.childFrags[i].beforeRemove(false);
  }
  for (i = 0, l = this.children.length; i < l; i++) {
    // Call destroy for all contained instances,
    // with remove:false and defer:true.
    // Defer is necessary because we need to
    // keep the children to call detach hooks
    // on them.
    this.children[i].$destroy(false, true);
  }
  var dirs = this.unlink.dirs;
  for (i = 0, l = dirs.length; i < l; i++) {
    // disable the watchers on all the directives
    // so that the rendered content stays the same
    // during removal.
    dirs[i]._watcher && dirs[i]._watcher.teardown();
  }
};

/**
 * Destroy the fragment.
 */

Fragment.prototype.destroy = function () {
  if (this.parentFrag) {
    this.parentFrag.childFrags.$remove(this);
  }
  this.node.__v_frag = null;
  this.unlink();
};

/**
 * Call attach hook for a Vue instance.
 *
 * @param {Vue} child
 */

function attach(child) {
  if (!child._isAttached && inDoc(child.$el)) {
    child._callHook('attached');
  }
}

/**
 * Call detach hook for a Vue instance.
 *
 * @param {Vue} child
 */

function detach(child) {
  if (child._isAttached && !inDoc(child.$el)) {
    child._callHook('detached');
  }
}

var linkerCache = new Cache(5000);

/**
 * A factory that can be used to create instances of a
 * fragment. Caches the compiled linker if possible.
 *
 * @param {Vue} vm
 * @param {Element|String} el
 */
function FragmentFactory(vm, el) {
  this.vm = vm;
  var template;
  var isString = typeof el === 'string';
  if (isString || isTemplate(el) && !el.hasAttribute('v-if')) {
    template = parseTemplate(el, true);
  } else {
    template = document.createDocumentFragment();
    template.appendChild(el);
  }
  this.template = template;
  // linker can be cached, but only for components
  var linker;
  var cid = vm.constructor.cid;
  if (cid > 0) {
    var cacheId = cid + (isString ? el : getOuterHTML(el));
    linker = linkerCache.get(cacheId);
    if (!linker) {
      linker = compile(template, vm.$options, true);
      linkerCache.put(cacheId, linker);
    }
  } else {
    linker = compile(template, vm.$options, true);
  }
  this.linker = linker;
}

/**
 * Create a fragment instance with given host and scope.
 *
 * @param {Vue} host
 * @param {Object} scope
 * @param {Fragment} parentFrag
 */

FragmentFactory.prototype.create = function (host, scope, parentFrag) {
  var frag = cloneNode(this.template);
  return new Fragment(this.linker, this.vm, frag, host, scope, parentFrag);
};

var ON = 700;
var MODEL = 800;
var BIND = 850;
var TRANSITION = 1100;
var EL = 1500;
var COMPONENT = 1500;
var PARTIAL = 1750;
var IF = 2100;
var FOR = 2200;
var SLOT = 2300;

var uid$3 = 0;

var vFor = {

  priority: FOR,
  terminal: true,

  params: ['track-by', 'stagger', 'enter-stagger', 'leave-stagger'],

  bind: function bind() {
    // support "item in/of items" syntax
    var inMatch = this.expression.match(/(.*) (?:in|of) (.*)/);
    if (inMatch) {
      var itMatch = inMatch[1].match(/\((.*),(.*)\)/);
      if (itMatch) {
        this.iterator = itMatch[1].trim();
        this.alias = itMatch[2].trim();
      } else {
        this.alias = inMatch[1].trim();
      }
      this.expression = inMatch[2];
    }

    if (!this.alias) {
      process.env.NODE_ENV !== 'production' && warn('Invalid v-for expression "' + this.descriptor.raw + '": ' + 'alias is required.', this.vm);
      return;
    }

    // uid as a cache identifier
    this.id = '__v-for__' + ++uid$3;

    // check if this is an option list,
    // so that we know if we need to update the <select>'s
    // v-model when the option list has changed.
    // because v-model has a lower priority than v-for,
    // the v-model is not bound here yet, so we have to
    // retrive it in the actual updateModel() function.
    var tag = this.el.tagName;
    this.isOption = (tag === 'OPTION' || tag === 'OPTGROUP') && this.el.parentNode.tagName === 'SELECT';

    // setup anchor nodes
    this.start = createAnchor('v-for-start');
    this.end = createAnchor('v-for-end');
    replace(this.el, this.end);
    before(this.start, this.end);

    // cache
    this.cache = Object.create(null);

    // fragment factory
    this.factory = new FragmentFactory(this.vm, this.el);
  },

  update: function update(data) {
    this.diff(data);
    this.updateRef();
    this.updateModel();
  },

  /**
   * Diff, based on new data and old data, determine the
   * minimum amount of DOM manipulations needed to make the
   * DOM reflect the new data Array.
   *
   * The algorithm diffs the new data Array by storing a
   * hidden reference to an owner vm instance on previously
   * seen data. This allows us to achieve O(n) which is
   * better than a levenshtein distance based algorithm,
   * which is O(m * n).
   *
   * @param {Array} data
   */

  diff: function diff(data) {
    // check if the Array was converted from an Object
    var item = data[0];
    var convertedFromObject = this.fromObject = isObject(item) && hasOwn(item, '$key') && hasOwn(item, '$value');

    var trackByKey = this.params.trackBy;
    var oldFrags = this.frags;
    var frags = this.frags = new Array(data.length);
    var alias = this.alias;
    var iterator = this.iterator;
    var start = this.start;
    var end = this.end;
    var inDocument = inDoc(start);
    var init = !oldFrags;
    var i, l, frag, key, value, primitive;

    // First pass, go through the new Array and fill up
    // the new frags array. If a piece of data has a cached
    // instance for it, we reuse it. Otherwise build a new
    // instance.
    for (i = 0, l = data.length; i < l; i++) {
      item = data[i];
      key = convertedFromObject ? item.$key : null;
      value = convertedFromObject ? item.$value : item;
      primitive = !isObject(value);
      frag = !init && this.getCachedFrag(value, i, key);
      if (frag) {
        // reusable fragment
        frag.reused = true;
        // update $index
        frag.scope.$index = i;
        // update $key
        if (key) {
          frag.scope.$key = key;
        }
        // update iterator
        if (iterator) {
          frag.scope[iterator] = key !== null ? key : i;
        }
        // update data for track-by, object repeat &
        // primitive values.
        if (trackByKey || convertedFromObject || primitive) {
          withoutConversion(function () {
            frag.scope[alias] = value;
          });
        }
      } else {
        // new isntance
        frag = this.create(value, alias, i, key);
        frag.fresh = !init;
      }
      frags[i] = frag;
      if (init) {
        frag.before(end);
      }
    }

    // we're done for the initial render.
    if (init) {
      return;
    }

    // Second pass, go through the old fragments and
    // destroy those who are not reused (and remove them
    // from cache)
    var removalIndex = 0;
    var totalRemoved = oldFrags.length - frags.length;
    // when removing a large number of fragments, watcher removal
    // turns out to be a perf bottleneck, so we batch the watcher
    // removals into a single filter call!
    this.vm._vForRemoving = true;
    for (i = 0, l = oldFrags.length; i < l; i++) {
      frag = oldFrags[i];
      if (!frag.reused) {
        this.deleteCachedFrag(frag);
        this.remove(frag, removalIndex++, totalRemoved, inDocument);
      }
    }
    this.vm._vForRemoving = false;
    if (removalIndex) {
      this.vm._watchers = this.vm._watchers.filter(function (w) {
        return w.active;
      });
    }

    // Final pass, move/insert new fragments into the
    // right place.
    var targetPrev, prevEl, currentPrev;
    var insertionIndex = 0;
    for (i = 0, l = frags.length; i < l; i++) {
      frag = frags[i];
      // this is the frag that we should be after
      targetPrev = frags[i - 1];
      prevEl = targetPrev ? targetPrev.staggerCb ? targetPrev.staggerAnchor : targetPrev.end || targetPrev.node : start;
      if (frag.reused && !frag.staggerCb) {
        currentPrev = findPrevFrag(frag, start, this.id);
        if (currentPrev !== targetPrev && (!currentPrev ||
        // optimization for moving a single item.
        // thanks to suggestions by @livoras in #1807
        findPrevFrag(currentPrev, start, this.id) !== targetPrev)) {
          this.move(frag, prevEl);
        }
      } else {
        // new instance, or still in stagger.
        // insert with updated stagger index.
        this.insert(frag, insertionIndex++, prevEl, inDocument);
      }
      frag.reused = frag.fresh = false;
    }
  },

  /**
   * Create a new fragment instance.
   *
   * @param {*} value
   * @param {String} alias
   * @param {Number} index
   * @param {String} [key]
   * @return {Fragment}
   */

  create: function create(value, alias, index, key) {
    var host = this._host;
    // create iteration scope
    var parentScope = this._scope || this.vm;
    var scope = Object.create(parentScope);
    // ref holder for the scope
    scope.$refs = Object.create(parentScope.$refs);
    scope.$els = Object.create(parentScope.$els);
    // make sure point $parent to parent scope
    scope.$parent = parentScope;
    // for two-way binding on alias
    scope.$forContext = this;
    // define scope properties
    // important: define the scope alias without forced conversion
    // so that frozen data structures remain non-reactive.
    withoutConversion(function () {
      defineReactive(scope, alias, value);
    });
    defineReactive(scope, '$index', index);
    if (key) {
      defineReactive(scope, '$key', key);
    } else if (scope.$key) {
      // avoid accidental fallback
      def(scope, '$key', null);
    }
    if (this.iterator) {
      defineReactive(scope, this.iterator, key !== null ? key : index);
    }
    var frag = this.factory.create(host, scope, this._frag);
    frag.forId = this.id;
    this.cacheFrag(value, frag, index, key);
    return frag;
  },

  /**
   * Update the v-ref on owner vm.
   */

  updateRef: function updateRef() {
    var ref = this.descriptor.ref;
    if (!ref) return;
    var hash = (this._scope || this.vm).$refs;
    var refs;
    if (!this.fromObject) {
      refs = this.frags.map(findVmFromFrag);
    } else {
      refs = {};
      this.frags.forEach(function (frag) {
        refs[frag.scope.$key] = findVmFromFrag(frag);
      });
    }
    hash[ref] = refs;
  },

  /**
   * For option lists, update the containing v-model on
   * parent <select>.
   */

  updateModel: function updateModel() {
    if (this.isOption) {
      var parent = this.start.parentNode;
      var model = parent && parent.__v_model;
      if (model) {
        model.forceUpdate();
      }
    }
  },

  /**
   * Insert a fragment. Handles staggering.
   *
   * @param {Fragment} frag
   * @param {Number} index
   * @param {Node} prevEl
   * @param {Boolean} inDocument
   */

  insert: function insert(frag, index, prevEl, inDocument) {
    if (frag.staggerCb) {
      frag.staggerCb.cancel();
      frag.staggerCb = null;
    }
    var staggerAmount = this.getStagger(frag, index, null, 'enter');
    if (inDocument && staggerAmount) {
      // create an anchor and insert it synchronously,
      // so that we can resolve the correct order without
      // worrying about some elements not inserted yet
      var anchor = frag.staggerAnchor;
      if (!anchor) {
        anchor = frag.staggerAnchor = createAnchor('stagger-anchor');
        anchor.__v_frag = frag;
      }
      after(anchor, prevEl);
      var op = frag.staggerCb = cancellable(function () {
        frag.staggerCb = null;
        frag.before(anchor);
        remove(anchor);
      });
      setTimeout(op, staggerAmount);
    } else {
      var target = prevEl.nextSibling;
      /* istanbul ignore if */
      if (!target) {
        // reset end anchor position in case the position was messed up
        // by an external drag-n-drop library.
        after(this.end, prevEl);
        target = this.end;
      }
      frag.before(target);
    }
  },

  /**
   * Remove a fragment. Handles staggering.
   *
   * @param {Fragment} frag
   * @param {Number} index
   * @param {Number} total
   * @param {Boolean} inDocument
   */

  remove: function remove(frag, index, total, inDocument) {
    if (frag.staggerCb) {
      frag.staggerCb.cancel();
      frag.staggerCb = null;
      // it's not possible for the same frag to be removed
      // twice, so if we have a pending stagger callback,
      // it means this frag is queued for enter but removed
      // before its transition started. Since it is already
      // destroyed, we can just leave it in detached state.
      return;
    }
    var staggerAmount = this.getStagger(frag, index, total, 'leave');
    if (inDocument && staggerAmount) {
      var op = frag.staggerCb = cancellable(function () {
        frag.staggerCb = null;
        frag.remove();
      });
      setTimeout(op, staggerAmount);
    } else {
      frag.remove();
    }
  },

  /**
   * Move a fragment to a new position.
   * Force no transition.
   *
   * @param {Fragment} frag
   * @param {Node} prevEl
   */

  move: function move(frag, prevEl) {
    // fix a common issue with Sortable:
    // if prevEl doesn't have nextSibling, this means it's
    // been dragged after the end anchor. Just re-position
    // the end anchor to the end of the container.
    /* istanbul ignore if */
    if (!prevEl.nextSibling) {
      this.end.parentNode.appendChild(this.end);
    }
    frag.before(prevEl.nextSibling, false);
  },

  /**
   * Cache a fragment using track-by or the object key.
   *
   * @param {*} value
   * @param {Fragment} frag
   * @param {Number} index
   * @param {String} [key]
   */

  cacheFrag: function cacheFrag(value, frag, index, key) {
    var trackByKey = this.params.trackBy;
    var cache = this.cache;
    var primitive = !isObject(value);
    var id;
    if (key || trackByKey || primitive) {
      id = getTrackByKey(index, key, value, trackByKey);
      if (!cache[id]) {
        cache[id] = frag;
      } else if (trackByKey !== '$index') {
        process.env.NODE_ENV !== 'production' && this.warnDuplicate(value);
      }
    } else {
      id = this.id;
      if (hasOwn(value, id)) {
        if (value[id] === null) {
          value[id] = frag;
        } else {
          process.env.NODE_ENV !== 'production' && this.warnDuplicate(value);
        }
      } else if (Object.isExtensible(value)) {
        def(value, id, frag);
      } else if (process.env.NODE_ENV !== 'production') {
        warn('Frozen v-for objects cannot be automatically tracked, make sure to ' + 'provide a track-by key.');
      }
    }
    frag.raw = value;
  },

  /**
   * Get a cached fragment from the value/index/key
   *
   * @param {*} value
   * @param {Number} index
   * @param {String} key
   * @return {Fragment}
   */

  getCachedFrag: function getCachedFrag(value, index, key) {
    var trackByKey = this.params.trackBy;
    var primitive = !isObject(value);
    var frag;
    if (key || trackByKey || primitive) {
      var id = getTrackByKey(index, key, value, trackByKey);
      frag = this.cache[id];
    } else {
      frag = value[this.id];
    }
    if (frag && (frag.reused || frag.fresh)) {
      process.env.NODE_ENV !== 'production' && this.warnDuplicate(value);
    }
    return frag;
  },

  /**
   * Delete a fragment from cache.
   *
   * @param {Fragment} frag
   */

  deleteCachedFrag: function deleteCachedFrag(frag) {
    var value = frag.raw;
    var trackByKey = this.params.trackBy;
    var scope = frag.scope;
    var index = scope.$index;
    // fix #948: avoid accidentally fall through to
    // a parent repeater which happens to have $key.
    var key = hasOwn(scope, '$key') && scope.$key;
    var primitive = !isObject(value);
    if (trackByKey || key || primitive) {
      var id = getTrackByKey(index, key, value, trackByKey);
      this.cache[id] = null;
    } else {
      value[this.id] = null;
      frag.raw = null;
    }
  },

  /**
   * Get the stagger amount for an insertion/removal.
   *
   * @param {Fragment} frag
   * @param {Number} index
   * @param {Number} total
   * @param {String} type
   */

  getStagger: function getStagger(frag, index, total, type) {
    type = type + 'Stagger';
    var trans = frag.node.__v_trans;
    var hooks = trans && trans.hooks;
    var hook = hooks && (hooks[type] || hooks.stagger);
    return hook ? hook.call(frag, index, total) : index * parseInt(this.params[type] || this.params.stagger, 10);
  },

  /**
   * Pre-process the value before piping it through the
   * filters. This is passed to and called by the watcher.
   */

  _preProcess: function _preProcess(value) {
    // regardless of type, store the un-filtered raw value.
    this.rawValue = value;
    return value;
  },

  /**
   * Post-process the value after it has been piped through
   * the filters. This is passed to and called by the watcher.
   *
   * It is necessary for this to be called during the
   * wathcer's dependency collection phase because we want
   * the v-for to update when the source Object is mutated.
   */

  _postProcess: function _postProcess(value) {
    if (isArray(value)) {
      return value;
    } else if (isPlainObject(value)) {
      // convert plain object to array.
      var keys = Object.keys(value);
      var i = keys.length;
      var res = new Array(i);
      var key;
      while (i--) {
        key = keys[i];
        res[i] = {
          $key: key,
          $value: value[key]
        };
      }
      return res;
    } else {
      if (typeof value === 'number' && !isNaN(value)) {
        value = range(value);
      }
      return value || [];
    }
  },

  unbind: function unbind() {
    if (this.descriptor.ref) {
      (this._scope || this.vm).$refs[this.descriptor.ref] = null;
    }
    if (this.frags) {
      var i = this.frags.length;
      var frag;
      while (i--) {
        frag = this.frags[i];
        this.deleteCachedFrag(frag);
        frag.destroy();
      }
    }
  }
};

/**
 * Helper to find the previous element that is a fragment
 * anchor. This is necessary because a destroyed frag's
 * element could still be lingering in the DOM before its
 * leaving transition finishes, but its inserted flag
 * should have been set to false so we can skip them.
 *
 * If this is a block repeat, we want to make sure we only
 * return frag that is bound to this v-for. (see #929)
 *
 * @param {Fragment} frag
 * @param {Comment|Text} anchor
 * @param {String} id
 * @return {Fragment}
 */

function findPrevFrag(frag, anchor, id) {
  var el = frag.node.previousSibling;
  /* istanbul ignore if */
  if (!el) return;
  frag = el.__v_frag;
  while ((!frag || frag.forId !== id || !frag.inserted) && el !== anchor) {
    el = el.previousSibling;
    /* istanbul ignore if */
    if (!el) return;
    frag = el.__v_frag;
  }
  return frag;
}

/**
 * Find a vm from a fragment.
 *
 * @param {Fragment} frag
 * @return {Vue|undefined}
 */

function findVmFromFrag(frag) {
  var node = frag.node;
  // handle multi-node frag
  if (frag.end) {
    while (!node.__vue__ && node !== frag.end && node.nextSibling) {
      node = node.nextSibling;
    }
  }
  return node.__vue__;
}

/**
 * Create a range array from given number.
 *
 * @param {Number} n
 * @return {Array}
 */

function range(n) {
  var i = -1;
  var ret = new Array(Math.floor(n));
  while (++i < n) {
    ret[i] = i;
  }
  return ret;
}

/**
 * Get the track by key for an item.
 *
 * @param {Number} index
 * @param {String} key
 * @param {*} value
 * @param {String} [trackByKey]
 */

function getTrackByKey(index, key, value, trackByKey) {
  return trackByKey ? trackByKey === '$index' ? index : trackByKey.charAt(0).match(/\w/) ? getPath(value, trackByKey) : value[trackByKey] : key || value;
}

if (process.env.NODE_ENV !== 'production') {
  vFor.warnDuplicate = function (value) {
    warn('Duplicate value found in v-for="' + this.descriptor.raw + '": ' + JSON.stringify(value) + '. Use track-by="$index" if ' + 'you are expecting duplicate values.', this.vm);
  };
}

var vIf = {

  priority: IF,
  terminal: true,

  bind: function bind() {
    var el = this.el;
    if (!el.__vue__) {
      // check else block
      var next = el.nextElementSibling;
      if (next && getAttr(next, 'v-else') !== null) {
        remove(next);
        this.elseEl = next;
      }
      // check main block
      this.anchor = createAnchor('v-if');
      replace(el, this.anchor);
    } else {
      process.env.NODE_ENV !== 'production' && warn('v-if="' + this.expression + '" cannot be ' + 'used on an instance root element.', this.vm);
      this.invalid = true;
    }
  },

  update: function update(value) {
    if (this.invalid) return;
    if (value) {
      if (!this.frag) {
        this.insert();
      }
    } else {
      this.remove();
    }
  },

  insert: function insert() {
    if (this.elseFrag) {
      this.elseFrag.remove();
      this.elseFrag = null;
    }
    // lazy init factory
    if (!this.factory) {
      this.factory = new FragmentFactory(this.vm, this.el);
    }
    this.frag = this.factory.create(this._host, this._scope, this._frag);
    this.frag.before(this.anchor);
  },

  remove: function remove() {
    if (this.frag) {
      this.frag.remove();
      this.frag = null;
    }
    if (this.elseEl && !this.elseFrag) {
      if (!this.elseFactory) {
        this.elseFactory = new FragmentFactory(this.elseEl._context || this.vm, this.elseEl);
      }
      this.elseFrag = this.elseFactory.create(this._host, this._scope, this._frag);
      this.elseFrag.before(this.anchor);
    }
  },

  unbind: function unbind() {
    if (this.frag) {
      this.frag.destroy();
    }
    if (this.elseFrag) {
      this.elseFrag.destroy();
    }
  }
};

var show = {

  bind: function bind() {
    // check else block
    var next = this.el.nextElementSibling;
    if (next && getAttr(next, 'v-else') !== null) {
      this.elseEl = next;
    }
  },

  update: function update(value) {
    this.apply(this.el, value);
    if (this.elseEl) {
      this.apply(this.elseEl, !value);
    }
  },

  apply: function apply(el, value) {
    if (inDoc(el)) {
      applyTransition(el, value ? 1 : -1, toggle, this.vm);
    } else {
      toggle();
    }
    function toggle() {
      el.style.display = value ? '' : 'none';
    }
  }
};

var text$2 = {

  bind: function bind() {
    var self = this;
    var el = this.el;
    var isRange = el.type === 'range';
    var lazy = this.params.lazy;
    var number = this.params.number;
    var debounce = this.params.debounce;

    // handle composition events.
    //   http://blog.evanyou.me/2014/01/03/composition-event/
    // skip this for Android because it handles composition
    // events quite differently. Android doesn't trigger
    // composition events for language input methods e.g.
    // Chinese, but instead triggers them for spelling
    // suggestions... (see Discussion/#162)
    var composing = false;
    if (!isAndroid && !isRange) {
      this.on('compositionstart', function () {
        composing = true;
      });
      this.on('compositionend', function () {
        composing = false;
        // in IE11 the "compositionend" event fires AFTER
        // the "input" event, so the input handler is blocked
        // at the end... have to call it here.
        //
        // #1327: in lazy mode this is unecessary.
        if (!lazy) {
          self.listener();
        }
      });
    }

    // prevent messing with the input when user is typing,
    // and force update on blur.
    this.focused = false;
    if (!isRange && !lazy) {
      this.on('focus', function () {
        self.focused = true;
      });
      this.on('blur', function () {
        self.focused = false;
        // do not sync value after fragment removal (#2017)
        if (!self._frag || self._frag.inserted) {
          self.rawListener();
        }
      });
    }

    // Now attach the main listener
    this.listener = this.rawListener = function () {
      if (composing || !self._bound) {
        return;
      }
      var val = number || isRange ? toNumber(el.value) : el.value;
      self.set(val);
      // force update on next tick to avoid lock & same value
      // also only update when user is not typing
      nextTick(function () {
        if (self._bound && !self.focused) {
          self.update(self._watcher.value);
        }
      });
    };

    // apply debounce
    if (debounce) {
      this.listener = _debounce(this.listener, debounce);
    }

    // Support jQuery events, since jQuery.trigger() doesn't
    // trigger native events in some cases and some plugins
    // rely on $.trigger()
    //
    // We want to make sure if a listener is attached using
    // jQuery, it is also removed with jQuery, that's why
    // we do the check for each directive instance and
    // store that check result on itself. This also allows
    // easier test coverage control by unsetting the global
    // jQuery variable in tests.
    this.hasjQuery = typeof jQuery === 'function';
    if (this.hasjQuery) {
      var method = jQuery.fn.on ? 'on' : 'bind';
      jQuery(el)[method]('change', this.rawListener);
      if (!lazy) {
        jQuery(el)[method]('input', this.listener);
      }
    } else {
      this.on('change', this.rawListener);
      if (!lazy) {
        this.on('input', this.listener);
      }
    }

    // IE9 doesn't fire input event on backspace/del/cut
    if (!lazy && isIE9) {
      this.on('cut', function () {
        nextTick(self.listener);
      });
      this.on('keyup', function (e) {
        if (e.keyCode === 46 || e.keyCode === 8) {
          self.listener();
        }
      });
    }

    // set initial value if present
    if (el.hasAttribute('value') || el.tagName === 'TEXTAREA' && el.value.trim()) {
      this.afterBind = this.listener;
    }
  },

  update: function update(value) {
    this.el.value = _toString(value);
  },

  unbind: function unbind() {
    var el = this.el;
    if (this.hasjQuery) {
      var method = jQuery.fn.off ? 'off' : 'unbind';
      jQuery(el)[method]('change', this.listener);
      jQuery(el)[method]('input', this.listener);
    }
  }
};

var radio = {

  bind: function bind() {
    var self = this;
    var el = this.el;

    this.getValue = function () {
      // value overwrite via v-bind:value
      if (el.hasOwnProperty('_value')) {
        return el._value;
      }
      var val = el.value;
      if (self.params.number) {
        val = toNumber(val);
      }
      return val;
    };

    this.listener = function () {
      self.set(self.getValue());
    };
    this.on('change', this.listener);

    if (el.hasAttribute('checked')) {
      this.afterBind = this.listener;
    }
  },

  update: function update(value) {
    this.el.checked = looseEqual(value, this.getValue());
  }
};

var select = {

  bind: function bind() {
    var self = this;
    var el = this.el;

    // method to force update DOM using latest value.
    this.forceUpdate = function () {
      if (self._watcher) {
        self.update(self._watcher.get());
      }
    };

    // check if this is a multiple select
    var multiple = this.multiple = el.hasAttribute('multiple');

    // attach listener
    this.listener = function () {
      var value = getValue(el, multiple);
      value = self.params.number ? isArray(value) ? value.map(toNumber) : toNumber(value) : value;
      self.set(value);
    };
    this.on('change', this.listener);

    // if has initial value, set afterBind
    var initValue = getValue(el, multiple, true);
    if (multiple && initValue.length || !multiple && initValue !== null) {
      this.afterBind = this.listener;
    }

    // All major browsers except Firefox resets
    // selectedIndex with value -1 to 0 when the element
    // is appended to a new parent, therefore we have to
    // force a DOM update whenever that happens...
    this.vm.$on('hook:attached', this.forceUpdate);
  },

  update: function update(value) {
    var el = this.el;
    el.selectedIndex = -1;
    var multi = this.multiple && isArray(value);
    var options = el.options;
    var i = options.length;
    var op, val;
    while (i--) {
      op = options[i];
      val = op.hasOwnProperty('_value') ? op._value : op.value;
      /* eslint-disable eqeqeq */
      op.selected = multi ? indexOf$1(value, val) > -1 : looseEqual(value, val);
      /* eslint-enable eqeqeq */
    }
  },

  unbind: function unbind() {
    /* istanbul ignore next */
    this.vm.$off('hook:attached', this.forceUpdate);
  }
};

/**
 * Get select value
 *
 * @param {SelectElement} el
 * @param {Boolean} multi
 * @param {Boolean} init
 * @return {Array|*}
 */

function getValue(el, multi, init) {
  var res = multi ? [] : null;
  var op, val, selected;
  for (var i = 0, l = el.options.length; i < l; i++) {
    op = el.options[i];
    selected = init ? op.hasAttribute('selected') : op.selected;
    if (selected) {
      val = op.hasOwnProperty('_value') ? op._value : op.value;
      if (multi) {
        res.push(val);
      } else {
        return val;
      }
    }
  }
  return res;
}

/**
 * Native Array.indexOf uses strict equal, but in this
 * case we need to match string/numbers with custom equal.
 *
 * @param {Array} arr
 * @param {*} val
 */

function indexOf$1(arr, val) {
  var i = arr.length;
  while (i--) {
    if (looseEqual(arr[i], val)) {
      return i;
    }
  }
  return -1;
}

var checkbox = {

  bind: function bind() {
    var self = this;
    var el = this.el;

    this.getValue = function () {
      return el.hasOwnProperty('_value') ? el._value : self.params.number ? toNumber(el.value) : el.value;
    };

    function getBooleanValue() {
      var val = el.checked;
      if (val && el.hasOwnProperty('_trueValue')) {
        return el._trueValue;
      }
      if (!val && el.hasOwnProperty('_falseValue')) {
        return el._falseValue;
      }
      return val;
    }

    this.listener = function () {
      var model = self._watcher.value;
      if (isArray(model)) {
        var val = self.getValue();
        if (el.checked) {
          if (indexOf(model, val) < 0) {
            model.push(val);
          }
        } else {
          model.$remove(val);
        }
      } else {
        self.set(getBooleanValue());
      }
    };

    this.on('change', this.listener);
    if (el.hasAttribute('checked')) {
      this.afterBind = this.listener;
    }
  },

  update: function update(value) {
    var el = this.el;
    if (isArray(value)) {
      el.checked = indexOf(value, this.getValue()) > -1;
    } else {
      if (el.hasOwnProperty('_trueValue')) {
        el.checked = looseEqual(value, el._trueValue);
      } else {
        el.checked = !!value;
      }
    }
  }
};

var handlers = {
  text: text$2,
  radio: radio,
  select: select,
  checkbox: checkbox
};

var model = {

  priority: MODEL,
  twoWay: true,
  handlers: handlers,
  params: ['lazy', 'number', 'debounce'],

  /**
   * Possible elements:
   *   <select>
   *   <textarea>
   *   <input type="*">
   *     - text
   *     - checkbox
   *     - radio
   *     - number
   */

  bind: function bind() {
    // friendly warning...
    this.checkFilters();
    if (this.hasRead && !this.hasWrite) {
      process.env.NODE_ENV !== 'production' && warn('It seems you are using a read-only filter with ' + 'v-model="' + this.descriptor.raw + '". ' + 'You might want to use a two-way filter to ensure correct behavior.', this.vm);
    }
    var el = this.el;
    var tag = el.tagName;
    var handler;
    if (tag === 'INPUT') {
      handler = handlers[el.type] || handlers.text;
    } else if (tag === 'SELECT') {
      handler = handlers.select;
    } else if (tag === 'TEXTAREA') {
      handler = handlers.text;
    } else {
      process.env.NODE_ENV !== 'production' && warn('v-model does not support element type: ' + tag, this.vm);
      return;
    }
    el.__v_model = this;
    handler.bind.call(this);
    this.update = handler.update;
    this._unbind = handler.unbind;
  },

  /**
   * Check read/write filter stats.
   */

  checkFilters: function checkFilters() {
    var filters = this.filters;
    if (!filters) return;
    var i = filters.length;
    while (i--) {
      var filter = resolveAsset(this.vm.$options, 'filters', filters[i].name);
      if (typeof filter === 'function' || filter.read) {
        this.hasRead = true;
      }
      if (filter.write) {
        this.hasWrite = true;
      }
    }
  },

  unbind: function unbind() {
    this.el.__v_model = null;
    this._unbind && this._unbind();
  }
};

// keyCode aliases
var keyCodes = {
  esc: 27,
  tab: 9,
  enter: 13,
  space: 32,
  'delete': [8, 46],
  up: 38,
  left: 37,
  right: 39,
  down: 40
};

function keyFilter(handler, keys) {
  var codes = keys.map(function (key) {
    var charCode = key.charCodeAt(0);
    if (charCode > 47 && charCode < 58) {
      return parseInt(key, 10);
    }
    if (key.length === 1) {
      charCode = key.toUpperCase().charCodeAt(0);
      if (charCode > 64 && charCode < 91) {
        return charCode;
      }
    }
    return keyCodes[key];
  });
  codes = [].concat.apply([], codes);
  return function keyHandler(e) {
    if (codes.indexOf(e.keyCode) > -1) {
      return handler.call(this, e);
    }
  };
}

function stopFilter(handler) {
  return function stopHandler(e) {
    e.stopPropagation();
    return handler.call(this, e);
  };
}

function preventFilter(handler) {
  return function preventHandler(e) {
    e.preventDefault();
    return handler.call(this, e);
  };
}

function selfFilter(handler) {
  return function selfHandler(e) {
    if (e.target === e.currentTarget) {
      return handler.call(this, e);
    }
  };
}

var on$1 = {

  priority: ON,
  acceptStatement: true,
  keyCodes: keyCodes,

  bind: function bind() {
    // deal with iframes
    if (this.el.tagName === 'IFRAME' && this.arg !== 'load') {
      var self = this;
      this.iframeBind = function () {
        on(self.el.contentWindow, self.arg, self.handler, self.modifiers.capture);
      };
      this.on('load', this.iframeBind);
    }
  },

  update: function update(handler) {
    // stub a noop for v-on with no value,
    // e.g. @mousedown.prevent
    if (!this.descriptor.raw) {
      handler = function () {};
    }

    if (typeof handler !== 'function') {
      process.env.NODE_ENV !== 'production' && warn('v-on:' + this.arg + '="' + this.expression + '" expects a function value, ' + 'got ' + handler, this.vm);
      return;
    }

    // apply modifiers
    if (this.modifiers.stop) {
      handler = stopFilter(handler);
    }
    if (this.modifiers.prevent) {
      handler = preventFilter(handler);
    }
    if (this.modifiers.self) {
      handler = selfFilter(handler);
    }
    // key filter
    var keys = Object.keys(this.modifiers).filter(function (key) {
      return key !== 'stop' && key !== 'prevent' && key !== 'self' && key !== 'capture';
    });
    if (keys.length) {
      handler = keyFilter(handler, keys);
    }

    this.reset();
    this.handler = handler;

    if (this.iframeBind) {
      this.iframeBind();
    } else {
      on(this.el, this.arg, this.handler, this.modifiers.capture);
    }
  },

  reset: function reset() {
    var el = this.iframeBind ? this.el.contentWindow : this.el;
    if (this.handler) {
      off(el, this.arg, this.handler);
    }
  },

  unbind: function unbind() {
    this.reset();
  }
};

var prefixes = ['-webkit-', '-moz-', '-ms-'];
var camelPrefixes = ['Webkit', 'Moz', 'ms'];
var importantRE = /!important;?$/;
var propCache = Object.create(null);

var testEl = null;

var style = {

  deep: true,

  update: function update(value) {
    if (typeof value === 'string') {
      this.el.style.cssText = value;
    } else if (isArray(value)) {
      this.handleObject(value.reduce(extend, {}));
    } else {
      this.handleObject(value || {});
    }
  },

  handleObject: function handleObject(value) {
    // cache object styles so that only changed props
    // are actually updated.
    var cache = this.cache || (this.cache = {});
    var name, val;
    for (name in cache) {
      if (!(name in value)) {
        this.handleSingle(name, null);
        delete cache[name];
      }
    }
    for (name in value) {
      val = value[name];
      if (val !== cache[name]) {
        cache[name] = val;
        this.handleSingle(name, val);
      }
    }
  },

  handleSingle: function handleSingle(prop, value) {
    prop = normalize(prop);
    if (!prop) return; // unsupported prop
    // cast possible numbers/booleans into strings
    if (value != null) value += '';
    if (value) {
      var isImportant = importantRE.test(value) ? 'important' : '';
      if (isImportant) {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production') {
          warn('It\'s probably a bad idea to use !important with inline rules. ' + 'This feature will be deprecated in a future version of Vue.');
        }
        value = value.replace(importantRE, '').trim();
        this.el.style.setProperty(prop.kebab, value, isImportant);
      } else {
        this.el.style[prop.camel] = value;
      }
    } else {
      this.el.style[prop.camel] = '';
    }
  }

};

/**
 * Normalize a CSS property name.
 * - cache result
 * - auto prefix
 * - camelCase -> dash-case
 *
 * @param {String} prop
 * @return {String}
 */

function normalize(prop) {
  if (propCache[prop]) {
    return propCache[prop];
  }
  var res = prefix(prop);
  propCache[prop] = propCache[res] = res;
  return res;
}

/**
 * Auto detect the appropriate prefix for a CSS property.
 * https://gist.github.com/paulirish/523692
 *
 * @param {String} prop
 * @return {String}
 */

function prefix(prop) {
  prop = hyphenate(prop);
  var camel = camelize(prop);
  var upper = camel.charAt(0).toUpperCase() + camel.slice(1);
  if (!testEl) {
    testEl = document.createElement('div');
  }
  var i = prefixes.length;
  var prefixed;
  if (camel !== 'filter' && camel in testEl.style) {
    return {
      kebab: prop,
      camel: camel
    };
  }
  while (i--) {
    prefixed = camelPrefixes[i] + upper;
    if (prefixed in testEl.style) {
      return {
        kebab: prefixes[i] + prop,
        camel: prefixed
      };
    }
  }
}

// xlink
var xlinkNS = 'http://www.w3.org/1999/xlink';
var xlinkRE = /^xlink:/;

// check for attributes that prohibit interpolations
var disallowedInterpAttrRE = /^v-|^:|^@|^(?:is|transition|transition-mode|debounce|track-by|stagger|enter-stagger|leave-stagger)$/;
// these attributes should also set their corresponding properties
// because they only affect the initial state of the element
var attrWithPropsRE = /^(?:value|checked|selected|muted)$/;
// these attributes expect enumrated values of "true" or "false"
// but are not boolean attributes
var enumeratedAttrRE = /^(?:draggable|contenteditable|spellcheck)$/;

// these attributes should set a hidden property for
// binding v-model to object values
var modelProps = {
  value: '_value',
  'true-value': '_trueValue',
  'false-value': '_falseValue'
};

var bind$1 = {

  priority: BIND,

  bind: function bind() {
    var attr = this.arg;
    var tag = this.el.tagName;
    // should be deep watch on object mode
    if (!attr) {
      this.deep = true;
    }
    // handle interpolation bindings
    var descriptor = this.descriptor;
    var tokens = descriptor.interp;
    if (tokens) {
      // handle interpolations with one-time tokens
      if (descriptor.hasOneTime) {
        this.expression = tokensToExp(tokens, this._scope || this.vm);
      }

      // only allow binding on native attributes
      if (disallowedInterpAttrRE.test(attr) || attr === 'name' && (tag === 'PARTIAL' || tag === 'SLOT')) {
        process.env.NODE_ENV !== 'production' && warn(attr + '="' + descriptor.raw + '": ' + 'attribute interpolation is not allowed in Vue.js ' + 'directives and special attributes.', this.vm);
        this.el.removeAttribute(attr);
        this.invalid = true;
      }

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production') {
        var raw = attr + '="' + descriptor.raw + '": ';
        // warn src
        if (attr === 'src') {
          warn(raw + 'interpolation in "src" attribute will cause ' + 'a 404 request. Use v-bind:src instead.', this.vm);
        }

        // warn style
        if (attr === 'style') {
          warn(raw + 'interpolation in "style" attribute will cause ' + 'the attribute to be discarded in Internet Explorer. ' + 'Use v-bind:style instead.', this.vm);
        }
      }
    }
  },

  update: function update(value) {
    if (this.invalid) {
      return;
    }
    var attr = this.arg;
    if (this.arg) {
      this.handleSingle(attr, value);
    } else {
      this.handleObject(value || {});
    }
  },

  // share object handler with v-bind:class
  handleObject: style.handleObject,

  handleSingle: function handleSingle(attr, value) {
    var el = this.el;
    var interp = this.descriptor.interp;
    if (this.modifiers.camel) {
      attr = camelize(attr);
    }
    if (!interp && attrWithPropsRE.test(attr) && attr in el) {
      var attrValue = attr === 'value' ? value == null // IE9 will set input.value to "null" for null...
      ? '' : value : value;

      if (el[attr] !== attrValue) {
        el[attr] = attrValue;
      }
    }
    // set model props
    var modelProp = modelProps[attr];
    if (!interp && modelProp) {
      el[modelProp] = value;
      // update v-model if present
      var model = el.__v_model;
      if (model) {
        model.listener();
      }
    }
    // do not set value attribute for textarea
    if (attr === 'value' && el.tagName === 'TEXTAREA') {
      el.removeAttribute(attr);
      return;
    }
    // update attribute
    if (enumeratedAttrRE.test(attr)) {
      el.setAttribute(attr, value ? 'true' : 'false');
    } else if (value != null && value !== false) {
      if (attr === 'class') {
        // handle edge case #1960:
        // class interpolation should not overwrite Vue transition class
        if (el.__v_trans) {
          value += ' ' + el.__v_trans.id + '-transition';
        }
        setClass(el, value);
      } else if (xlinkRE.test(attr)) {
        el.setAttributeNS(xlinkNS, attr, value === true ? '' : value);
      } else {
        el.setAttribute(attr, value === true ? '' : value);
      }
    } else {
      el.removeAttribute(attr);
    }
  }
};

var el = {

  priority: EL,

  bind: function bind() {
    /* istanbul ignore if */
    if (!this.arg) {
      return;
    }
    var id = this.id = camelize(this.arg);
    var refs = (this._scope || this.vm).$els;
    if (hasOwn(refs, id)) {
      refs[id] = this.el;
    } else {
      defineReactive(refs, id, this.el);
    }
  },

  unbind: function unbind() {
    var refs = (this._scope || this.vm).$els;
    if (refs[this.id] === this.el) {
      refs[this.id] = null;
    }
  }
};

var ref = {
  bind: function bind() {
    process.env.NODE_ENV !== 'production' && warn('v-ref:' + this.arg + ' must be used on a child ' + 'component. Found on <' + this.el.tagName.toLowerCase() + '>.', this.vm);
  }
};

var cloak = {
  bind: function bind() {
    var el = this.el;
    this.vm.$once('pre-hook:compiled', function () {
      el.removeAttribute('v-cloak');
    });
  }
};

// must export plain object
var directives = {
  text: text$1,
  html: html,
  'for': vFor,
  'if': vIf,
  show: show,
  model: model,
  on: on$1,
  bind: bind$1,
  el: el,
  ref: ref,
  cloak: cloak
};

var vClass = {

  deep: true,

  update: function update(value) {
    if (!value) {
      this.cleanup();
    } else if (typeof value === 'string') {
      this.setClass(value.trim().split(/\s+/));
    } else {
      this.setClass(normalize$1(value));
    }
  },

  setClass: function setClass(value) {
    this.cleanup(value);
    for (var i = 0, l = value.length; i < l; i++) {
      var val = value[i];
      if (val) {
        apply(this.el, val, addClass);
      }
    }
    this.prevKeys = value;
  },

  cleanup: function cleanup(value) {
    var prevKeys = this.prevKeys;
    if (!prevKeys) return;
    var i = prevKeys.length;
    while (i--) {
      var key = prevKeys[i];
      if (!value || value.indexOf(key) < 0) {
        apply(this.el, key, removeClass);
      }
    }
  }
};

/**
 * Normalize objects and arrays (potentially containing objects)
 * into array of strings.
 *
 * @param {Object|Array<String|Object>} value
 * @return {Array<String>}
 */

function normalize$1(value) {
  var res = [];
  if (isArray(value)) {
    for (var i = 0, l = value.length; i < l; i++) {
      var _key = value[i];
      if (_key) {
        if (typeof _key === 'string') {
          res.push(_key);
        } else {
          for (var k in _key) {
            if (_key[k]) res.push(k);
          }
        }
      }
    }
  } else if (isObject(value)) {
    for (var key in value) {
      if (value[key]) res.push(key);
    }
  }
  return res;
}

/**
 * Add or remove a class/classes on an element
 *
 * @param {Element} el
 * @param {String} key The class name. This may or may not
 *                     contain a space character, in such a
 *                     case we'll deal with multiple class
 *                     names at once.
 * @param {Function} fn
 */

function apply(el, key, fn) {
  key = key.trim();
  if (key.indexOf(' ') === -1) {
    fn(el, key);
    return;
  }
  // The key contains one or more space characters.
  // Since a class name doesn't accept such characters, we
  // treat it as multiple classes.
  var keys = key.split(/\s+/);
  for (var i = 0, l = keys.length; i < l; i++) {
    fn(el, keys[i]);
  }
}

var component = {

  priority: COMPONENT,

  params: ['keep-alive', 'transition-mode', 'inline-template'],

  /**
   * Setup. Two possible usages:
   *
   * - static:
   *   <comp> or <div v-component="comp">
   *
   * - dynamic:
   *   <component :is="view">
   */

  bind: function bind() {
    if (!this.el.__vue__) {
      // keep-alive cache
      this.keepAlive = this.params.keepAlive;
      if (this.keepAlive) {
        this.cache = {};
      }
      // check inline-template
      if (this.params.inlineTemplate) {
        // extract inline template as a DocumentFragment
        this.inlineTemplate = extractContent(this.el, true);
      }
      // component resolution related state
      this.pendingComponentCb = this.Component = null;
      // transition related state
      this.pendingRemovals = 0;
      this.pendingRemovalCb = null;
      // create a ref anchor
      this.anchor = createAnchor('v-component');
      replace(this.el, this.anchor);
      // remove is attribute.
      // this is removed during compilation, but because compilation is
      // cached, when the component is used elsewhere this attribute
      // will remain at link time.
      this.el.removeAttribute('is');
      this.el.removeAttribute(':is');
      // remove ref, same as above
      if (this.descriptor.ref) {
        this.el.removeAttribute('v-ref:' + hyphenate(this.descriptor.ref));
      }
      // if static, build right now.
      if (this.literal) {
        this.setComponent(this.expression);
      }
    } else {
      process.env.NODE_ENV !== 'production' && warn('cannot mount component "' + this.expression + '" ' + 'on already mounted element: ' + this.el);
    }
  },

  /**
   * Public update, called by the watcher in the dynamic
   * literal scenario, e.g. <component :is="view">
   */

  update: function update(value) {
    if (!this.literal) {
      this.setComponent(value);
    }
  },

  /**
   * Switch dynamic components. May resolve the component
   * asynchronously, and perform transition based on
   * specified transition mode. Accepts a few additional
   * arguments specifically for vue-router.
   *
   * The callback is called when the full transition is
   * finished.
   *
   * @param {String} value
   * @param {Function} [cb]
   */

  setComponent: function setComponent(value, cb) {
    this.invalidatePending();
    if (!value) {
      // just remove current
      this.unbuild(true);
      this.remove(this.childVM, cb);
      this.childVM = null;
    } else {
      var self = this;
      this.resolveComponent(value, function () {
        self.mountComponent(cb);
      });
    }
  },

  /**
   * Resolve the component constructor to use when creating
   * the child vm.
   *
   * @param {String|Function} value
   * @param {Function} cb
   */

  resolveComponent: function resolveComponent(value, cb) {
    var self = this;
    this.pendingComponentCb = cancellable(function (Component) {
      self.ComponentName = Component.options.name || (typeof value === 'string' ? value : null);
      self.Component = Component;
      cb();
    });
    this.vm._resolveComponent(value, this.pendingComponentCb);
  },

  /**
   * Create a new instance using the current constructor and
   * replace the existing instance. This method doesn't care
   * whether the new component and the old one are actually
   * the same.
   *
   * @param {Function} [cb]
   */

  mountComponent: function mountComponent(cb) {
    // actual mount
    this.unbuild(true);
    var self = this;
    var activateHooks = this.Component.options.activate;
    var cached = this.getCached();
    var newComponent = this.build();
    if (activateHooks && !cached) {
      this.waitingFor = newComponent;
      callActivateHooks(activateHooks, newComponent, function () {
        if (self.waitingFor !== newComponent) {
          return;
        }
        self.waitingFor = null;
        self.transition(newComponent, cb);
      });
    } else {
      // update ref for kept-alive component
      if (cached) {
        newComponent._updateRef();
      }
      this.transition(newComponent, cb);
    }
  },

  /**
   * When the component changes or unbinds before an async
   * constructor is resolved, we need to invalidate its
   * pending callback.
   */

  invalidatePending: function invalidatePending() {
    if (this.pendingComponentCb) {
      this.pendingComponentCb.cancel();
      this.pendingComponentCb = null;
    }
  },

  /**
   * Instantiate/insert a new child vm.
   * If keep alive and has cached instance, insert that
   * instance; otherwise build a new one and cache it.
   *
   * @param {Object} [extraOptions]
   * @return {Vue} - the created instance
   */

  build: function build(extraOptions) {
    var cached = this.getCached();
    if (cached) {
      return cached;
    }
    if (this.Component) {
      // default options
      var options = {
        name: this.ComponentName,
        el: cloneNode(this.el),
        template: this.inlineTemplate,
        // make sure to add the child with correct parent
        // if this is a transcluded component, its parent
        // should be the transclusion host.
        parent: this._host || this.vm,
        // if no inline-template, then the compiled
        // linker can be cached for better performance.
        _linkerCachable: !this.inlineTemplate,
        _ref: this.descriptor.ref,
        _asComponent: true,
        _isRouterView: this._isRouterView,
        // if this is a transcluded component, context
        // will be the common parent vm of this instance
        // and its host.
        _context: this.vm,
        // if this is inside an inline v-for, the scope
        // will be the intermediate scope created for this
        // repeat fragment. this is used for linking props
        // and container directives.
        _scope: this._scope,
        // pass in the owner fragment of this component.
        // this is necessary so that the fragment can keep
        // track of its contained components in order to
        // call attach/detach hooks for them.
        _frag: this._frag
      };
      // extra options
      // in 1.0.0 this is used by vue-router only
      /* istanbul ignore if */
      if (extraOptions) {
        extend(options, extraOptions);
      }
      var child = new this.Component(options);
      if (this.keepAlive) {
        this.cache[this.Component.cid] = child;
      }
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && this.el.hasAttribute('transition') && child._isFragment) {
        warn('Transitions will not work on a fragment instance. ' + 'Template: ' + child.$options.template, child);
      }
      return child;
    }
  },

  /**
   * Try to get a cached instance of the current component.
   *
   * @return {Vue|undefined}
   */

  getCached: function getCached() {
    return this.keepAlive && this.cache[this.Component.cid];
  },

  /**
   * Teardown the current child, but defers cleanup so
   * that we can separate the destroy and removal steps.
   *
   * @param {Boolean} defer
   */

  unbuild: function unbuild(defer) {
    if (this.waitingFor) {
      if (!this.keepAlive) {
        this.waitingFor.$destroy();
      }
      this.waitingFor = null;
    }
    var child = this.childVM;
    if (!child || this.keepAlive) {
      if (child) {
        // remove ref
        child._inactive = true;
        child._updateRef(true);
      }
      return;
    }
    // the sole purpose of `deferCleanup` is so that we can
    // "deactivate" the vm right now and perform DOM removal
    // later.
    child.$destroy(false, defer);
  },

  /**
   * Remove current destroyed child and manually do
   * the cleanup after removal.
   *
   * @param {Function} cb
   */

  remove: function remove(child, cb) {
    var keepAlive = this.keepAlive;
    if (child) {
      // we may have a component switch when a previous
      // component is still being transitioned out.
      // we want to trigger only one lastest insertion cb
      // when the existing transition finishes. (#1119)
      this.pendingRemovals++;
      this.pendingRemovalCb = cb;
      var self = this;
      child.$remove(function () {
        self.pendingRemovals--;
        if (!keepAlive) child._cleanup();
        if (!self.pendingRemovals && self.pendingRemovalCb) {
          self.pendingRemovalCb();
          self.pendingRemovalCb = null;
        }
      });
    } else if (cb) {
      cb();
    }
  },

  /**
   * Actually swap the components, depending on the
   * transition mode. Defaults to simultaneous.
   *
   * @param {Vue} target
   * @param {Function} [cb]
   */

  transition: function transition(target, cb) {
    var self = this;
    var current = this.childVM;
    // for devtool inspection
    if (current) current._inactive = true;
    target._inactive = false;
    this.childVM = target;
    switch (self.params.transitionMode) {
      case 'in-out':
        target.$before(self.anchor, function () {
          self.remove(current, cb);
        });
        break;
      case 'out-in':
        self.remove(current, function () {
          target.$before(self.anchor, cb);
        });
        break;
      default:
        self.remove(current);
        target.$before(self.anchor, cb);
    }
  },

  /**
   * Unbind.
   */

  unbind: function unbind() {
    this.invalidatePending();
    // Do not defer cleanup when unbinding
    this.unbuild();
    // destroy all keep-alive cached instances
    if (this.cache) {
      for (var key in this.cache) {
        this.cache[key].$destroy();
      }
      this.cache = null;
    }
  }
};

/**
 * Call activate hooks in order (asynchronous)
 *
 * @param {Array} hooks
 * @param {Vue} vm
 * @param {Function} cb
 */

function callActivateHooks(hooks, vm, cb) {
  var total = hooks.length;
  var called = 0;
  hooks[0].call(vm, next);
  function next() {
    if (++called >= total) {
      cb();
    } else {
      hooks[called].call(vm, next);
    }
  }
}

var propBindingModes = config._propBindingModes;
var empty = {};

// regexes
var identRE$1 = /^[$_a-zA-Z]+[\w$]*$/;
var settablePathRE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*|\[[^\[\]]+\])*$/;

/**
 * Compile props on a root element and return
 * a props link function.
 *
 * @param {Element|DocumentFragment} el
 * @param {Array} propOptions
 * @param {Vue} vm
 * @return {Function} propsLinkFn
 */

function compileProps(el, propOptions, vm) {
  var props = [];
  var names = Object.keys(propOptions);
  var i = names.length;
  var options, name, attr, value, path, parsed, prop;
  while (i--) {
    name = names[i];
    options = propOptions[name] || empty;

    if (process.env.NODE_ENV !== 'production' && name === '$data') {
      warn('Do not use $data as prop.', vm);
      continue;
    }

    // props could contain dashes, which will be
    // interpreted as minus calculations by the parser
    // so we need to camelize the path here
    path = camelize(name);
    if (!identRE$1.test(path)) {
      process.env.NODE_ENV !== 'production' && warn('Invalid prop key: "' + name + '". Prop keys ' + 'must be valid identifiers.', vm);
      continue;
    }

    prop = {
      name: name,
      path: path,
      options: options,
      mode: propBindingModes.ONE_WAY,
      raw: null
    };

    attr = hyphenate(name);
    // first check dynamic version
    if ((value = getBindAttr(el, attr)) === null) {
      if ((value = getBindAttr(el, attr + '.sync')) !== null) {
        prop.mode = propBindingModes.TWO_WAY;
      } else if ((value = getBindAttr(el, attr + '.once')) !== null) {
        prop.mode = propBindingModes.ONE_TIME;
      }
    }
    if (value !== null) {
      // has dynamic binding!
      prop.raw = value;
      parsed = parseDirective(value);
      value = parsed.expression;
      prop.filters = parsed.filters;
      // check binding type
      if (isLiteral(value) && !parsed.filters) {
        // for expressions containing literal numbers and
        // booleans, there's no need to setup a prop binding,
        // so we can optimize them as a one-time set.
        prop.optimizedLiteral = true;
      } else {
        prop.dynamic = true;
        // check non-settable path for two-way bindings
        if (process.env.NODE_ENV !== 'production' && prop.mode === propBindingModes.TWO_WAY && !settablePathRE.test(value)) {
          prop.mode = propBindingModes.ONE_WAY;
          warn('Cannot bind two-way prop with non-settable ' + 'parent path: ' + value, vm);
        }
      }
      prop.parentPath = value;

      // warn required two-way
      if (process.env.NODE_ENV !== 'production' && options.twoWay && prop.mode !== propBindingModes.TWO_WAY) {
        warn('Prop "' + name + '" expects a two-way binding type.', vm);
      }
    } else if ((value = getAttr(el, attr)) !== null) {
      // has literal binding!
      prop.raw = value;
    } else if (process.env.NODE_ENV !== 'production') {
      // check possible camelCase prop usage
      var lowerCaseName = path.toLowerCase();
      value = /[A-Z\-]/.test(name) && (el.getAttribute(lowerCaseName) || el.getAttribute(':' + lowerCaseName) || el.getAttribute('v-bind:' + lowerCaseName) || el.getAttribute(':' + lowerCaseName + '.once') || el.getAttribute('v-bind:' + lowerCaseName + '.once') || el.getAttribute(':' + lowerCaseName + '.sync') || el.getAttribute('v-bind:' + lowerCaseName + '.sync'));
      if (value) {
        warn('Possible usage error for prop `' + lowerCaseName + '` - ' + 'did you mean `' + attr + '`? HTML is case-insensitive, remember to use ' + 'kebab-case for props in templates.', vm);
      } else if (options.required) {
        // warn missing required
        warn('Missing required prop: ' + name, vm);
      }
    }
    // push prop
    props.push(prop);
  }
  return makePropsLinkFn(props);
}

/**
 * Build a function that applies props to a vm.
 *
 * @param {Array} props
 * @return {Function} propsLinkFn
 */

function makePropsLinkFn(props) {
  return function propsLinkFn(vm, scope) {
    // store resolved props info
    vm._props = {};
    var inlineProps = vm.$options.propsData;
    var i = props.length;
    var prop, path, options, value, raw;
    while (i--) {
      prop = props[i];
      raw = prop.raw;
      path = prop.path;
      options = prop.options;
      vm._props[path] = prop;
      if (inlineProps && hasOwn(inlineProps, path)) {
        initProp(vm, prop, inlineProps[path]);
      }if (raw === null) {
        // initialize absent prop
        initProp(vm, prop, undefined);
      } else if (prop.dynamic) {
        // dynamic prop
        if (prop.mode === propBindingModes.ONE_TIME) {
          // one time binding
          value = (scope || vm._context || vm).$get(prop.parentPath);
          initProp(vm, prop, value);
        } else {
          if (vm._context) {
            // dynamic binding
            vm._bindDir({
              name: 'prop',
              def: propDef,
              prop: prop
            }, null, null, scope); // el, host, scope
          } else {
              // root instance
              initProp(vm, prop, vm.$get(prop.parentPath));
            }
        }
      } else if (prop.optimizedLiteral) {
        // optimized literal, cast it and just set once
        var stripped = stripQuotes(raw);
        value = stripped === raw ? toBoolean(toNumber(raw)) : stripped;
        initProp(vm, prop, value);
      } else {
        // string literal, but we need to cater for
        // Boolean props with no value, or with same
        // literal value (e.g. disabled="disabled")
        // see https://github.com/vuejs/vue-loader/issues/182
        value = options.type === Boolean && (raw === '' || raw === hyphenate(prop.name)) ? true : raw;
        initProp(vm, prop, value);
      }
    }
  };
}

/**
 * Process a prop with a rawValue, applying necessary coersions,
 * default values & assertions and call the given callback with
 * processed value.
 *
 * @param {Vue} vm
 * @param {Object} prop
 * @param {*} rawValue
 * @param {Function} fn
 */

function processPropValue(vm, prop, rawValue, fn) {
  var isSimple = prop.dynamic && isSimplePath(prop.parentPath);
  var value = rawValue;
  if (value === undefined) {
    value = getPropDefaultValue(vm, prop);
  }
  value = coerceProp(prop, value);
  var coerced = value !== rawValue;
  if (!assertProp(prop, value, vm)) {
    value = undefined;
  }
  if (isSimple && !coerced) {
    withoutConversion(function () {
      fn(value);
    });
  } else {
    fn(value);
  }
}

/**
 * Set a prop's initial value on a vm and its data object.
 *
 * @param {Vue} vm
 * @param {Object} prop
 * @param {*} value
 */

function initProp(vm, prop, value) {
  processPropValue(vm, prop, value, function (value) {
    defineReactive(vm, prop.path, value);
  });
}

/**
 * Update a prop's value on a vm.
 *
 * @param {Vue} vm
 * @param {Object} prop
 * @param {*} value
 */

function updateProp(vm, prop, value) {
  processPropValue(vm, prop, value, function (value) {
    vm[prop.path] = value;
  });
}

/**
 * Get the default value of a prop.
 *
 * @param {Vue} vm
 * @param {Object} prop
 * @return {*}
 */

function getPropDefaultValue(vm, prop) {
  // no default, return undefined
  var options = prop.options;
  if (!hasOwn(options, 'default')) {
    // absent boolean value defaults to false
    return options.type === Boolean ? false : undefined;
  }
  var def = options['default'];
  // warn against non-factory defaults for Object & Array
  if (isObject(def)) {
    process.env.NODE_ENV !== 'production' && warn('Invalid default value for prop "' + prop.name + '": ' + 'Props with type Object/Array must use a factory function ' + 'to return the default value.', vm);
  }
  // call factory function for non-Function types
  return typeof def === 'function' && options.type !== Function ? def.call(vm) : def;
}

/**
 * Assert whether a prop is valid.
 *
 * @param {Object} prop
 * @param {*} value
 * @param {Vue} vm
 */

function assertProp(prop, value, vm) {
  if (!prop.options.required && ( // non-required
  prop.raw === null || // abscent
  value == null) // null or undefined
  ) {
      return true;
    }
  var options = prop.options;
  var type = options.type;
  var valid = !type;
  var expectedTypes = [];
  if (type) {
    if (!isArray(type)) {
      type = [type];
    }
    for (var i = 0; i < type.length && !valid; i++) {
      var assertedType = assertType(value, type[i]);
      expectedTypes.push(assertedType.expectedType);
      valid = assertedType.valid;
    }
  }
  if (!valid) {
    if (process.env.NODE_ENV !== 'production') {
      warn('Invalid prop: type check failed for prop "' + prop.name + '".' + ' Expected ' + expectedTypes.map(formatType).join(', ') + ', got ' + formatValue(value) + '.', vm);
    }
    return false;
  }
  var validator = options.validator;
  if (validator) {
    if (!validator(value)) {
      process.env.NODE_ENV !== 'production' && warn('Invalid prop: custom validator check failed for prop "' + prop.name + '".', vm);
      return false;
    }
  }
  return true;
}

/**
 * Force parsing value with coerce option.
 *
 * @param {*} value
 * @param {Object} options
 * @return {*}
 */

function coerceProp(prop, value) {
  var coerce = prop.options.coerce;
  if (!coerce) {
    return value;
  }
  // coerce is a function
  return coerce(value);
}

/**
 * Assert the type of a value
 *
 * @param {*} value
 * @param {Function} type
 * @return {Object}
 */

function assertType(value, type) {
  var valid;
  var expectedType;
  if (type === String) {
    expectedType = 'string';
    valid = typeof value === expectedType;
  } else if (type === Number) {
    expectedType = 'number';
    valid = typeof value === expectedType;
  } else if (type === Boolean) {
    expectedType = 'boolean';
    valid = typeof value === expectedType;
  } else if (type === Function) {
    expectedType = 'function';
    valid = typeof value === expectedType;
  } else if (type === Object) {
    expectedType = 'object';
    valid = isPlainObject(value);
  } else if (type === Array) {
    expectedType = 'array';
    valid = isArray(value);
  } else {
    valid = value instanceof type;
  }
  return {
    valid: valid,
    expectedType: expectedType
  };
}

/**
 * Format type for output
 *
 * @param {String} type
 * @return {String}
 */

function formatType(type) {
  return type ? type.charAt(0).toUpperCase() + type.slice(1) : 'custom type';
}

/**
 * Format value
 *
 * @param {*} value
 * @return {String}
 */

function formatValue(val) {
  return Object.prototype.toString.call(val).slice(8, -1);
}

var bindingModes = config._propBindingModes;

var propDef = {

  bind: function bind() {
    var child = this.vm;
    var parent = child._context;
    // passed in from compiler directly
    var prop = this.descriptor.prop;
    var childKey = prop.path;
    var parentKey = prop.parentPath;
    var twoWay = prop.mode === bindingModes.TWO_WAY;

    var parentWatcher = this.parentWatcher = new Watcher(parent, parentKey, function (val) {
      updateProp(child, prop, val);
    }, {
      twoWay: twoWay,
      filters: prop.filters,
      // important: props need to be observed on the
      // v-for scope if present
      scope: this._scope
    });

    // set the child initial value.
    initProp(child, prop, parentWatcher.value);

    // setup two-way binding
    if (twoWay) {
      // important: defer the child watcher creation until
      // the created hook (after data observation)
      var self = this;
      child.$once('pre-hook:created', function () {
        self.childWatcher = new Watcher(child, childKey, function (val) {
          parentWatcher.set(val);
        }, {
          // ensure sync upward before parent sync down.
          // this is necessary in cases e.g. the child
          // mutates a prop array, then replaces it. (#1683)
          sync: true
        });
      });
    }
  },

  unbind: function unbind() {
    this.parentWatcher.teardown();
    if (this.childWatcher) {
      this.childWatcher.teardown();
    }
  }
};

var queue$1 = [];
var queued = false;

/**
 * Push a job into the queue.
 *
 * @param {Function} job
 */

function pushJob(job) {
  queue$1.push(job);
  if (!queued) {
    queued = true;
    nextTick(flush);
  }
}

/**
 * Flush the queue, and do one forced reflow before
 * triggering transitions.
 */

function flush() {
  // Force layout
  var f = document.documentElement.offsetHeight;
  for (var i = 0; i < queue$1.length; i++) {
    queue$1[i]();
  }
  queue$1 = [];
  queued = false;
  // dummy return, so js linters don't complain about
  // unused variable f
  return f;
}

var TYPE_TRANSITION = 'transition';
var TYPE_ANIMATION = 'animation';
var transDurationProp = transitionProp + 'Duration';
var animDurationProp = animationProp + 'Duration';

/**
 * If a just-entered element is applied the
 * leave class while its enter transition hasn't started yet,
 * and the transitioned property has the same value for both
 * enter/leave, then the leave transition will be skipped and
 * the transitionend event never fires. This function ensures
 * its callback to be called after a transition has started
 * by waiting for double raf.
 *
 * It falls back to setTimeout on devices that support CSS
 * transitions but not raf (e.g. Android 4.2 browser) - since
 * these environments are usually slow, we are giving it a
 * relatively large timeout.
 */

var raf = inBrowser && window.requestAnimationFrame;
var waitForTransitionStart = raf
/* istanbul ignore next */
? function (fn) {
  raf(function () {
    raf(fn);
  });
} : function (fn) {
  setTimeout(fn, 50);
};

/**
 * A Transition object that encapsulates the state and logic
 * of the transition.
 *
 * @param {Element} el
 * @param {String} id
 * @param {Object} hooks
 * @param {Vue} vm
 */
function Transition(el, id, hooks, vm) {
  this.id = id;
  this.el = el;
  this.enterClass = hooks && hooks.enterClass || id + '-enter';
  this.leaveClass = hooks && hooks.leaveClass || id + '-leave';
  this.hooks = hooks;
  this.vm = vm;
  // async state
  this.pendingCssEvent = this.pendingCssCb = this.cancel = this.pendingJsCb = this.op = this.cb = null;
  this.justEntered = false;
  this.entered = this.left = false;
  this.typeCache = {};
  // check css transition type
  this.type = hooks && hooks.type;
  /* istanbul ignore if */
  if (process.env.NODE_ENV !== 'production') {
    if (this.type && this.type !== TYPE_TRANSITION && this.type !== TYPE_ANIMATION) {
      warn('invalid CSS transition type for transition="' + this.id + '": ' + this.type, vm);
    }
  }
  // bind
  var self = this;['enterNextTick', 'enterDone', 'leaveNextTick', 'leaveDone'].forEach(function (m) {
    self[m] = bind(self[m], self);
  });
}

var p$1 = Transition.prototype;

/**
 * Start an entering transition.
 *
 * 1. enter transition triggered
 * 2. call beforeEnter hook
 * 3. add enter class
 * 4. insert/show element
 * 5. call enter hook (with possible explicit js callback)
 * 6. reflow
 * 7. based on transition type:
 *    - transition:
 *        remove class now, wait for transitionend,
 *        then done if there's no explicit js callback.
 *    - animation:
 *        wait for animationend, remove class,
 *        then done if there's no explicit js callback.
 *    - no css transition:
 *        done now if there's no explicit js callback.
 * 8. wait for either done or js callback, then call
 *    afterEnter hook.
 *
 * @param {Function} op - insert/show the element
 * @param {Function} [cb]
 */

p$1.enter = function (op, cb) {
  this.cancelPending();
  this.callHook('beforeEnter');
  this.cb = cb;
  addClass(this.el, this.enterClass);
  op();
  this.entered = false;
  this.callHookWithCb('enter');
  if (this.entered) {
    return; // user called done synchronously.
  }
  this.cancel = this.hooks && this.hooks.enterCancelled;
  pushJob(this.enterNextTick);
};

/**
 * The "nextTick" phase of an entering transition, which is
 * to be pushed into a queue and executed after a reflow so
 * that removing the class can trigger a CSS transition.
 */

p$1.enterNextTick = function () {
  var _this = this;

  // prevent transition skipping
  this.justEntered = true;
  waitForTransitionStart(function () {
    _this.justEntered = false;
  });
  var enterDone = this.enterDone;
  var type = this.getCssTransitionType(this.enterClass);
  if (!this.pendingJsCb) {
    if (type === TYPE_TRANSITION) {
      // trigger transition by removing enter class now
      removeClass(this.el, this.enterClass);
      this.setupCssCb(transitionEndEvent, enterDone);
    } else if (type === TYPE_ANIMATION) {
      this.setupCssCb(animationEndEvent, enterDone);
    } else {
      enterDone();
    }
  } else if (type === TYPE_TRANSITION) {
    removeClass(this.el, this.enterClass);
  }
};

/**
 * The "cleanup" phase of an entering transition.
 */

p$1.enterDone = function () {
  this.entered = true;
  this.cancel = this.pendingJsCb = null;
  removeClass(this.el, this.enterClass);
  this.callHook('afterEnter');
  if (this.cb) this.cb();
};

/**
 * Start a leaving transition.
 *
 * 1. leave transition triggered.
 * 2. call beforeLeave hook
 * 3. add leave class (trigger css transition)
 * 4. call leave hook (with possible explicit js callback)
 * 5. reflow if no explicit js callback is provided
 * 6. based on transition type:
 *    - transition or animation:
 *        wait for end event, remove class, then done if
 *        there's no explicit js callback.
 *    - no css transition:
 *        done if there's no explicit js callback.
 * 7. wait for either done or js callback, then call
 *    afterLeave hook.
 *
 * @param {Function} op - remove/hide the element
 * @param {Function} [cb]
 */

p$1.leave = function (op, cb) {
  this.cancelPending();
  this.callHook('beforeLeave');
  this.op = op;
  this.cb = cb;
  addClass(this.el, this.leaveClass);
  this.left = false;
  this.callHookWithCb('leave');
  if (this.left) {
    return; // user called done synchronously.
  }
  this.cancel = this.hooks && this.hooks.leaveCancelled;
  // only need to handle leaveDone if
  // 1. the transition is already done (synchronously called
  //    by the user, which causes this.op set to null)
  // 2. there's no explicit js callback
  if (this.op && !this.pendingJsCb) {
    // if a CSS transition leaves immediately after enter,
    // the transitionend event never fires. therefore we
    // detect such cases and end the leave immediately.
    if (this.justEntered) {
      this.leaveDone();
    } else {
      pushJob(this.leaveNextTick);
    }
  }
};

/**
 * The "nextTick" phase of a leaving transition.
 */

p$1.leaveNextTick = function () {
  var type = this.getCssTransitionType(this.leaveClass);
  if (type) {
    var event = type === TYPE_TRANSITION ? transitionEndEvent : animationEndEvent;
    this.setupCssCb(event, this.leaveDone);
  } else {
    this.leaveDone();
  }
};

/**
 * The "cleanup" phase of a leaving transition.
 */

p$1.leaveDone = function () {
  this.left = true;
  this.cancel = this.pendingJsCb = null;
  this.op();
  removeClass(this.el, this.leaveClass);
  this.callHook('afterLeave');
  if (this.cb) this.cb();
  this.op = null;
};

/**
 * Cancel any pending callbacks from a previously running
 * but not finished transition.
 */

p$1.cancelPending = function () {
  this.op = this.cb = null;
  var hasPending = false;
  if (this.pendingCssCb) {
    hasPending = true;
    off(this.el, this.pendingCssEvent, this.pendingCssCb);
    this.pendingCssEvent = this.pendingCssCb = null;
  }
  if (this.pendingJsCb) {
    hasPending = true;
    this.pendingJsCb.cancel();
    this.pendingJsCb = null;
  }
  if (hasPending) {
    removeClass(this.el, this.enterClass);
    removeClass(this.el, this.leaveClass);
  }
  if (this.cancel) {
    this.cancel.call(this.vm, this.el);
    this.cancel = null;
  }
};

/**
 * Call a user-provided synchronous hook function.
 *
 * @param {String} type
 */

p$1.callHook = function (type) {
  if (this.hooks && this.hooks[type]) {
    this.hooks[type].call(this.vm, this.el);
  }
};

/**
 * Call a user-provided, potentially-async hook function.
 * We check for the length of arguments to see if the hook
 * expects a `done` callback. If true, the transition's end
 * will be determined by when the user calls that callback;
 * otherwise, the end is determined by the CSS transition or
 * animation.
 *
 * @param {String} type
 */

p$1.callHookWithCb = function (type) {
  var hook = this.hooks && this.hooks[type];
  if (hook) {
    if (hook.length > 1) {
      this.pendingJsCb = cancellable(this[type + 'Done']);
    }
    hook.call(this.vm, this.el, this.pendingJsCb);
  }
};

/**
 * Get an element's transition type based on the
 * calculated styles.
 *
 * @param {String} className
 * @return {Number}
 */

p$1.getCssTransitionType = function (className) {
  /* istanbul ignore if */
  if (!transitionEndEvent ||
  // skip CSS transitions if page is not visible -
  // this solves the issue of transitionend events not
  // firing until the page is visible again.
  // pageVisibility API is supported in IE10+, same as
  // CSS transitions.
  document.hidden ||
  // explicit js-only transition
  this.hooks && this.hooks.css === false ||
  // element is hidden
  isHidden(this.el)) {
    return;
  }
  var type = this.type || this.typeCache[className];
  if (type) return type;
  var inlineStyles = this.el.style;
  var computedStyles = window.getComputedStyle(this.el);
  var transDuration = inlineStyles[transDurationProp] || computedStyles[transDurationProp];
  if (transDuration && transDuration !== '0s') {
    type = TYPE_TRANSITION;
  } else {
    var animDuration = inlineStyles[animDurationProp] || computedStyles[animDurationProp];
    if (animDuration && animDuration !== '0s') {
      type = TYPE_ANIMATION;
    }
  }
  if (type) {
    this.typeCache[className] = type;
  }
  return type;
};

/**
 * Setup a CSS transitionend/animationend callback.
 *
 * @param {String} event
 * @param {Function} cb
 */

p$1.setupCssCb = function (event, cb) {
  this.pendingCssEvent = event;
  var self = this;
  var el = this.el;
  var onEnd = this.pendingCssCb = function (e) {
    if (e.target === el) {
      off(el, event, onEnd);
      self.pendingCssEvent = self.pendingCssCb = null;
      if (!self.pendingJsCb && cb) {
        cb();
      }
    }
  };
  on(el, event, onEnd);
};

/**
 * Check if an element is hidden - in that case we can just
 * skip the transition alltogether.
 *
 * @param {Element} el
 * @return {Boolean}
 */

function isHidden(el) {
  if (/svg$/.test(el.namespaceURI)) {
    // SVG elements do not have offset(Width|Height)
    // so we need to check the client rect
    var rect = el.getBoundingClientRect();
    return !(rect.width || rect.height);
  } else {
    return !(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
  }
}

var transition$1 = {

  priority: TRANSITION,

  update: function update(id, oldId) {
    var el = this.el;
    // resolve on owner vm
    var hooks = resolveAsset(this.vm.$options, 'transitions', id);
    id = id || 'v';
    el.__v_trans = new Transition(el, id, hooks, this.vm);
    if (oldId) {
      removeClass(el, oldId + '-transition');
    }
    addClass(el, id + '-transition');
  }
};

var internalDirectives = {
  style: style,
  'class': vClass,
  component: component,
  prop: propDef,
  transition: transition$1
};

// special binding prefixes
var bindRE = /^v-bind:|^:/;
var onRE = /^v-on:|^@/;
var dirAttrRE = /^v-([^:]+)(?:$|:(.*)$)/;
var modifierRE = /\.[^\.]+/g;
var transitionRE = /^(v-bind:|:)?transition$/;

// default directive priority
var DEFAULT_PRIORITY = 1000;
var DEFAULT_TERMINAL_PRIORITY = 2000;

/**
 * Compile a template and return a reusable composite link
 * function, which recursively contains more link functions
 * inside. This top level compile function would normally
 * be called on instance root nodes, but can also be used
 * for partial compilation if the partial argument is true.
 *
 * The returned composite link function, when called, will
 * return an unlink function that tearsdown all directives
 * created during the linking phase.
 *
 * @param {Element|DocumentFragment} el
 * @param {Object} options
 * @param {Boolean} partial
 * @return {Function}
 */

function compile(el, options, partial) {
  // link function for the node itself.
  var nodeLinkFn = partial || !options._asComponent ? compileNode(el, options) : null;
  // link function for the childNodes
  var childLinkFn = !(nodeLinkFn && nodeLinkFn.terminal) && !isScript(el) && el.hasChildNodes() ? compileNodeList(el.childNodes, options) : null;

  /**
   * A composite linker function to be called on a already
   * compiled piece of DOM, which instantiates all directive
   * instances.
   *
   * @param {Vue} vm
   * @param {Element|DocumentFragment} el
   * @param {Vue} [host] - host vm of transcluded content
   * @param {Object} [scope] - v-for scope
   * @param {Fragment} [frag] - link context fragment
   * @return {Function|undefined}
   */

  return function compositeLinkFn(vm, el, host, scope, frag) {
    // cache childNodes before linking parent, fix #657
    var childNodes = toArray(el.childNodes);
    // link
    var dirs = linkAndCapture(function compositeLinkCapturer() {
      if (nodeLinkFn) nodeLinkFn(vm, el, host, scope, frag);
      if (childLinkFn) childLinkFn(vm, childNodes, host, scope, frag);
    }, vm);
    return makeUnlinkFn(vm, dirs);
  };
}

/**
 * Apply a linker to a vm/element pair and capture the
 * directives created during the process.
 *
 * @param {Function} linker
 * @param {Vue} vm
 */

function linkAndCapture(linker, vm) {
  /* istanbul ignore if */
  if (process.env.NODE_ENV === 'production') {
    // reset directives before every capture in production
    // mode, so that when unlinking we don't need to splice
    // them out (which turns out to be a perf hit).
    // they are kept in development mode because they are
    // useful for Vue's own tests.
    vm._directives = [];
  }
  var originalDirCount = vm._directives.length;
  linker();
  var dirs = vm._directives.slice(originalDirCount);
  dirs.sort(directiveComparator);
  for (var i = 0, l = dirs.length; i < l; i++) {
    dirs[i]._bind();
  }
  return dirs;
}

/**
 * Directive priority sort comparator
 *
 * @param {Object} a
 * @param {Object} b
 */

function directiveComparator(a, b) {
  a = a.descriptor.def.priority || DEFAULT_PRIORITY;
  b = b.descriptor.def.priority || DEFAULT_PRIORITY;
  return a > b ? -1 : a === b ? 0 : 1;
}

/**
 * Linker functions return an unlink function that
 * tearsdown all directives instances generated during
 * the process.
 *
 * We create unlink functions with only the necessary
 * information to avoid retaining additional closures.
 *
 * @param {Vue} vm
 * @param {Array} dirs
 * @param {Vue} [context]
 * @param {Array} [contextDirs]
 * @return {Function}
 */

function makeUnlinkFn(vm, dirs, context, contextDirs) {
  function unlink(destroying) {
    teardownDirs(vm, dirs, destroying);
    if (context && contextDirs) {
      teardownDirs(context, contextDirs);
    }
  }
  // expose linked directives
  unlink.dirs = dirs;
  return unlink;
}

/**
 * Teardown partial linked directives.
 *
 * @param {Vue} vm
 * @param {Array} dirs
 * @param {Boolean} destroying
 */

function teardownDirs(vm, dirs, destroying) {
  var i = dirs.length;
  while (i--) {
    dirs[i]._teardown();
    if (process.env.NODE_ENV !== 'production' && !destroying) {
      vm._directives.$remove(dirs[i]);
    }
  }
}

/**
 * Compile link props on an instance.
 *
 * @param {Vue} vm
 * @param {Element} el
 * @param {Object} props
 * @param {Object} [scope]
 * @return {Function}
 */

function compileAndLinkProps(vm, el, props, scope) {
  var propsLinkFn = compileProps(el, props, vm);
  var propDirs = linkAndCapture(function () {
    propsLinkFn(vm, scope);
  }, vm);
  return makeUnlinkFn(vm, propDirs);
}

/**
 * Compile the root element of an instance.
 *
 * 1. attrs on context container (context scope)
 * 2. attrs on the component template root node, if
 *    replace:true (child scope)
 *
 * If this is a fragment instance, we only need to compile 1.
 *
 * @param {Element} el
 * @param {Object} options
 * @param {Object} contextOptions
 * @return {Function}
 */

function compileRoot(el, options, contextOptions) {
  var containerAttrs = options._containerAttrs;
  var replacerAttrs = options._replacerAttrs;
  var contextLinkFn, replacerLinkFn;

  // only need to compile other attributes for
  // non-fragment instances
  if (el.nodeType !== 11) {
    // for components, container and replacer need to be
    // compiled separately and linked in different scopes.
    if (options._asComponent) {
      // 2. container attributes
      if (containerAttrs && contextOptions) {
        contextLinkFn = compileDirectives(containerAttrs, contextOptions);
      }
      if (replacerAttrs) {
        // 3. replacer attributes
        replacerLinkFn = compileDirectives(replacerAttrs, options);
      }
    } else {
      // non-component, just compile as a normal element.
      replacerLinkFn = compileDirectives(el.attributes, options);
    }
  } else if (process.env.NODE_ENV !== 'production' && containerAttrs) {
    // warn container directives for fragment instances
    var names = containerAttrs.filter(function (attr) {
      // allow vue-loader/vueify scoped css attributes
      return attr.name.indexOf('_v-') < 0 &&
      // allow event listeners
      !onRE.test(attr.name) &&
      // allow slots
      attr.name !== 'slot';
    }).map(function (attr) {
      return '"' + attr.name + '"';
    });
    if (names.length) {
      var plural = names.length > 1;
      warn('Attribute' + (plural ? 's ' : ' ') + names.join(', ') + (plural ? ' are' : ' is') + ' ignored on component ' + '<' + options.el.tagName.toLowerCase() + '> because ' + 'the component is a fragment instance: ' + 'http://vuejs.org/guide/components.html#Fragment-Instance');
    }
  }

  options._containerAttrs = options._replacerAttrs = null;
  return function rootLinkFn(vm, el, scope) {
    // link context scope dirs
    var context = vm._context;
    var contextDirs;
    if (context && contextLinkFn) {
      contextDirs = linkAndCapture(function () {
        contextLinkFn(context, el, null, scope);
      }, context);
    }

    // link self
    var selfDirs = linkAndCapture(function () {
      if (replacerLinkFn) replacerLinkFn(vm, el);
    }, vm);

    // return the unlink function that tearsdown context
    // container directives.
    return makeUnlinkFn(vm, selfDirs, context, contextDirs);
  };
}

/**
 * Compile a node and return a nodeLinkFn based on the
 * node type.
 *
 * @param {Node} node
 * @param {Object} options
 * @return {Function|null}
 */

function compileNode(node, options) {
  var type = node.nodeType;
  if (type === 1 && !isScript(node)) {
    return compileElement(node, options);
  } else if (type === 3 && node.data.trim()) {
    return compileTextNode(node, options);
  } else {
    return null;
  }
}

/**
 * Compile an element and return a nodeLinkFn.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Function|null}
 */

function compileElement(el, options) {
  // preprocess textareas.
  // textarea treats its text content as the initial value.
  // just bind it as an attr directive for value.
  if (el.tagName === 'TEXTAREA') {
    var tokens = parseText(el.value);
    if (tokens) {
      el.setAttribute(':value', tokensToExp(tokens));
      el.value = '';
    }
  }
  var linkFn;
  var hasAttrs = el.hasAttributes();
  var attrs = hasAttrs && toArray(el.attributes);
  // check terminal directives (for & if)
  if (hasAttrs) {
    linkFn = checkTerminalDirectives(el, attrs, options);
  }
  // check element directives
  if (!linkFn) {
    linkFn = checkElementDirectives(el, options);
  }
  // check component
  if (!linkFn) {
    linkFn = checkComponent(el, options);
  }
  // normal directives
  if (!linkFn && hasAttrs) {
    linkFn = compileDirectives(attrs, options);
  }
  return linkFn;
}

/**
 * Compile a textNode and return a nodeLinkFn.
 *
 * @param {TextNode} node
 * @param {Object} options
 * @return {Function|null} textNodeLinkFn
 */

function compileTextNode(node, options) {
  // skip marked text nodes
  if (node._skip) {
    return removeText;
  }

  var tokens = parseText(node.wholeText);
  if (!tokens) {
    return null;
  }

  // mark adjacent text nodes as skipped,
  // because we are using node.wholeText to compile
  // all adjacent text nodes together. This fixes
  // issues in IE where sometimes it splits up a single
  // text node into multiple ones.
  var next = node.nextSibling;
  while (next && next.nodeType === 3) {
    next._skip = true;
    next = next.nextSibling;
  }

  var frag = document.createDocumentFragment();
  var el, token;
  for (var i = 0, l = tokens.length; i < l; i++) {
    token = tokens[i];
    el = token.tag ? processTextToken(token, options) : document.createTextNode(token.value);
    frag.appendChild(el);
  }
  return makeTextNodeLinkFn(tokens, frag, options);
}

/**
 * Linker for an skipped text node.
 *
 * @param {Vue} vm
 * @param {Text} node
 */

function removeText(vm, node) {
  remove(node);
}

/**
 * Process a single text token.
 *
 * @param {Object} token
 * @param {Object} options
 * @return {Node}
 */

function processTextToken(token, options) {
  var el;
  if (token.oneTime) {
    el = document.createTextNode(token.value);
  } else {
    if (token.html) {
      el = document.createComment('v-html');
      setTokenType('html');
    } else {
      // IE will clean up empty textNodes during
      // frag.cloneNode(true), so we have to give it
      // something here...
      el = document.createTextNode(' ');
      setTokenType('text');
    }
  }
  function setTokenType(type) {
    if (token.descriptor) return;
    var parsed = parseDirective(token.value);
    token.descriptor = {
      name: type,
      def: directives[type],
      expression: parsed.expression,
      filters: parsed.filters
    };
  }
  return el;
}

/**
 * Build a function that processes a textNode.
 *
 * @param {Array<Object>} tokens
 * @param {DocumentFragment} frag
 */

function makeTextNodeLinkFn(tokens, frag) {
  return function textNodeLinkFn(vm, el, host, scope) {
    var fragClone = frag.cloneNode(true);
    var childNodes = toArray(fragClone.childNodes);
    var token, value, node;
    for (var i = 0, l = tokens.length; i < l; i++) {
      token = tokens[i];
      value = token.value;
      if (token.tag) {
        node = childNodes[i];
        if (token.oneTime) {
          value = (scope || vm).$eval(value);
          if (token.html) {
            replace(node, parseTemplate(value, true));
          } else {
            node.data = value;
          }
        } else {
          vm._bindDir(token.descriptor, node, host, scope);
        }
      }
    }
    replace(el, fragClone);
  };
}

/**
 * Compile a node list and return a childLinkFn.
 *
 * @param {NodeList} nodeList
 * @param {Object} options
 * @return {Function|undefined}
 */

function compileNodeList(nodeList, options) {
  var linkFns = [];
  var nodeLinkFn, childLinkFn, node;
  for (var i = 0, l = nodeList.length; i < l; i++) {
    node = nodeList[i];
    nodeLinkFn = compileNode(node, options);
    childLinkFn = !(nodeLinkFn && nodeLinkFn.terminal) && node.tagName !== 'SCRIPT' && node.hasChildNodes() ? compileNodeList(node.childNodes, options) : null;
    linkFns.push(nodeLinkFn, childLinkFn);
  }
  return linkFns.length ? makeChildLinkFn(linkFns) : null;
}

/**
 * Make a child link function for a node's childNodes.
 *
 * @param {Array<Function>} linkFns
 * @return {Function} childLinkFn
 */

function makeChildLinkFn(linkFns) {
  return function childLinkFn(vm, nodes, host, scope, frag) {
    var node, nodeLinkFn, childrenLinkFn;
    for (var i = 0, n = 0, l = linkFns.length; i < l; n++) {
      node = nodes[n];
      nodeLinkFn = linkFns[i++];
      childrenLinkFn = linkFns[i++];
      // cache childNodes before linking parent, fix #657
      var childNodes = toArray(node.childNodes);
      if (nodeLinkFn) {
        nodeLinkFn(vm, node, host, scope, frag);
      }
      if (childrenLinkFn) {
        childrenLinkFn(vm, childNodes, host, scope, frag);
      }
    }
  };
}

/**
 * Check for element directives (custom elements that should
 * be resovled as terminal directives).
 *
 * @param {Element} el
 * @param {Object} options
 */

function checkElementDirectives(el, options) {
  var tag = el.tagName.toLowerCase();
  if (commonTagRE.test(tag)) {
    return;
  }
  var def = resolveAsset(options, 'elementDirectives', tag);
  if (def) {
    return makeTerminalNodeLinkFn(el, tag, '', options, def);
  }
}

/**
 * Check if an element is a component. If yes, return
 * a component link function.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Function|undefined}
 */

function checkComponent(el, options) {
  var component = checkComponentAttr(el, options);
  if (component) {
    var ref = findRef(el);
    var descriptor = {
      name: 'component',
      ref: ref,
      expression: component.id,
      def: internalDirectives.component,
      modifiers: {
        literal: !component.dynamic
      }
    };
    var componentLinkFn = function componentLinkFn(vm, el, host, scope, frag) {
      if (ref) {
        defineReactive((scope || vm).$refs, ref, null);
      }
      vm._bindDir(descriptor, el, host, scope, frag);
    };
    componentLinkFn.terminal = true;
    return componentLinkFn;
  }
}

/**
 * Check an element for terminal directives in fixed order.
 * If it finds one, return a terminal link function.
 *
 * @param {Element} el
 * @param {Array} attrs
 * @param {Object} options
 * @return {Function} terminalLinkFn
 */

function checkTerminalDirectives(el, attrs, options) {
  // skip v-pre
  if (getAttr(el, 'v-pre') !== null) {
    return skip;
  }
  // skip v-else block, but only if following v-if
  if (el.hasAttribute('v-else')) {
    var prev = el.previousElementSibling;
    if (prev && prev.hasAttribute('v-if')) {
      return skip;
    }
  }

  var attr, name, value, modifiers, matched, dirName, rawName, arg, def, termDef;
  for (var i = 0, j = attrs.length; i < j; i++) {
    attr = attrs[i];
    name = attr.name.replace(modifierRE, '');
    if (matched = name.match(dirAttrRE)) {
      def = resolveAsset(options, 'directives', matched[1]);
      if (def && def.terminal) {
        if (!termDef || (def.priority || DEFAULT_TERMINAL_PRIORITY) > termDef.priority) {
          termDef = def;
          rawName = attr.name;
          modifiers = parseModifiers(attr.name);
          value = attr.value;
          dirName = matched[1];
          arg = matched[2];
        }
      }
    }
  }

  if (termDef) {
    return makeTerminalNodeLinkFn(el, dirName, value, options, termDef, rawName, arg, modifiers);
  }
}

function skip() {}
skip.terminal = true;

/**
 * Build a node link function for a terminal directive.
 * A terminal link function terminates the current
 * compilation recursion and handles compilation of the
 * subtree in the directive.
 *
 * @param {Element} el
 * @param {String} dirName
 * @param {String} value
 * @param {Object} options
 * @param {Object} def
 * @param {String} [rawName]
 * @param {String} [arg]
 * @param {Object} [modifiers]
 * @return {Function} terminalLinkFn
 */

function makeTerminalNodeLinkFn(el, dirName, value, options, def, rawName, arg, modifiers) {
  var parsed = parseDirective(value);
  var descriptor = {
    name: dirName,
    arg: arg,
    expression: parsed.expression,
    filters: parsed.filters,
    raw: value,
    attr: rawName,
    modifiers: modifiers,
    def: def
  };
  // check ref for v-for and router-view
  if (dirName === 'for' || dirName === 'router-view') {
    descriptor.ref = findRef(el);
  }
  var fn = function terminalNodeLinkFn(vm, el, host, scope, frag) {
    if (descriptor.ref) {
      defineReactive((scope || vm).$refs, descriptor.ref, null);
    }
    vm._bindDir(descriptor, el, host, scope, frag);
  };
  fn.terminal = true;
  return fn;
}

/**
 * Compile the directives on an element and return a linker.
 *
 * @param {Array|NamedNodeMap} attrs
 * @param {Object} options
 * @return {Function}
 */

function compileDirectives(attrs, options) {
  var i = attrs.length;
  var dirs = [];
  var attr, name, value, rawName, rawValue, dirName, arg, modifiers, dirDef, tokens, matched;
  while (i--) {
    attr = attrs[i];
    name = rawName = attr.name;
    value = rawValue = attr.value;
    tokens = parseText(value);
    // reset arg
    arg = null;
    // check modifiers
    modifiers = parseModifiers(name);
    name = name.replace(modifierRE, '');

    // attribute interpolations
    if (tokens) {
      value = tokensToExp(tokens);
      arg = name;
      pushDir('bind', directives.bind, tokens);
      // warn against mixing mustaches with v-bind
      if (process.env.NODE_ENV !== 'production') {
        if (name === 'class' && Array.prototype.some.call(attrs, function (attr) {
          return attr.name === ':class' || attr.name === 'v-bind:class';
        })) {
          warn('class="' + rawValue + '": Do not mix mustache interpolation ' + 'and v-bind for "class" on the same element. Use one or the other.', options);
        }
      }
    } else

      // special attribute: transition
      if (transitionRE.test(name)) {
        modifiers.literal = !bindRE.test(name);
        pushDir('transition', internalDirectives.transition);
      } else

        // event handlers
        if (onRE.test(name)) {
          arg = name.replace(onRE, '');
          pushDir('on', directives.on);
        } else

          // attribute bindings
          if (bindRE.test(name)) {
            dirName = name.replace(bindRE, '');
            if (dirName === 'style' || dirName === 'class') {
              pushDir(dirName, internalDirectives[dirName]);
            } else {
              arg = dirName;
              pushDir('bind', directives.bind);
            }
          } else

            // normal directives
            if (matched = name.match(dirAttrRE)) {
              dirName = matched[1];
              arg = matched[2];

              // skip v-else (when used with v-show)
              if (dirName === 'else') {
                continue;
              }

              dirDef = resolveAsset(options, 'directives', dirName, true);
              if (dirDef) {
                pushDir(dirName, dirDef);
              }
            }
  }

  /**
   * Push a directive.
   *
   * @param {String} dirName
   * @param {Object|Function} def
   * @param {Array} [interpTokens]
   */

  function pushDir(dirName, def, interpTokens) {
    var hasOneTimeToken = interpTokens && hasOneTime(interpTokens);
    var parsed = !hasOneTimeToken && parseDirective(value);
    dirs.push({
      name: dirName,
      attr: rawName,
      raw: rawValue,
      def: def,
      arg: arg,
      modifiers: modifiers,
      // conversion from interpolation strings with one-time token
      // to expression is differed until directive bind time so that we
      // have access to the actual vm context for one-time bindings.
      expression: parsed && parsed.expression,
      filters: parsed && parsed.filters,
      interp: interpTokens,
      hasOneTime: hasOneTimeToken
    });
  }

  if (dirs.length) {
    return makeNodeLinkFn(dirs);
  }
}

/**
 * Parse modifiers from directive attribute name.
 *
 * @param {String} name
 * @return {Object}
 */

function parseModifiers(name) {
  var res = Object.create(null);
  var match = name.match(modifierRE);
  if (match) {
    var i = match.length;
    while (i--) {
      res[match[i].slice(1)] = true;
    }
  }
  return res;
}

/**
 * Build a link function for all directives on a single node.
 *
 * @param {Array} directives
 * @return {Function} directivesLinkFn
 */

function makeNodeLinkFn(directives) {
  return function nodeLinkFn(vm, el, host, scope, frag) {
    // reverse apply because it's sorted low to high
    var i = directives.length;
    while (i--) {
      vm._bindDir(directives[i], el, host, scope, frag);
    }
  };
}

/**
 * Check if an interpolation string contains one-time tokens.
 *
 * @param {Array} tokens
 * @return {Boolean}
 */

function hasOneTime(tokens) {
  var i = tokens.length;
  while (i--) {
    if (tokens[i].oneTime) return true;
  }
}

function isScript(el) {
  return el.tagName === 'SCRIPT' && (!el.hasAttribute('type') || el.getAttribute('type') === 'text/javascript');
}

var specialCharRE = /[^\w\-:\.]/;

/**
 * Process an element or a DocumentFragment based on a
 * instance option object. This allows us to transclude
 * a template node/fragment before the instance is created,
 * so the processed fragment can then be cloned and reused
 * in v-for.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Element|DocumentFragment}
 */

function transclude(el, options) {
  // extract container attributes to pass them down
  // to compiler, because they need to be compiled in
  // parent scope. we are mutating the options object here
  // assuming the same object will be used for compile
  // right after this.
  if (options) {
    options._containerAttrs = extractAttrs(el);
  }
  // for template tags, what we want is its content as
  // a documentFragment (for fragment instances)
  if (isTemplate(el)) {
    el = parseTemplate(el);
  }
  if (options) {
    if (options._asComponent && !options.template) {
      options.template = '<slot></slot>';
    }
    if (options.template) {
      options._content = extractContent(el);
      el = transcludeTemplate(el, options);
    }
  }
  if (isFragment(el)) {
    // anchors for fragment instance
    // passing in `persist: true` to avoid them being
    // discarded by IE during template cloning
    prepend(createAnchor('v-start', true), el);
    el.appendChild(createAnchor('v-end', true));
  }
  return el;
}

/**
 * Process the template option.
 * If the replace option is true this will swap the $el.
 *
 * @param {Element} el
 * @param {Object} options
 * @return {Element|DocumentFragment}
 */

function transcludeTemplate(el, options) {
  var template = options.template;
  var frag = parseTemplate(template, true);
  if (frag) {
    var replacer = frag.firstChild;
    var tag = replacer.tagName && replacer.tagName.toLowerCase();
    if (options.replace) {
      /* istanbul ignore if */
      if (el === document.body) {
        process.env.NODE_ENV !== 'production' && warn('You are mounting an instance with a template to ' + '<body>. This will replace <body> entirely. You ' + 'should probably use `replace: false` here.');
      }
      // there are many cases where the instance must
      // become a fragment instance: basically anything that
      // can create more than 1 root nodes.
      if (
      // multi-children template
      frag.childNodes.length > 1 ||
      // non-element template
      replacer.nodeType !== 1 ||
      // single nested component
      tag === 'component' || resolveAsset(options, 'components', tag) || hasBindAttr(replacer, 'is') ||
      // element directive
      resolveAsset(options, 'elementDirectives', tag) ||
      // for block
      replacer.hasAttribute('v-for') ||
      // if block
      replacer.hasAttribute('v-if')) {
        return frag;
      } else {
        options._replacerAttrs = extractAttrs(replacer);
        mergeAttrs(el, replacer);
        return replacer;
      }
    } else {
      el.appendChild(frag);
      return el;
    }
  } else {
    process.env.NODE_ENV !== 'production' && warn('Invalid template option: ' + template);
  }
}

/**
 * Helper to extract a component container's attributes
 * into a plain object array.
 *
 * @param {Element} el
 * @return {Array}
 */

function extractAttrs(el) {
  if (el.nodeType === 1 && el.hasAttributes()) {
    return toArray(el.attributes);
  }
}

/**
 * Merge the attributes of two elements, and make sure
 * the class names are merged properly.
 *
 * @param {Element} from
 * @param {Element} to
 */

function mergeAttrs(from, to) {
  var attrs = from.attributes;
  var i = attrs.length;
  var name, value;
  while (i--) {
    name = attrs[i].name;
    value = attrs[i].value;
    if (!to.hasAttribute(name) && !specialCharRE.test(name)) {
      to.setAttribute(name, value);
    } else if (name === 'class' && !parseText(value) && (value = value.trim())) {
      value.split(/\s+/).forEach(function (cls) {
        addClass(to, cls);
      });
    }
  }
}

/**
 * Scan and determine slot content distribution.
 * We do this during transclusion instead at compile time so that
 * the distribution is decoupled from the compilation order of
 * the slots.
 *
 * @param {Element|DocumentFragment} template
 * @param {Element} content
 * @param {Vue} vm
 */

function resolveSlots(vm, content) {
  if (!content) {
    return;
  }
  var contents = vm._slotContents = Object.create(null);
  var el, name;
  for (var i = 0, l = content.children.length; i < l; i++) {
    el = content.children[i];
    /* eslint-disable no-cond-assign */
    if (name = el.getAttribute('slot')) {
      (contents[name] || (contents[name] = [])).push(el);
    }
    /* eslint-enable no-cond-assign */
    if (process.env.NODE_ENV !== 'production' && getBindAttr(el, 'slot')) {
      warn('The "slot" attribute must be static.', vm.$parent);
    }
  }
  for (name in contents) {
    contents[name] = extractFragment(contents[name], content);
  }
  if (content.hasChildNodes()) {
    var nodes = content.childNodes;
    if (nodes.length === 1 && nodes[0].nodeType === 3 && !nodes[0].data.trim()) {
      return;
    }
    contents['default'] = extractFragment(content.childNodes, content);
  }
}

/**
 * Extract qualified content nodes from a node list.
 *
 * @param {NodeList} nodes
 * @return {DocumentFragment}
 */

function extractFragment(nodes, parent) {
  var frag = document.createDocumentFragment();
  nodes = toArray(nodes);
  for (var i = 0, l = nodes.length; i < l; i++) {
    var node = nodes[i];
    if (isTemplate(node) && !node.hasAttribute('v-if') && !node.hasAttribute('v-for')) {
      parent.removeChild(node);
      node = parseTemplate(node, true);
    }
    frag.appendChild(node);
  }
  return frag;
}



var compiler = Object.freeze({
	compile: compile,
	compileAndLinkProps: compileAndLinkProps,
	compileRoot: compileRoot,
	transclude: transclude,
	resolveSlots: resolveSlots
});

function stateMixin (Vue) {
  /**
   * Accessor for `$data` property, since setting $data
   * requires observing the new object and updating
   * proxied properties.
   */

  Object.defineProperty(Vue.prototype, '$data', {
    get: function get() {
      return this._data;
    },
    set: function set(newData) {
      if (newData !== this._data) {
        this._setData(newData);
      }
    }
  });

  /**
   * Setup the scope of an instance, which contains:
   * - observed data
   * - computed properties
   * - user methods
   * - meta properties
   */

  Vue.prototype._initState = function () {
    this._initProps();
    this._initMeta();
    this._initMethods();
    this._initData();
    this._initComputed();
  };

  /**
   * Initialize props.
   */

  Vue.prototype._initProps = function () {
    var options = this.$options;
    var el = options.el;
    var props = options.props;
    if (props && !el) {
      process.env.NODE_ENV !== 'production' && warn('Props will not be compiled if no `el` option is ' + 'provided at instantiation.', this);
    }
    // make sure to convert string selectors into element now
    el = options.el = query(el);
    this._propsUnlinkFn = el && el.nodeType === 1 && props
    // props must be linked in proper scope if inside v-for
    ? compileAndLinkProps(this, el, props, this._scope) : null;
  };

  /**
   * Initialize the data.
   */

  Vue.prototype._initData = function () {
    var dataFn = this.$options.data;
    var data = this._data = dataFn ? dataFn() : {};
    if (!isPlainObject(data)) {
      data = {};
      process.env.NODE_ENV !== 'production' && warn('data functions should return an object.', this);
    }
    var props = this._props;
    // proxy data on instance
    var keys = Object.keys(data);
    var i, key;
    i = keys.length;
    while (i--) {
      key = keys[i];
      // there are two scenarios where we can proxy a data key:
      // 1. it's not already defined as a prop
      // 2. it's provided via a instantiation option AND there are no
      //    template prop present
      if (!props || !hasOwn(props, key)) {
        this._proxy(key);
      } else if (process.env.NODE_ENV !== 'production') {
        warn('Data field "' + key + '" is already defined ' + 'as a prop. To provide default value for a prop, use the "default" ' + 'prop option; if you want to pass prop values to an instantiation ' + 'call, use the "propsData" option.', this);
      }
    }
    // observe data
    observe(data, this);
  };

  /**
   * Swap the instance's $data. Called in $data's setter.
   *
   * @param {Object} newData
   */

  Vue.prototype._setData = function (newData) {
    newData = newData || {};
    var oldData = this._data;
    this._data = newData;
    var keys, key, i;
    // unproxy keys not present in new data
    keys = Object.keys(oldData);
    i = keys.length;
    while (i--) {
      key = keys[i];
      if (!(key in newData)) {
        this._unproxy(key);
      }
    }
    // proxy keys not already proxied,
    // and trigger change for changed values
    keys = Object.keys(newData);
    i = keys.length;
    while (i--) {
      key = keys[i];
      if (!hasOwn(this, key)) {
        // new property
        this._proxy(key);
      }
    }
    oldData.__ob__.removeVm(this);
    observe(newData, this);
    this._digest();
  };

  /**
   * Proxy a property, so that
   * vm.prop === vm._data.prop
   *
   * @param {String} key
   */

  Vue.prototype._proxy = function (key) {
    if (!isReserved(key)) {
      // need to store ref to self here
      // because these getter/setters might
      // be called by child scopes via
      // prototype inheritance.
      var self = this;
      Object.defineProperty(self, key, {
        configurable: true,
        enumerable: true,
        get: function proxyGetter() {
          return self._data[key];
        },
        set: function proxySetter(val) {
          self._data[key] = val;
        }
      });
    }
  };

  /**
   * Unproxy a property.
   *
   * @param {String} key
   */

  Vue.prototype._unproxy = function (key) {
    if (!isReserved(key)) {
      delete this[key];
    }
  };

  /**
   * Force update on every watcher in scope.
   */

  Vue.prototype._digest = function () {
    for (var i = 0, l = this._watchers.length; i < l; i++) {
      this._watchers[i].update(true); // shallow updates
    }
  };

  /**
   * Setup computed properties. They are essentially
   * special getter/setters
   */

  function noop() {}
  Vue.prototype._initComputed = function () {
    var computed = this.$options.computed;
    if (computed) {
      for (var key in computed) {
        var userDef = computed[key];
        var def = {
          enumerable: true,
          configurable: true
        };
        if (typeof userDef === 'function') {
          def.get = makeComputedGetter(userDef, this);
          def.set = noop;
        } else {
          def.get = userDef.get ? userDef.cache !== false ? makeComputedGetter(userDef.get, this) : bind(userDef.get, this) : noop;
          def.set = userDef.set ? bind(userDef.set, this) : noop;
        }
        Object.defineProperty(this, key, def);
      }
    }
  };

  function makeComputedGetter(getter, owner) {
    var watcher = new Watcher(owner, getter, null, {
      lazy: true
    });
    return function computedGetter() {
      if (watcher.dirty) {
        watcher.evaluate();
      }
      if (Dep.target) {
        watcher.depend();
      }
      return watcher.value;
    };
  }

  /**
   * Setup instance methods. Methods must be bound to the
   * instance since they might be passed down as a prop to
   * child components.
   */

  Vue.prototype._initMethods = function () {
    var methods = this.$options.methods;
    if (methods) {
      for (var key in methods) {
        this[key] = bind(methods[key], this);
      }
    }
  };

  /**
   * Initialize meta information like $index, $key & $value.
   */

  Vue.prototype._initMeta = function () {
    var metas = this.$options._meta;
    if (metas) {
      for (var key in metas) {
        defineReactive(this, key, metas[key]);
      }
    }
  };
}

var eventRE = /^v-on:|^@/;

function eventsMixin (Vue) {
  /**
   * Setup the instance's option events & watchers.
   * If the value is a string, we pull it from the
   * instance's methods by name.
   */

  Vue.prototype._initEvents = function () {
    var options = this.$options;
    if (options._asComponent) {
      registerComponentEvents(this, options.el);
    }
    registerCallbacks(this, '$on', options.events);
    registerCallbacks(this, '$watch', options.watch);
  };

  /**
   * Register v-on events on a child component
   *
   * @param {Vue} vm
   * @param {Element} el
   */

  function registerComponentEvents(vm, el) {
    var attrs = el.attributes;
    var name, value, handler;
    for (var i = 0, l = attrs.length; i < l; i++) {
      name = attrs[i].name;
      if (eventRE.test(name)) {
        name = name.replace(eventRE, '');
        // force the expression into a statement so that
        // it always dynamically resolves the method to call (#2670)
        // kinda ugly hack, but does the job.
        value = attrs[i].value;
        if (isSimplePath(value)) {
          value += '.apply(this, $arguments)';
        }
        handler = (vm._scope || vm._context).$eval(value, true);
        handler._fromParent = true;
        vm.$on(name.replace(eventRE), handler);
      }
    }
  }

  /**
   * Register callbacks for option events and watchers.
   *
   * @param {Vue} vm
   * @param {String} action
   * @param {Object} hash
   */

  function registerCallbacks(vm, action, hash) {
    if (!hash) return;
    var handlers, key, i, j;
    for (key in hash) {
      handlers = hash[key];
      if (isArray(handlers)) {
        for (i = 0, j = handlers.length; i < j; i++) {
          register(vm, action, key, handlers[i]);
        }
      } else {
        register(vm, action, key, handlers);
      }
    }
  }

  /**
   * Helper to register an event/watch callback.
   *
   * @param {Vue} vm
   * @param {String} action
   * @param {String} key
   * @param {Function|String|Object} handler
   * @param {Object} [options]
   */

  function register(vm, action, key, handler, options) {
    var type = typeof handler;
    if (type === 'function') {
      vm[action](key, handler, options);
    } else if (type === 'string') {
      var methods = vm.$options.methods;
      var method = methods && methods[handler];
      if (method) {
        vm[action](key, method, options);
      } else {
        process.env.NODE_ENV !== 'production' && warn('Unknown method: "' + handler + '" when ' + 'registering callback for ' + action + ': "' + key + '".', vm);
      }
    } else if (handler && type === 'object') {
      register(vm, action, key, handler.handler, handler);
    }
  }

  /**
   * Setup recursive attached/detached calls
   */

  Vue.prototype._initDOMHooks = function () {
    this.$on('hook:attached', onAttached);
    this.$on('hook:detached', onDetached);
  };

  /**
   * Callback to recursively call attached hook on children
   */

  function onAttached() {
    if (!this._isAttached) {
      this._isAttached = true;
      this.$children.forEach(callAttach);
    }
  }

  /**
   * Iterator to call attached hook
   *
   * @param {Vue} child
   */

  function callAttach(child) {
    if (!child._isAttached && inDoc(child.$el)) {
      child._callHook('attached');
    }
  }

  /**
   * Callback to recursively call detached hook on children
   */

  function onDetached() {
    if (this._isAttached) {
      this._isAttached = false;
      this.$children.forEach(callDetach);
    }
  }

  /**
   * Iterator to call detached hook
   *
   * @param {Vue} child
   */

  function callDetach(child) {
    if (child._isAttached && !inDoc(child.$el)) {
      child._callHook('detached');
    }
  }

  /**
   * Trigger all handlers for a hook
   *
   * @param {String} hook
   */

  Vue.prototype._callHook = function (hook) {
    this.$emit('pre-hook:' + hook);
    var handlers = this.$options[hook];
    if (handlers) {
      for (var i = 0, j = handlers.length; i < j; i++) {
        handlers[i].call(this);
      }
    }
    this.$emit('hook:' + hook);
  };
}

function noop() {}

/**
 * A directive links a DOM element with a piece of data,
 * which is the result of evaluating an expression.
 * It registers a watcher with the expression and calls
 * the DOM update function when a change is triggered.
 *
 * @param {Object} descriptor
 *                 - {String} name
 *                 - {Object} def
 *                 - {String} expression
 *                 - {Array<Object>} [filters]
 *                 - {Object} [modifiers]
 *                 - {Boolean} literal
 *                 - {String} attr
 *                 - {String} arg
 *                 - {String} raw
 *                 - {String} [ref]
 *                 - {Array<Object>} [interp]
 *                 - {Boolean} [hasOneTime]
 * @param {Vue} vm
 * @param {Node} el
 * @param {Vue} [host] - transclusion host component
 * @param {Object} [scope] - v-for scope
 * @param {Fragment} [frag] - owner fragment
 * @constructor
 */
function Directive(descriptor, vm, el, host, scope, frag) {
  this.vm = vm;
  this.el = el;
  // copy descriptor properties
  this.descriptor = descriptor;
  this.name = descriptor.name;
  this.expression = descriptor.expression;
  this.arg = descriptor.arg;
  this.modifiers = descriptor.modifiers;
  this.filters = descriptor.filters;
  this.literal = this.modifiers && this.modifiers.literal;
  // private
  this._locked = false;
  this._bound = false;
  this._listeners = null;
  // link context
  this._host = host;
  this._scope = scope;
  this._frag = frag;
  // store directives on node in dev mode
  if (process.env.NODE_ENV !== 'production' && this.el) {
    this.el._vue_directives = this.el._vue_directives || [];
    this.el._vue_directives.push(this);
  }
}

/**
 * Initialize the directive, mixin definition properties,
 * setup the watcher, call definition bind() and update()
 * if present.
 */

Directive.prototype._bind = function () {
  var name = this.name;
  var descriptor = this.descriptor;

  // remove attribute
  if ((name !== 'cloak' || this.vm._isCompiled) && this.el && this.el.removeAttribute) {
    var attr = descriptor.attr || 'v-' + name;
    this.el.removeAttribute(attr);
  }

  // copy def properties
  var def = descriptor.def;
  if (typeof def === 'function') {
    this.update = def;
  } else {
    extend(this, def);
  }

  // setup directive params
  this._setupParams();

  // initial bind
  if (this.bind) {
    this.bind();
  }
  this._bound = true;

  if (this.literal) {
    this.update && this.update(descriptor.raw);
  } else if ((this.expression || this.modifiers) && (this.update || this.twoWay) && !this._checkStatement()) {
    // wrapped updater for context
    var dir = this;
    if (this.update) {
      this._update = function (val, oldVal) {
        if (!dir._locked) {
          dir.update(val, oldVal);
        }
      };
    } else {
      this._update = noop;
    }
    var preProcess = this._preProcess ? bind(this._preProcess, this) : null;
    var postProcess = this._postProcess ? bind(this._postProcess, this) : null;
    var watcher = this._watcher = new Watcher(this.vm, this.expression, this._update, // callback
    {
      filters: this.filters,
      twoWay: this.twoWay,
      deep: this.deep,
      preProcess: preProcess,
      postProcess: postProcess,
      scope: this._scope
    });
    // v-model with inital inline value need to sync back to
    // model instead of update to DOM on init. They would
    // set the afterBind hook to indicate that.
    if (this.afterBind) {
      this.afterBind();
    } else if (this.update) {
      this.update(watcher.value);
    }
  }
};

/**
 * Setup all param attributes, e.g. track-by,
 * transition-mode, etc...
 */

Directive.prototype._setupParams = function () {
  if (!this.params) {
    return;
  }
  var params = this.params;
  // swap the params array with a fresh object.
  this.params = Object.create(null);
  var i = params.length;
  var key, val, mappedKey;
  while (i--) {
    key = hyphenate(params[i]);
    mappedKey = camelize(key);
    val = getBindAttr(this.el, key);
    if (val != null) {
      // dynamic
      this._setupParamWatcher(mappedKey, val);
    } else {
      // static
      val = getAttr(this.el, key);
      if (val != null) {
        this.params[mappedKey] = val === '' ? true : val;
      }
    }
  }
};

/**
 * Setup a watcher for a dynamic param.
 *
 * @param {String} key
 * @param {String} expression
 */

Directive.prototype._setupParamWatcher = function (key, expression) {
  var self = this;
  var called = false;
  var unwatch = (this._scope || this.vm).$watch(expression, function (val, oldVal) {
    self.params[key] = val;
    // since we are in immediate mode,
    // only call the param change callbacks if this is not the first update.
    if (called) {
      var cb = self.paramWatchers && self.paramWatchers[key];
      if (cb) {
        cb.call(self, val, oldVal);
      }
    } else {
      called = true;
    }
  }, {
    immediate: true,
    user: false
  });(this._paramUnwatchFns || (this._paramUnwatchFns = [])).push(unwatch);
};

/**
 * Check if the directive is a function caller
 * and if the expression is a callable one. If both true,
 * we wrap up the expression and use it as the event
 * handler.
 *
 * e.g. on-click="a++"
 *
 * @return {Boolean}
 */

Directive.prototype._checkStatement = function () {
  var expression = this.expression;
  if (expression && this.acceptStatement && !isSimplePath(expression)) {
    var fn = parseExpression(expression).get;
    var scope = this._scope || this.vm;
    var handler = function handler(e) {
      scope.$event = e;
      fn.call(scope, scope);
      scope.$event = null;
    };
    if (this.filters) {
      handler = scope._applyFilters(handler, null, this.filters);
    }
    this.update(handler);
    return true;
  }
};

/**
 * Set the corresponding value with the setter.
 * This should only be used in two-way directives
 * e.g. v-model.
 *
 * @param {*} value
 * @public
 */

Directive.prototype.set = function (value) {
  /* istanbul ignore else */
  if (this.twoWay) {
    this._withLock(function () {
      this._watcher.set(value);
    });
  } else if (process.env.NODE_ENV !== 'production') {
    warn('Directive.set() can only be used inside twoWay' + 'directives.');
  }
};

/**
 * Execute a function while preventing that function from
 * triggering updates on this directive instance.
 *
 * @param {Function} fn
 */

Directive.prototype._withLock = function (fn) {
  var self = this;
  self._locked = true;
  fn.call(self);
  nextTick(function () {
    self._locked = false;
  });
};

/**
 * Convenience method that attaches a DOM event listener
 * to the directive element and autometically tears it down
 * during unbind.
 *
 * @param {String} event
 * @param {Function} handler
 * @param {Boolean} [useCapture]
 */

Directive.prototype.on = function (event, handler, useCapture) {
  on(this.el, event, handler, useCapture);(this._listeners || (this._listeners = [])).push([event, handler]);
};

/**
 * Teardown the watcher and call unbind.
 */

Directive.prototype._teardown = function () {
  if (this._bound) {
    this._bound = false;
    if (this.unbind) {
      this.unbind();
    }
    if (this._watcher) {
      this._watcher.teardown();
    }
    var listeners = this._listeners;
    var i;
    if (listeners) {
      i = listeners.length;
      while (i--) {
        off(this.el, listeners[i][0], listeners[i][1]);
      }
    }
    var unwatchFns = this._paramUnwatchFns;
    if (unwatchFns) {
      i = unwatchFns.length;
      while (i--) {
        unwatchFns[i]();
      }
    }
    if (process.env.NODE_ENV !== 'production' && this.el) {
      this.el._vue_directives.$remove(this);
    }
    this.vm = this.el = this._watcher = this._listeners = null;
  }
};

function lifecycleMixin (Vue) {
  /**
   * Update v-ref for component.
   *
   * @param {Boolean} remove
   */

  Vue.prototype._updateRef = function (remove) {
    var ref = this.$options._ref;
    if (ref) {
      var refs = (this._scope || this._context).$refs;
      if (remove) {
        if (refs[ref] === this) {
          refs[ref] = null;
        }
      } else {
        refs[ref] = this;
      }
    }
  };

  /**
   * Transclude, compile and link element.
   *
   * If a pre-compiled linker is available, that means the
   * passed in element will be pre-transcluded and compiled
   * as well - all we need to do is to call the linker.
   *
   * Otherwise we need to call transclude/compile/link here.
   *
   * @param {Element} el
   */

  Vue.prototype._compile = function (el) {
    var options = this.$options;

    // transclude and init element
    // transclude can potentially replace original
    // so we need to keep reference; this step also injects
    // the template and caches the original attributes
    // on the container node and replacer node.
    var original = el;
    el = transclude(el, options);
    this._initElement(el);

    // handle v-pre on root node (#2026)
    if (el.nodeType === 1 && getAttr(el, 'v-pre') !== null) {
      return;
    }

    // root is always compiled per-instance, because
    // container attrs and props can be different every time.
    var contextOptions = this._context && this._context.$options;
    var rootLinker = compileRoot(el, options, contextOptions);

    // resolve slot distribution
    resolveSlots(this, options._content);

    // compile and link the rest
    var contentLinkFn;
    var ctor = this.constructor;
    // component compilation can be cached
    // as long as it's not using inline-template
    if (options._linkerCachable) {
      contentLinkFn = ctor.linker;
      if (!contentLinkFn) {
        contentLinkFn = ctor.linker = compile(el, options);
      }
    }

    // link phase
    // make sure to link root with prop scope!
    var rootUnlinkFn = rootLinker(this, el, this._scope);
    var contentUnlinkFn = contentLinkFn ? contentLinkFn(this, el) : compile(el, options)(this, el);

    // register composite unlink function
    // to be called during instance destruction
    this._unlinkFn = function () {
      rootUnlinkFn();
      // passing destroying: true to avoid searching and
      // splicing the directives
      contentUnlinkFn(true);
    };

    // finally replace original
    if (options.replace) {
      replace(original, el);
    }

    this._isCompiled = true;
    this._callHook('compiled');
  };

  /**
   * Initialize instance element. Called in the public
   * $mount() method.
   *
   * @param {Element} el
   */

  Vue.prototype._initElement = function (el) {
    if (isFragment(el)) {
      this._isFragment = true;
      this.$el = this._fragmentStart = el.firstChild;
      this._fragmentEnd = el.lastChild;
      // set persisted text anchors to empty
      if (this._fragmentStart.nodeType === 3) {
        this._fragmentStart.data = this._fragmentEnd.data = '';
      }
      this._fragment = el;
    } else {
      this.$el = el;
    }
    this.$el.__vue__ = this;
    this._callHook('beforeCompile');
  };

  /**
   * Create and bind a directive to an element.
   *
   * @param {Object} descriptor - parsed directive descriptor
   * @param {Node} node   - target node
   * @param {Vue} [host] - transclusion host component
   * @param {Object} [scope] - v-for scope
   * @param {Fragment} [frag] - owner fragment
   */

  Vue.prototype._bindDir = function (descriptor, node, host, scope, frag) {
    this._directives.push(new Directive(descriptor, this, node, host, scope, frag));
  };

  /**
   * Teardown an instance, unobserves the data, unbind all the
   * directives, turn off all the event listeners, etc.
   *
   * @param {Boolean} remove - whether to remove the DOM node.
   * @param {Boolean} deferCleanup - if true, defer cleanup to
   *                                 be called later
   */

  Vue.prototype._destroy = function (remove, deferCleanup) {
    if (this._isBeingDestroyed) {
      if (!deferCleanup) {
        this._cleanup();
      }
      return;
    }

    var destroyReady;
    var pendingRemoval;

    var self = this;
    // Cleanup should be called either synchronously or asynchronoysly as
    // callback of this.$remove(), or if remove and deferCleanup are false.
    // In any case it should be called after all other removing, unbinding and
    // turning of is done
    var cleanupIfPossible = function cleanupIfPossible() {
      if (destroyReady && !pendingRemoval && !deferCleanup) {
        self._cleanup();
      }
    };

    // remove DOM element
    if (remove && this.$el) {
      pendingRemoval = true;
      this.$remove(function () {
        pendingRemoval = false;
        cleanupIfPossible();
      });
    }

    this._callHook('beforeDestroy');
    this._isBeingDestroyed = true;
    var i;
    // remove self from parent. only necessary
    // if parent is not being destroyed as well.
    var parent = this.$parent;
    if (parent && !parent._isBeingDestroyed) {
      parent.$children.$remove(this);
      // unregister ref (remove: true)
      this._updateRef(true);
    }
    // destroy all children.
    i = this.$children.length;
    while (i--) {
      this.$children[i].$destroy();
    }
    // teardown props
    if (this._propsUnlinkFn) {
      this._propsUnlinkFn();
    }
    // teardown all directives. this also tearsdown all
    // directive-owned watchers.
    if (this._unlinkFn) {
      this._unlinkFn();
    }
    i = this._watchers.length;
    while (i--) {
      this._watchers[i].teardown();
    }
    // remove reference to self on $el
    if (this.$el) {
      this.$el.__vue__ = null;
    }

    destroyReady = true;
    cleanupIfPossible();
  };

  /**
   * Clean up to ensure garbage collection.
   * This is called after the leave transition if there
   * is any.
   */

  Vue.prototype._cleanup = function () {
    if (this._isDestroyed) {
      return;
    }
    // remove self from owner fragment
    // do it in cleanup so that we can call $destroy with
    // defer right when a fragment is about to be removed.
    if (this._frag) {
      this._frag.children.$remove(this);
    }
    // remove reference from data ob
    // frozen object may not have observer.
    if (this._data && this._data.__ob__) {
      this._data.__ob__.removeVm(this);
    }
    // Clean up references to private properties and other
    // instances. preserve reference to _data so that proxy
    // accessors still work. The only potential side effect
    // here is that mutating the instance after it's destroyed
    // may affect the state of other components that are still
    // observing the same object, but that seems to be a
    // reasonable responsibility for the user rather than
    // always throwing an error on them.
    this.$el = this.$parent = this.$root = this.$children = this._watchers = this._context = this._scope = this._directives = null;
    // call the last hook...
    this._isDestroyed = true;
    this._callHook('destroyed');
    // turn off all instance listeners.
    this.$off();
  };
}

function miscMixin (Vue) {
  /**
   * Apply a list of filter (descriptors) to a value.
   * Using plain for loops here because this will be called in
   * the getter of any watcher with filters so it is very
   * performance sensitive.
   *
   * @param {*} value
   * @param {*} [oldValue]
   * @param {Array} filters
   * @param {Boolean} write
   * @return {*}
   */

  Vue.prototype._applyFilters = function (value, oldValue, filters, write) {
    var filter, fn, args, arg, offset, i, l, j, k;
    for (i = 0, l = filters.length; i < l; i++) {
      filter = filters[write ? l - i - 1 : i];
      fn = resolveAsset(this.$options, 'filters', filter.name, true);
      if (!fn) continue;
      fn = write ? fn.write : fn.read || fn;
      if (typeof fn !== 'function') continue;
      args = write ? [value, oldValue] : [value];
      offset = write ? 2 : 1;
      if (filter.args) {
        for (j = 0, k = filter.args.length; j < k; j++) {
          arg = filter.args[j];
          args[j + offset] = arg.dynamic ? this.$get(arg.value) : arg.value;
        }
      }
      value = fn.apply(this, args);
    }
    return value;
  };

  /**
   * Resolve a component, depending on whether the component
   * is defined normally or using an async factory function.
   * Resolves synchronously if already resolved, otherwise
   * resolves asynchronously and caches the resolved
   * constructor on the factory.
   *
   * @param {String|Function} value
   * @param {Function} cb
   */

  Vue.prototype._resolveComponent = function (value, cb) {
    var factory;
    if (typeof value === 'function') {
      factory = value;
    } else {
      factory = resolveAsset(this.$options, 'components', value, true);
    }
    /* istanbul ignore if */
    if (!factory) {
      return;
    }
    // async component factory
    if (!factory.options) {
      if (factory.resolved) {
        // cached
        cb(factory.resolved);
      } else if (factory.requested) {
        // pool callbacks
        factory.pendingCallbacks.push(cb);
      } else {
        factory.requested = true;
        var cbs = factory.pendingCallbacks = [cb];
        factory.call(this, function resolve(res) {
          if (isPlainObject(res)) {
            res = Vue.extend(res);
          }
          // cache resolved
          factory.resolved = res;
          // invoke callbacks
          for (var i = 0, l = cbs.length; i < l; i++) {
            cbs[i](res);
          }
        }, function reject(reason) {
          process.env.NODE_ENV !== 'production' && warn('Failed to resolve async component' + (typeof value === 'string' ? ': ' + value : '') + '. ' + (reason ? '\nReason: ' + reason : ''));
        });
      }
    } else {
      // normal component
      cb(factory);
    }
  };
}

var filterRE$1 = /[^|]\|[^|]/;

function dataAPI (Vue) {
  /**
   * Get the value from an expression on this vm.
   *
   * @param {String} exp
   * @param {Boolean} [asStatement]
   * @return {*}
   */

  Vue.prototype.$get = function (exp, asStatement) {
    var res = parseExpression(exp);
    if (res) {
      if (asStatement) {
        var self = this;
        return function statementHandler() {
          self.$arguments = toArray(arguments);
          var result = res.get.call(self, self);
          self.$arguments = null;
          return result;
        };
      } else {
        try {
          return res.get.call(this, this);
        } catch (e) {}
      }
    }
  };

  /**
   * Set the value from an expression on this vm.
   * The expression must be a valid left-hand
   * expression in an assignment.
   *
   * @param {String} exp
   * @param {*} val
   */

  Vue.prototype.$set = function (exp, val) {
    var res = parseExpression(exp, true);
    if (res && res.set) {
      res.set.call(this, this, val);
    }
  };

  /**
   * Delete a property on the VM
   *
   * @param {String} key
   */

  Vue.prototype.$delete = function (key) {
    del(this._data, key);
  };

  /**
   * Watch an expression, trigger callback when its
   * value changes.
   *
   * @param {String|Function} expOrFn
   * @param {Function} cb
   * @param {Object} [options]
   *                 - {Boolean} deep
   *                 - {Boolean} immediate
   * @return {Function} - unwatchFn
   */

  Vue.prototype.$watch = function (expOrFn, cb, options) {
    var vm = this;
    var parsed;
    if (typeof expOrFn === 'string') {
      parsed = parseDirective(expOrFn);
      expOrFn = parsed.expression;
    }
    var watcher = new Watcher(vm, expOrFn, cb, {
      deep: options && options.deep,
      sync: options && options.sync,
      filters: parsed && parsed.filters,
      user: !options || options.user !== false
    });
    if (options && options.immediate) {
      cb.call(vm, watcher.value);
    }
    return function unwatchFn() {
      watcher.teardown();
    };
  };

  /**
   * Evaluate a text directive, including filters.
   *
   * @param {String} text
   * @param {Boolean} [asStatement]
   * @return {String}
   */

  Vue.prototype.$eval = function (text, asStatement) {
    // check for filters.
    if (filterRE$1.test(text)) {
      var dir = parseDirective(text);
      // the filter regex check might give false positive
      // for pipes inside strings, so it's possible that
      // we don't get any filters here
      var val = this.$get(dir.expression, asStatement);
      return dir.filters ? this._applyFilters(val, null, dir.filters) : val;
    } else {
      // no filter
      return this.$get(text, asStatement);
    }
  };

  /**
   * Interpolate a piece of template text.
   *
   * @param {String} text
   * @return {String}
   */

  Vue.prototype.$interpolate = function (text) {
    var tokens = parseText(text);
    var vm = this;
    if (tokens) {
      if (tokens.length === 1) {
        return vm.$eval(tokens[0].value) + '';
      } else {
        return tokens.map(function (token) {
          return token.tag ? vm.$eval(token.value) : token.value;
        }).join('');
      }
    } else {
      return text;
    }
  };

  /**
   * Log instance data as a plain JS object
   * so that it is easier to inspect in console.
   * This method assumes console is available.
   *
   * @param {String} [path]
   */

  Vue.prototype.$log = function (path) {
    var data = path ? getPath(this._data, path) : this._data;
    if (data) {
      data = clean(data);
    }
    // include computed fields
    if (!path) {
      var key;
      for (key in this.$options.computed) {
        data[key] = clean(this[key]);
      }
      if (this._props) {
        for (key in this._props) {
          data[key] = clean(this[key]);
        }
      }
    }
    console.log(data);
  };

  /**
   * "clean" a getter/setter converted object into a plain
   * object copy.
   *
   * @param {Object} - obj
   * @return {Object}
   */

  function clean(obj) {
    return JSON.parse(JSON.stringify(obj));
  }
}

function domAPI (Vue) {
  /**
   * Convenience on-instance nextTick. The callback is
   * auto-bound to the instance, and this avoids component
   * modules having to rely on the global Vue.
   *
   * @param {Function} fn
   */

  Vue.prototype.$nextTick = function (fn) {
    nextTick(fn, this);
  };

  /**
   * Append instance to target
   *
   * @param {Node} target
   * @param {Function} [cb]
   * @param {Boolean} [withTransition] - defaults to true
   */

  Vue.prototype.$appendTo = function (target, cb, withTransition) {
    return insert(this, target, cb, withTransition, append, appendWithTransition);
  };

  /**
   * Prepend instance to target
   *
   * @param {Node} target
   * @param {Function} [cb]
   * @param {Boolean} [withTransition] - defaults to true
   */

  Vue.prototype.$prependTo = function (target, cb, withTransition) {
    target = query(target);
    if (target.hasChildNodes()) {
      this.$before(target.firstChild, cb, withTransition);
    } else {
      this.$appendTo(target, cb, withTransition);
    }
    return this;
  };

  /**
   * Insert instance before target
   *
   * @param {Node} target
   * @param {Function} [cb]
   * @param {Boolean} [withTransition] - defaults to true
   */

  Vue.prototype.$before = function (target, cb, withTransition) {
    return insert(this, target, cb, withTransition, beforeWithCb, beforeWithTransition);
  };

  /**
   * Insert instance after target
   *
   * @param {Node} target
   * @param {Function} [cb]
   * @param {Boolean} [withTransition] - defaults to true
   */

  Vue.prototype.$after = function (target, cb, withTransition) {
    target = query(target);
    if (target.nextSibling) {
      this.$before(target.nextSibling, cb, withTransition);
    } else {
      this.$appendTo(target.parentNode, cb, withTransition);
    }
    return this;
  };

  /**
   * Remove instance from DOM
   *
   * @param {Function} [cb]
   * @param {Boolean} [withTransition] - defaults to true
   */

  Vue.prototype.$remove = function (cb, withTransition) {
    if (!this.$el.parentNode) {
      return cb && cb();
    }
    var inDocument = this._isAttached && inDoc(this.$el);
    // if we are not in document, no need to check
    // for transitions
    if (!inDocument) withTransition = false;
    var self = this;
    var realCb = function realCb() {
      if (inDocument) self._callHook('detached');
      if (cb) cb();
    };
    if (this._isFragment) {
      removeNodeRange(this._fragmentStart, this._fragmentEnd, this, this._fragment, realCb);
    } else {
      var op = withTransition === false ? removeWithCb : removeWithTransition;
      op(this.$el, this, realCb);
    }
    return this;
  };

  /**
   * Shared DOM insertion function.
   *
   * @param {Vue} vm
   * @param {Element} target
   * @param {Function} [cb]
   * @param {Boolean} [withTransition]
   * @param {Function} op1 - op for non-transition insert
   * @param {Function} op2 - op for transition insert
   * @return vm
   */

  function insert(vm, target, cb, withTransition, op1, op2) {
    target = query(target);
    var targetIsDetached = !inDoc(target);
    var op = withTransition === false || targetIsDetached ? op1 : op2;
    var shouldCallHook = !targetIsDetached && !vm._isAttached && !inDoc(vm.$el);
    if (vm._isFragment) {
      mapNodeRange(vm._fragmentStart, vm._fragmentEnd, function (node) {
        op(node, target, vm);
      });
      cb && cb();
    } else {
      op(vm.$el, target, vm, cb);
    }
    if (shouldCallHook) {
      vm._callHook('attached');
    }
    return vm;
  }

  /**
   * Check for selectors
   *
   * @param {String|Element} el
   */

  function query(el) {
    return typeof el === 'string' ? document.querySelector(el) : el;
  }

  /**
   * Append operation that takes a callback.
   *
   * @param {Node} el
   * @param {Node} target
   * @param {Vue} vm - unused
   * @param {Function} [cb]
   */

  function append(el, target, vm, cb) {
    target.appendChild(el);
    if (cb) cb();
  }

  /**
   * InsertBefore operation that takes a callback.
   *
   * @param {Node} el
   * @param {Node} target
   * @param {Vue} vm - unused
   * @param {Function} [cb]
   */

  function beforeWithCb(el, target, vm, cb) {
    before(el, target);
    if (cb) cb();
  }

  /**
   * Remove operation that takes a callback.
   *
   * @param {Node} el
   * @param {Vue} vm - unused
   * @param {Function} [cb]
   */

  function removeWithCb(el, vm, cb) {
    remove(el);
    if (cb) cb();
  }
}

function eventsAPI (Vue) {
  /**
   * Listen on the given `event` with `fn`.
   *
   * @param {String} event
   * @param {Function} fn
   */

  Vue.prototype.$on = function (event, fn) {
    (this._events[event] || (this._events[event] = [])).push(fn);
    modifyListenerCount(this, event, 1);
    return this;
  };

  /**
   * Adds an `event` listener that will be invoked a single
   * time then automatically removed.
   *
   * @param {String} event
   * @param {Function} fn
   */

  Vue.prototype.$once = function (event, fn) {
    var self = this;
    function on() {
      self.$off(event, on);
      fn.apply(this, arguments);
    }
    on.fn = fn;
    this.$on(event, on);
    return this;
  };

  /**
   * Remove the given callback for `event` or all
   * registered callbacks.
   *
   * @param {String} event
   * @param {Function} fn
   */

  Vue.prototype.$off = function (event, fn) {
    var cbs;
    // all
    if (!arguments.length) {
      if (this.$parent) {
        for (event in this._events) {
          cbs = this._events[event];
          if (cbs) {
            modifyListenerCount(this, event, -cbs.length);
          }
        }
      }
      this._events = {};
      return this;
    }
    // specific event
    cbs = this._events[event];
    if (!cbs) {
      return this;
    }
    if (arguments.length === 1) {
      modifyListenerCount(this, event, -cbs.length);
      this._events[event] = null;
      return this;
    }
    // specific handler
    var cb;
    var i = cbs.length;
    while (i--) {
      cb = cbs[i];
      if (cb === fn || cb.fn === fn) {
        modifyListenerCount(this, event, -1);
        cbs.splice(i, 1);
        break;
      }
    }
    return this;
  };

  /**
   * Trigger an event on self.
   *
   * @param {String|Object} event
   * @return {Boolean} shouldPropagate
   */

  Vue.prototype.$emit = function (event) {
    var isSource = typeof event === 'string';
    event = isSource ? event : event.name;
    var cbs = this._events[event];
    var shouldPropagate = isSource || !cbs;
    if (cbs) {
      cbs = cbs.length > 1 ? toArray(cbs) : cbs;
      // this is a somewhat hacky solution to the question raised
      // in #2102: for an inline component listener like <comp @test="doThis">,
      // the propagation handling is somewhat broken. Therefore we
      // need to treat these inline callbacks differently.
      var hasParentCbs = isSource && cbs.some(function (cb) {
        return cb._fromParent;
      });
      if (hasParentCbs) {
        shouldPropagate = false;
      }
      var args = toArray(arguments, 1);
      for (var i = 0, l = cbs.length; i < l; i++) {
        var cb = cbs[i];
        var res = cb.apply(this, args);
        if (res === true && (!hasParentCbs || cb._fromParent)) {
          shouldPropagate = true;
        }
      }
    }
    return shouldPropagate;
  };

  /**
   * Recursively broadcast an event to all children instances.
   *
   * @param {String|Object} event
   * @param {...*} additional arguments
   */

  Vue.prototype.$broadcast = function (event) {
    var isSource = typeof event === 'string';
    event = isSource ? event : event.name;
    // if no child has registered for this event,
    // then there's no need to broadcast.
    if (!this._eventsCount[event]) return;
    var children = this.$children;
    var args = toArray(arguments);
    if (isSource) {
      // use object event to indicate non-source emit
      // on children
      args[0] = { name: event, source: this };
    }
    for (var i = 0, l = children.length; i < l; i++) {
      var child = children[i];
      var shouldPropagate = child.$emit.apply(child, args);
      if (shouldPropagate) {
        child.$broadcast.apply(child, args);
      }
    }
    return this;
  };

  /**
   * Recursively propagate an event up the parent chain.
   *
   * @param {String} event
   * @param {...*} additional arguments
   */

  Vue.prototype.$dispatch = function (event) {
    var shouldPropagate = this.$emit.apply(this, arguments);
    if (!shouldPropagate) return;
    var parent = this.$parent;
    var args = toArray(arguments);
    // use object event to indicate non-source emit
    // on parents
    args[0] = { name: event, source: this };
    while (parent) {
      shouldPropagate = parent.$emit.apply(parent, args);
      parent = shouldPropagate ? parent.$parent : null;
    }
    return this;
  };

  /**
   * Modify the listener counts on all parents.
   * This bookkeeping allows $broadcast to return early when
   * no child has listened to a certain event.
   *
   * @param {Vue} vm
   * @param {String} event
   * @param {Number} count
   */

  var hookRE = /^hook:/;
  function modifyListenerCount(vm, event, count) {
    var parent = vm.$parent;
    // hooks do not get broadcasted so no need
    // to do bookkeeping for them
    if (!parent || !count || hookRE.test(event)) return;
    while (parent) {
      parent._eventsCount[event] = (parent._eventsCount[event] || 0) + count;
      parent = parent.$parent;
    }
  }
}

function lifecycleAPI (Vue) {
  /**
   * Set instance target element and kick off the compilation
   * process. The passed in `el` can be a selector string, an
   * existing Element, or a DocumentFragment (for block
   * instances).
   *
   * @param {Element|DocumentFragment|string} el
   * @public
   */

  Vue.prototype.$mount = function (el) {
    if (this._isCompiled) {
      process.env.NODE_ENV !== 'production' && warn('$mount() should be called only once.', this);
      return;
    }
    el = query(el);
    if (!el) {
      el = document.createElement('div');
    }
    this._compile(el);
    this._initDOMHooks();
    if (inDoc(this.$el)) {
      this._callHook('attached');
      ready.call(this);
    } else {
      this.$once('hook:attached', ready);
    }
    return this;
  };

  /**
   * Mark an instance as ready.
   */

  function ready() {
    this._isAttached = true;
    this._isReady = true;
    this._callHook('ready');
  }

  /**
   * Teardown the instance, simply delegate to the internal
   * _destroy.
   *
   * @param {Boolean} remove
   * @param {Boolean} deferCleanup
   */

  Vue.prototype.$destroy = function (remove, deferCleanup) {
    this._destroy(remove, deferCleanup);
  };

  /**
   * Partially compile a piece of DOM and return a
   * decompile function.
   *
   * @param {Element|DocumentFragment} el
   * @param {Vue} [host]
   * @param {Object} [scope]
   * @param {Fragment} [frag]
   * @return {Function}
   */

  Vue.prototype.$compile = function (el, host, scope, frag) {
    return compile(el, this.$options, true)(this, el, host, scope, frag);
  };
}

/**
 * The exposed Vue constructor.
 *
 * API conventions:
 * - public API methods/properties are prefixed with `$`
 * - internal methods/properties are prefixed with `_`
 * - non-prefixed properties are assumed to be proxied user
 *   data.
 *
 * @constructor
 * @param {Object} [options]
 * @public
 */

function Vue(options) {
  this._init(options);
}

// install internals
initMixin(Vue);
stateMixin(Vue);
eventsMixin(Vue);
lifecycleMixin(Vue);
miscMixin(Vue);

// install instance APIs
dataAPI(Vue);
domAPI(Vue);
eventsAPI(Vue);
lifecycleAPI(Vue);

var slot = {

  priority: SLOT,
  params: ['name'],

  bind: function bind() {
    // this was resolved during component transclusion
    var name = this.params.name || 'default';
    var content = this.vm._slotContents && this.vm._slotContents[name];
    if (!content || !content.hasChildNodes()) {
      this.fallback();
    } else {
      this.compile(content.cloneNode(true), this.vm._context, this.vm);
    }
  },

  compile: function compile(content, context, host) {
    if (content && context) {
      if (this.el.hasChildNodes() && content.childNodes.length === 1 && content.childNodes[0].nodeType === 1 && content.childNodes[0].hasAttribute('v-if')) {
        // if the inserted slot has v-if
        // inject fallback content as the v-else
        var elseBlock = document.createElement('template');
        elseBlock.setAttribute('v-else', '');
        elseBlock.innerHTML = this.el.innerHTML;
        // the else block should be compiled in child scope
        elseBlock._context = this.vm;
        content.appendChild(elseBlock);
      }
      var scope = host ? host._scope : this._scope;
      this.unlink = context.$compile(content, host, scope, this._frag);
    }
    if (content) {
      replace(this.el, content);
    } else {
      remove(this.el);
    }
  },

  fallback: function fallback() {
    this.compile(extractContent(this.el, true), this.vm);
  },

  unbind: function unbind() {
    if (this.unlink) {
      this.unlink();
    }
  }
};

var partial = {

  priority: PARTIAL,

  params: ['name'],

  // watch changes to name for dynamic partials
  paramWatchers: {
    name: function name(value) {
      vIf.remove.call(this);
      if (value) {
        this.insert(value);
      }
    }
  },

  bind: function bind() {
    this.anchor = createAnchor('v-partial');
    replace(this.el, this.anchor);
    this.insert(this.params.name);
  },

  insert: function insert(id) {
    var partial = resolveAsset(this.vm.$options, 'partials', id, true);
    if (partial) {
      this.factory = new FragmentFactory(this.vm, partial);
      vIf.insert.call(this);
    }
  },

  unbind: function unbind() {
    if (this.frag) {
      this.frag.destroy();
    }
  }
};

var elementDirectives = {
  slot: slot,
  partial: partial
};

var convertArray = vFor._postProcess;

/**
 * Limit filter for arrays
 *
 * @param {Number} n
 * @param {Number} offset (Decimal expected)
 */

function limitBy(arr, n, offset) {
  offset = offset ? parseInt(offset, 10) : 0;
  n = toNumber(n);
  return typeof n === 'number' ? arr.slice(offset, offset + n) : arr;
}

/**
 * Filter filter for arrays
 *
 * @param {String} search
 * @param {String} [delimiter]
 * @param {String} ...dataKeys
 */

function filterBy(arr, search, delimiter) {
  arr = convertArray(arr);
  if (search == null) {
    return arr;
  }
  if (typeof search === 'function') {
    return arr.filter(search);
  }
  // cast to lowercase string
  search = ('' + search).toLowerCase();
  // allow optional `in` delimiter
  // because why not
  var n = delimiter === 'in' ? 3 : 2;
  // extract and flatten keys
  var keys = Array.prototype.concat.apply([], toArray(arguments, n));
  var res = [];
  var item, key, val, j;
  for (var i = 0, l = arr.length; i < l; i++) {
    item = arr[i];
    val = item && item.$value || item;
    j = keys.length;
    if (j) {
      while (j--) {
        key = keys[j];
        if (key === '$key' && contains(item.$key, search) || contains(getPath(val, key), search)) {
          res.push(item);
          break;
        }
      }
    } else if (contains(item, search)) {
      res.push(item);
    }
  }
  return res;
}

/**
 * Filter filter for arrays
 *
 * @param {String|Array<String>|Function} ...sortKeys
 * @param {Number} [order]
 */

function orderBy(arr) {
  var comparator = null;
  var sortKeys = undefined;
  arr = convertArray(arr);

  // determine order (last argument)
  var args = toArray(arguments, 1);
  var order = args[args.length - 1];
  if (typeof order === 'number') {
    order = order < 0 ? -1 : 1;
    args = args.length > 1 ? args.slice(0, -1) : args;
  } else {
    order = 1;
  }

  // determine sortKeys & comparator
  var firstArg = args[0];
  if (!firstArg) {
    return arr;
  } else if (typeof firstArg === 'function') {
    // custom comparator
    comparator = function (a, b) {
      return firstArg(a, b) * order;
    };
  } else {
    // string keys. flatten first
    sortKeys = Array.prototype.concat.apply([], args);
    comparator = function (a, b, i) {
      i = i || 0;
      return i >= sortKeys.length - 1 ? baseCompare(a, b, i) : baseCompare(a, b, i) || comparator(a, b, i + 1);
    };
  }

  function baseCompare(a, b, sortKeyIndex) {
    var sortKey = sortKeys[sortKeyIndex];
    if (sortKey) {
      if (sortKey !== '$key') {
        if (isObject(a) && '$value' in a) a = a.$value;
        if (isObject(b) && '$value' in b) b = b.$value;
      }
      a = isObject(a) ? getPath(a, sortKey) : a;
      b = isObject(b) ? getPath(b, sortKey) : b;
    }
    return a === b ? 0 : a > b ? order : -order;
  }

  // sort on a copy to avoid mutating original array
  return arr.slice().sort(comparator);
}

/**
 * String contain helper
 *
 * @param {*} val
 * @param {String} search
 */

function contains(val, search) {
  var i;
  if (isPlainObject(val)) {
    var keys = Object.keys(val);
    i = keys.length;
    while (i--) {
      if (contains(val[keys[i]], search)) {
        return true;
      }
    }
  } else if (isArray(val)) {
    i = val.length;
    while (i--) {
      if (contains(val[i], search)) {
        return true;
      }
    }
  } else if (val != null) {
    return val.toString().toLowerCase().indexOf(search) > -1;
  }
}

var digitsRE = /(\d{3})(?=\d)/g;

// asset collections must be a plain object.
var filters = {

  orderBy: orderBy,
  filterBy: filterBy,
  limitBy: limitBy,

  /**
   * Stringify value.
   *
   * @param {Number} indent
   */

  json: {
    read: function read(value, indent) {
      return typeof value === 'string' ? value : JSON.stringify(value, null, Number(indent) || 2);
    },
    write: function write(value) {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
  },

  /**
   * 'abc' => 'Abc'
   */

  capitalize: function capitalize(value) {
    if (!value && value !== 0) return '';
    value = value.toString();
    return value.charAt(0).toUpperCase() + value.slice(1);
  },

  /**
   * 'abc' => 'ABC'
   */

  uppercase: function uppercase(value) {
    return value || value === 0 ? value.toString().toUpperCase() : '';
  },

  /**
   * 'AbC' => 'abc'
   */

  lowercase: function lowercase(value) {
    return value || value === 0 ? value.toString().toLowerCase() : '';
  },

  /**
   * 12345 => $12,345.00
   *
   * @param {String} sign
   * @param {Number} decimals Decimal places
   */

  currency: function currency(value, _currency, decimals) {
    value = parseFloat(value);
    if (!isFinite(value) || !value && value !== 0) return '';
    _currency = _currency != null ? _currency : '$';
    decimals = decimals != null ? decimals : 2;
    var stringified = Math.abs(value).toFixed(decimals);
    var _int = decimals ? stringified.slice(0, -1 - decimals) : stringified;
    var i = _int.length % 3;
    var head = i > 0 ? _int.slice(0, i) + (_int.length > 3 ? ',' : '') : '';
    var _float = decimals ? stringified.slice(-1 - decimals) : '';
    var sign = value < 0 ? '-' : '';
    return sign + _currency + head + _int.slice(i).replace(digitsRE, '$1,') + _float;
  },

  /**
   * 'item' => 'items'
   *
   * @params
   *  an array of strings corresponding to
   *  the single, double, triple ... forms of the word to
   *  be pluralized. When the number to be pluralized
   *  exceeds the length of the args, it will use the last
   *  entry in the array.
   *
   *  e.g. ['single', 'double', 'triple', 'multiple']
   */

  pluralize: function pluralize(value) {
    var args = toArray(arguments, 1);
    return args.length > 1 ? args[value % 10 - 1] || args[args.length - 1] : args[0] + (value === 1 ? '' : 's');
  },

  /**
   * Debounce a handler function.
   *
   * @param {Function} handler
   * @param {Number} delay = 300
   * @return {Function}
   */

  debounce: function debounce(handler, delay) {
    if (!handler) return;
    if (!delay) {
      delay = 300;
    }
    return _debounce(handler, delay);
  }
};

function installGlobalAPI (Vue) {
  /**
   * Vue and every constructor that extends Vue has an
   * associated options object, which can be accessed during
   * compilation steps as `this.constructor.options`.
   *
   * These can be seen as the default options of every
   * Vue instance.
   */

  Vue.options = {
    directives: directives,
    elementDirectives: elementDirectives,
    filters: filters,
    transitions: {},
    components: {},
    partials: {},
    replace: true
  };

  /**
   * Expose useful internals
   */

  Vue.util = util;
  Vue.config = config;
  Vue.set = set;
  Vue['delete'] = del;
  Vue.nextTick = nextTick;

  /**
   * The following are exposed for advanced usage / plugins
   */

  Vue.compiler = compiler;
  Vue.FragmentFactory = FragmentFactory;
  Vue.internalDirectives = internalDirectives;
  Vue.parsers = {
    path: path,
    text: text,
    template: template,
    directive: directive,
    expression: expression
  };

  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */

  Vue.cid = 0;
  var cid = 1;

  /**
   * Class inheritance
   *
   * @param {Object} extendOptions
   */

  Vue.extend = function (extendOptions) {
    extendOptions = extendOptions || {};
    var Super = this;
    var isFirstExtend = Super.cid === 0;
    if (isFirstExtend && extendOptions._Ctor) {
      return extendOptions._Ctor;
    }
    var name = extendOptions.name || Super.options.name;
    if (process.env.NODE_ENV !== 'production') {
      if (!/^[a-zA-Z][\w-]*$/.test(name)) {
        warn('Invalid component name: "' + name + '". Component names ' + 'can only contain alphanumeric characaters and the hyphen.');
        name = null;
      }
    }
    var Sub = createClass(name || 'VueComponent');
    Sub.prototype = Object.create(Super.prototype);
    Sub.prototype.constructor = Sub;
    Sub.cid = cid++;
    Sub.options = mergeOptions(Super.options, extendOptions);
    Sub['super'] = Super;
    // allow further extension
    Sub.extend = Super.extend;
    // create asset registers, so extended classes
    // can have their private assets too.
    config._assetTypes.forEach(function (type) {
      Sub[type] = Super[type];
    });
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub;
    }
    // cache constructor
    if (isFirstExtend) {
      extendOptions._Ctor = Sub;
    }
    return Sub;
  };

  /**
   * A function that returns a sub-class constructor with the
   * given name. This gives us much nicer output when
   * logging instances in the console.
   *
   * @param {String} name
   * @return {Function}
   */

  function createClass(name) {
    /* eslint-disable no-new-func */
    return new Function('return function ' + classify(name) + ' (options) { this._init(options) }')();
    /* eslint-enable no-new-func */
  }

  /**
   * Plugin system
   *
   * @param {Object} plugin
   */

  Vue.use = function (plugin) {
    /* istanbul ignore if */
    if (plugin.installed) {
      return;
    }
    // additional parameters
    var args = toArray(arguments, 1);
    args.unshift(this);
    if (typeof plugin.install === 'function') {
      plugin.install.apply(plugin, args);
    } else {
      plugin.apply(null, args);
    }
    plugin.installed = true;
    return this;
  };

  /**
   * Apply a global mixin by merging it into the default
   * options.
   */

  Vue.mixin = function (mixin) {
    Vue.options = mergeOptions(Vue.options, mixin);
  };

  /**
   * Create asset registration methods with the following
   * signature:
   *
   * @param {String} id
   * @param {*} definition
   */

  config._assetTypes.forEach(function (type) {
    Vue[type] = function (id, definition) {
      if (!definition) {
        return this.options[type + 's'][id];
      } else {
        /* istanbul ignore if */
        if (process.env.NODE_ENV !== 'production') {
          if (type === 'component' && (commonTagRE.test(id) || reservedTagRE.test(id))) {
            warn('Do not use built-in or reserved HTML elements as component ' + 'id: ' + id);
          }
        }
        if (type === 'component' && isPlainObject(definition)) {
          definition.name = id;
          definition = Vue.extend(definition);
        }
        this.options[type + 's'][id] = definition;
        return definition;
      }
    };
  });

  // expose internal transition API
  extend(Vue.transition, transition);
}

installGlobalAPI(Vue);

Vue.version = '1.0.24';

// devtools global hook
/* istanbul ignore next */
setTimeout(function () {
  if (config.devtools) {
    if (devtools) {
      devtools.emit('init', Vue);
    } else if (process.env.NODE_ENV !== 'production' && inBrowser && /Chrome\/\d+/.test(window.navigator.userAgent)) {
      console.log('Download the Vue Devtools for a better development experience:\n' + 'https://github.com/vuejs/vue-devtools');
    }
  }
}, 0);

module.exports = Vue;
}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})

},{"_process":2}],5:[function(require,module,exports){
var inserted = exports.cache = {}

exports.insert = function (css) {
  if (inserted[css]) return
  inserted[css] = true

  var elem = document.createElement('style')
  elem.setAttribute('type', 'text/css')

  if ('textContent' in elem) {
    elem.textContent = css
  } else {
    elem.styleSheet.cssText = css
  }

  document.getElementsByTagName('head')[0].appendChild(elem)
  return elem
}

},{}],6:[function(require,module,exports){
var __vueify_insert__ = require("d:\\git\\AskDaily\\node_modules\\vueify\\lib\\insert-css.js")
var __vueify_style__ = __vueify_insert__.insert(".calendar[_v-42598a42]{max-width:392px;max-width:24.5rem;overflow:hidden;margin:0 auto;font-size:16px;font-size:1rem;line-height:1.5;color:rgba(0,0,0,.87)}.calendar a[_v-42598a42]{color:inherit;text-decoration:none}.calendar li[_v-42598a42],.calendar ul[_v-42598a42]{margin:0;padding:0}.calendar-header[_v-42598a42]{color:rgba(0,0,0,.54)}.calendar-ctrl[_v-42598a42]{font-size:19px;font-size:1.2rem;margin-bottom:8px;margin-bottom:.5rem}.calendar-cell[_v-42598a42],.calendar-ctrl li[_v-42598a42]{text-align:center}.calendar-ctrl .prev[_v-42598a42]{float:left}.calendar-ctrl .prev[_v-42598a42]:before{-webkit-transform:rotate(225deg);-ms-transform:rotate(225deg);transform:rotate(225deg)}.calendar-ctrl .next[_v-42598a42]:before{-webkit-transform:rotate(45deg);-ms-transform:rotate(45deg);transform:rotate(45deg)}.calendar-ctrl .next[_v-42598a42]{float:right}.calendar-ctrl .next[_v-42598a42],.calendar-ctrl .prev[_v-42598a42]{width:56px;width:3.5rem;cursor:pointer}.calendar-ctrl .next[_v-42598a42]:before,.calendar-ctrl .prev[_v-42598a42]:before{display:inline-block;width:5px;height:5px;border-width:3px 3px 0 0;border-style:solid;border-color:#303030;content:'';transition:all .2s ease-in-out}.calendar-ctrl .next[_v-42598a42]:hover:before,.calendar-ctrl .prev[_v-42598a42]:hover:before{border-color:#009688;transition:all .2s ease-in-out}.calendar-ctrl .current[_v-42598a42]{margin:0 56px;margin:0 3.5rem;font-weight:700}.calendar-cell[_v-42598a42]{width:56px;width:3.5rem;height:56px;height:3.5rem}.calendar-day[_v-42598a42]{display:inline-block;width:40px;width:2.5rem;height:40px;height:2.5rem;line-height:40px;line-height:2.5rem;color:rgba(0,0,0,.54)}.calendar-day.valid[_v-42598a42]{color:inherit}.calendar-day.active[_v-42598a42]{color:hsla(0,0%,100%,.95);background-color:rgba(0,150,136,.5);transition:all .2s ease-in-out}.calendar-day.active[_v-42598a42]:hover{background-color:#009688;transition:all .2s ease-in-out}.calendar-day.now[_v-42598a42]{border:1px solid rgba(0,150,136,.5)}.calendar-day.now.active[_v-42598a42]{border:none}.calendar-day.active[_v-42598a42],.calendar-day.now[_v-42598a42]{border-radius:100%}.move-prev[_v-42598a42]{-webkit-animation:a .1s;animation:a .1s}.move-next[_v-42598a42]{-webkit-animation:b .1s;animation:b .1s}@-webkit-keyframes a{0%{-webkit-transform:translate(-5rem);transform:translate(-5rem)}to{-webkit-transform:translate(0);transform:translate(0)}}@keyframes a{0%{-webkit-transform:translate(-5rem);transform:translate(-5rem)}to{-webkit-transform:translate(0);transform:translate(0)}}@-webkit-keyframes b{0%{-webkit-transform:translate(5rem);transform:translate(5rem)}to{-webkit-transform:translate(0);transform:translate(0)}}@keyframes b{0%{-webkit-transform:translate(5rem);transform:translate(5rem)}to{-webkit-transform:translate(0);transform:translate(0)}}")
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _elementClass = require('element-class');

var _elementClass2 = _interopRequireDefault(_elementClass);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

exports.default = {
  props: ['data-qs'],
  data: function data() {
    return {
      title: '',
      move: true, // animation
      year: 0,
      month: 0,
      day: 0,
      today: new Date(),
      movePrev: false,
      moveNext: false,
      weeks: [],
      weekdays: WEEKDAYS,
      actives: this.getActives()
    };
  },
  created: function created() {
    var now = this.getDate(this.today);
    this.year = now.year;
    this.month = now.month;
    this.day = now.day;

    this.actives = this.getActives();
    this.render();
  },

  watch: {
    movePrev: function movePrev(val, oldVal) {
      var moves = document.getElementsByClassName('move');

      if (val) for (var i = 0, len = moves.length; i < len; i++) {
        (0, _elementClass2.default)(moves[i]).add('move-prev');
      } else for (var _i = 0, _len = moves.length; _i < _len; _i++) {
        (0, _elementClass2.default)(moves[_i]).remove('move-prev');
      }
    },
    moveNext: function moveNext(val, oldVal) {
      var moves = document.getElementsByClassName('move');

      if (val) for (var i = 0, len = moves.length; i < len; i++) {
        (0, _elementClass2.default)(moves[i]).add('move-next');
      } else for (var _i2 = 0, _len2 = moves.length; _i2 < _len2; _i2++) {
        (0, _elementClass2.default)(moves[_i2]).remove('move-next');
      }
    }
  },
  methods: {
    render: function render() {
      var curMonthFirstDate = new Date(this.year, this.month, 1).getDay(); // The first day current month
      var curMonthDays = new Date(this.year, this.month + 1, 0).getDate();
      var lastMonthDays = new Date(this.year, this.month, 0).getDate();

      this.title = MONTHS[this.month] + ' ' + this.year;

      this.weeks = [];
      for (var i = 1; i <= curMonthDays;) {
        var week = [];
        var count = 0;

        while (count < 7) {
          var thisDay = new Date(this.year, this.month, i);
          var thisWeekDay = thisDay.getDay();

          if (i === 1 && thisWeekDay !== 0) {
            for (var j = thisWeekDay - 1; j >= 0; j--) {
              week.push({
                date: lastMonthDays - j,
                isNow: false,
                isActive: false,
                isValid: false
              });
              count++;
            }
          }

          week.push({
            date: i,
            isNow: this.sameDay(thisDay, this.today),
            isActive: this.isInActive(thisDay),
            isValid: true && (this.month !== this.today.getMonth() || i <= this.today.getDate()),
            href: this.date2href(this.year, this.month, i)
          });
          count++;

          if (i === curMonthDays && thisWeekDay !== 6) {
            for (var _j = 1; _j < 7 - thisWeekDay; _j++) {
              week.push({
                date: _j,
                isNow: false,
                isActive: false,
                isValid: false
              });
              count++;
            }
          }

          i++;
        }
        this.weeks.push(week);
      }
    },
    prev: function prev() {
      var _this = this;

      if (this.month === 0) {
        this.month = 11;
        this.year--;
      } else this.month--;

      this.move = false;
      this.movePrev = true;
      this.render();
      setTimeout(function () {
        _this.movePrev = false;
      }, 100);
    },
    next: function next() {
      var _this2 = this;

      if (this.month === 11) {
        this.month = 0;
        this.year++;
      } else this.month++;

      this.move = true;
      this.moveNext = true;
      this.render();
      setTimeout(function () {
        _this2.moveNext = false;
      }, 100);
    },
    getActives: function getActives() {
      return this._props.dataQs.raw.split(',');
    },
    getDate: function getDate(date) {
      return {
        year: date.getFullYear(),
        month: date.getMonth(),
        day: date.getDate(),
        weekday: date.getDay()
      };
    },
    pad: function pad(num, n) {
      var len = num.toString().length;
      while (len < n) {
        num = '0' + num;
        len++;
      }
      return num;
    },
    date2string: function date2string(date) {
      var d = this.getDate(date);
      return [this.pad(d.year, 4), this.pad(d.month + 1, 2), this.pad(d.day, 2)].join('-');
    },
    sameDay: function sameDay(dateA, dateB) {
      var d1 = this.getDate(dateA),
          d2 = this.getDate(dateB);
      return d1.year === d2.year && d1.month === d2.month && d1.day === d2.day;
    },
    isInActive: function isInActive(date) {
      return this.actives.indexOf(this.date2string(date)) !== -1;
    },
    date2href: function date2href(year, month, day) {
      var y = this.pad(year, 4),
          m = this.pad(month + 1, 2),
          d = this.pad(day, 2);
      return './' + y + '/' + m + '/' + y + '-' + m + '-' + d + '.html';
    }
  }
};
if (module.exports.__esModule) module.exports = module.exports.default
;(typeof module.exports === "function"? module.exports.options: module.exports).template = "\n<div class=\"calendar\" _v-42598a42=\"\">\n  <nav class=\"calendar-row calendar-ctrl\" _v-42598a42=\"\">\n    <ul _v-42598a42=\"\">\n      <li class=\"prev\" v-on:click=\"prev\" _v-42598a42=\"\"></li>\n      <li v-if=\"today.getFullYear() > year || today.getMonth() > month\" class=\"next\" v-on:click=\"next\" _v-42598a42=\"\"></li>\n      <li class=\"current move\" _v-42598a42=\"\">{{ title }}</li>\n    </ul>\n  </nav>\n  <div _v-42598a42=\"\">\n    <table class=\"move\" _v-42598a42=\"\">\n      <thead class=\"calendar-header\" _v-42598a42=\"\">\n        <tr class=\"calendar-row\" _v-42598a42=\"\">\n          <th class=\"calendar-cell\" v-for=\"wd in weekdays\" _v-42598a42=\"\">{{ wd }}</th>\n        </tr>\n      </thead>\n      <tbody class=\"calendar-body\" _v-42598a42=\"\">\n        <tr class=\"calendar-row\" v-for=\"week in weeks\" _v-42598a42=\"\">\n          <td class=\"calendar-cell\" v-for=\"day in week\" _v-42598a42=\"\">\n          <a v-if=\"day.href &amp;&amp; day.isActive\" class=\"calendar-day\" :class=\"{ &quot;now&quot;: day.isNow, &quot;active&quot;: day.isActive, &quot;valid&quot;: day.isValid }\" :href=\"day.href\" _v-42598a42=\"\">\n            <span _v-42598a42=\"\">{{ day.date }}</span>\n          </a>\n          <span v-else=\"\" class=\"calendar-day\" :class=\"{ &quot;now&quot;: day.isNow, &quot;active&quot;: day.isActive, &quot;valid&quot;: day.isValid }\" _v-42598a42=\"\">{{ day.date }}</span>\n          </td>\n        </tr>\n      </tbody>\n    </table>\n  </div>\n</div>\n"
if (module.hot) {(function () {  module.hot.accept()
  var hotAPI = require("d:\\git\\AskDaily\\node_modules\\vue-hot-reload-api\\index.js")
  hotAPI.install(require("vue"), true)
  if (!hotAPI.compatible) return
  var id = "d:\\git\\AskDaily\\src\\components\\Calendar.vue"
  module.hot.dispose(function () {
    __vueify_insert__.cache[".calendar[_v-42598a42]{max-width:392px;max-width:24.5rem;overflow:hidden;margin:0 auto;font-size:16px;font-size:1rem;line-height:1.5;color:rgba(0,0,0,.87)}.calendar a[_v-42598a42]{color:inherit;text-decoration:none}.calendar li[_v-42598a42],.calendar ul[_v-42598a42]{margin:0;padding:0}.calendar-header[_v-42598a42]{color:rgba(0,0,0,.54)}.calendar-ctrl[_v-42598a42]{font-size:19px;font-size:1.2rem;margin-bottom:8px;margin-bottom:.5rem}.calendar-cell[_v-42598a42],.calendar-ctrl li[_v-42598a42]{text-align:center}.calendar-ctrl .prev[_v-42598a42]{float:left}.calendar-ctrl .prev[_v-42598a42]:before{-webkit-transform:rotate(225deg);-ms-transform:rotate(225deg);transform:rotate(225deg)}.calendar-ctrl .next[_v-42598a42]:before{-webkit-transform:rotate(45deg);-ms-transform:rotate(45deg);transform:rotate(45deg)}.calendar-ctrl .next[_v-42598a42]{float:right}.calendar-ctrl .next[_v-42598a42],.calendar-ctrl .prev[_v-42598a42]{width:56px;width:3.5rem;cursor:pointer}.calendar-ctrl .next[_v-42598a42]:before,.calendar-ctrl .prev[_v-42598a42]:before{display:inline-block;width:5px;height:5px;border-width:3px 3px 0 0;border-style:solid;border-color:#303030;content:'';transition:all .2s ease-in-out}.calendar-ctrl .next[_v-42598a42]:hover:before,.calendar-ctrl .prev[_v-42598a42]:hover:before{border-color:#009688;transition:all .2s ease-in-out}.calendar-ctrl .current[_v-42598a42]{margin:0 56px;margin:0 3.5rem;font-weight:700}.calendar-cell[_v-42598a42]{width:56px;width:3.5rem;height:56px;height:3.5rem}.calendar-day[_v-42598a42]{display:inline-block;width:40px;width:2.5rem;height:40px;height:2.5rem;line-height:40px;line-height:2.5rem;color:rgba(0,0,0,.54)}.calendar-day.valid[_v-42598a42]{color:inherit}.calendar-day.active[_v-42598a42]{color:hsla(0,0%,100%,.95);background-color:rgba(0,150,136,.5);transition:all .2s ease-in-out}.calendar-day.active[_v-42598a42]:hover{background-color:#009688;transition:all .2s ease-in-out}.calendar-day.now[_v-42598a42]{border:1px solid rgba(0,150,136,.5)}.calendar-day.now.active[_v-42598a42]{border:none}.calendar-day.active[_v-42598a42],.calendar-day.now[_v-42598a42]{border-radius:100%}.move-prev[_v-42598a42]{-webkit-animation:a .1s;animation:a .1s}.move-next[_v-42598a42]{-webkit-animation:b .1s;animation:b .1s}@-webkit-keyframes a{0%{-webkit-transform:translate(-5rem);transform:translate(-5rem)}to{-webkit-transform:translate(0);transform:translate(0)}}@keyframes a{0%{-webkit-transform:translate(-5rem);transform:translate(-5rem)}to{-webkit-transform:translate(0);transform:translate(0)}}@-webkit-keyframes b{0%{-webkit-transform:translate(5rem);transform:translate(5rem)}to{-webkit-transform:translate(0);transform:translate(0)}}@keyframes b{0%{-webkit-transform:translate(5rem);transform:translate(5rem)}to{-webkit-transform:translate(0);transform:translate(0)}}"] = false
    document.head.removeChild(__vueify_style__)
  })
  if (!module.hot.data) {
    hotAPI.createRecord(id, module.exports)
  } else {
    hotAPI.update(id, module.exports, (typeof module.exports === "function" ? module.exports.options : module.exports).template)
  }
})()}
},{"d:\\git\\AskDaily\\node_modules\\vue-hot-reload-api\\index.js":3,"d:\\git\\AskDaily\\node_modules\\vueify\\lib\\insert-css.js":5,"element-class":1,"vue":4}],7:[function(require,module,exports){
'use strict';

var _vue = require('vue');

var _vue2 = _interopRequireDefault(_vue);

var _Calendar = require('./Calendar.vue');

var _Calendar2 = _interopRequireDefault(_Calendar);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

new _vue2.default({
  el: 'main',
  components: { Calendar: _Calendar2.default }
});

},{"./Calendar.vue":6,"vue":4}]},{},[7])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvZWxlbWVudC1jbGFzcy9pbmRleC5qcyIsIm5vZGVfbW9kdWxlcy9wcm9jZXNzL2Jyb3dzZXIuanMiLCJub2RlX21vZHVsZXMvdnVlLWhvdC1yZWxvYWQtYXBpL2luZGV4LmpzIiwibm9kZV9tb2R1bGVzL3Z1ZS9kaXN0L3Z1ZS5jb21tb24uanMiLCJub2RlX21vZHVsZXMvdnVlaWZ5L2xpYi9pbnNlcnQtY3NzLmpzIiwic3JjL2NvbXBvbmVudHMvQ2FsZW5kYXIudnVlIiwic3JjXFxjb21wb25lbnRzXFxjYWxlbmRhci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUMzREE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUM5RkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7O0FDMVNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBOzs7O0FDN3lUQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7QUNsQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTs7OztBQzdNQTs7OztBQUNBOzs7Ozs7QUFFQSxrQkFBUTtBQUNOLE1BQUksTUFERTtBQUVOLGNBQVksRUFBRSw0QkFBRjtBQUZOLENBQVIiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIihmdW5jdGlvbiBlKHQsbixyKXtmdW5jdGlvbiBzKG8sdSl7aWYoIW5bb10pe2lmKCF0W29dKXt2YXIgYT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2lmKCF1JiZhKXJldHVybiBhKG8sITApO2lmKGkpcmV0dXJuIGkobywhMCk7dmFyIGY9bmV3IEVycm9yKFwiQ2Fubm90IGZpbmQgbW9kdWxlICdcIitvK1wiJ1wiKTt0aHJvdyBmLmNvZGU9XCJNT0RVTEVfTk9UX0ZPVU5EXCIsZn12YXIgbD1uW29dPXtleHBvcnRzOnt9fTt0W29dWzBdLmNhbGwobC5leHBvcnRzLGZ1bmN0aW9uKGUpe3ZhciBuPXRbb11bMV1bZV07cmV0dXJuIHMobj9uOmUpfSxsLGwuZXhwb3J0cyxlLHQsbixyKX1yZXR1cm4gbltvXS5leHBvcnRzfXZhciBpPXR5cGVvZiByZXF1aXJlPT1cImZ1bmN0aW9uXCImJnJlcXVpcmU7Zm9yKHZhciBvPTA7bzxyLmxlbmd0aDtvKyspcyhyW29dKTtyZXR1cm4gc30pIiwibW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbihvcHRzKSB7XG4gIHJldHVybiBuZXcgRWxlbWVudENsYXNzKG9wdHMpXG59XG5cbmZ1bmN0aW9uIGluZGV4T2YoYXJyLCBwcm9wKSB7XG4gIGlmIChhcnIuaW5kZXhPZikgcmV0dXJuIGFyci5pbmRleE9mKHByb3ApXG4gIGZvciAodmFyIGkgPSAwLCBsZW4gPSBhcnIubGVuZ3RoOyBpIDwgbGVuOyBpKyspXG4gICAgaWYgKGFycltpXSA9PT0gcHJvcCkgcmV0dXJuIGlcbiAgcmV0dXJuIC0xXG59XG5cbmZ1bmN0aW9uIEVsZW1lbnRDbGFzcyhvcHRzKSB7XG4gIGlmICghKHRoaXMgaW5zdGFuY2VvZiBFbGVtZW50Q2xhc3MpKSByZXR1cm4gbmV3IEVsZW1lbnRDbGFzcyhvcHRzKVxuICB2YXIgc2VsZiA9IHRoaXNcbiAgaWYgKCFvcHRzKSBvcHRzID0ge31cblxuICAvLyBzaW1pbGFyIGRvaW5nIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgYnV0IHdvcmtzIGluIElFOFxuICBpZiAob3B0cy5ub2RlVHlwZSkgb3B0cyA9IHtlbDogb3B0c31cblxuICB0aGlzLm9wdHMgPSBvcHRzXG4gIHRoaXMuZWwgPSBvcHRzLmVsIHx8IGRvY3VtZW50LmJvZHlcbiAgaWYgKHR5cGVvZiB0aGlzLmVsICE9PSAnb2JqZWN0JykgdGhpcy5lbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IodGhpcy5lbClcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5hZGQgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgaWYgKGVsLmNsYXNzTmFtZSA9PT0gXCJcIikgcmV0dXJuIGVsLmNsYXNzTmFtZSA9IGNsYXNzTmFtZVxuICB2YXIgY2xhc3NlcyA9IGVsLmNsYXNzTmFtZS5zcGxpdCgnICcpXG4gIGlmIChpbmRleE9mKGNsYXNzZXMsIGNsYXNzTmFtZSkgPiAtMSkgcmV0dXJuIGNsYXNzZXNcbiAgY2xhc3Nlcy5wdXNoKGNsYXNzTmFtZSlcbiAgZWwuY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJylcbiAgcmV0dXJuIGNsYXNzZXNcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5yZW1vdmUgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgaWYgKGVsLmNsYXNzTmFtZSA9PT0gXCJcIikgcmV0dXJuXG4gIHZhciBjbGFzc2VzID0gZWwuY2xhc3NOYW1lLnNwbGl0KCcgJylcbiAgdmFyIGlkeCA9IGluZGV4T2YoY2xhc3NlcywgY2xhc3NOYW1lKVxuICBpZiAoaWR4ID4gLTEpIGNsYXNzZXMuc3BsaWNlKGlkeCwgMSlcbiAgZWwuY2xhc3NOYW1lID0gY2xhc3Nlcy5qb2luKCcgJylcbiAgcmV0dXJuIGNsYXNzZXNcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS5oYXMgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgdmFyIGNsYXNzZXMgPSBlbC5jbGFzc05hbWUuc3BsaXQoJyAnKVxuICByZXR1cm4gaW5kZXhPZihjbGFzc2VzLCBjbGFzc05hbWUpID4gLTFcbn1cblxuRWxlbWVudENsYXNzLnByb3RvdHlwZS50b2dnbGUgPSBmdW5jdGlvbihjbGFzc05hbWUpIHtcbiAgdmFyIGVsID0gdGhpcy5lbFxuICBpZiAoIWVsKSByZXR1cm5cbiAgaWYgKHRoaXMuaGFzKGNsYXNzTmFtZSkpIHRoaXMucmVtb3ZlKGNsYXNzTmFtZSlcbiAgZWxzZSB0aGlzLmFkZChjbGFzc05hbWUpXG59XG4iLCIvLyBzaGltIGZvciB1c2luZyBwcm9jZXNzIGluIGJyb3dzZXJcblxudmFyIHByb2Nlc3MgPSBtb2R1bGUuZXhwb3J0cyA9IHt9O1xudmFyIHF1ZXVlID0gW107XG52YXIgZHJhaW5pbmcgPSBmYWxzZTtcbnZhciBjdXJyZW50UXVldWU7XG52YXIgcXVldWVJbmRleCA9IC0xO1xuXG5mdW5jdGlvbiBjbGVhblVwTmV4dFRpY2soKSB7XG4gICAgaWYgKCFkcmFpbmluZyB8fCAhY3VycmVudFF1ZXVlKSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZHJhaW5pbmcgPSBmYWxzZTtcbiAgICBpZiAoY3VycmVudFF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBxdWV1ZSA9IGN1cnJlbnRRdWV1ZS5jb25jYXQocXVldWUpO1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICB9XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCkge1xuICAgICAgICBkcmFpblF1ZXVlKCk7XG4gICAgfVxufVxuXG5mdW5jdGlvbiBkcmFpblF1ZXVlKCkge1xuICAgIGlmIChkcmFpbmluZykge1xuICAgICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciB0aW1lb3V0ID0gc2V0VGltZW91dChjbGVhblVwTmV4dFRpY2spO1xuICAgIGRyYWluaW5nID0gdHJ1ZTtcblxuICAgIHZhciBsZW4gPSBxdWV1ZS5sZW5ndGg7XG4gICAgd2hpbGUobGVuKSB7XG4gICAgICAgIGN1cnJlbnRRdWV1ZSA9IHF1ZXVlO1xuICAgICAgICBxdWV1ZSA9IFtdO1xuICAgICAgICB3aGlsZSAoKytxdWV1ZUluZGV4IDwgbGVuKSB7XG4gICAgICAgICAgICBpZiAoY3VycmVudFF1ZXVlKSB7XG4gICAgICAgICAgICAgICAgY3VycmVudFF1ZXVlW3F1ZXVlSW5kZXhdLnJ1bigpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHF1ZXVlSW5kZXggPSAtMTtcbiAgICAgICAgbGVuID0gcXVldWUubGVuZ3RoO1xuICAgIH1cbiAgICBjdXJyZW50UXVldWUgPSBudWxsO1xuICAgIGRyYWluaW5nID0gZmFsc2U7XG4gICAgY2xlYXJUaW1lb3V0KHRpbWVvdXQpO1xufVxuXG5wcm9jZXNzLm5leHRUaWNrID0gZnVuY3Rpb24gKGZ1bikge1xuICAgIHZhciBhcmdzID0gbmV3IEFycmF5KGFyZ3VtZW50cy5sZW5ndGggLSAxKTtcbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPCBhcmd1bWVudHMubGVuZ3RoOyBpKyspIHtcbiAgICAgICAgICAgIGFyZ3NbaSAtIDFdID0gYXJndW1lbnRzW2ldO1xuICAgICAgICB9XG4gICAgfVxuICAgIHF1ZXVlLnB1c2gobmV3IEl0ZW0oZnVuLCBhcmdzKSk7XG4gICAgaWYgKHF1ZXVlLmxlbmd0aCA9PT0gMSAmJiAhZHJhaW5pbmcpIHtcbiAgICAgICAgc2V0VGltZW91dChkcmFpblF1ZXVlLCAwKTtcbiAgICB9XG59O1xuXG4vLyB2OCBsaWtlcyBwcmVkaWN0aWJsZSBvYmplY3RzXG5mdW5jdGlvbiBJdGVtKGZ1biwgYXJyYXkpIHtcbiAgICB0aGlzLmZ1biA9IGZ1bjtcbiAgICB0aGlzLmFycmF5ID0gYXJyYXk7XG59XG5JdGVtLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5mdW4uYXBwbHkobnVsbCwgdGhpcy5hcnJheSk7XG59O1xucHJvY2Vzcy50aXRsZSA9ICdicm93c2VyJztcbnByb2Nlc3MuYnJvd3NlciA9IHRydWU7XG5wcm9jZXNzLmVudiA9IHt9O1xucHJvY2Vzcy5hcmd2ID0gW107XG5wcm9jZXNzLnZlcnNpb24gPSAnJzsgLy8gZW1wdHkgc3RyaW5nIHRvIGF2b2lkIHJlZ2V4cCBpc3N1ZXNcbnByb2Nlc3MudmVyc2lvbnMgPSB7fTtcblxuZnVuY3Rpb24gbm9vcCgpIHt9XG5cbnByb2Nlc3Mub24gPSBub29wO1xucHJvY2Vzcy5hZGRMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLm9uY2UgPSBub29wO1xucHJvY2Vzcy5vZmYgPSBub29wO1xucHJvY2Vzcy5yZW1vdmVMaXN0ZW5lciA9IG5vb3A7XG5wcm9jZXNzLnJlbW92ZUFsbExpc3RlbmVycyA9IG5vb3A7XG5wcm9jZXNzLmVtaXQgPSBub29wO1xuXG5wcm9jZXNzLmJpbmRpbmcgPSBmdW5jdGlvbiAobmFtZSkge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5iaW5kaW5nIGlzIG5vdCBzdXBwb3J0ZWQnKTtcbn07XG5cbnByb2Nlc3MuY3dkID0gZnVuY3Rpb24gKCkgeyByZXR1cm4gJy8nIH07XG5wcm9jZXNzLmNoZGlyID0gZnVuY3Rpb24gKGRpcikge1xuICAgIHRocm93IG5ldyBFcnJvcigncHJvY2Vzcy5jaGRpciBpcyBub3Qgc3VwcG9ydGVkJyk7XG59O1xucHJvY2Vzcy51bWFzayA9IGZ1bmN0aW9uKCkgeyByZXR1cm4gMDsgfTtcbiIsInZhciBWdWUgLy8gbGF0ZSBiaW5kXG52YXIgbWFwID0gT2JqZWN0LmNyZWF0ZShudWxsKVxudmFyIHNoaW1tZWQgPSBmYWxzZVxudmFyIGlzQnJvd3NlcmlmeSA9IGZhbHNlXG5cbi8qKlxuICogRGV0ZXJtaW5lIGNvbXBhdGliaWxpdHkgYW5kIGFwcGx5IHBhdGNoLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHZ1ZVxuICogQHBhcmFtIHtCb29sZWFufSBicm93c2VyaWZ5XG4gKi9cblxuZXhwb3J0cy5pbnN0YWxsID0gZnVuY3Rpb24gKHZ1ZSwgYnJvd3NlcmlmeSkge1xuICBpZiAoc2hpbW1lZCkgcmV0dXJuXG4gIHNoaW1tZWQgPSB0cnVlXG5cbiAgVnVlID0gdnVlXG4gIGlzQnJvd3NlcmlmeSA9IGJyb3dzZXJpZnlcblxuICBleHBvcnRzLmNvbXBhdGlibGUgPSAhIVZ1ZS5pbnRlcm5hbERpcmVjdGl2ZXNcbiAgaWYgKCFleHBvcnRzLmNvbXBhdGlibGUpIHtcbiAgICBjb25zb2xlLndhcm4oXG4gICAgICAnW0hNUl0gdnVlLWxvYWRlciBob3QgcmVsb2FkIGlzIG9ubHkgY29tcGF0aWJsZSB3aXRoICcgK1xuICAgICAgJ1Z1ZS5qcyAxLjAuMCsuJ1xuICAgIClcbiAgICByZXR1cm5cbiAgfVxuXG4gIC8vIHBhdGNoIHZpZXcgZGlyZWN0aXZlXG4gIHBhdGNoVmlldyhWdWUuaW50ZXJuYWxEaXJlY3RpdmVzLmNvbXBvbmVudClcbiAgY29uc29sZS5sb2coJ1tITVJdIFZ1ZSBjb21wb25lbnQgaG90IHJlbG9hZCBzaGltIGFwcGxpZWQuJylcbiAgLy8gc2hpbSByb3V0ZXItdmlldyBpZiBwcmVzZW50XG4gIHZhciByb3V0ZXJWaWV3ID0gVnVlLmVsZW1lbnREaXJlY3RpdmUoJ3JvdXRlci12aWV3JylcbiAgaWYgKHJvdXRlclZpZXcpIHtcbiAgICBwYXRjaFZpZXcocm91dGVyVmlldylcbiAgICBjb25zb2xlLmxvZygnW0hNUl0gdnVlLXJvdXRlciA8cm91dGVyLXZpZXc+IGhvdCByZWxvYWQgc2hpbSBhcHBsaWVkLicpXG4gIH1cbn1cblxuLyoqXG4gKiBTaGltIHRoZSB2aWV3IGRpcmVjdGl2ZSAoY29tcG9uZW50IG9yIHJvdXRlci12aWV3KS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gVmlld1xuICovXG5cbmZ1bmN0aW9uIHBhdGNoVmlldyAoVmlldykge1xuICB2YXIgdW5idWlsZCA9IFZpZXcudW5idWlsZFxuICBWaWV3LnVuYnVpbGQgPSBmdW5jdGlvbiAoZGVmZXIpIHtcbiAgICBpZiAoIXRoaXMuaG90VXBkYXRpbmcpIHtcbiAgICAgIHZhciBwcmV2Q29tcG9uZW50ID0gdGhpcy5jaGlsZFZNICYmIHRoaXMuY2hpbGRWTS5jb25zdHJ1Y3RvclxuICAgICAgcmVtb3ZlVmlldyhwcmV2Q29tcG9uZW50LCB0aGlzKVxuICAgICAgLy8gZGVmZXIgPSB0cnVlIG1lYW5zIHdlIGFyZSB0cmFuc2l0aW9uaW5nIHRvIGEgbmV3XG4gICAgICAvLyBDb21wb25lbnQuIFJlZ2lzdGVyIHRoaXMgbmV3IGNvbXBvbmVudCB0byB0aGUgbGlzdC5cbiAgICAgIGlmIChkZWZlcikge1xuICAgICAgICBhZGRWaWV3KHRoaXMuQ29tcG9uZW50LCB0aGlzKVxuICAgICAgfVxuICAgIH1cbiAgICAvLyBjYWxsIG9yaWdpbmFsXG4gICAgcmV0dXJuIHVuYnVpbGQuY2FsbCh0aGlzLCBkZWZlcilcbiAgfVxufVxuXG4vKipcbiAqIEFkZCBhIGNvbXBvbmVudCB2aWV3IHRvIGEgQ29tcG9uZW50J3MgaG90IGxpc3RcbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBDb21wb25lbnRcbiAqIEBwYXJhbSB7RGlyZWN0aXZlfSB2aWV3IC0gdmlldyBkaXJlY3RpdmUgaW5zdGFuY2VcbiAqL1xuXG5mdW5jdGlvbiBhZGRWaWV3IChDb21wb25lbnQsIHZpZXcpIHtcbiAgdmFyIGlkID0gQ29tcG9uZW50ICYmIENvbXBvbmVudC5vcHRpb25zLmhvdElEXG4gIGlmIChpZCkge1xuICAgIGlmICghbWFwW2lkXSkge1xuICAgICAgbWFwW2lkXSA9IHtcbiAgICAgICAgQ29tcG9uZW50OiBDb21wb25lbnQsXG4gICAgICAgIHZpZXdzOiBbXSxcbiAgICAgICAgaW5zdGFuY2VzOiBbXVxuICAgICAgfVxuICAgIH1cbiAgICBtYXBbaWRdLnZpZXdzLnB1c2godmlldylcbiAgfVxufVxuXG4vKipcbiAqIFJlbW92ZSBhIGNvbXBvbmVudCB2aWV3IGZyb20gYSBDb21wb25lbnQncyBob3QgbGlzdFxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IENvbXBvbmVudFxuICogQHBhcmFtIHtEaXJlY3RpdmV9IHZpZXcgLSB2aWV3IGRpcmVjdGl2ZSBpbnN0YW5jZVxuICovXG5cbmZ1bmN0aW9uIHJlbW92ZVZpZXcgKENvbXBvbmVudCwgdmlldykge1xuICB2YXIgaWQgPSBDb21wb25lbnQgJiYgQ29tcG9uZW50Lm9wdGlvbnMuaG90SURcbiAgaWYgKGlkKSB7XG4gICAgbWFwW2lkXS52aWV3cy4kcmVtb3ZlKHZpZXcpXG4gIH1cbn1cblxuLyoqXG4gKiBDcmVhdGUgYSByZWNvcmQgZm9yIGEgaG90IG1vZHVsZSwgd2hpY2gga2VlcHMgdHJhY2sgb2YgaXRzIGNvbnN0cnVjb3RyLFxuICogaW5zdG5hY2VzIGFuZCB2aWV3cyAoY29tcG9uZW50IGRpcmVjdGl2ZXMgb3Igcm91dGVyLXZpZXdzKS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gaWRcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKi9cblxuZXhwb3J0cy5jcmVhdGVSZWNvcmQgPSBmdW5jdGlvbiAoaWQsIG9wdGlvbnMpIHtcbiAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnZnVuY3Rpb24nKSB7XG4gICAgb3B0aW9ucyA9IG9wdGlvbnMub3B0aW9uc1xuICB9XG4gIGlmICh0eXBlb2Ygb3B0aW9ucy5lbCAhPT0gJ3N0cmluZycgJiYgdHlwZW9mIG9wdGlvbnMuZGF0YSAhPT0gJ29iamVjdCcpIHtcbiAgICBtYWtlT3B0aW9uc0hvdChpZCwgb3B0aW9ucylcbiAgICBtYXBbaWRdID0ge1xuICAgICAgQ29tcG9uZW50OiBudWxsLFxuICAgICAgdmlld3M6IFtdLFxuICAgICAgaW5zdGFuY2VzOiBbXVxuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE1ha2UgYSBDb21wb25lbnQgb3B0aW9ucyBvYmplY3QgaG90LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBpZFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqL1xuXG5mdW5jdGlvbiBtYWtlT3B0aW9uc0hvdCAoaWQsIG9wdGlvbnMpIHtcbiAgb3B0aW9ucy5ob3RJRCA9IGlkXG4gIGluamVjdEhvb2sob3B0aW9ucywgJ2NyZWF0ZWQnLCBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIHJlY29yZCA9IG1hcFtpZF1cbiAgICBpZiAoIXJlY29yZC5Db21wb25lbnQpIHtcbiAgICAgIHJlY29yZC5Db21wb25lbnQgPSB0aGlzLmNvbnN0cnVjdG9yXG4gICAgfVxuICAgIHJlY29yZC5pbnN0YW5jZXMucHVzaCh0aGlzKVxuICB9KVxuICBpbmplY3RIb29rKG9wdGlvbnMsICdiZWZvcmVEZXN0cm95JywgZnVuY3Rpb24gKCkge1xuICAgIG1hcFtpZF0uaW5zdGFuY2VzLiRyZW1vdmUodGhpcylcbiAgfSlcbn1cblxuLyoqXG4gKiBJbmplY3QgYSBob29rIHRvIGEgaG90IHJlbG9hZGFibGUgY29tcG9uZW50IHNvIHRoYXRcbiAqIHdlIGNhbiBrZWVwIHRyYWNrIG9mIGl0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gaG9va1xuICovXG5cbmZ1bmN0aW9uIGluamVjdEhvb2sgKG9wdGlvbnMsIG5hbWUsIGhvb2spIHtcbiAgdmFyIGV4aXN0aW5nID0gb3B0aW9uc1tuYW1lXVxuICBvcHRpb25zW25hbWVdID0gZXhpc3RpbmdcbiAgICA/IEFycmF5LmlzQXJyYXkoZXhpc3RpbmcpXG4gICAgICA/IGV4aXN0aW5nLmNvbmNhdChob29rKVxuICAgICAgOiBbZXhpc3RpbmcsIGhvb2tdXG4gICAgOiBbaG9va11cbn1cblxuLyoqXG4gKiBVcGRhdGUgYSBob3QgY29tcG9uZW50LlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBpZFxuICogQHBhcmFtIHtPYmplY3R8bnVsbH0gbmV3T3B0aW9uc1xuICogQHBhcmFtIHtTdHJpbmd8bnVsbH0gbmV3VGVtcGxhdGVcbiAqL1xuXG5leHBvcnRzLnVwZGF0ZSA9IGZ1bmN0aW9uIChpZCwgbmV3T3B0aW9ucywgbmV3VGVtcGxhdGUpIHtcbiAgdmFyIHJlY29yZCA9IG1hcFtpZF1cbiAgLy8gZm9yY2UgZnVsbC1yZWxvYWQgaWYgYW4gaW5zdGFuY2Ugb2YgdGhlIGNvbXBvbmVudCBpcyBhY3RpdmUgYnV0IGlzIG5vdFxuICAvLyBtYW5hZ2VkIGJ5IGEgdmlld1xuICBpZiAoIXJlY29yZCB8fCAocmVjb3JkLmluc3RhbmNlcy5sZW5ndGggJiYgIXJlY29yZC52aWV3cy5sZW5ndGgpKSB7XG4gICAgY29uc29sZS5sb2coJ1tITVJdIFJvb3Qgb3IgbWFudWFsbHktbW91bnRlZCBpbnN0YW5jZSBtb2RpZmllZC4gRnVsbCByZWxvYWQgbWF5IGJlIHJlcXVpcmVkLicpXG4gICAgaWYgKCFpc0Jyb3dzZXJpZnkpIHtcbiAgICAgIHdpbmRvdy5sb2NhdGlvbi5yZWxvYWQoKVxuICAgIH0gZWxzZSB7XG4gICAgICAvLyBicm93c2VyaWZ5LWhtciBzb21laG93IHNlbmRzIGluY29tcGxldGUgYnVuZGxlIGlmIHdlIHJlbG9hZCBoZXJlXG4gICAgICByZXR1cm5cbiAgICB9XG4gIH1cbiAgaWYgKCFpc0Jyb3dzZXJpZnkpIHtcbiAgICAvLyBicm93c2VyaWZ5LWhtciBhbHJlYWR5IGxvZ3MgdGhpc1xuICAgIGNvbnNvbGUubG9nKCdbSE1SXSBVcGRhdGluZyBjb21wb25lbnQ6ICcgKyBmb3JtYXQoaWQpKVxuICB9XG4gIHZhciBDb21wb25lbnQgPSByZWNvcmQuQ29tcG9uZW50XG4gIC8vIHVwZGF0ZSBjb25zdHJ1Y3RvclxuICBpZiAobmV3T3B0aW9ucykge1xuICAgIC8vIGluIGNhc2UgdGhlIHVzZXIgZXhwb3J0cyBhIGNvbnN0cnVjdG9yXG4gICAgQ29tcG9uZW50ID0gcmVjb3JkLkNvbXBvbmVudCA9IHR5cGVvZiBuZXdPcHRpb25zID09PSAnZnVuY3Rpb24nXG4gICAgICA/IG5ld09wdGlvbnNcbiAgICAgIDogVnVlLmV4dGVuZChuZXdPcHRpb25zKVxuICAgIG1ha2VPcHRpb25zSG90KGlkLCBDb21wb25lbnQub3B0aW9ucylcbiAgfVxuICBpZiAobmV3VGVtcGxhdGUpIHtcbiAgICBDb21wb25lbnQub3B0aW9ucy50ZW1wbGF0ZSA9IG5ld1RlbXBsYXRlXG4gIH1cbiAgLy8gaGFuZGxlIHJlY3Vyc2l2ZSBsb29rdXBcbiAgaWYgKENvbXBvbmVudC5vcHRpb25zLm5hbWUpIHtcbiAgICBDb21wb25lbnQub3B0aW9ucy5jb21wb25lbnRzW0NvbXBvbmVudC5vcHRpb25zLm5hbWVdID0gQ29tcG9uZW50XG4gIH1cbiAgLy8gcmVzZXQgY29uc3RydWN0b3IgY2FjaGVkIGxpbmtlclxuICBDb21wb25lbnQubGlua2VyID0gbnVsbFxuICAvLyByZWxvYWQgYWxsIHZpZXdzXG4gIHJlY29yZC52aWV3cy5mb3JFYWNoKGZ1bmN0aW9uICh2aWV3KSB7XG4gICAgdXBkYXRlVmlldyh2aWV3LCBDb21wb25lbnQpXG4gIH0pXG4gIC8vIGZsdXNoIGRldnRvb2xzXG4gIGlmICh3aW5kb3cuX19WVUVfREVWVE9PTFNfR0xPQkFMX0hPT0tfXykge1xuICAgIHdpbmRvdy5fX1ZVRV9ERVZUT09MU19HTE9CQUxfSE9PS19fLmVtaXQoJ2ZsdXNoJylcbiAgfVxufVxuXG4vKipcbiAqIFVwZGF0ZSBhIGNvbXBvbmVudCB2aWV3IGluc3RhbmNlXG4gKlxuICogQHBhcmFtIHtEaXJlY3RpdmV9IHZpZXdcbiAqIEBwYXJhbSB7RnVuY3Rpb259IENvbXBvbmVudFxuICovXG5cbmZ1bmN0aW9uIHVwZGF0ZVZpZXcgKHZpZXcsIENvbXBvbmVudCkge1xuICBpZiAoIXZpZXcuX2JvdW5kKSB7XG4gICAgcmV0dXJuXG4gIH1cbiAgdmlldy5Db21wb25lbnQgPSBDb21wb25lbnRcbiAgdmlldy5ob3RVcGRhdGluZyA9IHRydWVcbiAgLy8gZGlzYWJsZSB0cmFuc2l0aW9uc1xuICB2aWV3LnZtLl9pc0NvbXBpbGVkID0gZmFsc2VcbiAgLy8gc2F2ZSBzdGF0ZVxuICB2YXIgc3RhdGUgPSBleHRyYWN0U3RhdGUodmlldy5jaGlsZFZNKVxuICAvLyByZW1vdW50LCBtYWtlIHN1cmUgdG8gZGlzYWJsZSBrZWVwLWFsaXZlXG4gIHZhciBrZWVwQWxpdmUgPSB2aWV3LmtlZXBBbGl2ZVxuICB2aWV3LmtlZXBBbGl2ZSA9IGZhbHNlXG4gIHZpZXcubW91bnRDb21wb25lbnQoKVxuICB2aWV3LmtlZXBBbGl2ZSA9IGtlZXBBbGl2ZVxuICAvLyByZXN0b3JlIHN0YXRlXG4gIHJlc3RvcmVTdGF0ZSh2aWV3LmNoaWxkVk0sIHN0YXRlLCB0cnVlKVxuICAvLyByZS1lYW5ibGUgdHJhbnNpdGlvbnNcbiAgdmlldy52bS5faXNDb21waWxlZCA9IHRydWVcbiAgdmlldy5ob3RVcGRhdGluZyA9IGZhbHNlXG59XG5cbi8qKlxuICogRXh0cmFjdCBzdGF0ZSBmcm9tIGEgVnVlIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5cbmZ1bmN0aW9uIGV4dHJhY3RTdGF0ZSAodm0pIHtcbiAgcmV0dXJuIHtcbiAgICBjaWQ6IHZtLmNvbnN0cnVjdG9yLmNpZCxcbiAgICBkYXRhOiB2bS4kZGF0YSxcbiAgICBjaGlsZHJlbjogdm0uJGNoaWxkcmVuLm1hcChleHRyYWN0U3RhdGUpXG4gIH1cbn1cblxuLyoqXG4gKiBSZXN0b3JlIHN0YXRlIHRvIGEgcmVsb2FkZWQgVnVlIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtPYmplY3R9IHN0YXRlXG4gKi9cblxuZnVuY3Rpb24gcmVzdG9yZVN0YXRlICh2bSwgc3RhdGUsIGlzUm9vdCkge1xuICB2YXIgb2xkQXN5bmNDb25maWdcbiAgaWYgKGlzUm9vdCkge1xuICAgIC8vIHNldCBWdWUgaW50byBzeW5jIG1vZGUgZHVyaW5nIHN0YXRlIHJlaHlkcmF0aW9uXG4gICAgb2xkQXN5bmNDb25maWcgPSBWdWUuY29uZmlnLmFzeW5jXG4gICAgVnVlLmNvbmZpZy5hc3luYyA9IGZhbHNlXG4gIH1cbiAgLy8gYWN0dWFsIHJlc3RvcmVcbiAgaWYgKGlzUm9vdCB8fCAhdm0uX3Byb3BzKSB7XG4gICAgdm0uJGRhdGEgPSBzdGF0ZS5kYXRhXG4gIH0gZWxzZSB7XG4gICAgT2JqZWN0LmtleXMoc3RhdGUuZGF0YSkuZm9yRWFjaChmdW5jdGlvbiAoa2V5KSB7XG4gICAgICBpZiAoIXZtLl9wcm9wc1trZXldKSB7XG4gICAgICAgIC8vIGZvciBub24tcm9vdCwgb25seSByZXN0b3JlIG5vbi1wcm9wcyBmaWVsZHNcbiAgICAgICAgdm0uJGRhdGFba2V5XSA9IHN0YXRlLmRhdGFba2V5XVxuICAgICAgfVxuICAgIH0pXG4gIH1cbiAgLy8gdmVyaWZ5IGNoaWxkIGNvbnNpc3RlbmN5XG4gIHZhciBoYXNTYW1lQ2hpbGRyZW4gPSB2bS4kY2hpbGRyZW4uZXZlcnkoZnVuY3Rpb24gKGMsIGkpIHtcbiAgICByZXR1cm4gc3RhdGUuY2hpbGRyZW5baV0gJiYgc3RhdGUuY2hpbGRyZW5baV0uY2lkID09PSBjLmNvbnN0cnVjdG9yLmNpZFxuICB9KVxuICBpZiAoaGFzU2FtZUNoaWxkcmVuKSB7XG4gICAgLy8gcmVoeWRyYXRlIGNoaWxkcmVuXG4gICAgdm0uJGNoaWxkcmVuLmZvckVhY2goZnVuY3Rpb24gKGMsIGkpIHtcbiAgICAgIHJlc3RvcmVTdGF0ZShjLCBzdGF0ZS5jaGlsZHJlbltpXSlcbiAgICB9KVxuICB9XG4gIGlmIChpc1Jvb3QpIHtcbiAgICBWdWUuY29uZmlnLmFzeW5jID0gb2xkQXN5bmNDb25maWdcbiAgfVxufVxuXG5mdW5jdGlvbiBmb3JtYXQgKGlkKSB7XG4gIHJldHVybiBpZC5tYXRjaCgvW15cXC9dK1xcLnZ1ZSQvKVswXVxufVxuIiwiLyohXG4gKiBWdWUuanMgdjEuMC4yNFxuICogKGMpIDIwMTYgRXZhbiBZb3VcbiAqIFJlbGVhc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS5cbiAqL1xuJ3VzZSBzdHJpY3QnO1xuXG5mdW5jdGlvbiBzZXQob2JqLCBrZXksIHZhbCkge1xuICBpZiAoaGFzT3duKG9iaiwga2V5KSkge1xuICAgIG9ialtrZXldID0gdmFsO1xuICAgIHJldHVybjtcbiAgfVxuICBpZiAob2JqLl9pc1Z1ZSkge1xuICAgIHNldChvYmouX2RhdGEsIGtleSwgdmFsKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG9iID0gb2JqLl9fb2JfXztcbiAgaWYgKCFvYikge1xuICAgIG9ialtrZXldID0gdmFsO1xuICAgIHJldHVybjtcbiAgfVxuICBvYi5jb252ZXJ0KGtleSwgdmFsKTtcbiAgb2IuZGVwLm5vdGlmeSgpO1xuICBpZiAob2Iudm1zKSB7XG4gICAgdmFyIGkgPSBvYi52bXMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHZhciB2bSA9IG9iLnZtc1tpXTtcbiAgICAgIHZtLl9wcm94eShrZXkpO1xuICAgICAgdm0uX2RpZ2VzdCgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdmFsO1xufVxuXG4vKipcbiAqIERlbGV0ZSBhIHByb3BlcnR5IGFuZCB0cmlnZ2VyIGNoYW5nZSBpZiBuZWNlc3NhcnkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICovXG5cbmZ1bmN0aW9uIGRlbChvYmosIGtleSkge1xuICBpZiAoIWhhc093bihvYmosIGtleSkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgZGVsZXRlIG9ialtrZXldO1xuICB2YXIgb2IgPSBvYmouX19vYl9fO1xuICBpZiAoIW9iKSB7XG4gICAgaWYgKG9iai5faXNWdWUpIHtcbiAgICAgIGRlbGV0ZSBvYmouX2RhdGFba2V5XTtcbiAgICAgIG9iai5fZGlnZXN0KCk7XG4gICAgfVxuICAgIHJldHVybjtcbiAgfVxuICBvYi5kZXAubm90aWZ5KCk7XG4gIGlmIChvYi52bXMpIHtcbiAgICB2YXIgaSA9IG9iLnZtcy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgdmFyIHZtID0gb2Iudm1zW2ldO1xuICAgICAgdm0uX3VucHJveHkoa2V5KTtcbiAgICAgIHZtLl9kaWdlc3QoKTtcbiAgICB9XG4gIH1cbn1cblxudmFyIGhhc093blByb3BlcnR5ID0gT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eTtcbi8qKlxuICogQ2hlY2sgd2hldGhlciB0aGUgb2JqZWN0IGhhcyB0aGUgcHJvcGVydHkuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9ialxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5mdW5jdGlvbiBoYXNPd24ob2JqLCBrZXkpIHtcbiAgcmV0dXJuIGhhc093blByb3BlcnR5LmNhbGwob2JqLCBrZXkpO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGFuIGV4cHJlc3Npb24gaXMgYSBsaXRlcmFsIHZhbHVlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxudmFyIGxpdGVyYWxWYWx1ZVJFID0gL15cXHM/KHRydWV8ZmFsc2V8LT9bXFxkXFwuXSt8J1teJ10qJ3xcIlteXCJdKlwiKVxccz8kLztcblxuZnVuY3Rpb24gaXNMaXRlcmFsKGV4cCkge1xuICByZXR1cm4gbGl0ZXJhbFZhbHVlUkUudGVzdChleHApO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGEgc3RyaW5nIHN0YXJ0cyB3aXRoICQgb3IgX1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaXNSZXNlcnZlZChzdHIpIHtcbiAgdmFyIGMgPSAoc3RyICsgJycpLmNoYXJDb2RlQXQoMCk7XG4gIHJldHVybiBjID09PSAweDI0IHx8IGMgPT09IDB4NUY7XG59XG5cbi8qKlxuICogR3VhcmQgdGV4dCBvdXRwdXQsIG1ha2Ugc3VyZSB1bmRlZmluZWQgb3V0cHV0c1xuICogZW1wdHkgc3RyaW5nXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmZ1bmN0aW9uIF90b1N0cmluZyh2YWx1ZSkge1xuICByZXR1cm4gdmFsdWUgPT0gbnVsbCA/ICcnIDogdmFsdWUudG9TdHJpbmcoKTtcbn1cblxuLyoqXG4gKiBDaGVjayBhbmQgY29udmVydCBwb3NzaWJsZSBudW1lcmljIHN0cmluZ3MgdG8gbnVtYmVyc1xuICogYmVmb3JlIHNldHRpbmcgYmFjayB0byBkYXRhXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHJldHVybiB7KnxOdW1iZXJ9XG4gKi9cblxuZnVuY3Rpb24gdG9OdW1iZXIodmFsdWUpIHtcbiAgaWYgKHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm4gdmFsdWU7XG4gIH0gZWxzZSB7XG4gICAgdmFyIHBhcnNlZCA9IE51bWJlcih2YWx1ZSk7XG4gICAgcmV0dXJuIGlzTmFOKHBhcnNlZCkgPyB2YWx1ZSA6IHBhcnNlZDtcbiAgfVxufVxuXG4vKipcbiAqIENvbnZlcnQgc3RyaW5nIGJvb2xlYW4gbGl0ZXJhbHMgaW50byByZWFsIGJvb2xlYW5zLlxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEByZXR1cm4geyp8Qm9vbGVhbn1cbiAqL1xuXG5mdW5jdGlvbiB0b0Jvb2xlYW4odmFsdWUpIHtcbiAgcmV0dXJuIHZhbHVlID09PSAndHJ1ZScgPyB0cnVlIDogdmFsdWUgPT09ICdmYWxzZScgPyBmYWxzZSA6IHZhbHVlO1xufVxuXG4vKipcbiAqIFN0cmlwIHF1b3RlcyBmcm9tIGEgc3RyaW5nXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHJldHVybiB7U3RyaW5nIHwgZmFsc2V9XG4gKi9cblxuZnVuY3Rpb24gc3RyaXBRdW90ZXMoc3RyKSB7XG4gIHZhciBhID0gc3RyLmNoYXJDb2RlQXQoMCk7XG4gIHZhciBiID0gc3RyLmNoYXJDb2RlQXQoc3RyLmxlbmd0aCAtIDEpO1xuICByZXR1cm4gYSA9PT0gYiAmJiAoYSA9PT0gMHgyMiB8fCBhID09PSAweDI3KSA/IHN0ci5zbGljZSgxLCAtMSkgOiBzdHI7XG59XG5cbi8qKlxuICogQ2FtZWxpemUgYSBoeXBoZW4tZGVsbWl0ZWQgc3RyaW5nLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBzdHJcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG52YXIgY2FtZWxpemVSRSA9IC8tKFxcdykvZztcblxuZnVuY3Rpb24gY2FtZWxpemUoc3RyKSB7XG4gIHJldHVybiBzdHIucmVwbGFjZShjYW1lbGl6ZVJFLCB0b1VwcGVyKTtcbn1cblxuZnVuY3Rpb24gdG9VcHBlcihfLCBjKSB7XG4gIHJldHVybiBjID8gYy50b1VwcGVyQ2FzZSgpIDogJyc7XG59XG5cbi8qKlxuICogSHlwaGVuYXRlIGEgY2FtZWxDYXNlIHN0cmluZy5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxudmFyIGh5cGhlbmF0ZVJFID0gLyhbYS16XFxkXSkoW0EtWl0pL2c7XG5cbmZ1bmN0aW9uIGh5cGhlbmF0ZShzdHIpIHtcbiAgcmV0dXJuIHN0ci5yZXBsYWNlKGh5cGhlbmF0ZVJFLCAnJDEtJDInKS50b0xvd2VyQ2FzZSgpO1xufVxuXG4vKipcbiAqIENvbnZlcnRzIGh5cGhlbi91bmRlcnNjb3JlL3NsYXNoIGRlbGltaXRlcmVkIG5hbWVzIGludG9cbiAqIGNhbWVsaXplZCBjbGFzc05hbWVzLlxuICpcbiAqIGUuZy4gbXktY29tcG9uZW50ID0+IE15Q29tcG9uZW50XG4gKiAgICAgIHNvbWVfZWxzZSAgICA9PiBTb21lRWxzZVxuICogICAgICBzb21lL2NvbXAgICAgPT4gU29tZUNvbXBcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxudmFyIGNsYXNzaWZ5UkUgPSAvKD86XnxbLV9cXC9dKShcXHcpL2c7XG5cbmZ1bmN0aW9uIGNsYXNzaWZ5KHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UoY2xhc3NpZnlSRSwgdG9VcHBlcik7XG59XG5cbi8qKlxuICogU2ltcGxlIGJpbmQsIGZhc3RlciB0aGFuIG5hdGl2ZVxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gKiBAcGFyYW0ge09iamVjdH0gY3R4XG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5mdW5jdGlvbiBiaW5kKGZuLCBjdHgpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIChhKSB7XG4gICAgdmFyIGwgPSBhcmd1bWVudHMubGVuZ3RoO1xuICAgIHJldHVybiBsID8gbCA+IDEgPyBmbi5hcHBseShjdHgsIGFyZ3VtZW50cykgOiBmbi5jYWxsKGN0eCwgYSkgOiBmbi5jYWxsKGN0eCk7XG4gIH07XG59XG5cbi8qKlxuICogQ29udmVydCBhbiBBcnJheS1saWtlIG9iamVjdCB0byBhIHJlYWwgQXJyYXkuXG4gKlxuICogQHBhcmFtIHtBcnJheS1saWtlfSBsaXN0XG4gKiBAcGFyYW0ge051bWJlcn0gW3N0YXJ0XSAtIHN0YXJ0IGluZGV4XG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuXG5mdW5jdGlvbiB0b0FycmF5KGxpc3QsIHN0YXJ0KSB7XG4gIHN0YXJ0ID0gc3RhcnQgfHwgMDtcbiAgdmFyIGkgPSBsaXN0Lmxlbmd0aCAtIHN0YXJ0O1xuICB2YXIgcmV0ID0gbmV3IEFycmF5KGkpO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgcmV0W2ldID0gbGlzdFtpICsgc3RhcnRdO1xuICB9XG4gIHJldHVybiByZXQ7XG59XG5cbi8qKlxuICogTWl4IHByb3BlcnRpZXMgaW50byB0YXJnZXQgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSB0b1xuICogQHBhcmFtIHtPYmplY3R9IGZyb21cbiAqL1xuXG5mdW5jdGlvbiBleHRlbmQodG8sIGZyb20pIHtcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhmcm9tKTtcbiAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIHRvW2tleXNbaV1dID0gZnJvbVtrZXlzW2ldXTtcbiAgfVxuICByZXR1cm4gdG87XG59XG5cbi8qKlxuICogUXVpY2sgb2JqZWN0IGNoZWNrIC0gdGhpcyBpcyBwcmltYXJpbHkgdXNlZCB0byB0ZWxsXG4gKiBPYmplY3RzIGZyb20gcHJpbWl0aXZlIHZhbHVlcyB3aGVuIHdlIGtub3cgdGhlIHZhbHVlXG4gKiBpcyBhIEpTT04tY29tcGxpYW50IHR5cGUuXG4gKlxuICogQHBhcmFtIHsqfSBvYmpcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaXNPYmplY3Qob2JqKSB7XG4gIHJldHVybiBvYmogIT09IG51bGwgJiYgdHlwZW9mIG9iaiA9PT0gJ29iamVjdCc7XG59XG5cbi8qKlxuICogU3RyaWN0IG9iamVjdCB0eXBlIGNoZWNrLiBPbmx5IHJldHVybnMgdHJ1ZVxuICogZm9yIHBsYWluIEphdmFTY3JpcHQgb2JqZWN0cy5cbiAqXG4gKiBAcGFyYW0geyp9IG9ialxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG52YXIgdG9TdHJpbmcgPSBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nO1xudmFyIE9CSkVDVF9TVFJJTkcgPSAnW29iamVjdCBPYmplY3RdJztcblxuZnVuY3Rpb24gaXNQbGFpbk9iamVjdChvYmopIHtcbiAgcmV0dXJuIHRvU3RyaW5nLmNhbGwob2JqKSA9PT0gT0JKRUNUX1NUUklORztcbn1cblxuLyoqXG4gKiBBcnJheSB0eXBlIGNoZWNrLlxuICpcbiAqIEBwYXJhbSB7Kn0gb2JqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5cbnZhciBpc0FycmF5ID0gQXJyYXkuaXNBcnJheTtcblxuLyoqXG4gKiBEZWZpbmUgYSBwcm9wZXJ0eS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0geyp9IHZhbFxuICogQHBhcmFtIHtCb29sZWFufSBbZW51bWVyYWJsZV1cbiAqL1xuXG5mdW5jdGlvbiBkZWYob2JqLCBrZXksIHZhbCwgZW51bWVyYWJsZSkge1xuICBPYmplY3QuZGVmaW5lUHJvcGVydHkob2JqLCBrZXksIHtcbiAgICB2YWx1ZTogdmFsLFxuICAgIGVudW1lcmFibGU6ICEhZW51bWVyYWJsZSxcbiAgICB3cml0YWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWVcbiAgfSk7XG59XG5cbi8qKlxuICogRGVib3VuY2UgYSBmdW5jdGlvbiBzbyBpdCBvbmx5IGdldHMgY2FsbGVkIGFmdGVyIHRoZVxuICogaW5wdXQgc3RvcHMgYXJyaXZpbmcgYWZ0ZXIgdGhlIGdpdmVuIHdhaXQgcGVyaW9kLlxuICpcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGZ1bmNcbiAqIEBwYXJhbSB7TnVtYmVyfSB3YWl0XG4gKiBAcmV0dXJuIHtGdW5jdGlvbn0gLSB0aGUgZGVib3VuY2VkIGZ1bmN0aW9uXG4gKi9cblxuZnVuY3Rpb24gX2RlYm91bmNlKGZ1bmMsIHdhaXQpIHtcbiAgdmFyIHRpbWVvdXQsIGFyZ3MsIGNvbnRleHQsIHRpbWVzdGFtcCwgcmVzdWx0O1xuICB2YXIgbGF0ZXIgPSBmdW5jdGlvbiBsYXRlcigpIHtcbiAgICB2YXIgbGFzdCA9IERhdGUubm93KCkgLSB0aW1lc3RhbXA7XG4gICAgaWYgKGxhc3QgPCB3YWl0ICYmIGxhc3QgPj0gMCkge1xuICAgICAgdGltZW91dCA9IHNldFRpbWVvdXQobGF0ZXIsIHdhaXQgLSBsYXN0KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGltZW91dCA9IG51bGw7XG4gICAgICByZXN1bHQgPSBmdW5jLmFwcGx5KGNvbnRleHQsIGFyZ3MpO1xuICAgICAgaWYgKCF0aW1lb3V0KSBjb250ZXh0ID0gYXJncyA9IG51bGw7XG4gICAgfVxuICB9O1xuICByZXR1cm4gZnVuY3Rpb24gKCkge1xuICAgIGNvbnRleHQgPSB0aGlzO1xuICAgIGFyZ3MgPSBhcmd1bWVudHM7XG4gICAgdGltZXN0YW1wID0gRGF0ZS5ub3coKTtcbiAgICBpZiAoIXRpbWVvdXQpIHtcbiAgICAgIHRpbWVvdXQgPSBzZXRUaW1lb3V0KGxhdGVyLCB3YWl0KTtcbiAgICB9XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfTtcbn1cblxuLyoqXG4gKiBNYW51YWwgaW5kZXhPZiBiZWNhdXNlIGl0J3Mgc2xpZ2h0bHkgZmFzdGVyIHRoYW5cbiAqIG5hdGl2ZS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBhcnJcbiAqIEBwYXJhbSB7Kn0gb2JqXG4gKi9cblxuZnVuY3Rpb24gaW5kZXhPZihhcnIsIG9iaikge1xuICB2YXIgaSA9IGFyci5sZW5ndGg7XG4gIHdoaWxlIChpLS0pIHtcbiAgICBpZiAoYXJyW2ldID09PSBvYmopIHJldHVybiBpO1xuICB9XG4gIHJldHVybiAtMTtcbn1cblxuLyoqXG4gKiBNYWtlIGEgY2FuY2VsbGFibGUgdmVyc2lvbiBvZiBhbiBhc3luYyBjYWxsYmFjay5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gY2FuY2VsbGFibGUoZm4pIHtcbiAgdmFyIGNiID0gZnVuY3Rpb24gY2IoKSB7XG4gICAgaWYgKCFjYi5jYW5jZWxsZWQpIHtcbiAgICAgIHJldHVybiBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgfTtcbiAgY2IuY2FuY2VsID0gZnVuY3Rpb24gKCkge1xuICAgIGNiLmNhbmNlbGxlZCA9IHRydWU7XG4gIH07XG4gIHJldHVybiBjYjtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiB0d28gdmFsdWVzIGFyZSBsb29zZWx5IGVxdWFsIC0gdGhhdCBpcyxcbiAqIGlmIHRoZXkgYXJlIHBsYWluIG9iamVjdHMsIGRvIHRoZXkgaGF2ZSB0aGUgc2FtZSBzaGFwZT9cbiAqXG4gKiBAcGFyYW0geyp9IGFcbiAqIEBwYXJhbSB7Kn0gYlxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5mdW5jdGlvbiBsb29zZUVxdWFsKGEsIGIpIHtcbiAgLyogZXNsaW50LWRpc2FibGUgZXFlcWVxICovXG4gIHJldHVybiBhID09IGIgfHwgKGlzT2JqZWN0KGEpICYmIGlzT2JqZWN0KGIpID8gSlNPTi5zdHJpbmdpZnkoYSkgPT09IEpTT04uc3RyaW5naWZ5KGIpIDogZmFsc2UpO1xuICAvKiBlc2xpbnQtZW5hYmxlIGVxZXFlcSAqL1xufVxuXG52YXIgaGFzUHJvdG8gPSAoJ19fcHJvdG9fXycgaW4ge30pO1xuXG4vLyBCcm93c2VyIGVudmlyb25tZW50IHNuaWZmaW5nXG52YXIgaW5Ccm93c2VyID0gdHlwZW9mIHdpbmRvdyAhPT0gJ3VuZGVmaW5lZCcgJiYgT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHdpbmRvdykgIT09ICdbb2JqZWN0IE9iamVjdF0nO1xuXG4vLyBkZXRlY3QgZGV2dG9vbHNcbnZhciBkZXZ0b29scyA9IGluQnJvd3NlciAmJiB3aW5kb3cuX19WVUVfREVWVE9PTFNfR0xPQkFMX0hPT0tfXztcblxuLy8gVUEgc25pZmZpbmcgZm9yIHdvcmtpbmcgYXJvdW5kIGJyb3dzZXItc3BlY2lmaWMgcXVpcmtzXG52YXIgVUEgPSBpbkJyb3dzZXIgJiYgd2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQudG9Mb3dlckNhc2UoKTtcbnZhciBpc0lFOSA9IFVBICYmIFVBLmluZGV4T2YoJ21zaWUgOS4wJykgPiAwO1xudmFyIGlzQW5kcm9pZCA9IFVBICYmIFVBLmluZGV4T2YoJ2FuZHJvaWQnKSA+IDA7XG52YXIgaXNJb3MgPSBVQSAmJiAvKGlwaG9uZXxpcGFkfGlwb2R8aW9zKS9pLnRlc3QoVUEpO1xudmFyIGlzV2VjaGF0ID0gVUEgJiYgVUEuaW5kZXhPZignbWljcm9tZXNzZW5nZXInKSA+IDA7XG5cbnZhciB0cmFuc2l0aW9uUHJvcCA9IHVuZGVmaW5lZDtcbnZhciB0cmFuc2l0aW9uRW5kRXZlbnQgPSB1bmRlZmluZWQ7XG52YXIgYW5pbWF0aW9uUHJvcCA9IHVuZGVmaW5lZDtcbnZhciBhbmltYXRpb25FbmRFdmVudCA9IHVuZGVmaW5lZDtcblxuLy8gVHJhbnNpdGlvbiBwcm9wZXJ0eS9ldmVudCBzbmlmZmluZ1xuaWYgKGluQnJvd3NlciAmJiAhaXNJRTkpIHtcbiAgdmFyIGlzV2Via2l0VHJhbnMgPSB3aW5kb3cub250cmFuc2l0aW9uZW5kID09PSB1bmRlZmluZWQgJiYgd2luZG93Lm9ud2Via2l0dHJhbnNpdGlvbmVuZCAhPT0gdW5kZWZpbmVkO1xuICB2YXIgaXNXZWJraXRBbmltID0gd2luZG93Lm9uYW5pbWF0aW9uZW5kID09PSB1bmRlZmluZWQgJiYgd2luZG93Lm9ud2Via2l0YW5pbWF0aW9uZW5kICE9PSB1bmRlZmluZWQ7XG4gIHRyYW5zaXRpb25Qcm9wID0gaXNXZWJraXRUcmFucyA/ICdXZWJraXRUcmFuc2l0aW9uJyA6ICd0cmFuc2l0aW9uJztcbiAgdHJhbnNpdGlvbkVuZEV2ZW50ID0gaXNXZWJraXRUcmFucyA/ICd3ZWJraXRUcmFuc2l0aW9uRW5kJyA6ICd0cmFuc2l0aW9uZW5kJztcbiAgYW5pbWF0aW9uUHJvcCA9IGlzV2Via2l0QW5pbSA/ICdXZWJraXRBbmltYXRpb24nIDogJ2FuaW1hdGlvbic7XG4gIGFuaW1hdGlvbkVuZEV2ZW50ID0gaXNXZWJraXRBbmltID8gJ3dlYmtpdEFuaW1hdGlvbkVuZCcgOiAnYW5pbWF0aW9uZW5kJztcbn1cblxuLyoqXG4gKiBEZWZlciBhIHRhc2sgdG8gZXhlY3V0ZSBpdCBhc3luY2hyb25vdXNseS4gSWRlYWxseSB0aGlzXG4gKiBzaG91bGQgYmUgZXhlY3V0ZWQgYXMgYSBtaWNyb3Rhc2ssIHNvIHdlIGxldmVyYWdlXG4gKiBNdXRhdGlvbk9ic2VydmVyIGlmIGl0J3MgYXZhaWxhYmxlLCBhbmQgZmFsbGJhY2sgdG9cbiAqIHNldFRpbWVvdXQoMCkuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqIEBwYXJhbSB7T2JqZWN0fSBjdHhcbiAqL1xuXG52YXIgbmV4dFRpY2sgPSAoZnVuY3Rpb24gKCkge1xuICB2YXIgY2FsbGJhY2tzID0gW107XG4gIHZhciBwZW5kaW5nID0gZmFsc2U7XG4gIHZhciB0aW1lckZ1bmM7XG4gIGZ1bmN0aW9uIG5leHRUaWNrSGFuZGxlcigpIHtcbiAgICBwZW5kaW5nID0gZmFsc2U7XG4gICAgdmFyIGNvcGllcyA9IGNhbGxiYWNrcy5zbGljZSgwKTtcbiAgICBjYWxsYmFja3MgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNvcGllcy5sZW5ndGg7IGkrKykge1xuICAgICAgY29waWVzW2ldKCk7XG4gICAgfVxuICB9XG5cbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmICh0eXBlb2YgTXV0YXRpb25PYnNlcnZlciAhPT0gJ3VuZGVmaW5lZCcgJiYgIShpc1dlY2hhdCAmJiBpc0lvcykpIHtcbiAgICB2YXIgY291bnRlciA9IDE7XG4gICAgdmFyIG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIobmV4dFRpY2tIYW5kbGVyKTtcbiAgICB2YXIgdGV4dE5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShjb3VudGVyKTtcbiAgICBvYnNlcnZlci5vYnNlcnZlKHRleHROb2RlLCB7XG4gICAgICBjaGFyYWN0ZXJEYXRhOiB0cnVlXG4gICAgfSk7XG4gICAgdGltZXJGdW5jID0gZnVuY3Rpb24gKCkge1xuICAgICAgY291bnRlciA9IChjb3VudGVyICsgMSkgJSAyO1xuICAgICAgdGV4dE5vZGUuZGF0YSA9IGNvdW50ZXI7XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICAvLyB3ZWJwYWNrIGF0dGVtcHRzIHRvIGluamVjdCBhIHNoaW0gZm9yIHNldEltbWVkaWF0ZVxuICAgIC8vIGlmIGl0IGlzIHVzZWQgYXMgYSBnbG9iYWwsIHNvIHdlIGhhdmUgdG8gd29yayBhcm91bmQgdGhhdCB0b1xuICAgIC8vIGF2b2lkIGJ1bmRsaW5nIHVubmVjZXNzYXJ5IGNvZGUuXG4gICAgdmFyIGNvbnRleHQgPSBpbkJyb3dzZXIgPyB3aW5kb3cgOiB0eXBlb2YgZ2xvYmFsICE9PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6IHt9O1xuICAgIHRpbWVyRnVuYyA9IGNvbnRleHQuc2V0SW1tZWRpYXRlIHx8IHNldFRpbWVvdXQ7XG4gIH1cbiAgcmV0dXJuIGZ1bmN0aW9uIChjYiwgY3R4KSB7XG4gICAgdmFyIGZ1bmMgPSBjdHggPyBmdW5jdGlvbiAoKSB7XG4gICAgICBjYi5jYWxsKGN0eCk7XG4gICAgfSA6IGNiO1xuICAgIGNhbGxiYWNrcy5wdXNoKGZ1bmMpO1xuICAgIGlmIChwZW5kaW5nKSByZXR1cm47XG4gICAgcGVuZGluZyA9IHRydWU7XG4gICAgdGltZXJGdW5jKG5leHRUaWNrSGFuZGxlciwgMCk7XG4gIH07XG59KSgpO1xuXG52YXIgX1NldCA9IHVuZGVmaW5lZDtcbi8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuaWYgKHR5cGVvZiBTZXQgIT09ICd1bmRlZmluZWQnICYmIFNldC50b1N0cmluZygpLm1hdGNoKC9uYXRpdmUgY29kZS8pKSB7XG4gIC8vIHVzZSBuYXRpdmUgU2V0IHdoZW4gYXZhaWxhYmxlLlxuICBfU2V0ID0gU2V0O1xufSBlbHNlIHtcbiAgLy8gYSBub24tc3RhbmRhcmQgU2V0IHBvbHlmaWxsIHRoYXQgb25seSB3b3JrcyB3aXRoIHByaW1pdGl2ZSBrZXlzLlxuICBfU2V0ID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuc2V0ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbiAgfTtcbiAgX1NldC5wcm90b3R5cGUuaGFzID0gZnVuY3Rpb24gKGtleSkge1xuICAgIHJldHVybiB0aGlzLnNldFtrZXldICE9PSB1bmRlZmluZWQ7XG4gIH07XG4gIF9TZXQucHJvdG90eXBlLmFkZCA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICB0aGlzLnNldFtrZXldID0gMTtcbiAgfTtcbiAgX1NldC5wcm90b3R5cGUuY2xlYXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5zZXQgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBDYWNoZShsaW1pdCkge1xuICB0aGlzLnNpemUgPSAwO1xuICB0aGlzLmxpbWl0ID0gbGltaXQ7XG4gIHRoaXMuaGVhZCA9IHRoaXMudGFpbCA9IHVuZGVmaW5lZDtcbiAgdGhpcy5fa2V5bWFwID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcbn1cblxudmFyIHAgPSBDYWNoZS5wcm90b3R5cGU7XG5cbi8qKlxuICogUHV0IDx2YWx1ZT4gaW50byB0aGUgY2FjaGUgYXNzb2NpYXRlZCB3aXRoIDxrZXk+LlxuICogUmV0dXJucyB0aGUgZW50cnkgd2hpY2ggd2FzIHJlbW92ZWQgdG8gbWFrZSByb29tIGZvclxuICogdGhlIG5ldyBlbnRyeS4gT3RoZXJ3aXNlIHVuZGVmaW5lZCBpcyByZXR1cm5lZC5cbiAqIChpLmUuIGlmIHRoZXJlIHdhcyBlbm91Z2ggcm9vbSBhbHJlYWR5KS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKiBAcmV0dXJuIHtFbnRyeXx1bmRlZmluZWR9XG4gKi9cblxucC5wdXQgPSBmdW5jdGlvbiAoa2V5LCB2YWx1ZSkge1xuICB2YXIgcmVtb3ZlZDtcbiAgaWYgKHRoaXMuc2l6ZSA9PT0gdGhpcy5saW1pdCkge1xuICAgIHJlbW92ZWQgPSB0aGlzLnNoaWZ0KCk7XG4gIH1cblxuICB2YXIgZW50cnkgPSB0aGlzLmdldChrZXksIHRydWUpO1xuICBpZiAoIWVudHJ5KSB7XG4gICAgZW50cnkgPSB7XG4gICAgICBrZXk6IGtleVxuICAgIH07XG4gICAgdGhpcy5fa2V5bWFwW2tleV0gPSBlbnRyeTtcbiAgICBpZiAodGhpcy50YWlsKSB7XG4gICAgICB0aGlzLnRhaWwubmV3ZXIgPSBlbnRyeTtcbiAgICAgIGVudHJ5Lm9sZGVyID0gdGhpcy50YWlsO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmhlYWQgPSBlbnRyeTtcbiAgICB9XG4gICAgdGhpcy50YWlsID0gZW50cnk7XG4gICAgdGhpcy5zaXplKys7XG4gIH1cbiAgZW50cnkudmFsdWUgPSB2YWx1ZTtcblxuICByZXR1cm4gcmVtb3ZlZDtcbn07XG5cbi8qKlxuICogUHVyZ2UgdGhlIGxlYXN0IHJlY2VudGx5IHVzZWQgKG9sZGVzdCkgZW50cnkgZnJvbSB0aGVcbiAqIGNhY2hlLiBSZXR1cm5zIHRoZSByZW1vdmVkIGVudHJ5IG9yIHVuZGVmaW5lZCBpZiB0aGVcbiAqIGNhY2hlIHdhcyBlbXB0eS5cbiAqL1xuXG5wLnNoaWZ0ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgZW50cnkgPSB0aGlzLmhlYWQ7XG4gIGlmIChlbnRyeSkge1xuICAgIHRoaXMuaGVhZCA9IHRoaXMuaGVhZC5uZXdlcjtcbiAgICB0aGlzLmhlYWQub2xkZXIgPSB1bmRlZmluZWQ7XG4gICAgZW50cnkubmV3ZXIgPSBlbnRyeS5vbGRlciA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLl9rZXltYXBbZW50cnkua2V5XSA9IHVuZGVmaW5lZDtcbiAgICB0aGlzLnNpemUtLTtcbiAgfVxuICByZXR1cm4gZW50cnk7XG59O1xuXG4vKipcbiAqIEdldCBhbmQgcmVnaXN0ZXIgcmVjZW50IHVzZSBvZiA8a2V5Pi4gUmV0dXJucyB0aGUgdmFsdWVcbiAqIGFzc29jaWF0ZWQgd2l0aCA8a2V5PiBvciB1bmRlZmluZWQgaWYgbm90IGluIGNhY2hlLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gcmV0dXJuRW50cnlcbiAqIEByZXR1cm4ge0VudHJ5fCp9XG4gKi9cblxucC5nZXQgPSBmdW5jdGlvbiAoa2V5LCByZXR1cm5FbnRyeSkge1xuICB2YXIgZW50cnkgPSB0aGlzLl9rZXltYXBba2V5XTtcbiAgaWYgKGVudHJ5ID09PSB1bmRlZmluZWQpIHJldHVybjtcbiAgaWYgKGVudHJ5ID09PSB0aGlzLnRhaWwpIHtcbiAgICByZXR1cm4gcmV0dXJuRW50cnkgPyBlbnRyeSA6IGVudHJ5LnZhbHVlO1xuICB9XG4gIC8vIEhFQUQtLS0tLS0tLS0tLS0tLVRBSUxcbiAgLy8gICA8Lm9sZGVyICAgLm5ld2VyPlxuICAvLyAgPC0tLSBhZGQgZGlyZWN0aW9uIC0tXG4gIC8vICAgQSAgQiAgQyAgPEQ+ICBFXG4gIGlmIChlbnRyeS5uZXdlcikge1xuICAgIGlmIChlbnRyeSA9PT0gdGhpcy5oZWFkKSB7XG4gICAgICB0aGlzLmhlYWQgPSBlbnRyeS5uZXdlcjtcbiAgICB9XG4gICAgZW50cnkubmV3ZXIub2xkZXIgPSBlbnRyeS5vbGRlcjsgLy8gQyA8LS0gRS5cbiAgfVxuICBpZiAoZW50cnkub2xkZXIpIHtcbiAgICBlbnRyeS5vbGRlci5uZXdlciA9IGVudHJ5Lm5ld2VyOyAvLyBDLiAtLT4gRVxuICB9XG4gIGVudHJ5Lm5ld2VyID0gdW5kZWZpbmVkOyAvLyBEIC0teFxuICBlbnRyeS5vbGRlciA9IHRoaXMudGFpbDsgLy8gRC4gLS0+IEVcbiAgaWYgKHRoaXMudGFpbCkge1xuICAgIHRoaXMudGFpbC5uZXdlciA9IGVudHJ5OyAvLyBFLiA8LS0gRFxuICB9XG4gIHRoaXMudGFpbCA9IGVudHJ5O1xuICByZXR1cm4gcmV0dXJuRW50cnkgPyBlbnRyeSA6IGVudHJ5LnZhbHVlO1xufTtcblxudmFyIGNhY2hlJDEgPSBuZXcgQ2FjaGUoMTAwMCk7XG52YXIgZmlsdGVyVG9rZW5SRSA9IC9bXlxccydcIl0rfCdbXiddKid8XCJbXlwiXSpcIi9nO1xudmFyIHJlc2VydmVkQXJnUkUgPSAvXmluJHxeLT9cXGQrLztcblxuLyoqXG4gKiBQYXJzZXIgc3RhdGVcbiAqL1xuXG52YXIgc3RyO1xudmFyIGRpcjtcbnZhciBjO1xudmFyIHByZXY7XG52YXIgaTtcbnZhciBsO1xudmFyIGxhc3RGaWx0ZXJJbmRleDtcbnZhciBpblNpbmdsZTtcbnZhciBpbkRvdWJsZTtcbnZhciBjdXJseTtcbnZhciBzcXVhcmU7XG52YXIgcGFyZW47XG4vKipcbiAqIFB1c2ggYSBmaWx0ZXIgdG8gdGhlIGN1cnJlbnQgZGlyZWN0aXZlIG9iamVjdFxuICovXG5cbmZ1bmN0aW9uIHB1c2hGaWx0ZXIoKSB7XG4gIHZhciBleHAgPSBzdHIuc2xpY2UobGFzdEZpbHRlckluZGV4LCBpKS50cmltKCk7XG4gIHZhciBmaWx0ZXI7XG4gIGlmIChleHApIHtcbiAgICBmaWx0ZXIgPSB7fTtcbiAgICB2YXIgdG9rZW5zID0gZXhwLm1hdGNoKGZpbHRlclRva2VuUkUpO1xuICAgIGZpbHRlci5uYW1lID0gdG9rZW5zWzBdO1xuICAgIGlmICh0b2tlbnMubGVuZ3RoID4gMSkge1xuICAgICAgZmlsdGVyLmFyZ3MgPSB0b2tlbnMuc2xpY2UoMSkubWFwKHByb2Nlc3NGaWx0ZXJBcmcpO1xuICAgIH1cbiAgfVxuICBpZiAoZmlsdGVyKSB7XG4gICAgKGRpci5maWx0ZXJzID0gZGlyLmZpbHRlcnMgfHwgW10pLnB1c2goZmlsdGVyKTtcbiAgfVxuICBsYXN0RmlsdGVySW5kZXggPSBpICsgMTtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhbiBhcmd1bWVudCBpcyBkeW5hbWljIGFuZCBzdHJpcCBxdW90ZXMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGFyZ1xuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5cbmZ1bmN0aW9uIHByb2Nlc3NGaWx0ZXJBcmcoYXJnKSB7XG4gIGlmIChyZXNlcnZlZEFyZ1JFLnRlc3QoYXJnKSkge1xuICAgIHJldHVybiB7XG4gICAgICB2YWx1ZTogdG9OdW1iZXIoYXJnKSxcbiAgICAgIGR5bmFtaWM6IGZhbHNlXG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgc3RyaXBwZWQgPSBzdHJpcFF1b3RlcyhhcmcpO1xuICAgIHZhciBkeW5hbWljID0gc3RyaXBwZWQgPT09IGFyZztcbiAgICByZXR1cm4ge1xuICAgICAgdmFsdWU6IGR5bmFtaWMgPyBhcmcgOiBzdHJpcHBlZCxcbiAgICAgIGR5bmFtaWM6IGR5bmFtaWNcbiAgICB9O1xuICB9XG59XG5cbi8qKlxuICogUGFyc2UgYSBkaXJlY3RpdmUgdmFsdWUgYW5kIGV4dHJhY3QgdGhlIGV4cHJlc3Npb25cbiAqIGFuZCBpdHMgZmlsdGVycyBpbnRvIGEgZGVzY3JpcHRvci5cbiAqXG4gKiBFeGFtcGxlOlxuICpcbiAqIFwiYSArIDEgfCB1cHBlcmNhc2VcIiB3aWxsIHlpZWxkOlxuICoge1xuICogICBleHByZXNzaW9uOiAnYSArIDEnLFxuICogICBmaWx0ZXJzOiBbXG4gKiAgICAgeyBuYW1lOiAndXBwZXJjYXNlJywgYXJnczogbnVsbCB9XG4gKiAgIF1cbiAqIH1cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc1xuICogQHJldHVybiB7T2JqZWN0fVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlRGlyZWN0aXZlKHMpIHtcbiAgdmFyIGhpdCA9IGNhY2hlJDEuZ2V0KHMpO1xuICBpZiAoaGl0KSB7XG4gICAgcmV0dXJuIGhpdDtcbiAgfVxuXG4gIC8vIHJlc2V0IHBhcnNlciBzdGF0ZVxuICBzdHIgPSBzO1xuICBpblNpbmdsZSA9IGluRG91YmxlID0gZmFsc2U7XG4gIGN1cmx5ID0gc3F1YXJlID0gcGFyZW4gPSAwO1xuICBsYXN0RmlsdGVySW5kZXggPSAwO1xuICBkaXIgPSB7fTtcblxuICBmb3IgKGkgPSAwLCBsID0gc3RyLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHByZXYgPSBjO1xuICAgIGMgPSBzdHIuY2hhckNvZGVBdChpKTtcbiAgICBpZiAoaW5TaW5nbGUpIHtcbiAgICAgIC8vIGNoZWNrIHNpbmdsZSBxdW90ZVxuICAgICAgaWYgKGMgPT09IDB4MjcgJiYgcHJldiAhPT0gMHg1QykgaW5TaW5nbGUgPSAhaW5TaW5nbGU7XG4gICAgfSBlbHNlIGlmIChpbkRvdWJsZSkge1xuICAgICAgLy8gY2hlY2sgZG91YmxlIHF1b3RlXG4gICAgICBpZiAoYyA9PT0gMHgyMiAmJiBwcmV2ICE9PSAweDVDKSBpbkRvdWJsZSA9ICFpbkRvdWJsZTtcbiAgICB9IGVsc2UgaWYgKGMgPT09IDB4N0MgJiYgLy8gcGlwZVxuICAgIHN0ci5jaGFyQ29kZUF0KGkgKyAxKSAhPT0gMHg3QyAmJiBzdHIuY2hhckNvZGVBdChpIC0gMSkgIT09IDB4N0MpIHtcbiAgICAgIGlmIChkaXIuZXhwcmVzc2lvbiA9PSBudWxsKSB7XG4gICAgICAgIC8vIGZpcnN0IGZpbHRlciwgZW5kIG9mIGV4cHJlc3Npb25cbiAgICAgICAgbGFzdEZpbHRlckluZGV4ID0gaSArIDE7XG4gICAgICAgIGRpci5leHByZXNzaW9uID0gc3RyLnNsaWNlKDAsIGkpLnRyaW0oKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIGFscmVhZHkgaGFzIGZpbHRlclxuICAgICAgICBwdXNoRmlsdGVyKCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHN3aXRjaCAoYykge1xuICAgICAgICBjYXNlIDB4MjI6XG4gICAgICAgICAgaW5Eb3VibGUgPSB0cnVlO2JyZWFrOyAvLyBcIlxuICAgICAgICBjYXNlIDB4Mjc6XG4gICAgICAgICAgaW5TaW5nbGUgPSB0cnVlO2JyZWFrOyAvLyAnXG4gICAgICAgIGNhc2UgMHgyODpcbiAgICAgICAgICBwYXJlbisrO2JyZWFrOyAvLyAoXG4gICAgICAgIGNhc2UgMHgyOTpcbiAgICAgICAgICBwYXJlbi0tO2JyZWFrOyAvLyApXG4gICAgICAgIGNhc2UgMHg1QjpcbiAgICAgICAgICBzcXVhcmUrKzticmVhazsgLy8gW1xuICAgICAgICBjYXNlIDB4NUQ6XG4gICAgICAgICAgc3F1YXJlLS07YnJlYWs7IC8vIF1cbiAgICAgICAgY2FzZSAweDdCOlxuICAgICAgICAgIGN1cmx5Kys7YnJlYWs7IC8vIHtcbiAgICAgICAgY2FzZSAweDdEOlxuICAgICAgICAgIGN1cmx5LS07YnJlYWs7IC8vIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAoZGlyLmV4cHJlc3Npb24gPT0gbnVsbCkge1xuICAgIGRpci5leHByZXNzaW9uID0gc3RyLnNsaWNlKDAsIGkpLnRyaW0oKTtcbiAgfSBlbHNlIGlmIChsYXN0RmlsdGVySW5kZXggIT09IDApIHtcbiAgICBwdXNoRmlsdGVyKCk7XG4gIH1cblxuICBjYWNoZSQxLnB1dChzLCBkaXIpO1xuICByZXR1cm4gZGlyO1xufVxuXG52YXIgZGlyZWN0aXZlID0gT2JqZWN0LmZyZWV6ZSh7XG4gIHBhcnNlRGlyZWN0aXZlOiBwYXJzZURpcmVjdGl2ZVxufSk7XG5cbnZhciByZWdleEVzY2FwZVJFID0gL1stLiorP14ke30oKXxbXFxdXFwvXFxcXF0vZztcbnZhciBjYWNoZSA9IHVuZGVmaW5lZDtcbnZhciB0YWdSRSA9IHVuZGVmaW5lZDtcbnZhciBodG1sUkUgPSB1bmRlZmluZWQ7XG4vKipcbiAqIEVzY2FwZSBhIHN0cmluZyBzbyBpdCBjYW4gYmUgdXNlZCBpbiBhIFJlZ0V4cFxuICogY29uc3RydWN0b3IuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICovXG5cbmZ1bmN0aW9uIGVzY2FwZVJlZ2V4KHN0cikge1xuICByZXR1cm4gc3RyLnJlcGxhY2UocmVnZXhFc2NhcGVSRSwgJ1xcXFwkJicpO1xufVxuXG5mdW5jdGlvbiBjb21waWxlUmVnZXgoKSB7XG4gIHZhciBvcGVuID0gZXNjYXBlUmVnZXgoY29uZmlnLmRlbGltaXRlcnNbMF0pO1xuICB2YXIgY2xvc2UgPSBlc2NhcGVSZWdleChjb25maWcuZGVsaW1pdGVyc1sxXSk7XG4gIHZhciB1bnNhZmVPcGVuID0gZXNjYXBlUmVnZXgoY29uZmlnLnVuc2FmZURlbGltaXRlcnNbMF0pO1xuICB2YXIgdW5zYWZlQ2xvc2UgPSBlc2NhcGVSZWdleChjb25maWcudW5zYWZlRGVsaW1pdGVyc1sxXSk7XG4gIHRhZ1JFID0gbmV3IFJlZ0V4cCh1bnNhZmVPcGVuICsgJygoPzoufFxcXFxuKSs/KScgKyB1bnNhZmVDbG9zZSArICd8JyArIG9wZW4gKyAnKCg/Oi58XFxcXG4pKz8pJyArIGNsb3NlLCAnZycpO1xuICBodG1sUkUgPSBuZXcgUmVnRXhwKCdeJyArIHVuc2FmZU9wZW4gKyAnLionICsgdW5zYWZlQ2xvc2UgKyAnJCcpO1xuICAvLyByZXNldCBjYWNoZVxuICBjYWNoZSA9IG5ldyBDYWNoZSgxMDAwKTtcbn1cblxuLyoqXG4gKiBQYXJzZSBhIHRlbXBsYXRlIHRleHQgc3RyaW5nIGludG8gYW4gYXJyYXkgb2YgdG9rZW5zLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0ZXh0XG4gKiBAcmV0dXJuIHtBcnJheTxPYmplY3Q+IHwgbnVsbH1cbiAqICAgICAgICAgICAgICAgLSB7U3RyaW5nfSB0eXBlXG4gKiAgICAgICAgICAgICAgIC0ge1N0cmluZ30gdmFsdWVcbiAqICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gW2h0bWxdXG4gKiAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IFtvbmVUaW1lXVxuICovXG5cbmZ1bmN0aW9uIHBhcnNlVGV4dCh0ZXh0KSB7XG4gIGlmICghY2FjaGUpIHtcbiAgICBjb21waWxlUmVnZXgoKTtcbiAgfVxuICB2YXIgaGl0ID0gY2FjaGUuZ2V0KHRleHQpO1xuICBpZiAoaGl0KSB7XG4gICAgcmV0dXJuIGhpdDtcbiAgfVxuICBpZiAoIXRhZ1JFLnRlc3QodGV4dCkpIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxuICB2YXIgdG9rZW5zID0gW107XG4gIHZhciBsYXN0SW5kZXggPSB0YWdSRS5sYXN0SW5kZXggPSAwO1xuICB2YXIgbWF0Y2gsIGluZGV4LCBodG1sLCB2YWx1ZSwgZmlyc3QsIG9uZVRpbWU7XG4gIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbmQtYXNzaWduICovXG4gIHdoaWxlIChtYXRjaCA9IHRhZ1JFLmV4ZWModGV4dCkpIHtcbiAgICAvKiBlc2xpbnQtZW5hYmxlIG5vLWNvbmQtYXNzaWduICovXG4gICAgaW5kZXggPSBtYXRjaC5pbmRleDtcbiAgICAvLyBwdXNoIHRleHQgdG9rZW5cbiAgICBpZiAoaW5kZXggPiBsYXN0SW5kZXgpIHtcbiAgICAgIHRva2Vucy5wdXNoKHtcbiAgICAgICAgdmFsdWU6IHRleHQuc2xpY2UobGFzdEluZGV4LCBpbmRleClcbiAgICAgIH0pO1xuICAgIH1cbiAgICAvLyB0YWcgdG9rZW5cbiAgICBodG1sID0gaHRtbFJFLnRlc3QobWF0Y2hbMF0pO1xuICAgIHZhbHVlID0gaHRtbCA/IG1hdGNoWzFdIDogbWF0Y2hbMl07XG4gICAgZmlyc3QgPSB2YWx1ZS5jaGFyQ29kZUF0KDApO1xuICAgIG9uZVRpbWUgPSBmaXJzdCA9PT0gNDI7IC8vICpcbiAgICB2YWx1ZSA9IG9uZVRpbWUgPyB2YWx1ZS5zbGljZSgxKSA6IHZhbHVlO1xuICAgIHRva2Vucy5wdXNoKHtcbiAgICAgIHRhZzogdHJ1ZSxcbiAgICAgIHZhbHVlOiB2YWx1ZS50cmltKCksXG4gICAgICBodG1sOiBodG1sLFxuICAgICAgb25lVGltZTogb25lVGltZVxuICAgIH0pO1xuICAgIGxhc3RJbmRleCA9IGluZGV4ICsgbWF0Y2hbMF0ubGVuZ3RoO1xuICB9XG4gIGlmIChsYXN0SW5kZXggPCB0ZXh0Lmxlbmd0aCkge1xuICAgIHRva2Vucy5wdXNoKHtcbiAgICAgIHZhbHVlOiB0ZXh0LnNsaWNlKGxhc3RJbmRleClcbiAgICB9KTtcbiAgfVxuICBjYWNoZS5wdXQodGV4dCwgdG9rZW5zKTtcbiAgcmV0dXJuIHRva2Vucztcbn1cblxuLyoqXG4gKiBGb3JtYXQgYSBsaXN0IG9mIHRva2VucyBpbnRvIGFuIGV4cHJlc3Npb24uXG4gKiBlLmcuIHRva2VucyBwYXJzZWQgZnJvbSAnYSB7e2J9fSBjJyBjYW4gYmUgc2VyaWFsaXplZFxuICogaW50byBvbmUgc2luZ2xlIGV4cHJlc3Npb24gYXMgJ1wiYSBcIiArIGIgKyBcIiBjXCInLlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IHRva2Vuc1xuICogQHBhcmFtIHtWdWV9IFt2bV1cbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG5mdW5jdGlvbiB0b2tlbnNUb0V4cCh0b2tlbnMsIHZtKSB7XG4gIGlmICh0b2tlbnMubGVuZ3RoID4gMSkge1xuICAgIHJldHVybiB0b2tlbnMubWFwKGZ1bmN0aW9uICh0b2tlbikge1xuICAgICAgcmV0dXJuIGZvcm1hdFRva2VuKHRva2VuLCB2bSk7XG4gICAgfSkuam9pbignKycpO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBmb3JtYXRUb2tlbih0b2tlbnNbMF0sIHZtLCB0cnVlKTtcbiAgfVxufVxuXG4vKipcbiAqIEZvcm1hdCBhIHNpbmdsZSB0b2tlbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdG9rZW5cbiAqIEBwYXJhbSB7VnVlfSBbdm1dXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFtzaW5nbGVdXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0VG9rZW4odG9rZW4sIHZtLCBzaW5nbGUpIHtcbiAgcmV0dXJuIHRva2VuLnRhZyA/IHRva2VuLm9uZVRpbWUgJiYgdm0gPyAnXCInICsgdm0uJGV2YWwodG9rZW4udmFsdWUpICsgJ1wiJyA6IGlubGluZUZpbHRlcnModG9rZW4udmFsdWUsIHNpbmdsZSkgOiAnXCInICsgdG9rZW4udmFsdWUgKyAnXCInO1xufVxuXG4vKipcbiAqIEZvciBhbiBhdHRyaWJ1dGUgd2l0aCBtdWx0aXBsZSBpbnRlcnBvbGF0aW9uIHRhZ3MsXG4gKiBlLmcuIGF0dHI9XCJzb21lLXt7dGhpbmcgfCBmaWx0ZXJ9fVwiLCBpbiBvcmRlciB0byBjb21iaW5lXG4gKiB0aGUgd2hvbGUgdGhpbmcgaW50byBhIHNpbmdsZSB3YXRjaGFibGUgZXhwcmVzc2lvbiwgd2VcbiAqIGhhdmUgdG8gaW5saW5lIHRob3NlIGZpbHRlcnMuIFRoaXMgZnVuY3Rpb24gZG9lcyBleGFjdGx5XG4gKiB0aGF0LiBUaGlzIGlzIGEgYml0IGhhY2t5IGJ1dCBpdCBhdm9pZHMgaGVhdnkgY2hhbmdlc1xuICogdG8gZGlyZWN0aXZlIHBhcnNlciBhbmQgd2F0Y2hlciBtZWNoYW5pc20uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV4cFxuICogQHBhcmFtIHtCb29sZWFufSBzaW5nbGVcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG52YXIgZmlsdGVyUkUgPSAvW158XVxcfFtefF0vO1xuZnVuY3Rpb24gaW5saW5lRmlsdGVycyhleHAsIHNpbmdsZSkge1xuICBpZiAoIWZpbHRlclJFLnRlc3QoZXhwKSkge1xuICAgIHJldHVybiBzaW5nbGUgPyBleHAgOiAnKCcgKyBleHAgKyAnKSc7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGRpciA9IHBhcnNlRGlyZWN0aXZlKGV4cCk7XG4gICAgaWYgKCFkaXIuZmlsdGVycykge1xuICAgICAgcmV0dXJuICcoJyArIGV4cCArICcpJztcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICd0aGlzLl9hcHBseUZpbHRlcnMoJyArIGRpci5leHByZXNzaW9uICsgLy8gdmFsdWVcbiAgICAgICcsbnVsbCwnICsgLy8gb2xkVmFsdWUgKG51bGwgZm9yIHJlYWQpXG4gICAgICBKU09OLnN0cmluZ2lmeShkaXIuZmlsdGVycykgKyAvLyBmaWx0ZXIgZGVzY3JpcHRvcnNcbiAgICAgICcsZmFsc2UpJzsgLy8gd3JpdGU/XG4gICAgfVxuICB9XG59XG5cbnZhciB0ZXh0ID0gT2JqZWN0LmZyZWV6ZSh7XG4gIGNvbXBpbGVSZWdleDogY29tcGlsZVJlZ2V4LFxuICBwYXJzZVRleHQ6IHBhcnNlVGV4dCxcbiAgdG9rZW5zVG9FeHA6IHRva2Vuc1RvRXhwXG59KTtcblxudmFyIGRlbGltaXRlcnMgPSBbJ3t7JywgJ319J107XG52YXIgdW5zYWZlRGVsaW1pdGVycyA9IFsne3t7JywgJ319fSddO1xuXG52YXIgY29uZmlnID0gT2JqZWN0LmRlZmluZVByb3BlcnRpZXMoe1xuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHByaW50IGRlYnVnIG1lc3NhZ2VzLlxuICAgKiBBbHNvIGVuYWJsZXMgc3RhY2sgdHJhY2UgZm9yIHdhcm5pbmdzLlxuICAgKlxuICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICovXG5cbiAgZGVidWc6IGZhbHNlLFxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIHN1cHByZXNzIHdhcm5pbmdzLlxuICAgKlxuICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICovXG5cbiAgc2lsZW50OiBmYWxzZSxcblxuICAvKipcbiAgICogV2hldGhlciB0byB1c2UgYXN5bmMgcmVuZGVyaW5nLlxuICAgKi9cblxuICBhc3luYzogdHJ1ZSxcblxuICAvKipcbiAgICogV2hldGhlciB0byB3YXJuIGFnYWluc3QgZXJyb3JzIGNhdWdodCB3aGVuIGV2YWx1YXRpbmdcbiAgICogZXhwcmVzc2lvbnMuXG4gICAqL1xuXG4gIHdhcm5FeHByZXNzaW9uRXJyb3JzOiB0cnVlLFxuXG4gIC8qKlxuICAgKiBXaGV0aGVyIHRvIGFsbG93IGRldnRvb2xzIGluc3BlY3Rpb24uXG4gICAqIERpc2FibGVkIGJ5IGRlZmF1bHQgaW4gcHJvZHVjdGlvbiBidWlsZHMuXG4gICAqL1xuXG4gIGRldnRvb2xzOiBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nLFxuXG4gIC8qKlxuICAgKiBJbnRlcm5hbCBmbGFnIHRvIGluZGljYXRlIHRoZSBkZWxpbWl0ZXJzIGhhdmUgYmVlblxuICAgKiBjaGFuZ2VkLlxuICAgKlxuICAgKiBAdHlwZSB7Qm9vbGVhbn1cbiAgICovXG5cbiAgX2RlbGltaXRlcnNDaGFuZ2VkOiB0cnVlLFxuXG4gIC8qKlxuICAgKiBMaXN0IG9mIGFzc2V0IHR5cGVzIHRoYXQgYSBjb21wb25lbnQgY2FuIG93bi5cbiAgICpcbiAgICogQHR5cGUge0FycmF5fVxuICAgKi9cblxuICBfYXNzZXRUeXBlczogWydjb21wb25lbnQnLCAnZGlyZWN0aXZlJywgJ2VsZW1lbnREaXJlY3RpdmUnLCAnZmlsdGVyJywgJ3RyYW5zaXRpb24nLCAncGFydGlhbCddLFxuXG4gIC8qKlxuICAgKiBwcm9wIGJpbmRpbmcgbW9kZXNcbiAgICovXG5cbiAgX3Byb3BCaW5kaW5nTW9kZXM6IHtcbiAgICBPTkVfV0FZOiAwLFxuICAgIFRXT19XQVk6IDEsXG4gICAgT05FX1RJTUU6IDJcbiAgfSxcblxuICAvKipcbiAgICogTWF4IGNpcmN1bGFyIHVwZGF0ZXMgYWxsb3dlZCBpbiBhIGJhdGNoZXIgZmx1c2ggY3ljbGUuXG4gICAqL1xuXG4gIF9tYXhVcGRhdGVDb3VudDogMTAwXG5cbn0sIHtcbiAgZGVsaW1pdGVyczogeyAvKipcbiAgICAgICAgICAgICAgICAgKiBJbnRlcnBvbGF0aW9uIGRlbGltaXRlcnMuIENoYW5naW5nIHRoZXNlIHdvdWxkIHRyaWdnZXJcbiAgICAgICAgICAgICAgICAgKiB0aGUgdGV4dCBwYXJzZXIgdG8gcmUtY29tcGlsZSB0aGUgcmVndWxhciBleHByZXNzaW9ucy5cbiAgICAgICAgICAgICAgICAgKlxuICAgICAgICAgICAgICAgICAqIEB0eXBlIHtBcnJheTxTdHJpbmc+fVxuICAgICAgICAgICAgICAgICAqL1xuXG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gZGVsaW1pdGVycztcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KHZhbCkge1xuICAgICAgZGVsaW1pdGVycyA9IHZhbDtcbiAgICAgIGNvbXBpbGVSZWdleCgpO1xuICAgIH0sXG4gICAgY29uZmlndXJhYmxlOiB0cnVlLFxuICAgIGVudW1lcmFibGU6IHRydWVcbiAgfSxcbiAgdW5zYWZlRGVsaW1pdGVyczoge1xuICAgIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgICAgcmV0dXJuIHVuc2FmZURlbGltaXRlcnM7XG4gICAgfSxcbiAgICBzZXQ6IGZ1bmN0aW9uIHNldCh2YWwpIHtcbiAgICAgIHVuc2FmZURlbGltaXRlcnMgPSB2YWw7XG4gICAgICBjb21waWxlUmVnZXgoKTtcbiAgICB9LFxuICAgIGNvbmZpZ3VyYWJsZTogdHJ1ZSxcbiAgICBlbnVtZXJhYmxlOiB0cnVlXG4gIH1cbn0pO1xuXG52YXIgd2FybiA9IHVuZGVmaW5lZDtcbnZhciBmb3JtYXRDb21wb25lbnROYW1lID0gdW5kZWZpbmVkO1xuXG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAoZnVuY3Rpb24gKCkge1xuICAgIHZhciBoYXNDb25zb2xlID0gdHlwZW9mIGNvbnNvbGUgIT09ICd1bmRlZmluZWQnO1xuXG4gICAgd2FybiA9IGZ1bmN0aW9uIChtc2csIHZtKSB7XG4gICAgICBpZiAoaGFzQ29uc29sZSAmJiAhY29uZmlnLnNpbGVudCkge1xuICAgICAgICBjb25zb2xlLmVycm9yKCdbVnVlIHdhcm5dOiAnICsgbXNnICsgKHZtID8gZm9ybWF0Q29tcG9uZW50TmFtZSh2bSkgOiAnJykpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICBmb3JtYXRDb21wb25lbnROYW1lID0gZnVuY3Rpb24gKHZtKSB7XG4gICAgICB2YXIgbmFtZSA9IHZtLl9pc1Z1ZSA/IHZtLiRvcHRpb25zLm5hbWUgOiB2bS5uYW1lO1xuICAgICAgcmV0dXJuIG5hbWUgPyAnIChmb3VuZCBpbiBjb21wb25lbnQ6IDwnICsgaHlwaGVuYXRlKG5hbWUpICsgJz4pJyA6ICcnO1xuICAgIH07XG4gIH0pKCk7XG59XG5cbi8qKlxuICogQXBwZW5kIHdpdGggdHJhbnNpdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKi9cblxuZnVuY3Rpb24gYXBwZW5kV2l0aFRyYW5zaXRpb24oZWwsIHRhcmdldCwgdm0sIGNiKSB7XG4gIGFwcGx5VHJhbnNpdGlvbihlbCwgMSwgZnVuY3Rpb24gKCkge1xuICAgIHRhcmdldC5hcHBlbmRDaGlsZChlbCk7XG4gIH0sIHZtLCBjYik7XG59XG5cbi8qKlxuICogSW5zZXJ0QmVmb3JlIHdpdGggdHJhbnNpdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKi9cblxuZnVuY3Rpb24gYmVmb3JlV2l0aFRyYW5zaXRpb24oZWwsIHRhcmdldCwgdm0sIGNiKSB7XG4gIGFwcGx5VHJhbnNpdGlvbihlbCwgMSwgZnVuY3Rpb24gKCkge1xuICAgIGJlZm9yZShlbCwgdGFyZ2V0KTtcbiAgfSwgdm0sIGNiKTtcbn1cblxuLyoqXG4gKiBSZW1vdmUgd2l0aCB0cmFuc2l0aW9uLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICovXG5cbmZ1bmN0aW9uIHJlbW92ZVdpdGhUcmFuc2l0aW9uKGVsLCB2bSwgY2IpIHtcbiAgYXBwbHlUcmFuc2l0aW9uKGVsLCAtMSwgZnVuY3Rpb24gKCkge1xuICAgIHJlbW92ZShlbCk7XG4gIH0sIHZtLCBjYik7XG59XG5cbi8qKlxuICogQXBwbHkgdHJhbnNpdGlvbnMgd2l0aCBhbiBvcGVyYXRpb24gY2FsbGJhY2suXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtOdW1iZXJ9IGRpcmVjdGlvblxuICogICAgICAgICAgICAgICAgICAxOiBlbnRlclxuICogICAgICAgICAgICAgICAgIC0xOiBsZWF2ZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3AgLSB0aGUgYWN0dWFsIERPTSBvcGVyYXRpb25cbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICovXG5cbmZ1bmN0aW9uIGFwcGx5VHJhbnNpdGlvbihlbCwgZGlyZWN0aW9uLCBvcCwgdm0sIGNiKSB7XG4gIHZhciB0cmFuc2l0aW9uID0gZWwuX192X3RyYW5zO1xuICBpZiAoIXRyYW5zaXRpb24gfHxcbiAgLy8gc2tpcCBpZiB0aGVyZSBhcmUgbm8ganMgaG9va3MgYW5kIENTUyB0cmFuc2l0aW9uIGlzXG4gIC8vIG5vdCBzdXBwb3J0ZWRcbiAgIXRyYW5zaXRpb24uaG9va3MgJiYgIXRyYW5zaXRpb25FbmRFdmVudCB8fFxuICAvLyBza2lwIHRyYW5zaXRpb25zIGZvciBpbml0aWFsIGNvbXBpbGVcbiAgIXZtLl9pc0NvbXBpbGVkIHx8XG4gIC8vIGlmIHRoZSB2bSBpcyBiZWluZyBtYW5pcHVsYXRlZCBieSBhIHBhcmVudCBkaXJlY3RpdmVcbiAgLy8gZHVyaW5nIHRoZSBwYXJlbnQncyBjb21waWxhdGlvbiBwaGFzZSwgc2tpcCB0aGVcbiAgLy8gYW5pbWF0aW9uLlxuICB2bS4kcGFyZW50ICYmICF2bS4kcGFyZW50Ll9pc0NvbXBpbGVkKSB7XG4gICAgb3AoKTtcbiAgICBpZiAoY2IpIGNiKCk7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBhY3Rpb24gPSBkaXJlY3Rpb24gPiAwID8gJ2VudGVyJyA6ICdsZWF2ZSc7XG4gIHRyYW5zaXRpb25bYWN0aW9uXShvcCwgY2IpO1xufVxuXG52YXIgdHJhbnNpdGlvbiA9IE9iamVjdC5mcmVlemUoe1xuICBhcHBlbmRXaXRoVHJhbnNpdGlvbjogYXBwZW5kV2l0aFRyYW5zaXRpb24sXG4gIGJlZm9yZVdpdGhUcmFuc2l0aW9uOiBiZWZvcmVXaXRoVHJhbnNpdGlvbixcbiAgcmVtb3ZlV2l0aFRyYW5zaXRpb246IHJlbW92ZVdpdGhUcmFuc2l0aW9uLFxuICBhcHBseVRyYW5zaXRpb246IGFwcGx5VHJhbnNpdGlvblxufSk7XG5cbi8qKlxuICogUXVlcnkgYW4gZWxlbWVudCBzZWxlY3RvciBpZiBpdCdzIG5vdCBhbiBlbGVtZW50IGFscmVhZHkuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8RWxlbWVudH0gZWxcbiAqIEByZXR1cm4ge0VsZW1lbnR9XG4gKi9cblxuZnVuY3Rpb24gcXVlcnkoZWwpIHtcbiAgaWYgKHR5cGVvZiBlbCA9PT0gJ3N0cmluZycpIHtcbiAgICB2YXIgc2VsZWN0b3IgPSBlbDtcbiAgICBlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoZWwpO1xuICAgIGlmICghZWwpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignQ2Fubm90IGZpbmQgZWxlbWVudDogJyArIHNlbGVjdG9yKTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGVsO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGEgbm9kZSBpcyBpbiB0aGUgZG9jdW1lbnQuXG4gKiBOb3RlOiBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY29udGFpbnMgc2hvdWxkIHdvcmsgaGVyZVxuICogYnV0IGFsd2F5cyByZXR1cm5zIGZhbHNlIGZvciBjb21tZW50IG5vZGVzIGluIHBoYW50b21qcyxcbiAqIG1ha2luZyB1bml0IHRlc3RzIGRpZmZpY3VsdC4gVGhpcyBpcyBmaXhlZCBieSBkb2luZyB0aGVcbiAqIGNvbnRhaW5zKCkgY2hlY2sgb24gdGhlIG5vZGUncyBwYXJlbnROb2RlIGluc3RlYWQgb2ZcbiAqIHRoZSBub2RlIGl0c2VsZi5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaW5Eb2Mobm9kZSkge1xuICBpZiAoIW5vZGUpIHJldHVybiBmYWxzZTtcbiAgdmFyIGRvYyA9IG5vZGUub3duZXJEb2N1bWVudC5kb2N1bWVudEVsZW1lbnQ7XG4gIHZhciBwYXJlbnQgPSBub2RlLnBhcmVudE5vZGU7XG4gIHJldHVybiBkb2MgPT09IG5vZGUgfHwgZG9jID09PSBwYXJlbnQgfHwgISEocGFyZW50ICYmIHBhcmVudC5ub2RlVHlwZSA9PT0gMSAmJiBkb2MuY29udGFpbnMocGFyZW50KSk7XG59XG5cbi8qKlxuICogR2V0IGFuZCByZW1vdmUgYW4gYXR0cmlidXRlIGZyb20gYSBub2RlLlxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gbm9kZVxuICogQHBhcmFtIHtTdHJpbmd9IF9hdHRyXG4gKi9cblxuZnVuY3Rpb24gZ2V0QXR0cihub2RlLCBfYXR0cikge1xuICB2YXIgdmFsID0gbm9kZS5nZXRBdHRyaWJ1dGUoX2F0dHIpO1xuICBpZiAodmFsICE9PSBudWxsKSB7XG4gICAgbm9kZS5yZW1vdmVBdHRyaWJ1dGUoX2F0dHIpO1xuICB9XG4gIHJldHVybiB2YWw7XG59XG5cbi8qKlxuICogR2V0IGFuIGF0dHJpYnV0ZSB3aXRoIGNvbG9uIG9yIHYtYmluZDogcHJlZml4LlxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gbm9kZVxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge1N0cmluZ3xudWxsfVxuICovXG5cbmZ1bmN0aW9uIGdldEJpbmRBdHRyKG5vZGUsIG5hbWUpIHtcbiAgdmFyIHZhbCA9IGdldEF0dHIobm9kZSwgJzonICsgbmFtZSk7XG4gIGlmICh2YWwgPT09IG51bGwpIHtcbiAgICB2YWwgPSBnZXRBdHRyKG5vZGUsICd2LWJpbmQ6JyArIG5hbWUpO1xuICB9XG4gIHJldHVybiB2YWw7XG59XG5cbi8qKlxuICogQ2hlY2sgdGhlIHByZXNlbmNlIG9mIGEgYmluZCBhdHRyaWJ1dGUuXG4gKlxuICogQHBhcmFtIHtOb2RlfSBub2RlXG4gKiBAcGFyYW0ge1N0cmluZ30gbmFtZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5mdW5jdGlvbiBoYXNCaW5kQXR0cihub2RlLCBuYW1lKSB7XG4gIHJldHVybiBub2RlLmhhc0F0dHJpYnV0ZShuYW1lKSB8fCBub2RlLmhhc0F0dHJpYnV0ZSgnOicgKyBuYW1lKSB8fCBub2RlLmhhc0F0dHJpYnV0ZSgndi1iaW5kOicgKyBuYW1lKTtcbn1cblxuLyoqXG4gKiBJbnNlcnQgZWwgYmVmb3JlIHRhcmdldFxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gKi9cblxuZnVuY3Rpb24gYmVmb3JlKGVsLCB0YXJnZXQpIHtcbiAgdGFyZ2V0LnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKGVsLCB0YXJnZXQpO1xufVxuXG4vKipcbiAqIEluc2VydCBlbCBhZnRlciB0YXJnZXRcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICovXG5cbmZ1bmN0aW9uIGFmdGVyKGVsLCB0YXJnZXQpIHtcbiAgaWYgKHRhcmdldC5uZXh0U2libGluZykge1xuICAgIGJlZm9yZShlbCwgdGFyZ2V0Lm5leHRTaWJsaW5nKTtcbiAgfSBlbHNlIHtcbiAgICB0YXJnZXQucGFyZW50Tm9kZS5hcHBlbmRDaGlsZChlbCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZW1vdmUgZWwgZnJvbSBET01cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKi9cblxuZnVuY3Rpb24gcmVtb3ZlKGVsKSB7XG4gIGVsLnBhcmVudE5vZGUucmVtb3ZlQ2hpbGQoZWwpO1xufVxuXG4vKipcbiAqIFByZXBlbmQgZWwgdG8gdGFyZ2V0XG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtFbGVtZW50fSB0YXJnZXRcbiAqL1xuXG5mdW5jdGlvbiBwcmVwZW5kKGVsLCB0YXJnZXQpIHtcbiAgaWYgKHRhcmdldC5maXJzdENoaWxkKSB7XG4gICAgYmVmb3JlKGVsLCB0YXJnZXQuZmlyc3RDaGlsZCk7XG4gIH0gZWxzZSB7XG4gICAgdGFyZ2V0LmFwcGVuZENoaWxkKGVsKTtcbiAgfVxufVxuXG4vKipcbiAqIFJlcGxhY2UgdGFyZ2V0IHdpdGggZWxcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IHRhcmdldFxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICovXG5cbmZ1bmN0aW9uIHJlcGxhY2UodGFyZ2V0LCBlbCkge1xuICB2YXIgcGFyZW50ID0gdGFyZ2V0LnBhcmVudE5vZGU7XG4gIGlmIChwYXJlbnQpIHtcbiAgICBwYXJlbnQucmVwbGFjZUNoaWxkKGVsLCB0YXJnZXQpO1xuICB9XG59XG5cbi8qKlxuICogQWRkIGV2ZW50IGxpc3RlbmVyIHNob3J0aGFuZC5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNiXG4gKiBAcGFyYW0ge0Jvb2xlYW59IFt1c2VDYXB0dXJlXVxuICovXG5cbmZ1bmN0aW9uIG9uKGVsLCBldmVudCwgY2IsIHVzZUNhcHR1cmUpIHtcbiAgZWwuYWRkRXZlbnRMaXN0ZW5lcihldmVudCwgY2IsIHVzZUNhcHR1cmUpO1xufVxuXG4vKipcbiAqIFJlbW92ZSBldmVudCBsaXN0ZW5lciBzaG9ydGhhbmQuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYlxuICovXG5cbmZ1bmN0aW9uIG9mZihlbCwgZXZlbnQsIGNiKSB7XG4gIGVsLnJlbW92ZUV2ZW50TGlzdGVuZXIoZXZlbnQsIGNiKTtcbn1cblxuLyoqXG4gKiBGb3IgSUU5IGNvbXBhdDogd2hlbiBib3RoIGNsYXNzIGFuZCA6Y2xhc3MgYXJlIHByZXNlbnRcbiAqIGdldEF0dHJpYnV0ZSgnY2xhc3MnKSByZXR1cm5zIHdyb25nIHZhbHVlLi4uXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmZ1bmN0aW9uIGdldENsYXNzKGVsKSB7XG4gIHZhciBjbGFzc25hbWUgPSBlbC5jbGFzc05hbWU7XG4gIGlmICh0eXBlb2YgY2xhc3NuYW1lID09PSAnb2JqZWN0Jykge1xuICAgIGNsYXNzbmFtZSA9IGNsYXNzbmFtZS5iYXNlVmFsIHx8ICcnO1xuICB9XG4gIHJldHVybiBjbGFzc25hbWU7XG59XG5cbi8qKlxuICogSW4gSUU5LCBzZXRBdHRyaWJ1dGUoJ2NsYXNzJykgd2lsbCByZXN1bHQgaW4gZW1wdHkgY2xhc3NcbiAqIGlmIHRoZSBlbGVtZW50IGFsc28gaGFzIHRoZSA6Y2xhc3MgYXR0cmlidXRlOyBIb3dldmVyIGluXG4gKiBQaGFudG9tSlMsIHNldHRpbmcgYGNsYXNzTmFtZWAgZG9lcyBub3Qgd29yayBvbiBTVkcgZWxlbWVudHMuLi5cbiAqIFNvIHdlIGhhdmUgdG8gZG8gYSBjb25kaXRpb25hbCBjaGVjayBoZXJlLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBjbHNcbiAqL1xuXG5mdW5jdGlvbiBzZXRDbGFzcyhlbCwgY2xzKSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoaXNJRTkgJiYgIS9zdmckLy50ZXN0KGVsLm5hbWVzcGFjZVVSSSkpIHtcbiAgICBlbC5jbGFzc05hbWUgPSBjbHM7XG4gIH0gZWxzZSB7XG4gICAgZWwuc2V0QXR0cmlidXRlKCdjbGFzcycsIGNscyk7XG4gIH1cbn1cblxuLyoqXG4gKiBBZGQgY2xhc3Mgd2l0aCBjb21wYXRpYmlsaXR5IGZvciBJRSAmIFNWR1xuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBjbHNcbiAqL1xuXG5mdW5jdGlvbiBhZGRDbGFzcyhlbCwgY2xzKSB7XG4gIGlmIChlbC5jbGFzc0xpc3QpIHtcbiAgICBlbC5jbGFzc0xpc3QuYWRkKGNscyk7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGN1ciA9ICcgJyArIGdldENsYXNzKGVsKSArICcgJztcbiAgICBpZiAoY3VyLmluZGV4T2YoJyAnICsgY2xzICsgJyAnKSA8IDApIHtcbiAgICAgIHNldENsYXNzKGVsLCAoY3VyICsgY2xzKS50cmltKCkpO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIFJlbW92ZSBjbGFzcyB3aXRoIGNvbXBhdGliaWxpdHkgZm9yIElFICYgU1ZHXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtTdHJpbmd9IGNsc1xuICovXG5cbmZ1bmN0aW9uIHJlbW92ZUNsYXNzKGVsLCBjbHMpIHtcbiAgaWYgKGVsLmNsYXNzTGlzdCkge1xuICAgIGVsLmNsYXNzTGlzdC5yZW1vdmUoY2xzKTtcbiAgfSBlbHNlIHtcbiAgICB2YXIgY3VyID0gJyAnICsgZ2V0Q2xhc3MoZWwpICsgJyAnO1xuICAgIHZhciB0YXIgPSAnICcgKyBjbHMgKyAnICc7XG4gICAgd2hpbGUgKGN1ci5pbmRleE9mKHRhcikgPj0gMCkge1xuICAgICAgY3VyID0gY3VyLnJlcGxhY2UodGFyLCAnICcpO1xuICAgIH1cbiAgICBzZXRDbGFzcyhlbCwgY3VyLnRyaW0oKSk7XG4gIH1cbiAgaWYgKCFlbC5jbGFzc05hbWUpIHtcbiAgICBlbC5yZW1vdmVBdHRyaWJ1dGUoJ2NsYXNzJyk7XG4gIH1cbn1cblxuLyoqXG4gKiBFeHRyYWN0IHJhdyBjb250ZW50IGluc2lkZSBhbiBlbGVtZW50IGludG8gYSB0ZW1wb3JhcnlcbiAqIGNvbnRhaW5lciBkaXZcbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGFzRnJhZ21lbnRcbiAqIEByZXR1cm4ge0VsZW1lbnR8RG9jdW1lbnRGcmFnbWVudH1cbiAqL1xuXG5mdW5jdGlvbiBleHRyYWN0Q29udGVudChlbCwgYXNGcmFnbWVudCkge1xuICB2YXIgY2hpbGQ7XG4gIHZhciByYXdDb250ZW50O1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKGlzVGVtcGxhdGUoZWwpICYmIGlzRnJhZ21lbnQoZWwuY29udGVudCkpIHtcbiAgICBlbCA9IGVsLmNvbnRlbnQ7XG4gIH1cbiAgaWYgKGVsLmhhc0NoaWxkTm9kZXMoKSkge1xuICAgIHRyaW1Ob2RlKGVsKTtcbiAgICByYXdDb250ZW50ID0gYXNGcmFnbWVudCA/IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKSA6IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbmQtYXNzaWduICovXG4gICAgd2hpbGUgKGNoaWxkID0gZWwuZmlyc3RDaGlsZCkge1xuICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICAgICAgcmF3Q29udGVudC5hcHBlbmRDaGlsZChjaGlsZCk7XG4gICAgfVxuICB9XG4gIHJldHVybiByYXdDb250ZW50O1xufVxuXG4vKipcbiAqIFRyaW0gcG9zc2libGUgZW1wdHkgaGVhZC90YWlsIHRleHQgYW5kIGNvbW1lbnRcbiAqIG5vZGVzIGluc2lkZSBhIHBhcmVudC5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAqL1xuXG5mdW5jdGlvbiB0cmltTm9kZShub2RlKSB7XG4gIHZhciBjaGlsZDtcbiAgLyogZXNsaW50LWRpc2FibGUgbm8tc2VxdWVuY2VzICovXG4gIHdoaWxlICgoY2hpbGQgPSBub2RlLmZpcnN0Q2hpbGQsIGlzVHJpbW1hYmxlKGNoaWxkKSkpIHtcbiAgICBub2RlLnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgfVxuICB3aGlsZSAoKGNoaWxkID0gbm9kZS5sYXN0Q2hpbGQsIGlzVHJpbW1hYmxlKGNoaWxkKSkpIHtcbiAgICBub2RlLnJlbW92ZUNoaWxkKGNoaWxkKTtcbiAgfVxuICAvKiBlc2xpbnQtZW5hYmxlIG5vLXNlcXVlbmNlcyAqL1xufVxuXG5mdW5jdGlvbiBpc1RyaW1tYWJsZShub2RlKSB7XG4gIHJldHVybiBub2RlICYmIChub2RlLm5vZGVUeXBlID09PSAzICYmICFub2RlLmRhdGEudHJpbSgpIHx8IG5vZGUubm9kZVR5cGUgPT09IDgpO1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGFuIGVsZW1lbnQgaXMgYSB0ZW1wbGF0ZSB0YWcuXG4gKiBOb3RlIGlmIHRoZSB0ZW1wbGF0ZSBhcHBlYXJzIGluc2lkZSBhbiBTVkcgaXRzIHRhZ05hbWVcbiAqIHdpbGwgYmUgaW4gbG93ZXJjYXNlLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqL1xuXG5mdW5jdGlvbiBpc1RlbXBsYXRlKGVsKSB7XG4gIHJldHVybiBlbC50YWdOYW1lICYmIGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gJ3RlbXBsYXRlJztcbn1cblxuLyoqXG4gKiBDcmVhdGUgYW4gXCJhbmNob3JcIiBmb3IgcGVyZm9ybWluZyBkb20gaW5zZXJ0aW9uL3JlbW92YWxzLlxuICogVGhpcyBpcyB1c2VkIGluIGEgbnVtYmVyIG9mIHNjZW5hcmlvczpcbiAqIC0gZnJhZ21lbnQgaW5zdGFuY2VcbiAqIC0gdi1odG1sXG4gKiAtIHYtaWZcbiAqIC0gdi1mb3JcbiAqIC0gY29tcG9uZW50XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGNvbnRlbnRcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gcGVyc2lzdCAtIElFIHRyYXNoZXMgZW1wdHkgdGV4dE5vZGVzIG9uXG4gKiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbG9uZU5vZGUodHJ1ZSksIHNvIGluIGNlcnRhaW5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNhc2VzIHRoZSBhbmNob3IgbmVlZHMgdG8gYmVcbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIG5vbi1lbXB0eSB0byBiZSBwZXJzaXN0ZWQgaW5cbiAqICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRlbXBsYXRlcy5cbiAqIEByZXR1cm4ge0NvbW1lbnR8VGV4dH1cbiAqL1xuXG5mdW5jdGlvbiBjcmVhdGVBbmNob3IoY29udGVudCwgcGVyc2lzdCkge1xuICB2YXIgYW5jaG9yID0gY29uZmlnLmRlYnVnID8gZG9jdW1lbnQuY3JlYXRlQ29tbWVudChjb250ZW50KSA6IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHBlcnNpc3QgPyAnICcgOiAnJyk7XG4gIGFuY2hvci5fX3ZfYW5jaG9yID0gdHJ1ZTtcbiAgcmV0dXJuIGFuY2hvcjtcbn1cblxuLyoqXG4gKiBGaW5kIGEgY29tcG9uZW50IHJlZiBhdHRyaWJ1dGUgdGhhdCBzdGFydHMgd2l0aCAkLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gbm9kZVxuICogQHJldHVybiB7U3RyaW5nfHVuZGVmaW5lZH1cbiAqL1xuXG52YXIgcmVmUkUgPSAvXnYtcmVmOi87XG5cbmZ1bmN0aW9uIGZpbmRSZWYobm9kZSkge1xuICBpZiAobm9kZS5oYXNBdHRyaWJ1dGVzKCkpIHtcbiAgICB2YXIgYXR0cnMgPSBub2RlLmF0dHJpYnV0ZXM7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBhdHRycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHZhciBuYW1lID0gYXR0cnNbaV0ubmFtZTtcbiAgICAgIGlmIChyZWZSRS50ZXN0KG5hbWUpKSB7XG4gICAgICAgIHJldHVybiBjYW1lbGl6ZShuYW1lLnJlcGxhY2UocmVmUkUsICcnKSk7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogTWFwIGEgZnVuY3Rpb24gdG8gYSByYW5nZSBvZiBub2RlcyAuXG4gKlxuICogQHBhcmFtIHtOb2RlfSBub2RlXG4gKiBAcGFyYW0ge05vZGV9IGVuZFxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3BcbiAqL1xuXG5mdW5jdGlvbiBtYXBOb2RlUmFuZ2Uobm9kZSwgZW5kLCBvcCkge1xuICB2YXIgbmV4dDtcbiAgd2hpbGUgKG5vZGUgIT09IGVuZCkge1xuICAgIG5leHQgPSBub2RlLm5leHRTaWJsaW5nO1xuICAgIG9wKG5vZGUpO1xuICAgIG5vZGUgPSBuZXh0O1xuICB9XG4gIG9wKGVuZCk7XG59XG5cbi8qKlxuICogUmVtb3ZlIGEgcmFuZ2Ugb2Ygbm9kZXMgd2l0aCB0cmFuc2l0aW9uLCBzdG9yZVxuICogdGhlIG5vZGVzIGluIGEgZnJhZ21lbnQgd2l0aCBjb3JyZWN0IG9yZGVyaW5nLFxuICogYW5kIGNhbGwgY2FsbGJhY2sgd2hlbiBkb25lLlxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gc3RhcnRcbiAqIEBwYXJhbSB7Tm9kZX0gZW5kXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gZnJhZ1xuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqL1xuXG5mdW5jdGlvbiByZW1vdmVOb2RlUmFuZ2Uoc3RhcnQsIGVuZCwgdm0sIGZyYWcsIGNiKSB7XG4gIHZhciBkb25lID0gZmFsc2U7XG4gIHZhciByZW1vdmVkID0gMDtcbiAgdmFyIG5vZGVzID0gW107XG4gIG1hcE5vZGVSYW5nZShzdGFydCwgZW5kLCBmdW5jdGlvbiAobm9kZSkge1xuICAgIGlmIChub2RlID09PSBlbmQpIGRvbmUgPSB0cnVlO1xuICAgIG5vZGVzLnB1c2gobm9kZSk7XG4gICAgcmVtb3ZlV2l0aFRyYW5zaXRpb24obm9kZSwgdm0sIG9uUmVtb3ZlZCk7XG4gIH0pO1xuICBmdW5jdGlvbiBvblJlbW92ZWQoKSB7XG4gICAgcmVtb3ZlZCsrO1xuICAgIGlmIChkb25lICYmIHJlbW92ZWQgPj0gbm9kZXMubGVuZ3RoKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IG5vZGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGZyYWcuYXBwZW5kQ2hpbGQobm9kZXNbaV0pO1xuICAgICAgfVxuICAgICAgY2IgJiYgY2IoKTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhIG5vZGUgaXMgYSBEb2N1bWVudEZyYWdtZW50LlxuICpcbiAqIEBwYXJhbSB7Tm9kZX0gbm9kZVxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5mdW5jdGlvbiBpc0ZyYWdtZW50KG5vZGUpIHtcbiAgcmV0dXJuIG5vZGUgJiYgbm9kZS5ub2RlVHlwZSA9PT0gMTE7XG59XG5cbi8qKlxuICogR2V0IG91dGVySFRNTCBvZiBlbGVtZW50cywgdGFraW5nIGNhcmVcbiAqIG9mIFNWRyBlbGVtZW50cyBpbiBJRSBhcyB3ZWxsLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG5mdW5jdGlvbiBnZXRPdXRlckhUTUwoZWwpIHtcbiAgaWYgKGVsLm91dGVySFRNTCkge1xuICAgIHJldHVybiBlbC5vdXRlckhUTUw7XG4gIH0gZWxzZSB7XG4gICAgdmFyIGNvbnRhaW5lciA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIGNvbnRhaW5lci5hcHBlbmRDaGlsZChlbC5jbG9uZU5vZGUodHJ1ZSkpO1xuICAgIHJldHVybiBjb250YWluZXIuaW5uZXJIVE1MO1xuICB9XG59XG5cbnZhciBjb21tb25UYWdSRSA9IC9eKGRpdnxwfHNwYW58aW1nfGF8YnxpfGJyfHVsfG9sfGxpfGgxfGgyfGgzfGg0fGg1fGg2fGNvZGV8cHJlfHRhYmxlfHRofHRkfHRyfGZvcm18bGFiZWx8aW5wdXR8c2VsZWN0fG9wdGlvbnxuYXZ8YXJ0aWNsZXxzZWN0aW9ufGhlYWRlcnxmb290ZXIpJC9pO1xudmFyIHJlc2VydmVkVGFnUkUgPSAvXihzbG90fHBhcnRpYWx8Y29tcG9uZW50KSQvaTtcblxudmFyIGlzVW5rbm93bkVsZW1lbnQgPSB1bmRlZmluZWQ7XG5pZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICBpc1Vua25vd25FbGVtZW50ID0gZnVuY3Rpb24gKGVsLCB0YWcpIHtcbiAgICBpZiAodGFnLmluZGV4T2YoJy0nKSA+IC0xKSB7XG4gICAgICAvLyBodHRwOi8vc3RhY2tvdmVyZmxvdy5jb20vYS8yODIxMDM2NC8xMDcwMjQ0XG4gICAgICByZXR1cm4gZWwuY29uc3RydWN0b3IgPT09IHdpbmRvdy5IVE1MVW5rbm93bkVsZW1lbnQgfHwgZWwuY29uc3RydWN0b3IgPT09IHdpbmRvdy5IVE1MRWxlbWVudDtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICgvSFRNTFVua25vd25FbGVtZW50Ly50ZXN0KGVsLnRvU3RyaW5nKCkpICYmXG4gICAgICAgIC8vIENocm9tZSByZXR1cm5zIHVua25vd24gZm9yIHNldmVyYWwgSFRNTDUgZWxlbWVudHMuXG4gICAgICAgIC8vIGh0dHBzOi8vY29kZS5nb29nbGUuY29tL3AvY2hyb21pdW0vaXNzdWVzL2RldGFpbD9pZD01NDA1MjZcbiAgICAgICAgIS9eKGRhdGF8dGltZXxydGN8cmIpJC8udGVzdCh0YWcpXG4gICAgICApO1xuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhbiBlbGVtZW50IGlzIGEgY29tcG9uZW50LCBpZiB5ZXMgcmV0dXJuIGl0c1xuICogY29tcG9uZW50IGlkLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtPYmplY3R8dW5kZWZpbmVkfVxuICovXG5cbmZ1bmN0aW9uIGNoZWNrQ29tcG9uZW50QXR0cihlbCwgb3B0aW9ucykge1xuICB2YXIgdGFnID0gZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xuICB2YXIgaGFzQXR0cnMgPSBlbC5oYXNBdHRyaWJ1dGVzKCk7XG4gIGlmICghY29tbW9uVGFnUkUudGVzdCh0YWcpICYmICFyZXNlcnZlZFRhZ1JFLnRlc3QodGFnKSkge1xuICAgIGlmIChyZXNvbHZlQXNzZXQob3B0aW9ucywgJ2NvbXBvbmVudHMnLCB0YWcpKSB7XG4gICAgICByZXR1cm4geyBpZDogdGFnIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBpcyA9IGhhc0F0dHJzICYmIGdldElzQmluZGluZyhlbCwgb3B0aW9ucyk7XG4gICAgICBpZiAoaXMpIHtcbiAgICAgICAgcmV0dXJuIGlzO1xuICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHZhciBleHBlY3RlZFRhZyA9IG9wdGlvbnMuX2NvbXBvbmVudE5hbWVNYXAgJiYgb3B0aW9ucy5fY29tcG9uZW50TmFtZU1hcFt0YWddO1xuICAgICAgICBpZiAoZXhwZWN0ZWRUYWcpIHtcbiAgICAgICAgICB3YXJuKCdVbmtub3duIGN1c3RvbSBlbGVtZW50OiA8JyArIHRhZyArICc+IC0gJyArICdkaWQgeW91IG1lYW4gPCcgKyBleHBlY3RlZFRhZyArICc+PyAnICsgJ0hUTUwgaXMgY2FzZS1pbnNlbnNpdGl2ZSwgcmVtZW1iZXIgdG8gdXNlIGtlYmFiLWNhc2UgaW4gdGVtcGxhdGVzLicpO1xuICAgICAgICB9IGVsc2UgaWYgKGlzVW5rbm93bkVsZW1lbnQoZWwsIHRhZykpIHtcbiAgICAgICAgICB3YXJuKCdVbmtub3duIGN1c3RvbSBlbGVtZW50OiA8JyArIHRhZyArICc+IC0gZGlkIHlvdSAnICsgJ3JlZ2lzdGVyIHRoZSBjb21wb25lbnQgY29ycmVjdGx5PyBGb3IgcmVjdXJzaXZlIGNvbXBvbmVudHMsICcgKyAnbWFrZSBzdXJlIHRvIHByb3ZpZGUgdGhlIFwibmFtZVwiIG9wdGlvbi4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChoYXNBdHRycykge1xuICAgIHJldHVybiBnZXRJc0JpbmRpbmcoZWwsIG9wdGlvbnMpO1xuICB9XG59XG5cbi8qKlxuICogR2V0IFwiaXNcIiBiaW5kaW5nIGZyb20gYW4gZWxlbWVudC5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7T2JqZWN0fHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBnZXRJc0JpbmRpbmcoZWwsIG9wdGlvbnMpIHtcbiAgLy8gZHluYW1pYyBzeW50YXhcbiAgdmFyIGV4cCA9IGVsLmdldEF0dHJpYnV0ZSgnaXMnKTtcbiAgaWYgKGV4cCAhPSBudWxsKSB7XG4gICAgaWYgKHJlc29sdmVBc3NldChvcHRpb25zLCAnY29tcG9uZW50cycsIGV4cCkpIHtcbiAgICAgIGVsLnJlbW92ZUF0dHJpYnV0ZSgnaXMnKTtcbiAgICAgIHJldHVybiB7IGlkOiBleHAgfTtcbiAgICB9XG4gIH0gZWxzZSB7XG4gICAgZXhwID0gZ2V0QmluZEF0dHIoZWwsICdpcycpO1xuICAgIGlmIChleHAgIT0gbnVsbCkge1xuICAgICAgcmV0dXJuIHsgaWQ6IGV4cCwgZHluYW1pYzogdHJ1ZSB9O1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIE9wdGlvbiBvdmVyd3JpdGluZyBzdHJhdGVnaWVzIGFyZSBmdW5jdGlvbnMgdGhhdCBoYW5kbGVcbiAqIGhvdyB0byBtZXJnZSBhIHBhcmVudCBvcHRpb24gdmFsdWUgYW5kIGEgY2hpbGQgb3B0aW9uXG4gKiB2YWx1ZSBpbnRvIHRoZSBmaW5hbCB2YWx1ZS5cbiAqXG4gKiBBbGwgc3RyYXRlZ3kgZnVuY3Rpb25zIGZvbGxvdyB0aGUgc2FtZSBzaWduYXR1cmU6XG4gKlxuICogQHBhcmFtIHsqfSBwYXJlbnRWYWxcbiAqIEBwYXJhbSB7Kn0gY2hpbGRWYWxcbiAqIEBwYXJhbSB7VnVlfSBbdm1dXG4gKi9cblxudmFyIHN0cmF0cyA9IGNvbmZpZy5vcHRpb25NZXJnZVN0cmF0ZWdpZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG4vKipcbiAqIEhlbHBlciB0aGF0IHJlY3Vyc2l2ZWx5IG1lcmdlcyB0d28gZGF0YSBvYmplY3RzIHRvZ2V0aGVyLlxuICovXG5cbmZ1bmN0aW9uIG1lcmdlRGF0YSh0bywgZnJvbSkge1xuICB2YXIga2V5LCB0b1ZhbCwgZnJvbVZhbDtcbiAgZm9yIChrZXkgaW4gZnJvbSkge1xuICAgIHRvVmFsID0gdG9ba2V5XTtcbiAgICBmcm9tVmFsID0gZnJvbVtrZXldO1xuICAgIGlmICghaGFzT3duKHRvLCBrZXkpKSB7XG4gICAgICBzZXQodG8sIGtleSwgZnJvbVZhbCk7XG4gICAgfSBlbHNlIGlmIChpc09iamVjdCh0b1ZhbCkgJiYgaXNPYmplY3QoZnJvbVZhbCkpIHtcbiAgICAgIG1lcmdlRGF0YSh0b1ZhbCwgZnJvbVZhbCk7XG4gICAgfVxuICB9XG4gIHJldHVybiB0bztcbn1cblxuLyoqXG4gKiBEYXRhXG4gKi9cblxuc3RyYXRzLmRhdGEgPSBmdW5jdGlvbiAocGFyZW50VmFsLCBjaGlsZFZhbCwgdm0pIHtcbiAgaWYgKCF2bSkge1xuICAgIC8vIGluIGEgVnVlLmV4dGVuZCBtZXJnZSwgYm90aCBzaG91bGQgYmUgZnVuY3Rpb25zXG4gICAgaWYgKCFjaGlsZFZhbCkge1xuICAgICAgcmV0dXJuIHBhcmVudFZhbDtcbiAgICB9XG4gICAgaWYgKHR5cGVvZiBjaGlsZFZhbCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdUaGUgXCJkYXRhXCIgb3B0aW9uIHNob3VsZCBiZSBhIGZ1bmN0aW9uICcgKyAndGhhdCByZXR1cm5zIGEgcGVyLWluc3RhbmNlIHZhbHVlIGluIGNvbXBvbmVudCAnICsgJ2RlZmluaXRpb25zLicsIHZtKTtcbiAgICAgIHJldHVybiBwYXJlbnRWYWw7XG4gICAgfVxuICAgIGlmICghcGFyZW50VmFsKSB7XG4gICAgICByZXR1cm4gY2hpbGRWYWw7XG4gICAgfVxuICAgIC8vIHdoZW4gcGFyZW50VmFsICYgY2hpbGRWYWwgYXJlIGJvdGggcHJlc2VudCxcbiAgICAvLyB3ZSBuZWVkIHRvIHJldHVybiBhIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyB0aGVcbiAgICAvLyBtZXJnZWQgcmVzdWx0IG9mIGJvdGggZnVuY3Rpb25zLi4uIG5vIG5lZWQgdG9cbiAgICAvLyBjaGVjayBpZiBwYXJlbnRWYWwgaXMgYSBmdW5jdGlvbiBoZXJlIGJlY2F1c2VcbiAgICAvLyBpdCBoYXMgdG8gYmUgYSBmdW5jdGlvbiB0byBwYXNzIHByZXZpb3VzIG1lcmdlcy5cbiAgICByZXR1cm4gZnVuY3Rpb24gbWVyZ2VkRGF0YUZuKCkge1xuICAgICAgcmV0dXJuIG1lcmdlRGF0YShjaGlsZFZhbC5jYWxsKHRoaXMpLCBwYXJlbnRWYWwuY2FsbCh0aGlzKSk7XG4gICAgfTtcbiAgfSBlbHNlIGlmIChwYXJlbnRWYWwgfHwgY2hpbGRWYWwpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gbWVyZ2VkSW5zdGFuY2VEYXRhRm4oKSB7XG4gICAgICAvLyBpbnN0YW5jZSBtZXJnZVxuICAgICAgdmFyIGluc3RhbmNlRGF0YSA9IHR5cGVvZiBjaGlsZFZhbCA9PT0gJ2Z1bmN0aW9uJyA/IGNoaWxkVmFsLmNhbGwodm0pIDogY2hpbGRWYWw7XG4gICAgICB2YXIgZGVmYXVsdERhdGEgPSB0eXBlb2YgcGFyZW50VmFsID09PSAnZnVuY3Rpb24nID8gcGFyZW50VmFsLmNhbGwodm0pIDogdW5kZWZpbmVkO1xuICAgICAgaWYgKGluc3RhbmNlRGF0YSkge1xuICAgICAgICByZXR1cm4gbWVyZ2VEYXRhKGluc3RhbmNlRGF0YSwgZGVmYXVsdERhdGEpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmV0dXJuIGRlZmF1bHREYXRhO1xuICAgICAgfVxuICAgIH07XG4gIH1cbn07XG5cbi8qKlxuICogRWxcbiAqL1xuXG5zdHJhdHMuZWwgPSBmdW5jdGlvbiAocGFyZW50VmFsLCBjaGlsZFZhbCwgdm0pIHtcbiAgaWYgKCF2bSAmJiBjaGlsZFZhbCAmJiB0eXBlb2YgY2hpbGRWYWwgIT09ICdmdW5jdGlvbicpIHtcbiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ1RoZSBcImVsXCIgb3B0aW9uIHNob3VsZCBiZSBhIGZ1bmN0aW9uICcgKyAndGhhdCByZXR1cm5zIGEgcGVyLWluc3RhbmNlIHZhbHVlIGluIGNvbXBvbmVudCAnICsgJ2RlZmluaXRpb25zLicsIHZtKTtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIHJldCA9IGNoaWxkVmFsIHx8IHBhcmVudFZhbDtcbiAgLy8gaW52b2tlIHRoZSBlbGVtZW50IGZhY3RvcnkgaWYgdGhpcyBpcyBpbnN0YW5jZSBtZXJnZVxuICByZXR1cm4gdm0gJiYgdHlwZW9mIHJldCA9PT0gJ2Z1bmN0aW9uJyA/IHJldC5jYWxsKHZtKSA6IHJldDtcbn07XG5cbi8qKlxuICogSG9va3MgYW5kIHBhcmFtIGF0dHJpYnV0ZXMgYXJlIG1lcmdlZCBhcyBhcnJheXMuXG4gKi9cblxuc3RyYXRzLmluaXQgPSBzdHJhdHMuY3JlYXRlZCA9IHN0cmF0cy5yZWFkeSA9IHN0cmF0cy5hdHRhY2hlZCA9IHN0cmF0cy5kZXRhY2hlZCA9IHN0cmF0cy5iZWZvcmVDb21waWxlID0gc3RyYXRzLmNvbXBpbGVkID0gc3RyYXRzLmJlZm9yZURlc3Ryb3kgPSBzdHJhdHMuZGVzdHJveWVkID0gc3RyYXRzLmFjdGl2YXRlID0gZnVuY3Rpb24gKHBhcmVudFZhbCwgY2hpbGRWYWwpIHtcbiAgcmV0dXJuIGNoaWxkVmFsID8gcGFyZW50VmFsID8gcGFyZW50VmFsLmNvbmNhdChjaGlsZFZhbCkgOiBpc0FycmF5KGNoaWxkVmFsKSA/IGNoaWxkVmFsIDogW2NoaWxkVmFsXSA6IHBhcmVudFZhbDtcbn07XG5cbi8qKlxuICogQXNzZXRzXG4gKlxuICogV2hlbiBhIHZtIGlzIHByZXNlbnQgKGluc3RhbmNlIGNyZWF0aW9uKSwgd2UgbmVlZCB0byBkb1xuICogYSB0aHJlZS13YXkgbWVyZ2UgYmV0d2VlbiBjb25zdHJ1Y3RvciBvcHRpb25zLCBpbnN0YW5jZVxuICogb3B0aW9ucyBhbmQgcGFyZW50IG9wdGlvbnMuXG4gKi9cblxuZnVuY3Rpb24gbWVyZ2VBc3NldHMocGFyZW50VmFsLCBjaGlsZFZhbCkge1xuICB2YXIgcmVzID0gT2JqZWN0LmNyZWF0ZShwYXJlbnRWYWwgfHwgbnVsbCk7XG4gIHJldHVybiBjaGlsZFZhbCA/IGV4dGVuZChyZXMsIGd1YXJkQXJyYXlBc3NldHMoY2hpbGRWYWwpKSA6IHJlcztcbn1cblxuY29uZmlnLl9hc3NldFR5cGVzLmZvckVhY2goZnVuY3Rpb24gKHR5cGUpIHtcbiAgc3RyYXRzW3R5cGUgKyAncyddID0gbWVyZ2VBc3NldHM7XG59KTtcblxuLyoqXG4gKiBFdmVudHMgJiBXYXRjaGVycy5cbiAqXG4gKiBFdmVudHMgJiB3YXRjaGVycyBoYXNoZXMgc2hvdWxkIG5vdCBvdmVyd3JpdGUgb25lXG4gKiBhbm90aGVyLCBzbyB3ZSBtZXJnZSB0aGVtIGFzIGFycmF5cy5cbiAqL1xuXG5zdHJhdHMud2F0Y2ggPSBzdHJhdHMuZXZlbnRzID0gZnVuY3Rpb24gKHBhcmVudFZhbCwgY2hpbGRWYWwpIHtcbiAgaWYgKCFjaGlsZFZhbCkgcmV0dXJuIHBhcmVudFZhbDtcbiAgaWYgKCFwYXJlbnRWYWwpIHJldHVybiBjaGlsZFZhbDtcbiAgdmFyIHJldCA9IHt9O1xuICBleHRlbmQocmV0LCBwYXJlbnRWYWwpO1xuICBmb3IgKHZhciBrZXkgaW4gY2hpbGRWYWwpIHtcbiAgICB2YXIgcGFyZW50ID0gcmV0W2tleV07XG4gICAgdmFyIGNoaWxkID0gY2hpbGRWYWxba2V5XTtcbiAgICBpZiAocGFyZW50ICYmICFpc0FycmF5KHBhcmVudCkpIHtcbiAgICAgIHBhcmVudCA9IFtwYXJlbnRdO1xuICAgIH1cbiAgICByZXRba2V5XSA9IHBhcmVudCA/IHBhcmVudC5jb25jYXQoY2hpbGQpIDogW2NoaWxkXTtcbiAgfVxuICByZXR1cm4gcmV0O1xufTtcblxuLyoqXG4gKiBPdGhlciBvYmplY3QgaGFzaGVzLlxuICovXG5cbnN0cmF0cy5wcm9wcyA9IHN0cmF0cy5tZXRob2RzID0gc3RyYXRzLmNvbXB1dGVkID0gZnVuY3Rpb24gKHBhcmVudFZhbCwgY2hpbGRWYWwpIHtcbiAgaWYgKCFjaGlsZFZhbCkgcmV0dXJuIHBhcmVudFZhbDtcbiAgaWYgKCFwYXJlbnRWYWwpIHJldHVybiBjaGlsZFZhbDtcbiAgdmFyIHJldCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG4gIGV4dGVuZChyZXQsIHBhcmVudFZhbCk7XG4gIGV4dGVuZChyZXQsIGNoaWxkVmFsKTtcbiAgcmV0dXJuIHJldDtcbn07XG5cbi8qKlxuICogRGVmYXVsdCBzdHJhdGVneS5cbiAqL1xuXG52YXIgZGVmYXVsdFN0cmF0ID0gZnVuY3Rpb24gZGVmYXVsdFN0cmF0KHBhcmVudFZhbCwgY2hpbGRWYWwpIHtcbiAgcmV0dXJuIGNoaWxkVmFsID09PSB1bmRlZmluZWQgPyBwYXJlbnRWYWwgOiBjaGlsZFZhbDtcbn07XG5cbi8qKlxuICogTWFrZSBzdXJlIGNvbXBvbmVudCBvcHRpb25zIGdldCBjb252ZXJ0ZWQgdG8gYWN0dWFsXG4gKiBjb25zdHJ1Y3RvcnMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqL1xuXG5mdW5jdGlvbiBndWFyZENvbXBvbmVudHMob3B0aW9ucykge1xuICBpZiAob3B0aW9ucy5jb21wb25lbnRzKSB7XG4gICAgdmFyIGNvbXBvbmVudHMgPSBvcHRpb25zLmNvbXBvbmVudHMgPSBndWFyZEFycmF5QXNzZXRzKG9wdGlvbnMuY29tcG9uZW50cyk7XG4gICAgdmFyIGlkcyA9IE9iamVjdC5rZXlzKGNvbXBvbmVudHMpO1xuICAgIHZhciBkZWY7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgIHZhciBtYXAgPSBvcHRpb25zLl9jb21wb25lbnROYW1lTWFwID0ge307XG4gICAgfVxuICAgIGZvciAodmFyIGkgPSAwLCBsID0gaWRzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgdmFyIGtleSA9IGlkc1tpXTtcbiAgICAgIGlmIChjb21tb25UYWdSRS50ZXN0KGtleSkgfHwgcmVzZXJ2ZWRUYWdSRS50ZXN0KGtleSkpIHtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdEbyBub3QgdXNlIGJ1aWx0LWluIG9yIHJlc2VydmVkIEhUTUwgZWxlbWVudHMgYXMgY29tcG9uZW50ICcgKyAnaWQ6ICcgKyBrZXkpO1xuICAgICAgICBjb250aW51ZTtcbiAgICAgIH1cbiAgICAgIC8vIHJlY29yZCBhIGFsbCBsb3dlcmNhc2UgPC0+IGtlYmFiLWNhc2UgbWFwcGluZyBmb3JcbiAgICAgIC8vIHBvc3NpYmxlIGN1c3RvbSBlbGVtZW50IGNhc2UgZXJyb3Igd2FybmluZ1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgbWFwW2tleS5yZXBsYWNlKC8tL2csICcnKS50b0xvd2VyQ2FzZSgpXSA9IGh5cGhlbmF0ZShrZXkpO1xuICAgICAgfVxuICAgICAgZGVmID0gY29tcG9uZW50c1trZXldO1xuICAgICAgaWYgKGlzUGxhaW5PYmplY3QoZGVmKSkge1xuICAgICAgICBjb21wb25lbnRzW2tleV0gPSBWdWUuZXh0ZW5kKGRlZik7XG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogRW5zdXJlIGFsbCBwcm9wcyBvcHRpb24gc3ludGF4IGFyZSBub3JtYWxpemVkIGludG8gdGhlXG4gKiBPYmplY3QtYmFzZWQgZm9ybWF0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKi9cblxuZnVuY3Rpb24gZ3VhcmRQcm9wcyhvcHRpb25zKSB7XG4gIHZhciBwcm9wcyA9IG9wdGlvbnMucHJvcHM7XG4gIHZhciBpLCB2YWw7XG4gIGlmIChpc0FycmF5KHByb3BzKSkge1xuICAgIG9wdGlvbnMucHJvcHMgPSB7fTtcbiAgICBpID0gcHJvcHMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHZhbCA9IHByb3BzW2ldO1xuICAgICAgaWYgKHR5cGVvZiB2YWwgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgIG9wdGlvbnMucHJvcHNbdmFsXSA9IG51bGw7XG4gICAgICB9IGVsc2UgaWYgKHZhbC5uYW1lKSB7XG4gICAgICAgIG9wdGlvbnMucHJvcHNbdmFsLm5hbWVdID0gdmFsO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChpc1BsYWluT2JqZWN0KHByb3BzKSkge1xuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXMocHJvcHMpO1xuICAgIGkgPSBrZXlzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICB2YWwgPSBwcm9wc1trZXlzW2ldXTtcbiAgICAgIGlmICh0eXBlb2YgdmFsID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgIHByb3BzW2tleXNbaV1dID0geyB0eXBlOiB2YWwgfTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBHdWFyZCBhbiBBcnJheS1mb3JtYXQgYXNzZXRzIG9wdGlvbiBhbmQgY29udmVydGVkIGl0XG4gKiBpbnRvIHRoZSBrZXktdmFsdWUgT2JqZWN0IGZvcm1hdC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdHxBcnJheX0gYXNzZXRzXG4gKiBAcmV0dXJuIHtPYmplY3R9XG4gKi9cblxuZnVuY3Rpb24gZ3VhcmRBcnJheUFzc2V0cyhhc3NldHMpIHtcbiAgaWYgKGlzQXJyYXkoYXNzZXRzKSkge1xuICAgIHZhciByZXMgPSB7fTtcbiAgICB2YXIgaSA9IGFzc2V0cy5sZW5ndGg7XG4gICAgdmFyIGFzc2V0O1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGFzc2V0ID0gYXNzZXRzW2ldO1xuICAgICAgdmFyIGlkID0gdHlwZW9mIGFzc2V0ID09PSAnZnVuY3Rpb24nID8gYXNzZXQub3B0aW9ucyAmJiBhc3NldC5vcHRpb25zLm5hbWUgfHwgYXNzZXQuaWQgOiBhc3NldC5uYW1lIHx8IGFzc2V0LmlkO1xuICAgICAgaWYgKCFpZCkge1xuICAgICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0FycmF5LXN5bnRheCBhc3NldHMgbXVzdCBwcm92aWRlIGEgXCJuYW1lXCIgb3IgXCJpZFwiIGZpZWxkLicpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzW2lkXSA9IGFzc2V0O1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gcmVzO1xuICB9XG4gIHJldHVybiBhc3NldHM7XG59XG5cbi8qKlxuICogTWVyZ2UgdHdvIG9wdGlvbiBvYmplY3RzIGludG8gYSBuZXcgb25lLlxuICogQ29yZSB1dGlsaXR5IHVzZWQgaW4gYm90aCBpbnN0YW50aWF0aW9uIGFuZCBpbmhlcml0YW5jZS5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gcGFyZW50XG4gKiBAcGFyYW0ge09iamVjdH0gY2hpbGRcbiAqIEBwYXJhbSB7VnVlfSBbdm1dIC0gaWYgdm0gaXMgcHJlc2VudCwgaW5kaWNhdGVzIHRoaXMgaXNcbiAqICAgICAgICAgICAgICAgICAgICAgYW4gaW5zdGFudGlhdGlvbiBtZXJnZS5cbiAqL1xuXG5mdW5jdGlvbiBtZXJnZU9wdGlvbnMocGFyZW50LCBjaGlsZCwgdm0pIHtcbiAgZ3VhcmRDb21wb25lbnRzKGNoaWxkKTtcbiAgZ3VhcmRQcm9wcyhjaGlsZCk7XG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgaWYgKGNoaWxkLnByb3BzRGF0YSAmJiAhdm0pIHtcbiAgICAgIHdhcm4oJ3Byb3BzRGF0YSBjYW4gb25seSBiZSB1c2VkIGFzIGFuIGluc3RhbnRpYXRpb24gb3B0aW9uLicpO1xuICAgIH1cbiAgfVxuICB2YXIgb3B0aW9ucyA9IHt9O1xuICB2YXIga2V5O1xuICBpZiAoY2hpbGRbJ2V4dGVuZHMnXSkge1xuICAgIHBhcmVudCA9IHR5cGVvZiBjaGlsZFsnZXh0ZW5kcyddID09PSAnZnVuY3Rpb24nID8gbWVyZ2VPcHRpb25zKHBhcmVudCwgY2hpbGRbJ2V4dGVuZHMnXS5vcHRpb25zLCB2bSkgOiBtZXJnZU9wdGlvbnMocGFyZW50LCBjaGlsZFsnZXh0ZW5kcyddLCB2bSk7XG4gIH1cbiAgaWYgKGNoaWxkLm1peGlucykge1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2hpbGQubWl4aW5zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgcGFyZW50ID0gbWVyZ2VPcHRpb25zKHBhcmVudCwgY2hpbGQubWl4aW5zW2ldLCB2bSk7XG4gICAgfVxuICB9XG4gIGZvciAoa2V5IGluIHBhcmVudCkge1xuICAgIG1lcmdlRmllbGQoa2V5KTtcbiAgfVxuICBmb3IgKGtleSBpbiBjaGlsZCkge1xuICAgIGlmICghaGFzT3duKHBhcmVudCwga2V5KSkge1xuICAgICAgbWVyZ2VGaWVsZChrZXkpO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBtZXJnZUZpZWxkKGtleSkge1xuICAgIHZhciBzdHJhdCA9IHN0cmF0c1trZXldIHx8IGRlZmF1bHRTdHJhdDtcbiAgICBvcHRpb25zW2tleV0gPSBzdHJhdChwYXJlbnRba2V5XSwgY2hpbGRba2V5XSwgdm0sIGtleSk7XG4gIH1cbiAgcmV0dXJuIG9wdGlvbnM7XG59XG5cbi8qKlxuICogUmVzb2x2ZSBhbiBhc3NldC5cbiAqIFRoaXMgZnVuY3Rpb24gaXMgdXNlZCBiZWNhdXNlIGNoaWxkIGluc3RhbmNlcyBuZWVkIGFjY2Vzc1xuICogdG8gYXNzZXRzIGRlZmluZWQgaW4gaXRzIGFuY2VzdG9yIGNoYWluLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHBhcmFtIHtTdHJpbmd9IGlkXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHdhcm5NaXNzaW5nXG4gKiBAcmV0dXJuIHtPYmplY3R8RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gcmVzb2x2ZUFzc2V0KG9wdGlvbnMsIHR5cGUsIGlkLCB3YXJuTWlzc2luZykge1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKHR5cGVvZiBpZCAhPT0gJ3N0cmluZycpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIGFzc2V0cyA9IG9wdGlvbnNbdHlwZV07XG4gIHZhciBjYW1lbGl6ZWRJZDtcbiAgdmFyIHJlcyA9IGFzc2V0c1tpZF0gfHxcbiAgLy8gY2FtZWxDYXNlIElEXG4gIGFzc2V0c1tjYW1lbGl6ZWRJZCA9IGNhbWVsaXplKGlkKV0gfHxcbiAgLy8gUGFzY2FsIENhc2UgSURcbiAgYXNzZXRzW2NhbWVsaXplZElkLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgY2FtZWxpemVkSWQuc2xpY2UoMSldO1xuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuTWlzc2luZyAmJiAhcmVzKSB7XG4gICAgd2FybignRmFpbGVkIHRvIHJlc29sdmUgJyArIHR5cGUuc2xpY2UoMCwgLTEpICsgJzogJyArIGlkLCBvcHRpb25zKTtcbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG52YXIgdWlkJDEgPSAwO1xuXG4vKipcbiAqIEEgZGVwIGlzIGFuIG9ic2VydmFibGUgdGhhdCBjYW4gaGF2ZSBtdWx0aXBsZVxuICogZGlyZWN0aXZlcyBzdWJzY3JpYmluZyB0byBpdC5cbiAqXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gRGVwKCkge1xuICB0aGlzLmlkID0gdWlkJDErKztcbiAgdGhpcy5zdWJzID0gW107XG59XG5cbi8vIHRoZSBjdXJyZW50IHRhcmdldCB3YXRjaGVyIGJlaW5nIGV2YWx1YXRlZC5cbi8vIHRoaXMgaXMgZ2xvYmFsbHkgdW5pcXVlIGJlY2F1c2UgdGhlcmUgY291bGQgYmUgb25seSBvbmVcbi8vIHdhdGNoZXIgYmVpbmcgZXZhbHVhdGVkIGF0IGFueSB0aW1lLlxuRGVwLnRhcmdldCA9IG51bGw7XG5cbi8qKlxuICogQWRkIGEgZGlyZWN0aXZlIHN1YnNjcmliZXIuXG4gKlxuICogQHBhcmFtIHtEaXJlY3RpdmV9IHN1YlxuICovXG5cbkRlcC5wcm90b3R5cGUuYWRkU3ViID0gZnVuY3Rpb24gKHN1Yikge1xuICB0aGlzLnN1YnMucHVzaChzdWIpO1xufTtcblxuLyoqXG4gKiBSZW1vdmUgYSBkaXJlY3RpdmUgc3Vic2NyaWJlci5cbiAqXG4gKiBAcGFyYW0ge0RpcmVjdGl2ZX0gc3ViXG4gKi9cblxuRGVwLnByb3RvdHlwZS5yZW1vdmVTdWIgPSBmdW5jdGlvbiAoc3ViKSB7XG4gIHRoaXMuc3Vicy4kcmVtb3ZlKHN1Yik7XG59O1xuXG4vKipcbiAqIEFkZCBzZWxmIGFzIGEgZGVwZW5kZW5jeSB0byB0aGUgdGFyZ2V0IHdhdGNoZXIuXG4gKi9cblxuRGVwLnByb3RvdHlwZS5kZXBlbmQgPSBmdW5jdGlvbiAoKSB7XG4gIERlcC50YXJnZXQuYWRkRGVwKHRoaXMpO1xufTtcblxuLyoqXG4gKiBOb3RpZnkgYWxsIHN1YnNjcmliZXJzIG9mIGEgbmV3IHZhbHVlLlxuICovXG5cbkRlcC5wcm90b3R5cGUubm90aWZ5ID0gZnVuY3Rpb24gKCkge1xuICAvLyBzdGFibGl6ZSB0aGUgc3Vic2NyaWJlciBsaXN0IGZpcnN0XG4gIHZhciBzdWJzID0gdG9BcnJheSh0aGlzLnN1YnMpO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHN1YnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgc3Vic1tpXS51cGRhdGUoKTtcbiAgfVxufTtcblxudmFyIGFycmF5UHJvdG8gPSBBcnJheS5wcm90b3R5cGU7XG52YXIgYXJyYXlNZXRob2RzID0gT2JqZWN0LmNyZWF0ZShhcnJheVByb3RvKVxuXG4vKipcbiAqIEludGVyY2VwdCBtdXRhdGluZyBtZXRob2RzIGFuZCBlbWl0IGV2ZW50c1xuICovXG5cbjtbJ3B1c2gnLCAncG9wJywgJ3NoaWZ0JywgJ3Vuc2hpZnQnLCAnc3BsaWNlJywgJ3NvcnQnLCAncmV2ZXJzZSddLmZvckVhY2goZnVuY3Rpb24gKG1ldGhvZCkge1xuICAvLyBjYWNoZSBvcmlnaW5hbCBtZXRob2RcbiAgdmFyIG9yaWdpbmFsID0gYXJyYXlQcm90b1ttZXRob2RdO1xuICBkZWYoYXJyYXlNZXRob2RzLCBtZXRob2QsIGZ1bmN0aW9uIG11dGF0b3IoKSB7XG4gICAgLy8gYXZvaWQgbGVha2luZyBhcmd1bWVudHM6XG4gICAgLy8gaHR0cDovL2pzcGVyZi5jb20vY2xvc3VyZS13aXRoLWFyZ3VtZW50c1xuICAgIHZhciBpID0gYXJndW1lbnRzLmxlbmd0aDtcbiAgICB2YXIgYXJncyA9IG5ldyBBcnJheShpKTtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBhcmdzW2ldID0gYXJndW1lbnRzW2ldO1xuICAgIH1cbiAgICB2YXIgcmVzdWx0ID0gb3JpZ2luYWwuYXBwbHkodGhpcywgYXJncyk7XG4gICAgdmFyIG9iID0gdGhpcy5fX29iX187XG4gICAgdmFyIGluc2VydGVkO1xuICAgIHN3aXRjaCAobWV0aG9kKSB7XG4gICAgICBjYXNlICdwdXNoJzpcbiAgICAgICAgaW5zZXJ0ZWQgPSBhcmdzO1xuICAgICAgICBicmVhaztcbiAgICAgIGNhc2UgJ3Vuc2hpZnQnOlxuICAgICAgICBpbnNlcnRlZCA9IGFyZ3M7XG4gICAgICAgIGJyZWFrO1xuICAgICAgY2FzZSAnc3BsaWNlJzpcbiAgICAgICAgaW5zZXJ0ZWQgPSBhcmdzLnNsaWNlKDIpO1xuICAgICAgICBicmVhaztcbiAgICB9XG4gICAgaWYgKGluc2VydGVkKSBvYi5vYnNlcnZlQXJyYXkoaW5zZXJ0ZWQpO1xuICAgIC8vIG5vdGlmeSBjaGFuZ2VcbiAgICBvYi5kZXAubm90aWZ5KCk7XG4gICAgcmV0dXJuIHJlc3VsdDtcbiAgfSk7XG59KTtcblxuLyoqXG4gKiBTd2FwIHRoZSBlbGVtZW50IGF0IHRoZSBnaXZlbiBpbmRleCB3aXRoIGEgbmV3IHZhbHVlXG4gKiBhbmQgZW1pdHMgY29ycmVzcG9uZGluZyBldmVudC5cbiAqXG4gKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKiBAcmV0dXJuIHsqfSAtIHJlcGxhY2VkIGVsZW1lbnRcbiAqL1xuXG5kZWYoYXJyYXlQcm90bywgJyRzZXQnLCBmdW5jdGlvbiAkc2V0KGluZGV4LCB2YWwpIHtcbiAgaWYgKGluZGV4ID49IHRoaXMubGVuZ3RoKSB7XG4gICAgdGhpcy5sZW5ndGggPSBOdW1iZXIoaW5kZXgpICsgMTtcbiAgfVxuICByZXR1cm4gdGhpcy5zcGxpY2UoaW5kZXgsIDEsIHZhbClbMF07XG59KTtcblxuLyoqXG4gKiBDb252ZW5pZW5jZSBtZXRob2QgdG8gcmVtb3ZlIHRoZSBlbGVtZW50IGF0IGdpdmVuIGluZGV4IG9yIHRhcmdldCBlbGVtZW50IHJlZmVyZW5jZS5cbiAqXG4gKiBAcGFyYW0geyp9IGl0ZW1cbiAqL1xuXG5kZWYoYXJyYXlQcm90bywgJyRyZW1vdmUnLCBmdW5jdGlvbiAkcmVtb3ZlKGl0ZW0pIHtcbiAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gIGlmICghdGhpcy5sZW5ndGgpIHJldHVybjtcbiAgdmFyIGluZGV4ID0gaW5kZXhPZih0aGlzLCBpdGVtKTtcbiAgaWYgKGluZGV4ID4gLTEpIHtcbiAgICByZXR1cm4gdGhpcy5zcGxpY2UoaW5kZXgsIDEpO1xuICB9XG59KTtcblxudmFyIGFycmF5S2V5cyA9IE9iamVjdC5nZXRPd25Qcm9wZXJ0eU5hbWVzKGFycmF5TWV0aG9kcyk7XG5cbi8qKlxuICogQnkgZGVmYXVsdCwgd2hlbiBhIHJlYWN0aXZlIHByb3BlcnR5IGlzIHNldCwgdGhlIG5ldyB2YWx1ZSBpc1xuICogYWxzbyBjb252ZXJ0ZWQgdG8gYmVjb21lIHJlYWN0aXZlLiBIb3dldmVyIGluIGNlcnRhaW4gY2FzZXMsIGUuZy5cbiAqIHYtZm9yIHNjb3BlIGFsaWFzIGFuZCBwcm9wcywgd2UgZG9uJ3Qgd2FudCB0byBmb3JjZSBjb252ZXJzaW9uXG4gKiBiZWNhdXNlIHRoZSB2YWx1ZSBtYXkgYmUgYSBuZXN0ZWQgdmFsdWUgdW5kZXIgYSBmcm96ZW4gZGF0YSBzdHJ1Y3R1cmUuXG4gKlxuICogU28gd2hlbmV2ZXIgd2Ugd2FudCB0byBzZXQgYSByZWFjdGl2ZSBwcm9wZXJ0eSB3aXRob3V0IGZvcmNpbmdcbiAqIGNvbnZlcnNpb24gb24gdGhlIG5ldyB2YWx1ZSwgd2Ugd3JhcCB0aGF0IGNhbGwgaW5zaWRlIHRoaXMgZnVuY3Rpb24uXG4gKi9cblxudmFyIHNob3VsZENvbnZlcnQgPSB0cnVlO1xuXG5mdW5jdGlvbiB3aXRob3V0Q29udmVyc2lvbihmbikge1xuICBzaG91bGRDb252ZXJ0ID0gZmFsc2U7XG4gIGZuKCk7XG4gIHNob3VsZENvbnZlcnQgPSB0cnVlO1xufVxuXG4vKipcbiAqIE9ic2VydmVyIGNsYXNzIHRoYXQgYXJlIGF0dGFjaGVkIHRvIGVhY2ggb2JzZXJ2ZWRcbiAqIG9iamVjdC4gT25jZSBhdHRhY2hlZCwgdGhlIG9ic2VydmVyIGNvbnZlcnRzIHRhcmdldFxuICogb2JqZWN0J3MgcHJvcGVydHkga2V5cyBpbnRvIGdldHRlci9zZXR0ZXJzIHRoYXRcbiAqIGNvbGxlY3QgZGVwZW5kZW5jaWVzIGFuZCBkaXNwYXRjaGVzIHVwZGF0ZXMuXG4gKlxuICogQHBhcmFtIHtBcnJheXxPYmplY3R9IHZhbHVlXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuXG5mdW5jdGlvbiBPYnNlcnZlcih2YWx1ZSkge1xuICB0aGlzLnZhbHVlID0gdmFsdWU7XG4gIHRoaXMuZGVwID0gbmV3IERlcCgpO1xuICBkZWYodmFsdWUsICdfX29iX18nLCB0aGlzKTtcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgdmFyIGF1Z21lbnQgPSBoYXNQcm90byA/IHByb3RvQXVnbWVudCA6IGNvcHlBdWdtZW50O1xuICAgIGF1Z21lbnQodmFsdWUsIGFycmF5TWV0aG9kcywgYXJyYXlLZXlzKTtcbiAgICB0aGlzLm9ic2VydmVBcnJheSh2YWx1ZSk7XG4gIH0gZWxzZSB7XG4gICAgdGhpcy53YWxrKHZhbHVlKTtcbiAgfVxufVxuXG4vLyBJbnN0YW5jZSBtZXRob2RzXG5cbi8qKlxuICogV2FsayB0aHJvdWdoIGVhY2ggcHJvcGVydHkgYW5kIGNvbnZlcnQgdGhlbSBpbnRvXG4gKiBnZXR0ZXIvc2V0dGVycy4gVGhpcyBtZXRob2Qgc2hvdWxkIG9ubHkgYmUgY2FsbGVkIHdoZW5cbiAqIHZhbHVlIHR5cGUgaXMgT2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqL1xuXG5PYnNlcnZlci5wcm90b3R5cGUud2FsayA9IGZ1bmN0aW9uIChvYmopIHtcbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyhvYmopO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IGtleXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdGhpcy5jb252ZXJ0KGtleXNbaV0sIG9ialtrZXlzW2ldXSk7XG4gIH1cbn07XG5cbi8qKlxuICogT2JzZXJ2ZSBhIGxpc3Qgb2YgQXJyYXkgaXRlbXMuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gaXRlbXNcbiAqL1xuXG5PYnNlcnZlci5wcm90b3R5cGUub2JzZXJ2ZUFycmF5ID0gZnVuY3Rpb24gKGl0ZW1zKSB7XG4gIGZvciAodmFyIGkgPSAwLCBsID0gaXRlbXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgb2JzZXJ2ZShpdGVtc1tpXSk7XG4gIH1cbn07XG5cbi8qKlxuICogQ29udmVydCBhIHByb3BlcnR5IGludG8gZ2V0dGVyL3NldHRlciBzbyB3ZSBjYW4gZW1pdFxuICogdGhlIGV2ZW50cyB3aGVuIHRoZSBwcm9wZXJ0eSBpcyBhY2Nlc3NlZC9jaGFuZ2VkLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKi9cblxuT2JzZXJ2ZXIucHJvdG90eXBlLmNvbnZlcnQgPSBmdW5jdGlvbiAoa2V5LCB2YWwpIHtcbiAgZGVmaW5lUmVhY3RpdmUodGhpcy52YWx1ZSwga2V5LCB2YWwpO1xufTtcblxuLyoqXG4gKiBBZGQgYW4gb3duZXIgdm0sIHNvIHRoYXQgd2hlbiAkc2V0LyRkZWxldGUgbXV0YXRpb25zXG4gKiBoYXBwZW4gd2UgY2FuIG5vdGlmeSBvd25lciB2bXMgdG8gcHJveHkgdGhlIGtleXMgYW5kXG4gKiBkaWdlc3QgdGhlIHdhdGNoZXJzLiBUaGlzIGlzIG9ubHkgY2FsbGVkIHdoZW4gdGhlIG9iamVjdFxuICogaXMgb2JzZXJ2ZWQgYXMgYW4gaW5zdGFuY2UncyByb290ICRkYXRhLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICovXG5cbk9ic2VydmVyLnByb3RvdHlwZS5hZGRWbSA9IGZ1bmN0aW9uICh2bSkge1xuICAodGhpcy52bXMgfHwgKHRoaXMudm1zID0gW10pKS5wdXNoKHZtKTtcbn07XG5cbi8qKlxuICogUmVtb3ZlIGFuIG93bmVyIHZtLiBUaGlzIGlzIGNhbGxlZCB3aGVuIHRoZSBvYmplY3QgaXNcbiAqIHN3YXBwZWQgb3V0IGFzIGFuIGluc3RhbmNlJ3MgJGRhdGEgb2JqZWN0LlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICovXG5cbk9ic2VydmVyLnByb3RvdHlwZS5yZW1vdmVWbSA9IGZ1bmN0aW9uICh2bSkge1xuICB0aGlzLnZtcy4kcmVtb3ZlKHZtKTtcbn07XG5cbi8vIGhlbHBlcnNcblxuLyoqXG4gKiBBdWdtZW50IGFuIHRhcmdldCBPYmplY3Qgb3IgQXJyYXkgYnkgaW50ZXJjZXB0aW5nXG4gKiB0aGUgcHJvdG90eXBlIGNoYWluIHVzaW5nIF9fcHJvdG9fX1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fEFycmF5fSB0YXJnZXRcbiAqIEBwYXJhbSB7T2JqZWN0fSBzcmNcbiAqL1xuXG5mdW5jdGlvbiBwcm90b0F1Z21lbnQodGFyZ2V0LCBzcmMpIHtcbiAgLyogZXNsaW50LWRpc2FibGUgbm8tcHJvdG8gKi9cbiAgdGFyZ2V0Ll9fcHJvdG9fXyA9IHNyYztcbiAgLyogZXNsaW50LWVuYWJsZSBuby1wcm90byAqL1xufVxuXG4vKipcbiAqIEF1Z21lbnQgYW4gdGFyZ2V0IE9iamVjdCBvciBBcnJheSBieSBkZWZpbmluZ1xuICogaGlkZGVuIHByb3BlcnRpZXMuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXl9IHRhcmdldFxuICogQHBhcmFtIHtPYmplY3R9IHByb3RvXG4gKi9cblxuZnVuY3Rpb24gY29weUF1Z21lbnQodGFyZ2V0LCBzcmMsIGtleXMpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBrZXlzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIHZhciBrZXkgPSBrZXlzW2ldO1xuICAgIGRlZih0YXJnZXQsIGtleSwgc3JjW2tleV0pO1xuICB9XG59XG5cbi8qKlxuICogQXR0ZW1wdCB0byBjcmVhdGUgYW4gb2JzZXJ2ZXIgaW5zdGFuY2UgZm9yIGEgdmFsdWUsXG4gKiByZXR1cm5zIHRoZSBuZXcgb2JzZXJ2ZXIgaWYgc3VjY2Vzc2Z1bGx5IG9ic2VydmVkLFxuICogb3IgdGhlIGV4aXN0aW5nIG9ic2VydmVyIGlmIHRoZSB2YWx1ZSBhbHJlYWR5IGhhcyBvbmUuXG4gKlxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHBhcmFtIHtWdWV9IFt2bV1cbiAqIEByZXR1cm4ge09ic2VydmVyfHVuZGVmaW5lZH1cbiAqIEBzdGF0aWNcbiAqL1xuXG5mdW5jdGlvbiBvYnNlcnZlKHZhbHVlLCB2bSkge1xuICBpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIG9iO1xuICBpZiAoaGFzT3duKHZhbHVlLCAnX19vYl9fJykgJiYgdmFsdWUuX19vYl9fIGluc3RhbmNlb2YgT2JzZXJ2ZXIpIHtcbiAgICBvYiA9IHZhbHVlLl9fb2JfXztcbiAgfSBlbHNlIGlmIChzaG91bGRDb252ZXJ0ICYmIChpc0FycmF5KHZhbHVlKSB8fCBpc1BsYWluT2JqZWN0KHZhbHVlKSkgJiYgT2JqZWN0LmlzRXh0ZW5zaWJsZSh2YWx1ZSkgJiYgIXZhbHVlLl9pc1Z1ZSkge1xuICAgIG9iID0gbmV3IE9ic2VydmVyKHZhbHVlKTtcbiAgfVxuICBpZiAob2IgJiYgdm0pIHtcbiAgICBvYi5hZGRWbSh2bSk7XG4gIH1cbiAgcmV0dXJuIG9iO1xufVxuXG4vKipcbiAqIERlZmluZSBhIHJlYWN0aXZlIHByb3BlcnR5IG9uIGFuIE9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gKiBAcGFyYW0geyp9IHZhbFxuICovXG5cbmZ1bmN0aW9uIGRlZmluZVJlYWN0aXZlKG9iaiwga2V5LCB2YWwpIHtcbiAgdmFyIGRlcCA9IG5ldyBEZXAoKTtcblxuICB2YXIgcHJvcGVydHkgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlEZXNjcmlwdG9yKG9iaiwga2V5KTtcbiAgaWYgKHByb3BlcnR5ICYmIHByb3BlcnR5LmNvbmZpZ3VyYWJsZSA9PT0gZmFsc2UpIHtcbiAgICByZXR1cm47XG4gIH1cblxuICAvLyBjYXRlciBmb3IgcHJlLWRlZmluZWQgZ2V0dGVyL3NldHRlcnNcbiAgdmFyIGdldHRlciA9IHByb3BlcnR5ICYmIHByb3BlcnR5LmdldDtcbiAgdmFyIHNldHRlciA9IHByb3BlcnR5ICYmIHByb3BlcnR5LnNldDtcblxuICB2YXIgY2hpbGRPYiA9IG9ic2VydmUodmFsKTtcbiAgT2JqZWN0LmRlZmluZVByb3BlcnR5KG9iaiwga2V5LCB7XG4gICAgZW51bWVyYWJsZTogdHJ1ZSxcbiAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgZ2V0OiBmdW5jdGlvbiByZWFjdGl2ZUdldHRlcigpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGdldHRlciA/IGdldHRlci5jYWxsKG9iaikgOiB2YWw7XG4gICAgICBpZiAoRGVwLnRhcmdldCkge1xuICAgICAgICBkZXAuZGVwZW5kKCk7XG4gICAgICAgIGlmIChjaGlsZE9iKSB7XG4gICAgICAgICAgY2hpbGRPYi5kZXAuZGVwZW5kKCk7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgICAgICAgZm9yICh2YXIgZSwgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgICAgICAgIGUgPSB2YWx1ZVtpXTtcbiAgICAgICAgICAgIGUgJiYgZS5fX29iX18gJiYgZS5fX29iX18uZGVwLmRlcGVuZCgpO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH0sXG4gICAgc2V0OiBmdW5jdGlvbiByZWFjdGl2ZVNldHRlcihuZXdWYWwpIHtcbiAgICAgIHZhciB2YWx1ZSA9IGdldHRlciA/IGdldHRlci5jYWxsKG9iaikgOiB2YWw7XG4gICAgICBpZiAobmV3VmFsID09PSB2YWx1ZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpZiAoc2V0dGVyKSB7XG4gICAgICAgIHNldHRlci5jYWxsKG9iaiwgbmV3VmFsKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHZhbCA9IG5ld1ZhbDtcbiAgICAgIH1cbiAgICAgIGNoaWxkT2IgPSBvYnNlcnZlKG5ld1ZhbCk7XG4gICAgICBkZXAubm90aWZ5KCk7XG4gICAgfVxuICB9KTtcbn1cblxuXG5cbnZhciB1dGlsID0gT2JqZWN0LmZyZWV6ZSh7XG5cdGRlZmluZVJlYWN0aXZlOiBkZWZpbmVSZWFjdGl2ZSxcblx0c2V0OiBzZXQsXG5cdGRlbDogZGVsLFxuXHRoYXNPd246IGhhc093bixcblx0aXNMaXRlcmFsOiBpc0xpdGVyYWwsXG5cdGlzUmVzZXJ2ZWQ6IGlzUmVzZXJ2ZWQsXG5cdF90b1N0cmluZzogX3RvU3RyaW5nLFxuXHR0b051bWJlcjogdG9OdW1iZXIsXG5cdHRvQm9vbGVhbjogdG9Cb29sZWFuLFxuXHRzdHJpcFF1b3Rlczogc3RyaXBRdW90ZXMsXG5cdGNhbWVsaXplOiBjYW1lbGl6ZSxcblx0aHlwaGVuYXRlOiBoeXBoZW5hdGUsXG5cdGNsYXNzaWZ5OiBjbGFzc2lmeSxcblx0YmluZDogYmluZCxcblx0dG9BcnJheTogdG9BcnJheSxcblx0ZXh0ZW5kOiBleHRlbmQsXG5cdGlzT2JqZWN0OiBpc09iamVjdCxcblx0aXNQbGFpbk9iamVjdDogaXNQbGFpbk9iamVjdCxcblx0ZGVmOiBkZWYsXG5cdGRlYm91bmNlOiBfZGVib3VuY2UsXG5cdGluZGV4T2Y6IGluZGV4T2YsXG5cdGNhbmNlbGxhYmxlOiBjYW5jZWxsYWJsZSxcblx0bG9vc2VFcXVhbDogbG9vc2VFcXVhbCxcblx0aXNBcnJheTogaXNBcnJheSxcblx0aGFzUHJvdG86IGhhc1Byb3RvLFxuXHRpbkJyb3dzZXI6IGluQnJvd3Nlcixcblx0ZGV2dG9vbHM6IGRldnRvb2xzLFxuXHRpc0lFOTogaXNJRTksXG5cdGlzQW5kcm9pZDogaXNBbmRyb2lkLFxuXHRpc0lvczogaXNJb3MsXG5cdGlzV2VjaGF0OiBpc1dlY2hhdCxcblx0Z2V0IHRyYW5zaXRpb25Qcm9wICgpIHsgcmV0dXJuIHRyYW5zaXRpb25Qcm9wOyB9LFxuXHRnZXQgdHJhbnNpdGlvbkVuZEV2ZW50ICgpIHsgcmV0dXJuIHRyYW5zaXRpb25FbmRFdmVudDsgfSxcblx0Z2V0IGFuaW1hdGlvblByb3AgKCkgeyByZXR1cm4gYW5pbWF0aW9uUHJvcDsgfSxcblx0Z2V0IGFuaW1hdGlvbkVuZEV2ZW50ICgpIHsgcmV0dXJuIGFuaW1hdGlvbkVuZEV2ZW50OyB9LFxuXHRuZXh0VGljazogbmV4dFRpY2ssXG5cdGdldCBfU2V0ICgpIHsgcmV0dXJuIF9TZXQ7IH0sXG5cdHF1ZXJ5OiBxdWVyeSxcblx0aW5Eb2M6IGluRG9jLFxuXHRnZXRBdHRyOiBnZXRBdHRyLFxuXHRnZXRCaW5kQXR0cjogZ2V0QmluZEF0dHIsXG5cdGhhc0JpbmRBdHRyOiBoYXNCaW5kQXR0cixcblx0YmVmb3JlOiBiZWZvcmUsXG5cdGFmdGVyOiBhZnRlcixcblx0cmVtb3ZlOiByZW1vdmUsXG5cdHByZXBlbmQ6IHByZXBlbmQsXG5cdHJlcGxhY2U6IHJlcGxhY2UsXG5cdG9uOiBvbixcblx0b2ZmOiBvZmYsXG5cdHNldENsYXNzOiBzZXRDbGFzcyxcblx0YWRkQ2xhc3M6IGFkZENsYXNzLFxuXHRyZW1vdmVDbGFzczogcmVtb3ZlQ2xhc3MsXG5cdGV4dHJhY3RDb250ZW50OiBleHRyYWN0Q29udGVudCxcblx0dHJpbU5vZGU6IHRyaW1Ob2RlLFxuXHRpc1RlbXBsYXRlOiBpc1RlbXBsYXRlLFxuXHRjcmVhdGVBbmNob3I6IGNyZWF0ZUFuY2hvcixcblx0ZmluZFJlZjogZmluZFJlZixcblx0bWFwTm9kZVJhbmdlOiBtYXBOb2RlUmFuZ2UsXG5cdHJlbW92ZU5vZGVSYW5nZTogcmVtb3ZlTm9kZVJhbmdlLFxuXHRpc0ZyYWdtZW50OiBpc0ZyYWdtZW50LFxuXHRnZXRPdXRlckhUTUw6IGdldE91dGVySFRNTCxcblx0bWVyZ2VPcHRpb25zOiBtZXJnZU9wdGlvbnMsXG5cdHJlc29sdmVBc3NldDogcmVzb2x2ZUFzc2V0LFxuXHRjaGVja0NvbXBvbmVudEF0dHI6IGNoZWNrQ29tcG9uZW50QXR0cixcblx0Y29tbW9uVGFnUkU6IGNvbW1vblRhZ1JFLFxuXHRyZXNlcnZlZFRhZ1JFOiByZXNlcnZlZFRhZ1JFLFxuXHRnZXQgd2FybiAoKSB7IHJldHVybiB3YXJuOyB9XG59KTtcblxudmFyIHVpZCA9IDA7XG5cbmZ1bmN0aW9uIGluaXRNaXhpbiAoVnVlKSB7XG4gIC8qKlxuICAgKiBUaGUgbWFpbiBpbml0IHNlcXVlbmNlLiBUaGlzIGlzIGNhbGxlZCBmb3IgZXZlcnlcbiAgICogaW5zdGFuY2UsIGluY2x1ZGluZyBvbmVzIHRoYXQgYXJlIGNyZWF0ZWQgZnJvbSBleHRlbmRlZFxuICAgKiBjb25zdHJ1Y3RvcnMuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zIC0gdGhpcyBvcHRpb25zIG9iamVjdCBzaG91bGQgYmVcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgcmVzdWx0IG9mIG1lcmdpbmcgY2xhc3NcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBvcHRpb25zIGFuZCB0aGUgb3B0aW9ucyBwYXNzZWRcbiAgICogICAgICAgICAgICAgICAgICAgICAgICAgICBpbiB0byB0aGUgY29uc3RydWN0b3IuXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2luaXQgPSBmdW5jdGlvbiAob3B0aW9ucykge1xuICAgIG9wdGlvbnMgPSBvcHRpb25zIHx8IHt9O1xuXG4gICAgdGhpcy4kZWwgPSBudWxsO1xuICAgIHRoaXMuJHBhcmVudCA9IG9wdGlvbnMucGFyZW50O1xuICAgIHRoaXMuJHJvb3QgPSB0aGlzLiRwYXJlbnQgPyB0aGlzLiRwYXJlbnQuJHJvb3QgOiB0aGlzO1xuICAgIHRoaXMuJGNoaWxkcmVuID0gW107XG4gICAgdGhpcy4kcmVmcyA9IHt9OyAvLyBjaGlsZCB2bSByZWZlcmVuY2VzXG4gICAgdGhpcy4kZWxzID0ge307IC8vIGVsZW1lbnQgcmVmZXJlbmNlc1xuICAgIHRoaXMuX3dhdGNoZXJzID0gW107IC8vIGFsbCB3YXRjaGVycyBhcyBhbiBhcnJheVxuICAgIHRoaXMuX2RpcmVjdGl2ZXMgPSBbXTsgLy8gYWxsIGRpcmVjdGl2ZXNcblxuICAgIC8vIGEgdWlkXG4gICAgdGhpcy5fdWlkID0gdWlkKys7XG5cbiAgICAvLyBhIGZsYWcgdG8gYXZvaWQgdGhpcyBiZWluZyBvYnNlcnZlZFxuICAgIHRoaXMuX2lzVnVlID0gdHJ1ZTtcblxuICAgIC8vIGV2ZW50cyBib29ra2VlcGluZ1xuICAgIHRoaXMuX2V2ZW50cyA9IHt9OyAvLyByZWdpc3RlcmVkIGNhbGxiYWNrc1xuICAgIHRoaXMuX2V2ZW50c0NvdW50ID0ge307IC8vIGZvciAkYnJvYWRjYXN0IG9wdGltaXphdGlvblxuXG4gICAgLy8gZnJhZ21lbnQgaW5zdGFuY2UgcHJvcGVydGllc1xuICAgIHRoaXMuX2lzRnJhZ21lbnQgPSBmYWxzZTtcbiAgICB0aGlzLl9mcmFnbWVudCA9IC8vIEB0eXBlIHtEb2N1bWVudEZyYWdtZW50fVxuICAgIHRoaXMuX2ZyYWdtZW50U3RhcnQgPSAvLyBAdHlwZSB7VGV4dHxDb21tZW50fVxuICAgIHRoaXMuX2ZyYWdtZW50RW5kID0gbnVsbDsgLy8gQHR5cGUge1RleHR8Q29tbWVudH1cblxuICAgIC8vIGxpZmVjeWNsZSBzdGF0ZVxuICAgIHRoaXMuX2lzQ29tcGlsZWQgPSB0aGlzLl9pc0Rlc3Ryb3llZCA9IHRoaXMuX2lzUmVhZHkgPSB0aGlzLl9pc0F0dGFjaGVkID0gdGhpcy5faXNCZWluZ0Rlc3Ryb3llZCA9IHRoaXMuX3ZGb3JSZW1vdmluZyA9IGZhbHNlO1xuICAgIHRoaXMuX3VubGlua0ZuID0gbnVsbDtcblxuICAgIC8vIGNvbnRleHQ6XG4gICAgLy8gaWYgdGhpcyBpcyBhIHRyYW5zY2x1ZGVkIGNvbXBvbmVudCwgY29udGV4dFxuICAgIC8vIHdpbGwgYmUgdGhlIGNvbW1vbiBwYXJlbnQgdm0gb2YgdGhpcyBpbnN0YW5jZVxuICAgIC8vIGFuZCBpdHMgaG9zdC5cbiAgICB0aGlzLl9jb250ZXh0ID0gb3B0aW9ucy5fY29udGV4dCB8fCB0aGlzLiRwYXJlbnQ7XG5cbiAgICAvLyBzY29wZTpcbiAgICAvLyBpZiB0aGlzIGlzIGluc2lkZSBhbiBpbmxpbmUgdi1mb3IsIHRoZSBzY29wZVxuICAgIC8vIHdpbGwgYmUgdGhlIGludGVybWVkaWF0ZSBzY29wZSBjcmVhdGVkIGZvciB0aGlzXG4gICAgLy8gcmVwZWF0IGZyYWdtZW50LiB0aGlzIGlzIHVzZWQgZm9yIGxpbmtpbmcgcHJvcHNcbiAgICAvLyBhbmQgY29udGFpbmVyIGRpcmVjdGl2ZXMuXG4gICAgdGhpcy5fc2NvcGUgPSBvcHRpb25zLl9zY29wZTtcblxuICAgIC8vIGZyYWdtZW50OlxuICAgIC8vIGlmIHRoaXMgaW5zdGFuY2UgaXMgY29tcGlsZWQgaW5zaWRlIGEgRnJhZ21lbnQsIGl0XG4gICAgLy8gbmVlZHMgdG8gcmVpZ3N0ZXIgaXRzZWxmIGFzIGEgY2hpbGQgb2YgdGhhdCBmcmFnbWVudFxuICAgIC8vIGZvciBhdHRhY2gvZGV0YWNoIHRvIHdvcmsgcHJvcGVybHkuXG4gICAgdGhpcy5fZnJhZyA9IG9wdGlvbnMuX2ZyYWc7XG4gICAgaWYgKHRoaXMuX2ZyYWcpIHtcbiAgICAgIHRoaXMuX2ZyYWcuY2hpbGRyZW4ucHVzaCh0aGlzKTtcbiAgICB9XG5cbiAgICAvLyBwdXNoIHNlbGYgaW50byBwYXJlbnQgLyB0cmFuc2NsdXNpb24gaG9zdFxuICAgIGlmICh0aGlzLiRwYXJlbnQpIHtcbiAgICAgIHRoaXMuJHBhcmVudC4kY2hpbGRyZW4ucHVzaCh0aGlzKTtcbiAgICB9XG5cbiAgICAvLyBtZXJnZSBvcHRpb25zLlxuICAgIG9wdGlvbnMgPSB0aGlzLiRvcHRpb25zID0gbWVyZ2VPcHRpb25zKHRoaXMuY29uc3RydWN0b3Iub3B0aW9ucywgb3B0aW9ucywgdGhpcyk7XG5cbiAgICAvLyBzZXQgcmVmXG4gICAgdGhpcy5fdXBkYXRlUmVmKCk7XG5cbiAgICAvLyBpbml0aWFsaXplIGRhdGEgYXMgZW1wdHkgb2JqZWN0LlxuICAgIC8vIGl0IHdpbGwgYmUgZmlsbGVkIHVwIGluIF9pbml0RGF0YSgpLlxuICAgIHRoaXMuX2RhdGEgPSB7fTtcblxuICAgIC8vIGNhbGwgaW5pdCBob29rXG4gICAgdGhpcy5fY2FsbEhvb2soJ2luaXQnKTtcblxuICAgIC8vIGluaXRpYWxpemUgZGF0YSBvYnNlcnZhdGlvbiBhbmQgc2NvcGUgaW5oZXJpdGFuY2UuXG4gICAgdGhpcy5faW5pdFN0YXRlKCk7XG5cbiAgICAvLyBzZXR1cCBldmVudCBzeXN0ZW0gYW5kIG9wdGlvbiBldmVudHMuXG4gICAgdGhpcy5faW5pdEV2ZW50cygpO1xuXG4gICAgLy8gY2FsbCBjcmVhdGVkIGhvb2tcbiAgICB0aGlzLl9jYWxsSG9vaygnY3JlYXRlZCcpO1xuXG4gICAgLy8gaWYgYGVsYCBvcHRpb24gaXMgcGFzc2VkLCBzdGFydCBjb21waWxhdGlvbi5cbiAgICBpZiAob3B0aW9ucy5lbCkge1xuICAgICAgdGhpcy4kbW91bnQob3B0aW9ucy5lbCk7XG4gICAgfVxuICB9O1xufVxuXG52YXIgcGF0aENhY2hlID0gbmV3IENhY2hlKDEwMDApO1xuXG4vLyBhY3Rpb25zXG52YXIgQVBQRU5EID0gMDtcbnZhciBQVVNIID0gMTtcbnZhciBJTkNfU1VCX1BBVEhfREVQVEggPSAyO1xudmFyIFBVU0hfU1VCX1BBVEggPSAzO1xuXG4vLyBzdGF0ZXNcbnZhciBCRUZPUkVfUEFUSCA9IDA7XG52YXIgSU5fUEFUSCA9IDE7XG52YXIgQkVGT1JFX0lERU5UID0gMjtcbnZhciBJTl9JREVOVCA9IDM7XG52YXIgSU5fU1VCX1BBVEggPSA0O1xudmFyIElOX1NJTkdMRV9RVU9URSA9IDU7XG52YXIgSU5fRE9VQkxFX1FVT1RFID0gNjtcbnZhciBBRlRFUl9QQVRIID0gNztcbnZhciBFUlJPUiA9IDg7XG5cbnZhciBwYXRoU3RhdGVNYWNoaW5lID0gW107XG5cbnBhdGhTdGF0ZU1hY2hpbmVbQkVGT1JFX1BBVEhdID0ge1xuICAnd3MnOiBbQkVGT1JFX1BBVEhdLFxuICAnaWRlbnQnOiBbSU5fSURFTlQsIEFQUEVORF0sXG4gICdbJzogW0lOX1NVQl9QQVRIXSxcbiAgJ2VvZic6IFtBRlRFUl9QQVRIXVxufTtcblxucGF0aFN0YXRlTWFjaGluZVtJTl9QQVRIXSA9IHtcbiAgJ3dzJzogW0lOX1BBVEhdLFxuICAnLic6IFtCRUZPUkVfSURFTlRdLFxuICAnWyc6IFtJTl9TVUJfUEFUSF0sXG4gICdlb2YnOiBbQUZURVJfUEFUSF1cbn07XG5cbnBhdGhTdGF0ZU1hY2hpbmVbQkVGT1JFX0lERU5UXSA9IHtcbiAgJ3dzJzogW0JFRk9SRV9JREVOVF0sXG4gICdpZGVudCc6IFtJTl9JREVOVCwgQVBQRU5EXVxufTtcblxucGF0aFN0YXRlTWFjaGluZVtJTl9JREVOVF0gPSB7XG4gICdpZGVudCc6IFtJTl9JREVOVCwgQVBQRU5EXSxcbiAgJzAnOiBbSU5fSURFTlQsIEFQUEVORF0sXG4gICdudW1iZXInOiBbSU5fSURFTlQsIEFQUEVORF0sXG4gICd3cyc6IFtJTl9QQVRILCBQVVNIXSxcbiAgJy4nOiBbQkVGT1JFX0lERU5ULCBQVVNIXSxcbiAgJ1snOiBbSU5fU1VCX1BBVEgsIFBVU0hdLFxuICAnZW9mJzogW0FGVEVSX1BBVEgsIFBVU0hdXG59O1xuXG5wYXRoU3RhdGVNYWNoaW5lW0lOX1NVQl9QQVRIXSA9IHtcbiAgXCInXCI6IFtJTl9TSU5HTEVfUVVPVEUsIEFQUEVORF0sXG4gICdcIic6IFtJTl9ET1VCTEVfUVVPVEUsIEFQUEVORF0sXG4gICdbJzogW0lOX1NVQl9QQVRILCBJTkNfU1VCX1BBVEhfREVQVEhdLFxuICAnXSc6IFtJTl9QQVRILCBQVVNIX1NVQl9QQVRIXSxcbiAgJ2VvZic6IEVSUk9SLFxuICAnZWxzZSc6IFtJTl9TVUJfUEFUSCwgQVBQRU5EXVxufTtcblxucGF0aFN0YXRlTWFjaGluZVtJTl9TSU5HTEVfUVVPVEVdID0ge1xuICBcIidcIjogW0lOX1NVQl9QQVRILCBBUFBFTkRdLFxuICAnZW9mJzogRVJST1IsXG4gICdlbHNlJzogW0lOX1NJTkdMRV9RVU9URSwgQVBQRU5EXVxufTtcblxucGF0aFN0YXRlTWFjaGluZVtJTl9ET1VCTEVfUVVPVEVdID0ge1xuICAnXCInOiBbSU5fU1VCX1BBVEgsIEFQUEVORF0sXG4gICdlb2YnOiBFUlJPUixcbiAgJ2Vsc2UnOiBbSU5fRE9VQkxFX1FVT1RFLCBBUFBFTkRdXG59O1xuXG4vKipcbiAqIERldGVybWluZSB0aGUgdHlwZSBvZiBhIGNoYXJhY3RlciBpbiBhIGtleXBhdGguXG4gKlxuICogQHBhcmFtIHtDaGFyfSBjaFxuICogQHJldHVybiB7U3RyaW5nfSB0eXBlXG4gKi9cblxuZnVuY3Rpb24gZ2V0UGF0aENoYXJUeXBlKGNoKSB7XG4gIGlmIChjaCA9PT0gdW5kZWZpbmVkKSB7XG4gICAgcmV0dXJuICdlb2YnO1xuICB9XG5cbiAgdmFyIGNvZGUgPSBjaC5jaGFyQ29kZUF0KDApO1xuXG4gIHN3aXRjaCAoY29kZSkge1xuICAgIGNhc2UgMHg1QjogLy8gW1xuICAgIGNhc2UgMHg1RDogLy8gXVxuICAgIGNhc2UgMHgyRTogLy8gLlxuICAgIGNhc2UgMHgyMjogLy8gXCJcbiAgICBjYXNlIDB4Mjc6IC8vICdcbiAgICBjYXNlIDB4MzA6XG4gICAgICAvLyAwXG4gICAgICByZXR1cm4gY2g7XG5cbiAgICBjYXNlIDB4NUY6IC8vIF9cbiAgICBjYXNlIDB4MjQ6XG4gICAgICAvLyAkXG4gICAgICByZXR1cm4gJ2lkZW50JztcblxuICAgIGNhc2UgMHgyMDogLy8gU3BhY2VcbiAgICBjYXNlIDB4MDk6IC8vIFRhYlxuICAgIGNhc2UgMHgwQTogLy8gTmV3bGluZVxuICAgIGNhc2UgMHgwRDogLy8gUmV0dXJuXG4gICAgY2FzZSAweEEwOiAvLyBOby1icmVhayBzcGFjZVxuICAgIGNhc2UgMHhGRUZGOiAvLyBCeXRlIE9yZGVyIE1hcmtcbiAgICBjYXNlIDB4MjAyODogLy8gTGluZSBTZXBhcmF0b3JcbiAgICBjYXNlIDB4MjAyOTpcbiAgICAgIC8vIFBhcmFncmFwaCBTZXBhcmF0b3JcbiAgICAgIHJldHVybiAnd3MnO1xuICB9XG5cbiAgLy8gYS16LCBBLVpcbiAgaWYgKGNvZGUgPj0gMHg2MSAmJiBjb2RlIDw9IDB4N0EgfHwgY29kZSA+PSAweDQxICYmIGNvZGUgPD0gMHg1QSkge1xuICAgIHJldHVybiAnaWRlbnQnO1xuICB9XG5cbiAgLy8gMS05XG4gIGlmIChjb2RlID49IDB4MzEgJiYgY29kZSA8PSAweDM5KSB7XG4gICAgcmV0dXJuICdudW1iZXInO1xuICB9XG5cbiAgcmV0dXJuICdlbHNlJztcbn1cblxuLyoqXG4gKiBGb3JtYXQgYSBzdWJQYXRoLCByZXR1cm4gaXRzIHBsYWluIGZvcm0gaWYgaXQgaXNcbiAqIGEgbGl0ZXJhbCBzdHJpbmcgb3IgbnVtYmVyLiBPdGhlcndpc2UgcHJlcGVuZCB0aGVcbiAqIGR5bmFtaWMgaW5kaWNhdG9yICgqKS5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcGF0aFxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmZ1bmN0aW9uIGZvcm1hdFN1YlBhdGgocGF0aCkge1xuICB2YXIgdHJpbW1lZCA9IHBhdGgudHJpbSgpO1xuICAvLyBpbnZhbGlkIGxlYWRpbmcgMFxuICBpZiAocGF0aC5jaGFyQXQoMCkgPT09ICcwJyAmJiBpc05hTihwYXRoKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICByZXR1cm4gaXNMaXRlcmFsKHRyaW1tZWQpID8gc3RyaXBRdW90ZXModHJpbW1lZCkgOiAnKicgKyB0cmltbWVkO1xufVxuXG4vKipcbiAqIFBhcnNlIGEgc3RyaW5nIHBhdGggaW50byBhbiBhcnJheSBvZiBzZWdtZW50c1xuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKiBAcmV0dXJuIHtBcnJheXx1bmRlZmluZWR9XG4gKi9cblxuZnVuY3Rpb24gcGFyc2UocGF0aCkge1xuICB2YXIga2V5cyA9IFtdO1xuICB2YXIgaW5kZXggPSAtMTtcbiAgdmFyIG1vZGUgPSBCRUZPUkVfUEFUSDtcbiAgdmFyIHN1YlBhdGhEZXB0aCA9IDA7XG4gIHZhciBjLCBuZXdDaGFyLCBrZXksIHR5cGUsIHRyYW5zaXRpb24sIGFjdGlvbiwgdHlwZU1hcDtcblxuICB2YXIgYWN0aW9ucyA9IFtdO1xuXG4gIGFjdGlvbnNbUFVTSF0gPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKGtleSAhPT0gdW5kZWZpbmVkKSB7XG4gICAgICBrZXlzLnB1c2goa2V5KTtcbiAgICAgIGtleSA9IHVuZGVmaW5lZDtcbiAgICB9XG4gIH07XG5cbiAgYWN0aW9uc1tBUFBFTkRdID0gZnVuY3Rpb24gKCkge1xuICAgIGlmIChrZXkgPT09IHVuZGVmaW5lZCkge1xuICAgICAga2V5ID0gbmV3Q2hhcjtcbiAgICB9IGVsc2Uge1xuICAgICAga2V5ICs9IG5ld0NoYXI7XG4gICAgfVxuICB9O1xuXG4gIGFjdGlvbnNbSU5DX1NVQl9QQVRIX0RFUFRIXSA9IGZ1bmN0aW9uICgpIHtcbiAgICBhY3Rpb25zW0FQUEVORF0oKTtcbiAgICBzdWJQYXRoRGVwdGgrKztcbiAgfTtcblxuICBhY3Rpb25zW1BVU0hfU1VCX1BBVEhdID0gZnVuY3Rpb24gKCkge1xuICAgIGlmIChzdWJQYXRoRGVwdGggPiAwKSB7XG4gICAgICBzdWJQYXRoRGVwdGgtLTtcbiAgICAgIG1vZGUgPSBJTl9TVUJfUEFUSDtcbiAgICAgIGFjdGlvbnNbQVBQRU5EXSgpO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdWJQYXRoRGVwdGggPSAwO1xuICAgICAga2V5ID0gZm9ybWF0U3ViUGF0aChrZXkpO1xuICAgICAgaWYgKGtleSA9PT0gZmFsc2UpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgYWN0aW9uc1tQVVNIXSgpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBmdW5jdGlvbiBtYXliZVVuZXNjYXBlUXVvdGUoKSB7XG4gICAgdmFyIG5leHRDaGFyID0gcGF0aFtpbmRleCArIDFdO1xuICAgIGlmIChtb2RlID09PSBJTl9TSU5HTEVfUVVPVEUgJiYgbmV4dENoYXIgPT09IFwiJ1wiIHx8IG1vZGUgPT09IElOX0RPVUJMRV9RVU9URSAmJiBuZXh0Q2hhciA9PT0gJ1wiJykge1xuICAgICAgaW5kZXgrKztcbiAgICAgIG5ld0NoYXIgPSAnXFxcXCcgKyBuZXh0Q2hhcjtcbiAgICAgIGFjdGlvbnNbQVBQRU5EXSgpO1xuICAgICAgcmV0dXJuIHRydWU7XG4gICAgfVxuICB9XG5cbiAgd2hpbGUgKG1vZGUgIT0gbnVsbCkge1xuICAgIGluZGV4Kys7XG4gICAgYyA9IHBhdGhbaW5kZXhdO1xuXG4gICAgaWYgKGMgPT09ICdcXFxcJyAmJiBtYXliZVVuZXNjYXBlUXVvdGUoKSkge1xuICAgICAgY29udGludWU7XG4gICAgfVxuXG4gICAgdHlwZSA9IGdldFBhdGhDaGFyVHlwZShjKTtcbiAgICB0eXBlTWFwID0gcGF0aFN0YXRlTWFjaGluZVttb2RlXTtcbiAgICB0cmFuc2l0aW9uID0gdHlwZU1hcFt0eXBlXSB8fCB0eXBlTWFwWydlbHNlJ10gfHwgRVJST1I7XG5cbiAgICBpZiAodHJhbnNpdGlvbiA9PT0gRVJST1IpIHtcbiAgICAgIHJldHVybjsgLy8gcGFyc2UgZXJyb3JcbiAgICB9XG5cbiAgICBtb2RlID0gdHJhbnNpdGlvblswXTtcbiAgICBhY3Rpb24gPSBhY3Rpb25zW3RyYW5zaXRpb25bMV1dO1xuICAgIGlmIChhY3Rpb24pIHtcbiAgICAgIG5ld0NoYXIgPSB0cmFuc2l0aW9uWzJdO1xuICAgICAgbmV3Q2hhciA9IG5ld0NoYXIgPT09IHVuZGVmaW5lZCA/IGMgOiBuZXdDaGFyO1xuICAgICAgaWYgKGFjdGlvbigpID09PSBmYWxzZSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKG1vZGUgPT09IEFGVEVSX1BBVEgpIHtcbiAgICAgIGtleXMucmF3ID0gcGF0aDtcbiAgICAgIHJldHVybiBrZXlzO1xuICAgIH1cbiAgfVxufVxuXG4vKipcbiAqIEV4dGVybmFsIHBhcnNlIHRoYXQgY2hlY2sgZm9yIGEgY2FjaGUgaGl0IGZpcnN0XG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHBhdGhcbiAqIEByZXR1cm4ge0FycmF5fHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBwYXJzZVBhdGgocGF0aCkge1xuICB2YXIgaGl0ID0gcGF0aENhY2hlLmdldChwYXRoKTtcbiAgaWYgKCFoaXQpIHtcbiAgICBoaXQgPSBwYXJzZShwYXRoKTtcbiAgICBpZiAoaGl0KSB7XG4gICAgICBwYXRoQ2FjaGUucHV0KHBhdGgsIGhpdCk7XG4gICAgfVxuICB9XG4gIHJldHVybiBoaXQ7XG59XG5cbi8qKlxuICogR2V0IGZyb20gYW4gb2JqZWN0IGZyb20gYSBwYXRoIHN0cmluZ1xuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwYXRoXG4gKi9cblxuZnVuY3Rpb24gZ2V0UGF0aChvYmosIHBhdGgpIHtcbiAgcmV0dXJuIHBhcnNlRXhwcmVzc2lvbihwYXRoKS5nZXQob2JqKTtcbn1cblxuLyoqXG4gKiBXYXJuIGFnYWluc3Qgc2V0dGluZyBub24tZXhpc3RlbnQgcm9vdCBwYXRoIG9uIGEgdm0uXG4gKi9cblxudmFyIHdhcm5Ob25FeGlzdGVudDtcbmlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gIHdhcm5Ob25FeGlzdGVudCA9IGZ1bmN0aW9uIChwYXRoLCB2bSkge1xuICAgIHdhcm4oJ1lvdSBhcmUgc2V0dGluZyBhIG5vbi1leGlzdGVudCBwYXRoIFwiJyArIHBhdGgucmF3ICsgJ1wiICcgKyAnb24gYSB2bSBpbnN0YW5jZS4gQ29uc2lkZXIgcHJlLWluaXRpYWxpemluZyB0aGUgcHJvcGVydHkgJyArICd3aXRoIHRoZSBcImRhdGFcIiBvcHRpb24gZm9yIG1vcmUgcmVsaWFibGUgcmVhY3Rpdml0eSAnICsgJ2FuZCBiZXR0ZXIgcGVyZm9ybWFuY2UuJywgdm0pO1xuICB9O1xufVxuXG4vKipcbiAqIFNldCBvbiBhbiBvYmplY3QgZnJvbSBhIHBhdGhcbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gb2JqXG4gKiBAcGFyYW0ge1N0cmluZyB8IEFycmF5fSBwYXRoXG4gKiBAcGFyYW0geyp9IHZhbFxuICovXG5cbmZ1bmN0aW9uIHNldFBhdGgob2JqLCBwYXRoLCB2YWwpIHtcbiAgdmFyIG9yaWdpbmFsID0gb2JqO1xuICBpZiAodHlwZW9mIHBhdGggPT09ICdzdHJpbmcnKSB7XG4gICAgcGF0aCA9IHBhcnNlKHBhdGgpO1xuICB9XG4gIGlmICghcGF0aCB8fCAhaXNPYmplY3Qob2JqKSkge1xuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgbGFzdCwga2V5O1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHBhdGgubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgbGFzdCA9IG9iajtcbiAgICBrZXkgPSBwYXRoW2ldO1xuICAgIGlmIChrZXkuY2hhckF0KDApID09PSAnKicpIHtcbiAgICAgIGtleSA9IHBhcnNlRXhwcmVzc2lvbihrZXkuc2xpY2UoMSkpLmdldC5jYWxsKG9yaWdpbmFsLCBvcmlnaW5hbCk7XG4gICAgfVxuICAgIGlmIChpIDwgbCAtIDEpIHtcbiAgICAgIG9iaiA9IG9ialtrZXldO1xuICAgICAgaWYgKCFpc09iamVjdChvYmopKSB7XG4gICAgICAgIG9iaiA9IHt9O1xuICAgICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBsYXN0Ll9pc1Z1ZSkge1xuICAgICAgICAgIHdhcm5Ob25FeGlzdGVudChwYXRoLCBsYXN0KTtcbiAgICAgICAgfVxuICAgICAgICBzZXQobGFzdCwga2V5LCBvYmopO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZiAoaXNBcnJheShvYmopKSB7XG4gICAgICAgIG9iai4kc2V0KGtleSwgdmFsKTtcbiAgICAgIH0gZWxzZSBpZiAoa2V5IGluIG9iaikge1xuICAgICAgICBvYmpba2V5XSA9IHZhbDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIG9iai5faXNWdWUpIHtcbiAgICAgICAgICB3YXJuTm9uRXhpc3RlbnQocGF0aCwgb2JqKTtcbiAgICAgICAgfVxuICAgICAgICBzZXQob2JqLCBrZXksIHZhbCk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufVxuXG52YXIgcGF0aCA9IE9iamVjdC5mcmVlemUoe1xuICBwYXJzZVBhdGg6IHBhcnNlUGF0aCxcbiAgZ2V0UGF0aDogZ2V0UGF0aCxcbiAgc2V0UGF0aDogc2V0UGF0aFxufSk7XG5cbnZhciBleHByZXNzaW9uQ2FjaGUgPSBuZXcgQ2FjaGUoMTAwMCk7XG5cbnZhciBhbGxvd2VkS2V5d29yZHMgPSAnTWF0aCxEYXRlLHRoaXMsdHJ1ZSxmYWxzZSxudWxsLHVuZGVmaW5lZCxJbmZpbml0eSxOYU4sJyArICdpc05hTixpc0Zpbml0ZSxkZWNvZGVVUkksZGVjb2RlVVJJQ29tcG9uZW50LGVuY29kZVVSSSwnICsgJ2VuY29kZVVSSUNvbXBvbmVudCxwYXJzZUludCxwYXJzZUZsb2F0JztcbnZhciBhbGxvd2VkS2V5d29yZHNSRSA9IG5ldyBSZWdFeHAoJ14oJyArIGFsbG93ZWRLZXl3b3Jkcy5yZXBsYWNlKC8sL2csICdcXFxcYnwnKSArICdcXFxcYiknKTtcblxuLy8ga2V5d29yZHMgdGhhdCBkb24ndCBtYWtlIHNlbnNlIGluc2lkZSBleHByZXNzaW9uc1xudmFyIGltcHJvcGVyS2V5d29yZHMgPSAnYnJlYWssY2FzZSxjbGFzcyxjYXRjaCxjb25zdCxjb250aW51ZSxkZWJ1Z2dlcixkZWZhdWx0LCcgKyAnZGVsZXRlLGRvLGVsc2UsZXhwb3J0LGV4dGVuZHMsZmluYWxseSxmb3IsZnVuY3Rpb24saWYsJyArICdpbXBvcnQsaW4saW5zdGFuY2VvZixsZXQscmV0dXJuLHN1cGVyLHN3aXRjaCx0aHJvdyx0cnksJyArICd2YXIsd2hpbGUsd2l0aCx5aWVsZCxlbnVtLGF3YWl0LGltcGxlbWVudHMscGFja2FnZSwnICsgJ3Byb3RlY3RlZCxzdGF0aWMsaW50ZXJmYWNlLHByaXZhdGUscHVibGljJztcbnZhciBpbXByb3BlcktleXdvcmRzUkUgPSBuZXcgUmVnRXhwKCdeKCcgKyBpbXByb3BlcktleXdvcmRzLnJlcGxhY2UoLywvZywgJ1xcXFxifCcpICsgJ1xcXFxiKScpO1xuXG52YXIgd3NSRSA9IC9cXHMvZztcbnZhciBuZXdsaW5lUkUgPSAvXFxuL2c7XG52YXIgc2F2ZVJFID0gL1tcXHssXVxccypbXFx3XFwkX10rXFxzKjp8KCcoPzpbXidcXFxcXXxcXFxcLikqJ3xcIig/OlteXCJcXFxcXXxcXFxcLikqXCJ8YCg/OlteYFxcXFxdfFxcXFwuKSpcXCRcXHt8XFx9KD86W15gXFxcXF18XFxcXC4pKmB8YCg/OlteYFxcXFxdfFxcXFwuKSpgKXxuZXcgfHR5cGVvZiB8dm9pZCAvZztcbnZhciByZXN0b3JlUkUgPSAvXCIoXFxkKylcIi9nO1xudmFyIHBhdGhUZXN0UkUgPSAvXltBLVphLXpfJF1bXFx3JF0qKD86XFwuW0EtWmEtel8kXVtcXHckXSp8XFxbJy4qPydcXF18XFxbXCIuKj9cIlxcXXxcXFtcXGQrXFxdfFxcW1tBLVphLXpfJF1bXFx3JF0qXFxdKSokLztcbnZhciBpZGVudFJFID0gL1teXFx3JFxcLl0oPzpbQS1aYS16XyRdW1xcdyRdKikvZztcbnZhciBib29sZWFuTGl0ZXJhbFJFID0gL14oPzp0cnVlfGZhbHNlKSQvO1xuXG4vKipcbiAqIFNhdmUgLyBSZXdyaXRlIC8gUmVzdG9yZVxuICpcbiAqIFdoZW4gcmV3cml0aW5nIHBhdGhzIGZvdW5kIGluIGFuIGV4cHJlc3Npb24sIGl0IGlzXG4gKiBwb3NzaWJsZSBmb3IgdGhlIHNhbWUgbGV0dGVyIHNlcXVlbmNlcyB0byBiZSBmb3VuZCBpblxuICogc3RyaW5ncyBhbmQgT2JqZWN0IGxpdGVyYWwgcHJvcGVydHkga2V5cy4gVGhlcmVmb3JlIHdlXG4gKiByZW1vdmUgYW5kIHN0b3JlIHRoZXNlIHBhcnRzIGluIGEgdGVtcG9yYXJ5IGFycmF5LCBhbmRcbiAqIHJlc3RvcmUgdGhlbSBhZnRlciB0aGUgcGF0aCByZXdyaXRlLlxuICovXG5cbnZhciBzYXZlZCA9IFtdO1xuXG4vKipcbiAqIFNhdmUgcmVwbGFjZXJcbiAqXG4gKiBUaGUgc2F2ZSByZWdleCBjYW4gbWF0Y2ggdHdvIHBvc3NpYmxlIGNhc2VzOlxuICogMS4gQW4gb3BlbmluZyBvYmplY3QgbGl0ZXJhbFxuICogMi4gQSBzdHJpbmdcbiAqIElmIG1hdGNoZWQgYXMgYSBwbGFpbiBzdHJpbmcsIHdlIG5lZWQgdG8gZXNjYXBlIGl0c1xuICogbmV3bGluZXMsIHNpbmNlIHRoZSBzdHJpbmcgbmVlZHMgdG8gYmUgcHJlc2VydmVkIHdoZW5cbiAqIGdlbmVyYXRpbmcgdGhlIGZ1bmN0aW9uIGJvZHkuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHN0clxuICogQHBhcmFtIHtTdHJpbmd9IGlzU3RyaW5nIC0gc3RyIGlmIG1hdGNoZWQgYXMgYSBzdHJpbmdcbiAqIEByZXR1cm4ge1N0cmluZ30gLSBwbGFjZWhvbGRlciB3aXRoIGluZGV4XG4gKi9cblxuZnVuY3Rpb24gc2F2ZShzdHIsIGlzU3RyaW5nKSB7XG4gIHZhciBpID0gc2F2ZWQubGVuZ3RoO1xuICBzYXZlZFtpXSA9IGlzU3RyaW5nID8gc3RyLnJlcGxhY2UobmV3bGluZVJFLCAnXFxcXG4nKSA6IHN0cjtcbiAgcmV0dXJuICdcIicgKyBpICsgJ1wiJztcbn1cblxuLyoqXG4gKiBQYXRoIHJld3JpdGUgcmVwbGFjZXJcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gcmF3XG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gcmV3cml0ZShyYXcpIHtcbiAgdmFyIGMgPSByYXcuY2hhckF0KDApO1xuICB2YXIgcGF0aCA9IHJhdy5zbGljZSgxKTtcbiAgaWYgKGFsbG93ZWRLZXl3b3Jkc1JFLnRlc3QocGF0aCkpIHtcbiAgICByZXR1cm4gcmF3O1xuICB9IGVsc2Uge1xuICAgIHBhdGggPSBwYXRoLmluZGV4T2YoJ1wiJykgPiAtMSA/IHBhdGgucmVwbGFjZShyZXN0b3JlUkUsIHJlc3RvcmUpIDogcGF0aDtcbiAgICByZXR1cm4gYyArICdzY29wZS4nICsgcGF0aDtcbiAgfVxufVxuXG4vKipcbiAqIFJlc3RvcmUgcmVwbGFjZXJcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcGFyYW0ge1N0cmluZ30gaSAtIG1hdGNoZWQgc2F2ZSBpbmRleFxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmZ1bmN0aW9uIHJlc3RvcmUoc3RyLCBpKSB7XG4gIHJldHVybiBzYXZlZFtpXTtcbn1cblxuLyoqXG4gKiBSZXdyaXRlIGFuIGV4cHJlc3Npb24sIHByZWZpeGluZyBhbGwgcGF0aCBhY2Nlc3NvcnMgd2l0aFxuICogYHNjb3BlLmAgYW5kIGdlbmVyYXRlIGdldHRlci9zZXR0ZXIgZnVuY3Rpb25zLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVHZXR0ZXIoZXhwKSB7XG4gIGlmIChpbXByb3BlcktleXdvcmRzUkUudGVzdChleHApKSB7XG4gICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdBdm9pZCB1c2luZyByZXNlcnZlZCBrZXl3b3JkcyBpbiBleHByZXNzaW9uOiAnICsgZXhwKTtcbiAgfVxuICAvLyByZXNldCBzdGF0ZVxuICBzYXZlZC5sZW5ndGggPSAwO1xuICAvLyBzYXZlIHN0cmluZ3MgYW5kIG9iamVjdCBsaXRlcmFsIGtleXNcbiAgdmFyIGJvZHkgPSBleHAucmVwbGFjZShzYXZlUkUsIHNhdmUpLnJlcGxhY2Uod3NSRSwgJycpO1xuICAvLyByZXdyaXRlIGFsbCBwYXRoc1xuICAvLyBwYWQgMSBzcGFjZSBoZXJlIGJlY2F1ZSB0aGUgcmVnZXggbWF0Y2hlcyAxIGV4dHJhIGNoYXJcbiAgYm9keSA9ICgnICcgKyBib2R5KS5yZXBsYWNlKGlkZW50UkUsIHJld3JpdGUpLnJlcGxhY2UocmVzdG9yZVJFLCByZXN0b3JlKTtcbiAgcmV0dXJuIG1ha2VHZXR0ZXJGbihib2R5KTtcbn1cblxuLyoqXG4gKiBCdWlsZCBhIGdldHRlciBmdW5jdGlvbi4gUmVxdWlyZXMgZXZhbC5cbiAqXG4gKiBXZSBpc29sYXRlIHRoZSB0cnkvY2F0Y2ggc28gaXQgZG9lc24ndCBhZmZlY3QgdGhlXG4gKiBvcHRpbWl6YXRpb24gb2YgdGhlIHBhcnNlIGZ1bmN0aW9uIHdoZW4gaXQgaXMgbm90IGNhbGxlZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gYm9keVxuICogQHJldHVybiB7RnVuY3Rpb258dW5kZWZpbmVkfVxuICovXG5cbmZ1bmN0aW9uIG1ha2VHZXR0ZXJGbihib2R5KSB7XG4gIHRyeSB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tbmV3LWZ1bmMgKi9cbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdzY29wZScsICdyZXR1cm4gJyArIGJvZHkgKyAnOycpO1xuICAgIC8qIGVzbGludC1lbmFibGUgbm8tbmV3LWZ1bmMgKi9cbiAgfSBjYXRjaCAoZSkge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignSW52YWxpZCBleHByZXNzaW9uLiAnICsgJ0dlbmVyYXRlZCBmdW5jdGlvbiBib2R5OiAnICsgYm9keSk7XG4gIH1cbn1cblxuLyoqXG4gKiBDb21waWxlIGEgc2V0dGVyIGZ1bmN0aW9uIGZvciB0aGUgZXhwcmVzc2lvbi5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXhwXG4gKiBAcmV0dXJuIHtGdW5jdGlvbnx1bmRlZmluZWR9XG4gKi9cblxuZnVuY3Rpb24gY29tcGlsZVNldHRlcihleHApIHtcbiAgdmFyIHBhdGggPSBwYXJzZVBhdGgoZXhwKTtcbiAgaWYgKHBhdGgpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24gKHNjb3BlLCB2YWwpIHtcbiAgICAgIHNldFBhdGgoc2NvcGUsIHBhdGgsIHZhbCk7XG4gICAgfTtcbiAgfSBlbHNlIHtcbiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0ludmFsaWQgc2V0dGVyIGV4cHJlc3Npb246ICcgKyBleHApO1xuICB9XG59XG5cbi8qKlxuICogUGFyc2UgYW4gZXhwcmVzc2lvbiBpbnRvIHJlLXdyaXR0ZW4gZ2V0dGVyL3NldHRlcnMuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV4cFxuICogQHBhcmFtIHtCb29sZWFufSBuZWVkU2V0XG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5mdW5jdGlvbiBwYXJzZUV4cHJlc3Npb24oZXhwLCBuZWVkU2V0KSB7XG4gIGV4cCA9IGV4cC50cmltKCk7XG4gIC8vIHRyeSBjYWNoZVxuICB2YXIgaGl0ID0gZXhwcmVzc2lvbkNhY2hlLmdldChleHApO1xuICBpZiAoaGl0KSB7XG4gICAgaWYgKG5lZWRTZXQgJiYgIWhpdC5zZXQpIHtcbiAgICAgIGhpdC5zZXQgPSBjb21waWxlU2V0dGVyKGhpdC5leHApO1xuICAgIH1cbiAgICByZXR1cm4gaGl0O1xuICB9XG4gIHZhciByZXMgPSB7IGV4cDogZXhwIH07XG4gIHJlcy5nZXQgPSBpc1NpbXBsZVBhdGgoZXhwKSAmJiBleHAuaW5kZXhPZignWycpIDwgMFxuICAvLyBvcHRpbWl6ZWQgc3VwZXIgc2ltcGxlIGdldHRlclxuICA/IG1ha2VHZXR0ZXJGbignc2NvcGUuJyArIGV4cClcbiAgLy8gZHluYW1pYyBnZXR0ZXJcbiAgOiBjb21waWxlR2V0dGVyKGV4cCk7XG4gIGlmIChuZWVkU2V0KSB7XG4gICAgcmVzLnNldCA9IGNvbXBpbGVTZXR0ZXIoZXhwKTtcbiAgfVxuICBleHByZXNzaW9uQ2FjaGUucHV0KGV4cCwgcmVzKTtcbiAgcmV0dXJuIHJlcztcbn1cblxuLyoqXG4gKiBDaGVjayBpZiBhbiBleHByZXNzaW9uIGlzIGEgc2ltcGxlIHBhdGguXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV4cFxuICogQHJldHVybiB7Qm9vbGVhbn1cbiAqL1xuXG5mdW5jdGlvbiBpc1NpbXBsZVBhdGgoZXhwKSB7XG4gIHJldHVybiBwYXRoVGVzdFJFLnRlc3QoZXhwKSAmJlxuICAvLyBkb24ndCB0cmVhdCB0cnVlL2ZhbHNlIGFzIHBhdGhzXG4gICFib29sZWFuTGl0ZXJhbFJFLnRlc3QoZXhwKSAmJlxuICAvLyBNYXRoIGNvbnN0YW50cyBlLmcuIE1hdGguUEksIE1hdGguRSBldGMuXG4gIGV4cC5zbGljZSgwLCA1KSAhPT0gJ01hdGguJztcbn1cblxudmFyIGV4cHJlc3Npb24gPSBPYmplY3QuZnJlZXplKHtcbiAgcGFyc2VFeHByZXNzaW9uOiBwYXJzZUV4cHJlc3Npb24sXG4gIGlzU2ltcGxlUGF0aDogaXNTaW1wbGVQYXRoXG59KTtcblxuLy8gd2UgaGF2ZSB0d28gc2VwYXJhdGUgcXVldWVzOiBvbmUgZm9yIGRpcmVjdGl2ZSB1cGRhdGVzXG4vLyBhbmQgb25lIGZvciB1c2VyIHdhdGNoZXIgcmVnaXN0ZXJlZCB2aWEgJHdhdGNoKCkuXG4vLyB3ZSB3YW50IHRvIGd1YXJhbnRlZSBkaXJlY3RpdmUgdXBkYXRlcyB0byBiZSBjYWxsZWRcbi8vIGJlZm9yZSB1c2VyIHdhdGNoZXJzIHNvIHRoYXQgd2hlbiB1c2VyIHdhdGNoZXJzIGFyZVxuLy8gdHJpZ2dlcmVkLCB0aGUgRE9NIHdvdWxkIGhhdmUgYWxyZWFkeSBiZWVuIGluIHVwZGF0ZWRcbi8vIHN0YXRlLlxuXG52YXIgcXVldWUgPSBbXTtcbnZhciB1c2VyUXVldWUgPSBbXTtcbnZhciBoYXMgPSB7fTtcbnZhciBjaXJjdWxhciA9IHt9O1xudmFyIHdhaXRpbmcgPSBmYWxzZTtcblxuLyoqXG4gKiBSZXNldCB0aGUgYmF0Y2hlcidzIHN0YXRlLlxuICovXG5cbmZ1bmN0aW9uIHJlc2V0QmF0Y2hlclN0YXRlKCkge1xuICBxdWV1ZS5sZW5ndGggPSAwO1xuICB1c2VyUXVldWUubGVuZ3RoID0gMDtcbiAgaGFzID0ge307XG4gIGNpcmN1bGFyID0ge307XG4gIHdhaXRpbmcgPSBmYWxzZTtcbn1cblxuLyoqXG4gKiBGbHVzaCBib3RoIHF1ZXVlcyBhbmQgcnVuIHRoZSB3YXRjaGVycy5cbiAqL1xuXG5mdW5jdGlvbiBmbHVzaEJhdGNoZXJRdWV1ZSgpIHtcbiAgdmFyIF9hZ2FpbiA9IHRydWU7XG5cbiAgX2Z1bmN0aW9uOiB3aGlsZSAoX2FnYWluKSB7XG4gICAgX2FnYWluID0gZmFsc2U7XG5cbiAgICBydW5CYXRjaGVyUXVldWUocXVldWUpO1xuICAgIHJ1bkJhdGNoZXJRdWV1ZSh1c2VyUXVldWUpO1xuICAgIC8vIHVzZXIgd2F0Y2hlcnMgdHJpZ2dlcmVkIG1vcmUgd2F0Y2hlcnMsXG4gICAgLy8ga2VlcCBmbHVzaGluZyB1bnRpbCBpdCBkZXBsZXRlc1xuICAgIGlmIChxdWV1ZS5sZW5ndGgpIHtcbiAgICAgIF9hZ2FpbiA9IHRydWU7XG4gICAgICBjb250aW51ZSBfZnVuY3Rpb247XG4gICAgfVxuICAgIC8vIGRldiB0b29sIGhvb2tcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoZGV2dG9vbHMgJiYgY29uZmlnLmRldnRvb2xzKSB7XG4gICAgICBkZXZ0b29scy5lbWl0KCdmbHVzaCcpO1xuICAgIH1cbiAgICByZXNldEJhdGNoZXJTdGF0ZSgpO1xuICB9XG59XG5cbi8qKlxuICogUnVuIHRoZSB3YXRjaGVycyBpbiBhIHNpbmdsZSBxdWV1ZS5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSBxdWV1ZVxuICovXG5cbmZ1bmN0aW9uIHJ1bkJhdGNoZXJRdWV1ZShxdWV1ZSkge1xuICAvLyBkbyBub3QgY2FjaGUgbGVuZ3RoIGJlY2F1c2UgbW9yZSB3YXRjaGVycyBtaWdodCBiZSBwdXNoZWRcbiAgLy8gYXMgd2UgcnVuIGV4aXN0aW5nIHdhdGNoZXJzXG4gIGZvciAodmFyIGkgPSAwOyBpIDwgcXVldWUubGVuZ3RoOyBpKyspIHtcbiAgICB2YXIgd2F0Y2hlciA9IHF1ZXVlW2ldO1xuICAgIHZhciBpZCA9IHdhdGNoZXIuaWQ7XG4gICAgaGFzW2lkXSA9IG51bGw7XG4gICAgd2F0Y2hlci5ydW4oKTtcbiAgICAvLyBpbiBkZXYgYnVpbGQsIGNoZWNrIGFuZCBzdG9wIGNpcmN1bGFyIHVwZGF0ZXMuXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgaGFzW2lkXSAhPSBudWxsKSB7XG4gICAgICBjaXJjdWxhcltpZF0gPSAoY2lyY3VsYXJbaWRdIHx8IDApICsgMTtcbiAgICAgIGlmIChjaXJjdWxhcltpZF0gPiBjb25maWcuX21heFVwZGF0ZUNvdW50KSB7XG4gICAgICAgIHdhcm4oJ1lvdSBtYXkgaGF2ZSBhbiBpbmZpbml0ZSB1cGRhdGUgbG9vcCBmb3Igd2F0Y2hlciAnICsgJ3dpdGggZXhwcmVzc2lvbiBcIicgKyB3YXRjaGVyLmV4cHJlc3Npb24gKyAnXCInLCB3YXRjaGVyLnZtKTtcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIHF1ZXVlLmxlbmd0aCA9IDA7XG59XG5cbi8qKlxuICogUHVzaCBhIHdhdGNoZXIgaW50byB0aGUgd2F0Y2hlciBxdWV1ZS5cbiAqIEpvYnMgd2l0aCBkdXBsaWNhdGUgSURzIHdpbGwgYmUgc2tpcHBlZCB1bmxlc3MgaXQnc1xuICogcHVzaGVkIHdoZW4gdGhlIHF1ZXVlIGlzIGJlaW5nIGZsdXNoZWQuXG4gKlxuICogQHBhcmFtIHtXYXRjaGVyfSB3YXRjaGVyXG4gKiAgIHByb3BlcnRpZXM6XG4gKiAgIC0ge051bWJlcn0gaWRcbiAqICAgLSB7RnVuY3Rpb259IHJ1blxuICovXG5cbmZ1bmN0aW9uIHB1c2hXYXRjaGVyKHdhdGNoZXIpIHtcbiAgdmFyIGlkID0gd2F0Y2hlci5pZDtcbiAgaWYgKGhhc1tpZF0gPT0gbnVsbCkge1xuICAgIC8vIHB1c2ggd2F0Y2hlciBpbnRvIGFwcHJvcHJpYXRlIHF1ZXVlXG4gICAgdmFyIHEgPSB3YXRjaGVyLnVzZXIgPyB1c2VyUXVldWUgOiBxdWV1ZTtcbiAgICBoYXNbaWRdID0gcS5sZW5ndGg7XG4gICAgcS5wdXNoKHdhdGNoZXIpO1xuICAgIC8vIHF1ZXVlIHRoZSBmbHVzaFxuICAgIGlmICghd2FpdGluZykge1xuICAgICAgd2FpdGluZyA9IHRydWU7XG4gICAgICBuZXh0VGljayhmbHVzaEJhdGNoZXJRdWV1ZSk7XG4gICAgfVxuICB9XG59XG5cbnZhciB1aWQkMiA9IDA7XG5cbi8qKlxuICogQSB3YXRjaGVyIHBhcnNlcyBhbiBleHByZXNzaW9uLCBjb2xsZWN0cyBkZXBlbmRlbmNpZXMsXG4gKiBhbmQgZmlyZXMgY2FsbGJhY2sgd2hlbiB0aGUgZXhwcmVzc2lvbiB2YWx1ZSBjaGFuZ2VzLlxuICogVGhpcyBpcyB1c2VkIGZvciBib3RoIHRoZSAkd2F0Y2goKSBhcGkgYW5kIGRpcmVjdGl2ZXMuXG4gKlxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge1N0cmluZ3xGdW5jdGlvbn0gZXhwT3JGblxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiAgICAgICAgICAgICAgICAgLSB7QXJyYXl9IGZpbHRlcnNcbiAqICAgICAgICAgICAgICAgICAtIHtCb29sZWFufSB0d29XYXlcbiAqICAgICAgICAgICAgICAgICAtIHtCb29sZWFufSBkZWVwXG4gKiAgICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gdXNlclxuICogICAgICAgICAgICAgICAgIC0ge0Jvb2xlYW59IHN5bmNcbiAqICAgICAgICAgICAgICAgICAtIHtCb29sZWFufSBsYXp5XG4gKiAgICAgICAgICAgICAgICAgLSB7RnVuY3Rpb259IFtwcmVQcm9jZXNzXVxuICogICAgICAgICAgICAgICAgIC0ge0Z1bmN0aW9ufSBbcG9zdFByb2Nlc3NdXG4gKiBAY29uc3RydWN0b3JcbiAqL1xuZnVuY3Rpb24gV2F0Y2hlcih2bSwgZXhwT3JGbiwgY2IsIG9wdGlvbnMpIHtcbiAgLy8gbWl4IGluIG9wdGlvbnNcbiAgaWYgKG9wdGlvbnMpIHtcbiAgICBleHRlbmQodGhpcywgb3B0aW9ucyk7XG4gIH1cbiAgdmFyIGlzRm4gPSB0eXBlb2YgZXhwT3JGbiA9PT0gJ2Z1bmN0aW9uJztcbiAgdGhpcy52bSA9IHZtO1xuICB2bS5fd2F0Y2hlcnMucHVzaCh0aGlzKTtcbiAgdGhpcy5leHByZXNzaW9uID0gZXhwT3JGbjtcbiAgdGhpcy5jYiA9IGNiO1xuICB0aGlzLmlkID0gKyt1aWQkMjsgLy8gdWlkIGZvciBiYXRjaGluZ1xuICB0aGlzLmFjdGl2ZSA9IHRydWU7XG4gIHRoaXMuZGlydHkgPSB0aGlzLmxhenk7IC8vIGZvciBsYXp5IHdhdGNoZXJzXG4gIHRoaXMuZGVwcyA9IFtdO1xuICB0aGlzLm5ld0RlcHMgPSBbXTtcbiAgdGhpcy5kZXBJZHMgPSBuZXcgX1NldCgpO1xuICB0aGlzLm5ld0RlcElkcyA9IG5ldyBfU2V0KCk7XG4gIHRoaXMucHJldkVycm9yID0gbnVsbDsgLy8gZm9yIGFzeW5jIGVycm9yIHN0YWNrc1xuICAvLyBwYXJzZSBleHByZXNzaW9uIGZvciBnZXR0ZXIvc2V0dGVyXG4gIGlmIChpc0ZuKSB7XG4gICAgdGhpcy5nZXR0ZXIgPSBleHBPckZuO1xuICAgIHRoaXMuc2V0dGVyID0gdW5kZWZpbmVkO1xuICB9IGVsc2Uge1xuICAgIHZhciByZXMgPSBwYXJzZUV4cHJlc3Npb24oZXhwT3JGbiwgdGhpcy50d29XYXkpO1xuICAgIHRoaXMuZ2V0dGVyID0gcmVzLmdldDtcbiAgICB0aGlzLnNldHRlciA9IHJlcy5zZXQ7XG4gIH1cbiAgdGhpcy52YWx1ZSA9IHRoaXMubGF6eSA/IHVuZGVmaW5lZCA6IHRoaXMuZ2V0KCk7XG4gIC8vIHN0YXRlIGZvciBhdm9pZGluZyBmYWxzZSB0cmlnZ2VycyBmb3IgZGVlcCBhbmQgQXJyYXlcbiAgLy8gd2F0Y2hlcnMgZHVyaW5nIHZtLl9kaWdlc3QoKVxuICB0aGlzLnF1ZXVlZCA9IHRoaXMuc2hhbGxvdyA9IGZhbHNlO1xufVxuXG4vKipcbiAqIEV2YWx1YXRlIHRoZSBnZXR0ZXIsIGFuZCByZS1jb2xsZWN0IGRlcGVuZGVuY2llcy5cbiAqL1xuXG5XYXRjaGVyLnByb3RvdHlwZS5nZXQgPSBmdW5jdGlvbiAoKSB7XG4gIHRoaXMuYmVmb3JlR2V0KCk7XG4gIHZhciBzY29wZSA9IHRoaXMuc2NvcGUgfHwgdGhpcy52bTtcbiAgdmFyIHZhbHVlO1xuICB0cnkge1xuICAgIHZhbHVlID0gdGhpcy5nZXR0ZXIuY2FsbChzY29wZSwgc2NvcGUpO1xuICB9IGNhdGNoIChlKSB7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgY29uZmlnLndhcm5FeHByZXNzaW9uRXJyb3JzKSB7XG4gICAgICB3YXJuKCdFcnJvciB3aGVuIGV2YWx1YXRpbmcgZXhwcmVzc2lvbiAnICsgJ1wiJyArIHRoaXMuZXhwcmVzc2lvbiArICdcIjogJyArIGUudG9TdHJpbmcoKSwgdGhpcy52bSk7XG4gICAgfVxuICB9XG4gIC8vIFwidG91Y2hcIiBldmVyeSBwcm9wZXJ0eSBzbyB0aGV5IGFyZSBhbGwgdHJhY2tlZCBhc1xuICAvLyBkZXBlbmRlbmNpZXMgZm9yIGRlZXAgd2F0Y2hpbmdcbiAgaWYgKHRoaXMuZGVlcCkge1xuICAgIHRyYXZlcnNlKHZhbHVlKTtcbiAgfVxuICBpZiAodGhpcy5wcmVQcm9jZXNzKSB7XG4gICAgdmFsdWUgPSB0aGlzLnByZVByb2Nlc3ModmFsdWUpO1xuICB9XG4gIGlmICh0aGlzLmZpbHRlcnMpIHtcbiAgICB2YWx1ZSA9IHNjb3BlLl9hcHBseUZpbHRlcnModmFsdWUsIG51bGwsIHRoaXMuZmlsdGVycywgZmFsc2UpO1xuICB9XG4gIGlmICh0aGlzLnBvc3RQcm9jZXNzKSB7XG4gICAgdmFsdWUgPSB0aGlzLnBvc3RQcm9jZXNzKHZhbHVlKTtcbiAgfVxuICB0aGlzLmFmdGVyR2V0KCk7XG4gIHJldHVybiB2YWx1ZTtcbn07XG5cbi8qKlxuICogU2V0IHRoZSBjb3JyZXNwb25kaW5nIHZhbHVlIHdpdGggdGhlIHNldHRlci5cbiAqXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUuc2V0ID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gIHZhciBzY29wZSA9IHRoaXMuc2NvcGUgfHwgdGhpcy52bTtcbiAgaWYgKHRoaXMuZmlsdGVycykge1xuICAgIHZhbHVlID0gc2NvcGUuX2FwcGx5RmlsdGVycyh2YWx1ZSwgdGhpcy52YWx1ZSwgdGhpcy5maWx0ZXJzLCB0cnVlKTtcbiAgfVxuICB0cnkge1xuICAgIHRoaXMuc2V0dGVyLmNhbGwoc2NvcGUsIHNjb3BlLCB2YWx1ZSk7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBjb25maWcud2FybkV4cHJlc3Npb25FcnJvcnMpIHtcbiAgICAgIHdhcm4oJ0Vycm9yIHdoZW4gZXZhbHVhdGluZyBzZXR0ZXIgJyArICdcIicgKyB0aGlzLmV4cHJlc3Npb24gKyAnXCI6ICcgKyBlLnRvU3RyaW5nKCksIHRoaXMudm0pO1xuICAgIH1cbiAgfVxuICAvLyB0d28td2F5IHN5bmMgZm9yIHYtZm9yIGFsaWFzXG4gIHZhciBmb3JDb250ZXh0ID0gc2NvcGUuJGZvckNvbnRleHQ7XG4gIGlmIChmb3JDb250ZXh0ICYmIGZvckNvbnRleHQuYWxpYXMgPT09IHRoaXMuZXhwcmVzc2lvbikge1xuICAgIGlmIChmb3JDb250ZXh0LmZpbHRlcnMpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignSXQgc2VlbXMgeW91IGFyZSB1c2luZyB0d28td2F5IGJpbmRpbmcgb24gJyArICdhIHYtZm9yIGFsaWFzICgnICsgdGhpcy5leHByZXNzaW9uICsgJyksIGFuZCB0aGUgJyArICd2LWZvciBoYXMgZmlsdGVycy4gVGhpcyB3aWxsIG5vdCB3b3JrIHByb3Blcmx5LiAnICsgJ0VpdGhlciByZW1vdmUgdGhlIGZpbHRlcnMgb3IgdXNlIGFuIGFycmF5IG9mICcgKyAnb2JqZWN0cyBhbmQgYmluZCB0byBvYmplY3QgcHJvcGVydGllcyBpbnN0ZWFkLicsIHRoaXMudm0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBmb3JDb250ZXh0Ll93aXRoTG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICBpZiAoc2NvcGUuJGtleSkge1xuICAgICAgICAvLyBvcmlnaW5hbCBpcyBhbiBvYmplY3RcbiAgICAgICAgZm9yQ29udGV4dC5yYXdWYWx1ZVtzY29wZS4ka2V5XSA9IHZhbHVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZm9yQ29udGV4dC5yYXdWYWx1ZS4kc2V0KHNjb3BlLiRpbmRleCwgdmFsdWUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG59O1xuXG4vKipcbiAqIFByZXBhcmUgZm9yIGRlcGVuZGVuY3kgY29sbGVjdGlvbi5cbiAqL1xuXG5XYXRjaGVyLnByb3RvdHlwZS5iZWZvcmVHZXQgPSBmdW5jdGlvbiAoKSB7XG4gIERlcC50YXJnZXQgPSB0aGlzO1xufTtcblxuLyoqXG4gKiBBZGQgYSBkZXBlbmRlbmN5IHRvIHRoaXMgZGlyZWN0aXZlLlxuICpcbiAqIEBwYXJhbSB7RGVwfSBkZXBcbiAqL1xuXG5XYXRjaGVyLnByb3RvdHlwZS5hZGREZXAgPSBmdW5jdGlvbiAoZGVwKSB7XG4gIHZhciBpZCA9IGRlcC5pZDtcbiAgaWYgKCF0aGlzLm5ld0RlcElkcy5oYXMoaWQpKSB7XG4gICAgdGhpcy5uZXdEZXBJZHMuYWRkKGlkKTtcbiAgICB0aGlzLm5ld0RlcHMucHVzaChkZXApO1xuICAgIGlmICghdGhpcy5kZXBJZHMuaGFzKGlkKSkge1xuICAgICAgZGVwLmFkZFN1Yih0aGlzKTtcbiAgICB9XG4gIH1cbn07XG5cbi8qKlxuICogQ2xlYW4gdXAgZm9yIGRlcGVuZGVuY3kgY29sbGVjdGlvbi5cbiAqL1xuXG5XYXRjaGVyLnByb3RvdHlwZS5hZnRlckdldCA9IGZ1bmN0aW9uICgpIHtcbiAgRGVwLnRhcmdldCA9IG51bGw7XG4gIHZhciBpID0gdGhpcy5kZXBzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIHZhciBkZXAgPSB0aGlzLmRlcHNbaV07XG4gICAgaWYgKCF0aGlzLm5ld0RlcElkcy5oYXMoZGVwLmlkKSkge1xuICAgICAgZGVwLnJlbW92ZVN1Yih0aGlzKTtcbiAgICB9XG4gIH1cbiAgdmFyIHRtcCA9IHRoaXMuZGVwSWRzO1xuICB0aGlzLmRlcElkcyA9IHRoaXMubmV3RGVwSWRzO1xuICB0aGlzLm5ld0RlcElkcyA9IHRtcDtcbiAgdGhpcy5uZXdEZXBJZHMuY2xlYXIoKTtcbiAgdG1wID0gdGhpcy5kZXBzO1xuICB0aGlzLmRlcHMgPSB0aGlzLm5ld0RlcHM7XG4gIHRoaXMubmV3RGVwcyA9IHRtcDtcbiAgdGhpcy5uZXdEZXBzLmxlbmd0aCA9IDA7XG59O1xuXG4vKipcbiAqIFN1YnNjcmliZXIgaW50ZXJmYWNlLlxuICogV2lsbCBiZSBjYWxsZWQgd2hlbiBhIGRlcGVuZGVuY3kgY2hhbmdlcy5cbiAqXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHNoYWxsb3dcbiAqL1xuXG5XYXRjaGVyLnByb3RvdHlwZS51cGRhdGUgPSBmdW5jdGlvbiAoc2hhbGxvdykge1xuICBpZiAodGhpcy5sYXp5KSB7XG4gICAgdGhpcy5kaXJ0eSA9IHRydWU7XG4gIH0gZWxzZSBpZiAodGhpcy5zeW5jIHx8ICFjb25maWcuYXN5bmMpIHtcbiAgICB0aGlzLnJ1bigpO1xuICB9IGVsc2Uge1xuICAgIC8vIGlmIHF1ZXVlZCwgb25seSBvdmVyd3JpdGUgc2hhbGxvdyB3aXRoIG5vbi1zaGFsbG93LFxuICAgIC8vIGJ1dCBub3QgdGhlIG90aGVyIHdheSBhcm91bmQuXG4gICAgdGhpcy5zaGFsbG93ID0gdGhpcy5xdWV1ZWQgPyBzaGFsbG93ID8gdGhpcy5zaGFsbG93IDogZmFsc2UgOiAhIXNoYWxsb3c7XG4gICAgdGhpcy5xdWV1ZWQgPSB0cnVlO1xuICAgIC8vIHJlY29yZCBiZWZvcmUtcHVzaCBlcnJvciBzdGFjayBpbiBkZWJ1ZyBtb2RlXG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgY29uZmlnLmRlYnVnKSB7XG4gICAgICB0aGlzLnByZXZFcnJvciA9IG5ldyBFcnJvcignW3Z1ZV0gYXN5bmMgc3RhY2sgdHJhY2UnKTtcbiAgICB9XG4gICAgcHVzaFdhdGNoZXIodGhpcyk7XG4gIH1cbn07XG5cbi8qKlxuICogQmF0Y2hlciBqb2IgaW50ZXJmYWNlLlxuICogV2lsbCBiZSBjYWxsZWQgYnkgdGhlIGJhdGNoZXIuXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24gKCkge1xuICBpZiAodGhpcy5hY3RpdmUpIHtcbiAgICB2YXIgdmFsdWUgPSB0aGlzLmdldCgpO1xuICAgIGlmICh2YWx1ZSAhPT0gdGhpcy52YWx1ZSB8fFxuICAgIC8vIERlZXAgd2F0Y2hlcnMgYW5kIHdhdGNoZXJzIG9uIE9iamVjdC9BcnJheXMgc2hvdWxkIGZpcmUgZXZlblxuICAgIC8vIHdoZW4gdGhlIHZhbHVlIGlzIHRoZSBzYW1lLCBiZWNhdXNlIHRoZSB2YWx1ZSBtYXlcbiAgICAvLyBoYXZlIG11dGF0ZWQ7IGJ1dCBvbmx5IGRvIHNvIGlmIHRoaXMgaXMgYVxuICAgIC8vIG5vbi1zaGFsbG93IHVwZGF0ZSAoY2F1c2VkIGJ5IGEgdm0gZGlnZXN0KS5cbiAgICAoaXNPYmplY3QodmFsdWUpIHx8IHRoaXMuZGVlcCkgJiYgIXRoaXMuc2hhbGxvdykge1xuICAgICAgLy8gc2V0IG5ldyB2YWx1ZVxuICAgICAgdmFyIG9sZFZhbHVlID0gdGhpcy52YWx1ZTtcbiAgICAgIHRoaXMudmFsdWUgPSB2YWx1ZTtcbiAgICAgIC8vIGluIGRlYnVnICsgYXN5bmMgbW9kZSwgd2hlbiBhIHdhdGNoZXIgY2FsbGJhY2tzXG4gICAgICAvLyB0aHJvd3MsIHdlIGFsc28gdGhyb3cgdGhlIHNhdmVkIGJlZm9yZS1wdXNoIGVycm9yXG4gICAgICAvLyBzbyB0aGUgZnVsbCBjcm9zcy10aWNrIHN0YWNrIHRyYWNlIGlzIGF2YWlsYWJsZS5cbiAgICAgIHZhciBwcmV2RXJyb3IgPSB0aGlzLnByZXZFcnJvcjtcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgY29uZmlnLmRlYnVnICYmIHByZXZFcnJvcikge1xuICAgICAgICB0aGlzLnByZXZFcnJvciA9IG51bGw7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgdGhpcy5jYi5jYWxsKHRoaXMudm0sIHZhbHVlLCBvbGRWYWx1ZSk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICBuZXh0VGljayhmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgICB0aHJvdyBwcmV2RXJyb3I7XG4gICAgICAgICAgfSwgMCk7XG4gICAgICAgICAgdGhyb3cgZTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5jYi5jYWxsKHRoaXMudm0sIHZhbHVlLCBvbGRWYWx1ZSk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMucXVldWVkID0gdGhpcy5zaGFsbG93ID0gZmFsc2U7XG4gIH1cbn07XG5cbi8qKlxuICogRXZhbHVhdGUgdGhlIHZhbHVlIG9mIHRoZSB3YXRjaGVyLlxuICogVGhpcyBvbmx5IGdldHMgY2FsbGVkIGZvciBsYXp5IHdhdGNoZXJzLlxuICovXG5cbldhdGNoZXIucHJvdG90eXBlLmV2YWx1YXRlID0gZnVuY3Rpb24gKCkge1xuICAvLyBhdm9pZCBvdmVyd3JpdGluZyBhbm90aGVyIHdhdGNoZXIgdGhhdCBpcyBiZWluZ1xuICAvLyBjb2xsZWN0ZWQuXG4gIHZhciBjdXJyZW50ID0gRGVwLnRhcmdldDtcbiAgdGhpcy52YWx1ZSA9IHRoaXMuZ2V0KCk7XG4gIHRoaXMuZGlydHkgPSBmYWxzZTtcbiAgRGVwLnRhcmdldCA9IGN1cnJlbnQ7XG59O1xuXG4vKipcbiAqIERlcGVuZCBvbiBhbGwgZGVwcyBjb2xsZWN0ZWQgYnkgdGhpcyB3YXRjaGVyLlxuICovXG5cbldhdGNoZXIucHJvdG90eXBlLmRlcGVuZCA9IGZ1bmN0aW9uICgpIHtcbiAgdmFyIGkgPSB0aGlzLmRlcHMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgdGhpcy5kZXBzW2ldLmRlcGVuZCgpO1xuICB9XG59O1xuXG4vKipcbiAqIFJlbW92ZSBzZWxmIGZyb20gYWxsIGRlcGVuZGVuY2llcycgc3ViY3JpYmVyIGxpc3QuXG4gKi9cblxuV2F0Y2hlci5wcm90b3R5cGUudGVhcmRvd24gPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLmFjdGl2ZSkge1xuICAgIC8vIHJlbW92ZSBzZWxmIGZyb20gdm0ncyB3YXRjaGVyIGxpc3RcbiAgICAvLyB0aGlzIGlzIGEgc29tZXdoYXQgZXhwZW5zaXZlIG9wZXJhdGlvbiBzbyB3ZSBza2lwIGl0XG4gICAgLy8gaWYgdGhlIHZtIGlzIGJlaW5nIGRlc3Ryb3llZCBvciBpcyBwZXJmb3JtaW5nIGEgdi1mb3JcbiAgICAvLyByZS1yZW5kZXIgKHRoZSB3YXRjaGVyIGxpc3QgaXMgdGhlbiBmaWx0ZXJlZCBieSB2LWZvcikuXG4gICAgaWYgKCF0aGlzLnZtLl9pc0JlaW5nRGVzdHJveWVkICYmICF0aGlzLnZtLl92Rm9yUmVtb3ZpbmcpIHtcbiAgICAgIHRoaXMudm0uX3dhdGNoZXJzLiRyZW1vdmUodGhpcyk7XG4gICAgfVxuICAgIHZhciBpID0gdGhpcy5kZXBzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICB0aGlzLmRlcHNbaV0ucmVtb3ZlU3ViKHRoaXMpO1xuICAgIH1cbiAgICB0aGlzLmFjdGl2ZSA9IGZhbHNlO1xuICAgIHRoaXMudm0gPSB0aGlzLmNiID0gdGhpcy52YWx1ZSA9IG51bGw7XG4gIH1cbn07XG5cbi8qKlxuICogUmVjcnVzaXZlbHkgdHJhdmVyc2UgYW4gb2JqZWN0IHRvIGV2b2tlIGFsbCBjb252ZXJ0ZWRcbiAqIGdldHRlcnMsIHNvIHRoYXQgZXZlcnkgbmVzdGVkIHByb3BlcnR5IGluc2lkZSB0aGUgb2JqZWN0XG4gKiBpcyBjb2xsZWN0ZWQgYXMgYSBcImRlZXBcIiBkZXBlbmRlbmN5LlxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsXG4gKi9cblxudmFyIHNlZW5PYmplY3RzID0gbmV3IF9TZXQoKTtcbmZ1bmN0aW9uIHRyYXZlcnNlKHZhbCwgc2Vlbikge1xuICB2YXIgaSA9IHVuZGVmaW5lZCxcbiAgICAgIGtleXMgPSB1bmRlZmluZWQ7XG4gIGlmICghc2Vlbikge1xuICAgIHNlZW4gPSBzZWVuT2JqZWN0cztcbiAgICBzZWVuLmNsZWFyKCk7XG4gIH1cbiAgdmFyIGlzQSA9IGlzQXJyYXkodmFsKTtcbiAgdmFyIGlzTyA9IGlzT2JqZWN0KHZhbCk7XG4gIGlmIChpc0EgfHwgaXNPKSB7XG4gICAgaWYgKHZhbC5fX29iX18pIHtcbiAgICAgIHZhciBkZXBJZCA9IHZhbC5fX29iX18uZGVwLmlkO1xuICAgICAgaWYgKHNlZW4uaGFzKGRlcElkKSkge1xuICAgICAgICByZXR1cm47XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzZWVuLmFkZChkZXBJZCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChpc0EpIHtcbiAgICAgIGkgPSB2YWwubGVuZ3RoO1xuICAgICAgd2hpbGUgKGktLSkgdHJhdmVyc2UodmFsW2ldLCBzZWVuKTtcbiAgICB9IGVsc2UgaWYgKGlzTykge1xuICAgICAga2V5cyA9IE9iamVjdC5rZXlzKHZhbCk7XG4gICAgICBpID0ga2V5cy5sZW5ndGg7XG4gICAgICB3aGlsZSAoaS0tKSB0cmF2ZXJzZSh2YWxba2V5c1tpXV0sIHNlZW4pO1xuICAgIH1cbiAgfVxufVxuXG52YXIgdGV4dCQxID0ge1xuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdGhpcy5hdHRyID0gdGhpcy5lbC5ub2RlVHlwZSA9PT0gMyA/ICdkYXRhJyA6ICd0ZXh0Q29udGVudCc7XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUodmFsdWUpIHtcbiAgICB0aGlzLmVsW3RoaXMuYXR0cl0gPSBfdG9TdHJpbmcodmFsdWUpO1xuICB9XG59O1xuXG52YXIgdGVtcGxhdGVDYWNoZSA9IG5ldyBDYWNoZSgxMDAwKTtcbnZhciBpZFNlbGVjdG9yQ2FjaGUgPSBuZXcgQ2FjaGUoMTAwMCk7XG5cbnZhciBtYXAgPSB7XG4gIGVmYXVsdDogWzAsICcnLCAnJ10sXG4gIGxlZ2VuZDogWzEsICc8ZmllbGRzZXQ+JywgJzwvZmllbGRzZXQ+J10sXG4gIHRyOiBbMiwgJzx0YWJsZT48dGJvZHk+JywgJzwvdGJvZHk+PC90YWJsZT4nXSxcbiAgY29sOiBbMiwgJzx0YWJsZT48dGJvZHk+PC90Ym9keT48Y29sZ3JvdXA+JywgJzwvY29sZ3JvdXA+PC90YWJsZT4nXVxufTtcblxubWFwLnRkID0gbWFwLnRoID0gWzMsICc8dGFibGU+PHRib2R5Pjx0cj4nLCAnPC90cj48L3Rib2R5PjwvdGFibGU+J107XG5cbm1hcC5vcHRpb24gPSBtYXAub3B0Z3JvdXAgPSBbMSwgJzxzZWxlY3QgbXVsdGlwbGU9XCJtdWx0aXBsZVwiPicsICc8L3NlbGVjdD4nXTtcblxubWFwLnRoZWFkID0gbWFwLnRib2R5ID0gbWFwLmNvbGdyb3VwID0gbWFwLmNhcHRpb24gPSBtYXAudGZvb3QgPSBbMSwgJzx0YWJsZT4nLCAnPC90YWJsZT4nXTtcblxubWFwLmcgPSBtYXAuZGVmcyA9IG1hcC5zeW1ib2wgPSBtYXAudXNlID0gbWFwLmltYWdlID0gbWFwLnRleHQgPSBtYXAuY2lyY2xlID0gbWFwLmVsbGlwc2UgPSBtYXAubGluZSA9IG1hcC5wYXRoID0gbWFwLnBvbHlnb24gPSBtYXAucG9seWxpbmUgPSBtYXAucmVjdCA9IFsxLCAnPHN2ZyAnICsgJ3htbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiAnICsgJ3htbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiICcgKyAneG1sbnM6ZXY9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAxL3htbC1ldmVudHNcIicgKyAndmVyc2lvbj1cIjEuMVwiPicsICc8L3N2Zz4nXTtcblxuLyoqXG4gKiBDaGVjayBpZiBhIG5vZGUgaXMgYSBzdXBwb3J0ZWQgdGVtcGxhdGUgbm9kZSB3aXRoIGFcbiAqIERvY3VtZW50RnJhZ21lbnQgY29udGVudC5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaXNSZWFsVGVtcGxhdGUobm9kZSkge1xuICByZXR1cm4gaXNUZW1wbGF0ZShub2RlKSAmJiBpc0ZyYWdtZW50KG5vZGUuY29udGVudCk7XG59XG5cbnZhciB0YWdSRSQxID0gLzwoW1xcdzotXSspLztcbnZhciBlbnRpdHlSRSA9IC8mIz9cXHcrPzsvO1xuXG4vKipcbiAqIENvbnZlcnQgYSBzdHJpbmcgdGVtcGxhdGUgdG8gYSBEb2N1bWVudEZyYWdtZW50LlxuICogRGV0ZXJtaW5lcyBjb3JyZWN0IHdyYXBwaW5nIGJ5IHRhZyB0eXBlcy4gV3JhcHBpbmdcbiAqIHN0cmF0ZWd5IGZvdW5kIGluIGpRdWVyeSAmIGNvbXBvbmVudC9kb21pZnkuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHRlbXBsYXRlU3RyaW5nXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHJhd1xuICogQHJldHVybiB7RG9jdW1lbnRGcmFnbWVudH1cbiAqL1xuXG5mdW5jdGlvbiBzdHJpbmdUb0ZyYWdtZW50KHRlbXBsYXRlU3RyaW5nLCByYXcpIHtcbiAgLy8gdHJ5IGEgY2FjaGUgaGl0IGZpcnN0XG4gIHZhciBjYWNoZUtleSA9IHJhdyA/IHRlbXBsYXRlU3RyaW5nIDogdGVtcGxhdGVTdHJpbmcudHJpbSgpO1xuICB2YXIgaGl0ID0gdGVtcGxhdGVDYWNoZS5nZXQoY2FjaGVLZXkpO1xuICBpZiAoaGl0KSB7XG4gICAgcmV0dXJuIGhpdDtcbiAgfVxuXG4gIHZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICB2YXIgdGFnTWF0Y2ggPSB0ZW1wbGF0ZVN0cmluZy5tYXRjaCh0YWdSRSQxKTtcbiAgdmFyIGVudGl0eU1hdGNoID0gZW50aXR5UkUudGVzdCh0ZW1wbGF0ZVN0cmluZyk7XG5cbiAgaWYgKCF0YWdNYXRjaCAmJiAhZW50aXR5TWF0Y2gpIHtcbiAgICAvLyB0ZXh0IG9ubHksIHJldHVybiBhIHNpbmdsZSB0ZXh0IG5vZGUuXG4gICAgZnJhZy5hcHBlbmRDaGlsZChkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSh0ZW1wbGF0ZVN0cmluZykpO1xuICB9IGVsc2Uge1xuICAgIHZhciB0YWcgPSB0YWdNYXRjaCAmJiB0YWdNYXRjaFsxXTtcbiAgICB2YXIgd3JhcCA9IG1hcFt0YWddIHx8IG1hcC5lZmF1bHQ7XG4gICAgdmFyIGRlcHRoID0gd3JhcFswXTtcbiAgICB2YXIgcHJlZml4ID0gd3JhcFsxXTtcbiAgICB2YXIgc3VmZml4ID0gd3JhcFsyXTtcbiAgICB2YXIgbm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuXG4gICAgbm9kZS5pbm5lckhUTUwgPSBwcmVmaXggKyB0ZW1wbGF0ZVN0cmluZyArIHN1ZmZpeDtcbiAgICB3aGlsZSAoZGVwdGgtLSkge1xuICAgICAgbm9kZSA9IG5vZGUubGFzdENoaWxkO1xuICAgIH1cblxuICAgIHZhciBjaGlsZDtcbiAgICAvKiBlc2xpbnQtZGlzYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICAgIHdoaWxlIChjaGlsZCA9IG5vZGUuZmlyc3RDaGlsZCkge1xuICAgICAgLyogZXNsaW50LWVuYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICAgICAgZnJhZy5hcHBlbmRDaGlsZChjaGlsZCk7XG4gICAgfVxuICB9XG4gIGlmICghcmF3KSB7XG4gICAgdHJpbU5vZGUoZnJhZyk7XG4gIH1cbiAgdGVtcGxhdGVDYWNoZS5wdXQoY2FjaGVLZXksIGZyYWcpO1xuICByZXR1cm4gZnJhZztcbn1cblxuLyoqXG4gKiBDb252ZXJ0IGEgdGVtcGxhdGUgbm9kZSB0byBhIERvY3VtZW50RnJhZ21lbnQuXG4gKlxuICogQHBhcmFtIHtOb2RlfSBub2RlXG4gKiBAcmV0dXJuIHtEb2N1bWVudEZyYWdtZW50fVxuICovXG5cbmZ1bmN0aW9uIG5vZGVUb0ZyYWdtZW50KG5vZGUpIHtcbiAgLy8gaWYgaXRzIGEgdGVtcGxhdGUgdGFnIGFuZCB0aGUgYnJvd3NlciBzdXBwb3J0cyBpdCxcbiAgLy8gaXRzIGNvbnRlbnQgaXMgYWxyZWFkeSBhIGRvY3VtZW50IGZyYWdtZW50LiBIb3dldmVyLCBpT1MgU2FmYXJpIGhhc1xuICAvLyBidWcgd2hlbiB1c2luZyBkaXJlY3RseSBjbG9uZWQgdGVtcGxhdGUgY29udGVudCB3aXRoIHRvdWNoXG4gIC8vIGV2ZW50cyBhbmQgY2FuIGNhdXNlIGNyYXNoZXMgd2hlbiB0aGUgbm9kZXMgYXJlIHJlbW92ZWQgZnJvbSBET00sIHNvIHdlXG4gIC8vIGhhdmUgdG8gdHJlYXQgdGVtcGxhdGUgZWxlbWVudHMgYXMgc3RyaW5nIHRlbXBsYXRlcy4gKCMyODA1KVxuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKGlzUmVhbFRlbXBsYXRlKG5vZGUpKSB7XG4gICAgcmV0dXJuIHN0cmluZ1RvRnJhZ21lbnQobm9kZS5pbm5lckhUTUwpO1xuICB9XG4gIC8vIHNjcmlwdCB0ZW1wbGF0ZVxuICBpZiAobm9kZS50YWdOYW1lID09PSAnU0NSSVBUJykge1xuICAgIHJldHVybiBzdHJpbmdUb0ZyYWdtZW50KG5vZGUudGV4dENvbnRlbnQpO1xuICB9XG4gIC8vIG5vcm1hbCBub2RlLCBjbG9uZSBpdCB0byBhdm9pZCBtdXRhdGluZyB0aGUgb3JpZ2luYWxcbiAgdmFyIGNsb25lZE5vZGUgPSBjbG9uZU5vZGUobm9kZSk7XG4gIHZhciBmcmFnID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICB2YXIgY2hpbGQ7XG4gIC8qIGVzbGludC1kaXNhYmxlIG5vLWNvbmQtYXNzaWduICovXG4gIHdoaWxlIChjaGlsZCA9IGNsb25lZE5vZGUuZmlyc3RDaGlsZCkge1xuICAgIC8qIGVzbGludC1lbmFibGUgbm8tY29uZC1hc3NpZ24gKi9cbiAgICBmcmFnLmFwcGVuZENoaWxkKGNoaWxkKTtcbiAgfVxuICB0cmltTm9kZShmcmFnKTtcbiAgcmV0dXJuIGZyYWc7XG59XG5cbi8vIFRlc3QgZm9yIHRoZSBwcmVzZW5jZSBvZiB0aGUgU2FmYXJpIHRlbXBsYXRlIGNsb25pbmcgYnVnXG4vLyBodHRwczovL2J1Z3Mud2Via2l0Lm9yZy9zaG93dWcuY2dpP2lkPTEzNzc1NVxudmFyIGhhc0Jyb2tlblRlbXBsYXRlID0gKGZ1bmN0aW9uICgpIHtcbiAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgaWYgKGluQnJvd3Nlcikge1xuICAgIHZhciBhID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gICAgYS5pbm5lckhUTUwgPSAnPHRlbXBsYXRlPjE8L3RlbXBsYXRlPic7XG4gICAgcmV0dXJuICFhLmNsb25lTm9kZSh0cnVlKS5maXJzdENoaWxkLmlubmVySFRNTDtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pKCk7XG5cbi8vIFRlc3QgZm9yIElFMTAvMTEgdGV4dGFyZWEgcGxhY2Vob2xkZXIgY2xvbmUgYnVnXG52YXIgaGFzVGV4dGFyZWFDbG9uZUJ1ZyA9IChmdW5jdGlvbiAoKSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBlbHNlICovXG4gIGlmIChpbkJyb3dzZXIpIHtcbiAgICB2YXIgdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RleHRhcmVhJyk7XG4gICAgdC5wbGFjZWhvbGRlciA9ICd0JztcbiAgICByZXR1cm4gdC5jbG9uZU5vZGUodHJ1ZSkudmFsdWUgPT09ICd0JztcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cbn0pKCk7XG5cbi8qKlxuICogMS4gRGVhbCB3aXRoIFNhZmFyaSBjbG9uaW5nIG5lc3RlZCA8dGVtcGxhdGU+IGJ1ZyBieVxuICogICAgbWFudWFsbHkgY2xvbmluZyBhbGwgdGVtcGxhdGUgaW5zdGFuY2VzLlxuICogMi4gRGVhbCB3aXRoIElFMTAvMTEgdGV4dGFyZWEgcGxhY2Vob2xkZXIgYnVnIGJ5IHNldHRpbmdcbiAqICAgIHRoZSBjb3JyZWN0IHZhbHVlIGFmdGVyIGNsb25pbmcuXG4gKlxuICogQHBhcmFtIHtFbGVtZW50fERvY3VtZW50RnJhZ21lbnR9IG5vZGVcbiAqIEByZXR1cm4ge0VsZW1lbnR8RG9jdW1lbnRGcmFnbWVudH1cbiAqL1xuXG5mdW5jdGlvbiBjbG9uZU5vZGUobm9kZSkge1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKCFub2RlLnF1ZXJ5U2VsZWN0b3JBbGwpIHtcbiAgICByZXR1cm4gbm9kZS5jbG9uZU5vZGUoKTtcbiAgfVxuICB2YXIgcmVzID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gIHZhciBpLCBvcmlnaW5hbCwgY2xvbmVkO1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKGhhc0Jyb2tlblRlbXBsYXRlKSB7XG4gICAgdmFyIHRlbXBDbG9uZSA9IHJlcztcbiAgICBpZiAoaXNSZWFsVGVtcGxhdGUobm9kZSkpIHtcbiAgICAgIG5vZGUgPSBub2RlLmNvbnRlbnQ7XG4gICAgICB0ZW1wQ2xvbmUgPSByZXMuY29udGVudDtcbiAgICB9XG4gICAgb3JpZ2luYWwgPSBub2RlLnF1ZXJ5U2VsZWN0b3JBbGwoJ3RlbXBsYXRlJyk7XG4gICAgaWYgKG9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgY2xvbmVkID0gdGVtcENsb25lLnF1ZXJ5U2VsZWN0b3JBbGwoJ3RlbXBsYXRlJyk7XG4gICAgICBpID0gY2xvbmVkLmxlbmd0aDtcbiAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgY2xvbmVkW2ldLnBhcmVudE5vZGUucmVwbGFjZUNoaWxkKGNsb25lTm9kZShvcmlnaW5hbFtpXSksIGNsb25lZFtpXSk7XG4gICAgICB9XG4gICAgfVxuICB9XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoaGFzVGV4dGFyZWFDbG9uZUJ1Zykge1xuICAgIGlmIChub2RlLnRhZ05hbWUgPT09ICdURVhUQVJFQScpIHtcbiAgICAgIHJlcy52YWx1ZSA9IG5vZGUudmFsdWU7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9yaWdpbmFsID0gbm9kZS5xdWVyeVNlbGVjdG9yQWxsKCd0ZXh0YXJlYScpO1xuICAgICAgaWYgKG9yaWdpbmFsLmxlbmd0aCkge1xuICAgICAgICBjbG9uZWQgPSByZXMucXVlcnlTZWxlY3RvckFsbCgndGV4dGFyZWEnKTtcbiAgICAgICAgaSA9IGNsb25lZC5sZW5ndGg7XG4gICAgICAgIHdoaWxlIChpLS0pIHtcbiAgICAgICAgICBjbG9uZWRbaV0udmFsdWUgPSBvcmlnaW5hbFtpXS52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgdGhlIHRlbXBsYXRlIG9wdGlvbiBhbmQgbm9ybWFsaXplcyBpdCBpbnRvIGFcbiAqIGEgRG9jdW1lbnRGcmFnbWVudCB0aGF0IGNhbiBiZSB1c2VkIGFzIGEgcGFydGlhbCBvciBhXG4gKiBpbnN0YW5jZSB0ZW1wbGF0ZS5cbiAqXG4gKiBAcGFyYW0geyp9IHRlbXBsYXRlXG4gKiAgICAgICAgUG9zc2libGUgdmFsdWVzIGluY2x1ZGU6XG4gKiAgICAgICAgLSBEb2N1bWVudEZyYWdtZW50IG9iamVjdFxuICogICAgICAgIC0gTm9kZSBvYmplY3Qgb2YgdHlwZSBUZW1wbGF0ZVxuICogICAgICAgIC0gaWQgc2VsZWN0b3I6ICcjc29tZS10ZW1wbGF0ZS1pZCdcbiAqICAgICAgICAtIHRlbXBsYXRlIHN0cmluZzogJzxkaXY+PHNwYW4+e3ttc2d9fTwvc3Bhbj48L2Rpdj4nXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHNob3VsZENsb25lXG4gKiBAcGFyYW0ge0Jvb2xlYW59IHJhd1xuICogICAgICAgIGlubGluZSBIVE1MIGludGVycG9sYXRpb24uIERvIG5vdCBjaGVjayBmb3IgaWRcbiAqICAgICAgICBzZWxlY3RvciBhbmQga2VlcCB3aGl0ZXNwYWNlIGluIHRoZSBzdHJpbmcuXG4gKiBAcmV0dXJuIHtEb2N1bWVudEZyYWdtZW50fHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBwYXJzZVRlbXBsYXRlKHRlbXBsYXRlLCBzaG91bGRDbG9uZSwgcmF3KSB7XG4gIHZhciBub2RlLCBmcmFnO1xuXG4gIC8vIGlmIHRoZSB0ZW1wbGF0ZSBpcyBhbHJlYWR5IGEgZG9jdW1lbnQgZnJhZ21lbnQsXG4gIC8vIGRvIG5vdGhpbmdcbiAgaWYgKGlzRnJhZ21lbnQodGVtcGxhdGUpKSB7XG4gICAgdHJpbU5vZGUodGVtcGxhdGUpO1xuICAgIHJldHVybiBzaG91bGRDbG9uZSA/IGNsb25lTm9kZSh0ZW1wbGF0ZSkgOiB0ZW1wbGF0ZTtcbiAgfVxuXG4gIGlmICh0eXBlb2YgdGVtcGxhdGUgPT09ICdzdHJpbmcnKSB7XG4gICAgLy8gaWQgc2VsZWN0b3JcbiAgICBpZiAoIXJhdyAmJiB0ZW1wbGF0ZS5jaGFyQXQoMCkgPT09ICcjJykge1xuICAgICAgLy8gaWQgc2VsZWN0b3IgY2FuIGJlIGNhY2hlZCB0b29cbiAgICAgIGZyYWcgPSBpZFNlbGVjdG9yQ2FjaGUuZ2V0KHRlbXBsYXRlKTtcbiAgICAgIGlmICghZnJhZykge1xuICAgICAgICBub2RlID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQodGVtcGxhdGUuc2xpY2UoMSkpO1xuICAgICAgICBpZiAobm9kZSkge1xuICAgICAgICAgIGZyYWcgPSBub2RlVG9GcmFnbWVudChub2RlKTtcbiAgICAgICAgICAvLyBzYXZlIHNlbGVjdG9yIHRvIGNhY2hlXG4gICAgICAgICAgaWRTZWxlY3RvckNhY2hlLnB1dCh0ZW1wbGF0ZSwgZnJhZyk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbm9ybWFsIHN0cmluZyB0ZW1wbGF0ZVxuICAgICAgZnJhZyA9IHN0cmluZ1RvRnJhZ21lbnQodGVtcGxhdGUsIHJhdyk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHRlbXBsYXRlLm5vZGVUeXBlKSB7XG4gICAgLy8gYSBkaXJlY3Qgbm9kZVxuICAgIGZyYWcgPSBub2RlVG9GcmFnbWVudCh0ZW1wbGF0ZSk7XG4gIH1cblxuICByZXR1cm4gZnJhZyAmJiBzaG91bGRDbG9uZSA/IGNsb25lTm9kZShmcmFnKSA6IGZyYWc7XG59XG5cbnZhciB0ZW1wbGF0ZSA9IE9iamVjdC5mcmVlemUoe1xuICBjbG9uZU5vZGU6IGNsb25lTm9kZSxcbiAgcGFyc2VUZW1wbGF0ZTogcGFyc2VUZW1wbGF0ZVxufSk7XG5cbnZhciBodG1sID0ge1xuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgLy8gYSBjb21tZW50IG5vZGUgbWVhbnMgdGhpcyBpcyBhIGJpbmRpbmcgZm9yXG4gICAgLy8ge3t7IGlubGluZSB1bmVzY2FwZWQgaHRtbCB9fX1cbiAgICBpZiAodGhpcy5lbC5ub2RlVHlwZSA9PT0gOCkge1xuICAgICAgLy8gaG9sZCBub2Rlc1xuICAgICAgdGhpcy5ub2RlcyA9IFtdO1xuICAgICAgLy8gcmVwbGFjZSB0aGUgcGxhY2Vob2xkZXIgd2l0aCBwcm9wZXIgYW5jaG9yXG4gICAgICB0aGlzLmFuY2hvciA9IGNyZWF0ZUFuY2hvcigndi1odG1sJyk7XG4gICAgICByZXBsYWNlKHRoaXMuZWwsIHRoaXMuYW5jaG9yKTtcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUodmFsdWUpIHtcbiAgICB2YWx1ZSA9IF90b1N0cmluZyh2YWx1ZSk7XG4gICAgaWYgKHRoaXMubm9kZXMpIHtcbiAgICAgIHRoaXMuc3dhcCh2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuZWwuaW5uZXJIVE1MID0gdmFsdWU7XG4gICAgfVxuICB9LFxuXG4gIHN3YXA6IGZ1bmN0aW9uIHN3YXAodmFsdWUpIHtcbiAgICAvLyByZW1vdmUgb2xkIG5vZGVzXG4gICAgdmFyIGkgPSB0aGlzLm5vZGVzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICByZW1vdmUodGhpcy5ub2Rlc1tpXSk7XG4gICAgfVxuICAgIC8vIGNvbnZlcnQgbmV3IHZhbHVlIHRvIGEgZnJhZ21lbnRcbiAgICAvLyBkbyBub3QgYXR0ZW1wdCB0byByZXRyaWV2ZSBmcm9tIGlkIHNlbGVjdG9yXG4gICAgdmFyIGZyYWcgPSBwYXJzZVRlbXBsYXRlKHZhbHVlLCB0cnVlLCB0cnVlKTtcbiAgICAvLyBzYXZlIGEgcmVmZXJlbmNlIHRvIHRoZXNlIG5vZGVzIHNvIHdlIGNhbiByZW1vdmUgbGF0ZXJcbiAgICB0aGlzLm5vZGVzID0gdG9BcnJheShmcmFnLmNoaWxkTm9kZXMpO1xuICAgIGJlZm9yZShmcmFnLCB0aGlzLmFuY2hvcik7XG4gIH1cbn07XG5cbi8qKlxuICogQWJzdHJhY3Rpb24gZm9yIGEgcGFydGlhbGx5LWNvbXBpbGVkIGZyYWdtZW50LlxuICogQ2FuIG9wdGlvbmFsbHkgY29tcGlsZSBjb250ZW50IHdpdGggYSBjaGlsZCBzY29wZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBsaW5rZXJcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtEb2N1bWVudEZyYWdtZW50fSBmcmFnXG4gKiBAcGFyYW0ge1Z1ZX0gW2hvc3RdXG4gKiBAcGFyYW0ge09iamVjdH0gW3Njb3BlXVxuICogQHBhcmFtIHtGcmFnbWVudH0gW3BhcmVudEZyYWddXG4gKi9cbmZ1bmN0aW9uIEZyYWdtZW50KGxpbmtlciwgdm0sIGZyYWcsIGhvc3QsIHNjb3BlLCBwYXJlbnRGcmFnKSB7XG4gIHRoaXMuY2hpbGRyZW4gPSBbXTtcbiAgdGhpcy5jaGlsZEZyYWdzID0gW107XG4gIHRoaXMudm0gPSB2bTtcbiAgdGhpcy5zY29wZSA9IHNjb3BlO1xuICB0aGlzLmluc2VydGVkID0gZmFsc2U7XG4gIHRoaXMucGFyZW50RnJhZyA9IHBhcmVudEZyYWc7XG4gIGlmIChwYXJlbnRGcmFnKSB7XG4gICAgcGFyZW50RnJhZy5jaGlsZEZyYWdzLnB1c2godGhpcyk7XG4gIH1cbiAgdGhpcy51bmxpbmsgPSBsaW5rZXIodm0sIGZyYWcsIGhvc3QsIHNjb3BlLCB0aGlzKTtcbiAgdmFyIHNpbmdsZSA9IHRoaXMuc2luZ2xlID0gZnJhZy5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMSAmJlxuICAvLyBkbyBub3QgZ28gc2luZ2xlIG1vZGUgaWYgdGhlIG9ubHkgbm9kZSBpcyBhbiBhbmNob3JcbiAgIWZyYWcuY2hpbGROb2Rlc1swXS5fX3ZfYW5jaG9yO1xuICBpZiAoc2luZ2xlKSB7XG4gICAgdGhpcy5ub2RlID0gZnJhZy5jaGlsZE5vZGVzWzBdO1xuICAgIHRoaXMuYmVmb3JlID0gc2luZ2xlQmVmb3JlO1xuICAgIHRoaXMucmVtb3ZlID0gc2luZ2xlUmVtb3ZlO1xuICB9IGVsc2Uge1xuICAgIHRoaXMubm9kZSA9IGNyZWF0ZUFuY2hvcignZnJhZ21lbnQtc3RhcnQnKTtcbiAgICB0aGlzLmVuZCA9IGNyZWF0ZUFuY2hvcignZnJhZ21lbnQtZW5kJyk7XG4gICAgdGhpcy5mcmFnID0gZnJhZztcbiAgICBwcmVwZW5kKHRoaXMubm9kZSwgZnJhZyk7XG4gICAgZnJhZy5hcHBlbmRDaGlsZCh0aGlzLmVuZCk7XG4gICAgdGhpcy5iZWZvcmUgPSBtdWx0aUJlZm9yZTtcbiAgICB0aGlzLnJlbW92ZSA9IG11bHRpUmVtb3ZlO1xuICB9XG4gIHRoaXMubm9kZS5fX3ZfZnJhZyA9IHRoaXM7XG59XG5cbi8qKlxuICogQ2FsbCBhdHRhY2gvZGV0YWNoIGZvciBhbGwgY29tcG9uZW50cyBjb250YWluZWQgd2l0aGluXG4gKiB0aGlzIGZyYWdtZW50LiBBbHNvIGRvIHNvIHJlY3Vyc2l2ZWx5IGZvciBhbGwgY2hpbGRcbiAqIGZyYWdtZW50cy5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBob29rXG4gKi9cblxuRnJhZ21lbnQucHJvdG90eXBlLmNhbGxIb29rID0gZnVuY3Rpb24gKGhvb2spIHtcbiAgdmFyIGksIGw7XG4gIGZvciAoaSA9IDAsIGwgPSB0aGlzLmNoaWxkRnJhZ3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdGhpcy5jaGlsZEZyYWdzW2ldLmNhbGxIb29rKGhvb2spO1xuICB9XG4gIGZvciAoaSA9IDAsIGwgPSB0aGlzLmNoaWxkcmVuLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGhvb2sodGhpcy5jaGlsZHJlbltpXSk7XG4gIH1cbn07XG5cbi8qKlxuICogSW5zZXJ0IGZyYWdtZW50IGJlZm9yZSB0YXJnZXQsIHNpbmdsZSBub2RlIHZlcnNpb25cbiAqXG4gKiBAcGFyYW0ge05vZGV9IHRhcmdldFxuICogQHBhcmFtIHtCb29sZWFufSB3aXRoVHJhbnNpdGlvblxuICovXG5cbmZ1bmN0aW9uIHNpbmdsZUJlZm9yZSh0YXJnZXQsIHdpdGhUcmFuc2l0aW9uKSB7XG4gIHRoaXMuaW5zZXJ0ZWQgPSB0cnVlO1xuICB2YXIgbWV0aG9kID0gd2l0aFRyYW5zaXRpb24gIT09IGZhbHNlID8gYmVmb3JlV2l0aFRyYW5zaXRpb24gOiBiZWZvcmU7XG4gIG1ldGhvZCh0aGlzLm5vZGUsIHRhcmdldCwgdGhpcy52bSk7XG4gIGlmIChpbkRvYyh0aGlzLm5vZGUpKSB7XG4gICAgdGhpcy5jYWxsSG9vayhhdHRhY2gpO1xuICB9XG59XG5cbi8qKlxuICogUmVtb3ZlIGZyYWdtZW50LCBzaW5nbGUgbm9kZSB2ZXJzaW9uXG4gKi9cblxuZnVuY3Rpb24gc2luZ2xlUmVtb3ZlKCkge1xuICB0aGlzLmluc2VydGVkID0gZmFsc2U7XG4gIHZhciBzaG91bGRDYWxsUmVtb3ZlID0gaW5Eb2ModGhpcy5ub2RlKTtcbiAgdmFyIHNlbGYgPSB0aGlzO1xuICB0aGlzLmJlZm9yZVJlbW92ZSgpO1xuICByZW1vdmVXaXRoVHJhbnNpdGlvbih0aGlzLm5vZGUsIHRoaXMudm0sIGZ1bmN0aW9uICgpIHtcbiAgICBpZiAoc2hvdWxkQ2FsbFJlbW92ZSkge1xuICAgICAgc2VsZi5jYWxsSG9vayhkZXRhY2gpO1xuICAgIH1cbiAgICBzZWxmLmRlc3Ryb3koKTtcbiAgfSk7XG59XG5cbi8qKlxuICogSW5zZXJ0IGZyYWdtZW50IGJlZm9yZSB0YXJnZXQsIG11bHRpLW5vZGVzIHZlcnNpb25cbiAqXG4gKiBAcGFyYW0ge05vZGV9IHRhcmdldFxuICogQHBhcmFtIHtCb29sZWFufSB3aXRoVHJhbnNpdGlvblxuICovXG5cbmZ1bmN0aW9uIG11bHRpQmVmb3JlKHRhcmdldCwgd2l0aFRyYW5zaXRpb24pIHtcbiAgdGhpcy5pbnNlcnRlZCA9IHRydWU7XG4gIHZhciB2bSA9IHRoaXMudm07XG4gIHZhciBtZXRob2QgPSB3aXRoVHJhbnNpdGlvbiAhPT0gZmFsc2UgPyBiZWZvcmVXaXRoVHJhbnNpdGlvbiA6IGJlZm9yZTtcbiAgbWFwTm9kZVJhbmdlKHRoaXMubm9kZSwgdGhpcy5lbmQsIGZ1bmN0aW9uIChub2RlKSB7XG4gICAgbWV0aG9kKG5vZGUsIHRhcmdldCwgdm0pO1xuICB9KTtcbiAgaWYgKGluRG9jKHRoaXMubm9kZSkpIHtcbiAgICB0aGlzLmNhbGxIb29rKGF0dGFjaCk7XG4gIH1cbn1cblxuLyoqXG4gKiBSZW1vdmUgZnJhZ21lbnQsIG11bHRpLW5vZGVzIHZlcnNpb25cbiAqL1xuXG5mdW5jdGlvbiBtdWx0aVJlbW92ZSgpIHtcbiAgdGhpcy5pbnNlcnRlZCA9IGZhbHNlO1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBzaG91bGRDYWxsUmVtb3ZlID0gaW5Eb2ModGhpcy5ub2RlKTtcbiAgdGhpcy5iZWZvcmVSZW1vdmUoKTtcbiAgcmVtb3ZlTm9kZVJhbmdlKHRoaXMubm9kZSwgdGhpcy5lbmQsIHRoaXMudm0sIHRoaXMuZnJhZywgZnVuY3Rpb24gKCkge1xuICAgIGlmIChzaG91bGRDYWxsUmVtb3ZlKSB7XG4gICAgICBzZWxmLmNhbGxIb29rKGRldGFjaCk7XG4gICAgfVxuICAgIHNlbGYuZGVzdHJveSgpO1xuICB9KTtcbn1cblxuLyoqXG4gKiBQcmVwYXJlIHRoZSBmcmFnbWVudCBmb3IgcmVtb3ZhbC5cbiAqL1xuXG5GcmFnbWVudC5wcm90b3R5cGUuYmVmb3JlUmVtb3ZlID0gZnVuY3Rpb24gKCkge1xuICB2YXIgaSwgbDtcbiAgZm9yIChpID0gMCwgbCA9IHRoaXMuY2hpbGRGcmFncy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAvLyBjYWxsIHRoZSBzYW1lIG1ldGhvZCByZWN1cnNpdmVseSBvbiBjaGlsZFxuICAgIC8vIGZyYWdtZW50cywgZGVwdGgtZmlyc3RcbiAgICB0aGlzLmNoaWxkRnJhZ3NbaV0uYmVmb3JlUmVtb3ZlKGZhbHNlKTtcbiAgfVxuICBmb3IgKGkgPSAwLCBsID0gdGhpcy5jaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAvLyBDYWxsIGRlc3Ryb3kgZm9yIGFsbCBjb250YWluZWQgaW5zdGFuY2VzLFxuICAgIC8vIHdpdGggcmVtb3ZlOmZhbHNlIGFuZCBkZWZlcjp0cnVlLlxuICAgIC8vIERlZmVyIGlzIG5lY2Vzc2FyeSBiZWNhdXNlIHdlIG5lZWQgdG9cbiAgICAvLyBrZWVwIHRoZSBjaGlsZHJlbiB0byBjYWxsIGRldGFjaCBob29rc1xuICAgIC8vIG9uIHRoZW0uXG4gICAgdGhpcy5jaGlsZHJlbltpXS4kZGVzdHJveShmYWxzZSwgdHJ1ZSk7XG4gIH1cbiAgdmFyIGRpcnMgPSB0aGlzLnVubGluay5kaXJzO1xuICBmb3IgKGkgPSAwLCBsID0gZGlycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAvLyBkaXNhYmxlIHRoZSB3YXRjaGVycyBvbiBhbGwgdGhlIGRpcmVjdGl2ZXNcbiAgICAvLyBzbyB0aGF0IHRoZSByZW5kZXJlZCBjb250ZW50IHN0YXlzIHRoZSBzYW1lXG4gICAgLy8gZHVyaW5nIHJlbW92YWwuXG4gICAgZGlyc1tpXS5fd2F0Y2hlciAmJiBkaXJzW2ldLl93YXRjaGVyLnRlYXJkb3duKCk7XG4gIH1cbn07XG5cbi8qKlxuICogRGVzdHJveSB0aGUgZnJhZ21lbnQuXG4gKi9cblxuRnJhZ21lbnQucHJvdG90eXBlLmRlc3Ryb3kgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLnBhcmVudEZyYWcpIHtcbiAgICB0aGlzLnBhcmVudEZyYWcuY2hpbGRGcmFncy4kcmVtb3ZlKHRoaXMpO1xuICB9XG4gIHRoaXMubm9kZS5fX3ZfZnJhZyA9IG51bGw7XG4gIHRoaXMudW5saW5rKCk7XG59O1xuXG4vKipcbiAqIENhbGwgYXR0YWNoIGhvb2sgZm9yIGEgVnVlIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7VnVlfSBjaGlsZFxuICovXG5cbmZ1bmN0aW9uIGF0dGFjaChjaGlsZCkge1xuICBpZiAoIWNoaWxkLl9pc0F0dGFjaGVkICYmIGluRG9jKGNoaWxkLiRlbCkpIHtcbiAgICBjaGlsZC5fY2FsbEhvb2soJ2F0dGFjaGVkJyk7XG4gIH1cbn1cblxuLyoqXG4gKiBDYWxsIGRldGFjaCBob29rIGZvciBhIFZ1ZSBpbnN0YW5jZS5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gY2hpbGRcbiAqL1xuXG5mdW5jdGlvbiBkZXRhY2goY2hpbGQpIHtcbiAgaWYgKGNoaWxkLl9pc0F0dGFjaGVkICYmICFpbkRvYyhjaGlsZC4kZWwpKSB7XG4gICAgY2hpbGQuX2NhbGxIb29rKCdkZXRhY2hlZCcpO1xuICB9XG59XG5cbnZhciBsaW5rZXJDYWNoZSA9IG5ldyBDYWNoZSg1MDAwKTtcblxuLyoqXG4gKiBBIGZhY3RvcnkgdGhhdCBjYW4gYmUgdXNlZCB0byBjcmVhdGUgaW5zdGFuY2VzIG9mIGFcbiAqIGZyYWdtZW50LiBDYWNoZXMgdGhlIGNvbXBpbGVkIGxpbmtlciBpZiBwb3NzaWJsZS5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7RWxlbWVudHxTdHJpbmd9IGVsXG4gKi9cbmZ1bmN0aW9uIEZyYWdtZW50RmFjdG9yeSh2bSwgZWwpIHtcbiAgdGhpcy52bSA9IHZtO1xuICB2YXIgdGVtcGxhdGU7XG4gIHZhciBpc1N0cmluZyA9IHR5cGVvZiBlbCA9PT0gJ3N0cmluZyc7XG4gIGlmIChpc1N0cmluZyB8fCBpc1RlbXBsYXRlKGVsKSAmJiAhZWwuaGFzQXR0cmlidXRlKCd2LWlmJykpIHtcbiAgICB0ZW1wbGF0ZSA9IHBhcnNlVGVtcGxhdGUoZWwsIHRydWUpO1xuICB9IGVsc2Uge1xuICAgIHRlbXBsYXRlID0gZG9jdW1lbnQuY3JlYXRlRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgIHRlbXBsYXRlLmFwcGVuZENoaWxkKGVsKTtcbiAgfVxuICB0aGlzLnRlbXBsYXRlID0gdGVtcGxhdGU7XG4gIC8vIGxpbmtlciBjYW4gYmUgY2FjaGVkLCBidXQgb25seSBmb3IgY29tcG9uZW50c1xuICB2YXIgbGlua2VyO1xuICB2YXIgY2lkID0gdm0uY29uc3RydWN0b3IuY2lkO1xuICBpZiAoY2lkID4gMCkge1xuICAgIHZhciBjYWNoZUlkID0gY2lkICsgKGlzU3RyaW5nID8gZWwgOiBnZXRPdXRlckhUTUwoZWwpKTtcbiAgICBsaW5rZXIgPSBsaW5rZXJDYWNoZS5nZXQoY2FjaGVJZCk7XG4gICAgaWYgKCFsaW5rZXIpIHtcbiAgICAgIGxpbmtlciA9IGNvbXBpbGUodGVtcGxhdGUsIHZtLiRvcHRpb25zLCB0cnVlKTtcbiAgICAgIGxpbmtlckNhY2hlLnB1dChjYWNoZUlkLCBsaW5rZXIpO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBsaW5rZXIgPSBjb21waWxlKHRlbXBsYXRlLCB2bS4kb3B0aW9ucywgdHJ1ZSk7XG4gIH1cbiAgdGhpcy5saW5rZXIgPSBsaW5rZXI7XG59XG5cbi8qKlxuICogQ3JlYXRlIGEgZnJhZ21lbnQgaW5zdGFuY2Ugd2l0aCBnaXZlbiBob3N0IGFuZCBzY29wZS5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gaG9zdFxuICogQHBhcmFtIHtPYmplY3R9IHNjb3BlXG4gKiBAcGFyYW0ge0ZyYWdtZW50fSBwYXJlbnRGcmFnXG4gKi9cblxuRnJhZ21lbnRGYWN0b3J5LnByb3RvdHlwZS5jcmVhdGUgPSBmdW5jdGlvbiAoaG9zdCwgc2NvcGUsIHBhcmVudEZyYWcpIHtcbiAgdmFyIGZyYWcgPSBjbG9uZU5vZGUodGhpcy50ZW1wbGF0ZSk7XG4gIHJldHVybiBuZXcgRnJhZ21lbnQodGhpcy5saW5rZXIsIHRoaXMudm0sIGZyYWcsIGhvc3QsIHNjb3BlLCBwYXJlbnRGcmFnKTtcbn07XG5cbnZhciBPTiA9IDcwMDtcbnZhciBNT0RFTCA9IDgwMDtcbnZhciBCSU5EID0gODUwO1xudmFyIFRSQU5TSVRJT04gPSAxMTAwO1xudmFyIEVMID0gMTUwMDtcbnZhciBDT01QT05FTlQgPSAxNTAwO1xudmFyIFBBUlRJQUwgPSAxNzUwO1xudmFyIElGID0gMjEwMDtcbnZhciBGT1IgPSAyMjAwO1xudmFyIFNMT1QgPSAyMzAwO1xuXG52YXIgdWlkJDMgPSAwO1xuXG52YXIgdkZvciA9IHtcblxuICBwcmlvcml0eTogRk9SLFxuICB0ZXJtaW5hbDogdHJ1ZSxcblxuICBwYXJhbXM6IFsndHJhY2stYnknLCAnc3RhZ2dlcicsICdlbnRlci1zdGFnZ2VyJywgJ2xlYXZlLXN0YWdnZXInXSxcblxuICBiaW5kOiBmdW5jdGlvbiBiaW5kKCkge1xuICAgIC8vIHN1cHBvcnQgXCJpdGVtIGluL29mIGl0ZW1zXCIgc3ludGF4XG4gICAgdmFyIGluTWF0Y2ggPSB0aGlzLmV4cHJlc3Npb24ubWF0Y2goLyguKikgKD86aW58b2YpICguKikvKTtcbiAgICBpZiAoaW5NYXRjaCkge1xuICAgICAgdmFyIGl0TWF0Y2ggPSBpbk1hdGNoWzFdLm1hdGNoKC9cXCgoLiopLCguKilcXCkvKTtcbiAgICAgIGlmIChpdE1hdGNoKSB7XG4gICAgICAgIHRoaXMuaXRlcmF0b3IgPSBpdE1hdGNoWzFdLnRyaW0oKTtcbiAgICAgICAgdGhpcy5hbGlhcyA9IGl0TWF0Y2hbMl0udHJpbSgpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5hbGlhcyA9IGluTWF0Y2hbMV0udHJpbSgpO1xuICAgICAgfVxuICAgICAgdGhpcy5leHByZXNzaW9uID0gaW5NYXRjaFsyXTtcbiAgICB9XG5cbiAgICBpZiAoIXRoaXMuYWxpYXMpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignSW52YWxpZCB2LWZvciBleHByZXNzaW9uIFwiJyArIHRoaXMuZGVzY3JpcHRvci5yYXcgKyAnXCI6ICcgKyAnYWxpYXMgaXMgcmVxdWlyZWQuJywgdGhpcy52bSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gdWlkIGFzIGEgY2FjaGUgaWRlbnRpZmllclxuICAgIHRoaXMuaWQgPSAnX192LWZvcl9fJyArICsrdWlkJDM7XG5cbiAgICAvLyBjaGVjayBpZiB0aGlzIGlzIGFuIG9wdGlvbiBsaXN0LFxuICAgIC8vIHNvIHRoYXQgd2Uga25vdyBpZiB3ZSBuZWVkIHRvIHVwZGF0ZSB0aGUgPHNlbGVjdD4nc1xuICAgIC8vIHYtbW9kZWwgd2hlbiB0aGUgb3B0aW9uIGxpc3QgaGFzIGNoYW5nZWQuXG4gICAgLy8gYmVjYXVzZSB2LW1vZGVsIGhhcyBhIGxvd2VyIHByaW9yaXR5IHRoYW4gdi1mb3IsXG4gICAgLy8gdGhlIHYtbW9kZWwgaXMgbm90IGJvdW5kIGhlcmUgeWV0LCBzbyB3ZSBoYXZlIHRvXG4gICAgLy8gcmV0cml2ZSBpdCBpbiB0aGUgYWN0dWFsIHVwZGF0ZU1vZGVsKCkgZnVuY3Rpb24uXG4gICAgdmFyIHRhZyA9IHRoaXMuZWwudGFnTmFtZTtcbiAgICB0aGlzLmlzT3B0aW9uID0gKHRhZyA9PT0gJ09QVElPTicgfHwgdGFnID09PSAnT1BUR1JPVVAnKSAmJiB0aGlzLmVsLnBhcmVudE5vZGUudGFnTmFtZSA9PT0gJ1NFTEVDVCc7XG5cbiAgICAvLyBzZXR1cCBhbmNob3Igbm9kZXNcbiAgICB0aGlzLnN0YXJ0ID0gY3JlYXRlQW5jaG9yKCd2LWZvci1zdGFydCcpO1xuICAgIHRoaXMuZW5kID0gY3JlYXRlQW5jaG9yKCd2LWZvci1lbmQnKTtcbiAgICByZXBsYWNlKHRoaXMuZWwsIHRoaXMuZW5kKTtcbiAgICBiZWZvcmUodGhpcy5zdGFydCwgdGhpcy5lbmQpO1xuXG4gICAgLy8gY2FjaGVcbiAgICB0aGlzLmNhY2hlID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblxuICAgIC8vIGZyYWdtZW50IGZhY3RvcnlcbiAgICB0aGlzLmZhY3RvcnkgPSBuZXcgRnJhZ21lbnRGYWN0b3J5KHRoaXMudm0sIHRoaXMuZWwpO1xuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gdXBkYXRlKGRhdGEpIHtcbiAgICB0aGlzLmRpZmYoZGF0YSk7XG4gICAgdGhpcy51cGRhdGVSZWYoKTtcbiAgICB0aGlzLnVwZGF0ZU1vZGVsKCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIERpZmYsIGJhc2VkIG9uIG5ldyBkYXRhIGFuZCBvbGQgZGF0YSwgZGV0ZXJtaW5lIHRoZVxuICAgKiBtaW5pbXVtIGFtb3VudCBvZiBET00gbWFuaXB1bGF0aW9ucyBuZWVkZWQgdG8gbWFrZSB0aGVcbiAgICogRE9NIHJlZmxlY3QgdGhlIG5ldyBkYXRhIEFycmF5LlxuICAgKlxuICAgKiBUaGUgYWxnb3JpdGhtIGRpZmZzIHRoZSBuZXcgZGF0YSBBcnJheSBieSBzdG9yaW5nIGFcbiAgICogaGlkZGVuIHJlZmVyZW5jZSB0byBhbiBvd25lciB2bSBpbnN0YW5jZSBvbiBwcmV2aW91c2x5XG4gICAqIHNlZW4gZGF0YS4gVGhpcyBhbGxvd3MgdXMgdG8gYWNoaWV2ZSBPKG4pIHdoaWNoIGlzXG4gICAqIGJldHRlciB0aGFuIGEgbGV2ZW5zaHRlaW4gZGlzdGFuY2UgYmFzZWQgYWxnb3JpdGhtLFxuICAgKiB3aGljaCBpcyBPKG0gKiBuKS5cbiAgICpcbiAgICogQHBhcmFtIHtBcnJheX0gZGF0YVxuICAgKi9cblxuICBkaWZmOiBmdW5jdGlvbiBkaWZmKGRhdGEpIHtcbiAgICAvLyBjaGVjayBpZiB0aGUgQXJyYXkgd2FzIGNvbnZlcnRlZCBmcm9tIGFuIE9iamVjdFxuICAgIHZhciBpdGVtID0gZGF0YVswXTtcbiAgICB2YXIgY29udmVydGVkRnJvbU9iamVjdCA9IHRoaXMuZnJvbU9iamVjdCA9IGlzT2JqZWN0KGl0ZW0pICYmIGhhc093bihpdGVtLCAnJGtleScpICYmIGhhc093bihpdGVtLCAnJHZhbHVlJyk7XG5cbiAgICB2YXIgdHJhY2tCeUtleSA9IHRoaXMucGFyYW1zLnRyYWNrQnk7XG4gICAgdmFyIG9sZEZyYWdzID0gdGhpcy5mcmFncztcbiAgICB2YXIgZnJhZ3MgPSB0aGlzLmZyYWdzID0gbmV3IEFycmF5KGRhdGEubGVuZ3RoKTtcbiAgICB2YXIgYWxpYXMgPSB0aGlzLmFsaWFzO1xuICAgIHZhciBpdGVyYXRvciA9IHRoaXMuaXRlcmF0b3I7XG4gICAgdmFyIHN0YXJ0ID0gdGhpcy5zdGFydDtcbiAgICB2YXIgZW5kID0gdGhpcy5lbmQ7XG4gICAgdmFyIGluRG9jdW1lbnQgPSBpbkRvYyhzdGFydCk7XG4gICAgdmFyIGluaXQgPSAhb2xkRnJhZ3M7XG4gICAgdmFyIGksIGwsIGZyYWcsIGtleSwgdmFsdWUsIHByaW1pdGl2ZTtcblxuICAgIC8vIEZpcnN0IHBhc3MsIGdvIHRocm91Z2ggdGhlIG5ldyBBcnJheSBhbmQgZmlsbCB1cFxuICAgIC8vIHRoZSBuZXcgZnJhZ3MgYXJyYXkuIElmIGEgcGllY2Ugb2YgZGF0YSBoYXMgYSBjYWNoZWRcbiAgICAvLyBpbnN0YW5jZSBmb3IgaXQsIHdlIHJldXNlIGl0LiBPdGhlcndpc2UgYnVpbGQgYSBuZXdcbiAgICAvLyBpbnN0YW5jZS5cbiAgICBmb3IgKGkgPSAwLCBsID0gZGF0YS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGl0ZW0gPSBkYXRhW2ldO1xuICAgICAga2V5ID0gY29udmVydGVkRnJvbU9iamVjdCA/IGl0ZW0uJGtleSA6IG51bGw7XG4gICAgICB2YWx1ZSA9IGNvbnZlcnRlZEZyb21PYmplY3QgPyBpdGVtLiR2YWx1ZSA6IGl0ZW07XG4gICAgICBwcmltaXRpdmUgPSAhaXNPYmplY3QodmFsdWUpO1xuICAgICAgZnJhZyA9ICFpbml0ICYmIHRoaXMuZ2V0Q2FjaGVkRnJhZyh2YWx1ZSwgaSwga2V5KTtcbiAgICAgIGlmIChmcmFnKSB7XG4gICAgICAgIC8vIHJldXNhYmxlIGZyYWdtZW50XG4gICAgICAgIGZyYWcucmV1c2VkID0gdHJ1ZTtcbiAgICAgICAgLy8gdXBkYXRlICRpbmRleFxuICAgICAgICBmcmFnLnNjb3BlLiRpbmRleCA9IGk7XG4gICAgICAgIC8vIHVwZGF0ZSAka2V5XG4gICAgICAgIGlmIChrZXkpIHtcbiAgICAgICAgICBmcmFnLnNjb3BlLiRrZXkgPSBrZXk7XG4gICAgICAgIH1cbiAgICAgICAgLy8gdXBkYXRlIGl0ZXJhdG9yXG4gICAgICAgIGlmIChpdGVyYXRvcikge1xuICAgICAgICAgIGZyYWcuc2NvcGVbaXRlcmF0b3JdID0ga2V5ICE9PSBudWxsID8ga2V5IDogaTtcbiAgICAgICAgfVxuICAgICAgICAvLyB1cGRhdGUgZGF0YSBmb3IgdHJhY2stYnksIG9iamVjdCByZXBlYXQgJlxuICAgICAgICAvLyBwcmltaXRpdmUgdmFsdWVzLlxuICAgICAgICBpZiAodHJhY2tCeUtleSB8fCBjb252ZXJ0ZWRGcm9tT2JqZWN0IHx8IHByaW1pdGl2ZSkge1xuICAgICAgICAgIHdpdGhvdXRDb252ZXJzaW9uKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgICAgIGZyYWcuc2NvcGVbYWxpYXNdID0gdmFsdWU7XG4gICAgICAgICAgfSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIG5ldyBpc250YW5jZVxuICAgICAgICBmcmFnID0gdGhpcy5jcmVhdGUodmFsdWUsIGFsaWFzLCBpLCBrZXkpO1xuICAgICAgICBmcmFnLmZyZXNoID0gIWluaXQ7XG4gICAgICB9XG4gICAgICBmcmFnc1tpXSA9IGZyYWc7XG4gICAgICBpZiAoaW5pdCkge1xuICAgICAgICBmcmFnLmJlZm9yZShlbmQpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIHdlJ3JlIGRvbmUgZm9yIHRoZSBpbml0aWFsIHJlbmRlci5cbiAgICBpZiAoaW5pdCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFNlY29uZCBwYXNzLCBnbyB0aHJvdWdoIHRoZSBvbGQgZnJhZ21lbnRzIGFuZFxuICAgIC8vIGRlc3Ryb3kgdGhvc2Ugd2hvIGFyZSBub3QgcmV1c2VkIChhbmQgcmVtb3ZlIHRoZW1cbiAgICAvLyBmcm9tIGNhY2hlKVxuICAgIHZhciByZW1vdmFsSW5kZXggPSAwO1xuICAgIHZhciB0b3RhbFJlbW92ZWQgPSBvbGRGcmFncy5sZW5ndGggLSBmcmFncy5sZW5ndGg7XG4gICAgLy8gd2hlbiByZW1vdmluZyBhIGxhcmdlIG51bWJlciBvZiBmcmFnbWVudHMsIHdhdGNoZXIgcmVtb3ZhbFxuICAgIC8vIHR1cm5zIG91dCB0byBiZSBhIHBlcmYgYm90dGxlbmVjaywgc28gd2UgYmF0Y2ggdGhlIHdhdGNoZXJcbiAgICAvLyByZW1vdmFscyBpbnRvIGEgc2luZ2xlIGZpbHRlciBjYWxsIVxuICAgIHRoaXMudm0uX3ZGb3JSZW1vdmluZyA9IHRydWU7XG4gICAgZm9yIChpID0gMCwgbCA9IG9sZEZyYWdzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgZnJhZyA9IG9sZEZyYWdzW2ldO1xuICAgICAgaWYgKCFmcmFnLnJldXNlZCkge1xuICAgICAgICB0aGlzLmRlbGV0ZUNhY2hlZEZyYWcoZnJhZyk7XG4gICAgICAgIHRoaXMucmVtb3ZlKGZyYWcsIHJlbW92YWxJbmRleCsrLCB0b3RhbFJlbW92ZWQsIGluRG9jdW1lbnQpO1xuICAgICAgfVxuICAgIH1cbiAgICB0aGlzLnZtLl92Rm9yUmVtb3ZpbmcgPSBmYWxzZTtcbiAgICBpZiAocmVtb3ZhbEluZGV4KSB7XG4gICAgICB0aGlzLnZtLl93YXRjaGVycyA9IHRoaXMudm0uX3dhdGNoZXJzLmZpbHRlcihmdW5jdGlvbiAodykge1xuICAgICAgICByZXR1cm4gdy5hY3RpdmU7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBGaW5hbCBwYXNzLCBtb3ZlL2luc2VydCBuZXcgZnJhZ21lbnRzIGludG8gdGhlXG4gICAgLy8gcmlnaHQgcGxhY2UuXG4gICAgdmFyIHRhcmdldFByZXYsIHByZXZFbCwgY3VycmVudFByZXY7XG4gICAgdmFyIGluc2VydGlvbkluZGV4ID0gMDtcbiAgICBmb3IgKGkgPSAwLCBsID0gZnJhZ3MubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICBmcmFnID0gZnJhZ3NbaV07XG4gICAgICAvLyB0aGlzIGlzIHRoZSBmcmFnIHRoYXQgd2Ugc2hvdWxkIGJlIGFmdGVyXG4gICAgICB0YXJnZXRQcmV2ID0gZnJhZ3NbaSAtIDFdO1xuICAgICAgcHJldkVsID0gdGFyZ2V0UHJldiA/IHRhcmdldFByZXYuc3RhZ2dlckNiID8gdGFyZ2V0UHJldi5zdGFnZ2VyQW5jaG9yIDogdGFyZ2V0UHJldi5lbmQgfHwgdGFyZ2V0UHJldi5ub2RlIDogc3RhcnQ7XG4gICAgICBpZiAoZnJhZy5yZXVzZWQgJiYgIWZyYWcuc3RhZ2dlckNiKSB7XG4gICAgICAgIGN1cnJlbnRQcmV2ID0gZmluZFByZXZGcmFnKGZyYWcsIHN0YXJ0LCB0aGlzLmlkKTtcbiAgICAgICAgaWYgKGN1cnJlbnRQcmV2ICE9PSB0YXJnZXRQcmV2ICYmICghY3VycmVudFByZXYgfHxcbiAgICAgICAgLy8gb3B0aW1pemF0aW9uIGZvciBtb3ZpbmcgYSBzaW5nbGUgaXRlbS5cbiAgICAgICAgLy8gdGhhbmtzIHRvIHN1Z2dlc3Rpb25zIGJ5IEBsaXZvcmFzIGluICMxODA3XG4gICAgICAgIGZpbmRQcmV2RnJhZyhjdXJyZW50UHJldiwgc3RhcnQsIHRoaXMuaWQpICE9PSB0YXJnZXRQcmV2KSkge1xuICAgICAgICAgIHRoaXMubW92ZShmcmFnLCBwcmV2RWwpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvLyBuZXcgaW5zdGFuY2UsIG9yIHN0aWxsIGluIHN0YWdnZXIuXG4gICAgICAgIC8vIGluc2VydCB3aXRoIHVwZGF0ZWQgc3RhZ2dlciBpbmRleC5cbiAgICAgICAgdGhpcy5pbnNlcnQoZnJhZywgaW5zZXJ0aW9uSW5kZXgrKywgcHJldkVsLCBpbkRvY3VtZW50KTtcbiAgICAgIH1cbiAgICAgIGZyYWcucmV1c2VkID0gZnJhZy5mcmVzaCA9IGZhbHNlO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQ3JlYXRlIGEgbmV3IGZyYWdtZW50IGluc3RhbmNlLlxuICAgKlxuICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBhbGlhc1xuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtrZXldXG4gICAqIEByZXR1cm4ge0ZyYWdtZW50fVxuICAgKi9cblxuICBjcmVhdGU6IGZ1bmN0aW9uIGNyZWF0ZSh2YWx1ZSwgYWxpYXMsIGluZGV4LCBrZXkpIHtcbiAgICB2YXIgaG9zdCA9IHRoaXMuX2hvc3Q7XG4gICAgLy8gY3JlYXRlIGl0ZXJhdGlvbiBzY29wZVxuICAgIHZhciBwYXJlbnRTY29wZSA9IHRoaXMuX3Njb3BlIHx8IHRoaXMudm07XG4gICAgdmFyIHNjb3BlID0gT2JqZWN0LmNyZWF0ZShwYXJlbnRTY29wZSk7XG4gICAgLy8gcmVmIGhvbGRlciBmb3IgdGhlIHNjb3BlXG4gICAgc2NvcGUuJHJlZnMgPSBPYmplY3QuY3JlYXRlKHBhcmVudFNjb3BlLiRyZWZzKTtcbiAgICBzY29wZS4kZWxzID0gT2JqZWN0LmNyZWF0ZShwYXJlbnRTY29wZS4kZWxzKTtcbiAgICAvLyBtYWtlIHN1cmUgcG9pbnQgJHBhcmVudCB0byBwYXJlbnQgc2NvcGVcbiAgICBzY29wZS4kcGFyZW50ID0gcGFyZW50U2NvcGU7XG4gICAgLy8gZm9yIHR3by13YXkgYmluZGluZyBvbiBhbGlhc1xuICAgIHNjb3BlLiRmb3JDb250ZXh0ID0gdGhpcztcbiAgICAvLyBkZWZpbmUgc2NvcGUgcHJvcGVydGllc1xuICAgIC8vIGltcG9ydGFudDogZGVmaW5lIHRoZSBzY29wZSBhbGlhcyB3aXRob3V0IGZvcmNlZCBjb252ZXJzaW9uXG4gICAgLy8gc28gdGhhdCBmcm96ZW4gZGF0YSBzdHJ1Y3R1cmVzIHJlbWFpbiBub24tcmVhY3RpdmUuXG4gICAgd2l0aG91dENvbnZlcnNpb24oZnVuY3Rpb24gKCkge1xuICAgICAgZGVmaW5lUmVhY3RpdmUoc2NvcGUsIGFsaWFzLCB2YWx1ZSk7XG4gICAgfSk7XG4gICAgZGVmaW5lUmVhY3RpdmUoc2NvcGUsICckaW5kZXgnLCBpbmRleCk7XG4gICAgaWYgKGtleSkge1xuICAgICAgZGVmaW5lUmVhY3RpdmUoc2NvcGUsICcka2V5Jywga2V5KTtcbiAgICB9IGVsc2UgaWYgKHNjb3BlLiRrZXkpIHtcbiAgICAgIC8vIGF2b2lkIGFjY2lkZW50YWwgZmFsbGJhY2tcbiAgICAgIGRlZihzY29wZSwgJyRrZXknLCBudWxsKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuaXRlcmF0b3IpIHtcbiAgICAgIGRlZmluZVJlYWN0aXZlKHNjb3BlLCB0aGlzLml0ZXJhdG9yLCBrZXkgIT09IG51bGwgPyBrZXkgOiBpbmRleCk7XG4gICAgfVxuICAgIHZhciBmcmFnID0gdGhpcy5mYWN0b3J5LmNyZWF0ZShob3N0LCBzY29wZSwgdGhpcy5fZnJhZyk7XG4gICAgZnJhZy5mb3JJZCA9IHRoaXMuaWQ7XG4gICAgdGhpcy5jYWNoZUZyYWcodmFsdWUsIGZyYWcsIGluZGV4LCBrZXkpO1xuICAgIHJldHVybiBmcmFnO1xuICB9LFxuXG4gIC8qKlxuICAgKiBVcGRhdGUgdGhlIHYtcmVmIG9uIG93bmVyIHZtLlxuICAgKi9cblxuICB1cGRhdGVSZWY6IGZ1bmN0aW9uIHVwZGF0ZVJlZigpIHtcbiAgICB2YXIgcmVmID0gdGhpcy5kZXNjcmlwdG9yLnJlZjtcbiAgICBpZiAoIXJlZikgcmV0dXJuO1xuICAgIHZhciBoYXNoID0gKHRoaXMuX3Njb3BlIHx8IHRoaXMudm0pLiRyZWZzO1xuICAgIHZhciByZWZzO1xuICAgIGlmICghdGhpcy5mcm9tT2JqZWN0KSB7XG4gICAgICByZWZzID0gdGhpcy5mcmFncy5tYXAoZmluZFZtRnJvbUZyYWcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZWZzID0ge307XG4gICAgICB0aGlzLmZyYWdzLmZvckVhY2goZnVuY3Rpb24gKGZyYWcpIHtcbiAgICAgICAgcmVmc1tmcmFnLnNjb3BlLiRrZXldID0gZmluZFZtRnJvbUZyYWcoZnJhZyk7XG4gICAgICB9KTtcbiAgICB9XG4gICAgaGFzaFtyZWZdID0gcmVmcztcbiAgfSxcblxuICAvKipcbiAgICogRm9yIG9wdGlvbiBsaXN0cywgdXBkYXRlIHRoZSBjb250YWluaW5nIHYtbW9kZWwgb25cbiAgICogcGFyZW50IDxzZWxlY3Q+LlxuICAgKi9cblxuICB1cGRhdGVNb2RlbDogZnVuY3Rpb24gdXBkYXRlTW9kZWwoKSB7XG4gICAgaWYgKHRoaXMuaXNPcHRpb24pIHtcbiAgICAgIHZhciBwYXJlbnQgPSB0aGlzLnN0YXJ0LnBhcmVudE5vZGU7XG4gICAgICB2YXIgbW9kZWwgPSBwYXJlbnQgJiYgcGFyZW50Ll9fdl9tb2RlbDtcbiAgICAgIGlmIChtb2RlbCkge1xuICAgICAgICBtb2RlbC5mb3JjZVVwZGF0ZSgpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogSW5zZXJ0IGEgZnJhZ21lbnQuIEhhbmRsZXMgc3RhZ2dlcmluZy5cbiAgICpcbiAgICogQHBhcmFtIHtGcmFnbWVudH0gZnJhZ1xuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICogQHBhcmFtIHtOb2RlfSBwcmV2RWxcbiAgICogQHBhcmFtIHtCb29sZWFufSBpbkRvY3VtZW50XG4gICAqL1xuXG4gIGluc2VydDogZnVuY3Rpb24gaW5zZXJ0KGZyYWcsIGluZGV4LCBwcmV2RWwsIGluRG9jdW1lbnQpIHtcbiAgICBpZiAoZnJhZy5zdGFnZ2VyQ2IpIHtcbiAgICAgIGZyYWcuc3RhZ2dlckNiLmNhbmNlbCgpO1xuICAgICAgZnJhZy5zdGFnZ2VyQ2IgPSBudWxsO1xuICAgIH1cbiAgICB2YXIgc3RhZ2dlckFtb3VudCA9IHRoaXMuZ2V0U3RhZ2dlcihmcmFnLCBpbmRleCwgbnVsbCwgJ2VudGVyJyk7XG4gICAgaWYgKGluRG9jdW1lbnQgJiYgc3RhZ2dlckFtb3VudCkge1xuICAgICAgLy8gY3JlYXRlIGFuIGFuY2hvciBhbmQgaW5zZXJ0IGl0IHN5bmNocm9ub3VzbHksXG4gICAgICAvLyBzbyB0aGF0IHdlIGNhbiByZXNvbHZlIHRoZSBjb3JyZWN0IG9yZGVyIHdpdGhvdXRcbiAgICAgIC8vIHdvcnJ5aW5nIGFib3V0IHNvbWUgZWxlbWVudHMgbm90IGluc2VydGVkIHlldFxuICAgICAgdmFyIGFuY2hvciA9IGZyYWcuc3RhZ2dlckFuY2hvcjtcbiAgICAgIGlmICghYW5jaG9yKSB7XG4gICAgICAgIGFuY2hvciA9IGZyYWcuc3RhZ2dlckFuY2hvciA9IGNyZWF0ZUFuY2hvcignc3RhZ2dlci1hbmNob3InKTtcbiAgICAgICAgYW5jaG9yLl9fdl9mcmFnID0gZnJhZztcbiAgICAgIH1cbiAgICAgIGFmdGVyKGFuY2hvciwgcHJldkVsKTtcbiAgICAgIHZhciBvcCA9IGZyYWcuc3RhZ2dlckNiID0gY2FuY2VsbGFibGUoZnVuY3Rpb24gKCkge1xuICAgICAgICBmcmFnLnN0YWdnZXJDYiA9IG51bGw7XG4gICAgICAgIGZyYWcuYmVmb3JlKGFuY2hvcik7XG4gICAgICAgIHJlbW92ZShhbmNob3IpO1xuICAgICAgfSk7XG4gICAgICBzZXRUaW1lb3V0KG9wLCBzdGFnZ2VyQW1vdW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHRhcmdldCA9IHByZXZFbC5uZXh0U2libGluZztcbiAgICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgICAgaWYgKCF0YXJnZXQpIHtcbiAgICAgICAgLy8gcmVzZXQgZW5kIGFuY2hvciBwb3NpdGlvbiBpbiBjYXNlIHRoZSBwb3NpdGlvbiB3YXMgbWVzc2VkIHVwXG4gICAgICAgIC8vIGJ5IGFuIGV4dGVybmFsIGRyYWctbi1kcm9wIGxpYnJhcnkuXG4gICAgICAgIGFmdGVyKHRoaXMuZW5kLCBwcmV2RWwpO1xuICAgICAgICB0YXJnZXQgPSB0aGlzLmVuZDtcbiAgICAgIH1cbiAgICAgIGZyYWcuYmVmb3JlKHRhcmdldCk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBSZW1vdmUgYSBmcmFnbWVudC4gSGFuZGxlcyBzdGFnZ2VyaW5nLlxuICAgKlxuICAgKiBAcGFyYW0ge0ZyYWdtZW50fSBmcmFnXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBpbmRleFxuICAgKiBAcGFyYW0ge051bWJlcn0gdG90YWxcbiAgICogQHBhcmFtIHtCb29sZWFufSBpbkRvY3VtZW50XG4gICAqL1xuXG4gIHJlbW92ZTogZnVuY3Rpb24gcmVtb3ZlKGZyYWcsIGluZGV4LCB0b3RhbCwgaW5Eb2N1bWVudCkge1xuICAgIGlmIChmcmFnLnN0YWdnZXJDYikge1xuICAgICAgZnJhZy5zdGFnZ2VyQ2IuY2FuY2VsKCk7XG4gICAgICBmcmFnLnN0YWdnZXJDYiA9IG51bGw7XG4gICAgICAvLyBpdCdzIG5vdCBwb3NzaWJsZSBmb3IgdGhlIHNhbWUgZnJhZyB0byBiZSByZW1vdmVkXG4gICAgICAvLyB0d2ljZSwgc28gaWYgd2UgaGF2ZSBhIHBlbmRpbmcgc3RhZ2dlciBjYWxsYmFjayxcbiAgICAgIC8vIGl0IG1lYW5zIHRoaXMgZnJhZyBpcyBxdWV1ZWQgZm9yIGVudGVyIGJ1dCByZW1vdmVkXG4gICAgICAvLyBiZWZvcmUgaXRzIHRyYW5zaXRpb24gc3RhcnRlZC4gU2luY2UgaXQgaXMgYWxyZWFkeVxuICAgICAgLy8gZGVzdHJveWVkLCB3ZSBjYW4ganVzdCBsZWF2ZSBpdCBpbiBkZXRhY2hlZCBzdGF0ZS5cbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIHN0YWdnZXJBbW91bnQgPSB0aGlzLmdldFN0YWdnZXIoZnJhZywgaW5kZXgsIHRvdGFsLCAnbGVhdmUnKTtcbiAgICBpZiAoaW5Eb2N1bWVudCAmJiBzdGFnZ2VyQW1vdW50KSB7XG4gICAgICB2YXIgb3AgPSBmcmFnLnN0YWdnZXJDYiA9IGNhbmNlbGxhYmxlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgZnJhZy5zdGFnZ2VyQ2IgPSBudWxsO1xuICAgICAgICBmcmFnLnJlbW92ZSgpO1xuICAgICAgfSk7XG4gICAgICBzZXRUaW1lb3V0KG9wLCBzdGFnZ2VyQW1vdW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgZnJhZy5yZW1vdmUoKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIE1vdmUgYSBmcmFnbWVudCB0byBhIG5ldyBwb3NpdGlvbi5cbiAgICogRm9yY2Ugbm8gdHJhbnNpdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIHtGcmFnbWVudH0gZnJhZ1xuICAgKiBAcGFyYW0ge05vZGV9IHByZXZFbFxuICAgKi9cblxuICBtb3ZlOiBmdW5jdGlvbiBtb3ZlKGZyYWcsIHByZXZFbCkge1xuICAgIC8vIGZpeCBhIGNvbW1vbiBpc3N1ZSB3aXRoIFNvcnRhYmxlOlxuICAgIC8vIGlmIHByZXZFbCBkb2Vzbid0IGhhdmUgbmV4dFNpYmxpbmcsIHRoaXMgbWVhbnMgaXQnc1xuICAgIC8vIGJlZW4gZHJhZ2dlZCBhZnRlciB0aGUgZW5kIGFuY2hvci4gSnVzdCByZS1wb3NpdGlvblxuICAgIC8vIHRoZSBlbmQgYW5jaG9yIHRvIHRoZSBlbmQgb2YgdGhlIGNvbnRhaW5lci5cbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoIXByZXZFbC5uZXh0U2libGluZykge1xuICAgICAgdGhpcy5lbmQucGFyZW50Tm9kZS5hcHBlbmRDaGlsZCh0aGlzLmVuZCk7XG4gICAgfVxuICAgIGZyYWcuYmVmb3JlKHByZXZFbC5uZXh0U2libGluZywgZmFsc2UpO1xuICB9LFxuXG4gIC8qKlxuICAgKiBDYWNoZSBhIGZyYWdtZW50IHVzaW5nIHRyYWNrLWJ5IG9yIHRoZSBvYmplY3Qga2V5LlxuICAgKlxuICAgKiBAcGFyYW0geyp9IHZhbHVlXG4gICAqIEBwYXJhbSB7RnJhZ21lbnR9IGZyYWdcbiAgICogQHBhcmFtIHtOdW1iZXJ9IGluZGV4XG4gICAqIEBwYXJhbSB7U3RyaW5nfSBba2V5XVxuICAgKi9cblxuICBjYWNoZUZyYWc6IGZ1bmN0aW9uIGNhY2hlRnJhZyh2YWx1ZSwgZnJhZywgaW5kZXgsIGtleSkge1xuICAgIHZhciB0cmFja0J5S2V5ID0gdGhpcy5wYXJhbXMudHJhY2tCeTtcbiAgICB2YXIgY2FjaGUgPSB0aGlzLmNhY2hlO1xuICAgIHZhciBwcmltaXRpdmUgPSAhaXNPYmplY3QodmFsdWUpO1xuICAgIHZhciBpZDtcbiAgICBpZiAoa2V5IHx8IHRyYWNrQnlLZXkgfHwgcHJpbWl0aXZlKSB7XG4gICAgICBpZCA9IGdldFRyYWNrQnlLZXkoaW5kZXgsIGtleSwgdmFsdWUsIHRyYWNrQnlLZXkpO1xuICAgICAgaWYgKCFjYWNoZVtpZF0pIHtcbiAgICAgICAgY2FjaGVbaWRdID0gZnJhZztcbiAgICAgIH0gZWxzZSBpZiAodHJhY2tCeUtleSAhPT0gJyRpbmRleCcpIHtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB0aGlzLndhcm5EdXBsaWNhdGUodmFsdWUpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBpZCA9IHRoaXMuaWQ7XG4gICAgICBpZiAoaGFzT3duKHZhbHVlLCBpZCkpIHtcbiAgICAgICAgaWYgKHZhbHVlW2lkXSA9PT0gbnVsbCkge1xuICAgICAgICAgIHZhbHVlW2lkXSA9IGZyYWc7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB0aGlzLndhcm5EdXBsaWNhdGUodmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKE9iamVjdC5pc0V4dGVuc2libGUodmFsdWUpKSB7XG4gICAgICAgIGRlZih2YWx1ZSwgaWQsIGZyYWcpO1xuICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIHdhcm4oJ0Zyb3plbiB2LWZvciBvYmplY3RzIGNhbm5vdCBiZSBhdXRvbWF0aWNhbGx5IHRyYWNrZWQsIG1ha2Ugc3VyZSB0byAnICsgJ3Byb3ZpZGUgYSB0cmFjay1ieSBrZXkuJyk7XG4gICAgICB9XG4gICAgfVxuICAgIGZyYWcucmF3ID0gdmFsdWU7XG4gIH0sXG5cbiAgLyoqXG4gICAqIEdldCBhIGNhY2hlZCBmcmFnbWVudCBmcm9tIHRoZSB2YWx1ZS9pbmRleC9rZXlcbiAgICpcbiAgICogQHBhcmFtIHsqfSB2YWx1ZVxuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICAgKiBAcmV0dXJuIHtGcmFnbWVudH1cbiAgICovXG5cbiAgZ2V0Q2FjaGVkRnJhZzogZnVuY3Rpb24gZ2V0Q2FjaGVkRnJhZyh2YWx1ZSwgaW5kZXgsIGtleSkge1xuICAgIHZhciB0cmFja0J5S2V5ID0gdGhpcy5wYXJhbXMudHJhY2tCeTtcbiAgICB2YXIgcHJpbWl0aXZlID0gIWlzT2JqZWN0KHZhbHVlKTtcbiAgICB2YXIgZnJhZztcbiAgICBpZiAoa2V5IHx8IHRyYWNrQnlLZXkgfHwgcHJpbWl0aXZlKSB7XG4gICAgICB2YXIgaWQgPSBnZXRUcmFja0J5S2V5KGluZGV4LCBrZXksIHZhbHVlLCB0cmFja0J5S2V5KTtcbiAgICAgIGZyYWcgPSB0aGlzLmNhY2hlW2lkXTtcbiAgICB9IGVsc2Uge1xuICAgICAgZnJhZyA9IHZhbHVlW3RoaXMuaWRdO1xuICAgIH1cbiAgICBpZiAoZnJhZyAmJiAoZnJhZy5yZXVzZWQgfHwgZnJhZy5mcmVzaCkpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgdGhpcy53YXJuRHVwbGljYXRlKHZhbHVlKTtcbiAgICB9XG4gICAgcmV0dXJuIGZyYWc7XG4gIH0sXG5cbiAgLyoqXG4gICAqIERlbGV0ZSBhIGZyYWdtZW50IGZyb20gY2FjaGUuXG4gICAqXG4gICAqIEBwYXJhbSB7RnJhZ21lbnR9IGZyYWdcbiAgICovXG5cbiAgZGVsZXRlQ2FjaGVkRnJhZzogZnVuY3Rpb24gZGVsZXRlQ2FjaGVkRnJhZyhmcmFnKSB7XG4gICAgdmFyIHZhbHVlID0gZnJhZy5yYXc7XG4gICAgdmFyIHRyYWNrQnlLZXkgPSB0aGlzLnBhcmFtcy50cmFja0J5O1xuICAgIHZhciBzY29wZSA9IGZyYWcuc2NvcGU7XG4gICAgdmFyIGluZGV4ID0gc2NvcGUuJGluZGV4O1xuICAgIC8vIGZpeCAjOTQ4OiBhdm9pZCBhY2NpZGVudGFsbHkgZmFsbCB0aHJvdWdoIHRvXG4gICAgLy8gYSBwYXJlbnQgcmVwZWF0ZXIgd2hpY2ggaGFwcGVucyB0byBoYXZlICRrZXkuXG4gICAgdmFyIGtleSA9IGhhc093bihzY29wZSwgJyRrZXknKSAmJiBzY29wZS4ka2V5O1xuICAgIHZhciBwcmltaXRpdmUgPSAhaXNPYmplY3QodmFsdWUpO1xuICAgIGlmICh0cmFja0J5S2V5IHx8IGtleSB8fCBwcmltaXRpdmUpIHtcbiAgICAgIHZhciBpZCA9IGdldFRyYWNrQnlLZXkoaW5kZXgsIGtleSwgdmFsdWUsIHRyYWNrQnlLZXkpO1xuICAgICAgdGhpcy5jYWNoZVtpZF0gPSBudWxsO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YWx1ZVt0aGlzLmlkXSA9IG51bGw7XG4gICAgICBmcmFnLnJhdyA9IG51bGw7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIHN0YWdnZXIgYW1vdW50IGZvciBhbiBpbnNlcnRpb24vcmVtb3ZhbC5cbiAgICpcbiAgICogQHBhcmFtIHtGcmFnbWVudH0gZnJhZ1xuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZXhcbiAgICogQHBhcmFtIHtOdW1iZXJ9IHRvdGFsXG4gICAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gICAqL1xuXG4gIGdldFN0YWdnZXI6IGZ1bmN0aW9uIGdldFN0YWdnZXIoZnJhZywgaW5kZXgsIHRvdGFsLCB0eXBlKSB7XG4gICAgdHlwZSA9IHR5cGUgKyAnU3RhZ2dlcic7XG4gICAgdmFyIHRyYW5zID0gZnJhZy5ub2RlLl9fdl90cmFucztcbiAgICB2YXIgaG9va3MgPSB0cmFucyAmJiB0cmFucy5ob29rcztcbiAgICB2YXIgaG9vayA9IGhvb2tzICYmIChob29rc1t0eXBlXSB8fCBob29rcy5zdGFnZ2VyKTtcbiAgICByZXR1cm4gaG9vayA/IGhvb2suY2FsbChmcmFnLCBpbmRleCwgdG90YWwpIDogaW5kZXggKiBwYXJzZUludCh0aGlzLnBhcmFtc1t0eXBlXSB8fCB0aGlzLnBhcmFtcy5zdGFnZ2VyLCAxMCk7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFByZS1wcm9jZXNzIHRoZSB2YWx1ZSBiZWZvcmUgcGlwaW5nIGl0IHRocm91Z2ggdGhlXG4gICAqIGZpbHRlcnMuIFRoaXMgaXMgcGFzc2VkIHRvIGFuZCBjYWxsZWQgYnkgdGhlIHdhdGNoZXIuXG4gICAqL1xuXG4gIF9wcmVQcm9jZXNzOiBmdW5jdGlvbiBfcHJlUHJvY2Vzcyh2YWx1ZSkge1xuICAgIC8vIHJlZ2FyZGxlc3Mgb2YgdHlwZSwgc3RvcmUgdGhlIHVuLWZpbHRlcmVkIHJhdyB2YWx1ZS5cbiAgICB0aGlzLnJhd1ZhbHVlID0gdmFsdWU7XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9LFxuXG4gIC8qKlxuICAgKiBQb3N0LXByb2Nlc3MgdGhlIHZhbHVlIGFmdGVyIGl0IGhhcyBiZWVuIHBpcGVkIHRocm91Z2hcbiAgICogdGhlIGZpbHRlcnMuIFRoaXMgaXMgcGFzc2VkIHRvIGFuZCBjYWxsZWQgYnkgdGhlIHdhdGNoZXIuXG4gICAqXG4gICAqIEl0IGlzIG5lY2Vzc2FyeSBmb3IgdGhpcyB0byBiZSBjYWxsZWQgZHVyaW5nIHRoZVxuICAgKiB3YXRoY2VyJ3MgZGVwZW5kZW5jeSBjb2xsZWN0aW9uIHBoYXNlIGJlY2F1c2Ugd2Ugd2FudFxuICAgKiB0aGUgdi1mb3IgdG8gdXBkYXRlIHdoZW4gdGhlIHNvdXJjZSBPYmplY3QgaXMgbXV0YXRlZC5cbiAgICovXG5cbiAgX3Bvc3RQcm9jZXNzOiBmdW5jdGlvbiBfcG9zdFByb2Nlc3ModmFsdWUpIHtcbiAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9IGVsc2UgaWYgKGlzUGxhaW5PYmplY3QodmFsdWUpKSB7XG4gICAgICAvLyBjb252ZXJ0IHBsYWluIG9iamVjdCB0byBhcnJheS5cbiAgICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModmFsdWUpO1xuICAgICAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgICAgIHZhciByZXMgPSBuZXcgQXJyYXkoaSk7XG4gICAgICB2YXIga2V5O1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBrZXkgPSBrZXlzW2ldO1xuICAgICAgICByZXNbaV0gPSB7XG4gICAgICAgICAgJGtleToga2V5LFxuICAgICAgICAgICR2YWx1ZTogdmFsdWVba2V5XVxuICAgICAgICB9O1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJlcztcbiAgICB9IGVsc2Uge1xuICAgICAgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgJiYgIWlzTmFOKHZhbHVlKSkge1xuICAgICAgICB2YWx1ZSA9IHJhbmdlKHZhbHVlKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWx1ZSB8fCBbXTtcbiAgICB9XG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgaWYgKHRoaXMuZGVzY3JpcHRvci5yZWYpIHtcbiAgICAgICh0aGlzLl9zY29wZSB8fCB0aGlzLnZtKS4kcmVmc1t0aGlzLmRlc2NyaXB0b3IucmVmXSA9IG51bGw7XG4gICAgfVxuICAgIGlmICh0aGlzLmZyYWdzKSB7XG4gICAgICB2YXIgaSA9IHRoaXMuZnJhZ3MubGVuZ3RoO1xuICAgICAgdmFyIGZyYWc7XG4gICAgICB3aGlsZSAoaS0tKSB7XG4gICAgICAgIGZyYWcgPSB0aGlzLmZyYWdzW2ldO1xuICAgICAgICB0aGlzLmRlbGV0ZUNhY2hlZEZyYWcoZnJhZyk7XG4gICAgICAgIGZyYWcuZGVzdHJveSgpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiBIZWxwZXIgdG8gZmluZCB0aGUgcHJldmlvdXMgZWxlbWVudCB0aGF0IGlzIGEgZnJhZ21lbnRcbiAqIGFuY2hvci4gVGhpcyBpcyBuZWNlc3NhcnkgYmVjYXVzZSBhIGRlc3Ryb3llZCBmcmFnJ3NcbiAqIGVsZW1lbnQgY291bGQgc3RpbGwgYmUgbGluZ2VyaW5nIGluIHRoZSBET00gYmVmb3JlIGl0c1xuICogbGVhdmluZyB0cmFuc2l0aW9uIGZpbmlzaGVzLCBidXQgaXRzIGluc2VydGVkIGZsYWdcbiAqIHNob3VsZCBoYXZlIGJlZW4gc2V0IHRvIGZhbHNlIHNvIHdlIGNhbiBza2lwIHRoZW0uXG4gKlxuICogSWYgdGhpcyBpcyBhIGJsb2NrIHJlcGVhdCwgd2Ugd2FudCB0byBtYWtlIHN1cmUgd2Ugb25seVxuICogcmV0dXJuIGZyYWcgdGhhdCBpcyBib3VuZCB0byB0aGlzIHYtZm9yLiAoc2VlICM5MjkpXG4gKlxuICogQHBhcmFtIHtGcmFnbWVudH0gZnJhZ1xuICogQHBhcmFtIHtDb21tZW50fFRleHR9IGFuY2hvclxuICogQHBhcmFtIHtTdHJpbmd9IGlkXG4gKiBAcmV0dXJuIHtGcmFnbWVudH1cbiAqL1xuXG5mdW5jdGlvbiBmaW5kUHJldkZyYWcoZnJhZywgYW5jaG9yLCBpZCkge1xuICB2YXIgZWwgPSBmcmFnLm5vZGUucHJldmlvdXNTaWJsaW5nO1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKCFlbCkgcmV0dXJuO1xuICBmcmFnID0gZWwuX192X2ZyYWc7XG4gIHdoaWxlICgoIWZyYWcgfHwgZnJhZy5mb3JJZCAhPT0gaWQgfHwgIWZyYWcuaW5zZXJ0ZWQpICYmIGVsICE9PSBhbmNob3IpIHtcbiAgICBlbCA9IGVsLnByZXZpb3VzU2libGluZztcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAoIWVsKSByZXR1cm47XG4gICAgZnJhZyA9IGVsLl9fdl9mcmFnO1xuICB9XG4gIHJldHVybiBmcmFnO1xufVxuXG4vKipcbiAqIEZpbmQgYSB2bSBmcm9tIGEgZnJhZ21lbnQuXG4gKlxuICogQHBhcmFtIHtGcmFnbWVudH0gZnJhZ1xuICogQHJldHVybiB7VnVlfHVuZGVmaW5lZH1cbiAqL1xuXG5mdW5jdGlvbiBmaW5kVm1Gcm9tRnJhZyhmcmFnKSB7XG4gIHZhciBub2RlID0gZnJhZy5ub2RlO1xuICAvLyBoYW5kbGUgbXVsdGktbm9kZSBmcmFnXG4gIGlmIChmcmFnLmVuZCkge1xuICAgIHdoaWxlICghbm9kZS5fX3Z1ZV9fICYmIG5vZGUgIT09IGZyYWcuZW5kICYmIG5vZGUubmV4dFNpYmxpbmcpIHtcbiAgICAgIG5vZGUgPSBub2RlLm5leHRTaWJsaW5nO1xuICAgIH1cbiAgfVxuICByZXR1cm4gbm9kZS5fX3Z1ZV9fO1xufVxuXG4vKipcbiAqIENyZWF0ZSBhIHJhbmdlIGFycmF5IGZyb20gZ2l2ZW4gbnVtYmVyLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBuXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuXG5mdW5jdGlvbiByYW5nZShuKSB7XG4gIHZhciBpID0gLTE7XG4gIHZhciByZXQgPSBuZXcgQXJyYXkoTWF0aC5mbG9vcihuKSk7XG4gIHdoaWxlICgrK2kgPCBuKSB7XG4gICAgcmV0W2ldID0gaTtcbiAgfVxuICByZXR1cm4gcmV0O1xufVxuXG4vKipcbiAqIEdldCB0aGUgdHJhY2sgYnkga2V5IGZvciBhbiBpdGVtLlxuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBpbmRleFxuICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICogQHBhcmFtIHsqfSB2YWx1ZVxuICogQHBhcmFtIHtTdHJpbmd9IFt0cmFja0J5S2V5XVxuICovXG5cbmZ1bmN0aW9uIGdldFRyYWNrQnlLZXkoaW5kZXgsIGtleSwgdmFsdWUsIHRyYWNrQnlLZXkpIHtcbiAgcmV0dXJuIHRyYWNrQnlLZXkgPyB0cmFja0J5S2V5ID09PSAnJGluZGV4JyA/IGluZGV4IDogdHJhY2tCeUtleS5jaGFyQXQoMCkubWF0Y2goL1xcdy8pID8gZ2V0UGF0aCh2YWx1ZSwgdHJhY2tCeUtleSkgOiB2YWx1ZVt0cmFja0J5S2V5XSA6IGtleSB8fCB2YWx1ZTtcbn1cblxuaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgdkZvci53YXJuRHVwbGljYXRlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgd2FybignRHVwbGljYXRlIHZhbHVlIGZvdW5kIGluIHYtZm9yPVwiJyArIHRoaXMuZGVzY3JpcHRvci5yYXcgKyAnXCI6ICcgKyBKU09OLnN0cmluZ2lmeSh2YWx1ZSkgKyAnLiBVc2UgdHJhY2stYnk9XCIkaW5kZXhcIiBpZiAnICsgJ3lvdSBhcmUgZXhwZWN0aW5nIGR1cGxpY2F0ZSB2YWx1ZXMuJywgdGhpcy52bSk7XG4gIH07XG59XG5cbnZhciB2SWYgPSB7XG5cbiAgcHJpb3JpdHk6IElGLFxuICB0ZXJtaW5hbDogdHJ1ZSxcblxuICBiaW5kOiBmdW5jdGlvbiBiaW5kKCkge1xuICAgIHZhciBlbCA9IHRoaXMuZWw7XG4gICAgaWYgKCFlbC5fX3Z1ZV9fKSB7XG4gICAgICAvLyBjaGVjayBlbHNlIGJsb2NrXG4gICAgICB2YXIgbmV4dCA9IGVsLm5leHRFbGVtZW50U2libGluZztcbiAgICAgIGlmIChuZXh0ICYmIGdldEF0dHIobmV4dCwgJ3YtZWxzZScpICE9PSBudWxsKSB7XG4gICAgICAgIHJlbW92ZShuZXh0KTtcbiAgICAgICAgdGhpcy5lbHNlRWwgPSBuZXh0O1xuICAgICAgfVxuICAgICAgLy8gY2hlY2sgbWFpbiBibG9ja1xuICAgICAgdGhpcy5hbmNob3IgPSBjcmVhdGVBbmNob3IoJ3YtaWYnKTtcbiAgICAgIHJlcGxhY2UoZWwsIHRoaXMuYW5jaG9yKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCd2LWlmPVwiJyArIHRoaXMuZXhwcmVzc2lvbiArICdcIiBjYW5ub3QgYmUgJyArICd1c2VkIG9uIGFuIGluc3RhbmNlIHJvb3QgZWxlbWVudC4nLCB0aGlzLnZtKTtcbiAgICAgIHRoaXMuaW52YWxpZCA9IHRydWU7XG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gdXBkYXRlKHZhbHVlKSB7XG4gICAgaWYgKHRoaXMuaW52YWxpZCkgcmV0dXJuO1xuICAgIGlmICh2YWx1ZSkge1xuICAgICAgaWYgKCF0aGlzLmZyYWcpIHtcbiAgICAgICAgdGhpcy5pbnNlcnQoKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5yZW1vdmUoKTtcbiAgICB9XG4gIH0sXG5cbiAgaW5zZXJ0OiBmdW5jdGlvbiBpbnNlcnQoKSB7XG4gICAgaWYgKHRoaXMuZWxzZUZyYWcpIHtcbiAgICAgIHRoaXMuZWxzZUZyYWcucmVtb3ZlKCk7XG4gICAgICB0aGlzLmVsc2VGcmFnID0gbnVsbDtcbiAgICB9XG4gICAgLy8gbGF6eSBpbml0IGZhY3RvcnlcbiAgICBpZiAoIXRoaXMuZmFjdG9yeSkge1xuICAgICAgdGhpcy5mYWN0b3J5ID0gbmV3IEZyYWdtZW50RmFjdG9yeSh0aGlzLnZtLCB0aGlzLmVsKTtcbiAgICB9XG4gICAgdGhpcy5mcmFnID0gdGhpcy5mYWN0b3J5LmNyZWF0ZSh0aGlzLl9ob3N0LCB0aGlzLl9zY29wZSwgdGhpcy5fZnJhZyk7XG4gICAgdGhpcy5mcmFnLmJlZm9yZSh0aGlzLmFuY2hvcik7XG4gIH0sXG5cbiAgcmVtb3ZlOiBmdW5jdGlvbiByZW1vdmUoKSB7XG4gICAgaWYgKHRoaXMuZnJhZykge1xuICAgICAgdGhpcy5mcmFnLnJlbW92ZSgpO1xuICAgICAgdGhpcy5mcmFnID0gbnVsbDtcbiAgICB9XG4gICAgaWYgKHRoaXMuZWxzZUVsICYmICF0aGlzLmVsc2VGcmFnKSB7XG4gICAgICBpZiAoIXRoaXMuZWxzZUZhY3RvcnkpIHtcbiAgICAgICAgdGhpcy5lbHNlRmFjdG9yeSA9IG5ldyBGcmFnbWVudEZhY3RvcnkodGhpcy5lbHNlRWwuX2NvbnRleHQgfHwgdGhpcy52bSwgdGhpcy5lbHNlRWwpO1xuICAgICAgfVxuICAgICAgdGhpcy5lbHNlRnJhZyA9IHRoaXMuZWxzZUZhY3RvcnkuY3JlYXRlKHRoaXMuX2hvc3QsIHRoaXMuX3Njb3BlLCB0aGlzLl9mcmFnKTtcbiAgICAgIHRoaXMuZWxzZUZyYWcuYmVmb3JlKHRoaXMuYW5jaG9yKTtcbiAgICB9XG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgaWYgKHRoaXMuZnJhZykge1xuICAgICAgdGhpcy5mcmFnLmRlc3Ryb3koKTtcbiAgICB9XG4gICAgaWYgKHRoaXMuZWxzZUZyYWcpIHtcbiAgICAgIHRoaXMuZWxzZUZyYWcuZGVzdHJveSgpO1xuICAgIH1cbiAgfVxufTtcblxudmFyIHNob3cgPSB7XG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICAvLyBjaGVjayBlbHNlIGJsb2NrXG4gICAgdmFyIG5leHQgPSB0aGlzLmVsLm5leHRFbGVtZW50U2libGluZztcbiAgICBpZiAobmV4dCAmJiBnZXRBdHRyKG5leHQsICd2LWVsc2UnKSAhPT0gbnVsbCkge1xuICAgICAgdGhpcy5lbHNlRWwgPSBuZXh0O1xuICAgIH1cbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZSh2YWx1ZSkge1xuICAgIHRoaXMuYXBwbHkodGhpcy5lbCwgdmFsdWUpO1xuICAgIGlmICh0aGlzLmVsc2VFbCkge1xuICAgICAgdGhpcy5hcHBseSh0aGlzLmVsc2VFbCwgIXZhbHVlKTtcbiAgICB9XG4gIH0sXG5cbiAgYXBwbHk6IGZ1bmN0aW9uIGFwcGx5KGVsLCB2YWx1ZSkge1xuICAgIGlmIChpbkRvYyhlbCkpIHtcbiAgICAgIGFwcGx5VHJhbnNpdGlvbihlbCwgdmFsdWUgPyAxIDogLTEsIHRvZ2dsZSwgdGhpcy52bSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRvZ2dsZSgpO1xuICAgIH1cbiAgICBmdW5jdGlvbiB0b2dnbGUoKSB7XG4gICAgICBlbC5zdHlsZS5kaXNwbGF5ID0gdmFsdWUgPyAnJyA6ICdub25lJztcbiAgICB9XG4gIH1cbn07XG5cbnZhciB0ZXh0JDIgPSB7XG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGVsID0gdGhpcy5lbDtcbiAgICB2YXIgaXNSYW5nZSA9IGVsLnR5cGUgPT09ICdyYW5nZSc7XG4gICAgdmFyIGxhenkgPSB0aGlzLnBhcmFtcy5sYXp5O1xuICAgIHZhciBudW1iZXIgPSB0aGlzLnBhcmFtcy5udW1iZXI7XG4gICAgdmFyIGRlYm91bmNlID0gdGhpcy5wYXJhbXMuZGVib3VuY2U7XG5cbiAgICAvLyBoYW5kbGUgY29tcG9zaXRpb24gZXZlbnRzLlxuICAgIC8vICAgaHR0cDovL2Jsb2cuZXZhbnlvdS5tZS8yMDE0LzAxLzAzL2NvbXBvc2l0aW9uLWV2ZW50L1xuICAgIC8vIHNraXAgdGhpcyBmb3IgQW5kcm9pZCBiZWNhdXNlIGl0IGhhbmRsZXMgY29tcG9zaXRpb25cbiAgICAvLyBldmVudHMgcXVpdGUgZGlmZmVyZW50bHkuIEFuZHJvaWQgZG9lc24ndCB0cmlnZ2VyXG4gICAgLy8gY29tcG9zaXRpb24gZXZlbnRzIGZvciBsYW5ndWFnZSBpbnB1dCBtZXRob2RzIGUuZy5cbiAgICAvLyBDaGluZXNlLCBidXQgaW5zdGVhZCB0cmlnZ2VycyB0aGVtIGZvciBzcGVsbGluZ1xuICAgIC8vIHN1Z2dlc3Rpb25zLi4uIChzZWUgRGlzY3Vzc2lvbi8jMTYyKVxuICAgIHZhciBjb21wb3NpbmcgPSBmYWxzZTtcbiAgICBpZiAoIWlzQW5kcm9pZCAmJiAhaXNSYW5nZSkge1xuICAgICAgdGhpcy5vbignY29tcG9zaXRpb25zdGFydCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgY29tcG9zaW5nID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5vbignY29tcG9zaXRpb25lbmQnLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbXBvc2luZyA9IGZhbHNlO1xuICAgICAgICAvLyBpbiBJRTExIHRoZSBcImNvbXBvc2l0aW9uZW5kXCIgZXZlbnQgZmlyZXMgQUZURVJcbiAgICAgICAgLy8gdGhlIFwiaW5wdXRcIiBldmVudCwgc28gdGhlIGlucHV0IGhhbmRsZXIgaXMgYmxvY2tlZFxuICAgICAgICAvLyBhdCB0aGUgZW5kLi4uIGhhdmUgdG8gY2FsbCBpdCBoZXJlLlxuICAgICAgICAvL1xuICAgICAgICAvLyAjMTMyNzogaW4gbGF6eSBtb2RlIHRoaXMgaXMgdW5lY2Vzc2FyeS5cbiAgICAgICAgaWYgKCFsYXp5KSB7XG4gICAgICAgICAgc2VsZi5saXN0ZW5lcigpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBwcmV2ZW50IG1lc3Npbmcgd2l0aCB0aGUgaW5wdXQgd2hlbiB1c2VyIGlzIHR5cGluZyxcbiAgICAvLyBhbmQgZm9yY2UgdXBkYXRlIG9uIGJsdXIuXG4gICAgdGhpcy5mb2N1c2VkID0gZmFsc2U7XG4gICAgaWYgKCFpc1JhbmdlICYmICFsYXp5KSB7XG4gICAgICB0aGlzLm9uKCdmb2N1cycsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5mb2N1c2VkID0gdHJ1ZTtcbiAgICAgIH0pO1xuICAgICAgdGhpcy5vbignYmx1cicsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5mb2N1c2VkID0gZmFsc2U7XG4gICAgICAgIC8vIGRvIG5vdCBzeW5jIHZhbHVlIGFmdGVyIGZyYWdtZW50IHJlbW92YWwgKCMyMDE3KVxuICAgICAgICBpZiAoIXNlbGYuX2ZyYWcgfHwgc2VsZi5fZnJhZy5pbnNlcnRlZCkge1xuICAgICAgICAgIHNlbGYucmF3TGlzdGVuZXIoKTtcbiAgICAgICAgfVxuICAgICAgfSk7XG4gICAgfVxuXG4gICAgLy8gTm93IGF0dGFjaCB0aGUgbWFpbiBsaXN0ZW5lclxuICAgIHRoaXMubGlzdGVuZXIgPSB0aGlzLnJhd0xpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgaWYgKGNvbXBvc2luZyB8fCAhc2VsZi5fYm91bmQpIHtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgdmFyIHZhbCA9IG51bWJlciB8fCBpc1JhbmdlID8gdG9OdW1iZXIoZWwudmFsdWUpIDogZWwudmFsdWU7XG4gICAgICBzZWxmLnNldCh2YWwpO1xuICAgICAgLy8gZm9yY2UgdXBkYXRlIG9uIG5leHQgdGljayB0byBhdm9pZCBsb2NrICYgc2FtZSB2YWx1ZVxuICAgICAgLy8gYWxzbyBvbmx5IHVwZGF0ZSB3aGVuIHVzZXIgaXMgbm90IHR5cGluZ1xuICAgICAgbmV4dFRpY2soZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAoc2VsZi5fYm91bmQgJiYgIXNlbGYuZm9jdXNlZCkge1xuICAgICAgICAgIHNlbGYudXBkYXRlKHNlbGYuX3dhdGNoZXIudmFsdWUpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9O1xuXG4gICAgLy8gYXBwbHkgZGVib3VuY2VcbiAgICBpZiAoZGVib3VuY2UpIHtcbiAgICAgIHRoaXMubGlzdGVuZXIgPSBfZGVib3VuY2UodGhpcy5saXN0ZW5lciwgZGVib3VuY2UpO1xuICAgIH1cblxuICAgIC8vIFN1cHBvcnQgalF1ZXJ5IGV2ZW50cywgc2luY2UgalF1ZXJ5LnRyaWdnZXIoKSBkb2Vzbid0XG4gICAgLy8gdHJpZ2dlciBuYXRpdmUgZXZlbnRzIGluIHNvbWUgY2FzZXMgYW5kIHNvbWUgcGx1Z2luc1xuICAgIC8vIHJlbHkgb24gJC50cmlnZ2VyKClcbiAgICAvL1xuICAgIC8vIFdlIHdhbnQgdG8gbWFrZSBzdXJlIGlmIGEgbGlzdGVuZXIgaXMgYXR0YWNoZWQgdXNpbmdcbiAgICAvLyBqUXVlcnksIGl0IGlzIGFsc28gcmVtb3ZlZCB3aXRoIGpRdWVyeSwgdGhhdCdzIHdoeVxuICAgIC8vIHdlIGRvIHRoZSBjaGVjayBmb3IgZWFjaCBkaXJlY3RpdmUgaW5zdGFuY2UgYW5kXG4gICAgLy8gc3RvcmUgdGhhdCBjaGVjayByZXN1bHQgb24gaXRzZWxmLiBUaGlzIGFsc28gYWxsb3dzXG4gICAgLy8gZWFzaWVyIHRlc3QgY292ZXJhZ2UgY29udHJvbCBieSB1bnNldHRpbmcgdGhlIGdsb2JhbFxuICAgIC8vIGpRdWVyeSB2YXJpYWJsZSBpbiB0ZXN0cy5cbiAgICB0aGlzLmhhc2pRdWVyeSA9IHR5cGVvZiBqUXVlcnkgPT09ICdmdW5jdGlvbic7XG4gICAgaWYgKHRoaXMuaGFzalF1ZXJ5KSB7XG4gICAgICB2YXIgbWV0aG9kID0galF1ZXJ5LmZuLm9uID8gJ29uJyA6ICdiaW5kJztcbiAgICAgIGpRdWVyeShlbClbbWV0aG9kXSgnY2hhbmdlJywgdGhpcy5yYXdMaXN0ZW5lcik7XG4gICAgICBpZiAoIWxhenkpIHtcbiAgICAgICAgalF1ZXJ5KGVsKVttZXRob2RdKCdpbnB1dCcsIHRoaXMubGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLm9uKCdjaGFuZ2UnLCB0aGlzLnJhd0xpc3RlbmVyKTtcbiAgICAgIGlmICghbGF6eSkge1xuICAgICAgICB0aGlzLm9uKCdpbnB1dCcsIHRoaXMubGlzdGVuZXIpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIElFOSBkb2Vzbid0IGZpcmUgaW5wdXQgZXZlbnQgb24gYmFja3NwYWNlL2RlbC9jdXRcbiAgICBpZiAoIWxhenkgJiYgaXNJRTkpIHtcbiAgICAgIHRoaXMub24oJ2N1dCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgbmV4dFRpY2soc2VsZi5saXN0ZW5lcik7XG4gICAgICB9KTtcbiAgICAgIHRoaXMub24oJ2tleXVwJywgZnVuY3Rpb24gKGUpIHtcbiAgICAgICAgaWYgKGUua2V5Q29kZSA9PT0gNDYgfHwgZS5rZXlDb2RlID09PSA4KSB7XG4gICAgICAgICAgc2VsZi5saXN0ZW5lcigpO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvLyBzZXQgaW5pdGlhbCB2YWx1ZSBpZiBwcmVzZW50XG4gICAgaWYgKGVsLmhhc0F0dHJpYnV0ZSgndmFsdWUnKSB8fCBlbC50YWdOYW1lID09PSAnVEVYVEFSRUEnICYmIGVsLnZhbHVlLnRyaW0oKSkge1xuICAgICAgdGhpcy5hZnRlckJpbmQgPSB0aGlzLmxpc3RlbmVyO1xuICAgIH1cbiAgfSxcblxuICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZSh2YWx1ZSkge1xuICAgIHRoaXMuZWwudmFsdWUgPSBfdG9TdHJpbmcodmFsdWUpO1xuICB9LFxuXG4gIHVuYmluZDogZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIHZhciBlbCA9IHRoaXMuZWw7XG4gICAgaWYgKHRoaXMuaGFzalF1ZXJ5KSB7XG4gICAgICB2YXIgbWV0aG9kID0galF1ZXJ5LmZuLm9mZiA/ICdvZmYnIDogJ3VuYmluZCc7XG4gICAgICBqUXVlcnkoZWwpW21ldGhvZF0oJ2NoYW5nZScsIHRoaXMubGlzdGVuZXIpO1xuICAgICAgalF1ZXJ5KGVsKVttZXRob2RdKCdpbnB1dCcsIHRoaXMubGlzdGVuZXIpO1xuICAgIH1cbiAgfVxufTtcblxudmFyIHJhZGlvID0ge1xuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBlbCA9IHRoaXMuZWw7XG5cbiAgICB0aGlzLmdldFZhbHVlID0gZnVuY3Rpb24gKCkge1xuICAgICAgLy8gdmFsdWUgb3ZlcndyaXRlIHZpYSB2LWJpbmQ6dmFsdWVcbiAgICAgIGlmIChlbC5oYXNPd25Qcm9wZXJ0eSgnX3ZhbHVlJykpIHtcbiAgICAgICAgcmV0dXJuIGVsLl92YWx1ZTtcbiAgICAgIH1cbiAgICAgIHZhciB2YWwgPSBlbC52YWx1ZTtcbiAgICAgIGlmIChzZWxmLnBhcmFtcy5udW1iZXIpIHtcbiAgICAgICAgdmFsID0gdG9OdW1iZXIodmFsKTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB2YWw7XG4gICAgfTtcblxuICAgIHRoaXMubGlzdGVuZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICBzZWxmLnNldChzZWxmLmdldFZhbHVlKCkpO1xuICAgIH07XG4gICAgdGhpcy5vbignY2hhbmdlJywgdGhpcy5saXN0ZW5lcik7XG5cbiAgICBpZiAoZWwuaGFzQXR0cmlidXRlKCdjaGVja2VkJykpIHtcbiAgICAgIHRoaXMuYWZ0ZXJCaW5kID0gdGhpcy5saXN0ZW5lcjtcbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUodmFsdWUpIHtcbiAgICB0aGlzLmVsLmNoZWNrZWQgPSBsb29zZUVxdWFsKHZhbHVlLCB0aGlzLmdldFZhbHVlKCkpO1xuICB9XG59O1xuXG52YXIgc2VsZWN0ID0ge1xuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIHZhciBlbCA9IHRoaXMuZWw7XG5cbiAgICAvLyBtZXRob2QgdG8gZm9yY2UgdXBkYXRlIERPTSB1c2luZyBsYXRlc3QgdmFsdWUuXG4gICAgdGhpcy5mb3JjZVVwZGF0ZSA9IGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChzZWxmLl93YXRjaGVyKSB7XG4gICAgICAgIHNlbGYudXBkYXRlKHNlbGYuX3dhdGNoZXIuZ2V0KCkpO1xuICAgICAgfVxuICAgIH07XG5cbiAgICAvLyBjaGVjayBpZiB0aGlzIGlzIGEgbXVsdGlwbGUgc2VsZWN0XG4gICAgdmFyIG11bHRpcGxlID0gdGhpcy5tdWx0aXBsZSA9IGVsLmhhc0F0dHJpYnV0ZSgnbXVsdGlwbGUnKTtcblxuICAgIC8vIGF0dGFjaCBsaXN0ZW5lclxuICAgIHRoaXMubGlzdGVuZXIgPSBmdW5jdGlvbiAoKSB7XG4gICAgICB2YXIgdmFsdWUgPSBnZXRWYWx1ZShlbCwgbXVsdGlwbGUpO1xuICAgICAgdmFsdWUgPSBzZWxmLnBhcmFtcy5udW1iZXIgPyBpc0FycmF5KHZhbHVlKSA/IHZhbHVlLm1hcCh0b051bWJlcikgOiB0b051bWJlcih2YWx1ZSkgOiB2YWx1ZTtcbiAgICAgIHNlbGYuc2V0KHZhbHVlKTtcbiAgICB9O1xuICAgIHRoaXMub24oJ2NoYW5nZScsIHRoaXMubGlzdGVuZXIpO1xuXG4gICAgLy8gaWYgaGFzIGluaXRpYWwgdmFsdWUsIHNldCBhZnRlckJpbmRcbiAgICB2YXIgaW5pdFZhbHVlID0gZ2V0VmFsdWUoZWwsIG11bHRpcGxlLCB0cnVlKTtcbiAgICBpZiAobXVsdGlwbGUgJiYgaW5pdFZhbHVlLmxlbmd0aCB8fCAhbXVsdGlwbGUgJiYgaW5pdFZhbHVlICE9PSBudWxsKSB7XG4gICAgICB0aGlzLmFmdGVyQmluZCA9IHRoaXMubGlzdGVuZXI7XG4gICAgfVxuXG4gICAgLy8gQWxsIG1ham9yIGJyb3dzZXJzIGV4Y2VwdCBGaXJlZm94IHJlc2V0c1xuICAgIC8vIHNlbGVjdGVkSW5kZXggd2l0aCB2YWx1ZSAtMSB0byAwIHdoZW4gdGhlIGVsZW1lbnRcbiAgICAvLyBpcyBhcHBlbmRlZCB0byBhIG5ldyBwYXJlbnQsIHRoZXJlZm9yZSB3ZSBoYXZlIHRvXG4gICAgLy8gZm9yY2UgYSBET00gdXBkYXRlIHdoZW5ldmVyIHRoYXQgaGFwcGVucy4uLlxuICAgIHRoaXMudm0uJG9uKCdob29rOmF0dGFjaGVkJywgdGhpcy5mb3JjZVVwZGF0ZSk7XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUodmFsdWUpIHtcbiAgICB2YXIgZWwgPSB0aGlzLmVsO1xuICAgIGVsLnNlbGVjdGVkSW5kZXggPSAtMTtcbiAgICB2YXIgbXVsdGkgPSB0aGlzLm11bHRpcGxlICYmIGlzQXJyYXkodmFsdWUpO1xuICAgIHZhciBvcHRpb25zID0gZWwub3B0aW9ucztcbiAgICB2YXIgaSA9IG9wdGlvbnMubGVuZ3RoO1xuICAgIHZhciBvcCwgdmFsO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIG9wID0gb3B0aW9uc1tpXTtcbiAgICAgIHZhbCA9IG9wLmhhc093blByb3BlcnR5KCdfdmFsdWUnKSA/IG9wLl92YWx1ZSA6IG9wLnZhbHVlO1xuICAgICAgLyogZXNsaW50LWRpc2FibGUgZXFlcWVxICovXG4gICAgICBvcC5zZWxlY3RlZCA9IG11bHRpID8gaW5kZXhPZiQxKHZhbHVlLCB2YWwpID4gLTEgOiBsb29zZUVxdWFsKHZhbHVlLCB2YWwpO1xuICAgICAgLyogZXNsaW50LWVuYWJsZSBlcWVxZXEgKi9cbiAgICB9XG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbiAgICB0aGlzLnZtLiRvZmYoJ2hvb2s6YXR0YWNoZWQnLCB0aGlzLmZvcmNlVXBkYXRlKTtcbiAgfVxufTtcblxuLyoqXG4gKiBHZXQgc2VsZWN0IHZhbHVlXG4gKlxuICogQHBhcmFtIHtTZWxlY3RFbGVtZW50fSBlbFxuICogQHBhcmFtIHtCb29sZWFufSBtdWx0aVxuICogQHBhcmFtIHtCb29sZWFufSBpbml0XG4gKiBAcmV0dXJuIHtBcnJheXwqfVxuICovXG5cbmZ1bmN0aW9uIGdldFZhbHVlKGVsLCBtdWx0aSwgaW5pdCkge1xuICB2YXIgcmVzID0gbXVsdGkgPyBbXSA6IG51bGw7XG4gIHZhciBvcCwgdmFsLCBzZWxlY3RlZDtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBlbC5vcHRpb25zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIG9wID0gZWwub3B0aW9uc1tpXTtcbiAgICBzZWxlY3RlZCA9IGluaXQgPyBvcC5oYXNBdHRyaWJ1dGUoJ3NlbGVjdGVkJykgOiBvcC5zZWxlY3RlZDtcbiAgICBpZiAoc2VsZWN0ZWQpIHtcbiAgICAgIHZhbCA9IG9wLmhhc093blByb3BlcnR5KCdfdmFsdWUnKSA/IG9wLl92YWx1ZSA6IG9wLnZhbHVlO1xuICAgICAgaWYgKG11bHRpKSB7XG4gICAgICAgIHJlcy5wdXNoKHZhbCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdmFsO1xuICAgICAgfVxuICAgIH1cbiAgfVxuICByZXR1cm4gcmVzO1xufVxuXG4vKipcbiAqIE5hdGl2ZSBBcnJheS5pbmRleE9mIHVzZXMgc3RyaWN0IGVxdWFsLCBidXQgaW4gdGhpc1xuICogY2FzZSB3ZSBuZWVkIHRvIG1hdGNoIHN0cmluZy9udW1iZXJzIHdpdGggY3VzdG9tIGVxdWFsLlxuICpcbiAqIEBwYXJhbSB7QXJyYXl9IGFyclxuICogQHBhcmFtIHsqfSB2YWxcbiAqL1xuXG5mdW5jdGlvbiBpbmRleE9mJDEoYXJyLCB2YWwpIHtcbiAgdmFyIGkgPSBhcnIubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgaWYgKGxvb3NlRXF1YWwoYXJyW2ldLCB2YWwpKSB7XG4gICAgICByZXR1cm4gaTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIC0xO1xufVxuXG52YXIgY2hlY2tib3ggPSB7XG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdmFyIGVsID0gdGhpcy5lbDtcblxuICAgIHRoaXMuZ2V0VmFsdWUgPSBmdW5jdGlvbiAoKSB7XG4gICAgICByZXR1cm4gZWwuaGFzT3duUHJvcGVydHkoJ192YWx1ZScpID8gZWwuX3ZhbHVlIDogc2VsZi5wYXJhbXMubnVtYmVyID8gdG9OdW1iZXIoZWwudmFsdWUpIDogZWwudmFsdWU7XG4gICAgfTtcblxuICAgIGZ1bmN0aW9uIGdldEJvb2xlYW5WYWx1ZSgpIHtcbiAgICAgIHZhciB2YWwgPSBlbC5jaGVja2VkO1xuICAgICAgaWYgKHZhbCAmJiBlbC5oYXNPd25Qcm9wZXJ0eSgnX3RydWVWYWx1ZScpKSB7XG4gICAgICAgIHJldHVybiBlbC5fdHJ1ZVZhbHVlO1xuICAgICAgfVxuICAgICAgaWYgKCF2YWwgJiYgZWwuaGFzT3duUHJvcGVydHkoJ19mYWxzZVZhbHVlJykpIHtcbiAgICAgICAgcmV0dXJuIGVsLl9mYWxzZVZhbHVlO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHZhbDtcbiAgICB9XG5cbiAgICB0aGlzLmxpc3RlbmVyID0gZnVuY3Rpb24gKCkge1xuICAgICAgdmFyIG1vZGVsID0gc2VsZi5fd2F0Y2hlci52YWx1ZTtcbiAgICAgIGlmIChpc0FycmF5KG1vZGVsKSkge1xuICAgICAgICB2YXIgdmFsID0gc2VsZi5nZXRWYWx1ZSgpO1xuICAgICAgICBpZiAoZWwuY2hlY2tlZCkge1xuICAgICAgICAgIGlmIChpbmRleE9mKG1vZGVsLCB2YWwpIDwgMCkge1xuICAgICAgICAgICAgbW9kZWwucHVzaCh2YWwpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICBtb2RlbC4kcmVtb3ZlKHZhbCk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNlbGYuc2V0KGdldEJvb2xlYW5WYWx1ZSgpKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgdGhpcy5vbignY2hhbmdlJywgdGhpcy5saXN0ZW5lcik7XG4gICAgaWYgKGVsLmhhc0F0dHJpYnV0ZSgnY2hlY2tlZCcpKSB7XG4gICAgICB0aGlzLmFmdGVyQmluZCA9IHRoaXMubGlzdGVuZXI7XG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gdXBkYXRlKHZhbHVlKSB7XG4gICAgdmFyIGVsID0gdGhpcy5lbDtcbiAgICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICAgIGVsLmNoZWNrZWQgPSBpbmRleE9mKHZhbHVlLCB0aGlzLmdldFZhbHVlKCkpID4gLTE7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChlbC5oYXNPd25Qcm9wZXJ0eSgnX3RydWVWYWx1ZScpKSB7XG4gICAgICAgIGVsLmNoZWNrZWQgPSBsb29zZUVxdWFsKHZhbHVlLCBlbC5fdHJ1ZVZhbHVlKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGVsLmNoZWNrZWQgPSAhIXZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcblxudmFyIGhhbmRsZXJzID0ge1xuICB0ZXh0OiB0ZXh0JDIsXG4gIHJhZGlvOiByYWRpbyxcbiAgc2VsZWN0OiBzZWxlY3QsXG4gIGNoZWNrYm94OiBjaGVja2JveFxufTtcblxudmFyIG1vZGVsID0ge1xuXG4gIHByaW9yaXR5OiBNT0RFTCxcbiAgdHdvV2F5OiB0cnVlLFxuICBoYW5kbGVyczogaGFuZGxlcnMsXG4gIHBhcmFtczogWydsYXp5JywgJ251bWJlcicsICdkZWJvdW5jZSddLFxuXG4gIC8qKlxuICAgKiBQb3NzaWJsZSBlbGVtZW50czpcbiAgICogICA8c2VsZWN0PlxuICAgKiAgIDx0ZXh0YXJlYT5cbiAgICogICA8aW5wdXQgdHlwZT1cIipcIj5cbiAgICogICAgIC0gdGV4dFxuICAgKiAgICAgLSBjaGVja2JveFxuICAgKiAgICAgLSByYWRpb1xuICAgKiAgICAgLSBudW1iZXJcbiAgICovXG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICAvLyBmcmllbmRseSB3YXJuaW5nLi4uXG4gICAgdGhpcy5jaGVja0ZpbHRlcnMoKTtcbiAgICBpZiAodGhpcy5oYXNSZWFkICYmICF0aGlzLmhhc1dyaXRlKSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0l0IHNlZW1zIHlvdSBhcmUgdXNpbmcgYSByZWFkLW9ubHkgZmlsdGVyIHdpdGggJyArICd2LW1vZGVsPVwiJyArIHRoaXMuZGVzY3JpcHRvci5yYXcgKyAnXCIuICcgKyAnWW91IG1pZ2h0IHdhbnQgdG8gdXNlIGEgdHdvLXdheSBmaWx0ZXIgdG8gZW5zdXJlIGNvcnJlY3QgYmVoYXZpb3IuJywgdGhpcy52bSk7XG4gICAgfVxuICAgIHZhciBlbCA9IHRoaXMuZWw7XG4gICAgdmFyIHRhZyA9IGVsLnRhZ05hbWU7XG4gICAgdmFyIGhhbmRsZXI7XG4gICAgaWYgKHRhZyA9PT0gJ0lOUFVUJykge1xuICAgICAgaGFuZGxlciA9IGhhbmRsZXJzW2VsLnR5cGVdIHx8IGhhbmRsZXJzLnRleHQ7XG4gICAgfSBlbHNlIGlmICh0YWcgPT09ICdTRUxFQ1QnKSB7XG4gICAgICBoYW5kbGVyID0gaGFuZGxlcnMuc2VsZWN0O1xuICAgIH0gZWxzZSBpZiAodGFnID09PSAnVEVYVEFSRUEnKSB7XG4gICAgICBoYW5kbGVyID0gaGFuZGxlcnMudGV4dDtcbiAgICB9IGVsc2Uge1xuICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCd2LW1vZGVsIGRvZXMgbm90IHN1cHBvcnQgZWxlbWVudCB0eXBlOiAnICsgdGFnLCB0aGlzLnZtKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgZWwuX192X21vZGVsID0gdGhpcztcbiAgICBoYW5kbGVyLmJpbmQuY2FsbCh0aGlzKTtcbiAgICB0aGlzLnVwZGF0ZSA9IGhhbmRsZXIudXBkYXRlO1xuICAgIHRoaXMuX3VuYmluZCA9IGhhbmRsZXIudW5iaW5kO1xuICB9LFxuXG4gIC8qKlxuICAgKiBDaGVjayByZWFkL3dyaXRlIGZpbHRlciBzdGF0cy5cbiAgICovXG5cbiAgY2hlY2tGaWx0ZXJzOiBmdW5jdGlvbiBjaGVja0ZpbHRlcnMoKSB7XG4gICAgdmFyIGZpbHRlcnMgPSB0aGlzLmZpbHRlcnM7XG4gICAgaWYgKCFmaWx0ZXJzKSByZXR1cm47XG4gICAgdmFyIGkgPSBmaWx0ZXJzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICB2YXIgZmlsdGVyID0gcmVzb2x2ZUFzc2V0KHRoaXMudm0uJG9wdGlvbnMsICdmaWx0ZXJzJywgZmlsdGVyc1tpXS5uYW1lKTtcbiAgICAgIGlmICh0eXBlb2YgZmlsdGVyID09PSAnZnVuY3Rpb24nIHx8IGZpbHRlci5yZWFkKSB7XG4gICAgICAgIHRoaXMuaGFzUmVhZCA9IHRydWU7XG4gICAgICB9XG4gICAgICBpZiAoZmlsdGVyLndyaXRlKSB7XG4gICAgICAgIHRoaXMuaGFzV3JpdGUgPSB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uIHVuYmluZCgpIHtcbiAgICB0aGlzLmVsLl9fdl9tb2RlbCA9IG51bGw7XG4gICAgdGhpcy5fdW5iaW5kICYmIHRoaXMuX3VuYmluZCgpO1xuICB9XG59O1xuXG4vLyBrZXlDb2RlIGFsaWFzZXNcbnZhciBrZXlDb2RlcyA9IHtcbiAgZXNjOiAyNyxcbiAgdGFiOiA5LFxuICBlbnRlcjogMTMsXG4gIHNwYWNlOiAzMixcbiAgJ2RlbGV0ZSc6IFs4LCA0Nl0sXG4gIHVwOiAzOCxcbiAgbGVmdDogMzcsXG4gIHJpZ2h0OiAzOSxcbiAgZG93bjogNDBcbn07XG5cbmZ1bmN0aW9uIGtleUZpbHRlcihoYW5kbGVyLCBrZXlzKSB7XG4gIHZhciBjb2RlcyA9IGtleXMubWFwKGZ1bmN0aW9uIChrZXkpIHtcbiAgICB2YXIgY2hhckNvZGUgPSBrZXkuY2hhckNvZGVBdCgwKTtcbiAgICBpZiAoY2hhckNvZGUgPiA0NyAmJiBjaGFyQ29kZSA8IDU4KSB7XG4gICAgICByZXR1cm4gcGFyc2VJbnQoa2V5LCAxMCk7XG4gICAgfVxuICAgIGlmIChrZXkubGVuZ3RoID09PSAxKSB7XG4gICAgICBjaGFyQ29kZSA9IGtleS50b1VwcGVyQ2FzZSgpLmNoYXJDb2RlQXQoMCk7XG4gICAgICBpZiAoY2hhckNvZGUgPiA2NCAmJiBjaGFyQ29kZSA8IDkxKSB7XG4gICAgICAgIHJldHVybiBjaGFyQ29kZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGtleUNvZGVzW2tleV07XG4gIH0pO1xuICBjb2RlcyA9IFtdLmNvbmNhdC5hcHBseShbXSwgY29kZXMpO1xuICByZXR1cm4gZnVuY3Rpb24ga2V5SGFuZGxlcihlKSB7XG4gICAgaWYgKGNvZGVzLmluZGV4T2YoZS5rZXlDb2RlKSA+IC0xKSB7XG4gICAgICByZXR1cm4gaGFuZGxlci5jYWxsKHRoaXMsIGUpO1xuICAgIH1cbiAgfTtcbn1cblxuZnVuY3Rpb24gc3RvcEZpbHRlcihoYW5kbGVyKSB7XG4gIHJldHVybiBmdW5jdGlvbiBzdG9wSGFuZGxlcihlKSB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICByZXR1cm4gaGFuZGxlci5jYWxsKHRoaXMsIGUpO1xuICB9O1xufVxuXG5mdW5jdGlvbiBwcmV2ZW50RmlsdGVyKGhhbmRsZXIpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHByZXZlbnRIYW5kbGVyKGUpIHtcbiAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgcmV0dXJuIGhhbmRsZXIuY2FsbCh0aGlzLCBlKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gc2VsZkZpbHRlcihoYW5kbGVyKSB7XG4gIHJldHVybiBmdW5jdGlvbiBzZWxmSGFuZGxlcihlKSB7XG4gICAgaWYgKGUudGFyZ2V0ID09PSBlLmN1cnJlbnRUYXJnZXQpIHtcbiAgICAgIHJldHVybiBoYW5kbGVyLmNhbGwodGhpcywgZSk7XG4gICAgfVxuICB9O1xufVxuXG52YXIgb24kMSA9IHtcblxuICBwcmlvcml0eTogT04sXG4gIGFjY2VwdFN0YXRlbWVudDogdHJ1ZSxcbiAga2V5Q29kZXM6IGtleUNvZGVzLFxuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgLy8gZGVhbCB3aXRoIGlmcmFtZXNcbiAgICBpZiAodGhpcy5lbC50YWdOYW1lID09PSAnSUZSQU1FJyAmJiB0aGlzLmFyZyAhPT0gJ2xvYWQnKSB7XG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICB0aGlzLmlmcmFtZUJpbmQgPSBmdW5jdGlvbiAoKSB7XG4gICAgICAgIG9uKHNlbGYuZWwuY29udGVudFdpbmRvdywgc2VsZi5hcmcsIHNlbGYuaGFuZGxlciwgc2VsZi5tb2RpZmllcnMuY2FwdHVyZSk7XG4gICAgICB9O1xuICAgICAgdGhpcy5vbignbG9hZCcsIHRoaXMuaWZyYW1lQmluZCk7XG4gICAgfVxuICB9LFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gdXBkYXRlKGhhbmRsZXIpIHtcbiAgICAvLyBzdHViIGEgbm9vcCBmb3Igdi1vbiB3aXRoIG5vIHZhbHVlLFxuICAgIC8vIGUuZy4gQG1vdXNlZG93bi5wcmV2ZW50XG4gICAgaWYgKCF0aGlzLmRlc2NyaXB0b3IucmF3KSB7XG4gICAgICBoYW5kbGVyID0gZnVuY3Rpb24gKCkge307XG4gICAgfVxuXG4gICAgaWYgKHR5cGVvZiBoYW5kbGVyICE9PSAnZnVuY3Rpb24nKSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ3Ytb246JyArIHRoaXMuYXJnICsgJz1cIicgKyB0aGlzLmV4cHJlc3Npb24gKyAnXCIgZXhwZWN0cyBhIGZ1bmN0aW9uIHZhbHVlLCAnICsgJ2dvdCAnICsgaGFuZGxlciwgdGhpcy52bSk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gYXBwbHkgbW9kaWZpZXJzXG4gICAgaWYgKHRoaXMubW9kaWZpZXJzLnN0b3ApIHtcbiAgICAgIGhhbmRsZXIgPSBzdG9wRmlsdGVyKGhhbmRsZXIpO1xuICAgIH1cbiAgICBpZiAodGhpcy5tb2RpZmllcnMucHJldmVudCkge1xuICAgICAgaGFuZGxlciA9IHByZXZlbnRGaWx0ZXIoaGFuZGxlcik7XG4gICAgfVxuICAgIGlmICh0aGlzLm1vZGlmaWVycy5zZWxmKSB7XG4gICAgICBoYW5kbGVyID0gc2VsZkZpbHRlcihoYW5kbGVyKTtcbiAgICB9XG4gICAgLy8ga2V5IGZpbHRlclxuICAgIHZhciBrZXlzID0gT2JqZWN0LmtleXModGhpcy5tb2RpZmllcnMpLmZpbHRlcihmdW5jdGlvbiAoa2V5KSB7XG4gICAgICByZXR1cm4ga2V5ICE9PSAnc3RvcCcgJiYga2V5ICE9PSAncHJldmVudCcgJiYga2V5ICE9PSAnc2VsZicgJiYga2V5ICE9PSAnY2FwdHVyZSc7XG4gICAgfSk7XG4gICAgaWYgKGtleXMubGVuZ3RoKSB7XG4gICAgICBoYW5kbGVyID0ga2V5RmlsdGVyKGhhbmRsZXIsIGtleXMpO1xuICAgIH1cblxuICAgIHRoaXMucmVzZXQoKTtcbiAgICB0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuXG4gICAgaWYgKHRoaXMuaWZyYW1lQmluZCkge1xuICAgICAgdGhpcy5pZnJhbWVCaW5kKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIG9uKHRoaXMuZWwsIHRoaXMuYXJnLCB0aGlzLmhhbmRsZXIsIHRoaXMubW9kaWZpZXJzLmNhcHR1cmUpO1xuICAgIH1cbiAgfSxcblxuICByZXNldDogZnVuY3Rpb24gcmVzZXQoKSB7XG4gICAgdmFyIGVsID0gdGhpcy5pZnJhbWVCaW5kID8gdGhpcy5lbC5jb250ZW50V2luZG93IDogdGhpcy5lbDtcbiAgICBpZiAodGhpcy5oYW5kbGVyKSB7XG4gICAgICBvZmYoZWwsIHRoaXMuYXJnLCB0aGlzLmhhbmRsZXIpO1xuICAgIH1cbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uIHVuYmluZCgpIHtcbiAgICB0aGlzLnJlc2V0KCk7XG4gIH1cbn07XG5cbnZhciBwcmVmaXhlcyA9IFsnLXdlYmtpdC0nLCAnLW1vei0nLCAnLW1zLSddO1xudmFyIGNhbWVsUHJlZml4ZXMgPSBbJ1dlYmtpdCcsICdNb3onLCAnbXMnXTtcbnZhciBpbXBvcnRhbnRSRSA9IC8haW1wb3J0YW50Oz8kLztcbnZhciBwcm9wQ2FjaGUgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXG52YXIgdGVzdEVsID0gbnVsbDtcblxudmFyIHN0eWxlID0ge1xuXG4gIGRlZXA6IHRydWUsXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUodmFsdWUpIHtcbiAgICBpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuICAgICAgdGhpcy5lbC5zdHlsZS5jc3NUZXh0ID0gdmFsdWU7XG4gICAgfSBlbHNlIGlmIChpc0FycmF5KHZhbHVlKSkge1xuICAgICAgdGhpcy5oYW5kbGVPYmplY3QodmFsdWUucmVkdWNlKGV4dGVuZCwge30pKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5oYW5kbGVPYmplY3QodmFsdWUgfHwge30pO1xuICAgIH1cbiAgfSxcblxuICBoYW5kbGVPYmplY3Q6IGZ1bmN0aW9uIGhhbmRsZU9iamVjdCh2YWx1ZSkge1xuICAgIC8vIGNhY2hlIG9iamVjdCBzdHlsZXMgc28gdGhhdCBvbmx5IGNoYW5nZWQgcHJvcHNcbiAgICAvLyBhcmUgYWN0dWFsbHkgdXBkYXRlZC5cbiAgICB2YXIgY2FjaGUgPSB0aGlzLmNhY2hlIHx8ICh0aGlzLmNhY2hlID0ge30pO1xuICAgIHZhciBuYW1lLCB2YWw7XG4gICAgZm9yIChuYW1lIGluIGNhY2hlKSB7XG4gICAgICBpZiAoIShuYW1lIGluIHZhbHVlKSkge1xuICAgICAgICB0aGlzLmhhbmRsZVNpbmdsZShuYW1lLCBudWxsKTtcbiAgICAgICAgZGVsZXRlIGNhY2hlW25hbWVdO1xuICAgICAgfVxuICAgIH1cbiAgICBmb3IgKG5hbWUgaW4gdmFsdWUpIHtcbiAgICAgIHZhbCA9IHZhbHVlW25hbWVdO1xuICAgICAgaWYgKHZhbCAhPT0gY2FjaGVbbmFtZV0pIHtcbiAgICAgICAgY2FjaGVbbmFtZV0gPSB2YWw7XG4gICAgICAgIHRoaXMuaGFuZGxlU2luZ2xlKG5hbWUsIHZhbCk7XG4gICAgICB9XG4gICAgfVxuICB9LFxuXG4gIGhhbmRsZVNpbmdsZTogZnVuY3Rpb24gaGFuZGxlU2luZ2xlKHByb3AsIHZhbHVlKSB7XG4gICAgcHJvcCA9IG5vcm1hbGl6ZShwcm9wKTtcbiAgICBpZiAoIXByb3ApIHJldHVybjsgLy8gdW5zdXBwb3J0ZWQgcHJvcFxuICAgIC8vIGNhc3QgcG9zc2libGUgbnVtYmVycy9ib29sZWFucyBpbnRvIHN0cmluZ3NcbiAgICBpZiAodmFsdWUgIT0gbnVsbCkgdmFsdWUgKz0gJyc7XG4gICAgaWYgKHZhbHVlKSB7XG4gICAgICB2YXIgaXNJbXBvcnRhbnQgPSBpbXBvcnRhbnRSRS50ZXN0KHZhbHVlKSA/ICdpbXBvcnRhbnQnIDogJyc7XG4gICAgICBpZiAoaXNJbXBvcnRhbnQpIHtcbiAgICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgICAgd2FybignSXRcXCdzIHByb2JhYmx5IGEgYmFkIGlkZWEgdG8gdXNlICFpbXBvcnRhbnQgd2l0aCBpbmxpbmUgcnVsZXMuICcgKyAnVGhpcyBmZWF0dXJlIHdpbGwgYmUgZGVwcmVjYXRlZCBpbiBhIGZ1dHVyZSB2ZXJzaW9uIG9mIFZ1ZS4nKTtcbiAgICAgICAgfVxuICAgICAgICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoaW1wb3J0YW50UkUsICcnKS50cmltKCk7XG4gICAgICAgIHRoaXMuZWwuc3R5bGUuc2V0UHJvcGVydHkocHJvcC5rZWJhYiwgdmFsdWUsIGlzSW1wb3J0YW50KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZWwuc3R5bGVbcHJvcC5jYW1lbF0gPSB2YWx1ZTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5lbC5zdHlsZVtwcm9wLmNhbWVsXSA9ICcnO1xuICAgIH1cbiAgfVxuXG59O1xuXG4vKipcbiAqIE5vcm1hbGl6ZSBhIENTUyBwcm9wZXJ0eSBuYW1lLlxuICogLSBjYWNoZSByZXN1bHRcbiAqIC0gYXV0byBwcmVmaXhcbiAqIC0gY2FtZWxDYXNlIC0+IGRhc2gtY2FzZVxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBwcm9wXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gbm9ybWFsaXplKHByb3ApIHtcbiAgaWYgKHByb3BDYWNoZVtwcm9wXSkge1xuICAgIHJldHVybiBwcm9wQ2FjaGVbcHJvcF07XG4gIH1cbiAgdmFyIHJlcyA9IHByZWZpeChwcm9wKTtcbiAgcHJvcENhY2hlW3Byb3BdID0gcHJvcENhY2hlW3Jlc10gPSByZXM7XG4gIHJldHVybiByZXM7XG59XG5cbi8qKlxuICogQXV0byBkZXRlY3QgdGhlIGFwcHJvcHJpYXRlIHByZWZpeCBmb3IgYSBDU1MgcHJvcGVydHkuXG4gKiBodHRwczovL2dpc3QuZ2l0aHViLmNvbS9wYXVsaXJpc2gvNTIzNjkyXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHByb3BcbiAqIEByZXR1cm4ge1N0cmluZ31cbiAqL1xuXG5mdW5jdGlvbiBwcmVmaXgocHJvcCkge1xuICBwcm9wID0gaHlwaGVuYXRlKHByb3ApO1xuICB2YXIgY2FtZWwgPSBjYW1lbGl6ZShwcm9wKTtcbiAgdmFyIHVwcGVyID0gY2FtZWwuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyBjYW1lbC5zbGljZSgxKTtcbiAgaWYgKCF0ZXN0RWwpIHtcbiAgICB0ZXN0RWwgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdkaXYnKTtcbiAgfVxuICB2YXIgaSA9IHByZWZpeGVzLmxlbmd0aDtcbiAgdmFyIHByZWZpeGVkO1xuICBpZiAoY2FtZWwgIT09ICdmaWx0ZXInICYmIGNhbWVsIGluIHRlc3RFbC5zdHlsZSkge1xuICAgIHJldHVybiB7XG4gICAgICBrZWJhYjogcHJvcCxcbiAgICAgIGNhbWVsOiBjYW1lbFxuICAgIH07XG4gIH1cbiAgd2hpbGUgKGktLSkge1xuICAgIHByZWZpeGVkID0gY2FtZWxQcmVmaXhlc1tpXSArIHVwcGVyO1xuICAgIGlmIChwcmVmaXhlZCBpbiB0ZXN0RWwuc3R5bGUpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIGtlYmFiOiBwcmVmaXhlc1tpXSArIHByb3AsXG4gICAgICAgIGNhbWVsOiBwcmVmaXhlZFxuICAgICAgfTtcbiAgICB9XG4gIH1cbn1cblxuLy8geGxpbmtcbnZhciB4bGlua05TID0gJ2h0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsnO1xudmFyIHhsaW5rUkUgPSAvXnhsaW5rOi87XG5cbi8vIGNoZWNrIGZvciBhdHRyaWJ1dGVzIHRoYXQgcHJvaGliaXQgaW50ZXJwb2xhdGlvbnNcbnZhciBkaXNhbGxvd2VkSW50ZXJwQXR0clJFID0gL152LXxeOnxeQHxeKD86aXN8dHJhbnNpdGlvbnx0cmFuc2l0aW9uLW1vZGV8ZGVib3VuY2V8dHJhY2stYnl8c3RhZ2dlcnxlbnRlci1zdGFnZ2VyfGxlYXZlLXN0YWdnZXIpJC87XG4vLyB0aGVzZSBhdHRyaWJ1dGVzIHNob3VsZCBhbHNvIHNldCB0aGVpciBjb3JyZXNwb25kaW5nIHByb3BlcnRpZXNcbi8vIGJlY2F1c2UgdGhleSBvbmx5IGFmZmVjdCB0aGUgaW5pdGlhbCBzdGF0ZSBvZiB0aGUgZWxlbWVudFxudmFyIGF0dHJXaXRoUHJvcHNSRSA9IC9eKD86dmFsdWV8Y2hlY2tlZHxzZWxlY3RlZHxtdXRlZCkkLztcbi8vIHRoZXNlIGF0dHJpYnV0ZXMgZXhwZWN0IGVudW1yYXRlZCB2YWx1ZXMgb2YgXCJ0cnVlXCIgb3IgXCJmYWxzZVwiXG4vLyBidXQgYXJlIG5vdCBib29sZWFuIGF0dHJpYnV0ZXNcbnZhciBlbnVtZXJhdGVkQXR0clJFID0gL14oPzpkcmFnZ2FibGV8Y29udGVudGVkaXRhYmxlfHNwZWxsY2hlY2spJC87XG5cbi8vIHRoZXNlIGF0dHJpYnV0ZXMgc2hvdWxkIHNldCBhIGhpZGRlbiBwcm9wZXJ0eSBmb3Jcbi8vIGJpbmRpbmcgdi1tb2RlbCB0byBvYmplY3QgdmFsdWVzXG52YXIgbW9kZWxQcm9wcyA9IHtcbiAgdmFsdWU6ICdfdmFsdWUnLFxuICAndHJ1ZS12YWx1ZSc6ICdfdHJ1ZVZhbHVlJyxcbiAgJ2ZhbHNlLXZhbHVlJzogJ19mYWxzZVZhbHVlJ1xufTtcblxudmFyIGJpbmQkMSA9IHtcblxuICBwcmlvcml0eTogQklORCxcblxuICBiaW5kOiBmdW5jdGlvbiBiaW5kKCkge1xuICAgIHZhciBhdHRyID0gdGhpcy5hcmc7XG4gICAgdmFyIHRhZyA9IHRoaXMuZWwudGFnTmFtZTtcbiAgICAvLyBzaG91bGQgYmUgZGVlcCB3YXRjaCBvbiBvYmplY3QgbW9kZVxuICAgIGlmICghYXR0cikge1xuICAgICAgdGhpcy5kZWVwID0gdHJ1ZTtcbiAgICB9XG4gICAgLy8gaGFuZGxlIGludGVycG9sYXRpb24gYmluZGluZ3NcbiAgICB2YXIgZGVzY3JpcHRvciA9IHRoaXMuZGVzY3JpcHRvcjtcbiAgICB2YXIgdG9rZW5zID0gZGVzY3JpcHRvci5pbnRlcnA7XG4gICAgaWYgKHRva2Vucykge1xuICAgICAgLy8gaGFuZGxlIGludGVycG9sYXRpb25zIHdpdGggb25lLXRpbWUgdG9rZW5zXG4gICAgICBpZiAoZGVzY3JpcHRvci5oYXNPbmVUaW1lKSB7XG4gICAgICAgIHRoaXMuZXhwcmVzc2lvbiA9IHRva2Vuc1RvRXhwKHRva2VucywgdGhpcy5fc2NvcGUgfHwgdGhpcy52bSk7XG4gICAgICB9XG5cbiAgICAgIC8vIG9ubHkgYWxsb3cgYmluZGluZyBvbiBuYXRpdmUgYXR0cmlidXRlc1xuICAgICAgaWYgKGRpc2FsbG93ZWRJbnRlcnBBdHRyUkUudGVzdChhdHRyKSB8fCBhdHRyID09PSAnbmFtZScgJiYgKHRhZyA9PT0gJ1BBUlRJQUwnIHx8IHRhZyA9PT0gJ1NMT1QnKSkge1xuICAgICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oYXR0ciArICc9XCInICsgZGVzY3JpcHRvci5yYXcgKyAnXCI6ICcgKyAnYXR0cmlidXRlIGludGVycG9sYXRpb24gaXMgbm90IGFsbG93ZWQgaW4gVnVlLmpzICcgKyAnZGlyZWN0aXZlcyBhbmQgc3BlY2lhbCBhdHRyaWJ1dGVzLicsIHRoaXMudm0pO1xuICAgICAgICB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgICAgICAgdGhpcy5pbnZhbGlkID0gdHJ1ZTtcbiAgICAgIH1cblxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICB2YXIgcmF3ID0gYXR0ciArICc9XCInICsgZGVzY3JpcHRvci5yYXcgKyAnXCI6ICc7XG4gICAgICAgIC8vIHdhcm4gc3JjXG4gICAgICAgIGlmIChhdHRyID09PSAnc3JjJykge1xuICAgICAgICAgIHdhcm4ocmF3ICsgJ2ludGVycG9sYXRpb24gaW4gXCJzcmNcIiBhdHRyaWJ1dGUgd2lsbCBjYXVzZSAnICsgJ2EgNDA0IHJlcXVlc3QuIFVzZSB2LWJpbmQ6c3JjIGluc3RlYWQuJywgdGhpcy52bSk7XG4gICAgICAgIH1cblxuICAgICAgICAvLyB3YXJuIHN0eWxlXG4gICAgICAgIGlmIChhdHRyID09PSAnc3R5bGUnKSB7XG4gICAgICAgICAgd2FybihyYXcgKyAnaW50ZXJwb2xhdGlvbiBpbiBcInN0eWxlXCIgYXR0cmlidXRlIHdpbGwgY2F1c2UgJyArICd0aGUgYXR0cmlidXRlIHRvIGJlIGRpc2NhcmRlZCBpbiBJbnRlcm5ldCBFeHBsb3Jlci4gJyArICdVc2Ugdi1iaW5kOnN0eWxlIGluc3RlYWQuJywgdGhpcy52bSk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUodmFsdWUpIHtcbiAgICBpZiAodGhpcy5pbnZhbGlkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIHZhciBhdHRyID0gdGhpcy5hcmc7XG4gICAgaWYgKHRoaXMuYXJnKSB7XG4gICAgICB0aGlzLmhhbmRsZVNpbmdsZShhdHRyLCB2YWx1ZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuaGFuZGxlT2JqZWN0KHZhbHVlIHx8IHt9KTtcbiAgICB9XG4gIH0sXG5cbiAgLy8gc2hhcmUgb2JqZWN0IGhhbmRsZXIgd2l0aCB2LWJpbmQ6Y2xhc3NcbiAgaGFuZGxlT2JqZWN0OiBzdHlsZS5oYW5kbGVPYmplY3QsXG5cbiAgaGFuZGxlU2luZ2xlOiBmdW5jdGlvbiBoYW5kbGVTaW5nbGUoYXR0ciwgdmFsdWUpIHtcbiAgICB2YXIgZWwgPSB0aGlzLmVsO1xuICAgIHZhciBpbnRlcnAgPSB0aGlzLmRlc2NyaXB0b3IuaW50ZXJwO1xuICAgIGlmICh0aGlzLm1vZGlmaWVycy5jYW1lbCkge1xuICAgICAgYXR0ciA9IGNhbWVsaXplKGF0dHIpO1xuICAgIH1cbiAgICBpZiAoIWludGVycCAmJiBhdHRyV2l0aFByb3BzUkUudGVzdChhdHRyKSAmJiBhdHRyIGluIGVsKSB7XG4gICAgICB2YXIgYXR0clZhbHVlID0gYXR0ciA9PT0gJ3ZhbHVlJyA/IHZhbHVlID09IG51bGwgLy8gSUU5IHdpbGwgc2V0IGlucHV0LnZhbHVlIHRvIFwibnVsbFwiIGZvciBudWxsLi4uXG4gICAgICA/ICcnIDogdmFsdWUgOiB2YWx1ZTtcblxuICAgICAgaWYgKGVsW2F0dHJdICE9PSBhdHRyVmFsdWUpIHtcbiAgICAgICAgZWxbYXR0cl0gPSBhdHRyVmFsdWU7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIHNldCBtb2RlbCBwcm9wc1xuICAgIHZhciBtb2RlbFByb3AgPSBtb2RlbFByb3BzW2F0dHJdO1xuICAgIGlmICghaW50ZXJwICYmIG1vZGVsUHJvcCkge1xuICAgICAgZWxbbW9kZWxQcm9wXSA9IHZhbHVlO1xuICAgICAgLy8gdXBkYXRlIHYtbW9kZWwgaWYgcHJlc2VudFxuICAgICAgdmFyIG1vZGVsID0gZWwuX192X21vZGVsO1xuICAgICAgaWYgKG1vZGVsKSB7XG4gICAgICAgIG1vZGVsLmxpc3RlbmVyKCk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIGRvIG5vdCBzZXQgdmFsdWUgYXR0cmlidXRlIGZvciB0ZXh0YXJlYVxuICAgIGlmIChhdHRyID09PSAndmFsdWUnICYmIGVsLnRhZ05hbWUgPT09ICdURVhUQVJFQScpIHtcbiAgICAgIGVsLnJlbW92ZUF0dHJpYnV0ZShhdHRyKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgLy8gdXBkYXRlIGF0dHJpYnV0ZVxuICAgIGlmIChlbnVtZXJhdGVkQXR0clJFLnRlc3QoYXR0cikpIHtcbiAgICAgIGVsLnNldEF0dHJpYnV0ZShhdHRyLCB2YWx1ZSA/ICd0cnVlJyA6ICdmYWxzZScpO1xuICAgIH0gZWxzZSBpZiAodmFsdWUgIT0gbnVsbCAmJiB2YWx1ZSAhPT0gZmFsc2UpIHtcbiAgICAgIGlmIChhdHRyID09PSAnY2xhc3MnKSB7XG4gICAgICAgIC8vIGhhbmRsZSBlZGdlIGNhc2UgIzE5NjA6XG4gICAgICAgIC8vIGNsYXNzIGludGVycG9sYXRpb24gc2hvdWxkIG5vdCBvdmVyd3JpdGUgVnVlIHRyYW5zaXRpb24gY2xhc3NcbiAgICAgICAgaWYgKGVsLl9fdl90cmFucykge1xuICAgICAgICAgIHZhbHVlICs9ICcgJyArIGVsLl9fdl90cmFucy5pZCArICctdHJhbnNpdGlvbic7XG4gICAgICAgIH1cbiAgICAgICAgc2V0Q2xhc3MoZWwsIHZhbHVlKTtcbiAgICAgIH0gZWxzZSBpZiAoeGxpbmtSRS50ZXN0KGF0dHIpKSB7XG4gICAgICAgIGVsLnNldEF0dHJpYnV0ZU5TKHhsaW5rTlMsIGF0dHIsIHZhbHVlID09PSB0cnVlID8gJycgOiB2YWx1ZSk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBlbC5zZXRBdHRyaWJ1dGUoYXR0ciwgdmFsdWUgPT09IHRydWUgPyAnJyA6IHZhbHVlKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgZWwucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICAgIH1cbiAgfVxufTtcblxudmFyIGVsID0ge1xuXG4gIHByaW9yaXR5OiBFTCxcblxuICBiaW5kOiBmdW5jdGlvbiBiaW5kKCkge1xuICAgIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICAgIGlmICghdGhpcy5hcmcpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG4gICAgdmFyIGlkID0gdGhpcy5pZCA9IGNhbWVsaXplKHRoaXMuYXJnKTtcbiAgICB2YXIgcmVmcyA9ICh0aGlzLl9zY29wZSB8fCB0aGlzLnZtKS4kZWxzO1xuICAgIGlmIChoYXNPd24ocmVmcywgaWQpKSB7XG4gICAgICByZWZzW2lkXSA9IHRoaXMuZWw7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlZmluZVJlYWN0aXZlKHJlZnMsIGlkLCB0aGlzLmVsKTtcbiAgICB9XG4gIH0sXG5cbiAgdW5iaW5kOiBmdW5jdGlvbiB1bmJpbmQoKSB7XG4gICAgdmFyIHJlZnMgPSAodGhpcy5fc2NvcGUgfHwgdGhpcy52bSkuJGVscztcbiAgICBpZiAocmVmc1t0aGlzLmlkXSA9PT0gdGhpcy5lbCkge1xuICAgICAgcmVmc1t0aGlzLmlkXSA9IG51bGw7XG4gICAgfVxuICB9XG59O1xuXG52YXIgcmVmID0ge1xuICBiaW5kOiBmdW5jdGlvbiBiaW5kKCkge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2Fybigndi1yZWY6JyArIHRoaXMuYXJnICsgJyBtdXN0IGJlIHVzZWQgb24gYSBjaGlsZCAnICsgJ2NvbXBvbmVudC4gRm91bmQgb24gPCcgKyB0aGlzLmVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSArICc+LicsIHRoaXMudm0pO1xuICB9XG59O1xuXG52YXIgY2xvYWsgPSB7XG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdmFyIGVsID0gdGhpcy5lbDtcbiAgICB0aGlzLnZtLiRvbmNlKCdwcmUtaG9vazpjb21waWxlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgIGVsLnJlbW92ZUF0dHJpYnV0ZSgndi1jbG9haycpO1xuICAgIH0pO1xuICB9XG59O1xuXG4vLyBtdXN0IGV4cG9ydCBwbGFpbiBvYmplY3RcbnZhciBkaXJlY3RpdmVzID0ge1xuICB0ZXh0OiB0ZXh0JDEsXG4gIGh0bWw6IGh0bWwsXG4gICdmb3InOiB2Rm9yLFxuICAnaWYnOiB2SWYsXG4gIHNob3c6IHNob3csXG4gIG1vZGVsOiBtb2RlbCxcbiAgb246IG9uJDEsXG4gIGJpbmQ6IGJpbmQkMSxcbiAgZWw6IGVsLFxuICByZWY6IHJlZixcbiAgY2xvYWs6IGNsb2FrXG59O1xuXG52YXIgdkNsYXNzID0ge1xuXG4gIGRlZXA6IHRydWUsXG5cbiAgdXBkYXRlOiBmdW5jdGlvbiB1cGRhdGUodmFsdWUpIHtcbiAgICBpZiAoIXZhbHVlKSB7XG4gICAgICB0aGlzLmNsZWFudXAoKTtcbiAgICB9IGVsc2UgaWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHRoaXMuc2V0Q2xhc3ModmFsdWUudHJpbSgpLnNwbGl0KC9cXHMrLykpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnNldENsYXNzKG5vcm1hbGl6ZSQxKHZhbHVlKSk7XG4gICAgfVxuICB9LFxuXG4gIHNldENsYXNzOiBmdW5jdGlvbiBzZXRDbGFzcyh2YWx1ZSkge1xuICAgIHRoaXMuY2xlYW51cCh2YWx1ZSk7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHZhciB2YWwgPSB2YWx1ZVtpXTtcbiAgICAgIGlmICh2YWwpIHtcbiAgICAgICAgYXBwbHkodGhpcy5lbCwgdmFsLCBhZGRDbGFzcyk7XG4gICAgICB9XG4gICAgfVxuICAgIHRoaXMucHJldktleXMgPSB2YWx1ZTtcbiAgfSxcblxuICBjbGVhbnVwOiBmdW5jdGlvbiBjbGVhbnVwKHZhbHVlKSB7XG4gICAgdmFyIHByZXZLZXlzID0gdGhpcy5wcmV2S2V5cztcbiAgICBpZiAoIXByZXZLZXlzKSByZXR1cm47XG4gICAgdmFyIGkgPSBwcmV2S2V5cy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgdmFyIGtleSA9IHByZXZLZXlzW2ldO1xuICAgICAgaWYgKCF2YWx1ZSB8fCB2YWx1ZS5pbmRleE9mKGtleSkgPCAwKSB7XG4gICAgICAgIGFwcGx5KHRoaXMuZWwsIGtleSwgcmVtb3ZlQ2xhc3MpO1xuICAgICAgfVxuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiBOb3JtYWxpemUgb2JqZWN0cyBhbmQgYXJyYXlzIChwb3RlbnRpYWxseSBjb250YWluaW5nIG9iamVjdHMpXG4gKiBpbnRvIGFycmF5IG9mIHN0cmluZ3MuXG4gKlxuICogQHBhcmFtIHtPYmplY3R8QXJyYXk8U3RyaW5nfE9iamVjdD59IHZhbHVlXG4gKiBAcmV0dXJuIHtBcnJheTxTdHJpbmc+fVxuICovXG5cbmZ1bmN0aW9uIG5vcm1hbGl6ZSQxKHZhbHVlKSB7XG4gIHZhciByZXMgPSBbXTtcbiAgaWYgKGlzQXJyYXkodmFsdWUpKSB7XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSB2YWx1ZS5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHZhciBfa2V5ID0gdmFsdWVbaV07XG4gICAgICBpZiAoX2tleSkge1xuICAgICAgICBpZiAodHlwZW9mIF9rZXkgPT09ICdzdHJpbmcnKSB7XG4gICAgICAgICAgcmVzLnB1c2goX2tleSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9yICh2YXIgayBpbiBfa2V5KSB7XG4gICAgICAgICAgICBpZiAoX2tleVtrXSkgcmVzLnB1c2goayk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICB9IGVsc2UgaWYgKGlzT2JqZWN0KHZhbHVlKSkge1xuICAgIGZvciAodmFyIGtleSBpbiB2YWx1ZSkge1xuICAgICAgaWYgKHZhbHVlW2tleV0pIHJlcy5wdXNoKGtleSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59XG5cbi8qKlxuICogQWRkIG9yIHJlbW92ZSBhIGNsYXNzL2NsYXNzZXMgb24gYW4gZWxlbWVudFxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXkgVGhlIGNsYXNzIG5hbWUuIFRoaXMgbWF5IG9yIG1heSBub3RcbiAqICAgICAgICAgICAgICAgICAgICAgY29udGFpbiBhIHNwYWNlIGNoYXJhY3RlciwgaW4gc3VjaCBhXG4gKiAgICAgICAgICAgICAgICAgICAgIGNhc2Ugd2UnbGwgZGVhbCB3aXRoIG11bHRpcGxlIGNsYXNzXG4gKiAgICAgICAgICAgICAgICAgICAgIG5hbWVzIGF0IG9uY2UuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICovXG5cbmZ1bmN0aW9uIGFwcGx5KGVsLCBrZXksIGZuKSB7XG4gIGtleSA9IGtleS50cmltKCk7XG4gIGlmIChrZXkuaW5kZXhPZignICcpID09PSAtMSkge1xuICAgIGZuKGVsLCBrZXkpO1xuICAgIHJldHVybjtcbiAgfVxuICAvLyBUaGUga2V5IGNvbnRhaW5zIG9uZSBvciBtb3JlIHNwYWNlIGNoYXJhY3RlcnMuXG4gIC8vIFNpbmNlIGEgY2xhc3MgbmFtZSBkb2Vzbid0IGFjY2VwdCBzdWNoIGNoYXJhY3RlcnMsIHdlXG4gIC8vIHRyZWF0IGl0IGFzIG11bHRpcGxlIGNsYXNzZXMuXG4gIHZhciBrZXlzID0ga2V5LnNwbGl0KC9cXHMrLyk7XG4gIGZvciAodmFyIGkgPSAwLCBsID0ga2V5cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmbihlbCwga2V5c1tpXSk7XG4gIH1cbn1cblxudmFyIGNvbXBvbmVudCA9IHtcblxuICBwcmlvcml0eTogQ09NUE9ORU5ULFxuXG4gIHBhcmFtczogWydrZWVwLWFsaXZlJywgJ3RyYW5zaXRpb24tbW9kZScsICdpbmxpbmUtdGVtcGxhdGUnXSxcblxuICAvKipcbiAgICogU2V0dXAuIFR3byBwb3NzaWJsZSB1c2FnZXM6XG4gICAqXG4gICAqIC0gc3RhdGljOlxuICAgKiAgIDxjb21wPiBvciA8ZGl2IHYtY29tcG9uZW50PVwiY29tcFwiPlxuICAgKlxuICAgKiAtIGR5bmFtaWM6XG4gICAqICAgPGNvbXBvbmVudCA6aXM9XCJ2aWV3XCI+XG4gICAqL1xuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgaWYgKCF0aGlzLmVsLl9fdnVlX18pIHtcbiAgICAgIC8vIGtlZXAtYWxpdmUgY2FjaGVcbiAgICAgIHRoaXMua2VlcEFsaXZlID0gdGhpcy5wYXJhbXMua2VlcEFsaXZlO1xuICAgICAgaWYgKHRoaXMua2VlcEFsaXZlKSB7XG4gICAgICAgIHRoaXMuY2FjaGUgPSB7fTtcbiAgICAgIH1cbiAgICAgIC8vIGNoZWNrIGlubGluZS10ZW1wbGF0ZVxuICAgICAgaWYgKHRoaXMucGFyYW1zLmlubGluZVRlbXBsYXRlKSB7XG4gICAgICAgIC8vIGV4dHJhY3QgaW5saW5lIHRlbXBsYXRlIGFzIGEgRG9jdW1lbnRGcmFnbWVudFxuICAgICAgICB0aGlzLmlubGluZVRlbXBsYXRlID0gZXh0cmFjdENvbnRlbnQodGhpcy5lbCwgdHJ1ZSk7XG4gICAgICB9XG4gICAgICAvLyBjb21wb25lbnQgcmVzb2x1dGlvbiByZWxhdGVkIHN0YXRlXG4gICAgICB0aGlzLnBlbmRpbmdDb21wb25lbnRDYiA9IHRoaXMuQ29tcG9uZW50ID0gbnVsbDtcbiAgICAgIC8vIHRyYW5zaXRpb24gcmVsYXRlZCBzdGF0ZVxuICAgICAgdGhpcy5wZW5kaW5nUmVtb3ZhbHMgPSAwO1xuICAgICAgdGhpcy5wZW5kaW5nUmVtb3ZhbENiID0gbnVsbDtcbiAgICAgIC8vIGNyZWF0ZSBhIHJlZiBhbmNob3JcbiAgICAgIHRoaXMuYW5jaG9yID0gY3JlYXRlQW5jaG9yKCd2LWNvbXBvbmVudCcpO1xuICAgICAgcmVwbGFjZSh0aGlzLmVsLCB0aGlzLmFuY2hvcik7XG4gICAgICAvLyByZW1vdmUgaXMgYXR0cmlidXRlLlxuICAgICAgLy8gdGhpcyBpcyByZW1vdmVkIGR1cmluZyBjb21waWxhdGlvbiwgYnV0IGJlY2F1c2UgY29tcGlsYXRpb24gaXNcbiAgICAgIC8vIGNhY2hlZCwgd2hlbiB0aGUgY29tcG9uZW50IGlzIHVzZWQgZWxzZXdoZXJlIHRoaXMgYXR0cmlidXRlXG4gICAgICAvLyB3aWxsIHJlbWFpbiBhdCBsaW5rIHRpbWUuXG4gICAgICB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZSgnaXMnKTtcbiAgICAgIHRoaXMuZWwucmVtb3ZlQXR0cmlidXRlKCc6aXMnKTtcbiAgICAgIC8vIHJlbW92ZSByZWYsIHNhbWUgYXMgYWJvdmVcbiAgICAgIGlmICh0aGlzLmRlc2NyaXB0b3IucmVmKSB7XG4gICAgICAgIHRoaXMuZWwucmVtb3ZlQXR0cmlidXRlKCd2LXJlZjonICsgaHlwaGVuYXRlKHRoaXMuZGVzY3JpcHRvci5yZWYpKTtcbiAgICAgIH1cbiAgICAgIC8vIGlmIHN0YXRpYywgYnVpbGQgcmlnaHQgbm93LlxuICAgICAgaWYgKHRoaXMubGl0ZXJhbCkge1xuICAgICAgICB0aGlzLnNldENvbXBvbmVudCh0aGlzLmV4cHJlc3Npb24pO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ2Nhbm5vdCBtb3VudCBjb21wb25lbnQgXCInICsgdGhpcy5leHByZXNzaW9uICsgJ1wiICcgKyAnb24gYWxyZWFkeSBtb3VudGVkIGVsZW1lbnQ6ICcgKyB0aGlzLmVsKTtcbiAgICB9XG4gIH0sXG5cbiAgLyoqXG4gICAqIFB1YmxpYyB1cGRhdGUsIGNhbGxlZCBieSB0aGUgd2F0Y2hlciBpbiB0aGUgZHluYW1pY1xuICAgKiBsaXRlcmFsIHNjZW5hcmlvLCBlLmcuIDxjb21wb25lbnQgOmlzPVwidmlld1wiPlxuICAgKi9cblxuICB1cGRhdGU6IGZ1bmN0aW9uIHVwZGF0ZSh2YWx1ZSkge1xuICAgIGlmICghdGhpcy5saXRlcmFsKSB7XG4gICAgICB0aGlzLnNldENvbXBvbmVudCh2YWx1ZSk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBTd2l0Y2ggZHluYW1pYyBjb21wb25lbnRzLiBNYXkgcmVzb2x2ZSB0aGUgY29tcG9uZW50XG4gICAqIGFzeW5jaHJvbm91c2x5LCBhbmQgcGVyZm9ybSB0cmFuc2l0aW9uIGJhc2VkIG9uXG4gICAqIHNwZWNpZmllZCB0cmFuc2l0aW9uIG1vZGUuIEFjY2VwdHMgYSBmZXcgYWRkaXRpb25hbFxuICAgKiBhcmd1bWVudHMgc3BlY2lmaWNhbGx5IGZvciB2dWUtcm91dGVyLlxuICAgKlxuICAgKiBUaGUgY2FsbGJhY2sgaXMgY2FsbGVkIHdoZW4gdGhlIGZ1bGwgdHJhbnNpdGlvbiBpc1xuICAgKiBmaW5pc2hlZC5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICovXG5cbiAgc2V0Q29tcG9uZW50OiBmdW5jdGlvbiBzZXRDb21wb25lbnQodmFsdWUsIGNiKSB7XG4gICAgdGhpcy5pbnZhbGlkYXRlUGVuZGluZygpO1xuICAgIGlmICghdmFsdWUpIHtcbiAgICAgIC8vIGp1c3QgcmVtb3ZlIGN1cnJlbnRcbiAgICAgIHRoaXMudW5idWlsZCh0cnVlKTtcbiAgICAgIHRoaXMucmVtb3ZlKHRoaXMuY2hpbGRWTSwgY2IpO1xuICAgICAgdGhpcy5jaGlsZFZNID0gbnVsbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdGhpcy5yZXNvbHZlQ29tcG9uZW50KHZhbHVlLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgIHNlbGYubW91bnRDb21wb25lbnQoY2IpO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBSZXNvbHZlIHRoZSBjb21wb25lbnQgY29uc3RydWN0b3IgdG8gdXNlIHdoZW4gY3JlYXRpbmdcbiAgICogdGhlIGNoaWxkIHZtLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ3xGdW5jdGlvbn0gdmFsdWVcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAgICovXG5cbiAgcmVzb2x2ZUNvbXBvbmVudDogZnVuY3Rpb24gcmVzb2x2ZUNvbXBvbmVudCh2YWx1ZSwgY2IpIHtcbiAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgdGhpcy5wZW5kaW5nQ29tcG9uZW50Q2IgPSBjYW5jZWxsYWJsZShmdW5jdGlvbiAoQ29tcG9uZW50KSB7XG4gICAgICBzZWxmLkNvbXBvbmVudE5hbWUgPSBDb21wb25lbnQub3B0aW9ucy5uYW1lIHx8ICh0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnID8gdmFsdWUgOiBudWxsKTtcbiAgICAgIHNlbGYuQ29tcG9uZW50ID0gQ29tcG9uZW50O1xuICAgICAgY2IoKTtcbiAgICB9KTtcbiAgICB0aGlzLnZtLl9yZXNvbHZlQ29tcG9uZW50KHZhbHVlLCB0aGlzLnBlbmRpbmdDb21wb25lbnRDYik7XG4gIH0sXG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhIG5ldyBpbnN0YW5jZSB1c2luZyB0aGUgY3VycmVudCBjb25zdHJ1Y3RvciBhbmRcbiAgICogcmVwbGFjZSB0aGUgZXhpc3RpbmcgaW5zdGFuY2UuIFRoaXMgbWV0aG9kIGRvZXNuJ3QgY2FyZVxuICAgKiB3aGV0aGVyIHRoZSBuZXcgY29tcG9uZW50IGFuZCB0aGUgb2xkIG9uZSBhcmUgYWN0dWFsbHlcbiAgICogdGhlIHNhbWUuXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICovXG5cbiAgbW91bnRDb21wb25lbnQ6IGZ1bmN0aW9uIG1vdW50Q29tcG9uZW50KGNiKSB7XG4gICAgLy8gYWN0dWFsIG1vdW50XG4gICAgdGhpcy51bmJ1aWxkKHRydWUpO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgYWN0aXZhdGVIb29rcyA9IHRoaXMuQ29tcG9uZW50Lm9wdGlvbnMuYWN0aXZhdGU7XG4gICAgdmFyIGNhY2hlZCA9IHRoaXMuZ2V0Q2FjaGVkKCk7XG4gICAgdmFyIG5ld0NvbXBvbmVudCA9IHRoaXMuYnVpbGQoKTtcbiAgICBpZiAoYWN0aXZhdGVIb29rcyAmJiAhY2FjaGVkKSB7XG4gICAgICB0aGlzLndhaXRpbmdGb3IgPSBuZXdDb21wb25lbnQ7XG4gICAgICBjYWxsQWN0aXZhdGVIb29rcyhhY3RpdmF0ZUhvb2tzLCBuZXdDb21wb25lbnQsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgaWYgKHNlbGYud2FpdGluZ0ZvciAhPT0gbmV3Q29tcG9uZW50KSB7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIHNlbGYud2FpdGluZ0ZvciA9IG51bGw7XG4gICAgICAgIHNlbGYudHJhbnNpdGlvbihuZXdDb21wb25lbnQsIGNiKTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyB1cGRhdGUgcmVmIGZvciBrZXB0LWFsaXZlIGNvbXBvbmVudFxuICAgICAgaWYgKGNhY2hlZCkge1xuICAgICAgICBuZXdDb21wb25lbnQuX3VwZGF0ZVJlZigpO1xuICAgICAgfVxuICAgICAgdGhpcy50cmFuc2l0aW9uKG5ld0NvbXBvbmVudCwgY2IpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogV2hlbiB0aGUgY29tcG9uZW50IGNoYW5nZXMgb3IgdW5iaW5kcyBiZWZvcmUgYW4gYXN5bmNcbiAgICogY29uc3RydWN0b3IgaXMgcmVzb2x2ZWQsIHdlIG5lZWQgdG8gaW52YWxpZGF0ZSBpdHNcbiAgICogcGVuZGluZyBjYWxsYmFjay5cbiAgICovXG5cbiAgaW52YWxpZGF0ZVBlbmRpbmc6IGZ1bmN0aW9uIGludmFsaWRhdGVQZW5kaW5nKCkge1xuICAgIGlmICh0aGlzLnBlbmRpbmdDb21wb25lbnRDYikge1xuICAgICAgdGhpcy5wZW5kaW5nQ29tcG9uZW50Q2IuY2FuY2VsKCk7XG4gICAgICB0aGlzLnBlbmRpbmdDb21wb25lbnRDYiA9IG51bGw7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBJbnN0YW50aWF0ZS9pbnNlcnQgYSBuZXcgY2hpbGQgdm0uXG4gICAqIElmIGtlZXAgYWxpdmUgYW5kIGhhcyBjYWNoZWQgaW5zdGFuY2UsIGluc2VydCB0aGF0XG4gICAqIGluc3RhbmNlOyBvdGhlcndpc2UgYnVpbGQgYSBuZXcgb25lIGFuZCBjYWNoZSBpdC5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IFtleHRyYU9wdGlvbnNdXG4gICAqIEByZXR1cm4ge1Z1ZX0gLSB0aGUgY3JlYXRlZCBpbnN0YW5jZVxuICAgKi9cblxuICBidWlsZDogZnVuY3Rpb24gYnVpbGQoZXh0cmFPcHRpb25zKSB7XG4gICAgdmFyIGNhY2hlZCA9IHRoaXMuZ2V0Q2FjaGVkKCk7XG4gICAgaWYgKGNhY2hlZCkge1xuICAgICAgcmV0dXJuIGNhY2hlZDtcbiAgICB9XG4gICAgaWYgKHRoaXMuQ29tcG9uZW50KSB7XG4gICAgICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgICAgIHZhciBvcHRpb25zID0ge1xuICAgICAgICBuYW1lOiB0aGlzLkNvbXBvbmVudE5hbWUsXG4gICAgICAgIGVsOiBjbG9uZU5vZGUodGhpcy5lbCksXG4gICAgICAgIHRlbXBsYXRlOiB0aGlzLmlubGluZVRlbXBsYXRlLFxuICAgICAgICAvLyBtYWtlIHN1cmUgdG8gYWRkIHRoZSBjaGlsZCB3aXRoIGNvcnJlY3QgcGFyZW50XG4gICAgICAgIC8vIGlmIHRoaXMgaXMgYSB0cmFuc2NsdWRlZCBjb21wb25lbnQsIGl0cyBwYXJlbnRcbiAgICAgICAgLy8gc2hvdWxkIGJlIHRoZSB0cmFuc2NsdXNpb24gaG9zdC5cbiAgICAgICAgcGFyZW50OiB0aGlzLl9ob3N0IHx8IHRoaXMudm0sXG4gICAgICAgIC8vIGlmIG5vIGlubGluZS10ZW1wbGF0ZSwgdGhlbiB0aGUgY29tcGlsZWRcbiAgICAgICAgLy8gbGlua2VyIGNhbiBiZSBjYWNoZWQgZm9yIGJldHRlciBwZXJmb3JtYW5jZS5cbiAgICAgICAgX2xpbmtlckNhY2hhYmxlOiAhdGhpcy5pbmxpbmVUZW1wbGF0ZSxcbiAgICAgICAgX3JlZjogdGhpcy5kZXNjcmlwdG9yLnJlZixcbiAgICAgICAgX2FzQ29tcG9uZW50OiB0cnVlLFxuICAgICAgICBfaXNSb3V0ZXJWaWV3OiB0aGlzLl9pc1JvdXRlclZpZXcsXG4gICAgICAgIC8vIGlmIHRoaXMgaXMgYSB0cmFuc2NsdWRlZCBjb21wb25lbnQsIGNvbnRleHRcbiAgICAgICAgLy8gd2lsbCBiZSB0aGUgY29tbW9uIHBhcmVudCB2bSBvZiB0aGlzIGluc3RhbmNlXG4gICAgICAgIC8vIGFuZCBpdHMgaG9zdC5cbiAgICAgICAgX2NvbnRleHQ6IHRoaXMudm0sXG4gICAgICAgIC8vIGlmIHRoaXMgaXMgaW5zaWRlIGFuIGlubGluZSB2LWZvciwgdGhlIHNjb3BlXG4gICAgICAgIC8vIHdpbGwgYmUgdGhlIGludGVybWVkaWF0ZSBzY29wZSBjcmVhdGVkIGZvciB0aGlzXG4gICAgICAgIC8vIHJlcGVhdCBmcmFnbWVudC4gdGhpcyBpcyB1c2VkIGZvciBsaW5raW5nIHByb3BzXG4gICAgICAgIC8vIGFuZCBjb250YWluZXIgZGlyZWN0aXZlcy5cbiAgICAgICAgX3Njb3BlOiB0aGlzLl9zY29wZSxcbiAgICAgICAgLy8gcGFzcyBpbiB0aGUgb3duZXIgZnJhZ21lbnQgb2YgdGhpcyBjb21wb25lbnQuXG4gICAgICAgIC8vIHRoaXMgaXMgbmVjZXNzYXJ5IHNvIHRoYXQgdGhlIGZyYWdtZW50IGNhbiBrZWVwXG4gICAgICAgIC8vIHRyYWNrIG9mIGl0cyBjb250YWluZWQgY29tcG9uZW50cyBpbiBvcmRlciB0b1xuICAgICAgICAvLyBjYWxsIGF0dGFjaC9kZXRhY2ggaG9va3MgZm9yIHRoZW0uXG4gICAgICAgIF9mcmFnOiB0aGlzLl9mcmFnXG4gICAgICB9O1xuICAgICAgLy8gZXh0cmEgb3B0aW9uc1xuICAgICAgLy8gaW4gMS4wLjAgdGhpcyBpcyB1c2VkIGJ5IHZ1ZS1yb3V0ZXIgb25seVxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAoZXh0cmFPcHRpb25zKSB7XG4gICAgICAgIGV4dGVuZChvcHRpb25zLCBleHRyYU9wdGlvbnMpO1xuICAgICAgfVxuICAgICAgdmFyIGNoaWxkID0gbmV3IHRoaXMuQ29tcG9uZW50KG9wdGlvbnMpO1xuICAgICAgaWYgKHRoaXMua2VlcEFsaXZlKSB7XG4gICAgICAgIHRoaXMuY2FjaGVbdGhpcy5Db21wb25lbnQuY2lkXSA9IGNoaWxkO1xuICAgICAgfVxuICAgICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB0aGlzLmVsLmhhc0F0dHJpYnV0ZSgndHJhbnNpdGlvbicpICYmIGNoaWxkLl9pc0ZyYWdtZW50KSB7XG4gICAgICAgIHdhcm4oJ1RyYW5zaXRpb25zIHdpbGwgbm90IHdvcmsgb24gYSBmcmFnbWVudCBpbnN0YW5jZS4gJyArICdUZW1wbGF0ZTogJyArIGNoaWxkLiRvcHRpb25zLnRlbXBsYXRlLCBjaGlsZCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gY2hpbGQ7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBUcnkgdG8gZ2V0IGEgY2FjaGVkIGluc3RhbmNlIG9mIHRoZSBjdXJyZW50IGNvbXBvbmVudC5cbiAgICpcbiAgICogQHJldHVybiB7VnVlfHVuZGVmaW5lZH1cbiAgICovXG5cbiAgZ2V0Q2FjaGVkOiBmdW5jdGlvbiBnZXRDYWNoZWQoKSB7XG4gICAgcmV0dXJuIHRoaXMua2VlcEFsaXZlICYmIHRoaXMuY2FjaGVbdGhpcy5Db21wb25lbnQuY2lkXTtcbiAgfSxcblxuICAvKipcbiAgICogVGVhcmRvd24gdGhlIGN1cnJlbnQgY2hpbGQsIGJ1dCBkZWZlcnMgY2xlYW51cCBzb1xuICAgKiB0aGF0IHdlIGNhbiBzZXBhcmF0ZSB0aGUgZGVzdHJveSBhbmQgcmVtb3ZhbCBzdGVwcy5cbiAgICpcbiAgICogQHBhcmFtIHtCb29sZWFufSBkZWZlclxuICAgKi9cblxuICB1bmJ1aWxkOiBmdW5jdGlvbiB1bmJ1aWxkKGRlZmVyKSB7XG4gICAgaWYgKHRoaXMud2FpdGluZ0Zvcikge1xuICAgICAgaWYgKCF0aGlzLmtlZXBBbGl2ZSkge1xuICAgICAgICB0aGlzLndhaXRpbmdGb3IuJGRlc3Ryb3koKTtcbiAgICAgIH1cbiAgICAgIHRoaXMud2FpdGluZ0ZvciA9IG51bGw7XG4gICAgfVxuICAgIHZhciBjaGlsZCA9IHRoaXMuY2hpbGRWTTtcbiAgICBpZiAoIWNoaWxkIHx8IHRoaXMua2VlcEFsaXZlKSB7XG4gICAgICBpZiAoY2hpbGQpIHtcbiAgICAgICAgLy8gcmVtb3ZlIHJlZlxuICAgICAgICBjaGlsZC5faW5hY3RpdmUgPSB0cnVlO1xuICAgICAgICBjaGlsZC5fdXBkYXRlUmVmKHRydWUpO1xuICAgICAgfVxuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyB0aGUgc29sZSBwdXJwb3NlIG9mIGBkZWZlckNsZWFudXBgIGlzIHNvIHRoYXQgd2UgY2FuXG4gICAgLy8gXCJkZWFjdGl2YXRlXCIgdGhlIHZtIHJpZ2h0IG5vdyBhbmQgcGVyZm9ybSBET00gcmVtb3ZhbFxuICAgIC8vIGxhdGVyLlxuICAgIGNoaWxkLiRkZXN0cm95KGZhbHNlLCBkZWZlcik7XG4gIH0sXG5cbiAgLyoqXG4gICAqIFJlbW92ZSBjdXJyZW50IGRlc3Ryb3llZCBjaGlsZCBhbmQgbWFudWFsbHkgZG9cbiAgICogdGhlIGNsZWFudXAgYWZ0ZXIgcmVtb3ZhbC5cbiAgICpcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAgICovXG5cbiAgcmVtb3ZlOiBmdW5jdGlvbiByZW1vdmUoY2hpbGQsIGNiKSB7XG4gICAgdmFyIGtlZXBBbGl2ZSA9IHRoaXMua2VlcEFsaXZlO1xuICAgIGlmIChjaGlsZCkge1xuICAgICAgLy8gd2UgbWF5IGhhdmUgYSBjb21wb25lbnQgc3dpdGNoIHdoZW4gYSBwcmV2aW91c1xuICAgICAgLy8gY29tcG9uZW50IGlzIHN0aWxsIGJlaW5nIHRyYW5zaXRpb25lZCBvdXQuXG4gICAgICAvLyB3ZSB3YW50IHRvIHRyaWdnZXIgb25seSBvbmUgbGFzdGVzdCBpbnNlcnRpb24gY2JcbiAgICAgIC8vIHdoZW4gdGhlIGV4aXN0aW5nIHRyYW5zaXRpb24gZmluaXNoZXMuICgjMTExOSlcbiAgICAgIHRoaXMucGVuZGluZ1JlbW92YWxzKys7XG4gICAgICB0aGlzLnBlbmRpbmdSZW1vdmFsQ2IgPSBjYjtcbiAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgIGNoaWxkLiRyZW1vdmUoZnVuY3Rpb24gKCkge1xuICAgICAgICBzZWxmLnBlbmRpbmdSZW1vdmFscy0tO1xuICAgICAgICBpZiAoIWtlZXBBbGl2ZSkgY2hpbGQuX2NsZWFudXAoKTtcbiAgICAgICAgaWYgKCFzZWxmLnBlbmRpbmdSZW1vdmFscyAmJiBzZWxmLnBlbmRpbmdSZW1vdmFsQ2IpIHtcbiAgICAgICAgICBzZWxmLnBlbmRpbmdSZW1vdmFsQ2IoKTtcbiAgICAgICAgICBzZWxmLnBlbmRpbmdSZW1vdmFsQ2IgPSBudWxsO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9IGVsc2UgaWYgKGNiKSB7XG4gICAgICBjYigpO1xuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogQWN0dWFsbHkgc3dhcCB0aGUgY29tcG9uZW50cywgZGVwZW5kaW5nIG9uIHRoZVxuICAgKiB0cmFuc2l0aW9uIG1vZGUuIERlZmF1bHRzIHRvIHNpbXVsdGFuZW91cy5cbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IHRhcmdldFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gICAqL1xuXG4gIHRyYW5zaXRpb246IGZ1bmN0aW9uIHRyYW5zaXRpb24odGFyZ2V0LCBjYikge1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgY3VycmVudCA9IHRoaXMuY2hpbGRWTTtcbiAgICAvLyBmb3IgZGV2dG9vbCBpbnNwZWN0aW9uXG4gICAgaWYgKGN1cnJlbnQpIGN1cnJlbnQuX2luYWN0aXZlID0gdHJ1ZTtcbiAgICB0YXJnZXQuX2luYWN0aXZlID0gZmFsc2U7XG4gICAgdGhpcy5jaGlsZFZNID0gdGFyZ2V0O1xuICAgIHN3aXRjaCAoc2VsZi5wYXJhbXMudHJhbnNpdGlvbk1vZGUpIHtcbiAgICAgIGNhc2UgJ2luLW91dCc6XG4gICAgICAgIHRhcmdldC4kYmVmb3JlKHNlbGYuYW5jaG9yLCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgc2VsZi5yZW1vdmUoY3VycmVudCwgY2IpO1xuICAgICAgICB9KTtcbiAgICAgICAgYnJlYWs7XG4gICAgICBjYXNlICdvdXQtaW4nOlxuICAgICAgICBzZWxmLnJlbW92ZShjdXJyZW50LCBmdW5jdGlvbiAoKSB7XG4gICAgICAgICAgdGFyZ2V0LiRiZWZvcmUoc2VsZi5hbmNob3IsIGNiKTtcbiAgICAgICAgfSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgZGVmYXVsdDpcbiAgICAgICAgc2VsZi5yZW1vdmUoY3VycmVudCk7XG4gICAgICAgIHRhcmdldC4kYmVmb3JlKHNlbGYuYW5jaG9yLCBjYik7XG4gICAgfVxuICB9LFxuXG4gIC8qKlxuICAgKiBVbmJpbmQuXG4gICAqL1xuXG4gIHVuYmluZDogZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIHRoaXMuaW52YWxpZGF0ZVBlbmRpbmcoKTtcbiAgICAvLyBEbyBub3QgZGVmZXIgY2xlYW51cCB3aGVuIHVuYmluZGluZ1xuICAgIHRoaXMudW5idWlsZCgpO1xuICAgIC8vIGRlc3Ryb3kgYWxsIGtlZXAtYWxpdmUgY2FjaGVkIGluc3RhbmNlc1xuICAgIGlmICh0aGlzLmNhY2hlKSB7XG4gICAgICBmb3IgKHZhciBrZXkgaW4gdGhpcy5jYWNoZSkge1xuICAgICAgICB0aGlzLmNhY2hlW2tleV0uJGRlc3Ryb3koKTtcbiAgICAgIH1cbiAgICAgIHRoaXMuY2FjaGUgPSBudWxsO1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiBDYWxsIGFjdGl2YXRlIGhvb2tzIGluIG9yZGVyIChhc3luY2hyb25vdXMpXG4gKlxuICogQHBhcmFtIHtBcnJheX0gaG9va3NcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAqL1xuXG5mdW5jdGlvbiBjYWxsQWN0aXZhdGVIb29rcyhob29rcywgdm0sIGNiKSB7XG4gIHZhciB0b3RhbCA9IGhvb2tzLmxlbmd0aDtcbiAgdmFyIGNhbGxlZCA9IDA7XG4gIGhvb2tzWzBdLmNhbGwodm0sIG5leHQpO1xuICBmdW5jdGlvbiBuZXh0KCkge1xuICAgIGlmICgrK2NhbGxlZCA+PSB0b3RhbCkge1xuICAgICAgY2IoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgaG9va3NbY2FsbGVkXS5jYWxsKHZtLCBuZXh0KTtcbiAgICB9XG4gIH1cbn1cblxudmFyIHByb3BCaW5kaW5nTW9kZXMgPSBjb25maWcuX3Byb3BCaW5kaW5nTW9kZXM7XG52YXIgZW1wdHkgPSB7fTtcblxuLy8gcmVnZXhlc1xudmFyIGlkZW50UkUkMSA9IC9eWyRfYS16QS1aXStbXFx3JF0qJC87XG52YXIgc2V0dGFibGVQYXRoUkUgPSAvXltBLVphLXpfJF1bXFx3JF0qKFxcLltBLVphLXpfJF1bXFx3JF0qfFxcW1teXFxbXFxdXStcXF0pKiQvO1xuXG4vKipcbiAqIENvbXBpbGUgcHJvcHMgb24gYSByb290IGVsZW1lbnQgYW5kIHJldHVyblxuICogYSBwcm9wcyBsaW5rIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fSBlbFxuICogQHBhcmFtIHtBcnJheX0gcHJvcE9wdGlvbnNcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHJldHVybiB7RnVuY3Rpb259IHByb3BzTGlua0ZuXG4gKi9cblxuZnVuY3Rpb24gY29tcGlsZVByb3BzKGVsLCBwcm9wT3B0aW9ucywgdm0pIHtcbiAgdmFyIHByb3BzID0gW107XG4gIHZhciBuYW1lcyA9IE9iamVjdC5rZXlzKHByb3BPcHRpb25zKTtcbiAgdmFyIGkgPSBuYW1lcy5sZW5ndGg7XG4gIHZhciBvcHRpb25zLCBuYW1lLCBhdHRyLCB2YWx1ZSwgcGF0aCwgcGFyc2VkLCBwcm9wO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgbmFtZSA9IG5hbWVzW2ldO1xuICAgIG9wdGlvbnMgPSBwcm9wT3B0aW9uc1tuYW1lXSB8fCBlbXB0eTtcblxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIG5hbWUgPT09ICckZGF0YScpIHtcbiAgICAgIHdhcm4oJ0RvIG5vdCB1c2UgJGRhdGEgYXMgcHJvcC4nLCB2bSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICAvLyBwcm9wcyBjb3VsZCBjb250YWluIGRhc2hlcywgd2hpY2ggd2lsbCBiZVxuICAgIC8vIGludGVycHJldGVkIGFzIG1pbnVzIGNhbGN1bGF0aW9ucyBieSB0aGUgcGFyc2VyXG4gICAgLy8gc28gd2UgbmVlZCB0byBjYW1lbGl6ZSB0aGUgcGF0aCBoZXJlXG4gICAgcGF0aCA9IGNhbWVsaXplKG5hbWUpO1xuICAgIGlmICghaWRlbnRSRSQxLnRlc3QocGF0aCkpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignSW52YWxpZCBwcm9wIGtleTogXCInICsgbmFtZSArICdcIi4gUHJvcCBrZXlzICcgKyAnbXVzdCBiZSB2YWxpZCBpZGVudGlmaWVycy4nLCB2bSk7XG4gICAgICBjb250aW51ZTtcbiAgICB9XG5cbiAgICBwcm9wID0ge1xuICAgICAgbmFtZTogbmFtZSxcbiAgICAgIHBhdGg6IHBhdGgsXG4gICAgICBvcHRpb25zOiBvcHRpb25zLFxuICAgICAgbW9kZTogcHJvcEJpbmRpbmdNb2Rlcy5PTkVfV0FZLFxuICAgICAgcmF3OiBudWxsXG4gICAgfTtcblxuICAgIGF0dHIgPSBoeXBoZW5hdGUobmFtZSk7XG4gICAgLy8gZmlyc3QgY2hlY2sgZHluYW1pYyB2ZXJzaW9uXG4gICAgaWYgKCh2YWx1ZSA9IGdldEJpbmRBdHRyKGVsLCBhdHRyKSkgPT09IG51bGwpIHtcbiAgICAgIGlmICgodmFsdWUgPSBnZXRCaW5kQXR0cihlbCwgYXR0ciArICcuc3luYycpKSAhPT0gbnVsbCkge1xuICAgICAgICBwcm9wLm1vZGUgPSBwcm9wQmluZGluZ01vZGVzLlRXT19XQVk7XG4gICAgICB9IGVsc2UgaWYgKCh2YWx1ZSA9IGdldEJpbmRBdHRyKGVsLCBhdHRyICsgJy5vbmNlJykpICE9PSBudWxsKSB7XG4gICAgICAgIHByb3AubW9kZSA9IHByb3BCaW5kaW5nTW9kZXMuT05FX1RJTUU7XG4gICAgICB9XG4gICAgfVxuICAgIGlmICh2YWx1ZSAhPT0gbnVsbCkge1xuICAgICAgLy8gaGFzIGR5bmFtaWMgYmluZGluZyFcbiAgICAgIHByb3AucmF3ID0gdmFsdWU7XG4gICAgICBwYXJzZWQgPSBwYXJzZURpcmVjdGl2ZSh2YWx1ZSk7XG4gICAgICB2YWx1ZSA9IHBhcnNlZC5leHByZXNzaW9uO1xuICAgICAgcHJvcC5maWx0ZXJzID0gcGFyc2VkLmZpbHRlcnM7XG4gICAgICAvLyBjaGVjayBiaW5kaW5nIHR5cGVcbiAgICAgIGlmIChpc0xpdGVyYWwodmFsdWUpICYmICFwYXJzZWQuZmlsdGVycykge1xuICAgICAgICAvLyBmb3IgZXhwcmVzc2lvbnMgY29udGFpbmluZyBsaXRlcmFsIG51bWJlcnMgYW5kXG4gICAgICAgIC8vIGJvb2xlYW5zLCB0aGVyZSdzIG5vIG5lZWQgdG8gc2V0dXAgYSBwcm9wIGJpbmRpbmcsXG4gICAgICAgIC8vIHNvIHdlIGNhbiBvcHRpbWl6ZSB0aGVtIGFzIGEgb25lLXRpbWUgc2V0LlxuICAgICAgICBwcm9wLm9wdGltaXplZExpdGVyYWwgPSB0cnVlO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJvcC5keW5hbWljID0gdHJ1ZTtcbiAgICAgICAgLy8gY2hlY2sgbm9uLXNldHRhYmxlIHBhdGggZm9yIHR3by13YXkgYmluZGluZ3NcbiAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgcHJvcC5tb2RlID09PSBwcm9wQmluZGluZ01vZGVzLlRXT19XQVkgJiYgIXNldHRhYmxlUGF0aFJFLnRlc3QodmFsdWUpKSB7XG4gICAgICAgICAgcHJvcC5tb2RlID0gcHJvcEJpbmRpbmdNb2Rlcy5PTkVfV0FZO1xuICAgICAgICAgIHdhcm4oJ0Nhbm5vdCBiaW5kIHR3by13YXkgcHJvcCB3aXRoIG5vbi1zZXR0YWJsZSAnICsgJ3BhcmVudCBwYXRoOiAnICsgdmFsdWUsIHZtKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgcHJvcC5wYXJlbnRQYXRoID0gdmFsdWU7XG5cbiAgICAgIC8vIHdhcm4gcmVxdWlyZWQgdHdvLXdheVxuICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgb3B0aW9ucy50d29XYXkgJiYgcHJvcC5tb2RlICE9PSBwcm9wQmluZGluZ01vZGVzLlRXT19XQVkpIHtcbiAgICAgICAgd2FybignUHJvcCBcIicgKyBuYW1lICsgJ1wiIGV4cGVjdHMgYSB0d28td2F5IGJpbmRpbmcgdHlwZS4nLCB2bSk7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICgodmFsdWUgPSBnZXRBdHRyKGVsLCBhdHRyKSkgIT09IG51bGwpIHtcbiAgICAgIC8vIGhhcyBsaXRlcmFsIGJpbmRpbmchXG4gICAgICBwcm9wLnJhdyA9IHZhbHVlO1xuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgLy8gY2hlY2sgcG9zc2libGUgY2FtZWxDYXNlIHByb3AgdXNhZ2VcbiAgICAgIHZhciBsb3dlckNhc2VOYW1lID0gcGF0aC50b0xvd2VyQ2FzZSgpO1xuICAgICAgdmFsdWUgPSAvW0EtWlxcLV0vLnRlc3QobmFtZSkgJiYgKGVsLmdldEF0dHJpYnV0ZShsb3dlckNhc2VOYW1lKSB8fCBlbC5nZXRBdHRyaWJ1dGUoJzonICsgbG93ZXJDYXNlTmFtZSkgfHwgZWwuZ2V0QXR0cmlidXRlKCd2LWJpbmQ6JyArIGxvd2VyQ2FzZU5hbWUpIHx8IGVsLmdldEF0dHJpYnV0ZSgnOicgKyBsb3dlckNhc2VOYW1lICsgJy5vbmNlJykgfHwgZWwuZ2V0QXR0cmlidXRlKCd2LWJpbmQ6JyArIGxvd2VyQ2FzZU5hbWUgKyAnLm9uY2UnKSB8fCBlbC5nZXRBdHRyaWJ1dGUoJzonICsgbG93ZXJDYXNlTmFtZSArICcuc3luYycpIHx8IGVsLmdldEF0dHJpYnV0ZSgndi1iaW5kOicgKyBsb3dlckNhc2VOYW1lICsgJy5zeW5jJykpO1xuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIHdhcm4oJ1Bvc3NpYmxlIHVzYWdlIGVycm9yIGZvciBwcm9wIGAnICsgbG93ZXJDYXNlTmFtZSArICdgIC0gJyArICdkaWQgeW91IG1lYW4gYCcgKyBhdHRyICsgJ2A/IEhUTUwgaXMgY2FzZS1pbnNlbnNpdGl2ZSwgcmVtZW1iZXIgdG8gdXNlICcgKyAna2ViYWItY2FzZSBmb3IgcHJvcHMgaW4gdGVtcGxhdGVzLicsIHZtKTtcbiAgICAgIH0gZWxzZSBpZiAob3B0aW9ucy5yZXF1aXJlZCkge1xuICAgICAgICAvLyB3YXJuIG1pc3NpbmcgcmVxdWlyZWRcbiAgICAgICAgd2FybignTWlzc2luZyByZXF1aXJlZCBwcm9wOiAnICsgbmFtZSwgdm0pO1xuICAgICAgfVxuICAgIH1cbiAgICAvLyBwdXNoIHByb3BcbiAgICBwcm9wcy5wdXNoKHByb3ApO1xuICB9XG4gIHJldHVybiBtYWtlUHJvcHNMaW5rRm4ocHJvcHMpO1xufVxuXG4vKipcbiAqIEJ1aWxkIGEgZnVuY3Rpb24gdGhhdCBhcHBsaWVzIHByb3BzIHRvIGEgdm0uXG4gKlxuICogQHBhcmFtIHtBcnJheX0gcHJvcHNcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufSBwcm9wc0xpbmtGblxuICovXG5cbmZ1bmN0aW9uIG1ha2VQcm9wc0xpbmtGbihwcm9wcykge1xuICByZXR1cm4gZnVuY3Rpb24gcHJvcHNMaW5rRm4odm0sIHNjb3BlKSB7XG4gICAgLy8gc3RvcmUgcmVzb2x2ZWQgcHJvcHMgaW5mb1xuICAgIHZtLl9wcm9wcyA9IHt9O1xuICAgIHZhciBpbmxpbmVQcm9wcyA9IHZtLiRvcHRpb25zLnByb3BzRGF0YTtcbiAgICB2YXIgaSA9IHByb3BzLmxlbmd0aDtcbiAgICB2YXIgcHJvcCwgcGF0aCwgb3B0aW9ucywgdmFsdWUsIHJhdztcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBwcm9wID0gcHJvcHNbaV07XG4gICAgICByYXcgPSBwcm9wLnJhdztcbiAgICAgIHBhdGggPSBwcm9wLnBhdGg7XG4gICAgICBvcHRpb25zID0gcHJvcC5vcHRpb25zO1xuICAgICAgdm0uX3Byb3BzW3BhdGhdID0gcHJvcDtcbiAgICAgIGlmIChpbmxpbmVQcm9wcyAmJiBoYXNPd24oaW5saW5lUHJvcHMsIHBhdGgpKSB7XG4gICAgICAgIGluaXRQcm9wKHZtLCBwcm9wLCBpbmxpbmVQcm9wc1twYXRoXSk7XG4gICAgICB9aWYgKHJhdyA9PT0gbnVsbCkge1xuICAgICAgICAvLyBpbml0aWFsaXplIGFic2VudCBwcm9wXG4gICAgICAgIGluaXRQcm9wKHZtLCBwcm9wLCB1bmRlZmluZWQpO1xuICAgICAgfSBlbHNlIGlmIChwcm9wLmR5bmFtaWMpIHtcbiAgICAgICAgLy8gZHluYW1pYyBwcm9wXG4gICAgICAgIGlmIChwcm9wLm1vZGUgPT09IHByb3BCaW5kaW5nTW9kZXMuT05FX1RJTUUpIHtcbiAgICAgICAgICAvLyBvbmUgdGltZSBiaW5kaW5nXG4gICAgICAgICAgdmFsdWUgPSAoc2NvcGUgfHwgdm0uX2NvbnRleHQgfHwgdm0pLiRnZXQocHJvcC5wYXJlbnRQYXRoKTtcbiAgICAgICAgICBpbml0UHJvcCh2bSwgcHJvcCwgdmFsdWUpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGlmICh2bS5fY29udGV4dCkge1xuICAgICAgICAgICAgLy8gZHluYW1pYyBiaW5kaW5nXG4gICAgICAgICAgICB2bS5fYmluZERpcih7XG4gICAgICAgICAgICAgIG5hbWU6ICdwcm9wJyxcbiAgICAgICAgICAgICAgZGVmOiBwcm9wRGVmLFxuICAgICAgICAgICAgICBwcm9wOiBwcm9wXG4gICAgICAgICAgICB9LCBudWxsLCBudWxsLCBzY29wZSk7IC8vIGVsLCBob3N0LCBzY29wZVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIHJvb3QgaW5zdGFuY2VcbiAgICAgICAgICAgICAgaW5pdFByb3Aodm0sIHByb3AsIHZtLiRnZXQocHJvcC5wYXJlbnRQYXRoKSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAocHJvcC5vcHRpbWl6ZWRMaXRlcmFsKSB7XG4gICAgICAgIC8vIG9wdGltaXplZCBsaXRlcmFsLCBjYXN0IGl0IGFuZCBqdXN0IHNldCBvbmNlXG4gICAgICAgIHZhciBzdHJpcHBlZCA9IHN0cmlwUXVvdGVzKHJhdyk7XG4gICAgICAgIHZhbHVlID0gc3RyaXBwZWQgPT09IHJhdyA/IHRvQm9vbGVhbih0b051bWJlcihyYXcpKSA6IHN0cmlwcGVkO1xuICAgICAgICBpbml0UHJvcCh2bSwgcHJvcCwgdmFsdWUpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gc3RyaW5nIGxpdGVyYWwsIGJ1dCB3ZSBuZWVkIHRvIGNhdGVyIGZvclxuICAgICAgICAvLyBCb29sZWFuIHByb3BzIHdpdGggbm8gdmFsdWUsIG9yIHdpdGggc2FtZVxuICAgICAgICAvLyBsaXRlcmFsIHZhbHVlIChlLmcuIGRpc2FibGVkPVwiZGlzYWJsZWRcIilcbiAgICAgICAgLy8gc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS92dWVqcy92dWUtbG9hZGVyL2lzc3Vlcy8xODJcbiAgICAgICAgdmFsdWUgPSBvcHRpb25zLnR5cGUgPT09IEJvb2xlYW4gJiYgKHJhdyA9PT0gJycgfHwgcmF3ID09PSBoeXBoZW5hdGUocHJvcC5uYW1lKSkgPyB0cnVlIDogcmF3O1xuICAgICAgICBpbml0UHJvcCh2bSwgcHJvcCwgdmFsdWUpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIGEgcHJvcCB3aXRoIGEgcmF3VmFsdWUsIGFwcGx5aW5nIG5lY2Vzc2FyeSBjb2Vyc2lvbnMsXG4gKiBkZWZhdWx0IHZhbHVlcyAmIGFzc2VydGlvbnMgYW5kIGNhbGwgdGhlIGdpdmVuIGNhbGxiYWNrIHdpdGhcbiAqIHByb2Nlc3NlZCB2YWx1ZS5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wXG4gKiBAcGFyYW0geyp9IHJhd1ZhbHVlXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBmblxuICovXG5cbmZ1bmN0aW9uIHByb2Nlc3NQcm9wVmFsdWUodm0sIHByb3AsIHJhd1ZhbHVlLCBmbikge1xuICB2YXIgaXNTaW1wbGUgPSBwcm9wLmR5bmFtaWMgJiYgaXNTaW1wbGVQYXRoKHByb3AucGFyZW50UGF0aCk7XG4gIHZhciB2YWx1ZSA9IHJhd1ZhbHVlO1xuICBpZiAodmFsdWUgPT09IHVuZGVmaW5lZCkge1xuICAgIHZhbHVlID0gZ2V0UHJvcERlZmF1bHRWYWx1ZSh2bSwgcHJvcCk7XG4gIH1cbiAgdmFsdWUgPSBjb2VyY2VQcm9wKHByb3AsIHZhbHVlKTtcbiAgdmFyIGNvZXJjZWQgPSB2YWx1ZSAhPT0gcmF3VmFsdWU7XG4gIGlmICghYXNzZXJ0UHJvcChwcm9wLCB2YWx1ZSwgdm0pKSB7XG4gICAgdmFsdWUgPSB1bmRlZmluZWQ7XG4gIH1cbiAgaWYgKGlzU2ltcGxlICYmICFjb2VyY2VkKSB7XG4gICAgd2l0aG91dENvbnZlcnNpb24oZnVuY3Rpb24gKCkge1xuICAgICAgZm4odmFsdWUpO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIGZuKHZhbHVlKTtcbiAgfVxufVxuXG4vKipcbiAqIFNldCBhIHByb3AncyBpbml0aWFsIHZhbHVlIG9uIGEgdm0gYW5kIGl0cyBkYXRhIG9iamVjdC5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7T2JqZWN0fSBwcm9wXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKi9cblxuZnVuY3Rpb24gaW5pdFByb3Aodm0sIHByb3AsIHZhbHVlKSB7XG4gIHByb2Nlc3NQcm9wVmFsdWUodm0sIHByb3AsIHZhbHVlLCBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICBkZWZpbmVSZWFjdGl2ZSh2bSwgcHJvcC5wYXRoLCB2YWx1ZSk7XG4gIH0pO1xufVxuXG4vKipcbiAqIFVwZGF0ZSBhIHByb3AncyB2YWx1ZSBvbiBhIHZtLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtPYmplY3R9IHByb3BcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqL1xuXG5mdW5jdGlvbiB1cGRhdGVQcm9wKHZtLCBwcm9wLCB2YWx1ZSkge1xuICBwcm9jZXNzUHJvcFZhbHVlKHZtLCBwcm9wLCB2YWx1ZSwgZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgdm1bcHJvcC5wYXRoXSA9IHZhbHVlO1xuICB9KTtcbn1cblxuLyoqXG4gKiBHZXQgdGhlIGRlZmF1bHQgdmFsdWUgb2YgYSBwcm9wLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtPYmplY3R9IHByb3BcbiAqIEByZXR1cm4geyp9XG4gKi9cblxuZnVuY3Rpb24gZ2V0UHJvcERlZmF1bHRWYWx1ZSh2bSwgcHJvcCkge1xuICAvLyBubyBkZWZhdWx0LCByZXR1cm4gdW5kZWZpbmVkXG4gIHZhciBvcHRpb25zID0gcHJvcC5vcHRpb25zO1xuICBpZiAoIWhhc093bihvcHRpb25zLCAnZGVmYXVsdCcpKSB7XG4gICAgLy8gYWJzZW50IGJvb2xlYW4gdmFsdWUgZGVmYXVsdHMgdG8gZmFsc2VcbiAgICByZXR1cm4gb3B0aW9ucy50eXBlID09PSBCb29sZWFuID8gZmFsc2UgOiB1bmRlZmluZWQ7XG4gIH1cbiAgdmFyIGRlZiA9IG9wdGlvbnNbJ2RlZmF1bHQnXTtcbiAgLy8gd2FybiBhZ2FpbnN0IG5vbi1mYWN0b3J5IGRlZmF1bHRzIGZvciBPYmplY3QgJiBBcnJheVxuICBpZiAoaXNPYmplY3QoZGVmKSkge1xuICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignSW52YWxpZCBkZWZhdWx0IHZhbHVlIGZvciBwcm9wIFwiJyArIHByb3AubmFtZSArICdcIjogJyArICdQcm9wcyB3aXRoIHR5cGUgT2JqZWN0L0FycmF5IG11c3QgdXNlIGEgZmFjdG9yeSBmdW5jdGlvbiAnICsgJ3RvIHJldHVybiB0aGUgZGVmYXVsdCB2YWx1ZS4nLCB2bSk7XG4gIH1cbiAgLy8gY2FsbCBmYWN0b3J5IGZ1bmN0aW9uIGZvciBub24tRnVuY3Rpb24gdHlwZXNcbiAgcmV0dXJuIHR5cGVvZiBkZWYgPT09ICdmdW5jdGlvbicgJiYgb3B0aW9ucy50eXBlICE9PSBGdW5jdGlvbiA/IGRlZi5jYWxsKHZtKSA6IGRlZjtcbn1cblxuLyoqXG4gKiBBc3NlcnQgd2hldGhlciBhIHByb3AgaXMgdmFsaWQuXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IHByb3BcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICovXG5cbmZ1bmN0aW9uIGFzc2VydFByb3AocHJvcCwgdmFsdWUsIHZtKSB7XG4gIGlmICghcHJvcC5vcHRpb25zLnJlcXVpcmVkICYmICggLy8gbm9uLXJlcXVpcmVkXG4gIHByb3AucmF3ID09PSBudWxsIHx8IC8vIGFic2NlbnRcbiAgdmFsdWUgPT0gbnVsbCkgLy8gbnVsbCBvciB1bmRlZmluZWRcbiAgKSB7XG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICB9XG4gIHZhciBvcHRpb25zID0gcHJvcC5vcHRpb25zO1xuICB2YXIgdHlwZSA9IG9wdGlvbnMudHlwZTtcbiAgdmFyIHZhbGlkID0gIXR5cGU7XG4gIHZhciBleHBlY3RlZFR5cGVzID0gW107XG4gIGlmICh0eXBlKSB7XG4gICAgaWYgKCFpc0FycmF5KHR5cGUpKSB7XG4gICAgICB0eXBlID0gW3R5cGVdO1xuICAgIH1cbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IHR5cGUubGVuZ3RoICYmICF2YWxpZDsgaSsrKSB7XG4gICAgICB2YXIgYXNzZXJ0ZWRUeXBlID0gYXNzZXJ0VHlwZSh2YWx1ZSwgdHlwZVtpXSk7XG4gICAgICBleHBlY3RlZFR5cGVzLnB1c2goYXNzZXJ0ZWRUeXBlLmV4cGVjdGVkVHlwZSk7XG4gICAgICB2YWxpZCA9IGFzc2VydGVkVHlwZS52YWxpZDtcbiAgICB9XG4gIH1cbiAgaWYgKCF2YWxpZCkge1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICB3YXJuKCdJbnZhbGlkIHByb3A6IHR5cGUgY2hlY2sgZmFpbGVkIGZvciBwcm9wIFwiJyArIHByb3AubmFtZSArICdcIi4nICsgJyBFeHBlY3RlZCAnICsgZXhwZWN0ZWRUeXBlcy5tYXAoZm9ybWF0VHlwZSkuam9pbignLCAnKSArICcsIGdvdCAnICsgZm9ybWF0VmFsdWUodmFsdWUpICsgJy4nLCB2bSk7XG4gICAgfVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuICB2YXIgdmFsaWRhdG9yID0gb3B0aW9ucy52YWxpZGF0b3I7XG4gIGlmICh2YWxpZGF0b3IpIHtcbiAgICBpZiAoIXZhbGlkYXRvcih2YWx1ZSkpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignSW52YWxpZCBwcm9wOiBjdXN0b20gdmFsaWRhdG9yIGNoZWNrIGZhaWxlZCBmb3IgcHJvcCBcIicgKyBwcm9wLm5hbWUgKyAnXCIuJywgdm0pO1xuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cbiAgfVxuICByZXR1cm4gdHJ1ZTtcbn1cblxuLyoqXG4gKiBGb3JjZSBwYXJzaW5nIHZhbHVlIHdpdGggY29lcmNlIG9wdGlvbi5cbiAqXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7Kn1cbiAqL1xuXG5mdW5jdGlvbiBjb2VyY2VQcm9wKHByb3AsIHZhbHVlKSB7XG4gIHZhciBjb2VyY2UgPSBwcm9wLm9wdGlvbnMuY29lcmNlO1xuICBpZiAoIWNvZXJjZSkge1xuICAgIHJldHVybiB2YWx1ZTtcbiAgfVxuICAvLyBjb2VyY2UgaXMgYSBmdW5jdGlvblxuICByZXR1cm4gY29lcmNlKHZhbHVlKTtcbn1cblxuLyoqXG4gKiBBc3NlcnQgdGhlIHR5cGUgb2YgYSB2YWx1ZVxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEBwYXJhbSB7RnVuY3Rpb259IHR5cGVcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuXG5mdW5jdGlvbiBhc3NlcnRUeXBlKHZhbHVlLCB0eXBlKSB7XG4gIHZhciB2YWxpZDtcbiAgdmFyIGV4cGVjdGVkVHlwZTtcbiAgaWYgKHR5cGUgPT09IFN0cmluZykge1xuICAgIGV4cGVjdGVkVHlwZSA9ICdzdHJpbmcnO1xuICAgIHZhbGlkID0gdHlwZW9mIHZhbHVlID09PSBleHBlY3RlZFR5cGU7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gTnVtYmVyKSB7XG4gICAgZXhwZWN0ZWRUeXBlID0gJ251bWJlcic7XG4gICAgdmFsaWQgPSB0eXBlb2YgdmFsdWUgPT09IGV4cGVjdGVkVHlwZTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSBCb29sZWFuKSB7XG4gICAgZXhwZWN0ZWRUeXBlID0gJ2Jvb2xlYW4nO1xuICAgIHZhbGlkID0gdHlwZW9mIHZhbHVlID09PSBleHBlY3RlZFR5cGU7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gRnVuY3Rpb24pIHtcbiAgICBleHBlY3RlZFR5cGUgPSAnZnVuY3Rpb24nO1xuICAgIHZhbGlkID0gdHlwZW9mIHZhbHVlID09PSBleHBlY3RlZFR5cGU7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gT2JqZWN0KSB7XG4gICAgZXhwZWN0ZWRUeXBlID0gJ29iamVjdCc7XG4gICAgdmFsaWQgPSBpc1BsYWluT2JqZWN0KHZhbHVlKTtcbiAgfSBlbHNlIGlmICh0eXBlID09PSBBcnJheSkge1xuICAgIGV4cGVjdGVkVHlwZSA9ICdhcnJheSc7XG4gICAgdmFsaWQgPSBpc0FycmF5KHZhbHVlKTtcbiAgfSBlbHNlIHtcbiAgICB2YWxpZCA9IHZhbHVlIGluc3RhbmNlb2YgdHlwZTtcbiAgfVxuICByZXR1cm4ge1xuICAgIHZhbGlkOiB2YWxpZCxcbiAgICBleHBlY3RlZFR5cGU6IGV4cGVjdGVkVHlwZVxuICB9O1xufVxuXG4vKipcbiAqIEZvcm1hdCB0eXBlIGZvciBvdXRwdXRcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gdHlwZVxuICogQHJldHVybiB7U3RyaW5nfVxuICovXG5cbmZ1bmN0aW9uIGZvcm1hdFR5cGUodHlwZSkge1xuICByZXR1cm4gdHlwZSA/IHR5cGUuY2hhckF0KDApLnRvVXBwZXJDYXNlKCkgKyB0eXBlLnNsaWNlKDEpIDogJ2N1c3RvbSB0eXBlJztcbn1cblxuLyoqXG4gKiBGb3JtYXQgdmFsdWVcbiAqXG4gKiBAcGFyYW0geyp9IHZhbHVlXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cblxuZnVuY3Rpb24gZm9ybWF0VmFsdWUodmFsKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsKS5zbGljZSg4LCAtMSk7XG59XG5cbnZhciBiaW5kaW5nTW9kZXMgPSBjb25maWcuX3Byb3BCaW5kaW5nTW9kZXM7XG5cbnZhciBwcm9wRGVmID0ge1xuXG4gIGJpbmQ6IGZ1bmN0aW9uIGJpbmQoKSB7XG4gICAgdmFyIGNoaWxkID0gdGhpcy52bTtcbiAgICB2YXIgcGFyZW50ID0gY2hpbGQuX2NvbnRleHQ7XG4gICAgLy8gcGFzc2VkIGluIGZyb20gY29tcGlsZXIgZGlyZWN0bHlcbiAgICB2YXIgcHJvcCA9IHRoaXMuZGVzY3JpcHRvci5wcm9wO1xuICAgIHZhciBjaGlsZEtleSA9IHByb3AucGF0aDtcbiAgICB2YXIgcGFyZW50S2V5ID0gcHJvcC5wYXJlbnRQYXRoO1xuICAgIHZhciB0d29XYXkgPSBwcm9wLm1vZGUgPT09IGJpbmRpbmdNb2Rlcy5UV09fV0FZO1xuXG4gICAgdmFyIHBhcmVudFdhdGNoZXIgPSB0aGlzLnBhcmVudFdhdGNoZXIgPSBuZXcgV2F0Y2hlcihwYXJlbnQsIHBhcmVudEtleSwgZnVuY3Rpb24gKHZhbCkge1xuICAgICAgdXBkYXRlUHJvcChjaGlsZCwgcHJvcCwgdmFsKTtcbiAgICB9LCB7XG4gICAgICB0d29XYXk6IHR3b1dheSxcbiAgICAgIGZpbHRlcnM6IHByb3AuZmlsdGVycyxcbiAgICAgIC8vIGltcG9ydGFudDogcHJvcHMgbmVlZCB0byBiZSBvYnNlcnZlZCBvbiB0aGVcbiAgICAgIC8vIHYtZm9yIHNjb3BlIGlmIHByZXNlbnRcbiAgICAgIHNjb3BlOiB0aGlzLl9zY29wZVxuICAgIH0pO1xuXG4gICAgLy8gc2V0IHRoZSBjaGlsZCBpbml0aWFsIHZhbHVlLlxuICAgIGluaXRQcm9wKGNoaWxkLCBwcm9wLCBwYXJlbnRXYXRjaGVyLnZhbHVlKTtcblxuICAgIC8vIHNldHVwIHR3by13YXkgYmluZGluZ1xuICAgIGlmICh0d29XYXkpIHtcbiAgICAgIC8vIGltcG9ydGFudDogZGVmZXIgdGhlIGNoaWxkIHdhdGNoZXIgY3JlYXRpb24gdW50aWxcbiAgICAgIC8vIHRoZSBjcmVhdGVkIGhvb2sgKGFmdGVyIGRhdGEgb2JzZXJ2YXRpb24pXG4gICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICBjaGlsZC4kb25jZSgncHJlLWhvb2s6Y3JlYXRlZCcsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgc2VsZi5jaGlsZFdhdGNoZXIgPSBuZXcgV2F0Y2hlcihjaGlsZCwgY2hpbGRLZXksIGZ1bmN0aW9uICh2YWwpIHtcbiAgICAgICAgICBwYXJlbnRXYXRjaGVyLnNldCh2YWwpO1xuICAgICAgICB9LCB7XG4gICAgICAgICAgLy8gZW5zdXJlIHN5bmMgdXB3YXJkIGJlZm9yZSBwYXJlbnQgc3luYyBkb3duLlxuICAgICAgICAgIC8vIHRoaXMgaXMgbmVjZXNzYXJ5IGluIGNhc2VzIGUuZy4gdGhlIGNoaWxkXG4gICAgICAgICAgLy8gbXV0YXRlcyBhIHByb3AgYXJyYXksIHRoZW4gcmVwbGFjZXMgaXQuICgjMTY4MylcbiAgICAgICAgICBzeW5jOiB0cnVlXG4gICAgICAgIH0pO1xuICAgICAgfSk7XG4gICAgfVxuICB9LFxuXG4gIHVuYmluZDogZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIHRoaXMucGFyZW50V2F0Y2hlci50ZWFyZG93bigpO1xuICAgIGlmICh0aGlzLmNoaWxkV2F0Y2hlcikge1xuICAgICAgdGhpcy5jaGlsZFdhdGNoZXIudGVhcmRvd24oKTtcbiAgICB9XG4gIH1cbn07XG5cbnZhciBxdWV1ZSQxID0gW107XG52YXIgcXVldWVkID0gZmFsc2U7XG5cbi8qKlxuICogUHVzaCBhIGpvYiBpbnRvIHRoZSBxdWV1ZS5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBqb2JcbiAqL1xuXG5mdW5jdGlvbiBwdXNoSm9iKGpvYikge1xuICBxdWV1ZSQxLnB1c2goam9iKTtcbiAgaWYgKCFxdWV1ZWQpIHtcbiAgICBxdWV1ZWQgPSB0cnVlO1xuICAgIG5leHRUaWNrKGZsdXNoKTtcbiAgfVxufVxuXG4vKipcbiAqIEZsdXNoIHRoZSBxdWV1ZSwgYW5kIGRvIG9uZSBmb3JjZWQgcmVmbG93IGJlZm9yZVxuICogdHJpZ2dlcmluZyB0cmFuc2l0aW9ucy5cbiAqL1xuXG5mdW5jdGlvbiBmbHVzaCgpIHtcbiAgLy8gRm9yY2UgbGF5b3V0XG4gIHZhciBmID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50Lm9mZnNldEhlaWdodDtcbiAgZm9yICh2YXIgaSA9IDA7IGkgPCBxdWV1ZSQxLmxlbmd0aDsgaSsrKSB7XG4gICAgcXVldWUkMVtpXSgpO1xuICB9XG4gIHF1ZXVlJDEgPSBbXTtcbiAgcXVldWVkID0gZmFsc2U7XG4gIC8vIGR1bW15IHJldHVybiwgc28ganMgbGludGVycyBkb24ndCBjb21wbGFpbiBhYm91dFxuICAvLyB1bnVzZWQgdmFyaWFibGUgZlxuICByZXR1cm4gZjtcbn1cblxudmFyIFRZUEVfVFJBTlNJVElPTiA9ICd0cmFuc2l0aW9uJztcbnZhciBUWVBFX0FOSU1BVElPTiA9ICdhbmltYXRpb24nO1xudmFyIHRyYW5zRHVyYXRpb25Qcm9wID0gdHJhbnNpdGlvblByb3AgKyAnRHVyYXRpb24nO1xudmFyIGFuaW1EdXJhdGlvblByb3AgPSBhbmltYXRpb25Qcm9wICsgJ0R1cmF0aW9uJztcblxuLyoqXG4gKiBJZiBhIGp1c3QtZW50ZXJlZCBlbGVtZW50IGlzIGFwcGxpZWQgdGhlXG4gKiBsZWF2ZSBjbGFzcyB3aGlsZSBpdHMgZW50ZXIgdHJhbnNpdGlvbiBoYXNuJ3Qgc3RhcnRlZCB5ZXQsXG4gKiBhbmQgdGhlIHRyYW5zaXRpb25lZCBwcm9wZXJ0eSBoYXMgdGhlIHNhbWUgdmFsdWUgZm9yIGJvdGhcbiAqIGVudGVyL2xlYXZlLCB0aGVuIHRoZSBsZWF2ZSB0cmFuc2l0aW9uIHdpbGwgYmUgc2tpcHBlZCBhbmRcbiAqIHRoZSB0cmFuc2l0aW9uZW5kIGV2ZW50IG5ldmVyIGZpcmVzLiBUaGlzIGZ1bmN0aW9uIGVuc3VyZXNcbiAqIGl0cyBjYWxsYmFjayB0byBiZSBjYWxsZWQgYWZ0ZXIgYSB0cmFuc2l0aW9uIGhhcyBzdGFydGVkXG4gKiBieSB3YWl0aW5nIGZvciBkb3VibGUgcmFmLlxuICpcbiAqIEl0IGZhbGxzIGJhY2sgdG8gc2V0VGltZW91dCBvbiBkZXZpY2VzIHRoYXQgc3VwcG9ydCBDU1NcbiAqIHRyYW5zaXRpb25zIGJ1dCBub3QgcmFmIChlLmcuIEFuZHJvaWQgNC4yIGJyb3dzZXIpIC0gc2luY2VcbiAqIHRoZXNlIGVudmlyb25tZW50cyBhcmUgdXN1YWxseSBzbG93LCB3ZSBhcmUgZ2l2aW5nIGl0IGFcbiAqIHJlbGF0aXZlbHkgbGFyZ2UgdGltZW91dC5cbiAqL1xuXG52YXIgcmFmID0gaW5Ccm93c2VyICYmIHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWU7XG52YXIgd2FpdEZvclRyYW5zaXRpb25TdGFydCA9IHJhZlxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbj8gZnVuY3Rpb24gKGZuKSB7XG4gIHJhZihmdW5jdGlvbiAoKSB7XG4gICAgcmFmKGZuKTtcbiAgfSk7XG59IDogZnVuY3Rpb24gKGZuKSB7XG4gIHNldFRpbWVvdXQoZm4sIDUwKTtcbn07XG5cbi8qKlxuICogQSBUcmFuc2l0aW9uIG9iamVjdCB0aGF0IGVuY2Fwc3VsYXRlcyB0aGUgc3RhdGUgYW5kIGxvZ2ljXG4gKiBvZiB0aGUgdHJhbnNpdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge1N0cmluZ30gaWRcbiAqIEBwYXJhbSB7T2JqZWN0fSBob29rc1xuICogQHBhcmFtIHtWdWV9IHZtXG4gKi9cbmZ1bmN0aW9uIFRyYW5zaXRpb24oZWwsIGlkLCBob29rcywgdm0pIHtcbiAgdGhpcy5pZCA9IGlkO1xuICB0aGlzLmVsID0gZWw7XG4gIHRoaXMuZW50ZXJDbGFzcyA9IGhvb2tzICYmIGhvb2tzLmVudGVyQ2xhc3MgfHwgaWQgKyAnLWVudGVyJztcbiAgdGhpcy5sZWF2ZUNsYXNzID0gaG9va3MgJiYgaG9va3MubGVhdmVDbGFzcyB8fCBpZCArICctbGVhdmUnO1xuICB0aGlzLmhvb2tzID0gaG9va3M7XG4gIHRoaXMudm0gPSB2bTtcbiAgLy8gYXN5bmMgc3RhdGVcbiAgdGhpcy5wZW5kaW5nQ3NzRXZlbnQgPSB0aGlzLnBlbmRpbmdDc3NDYiA9IHRoaXMuY2FuY2VsID0gdGhpcy5wZW5kaW5nSnNDYiA9IHRoaXMub3AgPSB0aGlzLmNiID0gbnVsbDtcbiAgdGhpcy5qdXN0RW50ZXJlZCA9IGZhbHNlO1xuICB0aGlzLmVudGVyZWQgPSB0aGlzLmxlZnQgPSBmYWxzZTtcbiAgdGhpcy50eXBlQ2FjaGUgPSB7fTtcbiAgLy8gY2hlY2sgY3NzIHRyYW5zaXRpb24gdHlwZVxuICB0aGlzLnR5cGUgPSBob29rcyAmJiBob29rcy50eXBlO1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICBpZiAodGhpcy50eXBlICYmIHRoaXMudHlwZSAhPT0gVFlQRV9UUkFOU0lUSU9OICYmIHRoaXMudHlwZSAhPT0gVFlQRV9BTklNQVRJT04pIHtcbiAgICAgIHdhcm4oJ2ludmFsaWQgQ1NTIHRyYW5zaXRpb24gdHlwZSBmb3IgdHJhbnNpdGlvbj1cIicgKyB0aGlzLmlkICsgJ1wiOiAnICsgdGhpcy50eXBlLCB2bSk7XG4gICAgfVxuICB9XG4gIC8vIGJpbmRcbiAgdmFyIHNlbGYgPSB0aGlzO1snZW50ZXJOZXh0VGljaycsICdlbnRlckRvbmUnLCAnbGVhdmVOZXh0VGljaycsICdsZWF2ZURvbmUnXS5mb3JFYWNoKGZ1bmN0aW9uIChtKSB7XG4gICAgc2VsZlttXSA9IGJpbmQoc2VsZlttXSwgc2VsZik7XG4gIH0pO1xufVxuXG52YXIgcCQxID0gVHJhbnNpdGlvbi5wcm90b3R5cGU7XG5cbi8qKlxuICogU3RhcnQgYW4gZW50ZXJpbmcgdHJhbnNpdGlvbi5cbiAqXG4gKiAxLiBlbnRlciB0cmFuc2l0aW9uIHRyaWdnZXJlZFxuICogMi4gY2FsbCBiZWZvcmVFbnRlciBob29rXG4gKiAzLiBhZGQgZW50ZXIgY2xhc3NcbiAqIDQuIGluc2VydC9zaG93IGVsZW1lbnRcbiAqIDUuIGNhbGwgZW50ZXIgaG9vayAod2l0aCBwb3NzaWJsZSBleHBsaWNpdCBqcyBjYWxsYmFjaylcbiAqIDYuIHJlZmxvd1xuICogNy4gYmFzZWQgb24gdHJhbnNpdGlvbiB0eXBlOlxuICogICAgLSB0cmFuc2l0aW9uOlxuICogICAgICAgIHJlbW92ZSBjbGFzcyBub3csIHdhaXQgZm9yIHRyYW5zaXRpb25lbmQsXG4gKiAgICAgICAgdGhlbiBkb25lIGlmIHRoZXJlJ3Mgbm8gZXhwbGljaXQganMgY2FsbGJhY2suXG4gKiAgICAtIGFuaW1hdGlvbjpcbiAqICAgICAgICB3YWl0IGZvciBhbmltYXRpb25lbmQsIHJlbW92ZSBjbGFzcyxcbiAqICAgICAgICB0aGVuIGRvbmUgaWYgdGhlcmUncyBubyBleHBsaWNpdCBqcyBjYWxsYmFjay5cbiAqICAgIC0gbm8gY3NzIHRyYW5zaXRpb246XG4gKiAgICAgICAgZG9uZSBub3cgaWYgdGhlcmUncyBubyBleHBsaWNpdCBqcyBjYWxsYmFjay5cbiAqIDguIHdhaXQgZm9yIGVpdGhlciBkb25lIG9yIGpzIGNhbGxiYWNrLCB0aGVuIGNhbGxcbiAqICAgIGFmdGVyRW50ZXIgaG9vay5cbiAqXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBvcCAtIGluc2VydC9zaG93IHRoZSBlbGVtZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gKi9cblxucCQxLmVudGVyID0gZnVuY3Rpb24gKG9wLCBjYikge1xuICB0aGlzLmNhbmNlbFBlbmRpbmcoKTtcbiAgdGhpcy5jYWxsSG9vaygnYmVmb3JlRW50ZXInKTtcbiAgdGhpcy5jYiA9IGNiO1xuICBhZGRDbGFzcyh0aGlzLmVsLCB0aGlzLmVudGVyQ2xhc3MpO1xuICBvcCgpO1xuICB0aGlzLmVudGVyZWQgPSBmYWxzZTtcbiAgdGhpcy5jYWxsSG9va1dpdGhDYignZW50ZXInKTtcbiAgaWYgKHRoaXMuZW50ZXJlZCkge1xuICAgIHJldHVybjsgLy8gdXNlciBjYWxsZWQgZG9uZSBzeW5jaHJvbm91c2x5LlxuICB9XG4gIHRoaXMuY2FuY2VsID0gdGhpcy5ob29rcyAmJiB0aGlzLmhvb2tzLmVudGVyQ2FuY2VsbGVkO1xuICBwdXNoSm9iKHRoaXMuZW50ZXJOZXh0VGljayk7XG59O1xuXG4vKipcbiAqIFRoZSBcIm5leHRUaWNrXCIgcGhhc2Ugb2YgYW4gZW50ZXJpbmcgdHJhbnNpdGlvbiwgd2hpY2ggaXNcbiAqIHRvIGJlIHB1c2hlZCBpbnRvIGEgcXVldWUgYW5kIGV4ZWN1dGVkIGFmdGVyIGEgcmVmbG93IHNvXG4gKiB0aGF0IHJlbW92aW5nIHRoZSBjbGFzcyBjYW4gdHJpZ2dlciBhIENTUyB0cmFuc2l0aW9uLlxuICovXG5cbnAkMS5lbnRlck5leHRUaWNrID0gZnVuY3Rpb24gKCkge1xuICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gIC8vIHByZXZlbnQgdHJhbnNpdGlvbiBza2lwcGluZ1xuICB0aGlzLmp1c3RFbnRlcmVkID0gdHJ1ZTtcbiAgd2FpdEZvclRyYW5zaXRpb25TdGFydChmdW5jdGlvbiAoKSB7XG4gICAgX3RoaXMuanVzdEVudGVyZWQgPSBmYWxzZTtcbiAgfSk7XG4gIHZhciBlbnRlckRvbmUgPSB0aGlzLmVudGVyRG9uZTtcbiAgdmFyIHR5cGUgPSB0aGlzLmdldENzc1RyYW5zaXRpb25UeXBlKHRoaXMuZW50ZXJDbGFzcyk7XG4gIGlmICghdGhpcy5wZW5kaW5nSnNDYikge1xuICAgIGlmICh0eXBlID09PSBUWVBFX1RSQU5TSVRJT04pIHtcbiAgICAgIC8vIHRyaWdnZXIgdHJhbnNpdGlvbiBieSByZW1vdmluZyBlbnRlciBjbGFzcyBub3dcbiAgICAgIHJlbW92ZUNsYXNzKHRoaXMuZWwsIHRoaXMuZW50ZXJDbGFzcyk7XG4gICAgICB0aGlzLnNldHVwQ3NzQ2IodHJhbnNpdGlvbkVuZEV2ZW50LCBlbnRlckRvbmUpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gVFlQRV9BTklNQVRJT04pIHtcbiAgICAgIHRoaXMuc2V0dXBDc3NDYihhbmltYXRpb25FbmRFdmVudCwgZW50ZXJEb25lKTtcbiAgICB9IGVsc2Uge1xuICAgICAgZW50ZXJEb25lKCk7XG4gICAgfVxuICB9IGVsc2UgaWYgKHR5cGUgPT09IFRZUEVfVFJBTlNJVElPTikge1xuICAgIHJlbW92ZUNsYXNzKHRoaXMuZWwsIHRoaXMuZW50ZXJDbGFzcyk7XG4gIH1cbn07XG5cbi8qKlxuICogVGhlIFwiY2xlYW51cFwiIHBoYXNlIG9mIGFuIGVudGVyaW5nIHRyYW5zaXRpb24uXG4gKi9cblxucCQxLmVudGVyRG9uZSA9IGZ1bmN0aW9uICgpIHtcbiAgdGhpcy5lbnRlcmVkID0gdHJ1ZTtcbiAgdGhpcy5jYW5jZWwgPSB0aGlzLnBlbmRpbmdKc0NiID0gbnVsbDtcbiAgcmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5lbnRlckNsYXNzKTtcbiAgdGhpcy5jYWxsSG9vaygnYWZ0ZXJFbnRlcicpO1xuICBpZiAodGhpcy5jYikgdGhpcy5jYigpO1xufTtcblxuLyoqXG4gKiBTdGFydCBhIGxlYXZpbmcgdHJhbnNpdGlvbi5cbiAqXG4gKiAxLiBsZWF2ZSB0cmFuc2l0aW9uIHRyaWdnZXJlZC5cbiAqIDIuIGNhbGwgYmVmb3JlTGVhdmUgaG9va1xuICogMy4gYWRkIGxlYXZlIGNsYXNzICh0cmlnZ2VyIGNzcyB0cmFuc2l0aW9uKVxuICogNC4gY2FsbCBsZWF2ZSBob29rICh3aXRoIHBvc3NpYmxlIGV4cGxpY2l0IGpzIGNhbGxiYWNrKVxuICogNS4gcmVmbG93IGlmIG5vIGV4cGxpY2l0IGpzIGNhbGxiYWNrIGlzIHByb3ZpZGVkXG4gKiA2LiBiYXNlZCBvbiB0cmFuc2l0aW9uIHR5cGU6XG4gKiAgICAtIHRyYW5zaXRpb24gb3IgYW5pbWF0aW9uOlxuICogICAgICAgIHdhaXQgZm9yIGVuZCBldmVudCwgcmVtb3ZlIGNsYXNzLCB0aGVuIGRvbmUgaWZcbiAqICAgICAgICB0aGVyZSdzIG5vIGV4cGxpY2l0IGpzIGNhbGxiYWNrLlxuICogICAgLSBubyBjc3MgdHJhbnNpdGlvbjpcbiAqICAgICAgICBkb25lIGlmIHRoZXJlJ3Mgbm8gZXhwbGljaXQganMgY2FsbGJhY2suXG4gKiA3LiB3YWl0IGZvciBlaXRoZXIgZG9uZSBvciBqcyBjYWxsYmFjaywgdGhlbiBjYWxsXG4gKiAgICBhZnRlckxlYXZlIGhvb2suXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gb3AgLSByZW1vdmUvaGlkZSB0aGUgZWxlbWVudFxuICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICovXG5cbnAkMS5sZWF2ZSA9IGZ1bmN0aW9uIChvcCwgY2IpIHtcbiAgdGhpcy5jYW5jZWxQZW5kaW5nKCk7XG4gIHRoaXMuY2FsbEhvb2soJ2JlZm9yZUxlYXZlJyk7XG4gIHRoaXMub3AgPSBvcDtcbiAgdGhpcy5jYiA9IGNiO1xuICBhZGRDbGFzcyh0aGlzLmVsLCB0aGlzLmxlYXZlQ2xhc3MpO1xuICB0aGlzLmxlZnQgPSBmYWxzZTtcbiAgdGhpcy5jYWxsSG9va1dpdGhDYignbGVhdmUnKTtcbiAgaWYgKHRoaXMubGVmdCkge1xuICAgIHJldHVybjsgLy8gdXNlciBjYWxsZWQgZG9uZSBzeW5jaHJvbm91c2x5LlxuICB9XG4gIHRoaXMuY2FuY2VsID0gdGhpcy5ob29rcyAmJiB0aGlzLmhvb2tzLmxlYXZlQ2FuY2VsbGVkO1xuICAvLyBvbmx5IG5lZWQgdG8gaGFuZGxlIGxlYXZlRG9uZSBpZlxuICAvLyAxLiB0aGUgdHJhbnNpdGlvbiBpcyBhbHJlYWR5IGRvbmUgKHN5bmNocm9ub3VzbHkgY2FsbGVkXG4gIC8vICAgIGJ5IHRoZSB1c2VyLCB3aGljaCBjYXVzZXMgdGhpcy5vcCBzZXQgdG8gbnVsbClcbiAgLy8gMi4gdGhlcmUncyBubyBleHBsaWNpdCBqcyBjYWxsYmFja1xuICBpZiAodGhpcy5vcCAmJiAhdGhpcy5wZW5kaW5nSnNDYikge1xuICAgIC8vIGlmIGEgQ1NTIHRyYW5zaXRpb24gbGVhdmVzIGltbWVkaWF0ZWx5IGFmdGVyIGVudGVyLFxuICAgIC8vIHRoZSB0cmFuc2l0aW9uZW5kIGV2ZW50IG5ldmVyIGZpcmVzLiB0aGVyZWZvcmUgd2VcbiAgICAvLyBkZXRlY3Qgc3VjaCBjYXNlcyBhbmQgZW5kIHRoZSBsZWF2ZSBpbW1lZGlhdGVseS5cbiAgICBpZiAodGhpcy5qdXN0RW50ZXJlZCkge1xuICAgICAgdGhpcy5sZWF2ZURvbmUoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcHVzaEpvYih0aGlzLmxlYXZlTmV4dFRpY2spO1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiBUaGUgXCJuZXh0VGlja1wiIHBoYXNlIG9mIGEgbGVhdmluZyB0cmFuc2l0aW9uLlxuICovXG5cbnAkMS5sZWF2ZU5leHRUaWNrID0gZnVuY3Rpb24gKCkge1xuICB2YXIgdHlwZSA9IHRoaXMuZ2V0Q3NzVHJhbnNpdGlvblR5cGUodGhpcy5sZWF2ZUNsYXNzKTtcbiAgaWYgKHR5cGUpIHtcbiAgICB2YXIgZXZlbnQgPSB0eXBlID09PSBUWVBFX1RSQU5TSVRJT04gPyB0cmFuc2l0aW9uRW5kRXZlbnQgOiBhbmltYXRpb25FbmRFdmVudDtcbiAgICB0aGlzLnNldHVwQ3NzQ2IoZXZlbnQsIHRoaXMubGVhdmVEb25lKTtcbiAgfSBlbHNlIHtcbiAgICB0aGlzLmxlYXZlRG9uZSgpO1xuICB9XG59O1xuXG4vKipcbiAqIFRoZSBcImNsZWFudXBcIiBwaGFzZSBvZiBhIGxlYXZpbmcgdHJhbnNpdGlvbi5cbiAqL1xuXG5wJDEubGVhdmVEb25lID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLmxlZnQgPSB0cnVlO1xuICB0aGlzLmNhbmNlbCA9IHRoaXMucGVuZGluZ0pzQ2IgPSBudWxsO1xuICB0aGlzLm9wKCk7XG4gIHJlbW92ZUNsYXNzKHRoaXMuZWwsIHRoaXMubGVhdmVDbGFzcyk7XG4gIHRoaXMuY2FsbEhvb2soJ2FmdGVyTGVhdmUnKTtcbiAgaWYgKHRoaXMuY2IpIHRoaXMuY2IoKTtcbiAgdGhpcy5vcCA9IG51bGw7XG59O1xuXG4vKipcbiAqIENhbmNlbCBhbnkgcGVuZGluZyBjYWxsYmFja3MgZnJvbSBhIHByZXZpb3VzbHkgcnVubmluZ1xuICogYnV0IG5vdCBmaW5pc2hlZCB0cmFuc2l0aW9uLlxuICovXG5cbnAkMS5jYW5jZWxQZW5kaW5nID0gZnVuY3Rpb24gKCkge1xuICB0aGlzLm9wID0gdGhpcy5jYiA9IG51bGw7XG4gIHZhciBoYXNQZW5kaW5nID0gZmFsc2U7XG4gIGlmICh0aGlzLnBlbmRpbmdDc3NDYikge1xuICAgIGhhc1BlbmRpbmcgPSB0cnVlO1xuICAgIG9mZih0aGlzLmVsLCB0aGlzLnBlbmRpbmdDc3NFdmVudCwgdGhpcy5wZW5kaW5nQ3NzQ2IpO1xuICAgIHRoaXMucGVuZGluZ0Nzc0V2ZW50ID0gdGhpcy5wZW5kaW5nQ3NzQ2IgPSBudWxsO1xuICB9XG4gIGlmICh0aGlzLnBlbmRpbmdKc0NiKSB7XG4gICAgaGFzUGVuZGluZyA9IHRydWU7XG4gICAgdGhpcy5wZW5kaW5nSnNDYi5jYW5jZWwoKTtcbiAgICB0aGlzLnBlbmRpbmdKc0NiID0gbnVsbDtcbiAgfVxuICBpZiAoaGFzUGVuZGluZykge1xuICAgIHJlbW92ZUNsYXNzKHRoaXMuZWwsIHRoaXMuZW50ZXJDbGFzcyk7XG4gICAgcmVtb3ZlQ2xhc3ModGhpcy5lbCwgdGhpcy5sZWF2ZUNsYXNzKTtcbiAgfVxuICBpZiAodGhpcy5jYW5jZWwpIHtcbiAgICB0aGlzLmNhbmNlbC5jYWxsKHRoaXMudm0sIHRoaXMuZWwpO1xuICAgIHRoaXMuY2FuY2VsID0gbnVsbDtcbiAgfVxufTtcblxuLyoqXG4gKiBDYWxsIGEgdXNlci1wcm92aWRlZCBzeW5jaHJvbm91cyBob29rIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlXG4gKi9cblxucCQxLmNhbGxIb29rID0gZnVuY3Rpb24gKHR5cGUpIHtcbiAgaWYgKHRoaXMuaG9va3MgJiYgdGhpcy5ob29rc1t0eXBlXSkge1xuICAgIHRoaXMuaG9va3NbdHlwZV0uY2FsbCh0aGlzLnZtLCB0aGlzLmVsKTtcbiAgfVxufTtcblxuLyoqXG4gKiBDYWxsIGEgdXNlci1wcm92aWRlZCwgcG90ZW50aWFsbHktYXN5bmMgaG9vayBmdW5jdGlvbi5cbiAqIFdlIGNoZWNrIGZvciB0aGUgbGVuZ3RoIG9mIGFyZ3VtZW50cyB0byBzZWUgaWYgdGhlIGhvb2tcbiAqIGV4cGVjdHMgYSBgZG9uZWAgY2FsbGJhY2suIElmIHRydWUsIHRoZSB0cmFuc2l0aW9uJ3MgZW5kXG4gKiB3aWxsIGJlIGRldGVybWluZWQgYnkgd2hlbiB0aGUgdXNlciBjYWxscyB0aGF0IGNhbGxiYWNrO1xuICogb3RoZXJ3aXNlLCB0aGUgZW5kIGlzIGRldGVybWluZWQgYnkgdGhlIENTUyB0cmFuc2l0aW9uIG9yXG4gKiBhbmltYXRpb24uXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IHR5cGVcbiAqL1xuXG5wJDEuY2FsbEhvb2tXaXRoQ2IgPSBmdW5jdGlvbiAodHlwZSkge1xuICB2YXIgaG9vayA9IHRoaXMuaG9va3MgJiYgdGhpcy5ob29rc1t0eXBlXTtcbiAgaWYgKGhvb2spIHtcbiAgICBpZiAoaG9vay5sZW5ndGggPiAxKSB7XG4gICAgICB0aGlzLnBlbmRpbmdKc0NiID0gY2FuY2VsbGFibGUodGhpc1t0eXBlICsgJ0RvbmUnXSk7XG4gICAgfVxuICAgIGhvb2suY2FsbCh0aGlzLnZtLCB0aGlzLmVsLCB0aGlzLnBlbmRpbmdKc0NiKTtcbiAgfVxufTtcblxuLyoqXG4gKiBHZXQgYW4gZWxlbWVudCdzIHRyYW5zaXRpb24gdHlwZSBiYXNlZCBvbiB0aGVcbiAqIGNhbGN1bGF0ZWQgc3R5bGVzLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBjbGFzc05hbWVcbiAqIEByZXR1cm4ge051bWJlcn1cbiAqL1xuXG5wJDEuZ2V0Q3NzVHJhbnNpdGlvblR5cGUgPSBmdW5jdGlvbiAoY2xhc3NOYW1lKSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAoIXRyYW5zaXRpb25FbmRFdmVudCB8fFxuICAvLyBza2lwIENTUyB0cmFuc2l0aW9ucyBpZiBwYWdlIGlzIG5vdCB2aXNpYmxlIC1cbiAgLy8gdGhpcyBzb2x2ZXMgdGhlIGlzc3VlIG9mIHRyYW5zaXRpb25lbmQgZXZlbnRzIG5vdFxuICAvLyBmaXJpbmcgdW50aWwgdGhlIHBhZ2UgaXMgdmlzaWJsZSBhZ2Fpbi5cbiAgLy8gcGFnZVZpc2liaWxpdHkgQVBJIGlzIHN1cHBvcnRlZCBpbiBJRTEwKywgc2FtZSBhc1xuICAvLyBDU1MgdHJhbnNpdGlvbnMuXG4gIGRvY3VtZW50LmhpZGRlbiB8fFxuICAvLyBleHBsaWNpdCBqcy1vbmx5IHRyYW5zaXRpb25cbiAgdGhpcy5ob29rcyAmJiB0aGlzLmhvb2tzLmNzcyA9PT0gZmFsc2UgfHxcbiAgLy8gZWxlbWVudCBpcyBoaWRkZW5cbiAgaXNIaWRkZW4odGhpcy5lbCkpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIHR5cGUgPSB0aGlzLnR5cGUgfHwgdGhpcy50eXBlQ2FjaGVbY2xhc3NOYW1lXTtcbiAgaWYgKHR5cGUpIHJldHVybiB0eXBlO1xuICB2YXIgaW5saW5lU3R5bGVzID0gdGhpcy5lbC5zdHlsZTtcbiAgdmFyIGNvbXB1dGVkU3R5bGVzID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUodGhpcy5lbCk7XG4gIHZhciB0cmFuc0R1cmF0aW9uID0gaW5saW5lU3R5bGVzW3RyYW5zRHVyYXRpb25Qcm9wXSB8fCBjb21wdXRlZFN0eWxlc1t0cmFuc0R1cmF0aW9uUHJvcF07XG4gIGlmICh0cmFuc0R1cmF0aW9uICYmIHRyYW5zRHVyYXRpb24gIT09ICcwcycpIHtcbiAgICB0eXBlID0gVFlQRV9UUkFOU0lUSU9OO1xuICB9IGVsc2Uge1xuICAgIHZhciBhbmltRHVyYXRpb24gPSBpbmxpbmVTdHlsZXNbYW5pbUR1cmF0aW9uUHJvcF0gfHwgY29tcHV0ZWRTdHlsZXNbYW5pbUR1cmF0aW9uUHJvcF07XG4gICAgaWYgKGFuaW1EdXJhdGlvbiAmJiBhbmltRHVyYXRpb24gIT09ICcwcycpIHtcbiAgICAgIHR5cGUgPSBUWVBFX0FOSU1BVElPTjtcbiAgICB9XG4gIH1cbiAgaWYgKHR5cGUpIHtcbiAgICB0aGlzLnR5cGVDYWNoZVtjbGFzc05hbWVdID0gdHlwZTtcbiAgfVxuICByZXR1cm4gdHlwZTtcbn07XG5cbi8qKlxuICogU2V0dXAgYSBDU1MgdHJhbnNpdGlvbmVuZC9hbmltYXRpb25lbmQgY2FsbGJhY2suXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYlxuICovXG5cbnAkMS5zZXR1cENzc0NiID0gZnVuY3Rpb24gKGV2ZW50LCBjYikge1xuICB0aGlzLnBlbmRpbmdDc3NFdmVudCA9IGV2ZW50O1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHZhciBlbCA9IHRoaXMuZWw7XG4gIHZhciBvbkVuZCA9IHRoaXMucGVuZGluZ0Nzc0NiID0gZnVuY3Rpb24gKGUpIHtcbiAgICBpZiAoZS50YXJnZXQgPT09IGVsKSB7XG4gICAgICBvZmYoZWwsIGV2ZW50LCBvbkVuZCk7XG4gICAgICBzZWxmLnBlbmRpbmdDc3NFdmVudCA9IHNlbGYucGVuZGluZ0Nzc0NiID0gbnVsbDtcbiAgICAgIGlmICghc2VsZi5wZW5kaW5nSnNDYiAmJiBjYikge1xuICAgICAgICBjYigpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbiAgb24oZWwsIGV2ZW50LCBvbkVuZCk7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIGFuIGVsZW1lbnQgaXMgaGlkZGVuIC0gaW4gdGhhdCBjYXNlIHdlIGNhbiBqdXN0XG4gKiBza2lwIHRoZSB0cmFuc2l0aW9uIGFsbHRvZ2V0aGVyLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaXNIaWRkZW4oZWwpIHtcbiAgaWYgKC9zdmckLy50ZXN0KGVsLm5hbWVzcGFjZVVSSSkpIHtcbiAgICAvLyBTVkcgZWxlbWVudHMgZG8gbm90IGhhdmUgb2Zmc2V0KFdpZHRofEhlaWdodClcbiAgICAvLyBzbyB3ZSBuZWVkIHRvIGNoZWNrIHRoZSBjbGllbnQgcmVjdFxuICAgIHZhciByZWN0ID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgcmV0dXJuICEocmVjdC53aWR0aCB8fCByZWN0LmhlaWdodCk7XG4gIH0gZWxzZSB7XG4gICAgcmV0dXJuICEoZWwub2Zmc2V0V2lkdGggfHwgZWwub2Zmc2V0SGVpZ2h0IHx8IGVsLmdldENsaWVudFJlY3RzKCkubGVuZ3RoKTtcbiAgfVxufVxuXG52YXIgdHJhbnNpdGlvbiQxID0ge1xuXG4gIHByaW9yaXR5OiBUUkFOU0lUSU9OLFxuXG4gIHVwZGF0ZTogZnVuY3Rpb24gdXBkYXRlKGlkLCBvbGRJZCkge1xuICAgIHZhciBlbCA9IHRoaXMuZWw7XG4gICAgLy8gcmVzb2x2ZSBvbiBvd25lciB2bVxuICAgIHZhciBob29rcyA9IHJlc29sdmVBc3NldCh0aGlzLnZtLiRvcHRpb25zLCAndHJhbnNpdGlvbnMnLCBpZCk7XG4gICAgaWQgPSBpZCB8fCAndic7XG4gICAgZWwuX192X3RyYW5zID0gbmV3IFRyYW5zaXRpb24oZWwsIGlkLCBob29rcywgdGhpcy52bSk7XG4gICAgaWYgKG9sZElkKSB7XG4gICAgICByZW1vdmVDbGFzcyhlbCwgb2xkSWQgKyAnLXRyYW5zaXRpb24nKTtcbiAgICB9XG4gICAgYWRkQ2xhc3MoZWwsIGlkICsgJy10cmFuc2l0aW9uJyk7XG4gIH1cbn07XG5cbnZhciBpbnRlcm5hbERpcmVjdGl2ZXMgPSB7XG4gIHN0eWxlOiBzdHlsZSxcbiAgJ2NsYXNzJzogdkNsYXNzLFxuICBjb21wb25lbnQ6IGNvbXBvbmVudCxcbiAgcHJvcDogcHJvcERlZixcbiAgdHJhbnNpdGlvbjogdHJhbnNpdGlvbiQxXG59O1xuXG4vLyBzcGVjaWFsIGJpbmRpbmcgcHJlZml4ZXNcbnZhciBiaW5kUkUgPSAvXnYtYmluZDp8XjovO1xudmFyIG9uUkUgPSAvXnYtb246fF5ALztcbnZhciBkaXJBdHRyUkUgPSAvXnYtKFteOl0rKSg/OiR8OiguKikkKS87XG52YXIgbW9kaWZpZXJSRSA9IC9cXC5bXlxcLl0rL2c7XG52YXIgdHJhbnNpdGlvblJFID0gL14odi1iaW5kOnw6KT90cmFuc2l0aW9uJC87XG5cbi8vIGRlZmF1bHQgZGlyZWN0aXZlIHByaW9yaXR5XG52YXIgREVGQVVMVF9QUklPUklUWSA9IDEwMDA7XG52YXIgREVGQVVMVF9URVJNSU5BTF9QUklPUklUWSA9IDIwMDA7XG5cbi8qKlxuICogQ29tcGlsZSBhIHRlbXBsYXRlIGFuZCByZXR1cm4gYSByZXVzYWJsZSBjb21wb3NpdGUgbGlua1xuICogZnVuY3Rpb24sIHdoaWNoIHJlY3Vyc2l2ZWx5IGNvbnRhaW5zIG1vcmUgbGluayBmdW5jdGlvbnNcbiAqIGluc2lkZS4gVGhpcyB0b3AgbGV2ZWwgY29tcGlsZSBmdW5jdGlvbiB3b3VsZCBub3JtYWxseVxuICogYmUgY2FsbGVkIG9uIGluc3RhbmNlIHJvb3Qgbm9kZXMsIGJ1dCBjYW4gYWxzbyBiZSB1c2VkXG4gKiBmb3IgcGFydGlhbCBjb21waWxhdGlvbiBpZiB0aGUgcGFydGlhbCBhcmd1bWVudCBpcyB0cnVlLlxuICpcbiAqIFRoZSByZXR1cm5lZCBjb21wb3NpdGUgbGluayBmdW5jdGlvbiwgd2hlbiBjYWxsZWQsIHdpbGxcbiAqIHJldHVybiBhbiB1bmxpbmsgZnVuY3Rpb24gdGhhdCB0ZWFyc2Rvd24gYWxsIGRpcmVjdGl2ZXNcbiAqIGNyZWF0ZWQgZHVyaW5nIHRoZSBsaW5raW5nIHBoYXNlLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fSBlbFxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gcGFydGlhbFxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gY29tcGlsZShlbCwgb3B0aW9ucywgcGFydGlhbCkge1xuICAvLyBsaW5rIGZ1bmN0aW9uIGZvciB0aGUgbm9kZSBpdHNlbGYuXG4gIHZhciBub2RlTGlua0ZuID0gcGFydGlhbCB8fCAhb3B0aW9ucy5fYXNDb21wb25lbnQgPyBjb21waWxlTm9kZShlbCwgb3B0aW9ucykgOiBudWxsO1xuICAvLyBsaW5rIGZ1bmN0aW9uIGZvciB0aGUgY2hpbGROb2Rlc1xuICB2YXIgY2hpbGRMaW5rRm4gPSAhKG5vZGVMaW5rRm4gJiYgbm9kZUxpbmtGbi50ZXJtaW5hbCkgJiYgIWlzU2NyaXB0KGVsKSAmJiBlbC5oYXNDaGlsZE5vZGVzKCkgPyBjb21waWxlTm9kZUxpc3QoZWwuY2hpbGROb2Rlcywgb3B0aW9ucykgOiBudWxsO1xuXG4gIC8qKlxuICAgKiBBIGNvbXBvc2l0ZSBsaW5rZXIgZnVuY3Rpb24gdG8gYmUgY2FsbGVkIG9uIGEgYWxyZWFkeVxuICAgKiBjb21waWxlZCBwaWVjZSBvZiBET00sIHdoaWNoIGluc3RhbnRpYXRlcyBhbGwgZGlyZWN0aXZlXG4gICAqIGluc3RhbmNlcy5cbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IHZtXG4gICAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fSBlbFxuICAgKiBAcGFyYW0ge1Z1ZX0gW2hvc3RdIC0gaG9zdCB2bSBvZiB0cmFuc2NsdWRlZCBjb250ZW50XG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbc2NvcGVdIC0gdi1mb3Igc2NvcGVcbiAgICogQHBhcmFtIHtGcmFnbWVudH0gW2ZyYWddIC0gbGluayBjb250ZXh0IGZyYWdtZW50XG4gICAqIEByZXR1cm4ge0Z1bmN0aW9ufHVuZGVmaW5lZH1cbiAgICovXG5cbiAgcmV0dXJuIGZ1bmN0aW9uIGNvbXBvc2l0ZUxpbmtGbih2bSwgZWwsIGhvc3QsIHNjb3BlLCBmcmFnKSB7XG4gICAgLy8gY2FjaGUgY2hpbGROb2RlcyBiZWZvcmUgbGlua2luZyBwYXJlbnQsIGZpeCAjNjU3XG4gICAgdmFyIGNoaWxkTm9kZXMgPSB0b0FycmF5KGVsLmNoaWxkTm9kZXMpO1xuICAgIC8vIGxpbmtcbiAgICB2YXIgZGlycyA9IGxpbmtBbmRDYXB0dXJlKGZ1bmN0aW9uIGNvbXBvc2l0ZUxpbmtDYXB0dXJlcigpIHtcbiAgICAgIGlmIChub2RlTGlua0ZuKSBub2RlTGlua0ZuKHZtLCBlbCwgaG9zdCwgc2NvcGUsIGZyYWcpO1xuICAgICAgaWYgKGNoaWxkTGlua0ZuKSBjaGlsZExpbmtGbih2bSwgY2hpbGROb2RlcywgaG9zdCwgc2NvcGUsIGZyYWcpO1xuICAgIH0sIHZtKTtcbiAgICByZXR1cm4gbWFrZVVubGlua0ZuKHZtLCBkaXJzKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBBcHBseSBhIGxpbmtlciB0byBhIHZtL2VsZW1lbnQgcGFpciBhbmQgY2FwdHVyZSB0aGVcbiAqIGRpcmVjdGl2ZXMgY3JlYXRlZCBkdXJpbmcgdGhlIHByb2Nlc3MuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gbGlua2VyXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqL1xuXG5mdW5jdGlvbiBsaW5rQW5kQ2FwdHVyZShsaW5rZXIsIHZtKSB7XG4gIC8qIGlzdGFuYnVsIGlnbm9yZSBpZiAqL1xuICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgPT09ICdwcm9kdWN0aW9uJykge1xuICAgIC8vIHJlc2V0IGRpcmVjdGl2ZXMgYmVmb3JlIGV2ZXJ5IGNhcHR1cmUgaW4gcHJvZHVjdGlvblxuICAgIC8vIG1vZGUsIHNvIHRoYXQgd2hlbiB1bmxpbmtpbmcgd2UgZG9uJ3QgbmVlZCB0byBzcGxpY2VcbiAgICAvLyB0aGVtIG91dCAod2hpY2ggdHVybnMgb3V0IHRvIGJlIGEgcGVyZiBoaXQpLlxuICAgIC8vIHRoZXkgYXJlIGtlcHQgaW4gZGV2ZWxvcG1lbnQgbW9kZSBiZWNhdXNlIHRoZXkgYXJlXG4gICAgLy8gdXNlZnVsIGZvciBWdWUncyBvd24gdGVzdHMuXG4gICAgdm0uX2RpcmVjdGl2ZXMgPSBbXTtcbiAgfVxuICB2YXIgb3JpZ2luYWxEaXJDb3VudCA9IHZtLl9kaXJlY3RpdmVzLmxlbmd0aDtcbiAgbGlua2VyKCk7XG4gIHZhciBkaXJzID0gdm0uX2RpcmVjdGl2ZXMuc2xpY2Uob3JpZ2luYWxEaXJDb3VudCk7XG4gIGRpcnMuc29ydChkaXJlY3RpdmVDb21wYXJhdG9yKTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBkaXJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGRpcnNbaV0uX2JpbmQoKTtcbiAgfVxuICByZXR1cm4gZGlycztcbn1cblxuLyoqXG4gKiBEaXJlY3RpdmUgcHJpb3JpdHkgc29ydCBjb21wYXJhdG9yXG4gKlxuICogQHBhcmFtIHtPYmplY3R9IGFcbiAqIEBwYXJhbSB7T2JqZWN0fSBiXG4gKi9cblxuZnVuY3Rpb24gZGlyZWN0aXZlQ29tcGFyYXRvcihhLCBiKSB7XG4gIGEgPSBhLmRlc2NyaXB0b3IuZGVmLnByaW9yaXR5IHx8IERFRkFVTFRfUFJJT1JJVFk7XG4gIGIgPSBiLmRlc2NyaXB0b3IuZGVmLnByaW9yaXR5IHx8IERFRkFVTFRfUFJJT1JJVFk7XG4gIHJldHVybiBhID4gYiA/IC0xIDogYSA9PT0gYiA/IDAgOiAxO1xufVxuXG4vKipcbiAqIExpbmtlciBmdW5jdGlvbnMgcmV0dXJuIGFuIHVubGluayBmdW5jdGlvbiB0aGF0XG4gKiB0ZWFyc2Rvd24gYWxsIGRpcmVjdGl2ZXMgaW5zdGFuY2VzIGdlbmVyYXRlZCBkdXJpbmdcbiAqIHRoZSBwcm9jZXNzLlxuICpcbiAqIFdlIGNyZWF0ZSB1bmxpbmsgZnVuY3Rpb25zIHdpdGggb25seSB0aGUgbmVjZXNzYXJ5XG4gKiBpbmZvcm1hdGlvbiB0byBhdm9pZCByZXRhaW5pbmcgYWRkaXRpb25hbCBjbG9zdXJlcy5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7QXJyYXl9IGRpcnNcbiAqIEBwYXJhbSB7VnVlfSBbY29udGV4dF1cbiAqIEBwYXJhbSB7QXJyYXl9IFtjb250ZXh0RGlyc11cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmZ1bmN0aW9uIG1ha2VVbmxpbmtGbih2bSwgZGlycywgY29udGV4dCwgY29udGV4dERpcnMpIHtcbiAgZnVuY3Rpb24gdW5saW5rKGRlc3Ryb3lpbmcpIHtcbiAgICB0ZWFyZG93bkRpcnModm0sIGRpcnMsIGRlc3Ryb3lpbmcpO1xuICAgIGlmIChjb250ZXh0ICYmIGNvbnRleHREaXJzKSB7XG4gICAgICB0ZWFyZG93bkRpcnMoY29udGV4dCwgY29udGV4dERpcnMpO1xuICAgIH1cbiAgfVxuICAvLyBleHBvc2UgbGlua2VkIGRpcmVjdGl2ZXNcbiAgdW5saW5rLmRpcnMgPSBkaXJzO1xuICByZXR1cm4gdW5saW5rO1xufVxuXG4vKipcbiAqIFRlYXJkb3duIHBhcnRpYWwgbGlua2VkIGRpcmVjdGl2ZXMuXG4gKlxuICogQHBhcmFtIHtWdWV9IHZtXG4gKiBAcGFyYW0ge0FycmF5fSBkaXJzXG4gKiBAcGFyYW0ge0Jvb2xlYW59IGRlc3Ryb3lpbmdcbiAqL1xuXG5mdW5jdGlvbiB0ZWFyZG93bkRpcnModm0sIGRpcnMsIGRlc3Ryb3lpbmcpIHtcbiAgdmFyIGkgPSBkaXJzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIGRpcnNbaV0uX3RlYXJkb3duKCk7XG4gICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgIWRlc3Ryb3lpbmcpIHtcbiAgICAgIHZtLl9kaXJlY3RpdmVzLiRyZW1vdmUoZGlyc1tpXSk7XG4gICAgfVxuICB9XG59XG5cbi8qKlxuICogQ29tcGlsZSBsaW5rIHByb3BzIG9uIGFuIGluc3RhbmNlLlxuICpcbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICogQHBhcmFtIHtPYmplY3R9IHByb3BzXG4gKiBAcGFyYW0ge09iamVjdH0gW3Njb3BlXVxuICogQHJldHVybiB7RnVuY3Rpb259XG4gKi9cblxuZnVuY3Rpb24gY29tcGlsZUFuZExpbmtQcm9wcyh2bSwgZWwsIHByb3BzLCBzY29wZSkge1xuICB2YXIgcHJvcHNMaW5rRm4gPSBjb21waWxlUHJvcHMoZWwsIHByb3BzLCB2bSk7XG4gIHZhciBwcm9wRGlycyA9IGxpbmtBbmRDYXB0dXJlKGZ1bmN0aW9uICgpIHtcbiAgICBwcm9wc0xpbmtGbih2bSwgc2NvcGUpO1xuICB9LCB2bSk7XG4gIHJldHVybiBtYWtlVW5saW5rRm4odm0sIHByb3BEaXJzKTtcbn1cblxuLyoqXG4gKiBDb21waWxlIHRoZSByb290IGVsZW1lbnQgb2YgYW4gaW5zdGFuY2UuXG4gKlxuICogMS4gYXR0cnMgb24gY29udGV4dCBjb250YWluZXIgKGNvbnRleHQgc2NvcGUpXG4gKiAyLiBhdHRycyBvbiB0aGUgY29tcG9uZW50IHRlbXBsYXRlIHJvb3Qgbm9kZSwgaWZcbiAqICAgIHJlcGxhY2U6dHJ1ZSAoY2hpbGQgc2NvcGUpXG4gKlxuICogSWYgdGhpcyBpcyBhIGZyYWdtZW50IGluc3RhbmNlLCB3ZSBvbmx5IG5lZWQgdG8gY29tcGlsZSAxLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcGFyYW0ge09iamVjdH0gY29udGV4dE9wdGlvbnNcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVSb290KGVsLCBvcHRpb25zLCBjb250ZXh0T3B0aW9ucykge1xuICB2YXIgY29udGFpbmVyQXR0cnMgPSBvcHRpb25zLl9jb250YWluZXJBdHRycztcbiAgdmFyIHJlcGxhY2VyQXR0cnMgPSBvcHRpb25zLl9yZXBsYWNlckF0dHJzO1xuICB2YXIgY29udGV4dExpbmtGbiwgcmVwbGFjZXJMaW5rRm47XG5cbiAgLy8gb25seSBuZWVkIHRvIGNvbXBpbGUgb3RoZXIgYXR0cmlidXRlcyBmb3JcbiAgLy8gbm9uLWZyYWdtZW50IGluc3RhbmNlc1xuICBpZiAoZWwubm9kZVR5cGUgIT09IDExKSB7XG4gICAgLy8gZm9yIGNvbXBvbmVudHMsIGNvbnRhaW5lciBhbmQgcmVwbGFjZXIgbmVlZCB0byBiZVxuICAgIC8vIGNvbXBpbGVkIHNlcGFyYXRlbHkgYW5kIGxpbmtlZCBpbiBkaWZmZXJlbnQgc2NvcGVzLlxuICAgIGlmIChvcHRpb25zLl9hc0NvbXBvbmVudCkge1xuICAgICAgLy8gMi4gY29udGFpbmVyIGF0dHJpYnV0ZXNcbiAgICAgIGlmIChjb250YWluZXJBdHRycyAmJiBjb250ZXh0T3B0aW9ucykge1xuICAgICAgICBjb250ZXh0TGlua0ZuID0gY29tcGlsZURpcmVjdGl2ZXMoY29udGFpbmVyQXR0cnMsIGNvbnRleHRPcHRpb25zKTtcbiAgICAgIH1cbiAgICAgIGlmIChyZXBsYWNlckF0dHJzKSB7XG4gICAgICAgIC8vIDMuIHJlcGxhY2VyIGF0dHJpYnV0ZXNcbiAgICAgICAgcmVwbGFjZXJMaW5rRm4gPSBjb21waWxlRGlyZWN0aXZlcyhyZXBsYWNlckF0dHJzLCBvcHRpb25zKTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbm9uLWNvbXBvbmVudCwganVzdCBjb21waWxlIGFzIGEgbm9ybWFsIGVsZW1lbnQuXG4gICAgICByZXBsYWNlckxpbmtGbiA9IGNvbXBpbGVEaXJlY3RpdmVzKGVsLmF0dHJpYnV0ZXMsIG9wdGlvbnMpO1xuICAgIH1cbiAgfSBlbHNlIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIGNvbnRhaW5lckF0dHJzKSB7XG4gICAgLy8gd2FybiBjb250YWluZXIgZGlyZWN0aXZlcyBmb3IgZnJhZ21lbnQgaW5zdGFuY2VzXG4gICAgdmFyIG5hbWVzID0gY29udGFpbmVyQXR0cnMuZmlsdGVyKGZ1bmN0aW9uIChhdHRyKSB7XG4gICAgICAvLyBhbGxvdyB2dWUtbG9hZGVyL3Z1ZWlmeSBzY29wZWQgY3NzIGF0dHJpYnV0ZXNcbiAgICAgIHJldHVybiBhdHRyLm5hbWUuaW5kZXhPZignX3YtJykgPCAwICYmXG4gICAgICAvLyBhbGxvdyBldmVudCBsaXN0ZW5lcnNcbiAgICAgICFvblJFLnRlc3QoYXR0ci5uYW1lKSAmJlxuICAgICAgLy8gYWxsb3cgc2xvdHNcbiAgICAgIGF0dHIubmFtZSAhPT0gJ3Nsb3QnO1xuICAgIH0pLm1hcChmdW5jdGlvbiAoYXR0cikge1xuICAgICAgcmV0dXJuICdcIicgKyBhdHRyLm5hbWUgKyAnXCInO1xuICAgIH0pO1xuICAgIGlmIChuYW1lcy5sZW5ndGgpIHtcbiAgICAgIHZhciBwbHVyYWwgPSBuYW1lcy5sZW5ndGggPiAxO1xuICAgICAgd2FybignQXR0cmlidXRlJyArIChwbHVyYWwgPyAncyAnIDogJyAnKSArIG5hbWVzLmpvaW4oJywgJykgKyAocGx1cmFsID8gJyBhcmUnIDogJyBpcycpICsgJyBpZ25vcmVkIG9uIGNvbXBvbmVudCAnICsgJzwnICsgb3B0aW9ucy5lbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgKyAnPiBiZWNhdXNlICcgKyAndGhlIGNvbXBvbmVudCBpcyBhIGZyYWdtZW50IGluc3RhbmNlOiAnICsgJ2h0dHA6Ly92dWVqcy5vcmcvZ3VpZGUvY29tcG9uZW50cy5odG1sI0ZyYWdtZW50LUluc3RhbmNlJyk7XG4gICAgfVxuICB9XG5cbiAgb3B0aW9ucy5fY29udGFpbmVyQXR0cnMgPSBvcHRpb25zLl9yZXBsYWNlckF0dHJzID0gbnVsbDtcbiAgcmV0dXJuIGZ1bmN0aW9uIHJvb3RMaW5rRm4odm0sIGVsLCBzY29wZSkge1xuICAgIC8vIGxpbmsgY29udGV4dCBzY29wZSBkaXJzXG4gICAgdmFyIGNvbnRleHQgPSB2bS5fY29udGV4dDtcbiAgICB2YXIgY29udGV4dERpcnM7XG4gICAgaWYgKGNvbnRleHQgJiYgY29udGV4dExpbmtGbikge1xuICAgICAgY29udGV4dERpcnMgPSBsaW5rQW5kQ2FwdHVyZShmdW5jdGlvbiAoKSB7XG4gICAgICAgIGNvbnRleHRMaW5rRm4oY29udGV4dCwgZWwsIG51bGwsIHNjb3BlKTtcbiAgICAgIH0sIGNvbnRleHQpO1xuICAgIH1cblxuICAgIC8vIGxpbmsgc2VsZlxuICAgIHZhciBzZWxmRGlycyA9IGxpbmtBbmRDYXB0dXJlKGZ1bmN0aW9uICgpIHtcbiAgICAgIGlmIChyZXBsYWNlckxpbmtGbikgcmVwbGFjZXJMaW5rRm4odm0sIGVsKTtcbiAgICB9LCB2bSk7XG5cbiAgICAvLyByZXR1cm4gdGhlIHVubGluayBmdW5jdGlvbiB0aGF0IHRlYXJzZG93biBjb250ZXh0XG4gICAgLy8gY29udGFpbmVyIGRpcmVjdGl2ZXMuXG4gICAgcmV0dXJuIG1ha2VVbmxpbmtGbih2bSwgc2VsZkRpcnMsIGNvbnRleHQsIGNvbnRleHREaXJzKTtcbiAgfTtcbn1cblxuLyoqXG4gKiBDb21waWxlIGEgbm9kZSBhbmQgcmV0dXJuIGEgbm9kZUxpbmtGbiBiYXNlZCBvbiB0aGVcbiAqIG5vZGUgdHlwZS5cbiAqXG4gKiBAcGFyYW0ge05vZGV9IG5vZGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfVxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVOb2RlKG5vZGUsIG9wdGlvbnMpIHtcbiAgdmFyIHR5cGUgPSBub2RlLm5vZGVUeXBlO1xuICBpZiAodHlwZSA9PT0gMSAmJiAhaXNTY3JpcHQobm9kZSkpIHtcbiAgICByZXR1cm4gY29tcGlsZUVsZW1lbnQobm9kZSwgb3B0aW9ucyk7XG4gIH0gZWxzZSBpZiAodHlwZSA9PT0gMyAmJiBub2RlLmRhdGEudHJpbSgpKSB7XG4gICAgcmV0dXJuIGNvbXBpbGVUZXh0Tm9kZShub2RlLCBvcHRpb25zKTtcbiAgfSBlbHNlIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuXG4vKipcbiAqIENvbXBpbGUgYW4gZWxlbWVudCBhbmQgcmV0dXJuIGEgbm9kZUxpbmtGbi5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7RnVuY3Rpb258bnVsbH1cbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlRWxlbWVudChlbCwgb3B0aW9ucykge1xuICAvLyBwcmVwcm9jZXNzIHRleHRhcmVhcy5cbiAgLy8gdGV4dGFyZWEgdHJlYXRzIGl0cyB0ZXh0IGNvbnRlbnQgYXMgdGhlIGluaXRpYWwgdmFsdWUuXG4gIC8vIGp1c3QgYmluZCBpdCBhcyBhbiBhdHRyIGRpcmVjdGl2ZSBmb3IgdmFsdWUuXG4gIGlmIChlbC50YWdOYW1lID09PSAnVEVYVEFSRUEnKSB7XG4gICAgdmFyIHRva2VucyA9IHBhcnNlVGV4dChlbC52YWx1ZSk7XG4gICAgaWYgKHRva2Vucykge1xuICAgICAgZWwuc2V0QXR0cmlidXRlKCc6dmFsdWUnLCB0b2tlbnNUb0V4cCh0b2tlbnMpKTtcbiAgICAgIGVsLnZhbHVlID0gJyc7XG4gICAgfVxuICB9XG4gIHZhciBsaW5rRm47XG4gIHZhciBoYXNBdHRycyA9IGVsLmhhc0F0dHJpYnV0ZXMoKTtcbiAgdmFyIGF0dHJzID0gaGFzQXR0cnMgJiYgdG9BcnJheShlbC5hdHRyaWJ1dGVzKTtcbiAgLy8gY2hlY2sgdGVybWluYWwgZGlyZWN0aXZlcyAoZm9yICYgaWYpXG4gIGlmIChoYXNBdHRycykge1xuICAgIGxpbmtGbiA9IGNoZWNrVGVybWluYWxEaXJlY3RpdmVzKGVsLCBhdHRycywgb3B0aW9ucyk7XG4gIH1cbiAgLy8gY2hlY2sgZWxlbWVudCBkaXJlY3RpdmVzXG4gIGlmICghbGlua0ZuKSB7XG4gICAgbGlua0ZuID0gY2hlY2tFbGVtZW50RGlyZWN0aXZlcyhlbCwgb3B0aW9ucyk7XG4gIH1cbiAgLy8gY2hlY2sgY29tcG9uZW50XG4gIGlmICghbGlua0ZuKSB7XG4gICAgbGlua0ZuID0gY2hlY2tDb21wb25lbnQoZWwsIG9wdGlvbnMpO1xuICB9XG4gIC8vIG5vcm1hbCBkaXJlY3RpdmVzXG4gIGlmICghbGlua0ZuICYmIGhhc0F0dHJzKSB7XG4gICAgbGlua0ZuID0gY29tcGlsZURpcmVjdGl2ZXMoYXR0cnMsIG9wdGlvbnMpO1xuICB9XG4gIHJldHVybiBsaW5rRm47XG59XG5cbi8qKlxuICogQ29tcGlsZSBhIHRleHROb2RlIGFuZCByZXR1cm4gYSBub2RlTGlua0ZuLlxuICpcbiAqIEBwYXJhbSB7VGV4dE5vZGV9IG5vZGVcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbnxudWxsfSB0ZXh0Tm9kZUxpbmtGblxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVUZXh0Tm9kZShub2RlLCBvcHRpb25zKSB7XG4gIC8vIHNraXAgbWFya2VkIHRleHQgbm9kZXNcbiAgaWYgKG5vZGUuX3NraXApIHtcbiAgICByZXR1cm4gcmVtb3ZlVGV4dDtcbiAgfVxuXG4gIHZhciB0b2tlbnMgPSBwYXJzZVRleHQobm9kZS53aG9sZVRleHQpO1xuICBpZiAoIXRva2Vucykge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgLy8gbWFyayBhZGphY2VudCB0ZXh0IG5vZGVzIGFzIHNraXBwZWQsXG4gIC8vIGJlY2F1c2Ugd2UgYXJlIHVzaW5nIG5vZGUud2hvbGVUZXh0IHRvIGNvbXBpbGVcbiAgLy8gYWxsIGFkamFjZW50IHRleHQgbm9kZXMgdG9nZXRoZXIuIFRoaXMgZml4ZXNcbiAgLy8gaXNzdWVzIGluIElFIHdoZXJlIHNvbWV0aW1lcyBpdCBzcGxpdHMgdXAgYSBzaW5nbGVcbiAgLy8gdGV4dCBub2RlIGludG8gbXVsdGlwbGUgb25lcy5cbiAgdmFyIG5leHQgPSBub2RlLm5leHRTaWJsaW5nO1xuICB3aGlsZSAobmV4dCAmJiBuZXh0Lm5vZGVUeXBlID09PSAzKSB7XG4gICAgbmV4dC5fc2tpcCA9IHRydWU7XG4gICAgbmV4dCA9IG5leHQubmV4dFNpYmxpbmc7XG4gIH1cblxuICB2YXIgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgdmFyIGVsLCB0b2tlbjtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB0b2tlbnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgZWwgPSB0b2tlbi50YWcgPyBwcm9jZXNzVGV4dFRva2VuKHRva2VuLCBvcHRpb25zKSA6IGRvY3VtZW50LmNyZWF0ZVRleHROb2RlKHRva2VuLnZhbHVlKTtcbiAgICBmcmFnLmFwcGVuZENoaWxkKGVsKTtcbiAgfVxuICByZXR1cm4gbWFrZVRleHROb2RlTGlua0ZuKHRva2VucywgZnJhZywgb3B0aW9ucyk7XG59XG5cbi8qKlxuICogTGlua2VyIGZvciBhbiBza2lwcGVkIHRleHQgbm9kZS5cbiAqXG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqIEBwYXJhbSB7VGV4dH0gbm9kZVxuICovXG5cbmZ1bmN0aW9uIHJlbW92ZVRleHQodm0sIG5vZGUpIHtcbiAgcmVtb3ZlKG5vZGUpO1xufVxuXG4vKipcbiAqIFByb2Nlc3MgYSBzaW5nbGUgdGV4dCB0b2tlbi5cbiAqXG4gKiBAcGFyYW0ge09iamVjdH0gdG9rZW5cbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtOb2RlfVxuICovXG5cbmZ1bmN0aW9uIHByb2Nlc3NUZXh0VG9rZW4odG9rZW4sIG9wdGlvbnMpIHtcbiAgdmFyIGVsO1xuICBpZiAodG9rZW4ub25lVGltZSkge1xuICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUodG9rZW4udmFsdWUpO1xuICB9IGVsc2Uge1xuICAgIGlmICh0b2tlbi5odG1sKSB7XG4gICAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZUNvbW1lbnQoJ3YtaHRtbCcpO1xuICAgICAgc2V0VG9rZW5UeXBlKCdodG1sJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIElFIHdpbGwgY2xlYW4gdXAgZW1wdHkgdGV4dE5vZGVzIGR1cmluZ1xuICAgICAgLy8gZnJhZy5jbG9uZU5vZGUodHJ1ZSksIHNvIHdlIGhhdmUgdG8gZ2l2ZSBpdFxuICAgICAgLy8gc29tZXRoaW5nIGhlcmUuLi5cbiAgICAgIGVsID0gZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUoJyAnKTtcbiAgICAgIHNldFRva2VuVHlwZSgndGV4dCcpO1xuICAgIH1cbiAgfVxuICBmdW5jdGlvbiBzZXRUb2tlblR5cGUodHlwZSkge1xuICAgIGlmICh0b2tlbi5kZXNjcmlwdG9yKSByZXR1cm47XG4gICAgdmFyIHBhcnNlZCA9IHBhcnNlRGlyZWN0aXZlKHRva2VuLnZhbHVlKTtcbiAgICB0b2tlbi5kZXNjcmlwdG9yID0ge1xuICAgICAgbmFtZTogdHlwZSxcbiAgICAgIGRlZjogZGlyZWN0aXZlc1t0eXBlXSxcbiAgICAgIGV4cHJlc3Npb246IHBhcnNlZC5leHByZXNzaW9uLFxuICAgICAgZmlsdGVyczogcGFyc2VkLmZpbHRlcnNcbiAgICB9O1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBCdWlsZCBhIGZ1bmN0aW9uIHRoYXQgcHJvY2Vzc2VzIGEgdGV4dE5vZGUuXG4gKlxuICogQHBhcmFtIHtBcnJheTxPYmplY3Q+fSB0b2tlbnNcbiAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gZnJhZ1xuICovXG5cbmZ1bmN0aW9uIG1ha2VUZXh0Tm9kZUxpbmtGbih0b2tlbnMsIGZyYWcpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIHRleHROb2RlTGlua0ZuKHZtLCBlbCwgaG9zdCwgc2NvcGUpIHtcbiAgICB2YXIgZnJhZ0Nsb25lID0gZnJhZy5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgdmFyIGNoaWxkTm9kZXMgPSB0b0FycmF5KGZyYWdDbG9uZS5jaGlsZE5vZGVzKTtcbiAgICB2YXIgdG9rZW4sIHZhbHVlLCBub2RlO1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdG9rZW5zLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgICB2YWx1ZSA9IHRva2VuLnZhbHVlO1xuICAgICAgaWYgKHRva2VuLnRhZykge1xuICAgICAgICBub2RlID0gY2hpbGROb2Rlc1tpXTtcbiAgICAgICAgaWYgKHRva2VuLm9uZVRpbWUpIHtcbiAgICAgICAgICB2YWx1ZSA9IChzY29wZSB8fCB2bSkuJGV2YWwodmFsdWUpO1xuICAgICAgICAgIGlmICh0b2tlbi5odG1sKSB7XG4gICAgICAgICAgICByZXBsYWNlKG5vZGUsIHBhcnNlVGVtcGxhdGUodmFsdWUsIHRydWUpKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbm9kZS5kYXRhID0gdmFsdWU7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHZtLl9iaW5kRGlyKHRva2VuLmRlc2NyaXB0b3IsIG5vZGUsIGhvc3QsIHNjb3BlKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXBsYWNlKGVsLCBmcmFnQ2xvbmUpO1xuICB9O1xufVxuXG4vKipcbiAqIENvbXBpbGUgYSBub2RlIGxpc3QgYW5kIHJldHVybiBhIGNoaWxkTGlua0ZuLlxuICpcbiAqIEBwYXJhbSB7Tm9kZUxpc3R9IG5vZGVMaXN0XG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7RnVuY3Rpb258dW5kZWZpbmVkfVxuICovXG5cbmZ1bmN0aW9uIGNvbXBpbGVOb2RlTGlzdChub2RlTGlzdCwgb3B0aW9ucykge1xuICB2YXIgbGlua0ZucyA9IFtdO1xuICB2YXIgbm9kZUxpbmtGbiwgY2hpbGRMaW5rRm4sIG5vZGU7XG4gIGZvciAodmFyIGkgPSAwLCBsID0gbm9kZUxpc3QubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgbm9kZSA9IG5vZGVMaXN0W2ldO1xuICAgIG5vZGVMaW5rRm4gPSBjb21waWxlTm9kZShub2RlLCBvcHRpb25zKTtcbiAgICBjaGlsZExpbmtGbiA9ICEobm9kZUxpbmtGbiAmJiBub2RlTGlua0ZuLnRlcm1pbmFsKSAmJiBub2RlLnRhZ05hbWUgIT09ICdTQ1JJUFQnICYmIG5vZGUuaGFzQ2hpbGROb2RlcygpID8gY29tcGlsZU5vZGVMaXN0KG5vZGUuY2hpbGROb2Rlcywgb3B0aW9ucykgOiBudWxsO1xuICAgIGxpbmtGbnMucHVzaChub2RlTGlua0ZuLCBjaGlsZExpbmtGbik7XG4gIH1cbiAgcmV0dXJuIGxpbmtGbnMubGVuZ3RoID8gbWFrZUNoaWxkTGlua0ZuKGxpbmtGbnMpIDogbnVsbDtcbn1cblxuLyoqXG4gKiBNYWtlIGEgY2hpbGQgbGluayBmdW5jdGlvbiBmb3IgYSBub2RlJ3MgY2hpbGROb2Rlcy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5PEZ1bmN0aW9uPn0gbGlua0Zuc1xuICogQHJldHVybiB7RnVuY3Rpb259IGNoaWxkTGlua0ZuXG4gKi9cblxuZnVuY3Rpb24gbWFrZUNoaWxkTGlua0ZuKGxpbmtGbnMpIHtcbiAgcmV0dXJuIGZ1bmN0aW9uIGNoaWxkTGlua0ZuKHZtLCBub2RlcywgaG9zdCwgc2NvcGUsIGZyYWcpIHtcbiAgICB2YXIgbm9kZSwgbm9kZUxpbmtGbiwgY2hpbGRyZW5MaW5rRm47XG4gICAgZm9yICh2YXIgaSA9IDAsIG4gPSAwLCBsID0gbGlua0Zucy5sZW5ndGg7IGkgPCBsOyBuKyspIHtcbiAgICAgIG5vZGUgPSBub2Rlc1tuXTtcbiAgICAgIG5vZGVMaW5rRm4gPSBsaW5rRm5zW2krK107XG4gICAgICBjaGlsZHJlbkxpbmtGbiA9IGxpbmtGbnNbaSsrXTtcbiAgICAgIC8vIGNhY2hlIGNoaWxkTm9kZXMgYmVmb3JlIGxpbmtpbmcgcGFyZW50LCBmaXggIzY1N1xuICAgICAgdmFyIGNoaWxkTm9kZXMgPSB0b0FycmF5KG5vZGUuY2hpbGROb2Rlcyk7XG4gICAgICBpZiAobm9kZUxpbmtGbikge1xuICAgICAgICBub2RlTGlua0ZuKHZtLCBub2RlLCBob3N0LCBzY29wZSwgZnJhZyk7XG4gICAgICB9XG4gICAgICBpZiAoY2hpbGRyZW5MaW5rRm4pIHtcbiAgICAgICAgY2hpbGRyZW5MaW5rRm4odm0sIGNoaWxkTm9kZXMsIGhvc3QsIHNjb3BlLCBmcmFnKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG59XG5cbi8qKlxuICogQ2hlY2sgZm9yIGVsZW1lbnQgZGlyZWN0aXZlcyAoY3VzdG9tIGVsZW1lbnRzIHRoYXQgc2hvdWxkXG4gKiBiZSByZXNvdmxlZCBhcyB0ZXJtaW5hbCBkaXJlY3RpdmVzKS5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICovXG5cbmZ1bmN0aW9uIGNoZWNrRWxlbWVudERpcmVjdGl2ZXMoZWwsIG9wdGlvbnMpIHtcbiAgdmFyIHRhZyA9IGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgaWYgKGNvbW1vblRhZ1JFLnRlc3QodGFnKSkge1xuICAgIHJldHVybjtcbiAgfVxuICB2YXIgZGVmID0gcmVzb2x2ZUFzc2V0KG9wdGlvbnMsICdlbGVtZW50RGlyZWN0aXZlcycsIHRhZyk7XG4gIGlmIChkZWYpIHtcbiAgICByZXR1cm4gbWFrZVRlcm1pbmFsTm9kZUxpbmtGbihlbCwgdGFnLCAnJywgb3B0aW9ucywgZGVmKTtcbiAgfVxufVxuXG4vKipcbiAqIENoZWNrIGlmIGFuIGVsZW1lbnQgaXMgYSBjb21wb25lbnQuIElmIHllcywgcmV0dXJuXG4gKiBhIGNvbXBvbmVudCBsaW5rIGZ1bmN0aW9uLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbnx1bmRlZmluZWR9XG4gKi9cblxuZnVuY3Rpb24gY2hlY2tDb21wb25lbnQoZWwsIG9wdGlvbnMpIHtcbiAgdmFyIGNvbXBvbmVudCA9IGNoZWNrQ29tcG9uZW50QXR0cihlbCwgb3B0aW9ucyk7XG4gIGlmIChjb21wb25lbnQpIHtcbiAgICB2YXIgcmVmID0gZmluZFJlZihlbCk7XG4gICAgdmFyIGRlc2NyaXB0b3IgPSB7XG4gICAgICBuYW1lOiAnY29tcG9uZW50JyxcbiAgICAgIHJlZjogcmVmLFxuICAgICAgZXhwcmVzc2lvbjogY29tcG9uZW50LmlkLFxuICAgICAgZGVmOiBpbnRlcm5hbERpcmVjdGl2ZXMuY29tcG9uZW50LFxuICAgICAgbW9kaWZpZXJzOiB7XG4gICAgICAgIGxpdGVyYWw6ICFjb21wb25lbnQuZHluYW1pY1xuICAgICAgfVxuICAgIH07XG4gICAgdmFyIGNvbXBvbmVudExpbmtGbiA9IGZ1bmN0aW9uIGNvbXBvbmVudExpbmtGbih2bSwgZWwsIGhvc3QsIHNjb3BlLCBmcmFnKSB7XG4gICAgICBpZiAocmVmKSB7XG4gICAgICAgIGRlZmluZVJlYWN0aXZlKChzY29wZSB8fCB2bSkuJHJlZnMsIHJlZiwgbnVsbCk7XG4gICAgICB9XG4gICAgICB2bS5fYmluZERpcihkZXNjcmlwdG9yLCBlbCwgaG9zdCwgc2NvcGUsIGZyYWcpO1xuICAgIH07XG4gICAgY29tcG9uZW50TGlua0ZuLnRlcm1pbmFsID0gdHJ1ZTtcbiAgICByZXR1cm4gY29tcG9uZW50TGlua0ZuO1xuICB9XG59XG5cbi8qKlxuICogQ2hlY2sgYW4gZWxlbWVudCBmb3IgdGVybWluYWwgZGlyZWN0aXZlcyBpbiBmaXhlZCBvcmRlci5cbiAqIElmIGl0IGZpbmRzIG9uZSwgcmV0dXJuIGEgdGVybWluYWwgbGluayBmdW5jdGlvbi5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge0FycmF5fSBhdHRyc1xuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEByZXR1cm4ge0Z1bmN0aW9ufSB0ZXJtaW5hbExpbmtGblxuICovXG5cbmZ1bmN0aW9uIGNoZWNrVGVybWluYWxEaXJlY3RpdmVzKGVsLCBhdHRycywgb3B0aW9ucykge1xuICAvLyBza2lwIHYtcHJlXG4gIGlmIChnZXRBdHRyKGVsLCAndi1wcmUnKSAhPT0gbnVsbCkge1xuICAgIHJldHVybiBza2lwO1xuICB9XG4gIC8vIHNraXAgdi1lbHNlIGJsb2NrLCBidXQgb25seSBpZiBmb2xsb3dpbmcgdi1pZlxuICBpZiAoZWwuaGFzQXR0cmlidXRlKCd2LWVsc2UnKSkge1xuICAgIHZhciBwcmV2ID0gZWwucHJldmlvdXNFbGVtZW50U2libGluZztcbiAgICBpZiAocHJldiAmJiBwcmV2Lmhhc0F0dHJpYnV0ZSgndi1pZicpKSB7XG4gICAgICByZXR1cm4gc2tpcDtcbiAgICB9XG4gIH1cblxuICB2YXIgYXR0ciwgbmFtZSwgdmFsdWUsIG1vZGlmaWVycywgbWF0Y2hlZCwgZGlyTmFtZSwgcmF3TmFtZSwgYXJnLCBkZWYsIHRlcm1EZWY7XG4gIGZvciAodmFyIGkgPSAwLCBqID0gYXR0cnMubGVuZ3RoOyBpIDwgajsgaSsrKSB7XG4gICAgYXR0ciA9IGF0dHJzW2ldO1xuICAgIG5hbWUgPSBhdHRyLm5hbWUucmVwbGFjZShtb2RpZmllclJFLCAnJyk7XG4gICAgaWYgKG1hdGNoZWQgPSBuYW1lLm1hdGNoKGRpckF0dHJSRSkpIHtcbiAgICAgIGRlZiA9IHJlc29sdmVBc3NldChvcHRpb25zLCAnZGlyZWN0aXZlcycsIG1hdGNoZWRbMV0pO1xuICAgICAgaWYgKGRlZiAmJiBkZWYudGVybWluYWwpIHtcbiAgICAgICAgaWYgKCF0ZXJtRGVmIHx8IChkZWYucHJpb3JpdHkgfHwgREVGQVVMVF9URVJNSU5BTF9QUklPUklUWSkgPiB0ZXJtRGVmLnByaW9yaXR5KSB7XG4gICAgICAgICAgdGVybURlZiA9IGRlZjtcbiAgICAgICAgICByYXdOYW1lID0gYXR0ci5uYW1lO1xuICAgICAgICAgIG1vZGlmaWVycyA9IHBhcnNlTW9kaWZpZXJzKGF0dHIubmFtZSk7XG4gICAgICAgICAgdmFsdWUgPSBhdHRyLnZhbHVlO1xuICAgICAgICAgIGRpck5hbWUgPSBtYXRjaGVkWzFdO1xuICAgICAgICAgIGFyZyA9IG1hdGNoZWRbMl07XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICBpZiAodGVybURlZikge1xuICAgIHJldHVybiBtYWtlVGVybWluYWxOb2RlTGlua0ZuKGVsLCBkaXJOYW1lLCB2YWx1ZSwgb3B0aW9ucywgdGVybURlZiwgcmF3TmFtZSwgYXJnLCBtb2RpZmllcnMpO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNraXAoKSB7fVxuc2tpcC50ZXJtaW5hbCA9IHRydWU7XG5cbi8qKlxuICogQnVpbGQgYSBub2RlIGxpbmsgZnVuY3Rpb24gZm9yIGEgdGVybWluYWwgZGlyZWN0aXZlLlxuICogQSB0ZXJtaW5hbCBsaW5rIGZ1bmN0aW9uIHRlcm1pbmF0ZXMgdGhlIGN1cnJlbnRcbiAqIGNvbXBpbGF0aW9uIHJlY3Vyc2lvbiBhbmQgaGFuZGxlcyBjb21waWxhdGlvbiBvZiB0aGVcbiAqIHN1YnRyZWUgaW4gdGhlIGRpcmVjdGl2ZS5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge1N0cmluZ30gZGlyTmFtZVxuICogQHBhcmFtIHtTdHJpbmd9IHZhbHVlXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHBhcmFtIHtPYmplY3R9IGRlZlxuICogQHBhcmFtIHtTdHJpbmd9IFtyYXdOYW1lXVxuICogQHBhcmFtIHtTdHJpbmd9IFthcmddXG4gKiBAcGFyYW0ge09iamVjdH0gW21vZGlmaWVyc11cbiAqIEByZXR1cm4ge0Z1bmN0aW9ufSB0ZXJtaW5hbExpbmtGblxuICovXG5cbmZ1bmN0aW9uIG1ha2VUZXJtaW5hbE5vZGVMaW5rRm4oZWwsIGRpck5hbWUsIHZhbHVlLCBvcHRpb25zLCBkZWYsIHJhd05hbWUsIGFyZywgbW9kaWZpZXJzKSB7XG4gIHZhciBwYXJzZWQgPSBwYXJzZURpcmVjdGl2ZSh2YWx1ZSk7XG4gIHZhciBkZXNjcmlwdG9yID0ge1xuICAgIG5hbWU6IGRpck5hbWUsXG4gICAgYXJnOiBhcmcsXG4gICAgZXhwcmVzc2lvbjogcGFyc2VkLmV4cHJlc3Npb24sXG4gICAgZmlsdGVyczogcGFyc2VkLmZpbHRlcnMsXG4gICAgcmF3OiB2YWx1ZSxcbiAgICBhdHRyOiByYXdOYW1lLFxuICAgIG1vZGlmaWVyczogbW9kaWZpZXJzLFxuICAgIGRlZjogZGVmXG4gIH07XG4gIC8vIGNoZWNrIHJlZiBmb3Igdi1mb3IgYW5kIHJvdXRlci12aWV3XG4gIGlmIChkaXJOYW1lID09PSAnZm9yJyB8fCBkaXJOYW1lID09PSAncm91dGVyLXZpZXcnKSB7XG4gICAgZGVzY3JpcHRvci5yZWYgPSBmaW5kUmVmKGVsKTtcbiAgfVxuICB2YXIgZm4gPSBmdW5jdGlvbiB0ZXJtaW5hbE5vZGVMaW5rRm4odm0sIGVsLCBob3N0LCBzY29wZSwgZnJhZykge1xuICAgIGlmIChkZXNjcmlwdG9yLnJlZikge1xuICAgICAgZGVmaW5lUmVhY3RpdmUoKHNjb3BlIHx8IHZtKS4kcmVmcywgZGVzY3JpcHRvci5yZWYsIG51bGwpO1xuICAgIH1cbiAgICB2bS5fYmluZERpcihkZXNjcmlwdG9yLCBlbCwgaG9zdCwgc2NvcGUsIGZyYWcpO1xuICB9O1xuICBmbi50ZXJtaW5hbCA9IHRydWU7XG4gIHJldHVybiBmbjtcbn1cblxuLyoqXG4gKiBDb21waWxlIHRoZSBkaXJlY3RpdmVzIG9uIGFuIGVsZW1lbnQgYW5kIHJldHVybiBhIGxpbmtlci5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fE5hbWVkTm9kZU1hcH0gYXR0cnNcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAqL1xuXG5mdW5jdGlvbiBjb21waWxlRGlyZWN0aXZlcyhhdHRycywgb3B0aW9ucykge1xuICB2YXIgaSA9IGF0dHJzLmxlbmd0aDtcbiAgdmFyIGRpcnMgPSBbXTtcbiAgdmFyIGF0dHIsIG5hbWUsIHZhbHVlLCByYXdOYW1lLCByYXdWYWx1ZSwgZGlyTmFtZSwgYXJnLCBtb2RpZmllcnMsIGRpckRlZiwgdG9rZW5zLCBtYXRjaGVkO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgYXR0ciA9IGF0dHJzW2ldO1xuICAgIG5hbWUgPSByYXdOYW1lID0gYXR0ci5uYW1lO1xuICAgIHZhbHVlID0gcmF3VmFsdWUgPSBhdHRyLnZhbHVlO1xuICAgIHRva2VucyA9IHBhcnNlVGV4dCh2YWx1ZSk7XG4gICAgLy8gcmVzZXQgYXJnXG4gICAgYXJnID0gbnVsbDtcbiAgICAvLyBjaGVjayBtb2RpZmllcnNcbiAgICBtb2RpZmllcnMgPSBwYXJzZU1vZGlmaWVycyhuYW1lKTtcbiAgICBuYW1lID0gbmFtZS5yZXBsYWNlKG1vZGlmaWVyUkUsICcnKTtcblxuICAgIC8vIGF0dHJpYnV0ZSBpbnRlcnBvbGF0aW9uc1xuICAgIGlmICh0b2tlbnMpIHtcbiAgICAgIHZhbHVlID0gdG9rZW5zVG9FeHAodG9rZW5zKTtcbiAgICAgIGFyZyA9IG5hbWU7XG4gICAgICBwdXNoRGlyKCdiaW5kJywgZGlyZWN0aXZlcy5iaW5kLCB0b2tlbnMpO1xuICAgICAgLy8gd2FybiBhZ2FpbnN0IG1peGluZyBtdXN0YWNoZXMgd2l0aCB2LWJpbmRcbiAgICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nKSB7XG4gICAgICAgIGlmIChuYW1lID09PSAnY2xhc3MnICYmIEFycmF5LnByb3RvdHlwZS5zb21lLmNhbGwoYXR0cnMsIGZ1bmN0aW9uIChhdHRyKSB7XG4gICAgICAgICAgcmV0dXJuIGF0dHIubmFtZSA9PT0gJzpjbGFzcycgfHwgYXR0ci5uYW1lID09PSAndi1iaW5kOmNsYXNzJztcbiAgICAgICAgfSkpIHtcbiAgICAgICAgICB3YXJuKCdjbGFzcz1cIicgKyByYXdWYWx1ZSArICdcIjogRG8gbm90IG1peCBtdXN0YWNoZSBpbnRlcnBvbGF0aW9uICcgKyAnYW5kIHYtYmluZCBmb3IgXCJjbGFzc1wiIG9uIHRoZSBzYW1lIGVsZW1lbnQuIFVzZSBvbmUgb3IgdGhlIG90aGVyLicsIG9wdGlvbnMpO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlXG5cbiAgICAgIC8vIHNwZWNpYWwgYXR0cmlidXRlOiB0cmFuc2l0aW9uXG4gICAgICBpZiAodHJhbnNpdGlvblJFLnRlc3QobmFtZSkpIHtcbiAgICAgICAgbW9kaWZpZXJzLmxpdGVyYWwgPSAhYmluZFJFLnRlc3QobmFtZSk7XG4gICAgICAgIHB1c2hEaXIoJ3RyYW5zaXRpb24nLCBpbnRlcm5hbERpcmVjdGl2ZXMudHJhbnNpdGlvbik7XG4gICAgICB9IGVsc2VcblxuICAgICAgICAvLyBldmVudCBoYW5kbGVyc1xuICAgICAgICBpZiAob25SRS50ZXN0KG5hbWUpKSB7XG4gICAgICAgICAgYXJnID0gbmFtZS5yZXBsYWNlKG9uUkUsICcnKTtcbiAgICAgICAgICBwdXNoRGlyKCdvbicsIGRpcmVjdGl2ZXMub24pO1xuICAgICAgICB9IGVsc2VcblxuICAgICAgICAgIC8vIGF0dHJpYnV0ZSBiaW5kaW5nc1xuICAgICAgICAgIGlmIChiaW5kUkUudGVzdChuYW1lKSkge1xuICAgICAgICAgICAgZGlyTmFtZSA9IG5hbWUucmVwbGFjZShiaW5kUkUsICcnKTtcbiAgICAgICAgICAgIGlmIChkaXJOYW1lID09PSAnc3R5bGUnIHx8IGRpck5hbWUgPT09ICdjbGFzcycpIHtcbiAgICAgICAgICAgICAgcHVzaERpcihkaXJOYW1lLCBpbnRlcm5hbERpcmVjdGl2ZXNbZGlyTmFtZV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgYXJnID0gZGlyTmFtZTtcbiAgICAgICAgICAgICAgcHVzaERpcignYmluZCcsIGRpcmVjdGl2ZXMuYmluZCk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBlbHNlXG5cbiAgICAgICAgICAgIC8vIG5vcm1hbCBkaXJlY3RpdmVzXG4gICAgICAgICAgICBpZiAobWF0Y2hlZCA9IG5hbWUubWF0Y2goZGlyQXR0clJFKSkge1xuICAgICAgICAgICAgICBkaXJOYW1lID0gbWF0Y2hlZFsxXTtcbiAgICAgICAgICAgICAgYXJnID0gbWF0Y2hlZFsyXTtcblxuICAgICAgICAgICAgICAvLyBza2lwIHYtZWxzZSAod2hlbiB1c2VkIHdpdGggdi1zaG93KVxuICAgICAgICAgICAgICBpZiAoZGlyTmFtZSA9PT0gJ2Vsc2UnKSB7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBkaXJEZWYgPSByZXNvbHZlQXNzZXQob3B0aW9ucywgJ2RpcmVjdGl2ZXMnLCBkaXJOYW1lLCB0cnVlKTtcbiAgICAgICAgICAgICAgaWYgKGRpckRlZikge1xuICAgICAgICAgICAgICAgIHB1c2hEaXIoZGlyTmFtZSwgZGlyRGVmKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFB1c2ggYSBkaXJlY3RpdmUuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBkaXJOYW1lXG4gICAqIEBwYXJhbSB7T2JqZWN0fEZ1bmN0aW9ufSBkZWZcbiAgICogQHBhcmFtIHtBcnJheX0gW2ludGVycFRva2Vuc11cbiAgICovXG5cbiAgZnVuY3Rpb24gcHVzaERpcihkaXJOYW1lLCBkZWYsIGludGVycFRva2Vucykge1xuICAgIHZhciBoYXNPbmVUaW1lVG9rZW4gPSBpbnRlcnBUb2tlbnMgJiYgaGFzT25lVGltZShpbnRlcnBUb2tlbnMpO1xuICAgIHZhciBwYXJzZWQgPSAhaGFzT25lVGltZVRva2VuICYmIHBhcnNlRGlyZWN0aXZlKHZhbHVlKTtcbiAgICBkaXJzLnB1c2goe1xuICAgICAgbmFtZTogZGlyTmFtZSxcbiAgICAgIGF0dHI6IHJhd05hbWUsXG4gICAgICByYXc6IHJhd1ZhbHVlLFxuICAgICAgZGVmOiBkZWYsXG4gICAgICBhcmc6IGFyZyxcbiAgICAgIG1vZGlmaWVyczogbW9kaWZpZXJzLFxuICAgICAgLy8gY29udmVyc2lvbiBmcm9tIGludGVycG9sYXRpb24gc3RyaW5ncyB3aXRoIG9uZS10aW1lIHRva2VuXG4gICAgICAvLyB0byBleHByZXNzaW9uIGlzIGRpZmZlcmVkIHVudGlsIGRpcmVjdGl2ZSBiaW5kIHRpbWUgc28gdGhhdCB3ZVxuICAgICAgLy8gaGF2ZSBhY2Nlc3MgdG8gdGhlIGFjdHVhbCB2bSBjb250ZXh0IGZvciBvbmUtdGltZSBiaW5kaW5ncy5cbiAgICAgIGV4cHJlc3Npb246IHBhcnNlZCAmJiBwYXJzZWQuZXhwcmVzc2lvbixcbiAgICAgIGZpbHRlcnM6IHBhcnNlZCAmJiBwYXJzZWQuZmlsdGVycyxcbiAgICAgIGludGVycDogaW50ZXJwVG9rZW5zLFxuICAgICAgaGFzT25lVGltZTogaGFzT25lVGltZVRva2VuXG4gICAgfSk7XG4gIH1cblxuICBpZiAoZGlycy5sZW5ndGgpIHtcbiAgICByZXR1cm4gbWFrZU5vZGVMaW5rRm4oZGlycyk7XG4gIH1cbn1cblxuLyoqXG4gKiBQYXJzZSBtb2RpZmllcnMgZnJvbSBkaXJlY3RpdmUgYXR0cmlidXRlIG5hbWUuXG4gKlxuICogQHBhcmFtIHtTdHJpbmd9IG5hbWVcbiAqIEByZXR1cm4ge09iamVjdH1cbiAqL1xuXG5mdW5jdGlvbiBwYXJzZU1vZGlmaWVycyhuYW1lKSB7XG4gIHZhciByZXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB2YXIgbWF0Y2ggPSBuYW1lLm1hdGNoKG1vZGlmaWVyUkUpO1xuICBpZiAobWF0Y2gpIHtcbiAgICB2YXIgaSA9IG1hdGNoLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICByZXNbbWF0Y2hbaV0uc2xpY2UoMSldID0gdHJ1ZTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIHJlcztcbn1cblxuLyoqXG4gKiBCdWlsZCBhIGxpbmsgZnVuY3Rpb24gZm9yIGFsbCBkaXJlY3RpdmVzIG9uIGEgc2luZ2xlIG5vZGUuXG4gKlxuICogQHBhcmFtIHtBcnJheX0gZGlyZWN0aXZlc1xuICogQHJldHVybiB7RnVuY3Rpb259IGRpcmVjdGl2ZXNMaW5rRm5cbiAqL1xuXG5mdW5jdGlvbiBtYWtlTm9kZUxpbmtGbihkaXJlY3RpdmVzKSB7XG4gIHJldHVybiBmdW5jdGlvbiBub2RlTGlua0ZuKHZtLCBlbCwgaG9zdCwgc2NvcGUsIGZyYWcpIHtcbiAgICAvLyByZXZlcnNlIGFwcGx5IGJlY2F1c2UgaXQncyBzb3J0ZWQgbG93IHRvIGhpZ2hcbiAgICB2YXIgaSA9IGRpcmVjdGl2ZXMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIHZtLl9iaW5kRGlyKGRpcmVjdGl2ZXNbaV0sIGVsLCBob3N0LCBzY29wZSwgZnJhZyk7XG4gICAgfVxuICB9O1xufVxuXG4vKipcbiAqIENoZWNrIGlmIGFuIGludGVycG9sYXRpb24gc3RyaW5nIGNvbnRhaW5zIG9uZS10aW1lIHRva2Vucy5cbiAqXG4gKiBAcGFyYW0ge0FycmF5fSB0b2tlbnNcbiAqIEByZXR1cm4ge0Jvb2xlYW59XG4gKi9cblxuZnVuY3Rpb24gaGFzT25lVGltZSh0b2tlbnMpIHtcbiAgdmFyIGkgPSB0b2tlbnMubGVuZ3RoO1xuICB3aGlsZSAoaS0tKSB7XG4gICAgaWYgKHRva2Vuc1tpXS5vbmVUaW1lKSByZXR1cm4gdHJ1ZTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpc1NjcmlwdChlbCkge1xuICByZXR1cm4gZWwudGFnTmFtZSA9PT0gJ1NDUklQVCcgJiYgKCFlbC5oYXNBdHRyaWJ1dGUoJ3R5cGUnKSB8fCBlbC5nZXRBdHRyaWJ1dGUoJ3R5cGUnKSA9PT0gJ3RleHQvamF2YXNjcmlwdCcpO1xufVxuXG52YXIgc3BlY2lhbENoYXJSRSA9IC9bXlxcd1xcLTpcXC5dLztcblxuLyoqXG4gKiBQcm9jZXNzIGFuIGVsZW1lbnQgb3IgYSBEb2N1bWVudEZyYWdtZW50IGJhc2VkIG9uIGFcbiAqIGluc3RhbmNlIG9wdGlvbiBvYmplY3QuIFRoaXMgYWxsb3dzIHVzIHRvIHRyYW5zY2x1ZGVcbiAqIGEgdGVtcGxhdGUgbm9kZS9mcmFnbWVudCBiZWZvcmUgdGhlIGluc3RhbmNlIGlzIGNyZWF0ZWQsXG4gKiBzbyB0aGUgcHJvY2Vzc2VkIGZyYWdtZW50IGNhbiB0aGVuIGJlIGNsb25lZCBhbmQgcmV1c2VkXG4gKiBpbiB2LWZvci5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0aW9uc1xuICogQHJldHVybiB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fVxuICovXG5cbmZ1bmN0aW9uIHRyYW5zY2x1ZGUoZWwsIG9wdGlvbnMpIHtcbiAgLy8gZXh0cmFjdCBjb250YWluZXIgYXR0cmlidXRlcyB0byBwYXNzIHRoZW0gZG93blxuICAvLyB0byBjb21waWxlciwgYmVjYXVzZSB0aGV5IG5lZWQgdG8gYmUgY29tcGlsZWQgaW5cbiAgLy8gcGFyZW50IHNjb3BlLiB3ZSBhcmUgbXV0YXRpbmcgdGhlIG9wdGlvbnMgb2JqZWN0IGhlcmVcbiAgLy8gYXNzdW1pbmcgdGhlIHNhbWUgb2JqZWN0IHdpbGwgYmUgdXNlZCBmb3IgY29tcGlsZVxuICAvLyByaWdodCBhZnRlciB0aGlzLlxuICBpZiAob3B0aW9ucykge1xuICAgIG9wdGlvbnMuX2NvbnRhaW5lckF0dHJzID0gZXh0cmFjdEF0dHJzKGVsKTtcbiAgfVxuICAvLyBmb3IgdGVtcGxhdGUgdGFncywgd2hhdCB3ZSB3YW50IGlzIGl0cyBjb250ZW50IGFzXG4gIC8vIGEgZG9jdW1lbnRGcmFnbWVudCAoZm9yIGZyYWdtZW50IGluc3RhbmNlcylcbiAgaWYgKGlzVGVtcGxhdGUoZWwpKSB7XG4gICAgZWwgPSBwYXJzZVRlbXBsYXRlKGVsKTtcbiAgfVxuICBpZiAob3B0aW9ucykge1xuICAgIGlmIChvcHRpb25zLl9hc0NvbXBvbmVudCAmJiAhb3B0aW9ucy50ZW1wbGF0ZSkge1xuICAgICAgb3B0aW9ucy50ZW1wbGF0ZSA9ICc8c2xvdD48L3Nsb3Q+JztcbiAgICB9XG4gICAgaWYgKG9wdGlvbnMudGVtcGxhdGUpIHtcbiAgICAgIG9wdGlvbnMuX2NvbnRlbnQgPSBleHRyYWN0Q29udGVudChlbCk7XG4gICAgICBlbCA9IHRyYW5zY2x1ZGVUZW1wbGF0ZShlbCwgb3B0aW9ucyk7XG4gICAgfVxuICB9XG4gIGlmIChpc0ZyYWdtZW50KGVsKSkge1xuICAgIC8vIGFuY2hvcnMgZm9yIGZyYWdtZW50IGluc3RhbmNlXG4gICAgLy8gcGFzc2luZyBpbiBgcGVyc2lzdDogdHJ1ZWAgdG8gYXZvaWQgdGhlbSBiZWluZ1xuICAgIC8vIGRpc2NhcmRlZCBieSBJRSBkdXJpbmcgdGVtcGxhdGUgY2xvbmluZ1xuICAgIHByZXBlbmQoY3JlYXRlQW5jaG9yKCd2LXN0YXJ0JywgdHJ1ZSksIGVsKTtcbiAgICBlbC5hcHBlbmRDaGlsZChjcmVhdGVBbmNob3IoJ3YtZW5kJywgdHJ1ZSkpO1xuICB9XG4gIHJldHVybiBlbDtcbn1cblxuLyoqXG4gKiBQcm9jZXNzIHRoZSB0ZW1wbGF0ZSBvcHRpb24uXG4gKiBJZiB0aGUgcmVwbGFjZSBvcHRpb24gaXMgdHJ1ZSB0aGlzIHdpbGwgc3dhcCB0aGUgJGVsLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAqIEBwYXJhbSB7T2JqZWN0fSBvcHRpb25zXG4gKiBAcmV0dXJuIHtFbGVtZW50fERvY3VtZW50RnJhZ21lbnR9XG4gKi9cblxuZnVuY3Rpb24gdHJhbnNjbHVkZVRlbXBsYXRlKGVsLCBvcHRpb25zKSB7XG4gIHZhciB0ZW1wbGF0ZSA9IG9wdGlvbnMudGVtcGxhdGU7XG4gIHZhciBmcmFnID0gcGFyc2VUZW1wbGF0ZSh0ZW1wbGF0ZSwgdHJ1ZSk7XG4gIGlmIChmcmFnKSB7XG4gICAgdmFyIHJlcGxhY2VyID0gZnJhZy5maXJzdENoaWxkO1xuICAgIHZhciB0YWcgPSByZXBsYWNlci50YWdOYW1lICYmIHJlcGxhY2VyLnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcbiAgICBpZiAob3B0aW9ucy5yZXBsYWNlKSB7XG4gICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgIGlmIChlbCA9PT0gZG9jdW1lbnQuYm9keSkge1xuICAgICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ1lvdSBhcmUgbW91bnRpbmcgYW4gaW5zdGFuY2Ugd2l0aCBhIHRlbXBsYXRlIHRvICcgKyAnPGJvZHk+LiBUaGlzIHdpbGwgcmVwbGFjZSA8Ym9keT4gZW50aXJlbHkuIFlvdSAnICsgJ3Nob3VsZCBwcm9iYWJseSB1c2UgYHJlcGxhY2U6IGZhbHNlYCBoZXJlLicpO1xuICAgICAgfVxuICAgICAgLy8gdGhlcmUgYXJlIG1hbnkgY2FzZXMgd2hlcmUgdGhlIGluc3RhbmNlIG11c3RcbiAgICAgIC8vIGJlY29tZSBhIGZyYWdtZW50IGluc3RhbmNlOiBiYXNpY2FsbHkgYW55dGhpbmcgdGhhdFxuICAgICAgLy8gY2FuIGNyZWF0ZSBtb3JlIHRoYW4gMSByb290IG5vZGVzLlxuICAgICAgaWYgKFxuICAgICAgLy8gbXVsdGktY2hpbGRyZW4gdGVtcGxhdGVcbiAgICAgIGZyYWcuY2hpbGROb2Rlcy5sZW5ndGggPiAxIHx8XG4gICAgICAvLyBub24tZWxlbWVudCB0ZW1wbGF0ZVxuICAgICAgcmVwbGFjZXIubm9kZVR5cGUgIT09IDEgfHxcbiAgICAgIC8vIHNpbmdsZSBuZXN0ZWQgY29tcG9uZW50XG4gICAgICB0YWcgPT09ICdjb21wb25lbnQnIHx8IHJlc29sdmVBc3NldChvcHRpb25zLCAnY29tcG9uZW50cycsIHRhZykgfHwgaGFzQmluZEF0dHIocmVwbGFjZXIsICdpcycpIHx8XG4gICAgICAvLyBlbGVtZW50IGRpcmVjdGl2ZVxuICAgICAgcmVzb2x2ZUFzc2V0KG9wdGlvbnMsICdlbGVtZW50RGlyZWN0aXZlcycsIHRhZykgfHxcbiAgICAgIC8vIGZvciBibG9ja1xuICAgICAgcmVwbGFjZXIuaGFzQXR0cmlidXRlKCd2LWZvcicpIHx8XG4gICAgICAvLyBpZiBibG9ja1xuICAgICAgcmVwbGFjZXIuaGFzQXR0cmlidXRlKCd2LWlmJykpIHtcbiAgICAgICAgcmV0dXJuIGZyYWc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBvcHRpb25zLl9yZXBsYWNlckF0dHJzID0gZXh0cmFjdEF0dHJzKHJlcGxhY2VyKTtcbiAgICAgICAgbWVyZ2VBdHRycyhlbCwgcmVwbGFjZXIpO1xuICAgICAgICByZXR1cm4gcmVwbGFjZXI7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGVsLmFwcGVuZENoaWxkKGZyYWcpO1xuICAgICAgcmV0dXJuIGVsO1xuICAgIH1cbiAgfSBlbHNlIHtcbiAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJ0ludmFsaWQgdGVtcGxhdGUgb3B0aW9uOiAnICsgdGVtcGxhdGUpO1xuICB9XG59XG5cbi8qKlxuICogSGVscGVyIHRvIGV4dHJhY3QgYSBjb21wb25lbnQgY29udGFpbmVyJ3MgYXR0cmlidXRlc1xuICogaW50byBhIHBsYWluIG9iamVjdCBhcnJheS5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGVsXG4gKiBAcmV0dXJuIHtBcnJheX1cbiAqL1xuXG5mdW5jdGlvbiBleHRyYWN0QXR0cnMoZWwpIHtcbiAgaWYgKGVsLm5vZGVUeXBlID09PSAxICYmIGVsLmhhc0F0dHJpYnV0ZXMoKSkge1xuICAgIHJldHVybiB0b0FycmF5KGVsLmF0dHJpYnV0ZXMpO1xuICB9XG59XG5cbi8qKlxuICogTWVyZ2UgdGhlIGF0dHJpYnV0ZXMgb2YgdHdvIGVsZW1lbnRzLCBhbmQgbWFrZSBzdXJlXG4gKiB0aGUgY2xhc3MgbmFtZXMgYXJlIG1lcmdlZCBwcm9wZXJseS5cbiAqXG4gKiBAcGFyYW0ge0VsZW1lbnR9IGZyb21cbiAqIEBwYXJhbSB7RWxlbWVudH0gdG9cbiAqL1xuXG5mdW5jdGlvbiBtZXJnZUF0dHJzKGZyb20sIHRvKSB7XG4gIHZhciBhdHRycyA9IGZyb20uYXR0cmlidXRlcztcbiAgdmFyIGkgPSBhdHRycy5sZW5ndGg7XG4gIHZhciBuYW1lLCB2YWx1ZTtcbiAgd2hpbGUgKGktLSkge1xuICAgIG5hbWUgPSBhdHRyc1tpXS5uYW1lO1xuICAgIHZhbHVlID0gYXR0cnNbaV0udmFsdWU7XG4gICAgaWYgKCF0by5oYXNBdHRyaWJ1dGUobmFtZSkgJiYgIXNwZWNpYWxDaGFyUkUudGVzdChuYW1lKSkge1xuICAgICAgdG8uc2V0QXR0cmlidXRlKG5hbWUsIHZhbHVlKTtcbiAgICB9IGVsc2UgaWYgKG5hbWUgPT09ICdjbGFzcycgJiYgIXBhcnNlVGV4dCh2YWx1ZSkgJiYgKHZhbHVlID0gdmFsdWUudHJpbSgpKSkge1xuICAgICAgdmFsdWUuc3BsaXQoL1xccysvKS5mb3JFYWNoKGZ1bmN0aW9uIChjbHMpIHtcbiAgICAgICAgYWRkQ2xhc3ModG8sIGNscyk7XG4gICAgICB9KTtcbiAgICB9XG4gIH1cbn1cblxuLyoqXG4gKiBTY2FuIGFuZCBkZXRlcm1pbmUgc2xvdCBjb250ZW50IGRpc3RyaWJ1dGlvbi5cbiAqIFdlIGRvIHRoaXMgZHVyaW5nIHRyYW5zY2x1c2lvbiBpbnN0ZWFkIGF0IGNvbXBpbGUgdGltZSBzbyB0aGF0XG4gKiB0aGUgZGlzdHJpYnV0aW9uIGlzIGRlY291cGxlZCBmcm9tIHRoZSBjb21waWxhdGlvbiBvcmRlciBvZlxuICogdGhlIHNsb3RzLlxuICpcbiAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fSB0ZW1wbGF0ZVxuICogQHBhcmFtIHtFbGVtZW50fSBjb250ZW50XG4gKiBAcGFyYW0ge1Z1ZX0gdm1cbiAqL1xuXG5mdW5jdGlvbiByZXNvbHZlU2xvdHModm0sIGNvbnRlbnQpIHtcbiAgaWYgKCFjb250ZW50KSB7XG4gICAgcmV0dXJuO1xuICB9XG4gIHZhciBjb250ZW50cyA9IHZtLl9zbG90Q29udGVudHMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB2YXIgZWwsIG5hbWU7XG4gIGZvciAodmFyIGkgPSAwLCBsID0gY29udGVudC5jaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBlbCA9IGNvbnRlbnQuY2hpbGRyZW5baV07XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tY29uZC1hc3NpZ24gKi9cbiAgICBpZiAobmFtZSA9IGVsLmdldEF0dHJpYnV0ZSgnc2xvdCcpKSB7XG4gICAgICAoY29udGVudHNbbmFtZV0gfHwgKGNvbnRlbnRzW25hbWVdID0gW10pKS5wdXNoKGVsKTtcbiAgICB9XG4gICAgLyogZXNsaW50LWVuYWJsZSBuby1jb25kLWFzc2lnbiAqL1xuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIGdldEJpbmRBdHRyKGVsLCAnc2xvdCcpKSB7XG4gICAgICB3YXJuKCdUaGUgXCJzbG90XCIgYXR0cmlidXRlIG11c3QgYmUgc3RhdGljLicsIHZtLiRwYXJlbnQpO1xuICAgIH1cbiAgfVxuICBmb3IgKG5hbWUgaW4gY29udGVudHMpIHtcbiAgICBjb250ZW50c1tuYW1lXSA9IGV4dHJhY3RGcmFnbWVudChjb250ZW50c1tuYW1lXSwgY29udGVudCk7XG4gIH1cbiAgaWYgKGNvbnRlbnQuaGFzQ2hpbGROb2RlcygpKSB7XG4gICAgdmFyIG5vZGVzID0gY29udGVudC5jaGlsZE5vZGVzO1xuICAgIGlmIChub2Rlcy5sZW5ndGggPT09IDEgJiYgbm9kZXNbMF0ubm9kZVR5cGUgPT09IDMgJiYgIW5vZGVzWzBdLmRhdGEudHJpbSgpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIGNvbnRlbnRzWydkZWZhdWx0J10gPSBleHRyYWN0RnJhZ21lbnQoY29udGVudC5jaGlsZE5vZGVzLCBjb250ZW50KTtcbiAgfVxufVxuXG4vKipcbiAqIEV4dHJhY3QgcXVhbGlmaWVkIGNvbnRlbnQgbm9kZXMgZnJvbSBhIG5vZGUgbGlzdC5cbiAqXG4gKiBAcGFyYW0ge05vZGVMaXN0fSBub2Rlc1xuICogQHJldHVybiB7RG9jdW1lbnRGcmFnbWVudH1cbiAqL1xuXG5mdW5jdGlvbiBleHRyYWN0RnJhZ21lbnQobm9kZXMsIHBhcmVudCkge1xuICB2YXIgZnJhZyA9IGRvY3VtZW50LmNyZWF0ZURvY3VtZW50RnJhZ21lbnQoKTtcbiAgbm9kZXMgPSB0b0FycmF5KG5vZGVzKTtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBub2Rlcy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICB2YXIgbm9kZSA9IG5vZGVzW2ldO1xuICAgIGlmIChpc1RlbXBsYXRlKG5vZGUpICYmICFub2RlLmhhc0F0dHJpYnV0ZSgndi1pZicpICYmICFub2RlLmhhc0F0dHJpYnV0ZSgndi1mb3InKSkge1xuICAgICAgcGFyZW50LnJlbW92ZUNoaWxkKG5vZGUpO1xuICAgICAgbm9kZSA9IHBhcnNlVGVtcGxhdGUobm9kZSwgdHJ1ZSk7XG4gICAgfVxuICAgIGZyYWcuYXBwZW5kQ2hpbGQobm9kZSk7XG4gIH1cbiAgcmV0dXJuIGZyYWc7XG59XG5cblxuXG52YXIgY29tcGlsZXIgPSBPYmplY3QuZnJlZXplKHtcblx0Y29tcGlsZTogY29tcGlsZSxcblx0Y29tcGlsZUFuZExpbmtQcm9wczogY29tcGlsZUFuZExpbmtQcm9wcyxcblx0Y29tcGlsZVJvb3Q6IGNvbXBpbGVSb290LFxuXHR0cmFuc2NsdWRlOiB0cmFuc2NsdWRlLFxuXHRyZXNvbHZlU2xvdHM6IHJlc29sdmVTbG90c1xufSk7XG5cbmZ1bmN0aW9uIHN0YXRlTWl4aW4gKFZ1ZSkge1xuICAvKipcbiAgICogQWNjZXNzb3IgZm9yIGAkZGF0YWAgcHJvcGVydHksIHNpbmNlIHNldHRpbmcgJGRhdGFcbiAgICogcmVxdWlyZXMgb2JzZXJ2aW5nIHRoZSBuZXcgb2JqZWN0IGFuZCB1cGRhdGluZ1xuICAgKiBwcm94aWVkIHByb3BlcnRpZXMuXG4gICAqL1xuXG4gIE9iamVjdC5kZWZpbmVQcm9wZXJ0eShWdWUucHJvdG90eXBlLCAnJGRhdGEnLCB7XG4gICAgZ2V0OiBmdW5jdGlvbiBnZXQoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fZGF0YTtcbiAgICB9LFxuICAgIHNldDogZnVuY3Rpb24gc2V0KG5ld0RhdGEpIHtcbiAgICAgIGlmIChuZXdEYXRhICE9PSB0aGlzLl9kYXRhKSB7XG4gICAgICAgIHRoaXMuX3NldERhdGEobmV3RGF0YSk7XG4gICAgICB9XG4gICAgfVxuICB9KTtcblxuICAvKipcbiAgICogU2V0dXAgdGhlIHNjb3BlIG9mIGFuIGluc3RhbmNlLCB3aGljaCBjb250YWluczpcbiAgICogLSBvYnNlcnZlZCBkYXRhXG4gICAqIC0gY29tcHV0ZWQgcHJvcGVydGllc1xuICAgKiAtIHVzZXIgbWV0aG9kc1xuICAgKiAtIG1ldGEgcHJvcGVydGllc1xuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9pbml0U3RhdGUgPSBmdW5jdGlvbiAoKSB7XG4gICAgdGhpcy5faW5pdFByb3BzKCk7XG4gICAgdGhpcy5faW5pdE1ldGEoKTtcbiAgICB0aGlzLl9pbml0TWV0aG9kcygpO1xuICAgIHRoaXMuX2luaXREYXRhKCk7XG4gICAgdGhpcy5faW5pdENvbXB1dGVkKCk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgcHJvcHMuXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2luaXRQcm9wcyA9IGZ1bmN0aW9uICgpIHtcbiAgICB2YXIgb3B0aW9ucyA9IHRoaXMuJG9wdGlvbnM7XG4gICAgdmFyIGVsID0gb3B0aW9ucy5lbDtcbiAgICB2YXIgcHJvcHMgPSBvcHRpb25zLnByb3BzO1xuICAgIGlmIChwcm9wcyAmJiAhZWwpIHtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignUHJvcHMgd2lsbCBub3QgYmUgY29tcGlsZWQgaWYgbm8gYGVsYCBvcHRpb24gaXMgJyArICdwcm92aWRlZCBhdCBpbnN0YW50aWF0aW9uLicsIHRoaXMpO1xuICAgIH1cbiAgICAvLyBtYWtlIHN1cmUgdG8gY29udmVydCBzdHJpbmcgc2VsZWN0b3JzIGludG8gZWxlbWVudCBub3dcbiAgICBlbCA9IG9wdGlvbnMuZWwgPSBxdWVyeShlbCk7XG4gICAgdGhpcy5fcHJvcHNVbmxpbmtGbiA9IGVsICYmIGVsLm5vZGVUeXBlID09PSAxICYmIHByb3BzXG4gICAgLy8gcHJvcHMgbXVzdCBiZSBsaW5rZWQgaW4gcHJvcGVyIHNjb3BlIGlmIGluc2lkZSB2LWZvclxuICAgID8gY29tcGlsZUFuZExpbmtQcm9wcyh0aGlzLCBlbCwgcHJvcHMsIHRoaXMuX3Njb3BlKSA6IG51bGw7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgdGhlIGRhdGEuXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2luaXREYXRhID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBkYXRhRm4gPSB0aGlzLiRvcHRpb25zLmRhdGE7XG4gICAgdmFyIGRhdGEgPSB0aGlzLl9kYXRhID0gZGF0YUZuID8gZGF0YUZuKCkgOiB7fTtcbiAgICBpZiAoIWlzUGxhaW5PYmplY3QoZGF0YSkpIHtcbiAgICAgIGRhdGEgPSB7fTtcbiAgICAgIHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicgJiYgd2FybignZGF0YSBmdW5jdGlvbnMgc2hvdWxkIHJldHVybiBhbiBvYmplY3QuJywgdGhpcyk7XG4gICAgfVxuICAgIHZhciBwcm9wcyA9IHRoaXMuX3Byb3BzO1xuICAgIC8vIHByb3h5IGRhdGEgb24gaW5zdGFuY2VcbiAgICB2YXIga2V5cyA9IE9iamVjdC5rZXlzKGRhdGEpO1xuICAgIHZhciBpLCBrZXk7XG4gICAgaSA9IGtleXMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGtleSA9IGtleXNbaV07XG4gICAgICAvLyB0aGVyZSBhcmUgdHdvIHNjZW5hcmlvcyB3aGVyZSB3ZSBjYW4gcHJveHkgYSBkYXRhIGtleTpcbiAgICAgIC8vIDEuIGl0J3Mgbm90IGFscmVhZHkgZGVmaW5lZCBhcyBhIHByb3BcbiAgICAgIC8vIDIuIGl0J3MgcHJvdmlkZWQgdmlhIGEgaW5zdGFudGlhdGlvbiBvcHRpb24gQU5EIHRoZXJlIGFyZSBub1xuICAgICAgLy8gICAgdGVtcGxhdGUgcHJvcCBwcmVzZW50XG4gICAgICBpZiAoIXByb3BzIHx8ICFoYXNPd24ocHJvcHMsIGtleSkpIHtcbiAgICAgICAgdGhpcy5fcHJveHkoa2V5KTtcbiAgICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgICB3YXJuKCdEYXRhIGZpZWxkIFwiJyArIGtleSArICdcIiBpcyBhbHJlYWR5IGRlZmluZWQgJyArICdhcyBhIHByb3AuIFRvIHByb3ZpZGUgZGVmYXVsdCB2YWx1ZSBmb3IgYSBwcm9wLCB1c2UgdGhlIFwiZGVmYXVsdFwiICcgKyAncHJvcCBvcHRpb247IGlmIHlvdSB3YW50IHRvIHBhc3MgcHJvcCB2YWx1ZXMgdG8gYW4gaW5zdGFudGlhdGlvbiAnICsgJ2NhbGwsIHVzZSB0aGUgXCJwcm9wc0RhdGFcIiBvcHRpb24uJywgdGhpcyk7XG4gICAgICB9XG4gICAgfVxuICAgIC8vIG9ic2VydmUgZGF0YVxuICAgIG9ic2VydmUoZGF0YSwgdGhpcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFN3YXAgdGhlIGluc3RhbmNlJ3MgJGRhdGEuIENhbGxlZCBpbiAkZGF0YSdzIHNldHRlci5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IG5ld0RhdGFcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5fc2V0RGF0YSA9IGZ1bmN0aW9uIChuZXdEYXRhKSB7XG4gICAgbmV3RGF0YSA9IG5ld0RhdGEgfHwge307XG4gICAgdmFyIG9sZERhdGEgPSB0aGlzLl9kYXRhO1xuICAgIHRoaXMuX2RhdGEgPSBuZXdEYXRhO1xuICAgIHZhciBrZXlzLCBrZXksIGk7XG4gICAgLy8gdW5wcm94eSBrZXlzIG5vdCBwcmVzZW50IGluIG5ldyBkYXRhXG4gICAga2V5cyA9IE9iamVjdC5rZXlzKG9sZERhdGEpO1xuICAgIGkgPSBrZXlzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBrZXkgPSBrZXlzW2ldO1xuICAgICAgaWYgKCEoa2V5IGluIG5ld0RhdGEpKSB7XG4gICAgICAgIHRoaXMuX3VucHJveHkoa2V5KTtcbiAgICAgIH1cbiAgICB9XG4gICAgLy8gcHJveHkga2V5cyBub3QgYWxyZWFkeSBwcm94aWVkLFxuICAgIC8vIGFuZCB0cmlnZ2VyIGNoYW5nZSBmb3IgY2hhbmdlZCB2YWx1ZXNcbiAgICBrZXlzID0gT2JqZWN0LmtleXMobmV3RGF0YSk7XG4gICAgaSA9IGtleXMubGVuZ3RoO1xuICAgIHdoaWxlIChpLS0pIHtcbiAgICAgIGtleSA9IGtleXNbaV07XG4gICAgICBpZiAoIWhhc093bih0aGlzLCBrZXkpKSB7XG4gICAgICAgIC8vIG5ldyBwcm9wZXJ0eVxuICAgICAgICB0aGlzLl9wcm94eShrZXkpO1xuICAgICAgfVxuICAgIH1cbiAgICBvbGREYXRhLl9fb2JfXy5yZW1vdmVWbSh0aGlzKTtcbiAgICBvYnNlcnZlKG5ld0RhdGEsIHRoaXMpO1xuICAgIHRoaXMuX2RpZ2VzdCgpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBQcm94eSBhIHByb3BlcnR5LCBzbyB0aGF0XG4gICAqIHZtLnByb3AgPT09IHZtLl9kYXRhLnByb3BcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9wcm94eSA9IGZ1bmN0aW9uIChrZXkpIHtcbiAgICBpZiAoIWlzUmVzZXJ2ZWQoa2V5KSkge1xuICAgICAgLy8gbmVlZCB0byBzdG9yZSByZWYgdG8gc2VsZiBoZXJlXG4gICAgICAvLyBiZWNhdXNlIHRoZXNlIGdldHRlci9zZXR0ZXJzIG1pZ2h0XG4gICAgICAvLyBiZSBjYWxsZWQgYnkgY2hpbGQgc2NvcGVzIHZpYVxuICAgICAgLy8gcHJvdG90eXBlIGluaGVyaXRhbmNlLlxuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgT2JqZWN0LmRlZmluZVByb3BlcnR5KHNlbGYsIGtleSwge1xuICAgICAgICBjb25maWd1cmFibGU6IHRydWUsXG4gICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgIGdldDogZnVuY3Rpb24gcHJveHlHZXR0ZXIoKSB7XG4gICAgICAgICAgcmV0dXJuIHNlbGYuX2RhdGFba2V5XTtcbiAgICAgICAgfSxcbiAgICAgICAgc2V0OiBmdW5jdGlvbiBwcm94eVNldHRlcih2YWwpIHtcbiAgICAgICAgICBzZWxmLl9kYXRhW2tleV0gPSB2YWw7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogVW5wcm94eSBhIHByb3BlcnR5LlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30ga2V5XG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX3VucHJveHkgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgaWYgKCFpc1Jlc2VydmVkKGtleSkpIHtcbiAgICAgIGRlbGV0ZSB0aGlzW2tleV07XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBGb3JjZSB1cGRhdGUgb24gZXZlcnkgd2F0Y2hlciBpbiBzY29wZS5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5fZGlnZXN0ID0gZnVuY3Rpb24gKCkge1xuICAgIGZvciAodmFyIGkgPSAwLCBsID0gdGhpcy5fd2F0Y2hlcnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICB0aGlzLl93YXRjaGVyc1tpXS51cGRhdGUodHJ1ZSk7IC8vIHNoYWxsb3cgdXBkYXRlc1xuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogU2V0dXAgY29tcHV0ZWQgcHJvcGVydGllcy4gVGhleSBhcmUgZXNzZW50aWFsbHlcbiAgICogc3BlY2lhbCBnZXR0ZXIvc2V0dGVyc1xuICAgKi9cblxuICBmdW5jdGlvbiBub29wKCkge31cbiAgVnVlLnByb3RvdHlwZS5faW5pdENvbXB1dGVkID0gZnVuY3Rpb24gKCkge1xuICAgIHZhciBjb21wdXRlZCA9IHRoaXMuJG9wdGlvbnMuY29tcHV0ZWQ7XG4gICAgaWYgKGNvbXB1dGVkKSB7XG4gICAgICBmb3IgKHZhciBrZXkgaW4gY29tcHV0ZWQpIHtcbiAgICAgICAgdmFyIHVzZXJEZWYgPSBjb21wdXRlZFtrZXldO1xuICAgICAgICB2YXIgZGVmID0ge1xuICAgICAgICAgIGVudW1lcmFibGU6IHRydWUsXG4gICAgICAgICAgY29uZmlndXJhYmxlOiB0cnVlXG4gICAgICAgIH07XG4gICAgICAgIGlmICh0eXBlb2YgdXNlckRlZiA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgIGRlZi5nZXQgPSBtYWtlQ29tcHV0ZWRHZXR0ZXIodXNlckRlZiwgdGhpcyk7XG4gICAgICAgICAgZGVmLnNldCA9IG5vb3A7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZGVmLmdldCA9IHVzZXJEZWYuZ2V0ID8gdXNlckRlZi5jYWNoZSAhPT0gZmFsc2UgPyBtYWtlQ29tcHV0ZWRHZXR0ZXIodXNlckRlZi5nZXQsIHRoaXMpIDogYmluZCh1c2VyRGVmLmdldCwgdGhpcykgOiBub29wO1xuICAgICAgICAgIGRlZi5zZXQgPSB1c2VyRGVmLnNldCA/IGJpbmQodXNlckRlZi5zZXQsIHRoaXMpIDogbm9vcDtcbiAgICAgICAgfVxuICAgICAgICBPYmplY3QuZGVmaW5lUHJvcGVydHkodGhpcywga2V5LCBkZWYpO1xuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICBmdW5jdGlvbiBtYWtlQ29tcHV0ZWRHZXR0ZXIoZ2V0dGVyLCBvd25lcikge1xuICAgIHZhciB3YXRjaGVyID0gbmV3IFdhdGNoZXIob3duZXIsIGdldHRlciwgbnVsbCwge1xuICAgICAgbGF6eTogdHJ1ZVxuICAgIH0pO1xuICAgIHJldHVybiBmdW5jdGlvbiBjb21wdXRlZEdldHRlcigpIHtcbiAgICAgIGlmICh3YXRjaGVyLmRpcnR5KSB7XG4gICAgICAgIHdhdGNoZXIuZXZhbHVhdGUoKTtcbiAgICAgIH1cbiAgICAgIGlmIChEZXAudGFyZ2V0KSB7XG4gICAgICAgIHdhdGNoZXIuZGVwZW5kKCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gd2F0Y2hlci52YWx1ZTtcbiAgICB9O1xuICB9XG5cbiAgLyoqXG4gICAqIFNldHVwIGluc3RhbmNlIG1ldGhvZHMuIE1ldGhvZHMgbXVzdCBiZSBib3VuZCB0byB0aGVcbiAgICogaW5zdGFuY2Ugc2luY2UgdGhleSBtaWdodCBiZSBwYXNzZWQgZG93biBhcyBhIHByb3AgdG9cbiAgICogY2hpbGQgY29tcG9uZW50cy5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5faW5pdE1ldGhvZHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG1ldGhvZHMgPSB0aGlzLiRvcHRpb25zLm1ldGhvZHM7XG4gICAgaWYgKG1ldGhvZHMpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBtZXRob2RzKSB7XG4gICAgICAgIHRoaXNba2V5XSA9IGJpbmQobWV0aG9kc1trZXldLCB0aGlzKTtcbiAgICAgIH1cbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEluaXRpYWxpemUgbWV0YSBpbmZvcm1hdGlvbiBsaWtlICRpbmRleCwgJGtleSAmICR2YWx1ZS5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5faW5pdE1ldGEgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG1ldGFzID0gdGhpcy4kb3B0aW9ucy5fbWV0YTtcbiAgICBpZiAobWV0YXMpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBtZXRhcykge1xuICAgICAgICBkZWZpbmVSZWFjdGl2ZSh0aGlzLCBrZXksIG1ldGFzW2tleV0pO1xuICAgICAgfVxuICAgIH1cbiAgfTtcbn1cblxudmFyIGV2ZW50UkUgPSAvXnYtb246fF5ALztcblxuZnVuY3Rpb24gZXZlbnRzTWl4aW4gKFZ1ZSkge1xuICAvKipcbiAgICogU2V0dXAgdGhlIGluc3RhbmNlJ3Mgb3B0aW9uIGV2ZW50cyAmIHdhdGNoZXJzLlxuICAgKiBJZiB0aGUgdmFsdWUgaXMgYSBzdHJpbmcsIHdlIHB1bGwgaXQgZnJvbSB0aGVcbiAgICogaW5zdGFuY2UncyBtZXRob2RzIGJ5IG5hbWUuXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2luaXRFdmVudHMgPSBmdW5jdGlvbiAoKSB7XG4gICAgdmFyIG9wdGlvbnMgPSB0aGlzLiRvcHRpb25zO1xuICAgIGlmIChvcHRpb25zLl9hc0NvbXBvbmVudCkge1xuICAgICAgcmVnaXN0ZXJDb21wb25lbnRFdmVudHModGhpcywgb3B0aW9ucy5lbCk7XG4gICAgfVxuICAgIHJlZ2lzdGVyQ2FsbGJhY2tzKHRoaXMsICckb24nLCBvcHRpb25zLmV2ZW50cyk7XG4gICAgcmVnaXN0ZXJDYWxsYmFja3ModGhpcywgJyR3YXRjaCcsIG9wdGlvbnMud2F0Y2gpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZWdpc3RlciB2LW9uIGV2ZW50cyBvbiBhIGNoaWxkIGNvbXBvbmVudFxuICAgKlxuICAgKiBAcGFyYW0ge1Z1ZX0gdm1cbiAgICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICAgKi9cblxuICBmdW5jdGlvbiByZWdpc3RlckNvbXBvbmVudEV2ZW50cyh2bSwgZWwpIHtcbiAgICB2YXIgYXR0cnMgPSBlbC5hdHRyaWJ1dGVzO1xuICAgIHZhciBuYW1lLCB2YWx1ZSwgaGFuZGxlcjtcbiAgICBmb3IgKHZhciBpID0gMCwgbCA9IGF0dHJzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgbmFtZSA9IGF0dHJzW2ldLm5hbWU7XG4gICAgICBpZiAoZXZlbnRSRS50ZXN0KG5hbWUpKSB7XG4gICAgICAgIG5hbWUgPSBuYW1lLnJlcGxhY2UoZXZlbnRSRSwgJycpO1xuICAgICAgICAvLyBmb3JjZSB0aGUgZXhwcmVzc2lvbiBpbnRvIGEgc3RhdGVtZW50IHNvIHRoYXRcbiAgICAgICAgLy8gaXQgYWx3YXlzIGR5bmFtaWNhbGx5IHJlc29sdmVzIHRoZSBtZXRob2QgdG8gY2FsbCAoIzI2NzApXG4gICAgICAgIC8vIGtpbmRhIHVnbHkgaGFjaywgYnV0IGRvZXMgdGhlIGpvYi5cbiAgICAgICAgdmFsdWUgPSBhdHRyc1tpXS52YWx1ZTtcbiAgICAgICAgaWYgKGlzU2ltcGxlUGF0aCh2YWx1ZSkpIHtcbiAgICAgICAgICB2YWx1ZSArPSAnLmFwcGx5KHRoaXMsICRhcmd1bWVudHMpJztcbiAgICAgICAgfVxuICAgICAgICBoYW5kbGVyID0gKHZtLl9zY29wZSB8fCB2bS5fY29udGV4dCkuJGV2YWwodmFsdWUsIHRydWUpO1xuICAgICAgICBoYW5kbGVyLl9mcm9tUGFyZW50ID0gdHJ1ZTtcbiAgICAgICAgdm0uJG9uKG5hbWUucmVwbGFjZShldmVudFJFKSwgaGFuZGxlcik7XG4gICAgICB9XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJlZ2lzdGVyIGNhbGxiYWNrcyBmb3Igb3B0aW9uIGV2ZW50cyBhbmQgd2F0Y2hlcnMuXG4gICAqXG4gICAqIEBwYXJhbSB7VnVlfSB2bVxuICAgKiBAcGFyYW0ge1N0cmluZ30gYWN0aW9uXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBoYXNoXG4gICAqL1xuXG4gIGZ1bmN0aW9uIHJlZ2lzdGVyQ2FsbGJhY2tzKHZtLCBhY3Rpb24sIGhhc2gpIHtcbiAgICBpZiAoIWhhc2gpIHJldHVybjtcbiAgICB2YXIgaGFuZGxlcnMsIGtleSwgaSwgajtcbiAgICBmb3IgKGtleSBpbiBoYXNoKSB7XG4gICAgICBoYW5kbGVycyA9IGhhc2hba2V5XTtcbiAgICAgIGlmIChpc0FycmF5KGhhbmRsZXJzKSkge1xuICAgICAgICBmb3IgKGkgPSAwLCBqID0gaGFuZGxlcnMubGVuZ3RoOyBpIDwgajsgaSsrKSB7XG4gICAgICAgICAgcmVnaXN0ZXIodm0sIGFjdGlvbiwga2V5LCBoYW5kbGVyc1tpXSk7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlZ2lzdGVyKHZtLCBhY3Rpb24sIGtleSwgaGFuZGxlcnMpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBIZWxwZXIgdG8gcmVnaXN0ZXIgYW4gZXZlbnQvd2F0Y2ggY2FsbGJhY2suXG4gICAqXG4gICAqIEBwYXJhbSB7VnVlfSB2bVxuICAgKiBAcGFyYW0ge1N0cmluZ30gYWN0aW9uXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAgICogQHBhcmFtIHtGdW5jdGlvbnxTdHJpbmd8T2JqZWN0fSBoYW5kbGVyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBbb3B0aW9uc11cbiAgICovXG5cbiAgZnVuY3Rpb24gcmVnaXN0ZXIodm0sIGFjdGlvbiwga2V5LCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgdmFyIHR5cGUgPSB0eXBlb2YgaGFuZGxlcjtcbiAgICBpZiAodHlwZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdm1bYWN0aW9uXShrZXksIGhhbmRsZXIsIG9wdGlvbnMpO1xuICAgIH0gZWxzZSBpZiAodHlwZSA9PT0gJ3N0cmluZycpIHtcbiAgICAgIHZhciBtZXRob2RzID0gdm0uJG9wdGlvbnMubWV0aG9kcztcbiAgICAgIHZhciBtZXRob2QgPSBtZXRob2RzICYmIG1ldGhvZHNbaGFuZGxlcl07XG4gICAgICBpZiAobWV0aG9kKSB7XG4gICAgICAgIHZtW2FjdGlvbl0oa2V5LCBtZXRob2QsIG9wdGlvbnMpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdVbmtub3duIG1ldGhvZDogXCInICsgaGFuZGxlciArICdcIiB3aGVuICcgKyAncmVnaXN0ZXJpbmcgY2FsbGJhY2sgZm9yICcgKyBhY3Rpb24gKyAnOiBcIicgKyBrZXkgKyAnXCIuJywgdm0pO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoaGFuZGxlciAmJiB0eXBlID09PSAnb2JqZWN0Jykge1xuICAgICAgcmVnaXN0ZXIodm0sIGFjdGlvbiwga2V5LCBoYW5kbGVyLmhhbmRsZXIsIGhhbmRsZXIpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBTZXR1cCByZWN1cnNpdmUgYXR0YWNoZWQvZGV0YWNoZWQgY2FsbHNcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5faW5pdERPTUhvb2tzID0gZnVuY3Rpb24gKCkge1xuICAgIHRoaXMuJG9uKCdob29rOmF0dGFjaGVkJywgb25BdHRhY2hlZCk7XG4gICAgdGhpcy4kb24oJ2hvb2s6ZGV0YWNoZWQnLCBvbkRldGFjaGVkKTtcbiAgfTtcblxuICAvKipcbiAgICogQ2FsbGJhY2sgdG8gcmVjdXJzaXZlbHkgY2FsbCBhdHRhY2hlZCBob29rIG9uIGNoaWxkcmVuXG4gICAqL1xuXG4gIGZ1bmN0aW9uIG9uQXR0YWNoZWQoKSB7XG4gICAgaWYgKCF0aGlzLl9pc0F0dGFjaGVkKSB7XG4gICAgICB0aGlzLl9pc0F0dGFjaGVkID0gdHJ1ZTtcbiAgICAgIHRoaXMuJGNoaWxkcmVuLmZvckVhY2goY2FsbEF0dGFjaCk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEl0ZXJhdG9yIHRvIGNhbGwgYXR0YWNoZWQgaG9va1xuICAgKlxuICAgKiBAcGFyYW0ge1Z1ZX0gY2hpbGRcbiAgICovXG5cbiAgZnVuY3Rpb24gY2FsbEF0dGFjaChjaGlsZCkge1xuICAgIGlmICghY2hpbGQuX2lzQXR0YWNoZWQgJiYgaW5Eb2MoY2hpbGQuJGVsKSkge1xuICAgICAgY2hpbGQuX2NhbGxIb29rKCdhdHRhY2hlZCcpO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB0byByZWN1cnNpdmVseSBjYWxsIGRldGFjaGVkIGhvb2sgb24gY2hpbGRyZW5cbiAgICovXG5cbiAgZnVuY3Rpb24gb25EZXRhY2hlZCgpIHtcbiAgICBpZiAodGhpcy5faXNBdHRhY2hlZCkge1xuICAgICAgdGhpcy5faXNBdHRhY2hlZCA9IGZhbHNlO1xuICAgICAgdGhpcy4kY2hpbGRyZW4uZm9yRWFjaChjYWxsRGV0YWNoKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSXRlcmF0b3IgdG8gY2FsbCBkZXRhY2hlZCBob29rXG4gICAqXG4gICAqIEBwYXJhbSB7VnVlfSBjaGlsZFxuICAgKi9cblxuICBmdW5jdGlvbiBjYWxsRGV0YWNoKGNoaWxkKSB7XG4gICAgaWYgKGNoaWxkLl9pc0F0dGFjaGVkICYmICFpbkRvYyhjaGlsZC4kZWwpKSB7XG4gICAgICBjaGlsZC5fY2FsbEhvb2soJ2RldGFjaGVkJyk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFRyaWdnZXIgYWxsIGhhbmRsZXJzIGZvciBhIGhvb2tcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGhvb2tcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5fY2FsbEhvb2sgPSBmdW5jdGlvbiAoaG9vaykge1xuICAgIHRoaXMuJGVtaXQoJ3ByZS1ob29rOicgKyBob29rKTtcbiAgICB2YXIgaGFuZGxlcnMgPSB0aGlzLiRvcHRpb25zW2hvb2tdO1xuICAgIGlmIChoYW5kbGVycykge1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGogPSBoYW5kbGVycy5sZW5ndGg7IGkgPCBqOyBpKyspIHtcbiAgICAgICAgaGFuZGxlcnNbaV0uY2FsbCh0aGlzKTtcbiAgICAgIH1cbiAgICB9XG4gICAgdGhpcy4kZW1pdCgnaG9vazonICsgaG9vayk7XG4gIH07XG59XG5cbmZ1bmN0aW9uIG5vb3AoKSB7fVxuXG4vKipcbiAqIEEgZGlyZWN0aXZlIGxpbmtzIGEgRE9NIGVsZW1lbnQgd2l0aCBhIHBpZWNlIG9mIGRhdGEsXG4gKiB3aGljaCBpcyB0aGUgcmVzdWx0IG9mIGV2YWx1YXRpbmcgYW4gZXhwcmVzc2lvbi5cbiAqIEl0IHJlZ2lzdGVycyBhIHdhdGNoZXIgd2l0aCB0aGUgZXhwcmVzc2lvbiBhbmQgY2FsbHNcbiAqIHRoZSBET00gdXBkYXRlIGZ1bmN0aW9uIHdoZW4gYSBjaGFuZ2UgaXMgdHJpZ2dlcmVkLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjcmlwdG9yXG4gKiAgICAgICAgICAgICAgICAgLSB7U3RyaW5nfSBuYW1lXG4gKiAgICAgICAgICAgICAgICAgLSB7T2JqZWN0fSBkZWZcbiAqICAgICAgICAgICAgICAgICAtIHtTdHJpbmd9IGV4cHJlc3Npb25cbiAqICAgICAgICAgICAgICAgICAtIHtBcnJheTxPYmplY3Q+fSBbZmlsdGVyc11cbiAqICAgICAgICAgICAgICAgICAtIHtPYmplY3R9IFttb2RpZmllcnNdXG4gKiAgICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gbGl0ZXJhbFxuICogICAgICAgICAgICAgICAgIC0ge1N0cmluZ30gYXR0clxuICogICAgICAgICAgICAgICAgIC0ge1N0cmluZ30gYXJnXG4gKiAgICAgICAgICAgICAgICAgLSB7U3RyaW5nfSByYXdcbiAqICAgICAgICAgICAgICAgICAtIHtTdHJpbmd9IFtyZWZdXG4gKiAgICAgICAgICAgICAgICAgLSB7QXJyYXk8T2JqZWN0Pn0gW2ludGVycF1cbiAqICAgICAgICAgICAgICAgICAtIHtCb29sZWFufSBbaGFzT25lVGltZV1cbiAqIEBwYXJhbSB7VnVlfSB2bVxuICogQHBhcmFtIHtOb2RlfSBlbFxuICogQHBhcmFtIHtWdWV9IFtob3N0XSAtIHRyYW5zY2x1c2lvbiBob3N0IGNvbXBvbmVudFxuICogQHBhcmFtIHtPYmplY3R9IFtzY29wZV0gLSB2LWZvciBzY29wZVxuICogQHBhcmFtIHtGcmFnbWVudH0gW2ZyYWddIC0gb3duZXIgZnJhZ21lbnRcbiAqIEBjb25zdHJ1Y3RvclxuICovXG5mdW5jdGlvbiBEaXJlY3RpdmUoZGVzY3JpcHRvciwgdm0sIGVsLCBob3N0LCBzY29wZSwgZnJhZykge1xuICB0aGlzLnZtID0gdm07XG4gIHRoaXMuZWwgPSBlbDtcbiAgLy8gY29weSBkZXNjcmlwdG9yIHByb3BlcnRpZXNcbiAgdGhpcy5kZXNjcmlwdG9yID0gZGVzY3JpcHRvcjtcbiAgdGhpcy5uYW1lID0gZGVzY3JpcHRvci5uYW1lO1xuICB0aGlzLmV4cHJlc3Npb24gPSBkZXNjcmlwdG9yLmV4cHJlc3Npb247XG4gIHRoaXMuYXJnID0gZGVzY3JpcHRvci5hcmc7XG4gIHRoaXMubW9kaWZpZXJzID0gZGVzY3JpcHRvci5tb2RpZmllcnM7XG4gIHRoaXMuZmlsdGVycyA9IGRlc2NyaXB0b3IuZmlsdGVycztcbiAgdGhpcy5saXRlcmFsID0gdGhpcy5tb2RpZmllcnMgJiYgdGhpcy5tb2RpZmllcnMubGl0ZXJhbDtcbiAgLy8gcHJpdmF0ZVxuICB0aGlzLl9sb2NrZWQgPSBmYWxzZTtcbiAgdGhpcy5fYm91bmQgPSBmYWxzZTtcbiAgdGhpcy5fbGlzdGVuZXJzID0gbnVsbDtcbiAgLy8gbGluayBjb250ZXh0XG4gIHRoaXMuX2hvc3QgPSBob3N0O1xuICB0aGlzLl9zY29wZSA9IHNjb3BlO1xuICB0aGlzLl9mcmFnID0gZnJhZztcbiAgLy8gc3RvcmUgZGlyZWN0aXZlcyBvbiBub2RlIGluIGRldiBtb2RlXG4gIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHRoaXMuZWwpIHtcbiAgICB0aGlzLmVsLl92dWVfZGlyZWN0aXZlcyA9IHRoaXMuZWwuX3Z1ZV9kaXJlY3RpdmVzIHx8IFtdO1xuICAgIHRoaXMuZWwuX3Z1ZV9kaXJlY3RpdmVzLnB1c2godGhpcyk7XG4gIH1cbn1cblxuLyoqXG4gKiBJbml0aWFsaXplIHRoZSBkaXJlY3RpdmUsIG1peGluIGRlZmluaXRpb24gcHJvcGVydGllcyxcbiAqIHNldHVwIHRoZSB3YXRjaGVyLCBjYWxsIGRlZmluaXRpb24gYmluZCgpIGFuZCB1cGRhdGUoKVxuICogaWYgcHJlc2VudC5cbiAqL1xuXG5EaXJlY3RpdmUucHJvdG90eXBlLl9iaW5kID0gZnVuY3Rpb24gKCkge1xuICB2YXIgbmFtZSA9IHRoaXMubmFtZTtcbiAgdmFyIGRlc2NyaXB0b3IgPSB0aGlzLmRlc2NyaXB0b3I7XG5cbiAgLy8gcmVtb3ZlIGF0dHJpYnV0ZVxuICBpZiAoKG5hbWUgIT09ICdjbG9haycgfHwgdGhpcy52bS5faXNDb21waWxlZCkgJiYgdGhpcy5lbCAmJiB0aGlzLmVsLnJlbW92ZUF0dHJpYnV0ZSkge1xuICAgIHZhciBhdHRyID0gZGVzY3JpcHRvci5hdHRyIHx8ICd2LScgKyBuYW1lO1xuICAgIHRoaXMuZWwucmVtb3ZlQXR0cmlidXRlKGF0dHIpO1xuICB9XG5cbiAgLy8gY29weSBkZWYgcHJvcGVydGllc1xuICB2YXIgZGVmID0gZGVzY3JpcHRvci5kZWY7XG4gIGlmICh0eXBlb2YgZGVmID09PSAnZnVuY3Rpb24nKSB7XG4gICAgdGhpcy51cGRhdGUgPSBkZWY7XG4gIH0gZWxzZSB7XG4gICAgZXh0ZW5kKHRoaXMsIGRlZik7XG4gIH1cblxuICAvLyBzZXR1cCBkaXJlY3RpdmUgcGFyYW1zXG4gIHRoaXMuX3NldHVwUGFyYW1zKCk7XG5cbiAgLy8gaW5pdGlhbCBiaW5kXG4gIGlmICh0aGlzLmJpbmQpIHtcbiAgICB0aGlzLmJpbmQoKTtcbiAgfVxuICB0aGlzLl9ib3VuZCA9IHRydWU7XG5cbiAgaWYgKHRoaXMubGl0ZXJhbCkge1xuICAgIHRoaXMudXBkYXRlICYmIHRoaXMudXBkYXRlKGRlc2NyaXB0b3IucmF3KTtcbiAgfSBlbHNlIGlmICgodGhpcy5leHByZXNzaW9uIHx8IHRoaXMubW9kaWZpZXJzKSAmJiAodGhpcy51cGRhdGUgfHwgdGhpcy50d29XYXkpICYmICF0aGlzLl9jaGVja1N0YXRlbWVudCgpKSB7XG4gICAgLy8gd3JhcHBlZCB1cGRhdGVyIGZvciBjb250ZXh0XG4gICAgdmFyIGRpciA9IHRoaXM7XG4gICAgaWYgKHRoaXMudXBkYXRlKSB7XG4gICAgICB0aGlzLl91cGRhdGUgPSBmdW5jdGlvbiAodmFsLCBvbGRWYWwpIHtcbiAgICAgICAgaWYgKCFkaXIuX2xvY2tlZCkge1xuICAgICAgICAgIGRpci51cGRhdGUodmFsLCBvbGRWYWwpO1xuICAgICAgICB9XG4gICAgICB9O1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl91cGRhdGUgPSBub29wO1xuICAgIH1cbiAgICB2YXIgcHJlUHJvY2VzcyA9IHRoaXMuX3ByZVByb2Nlc3MgPyBiaW5kKHRoaXMuX3ByZVByb2Nlc3MsIHRoaXMpIDogbnVsbDtcbiAgICB2YXIgcG9zdFByb2Nlc3MgPSB0aGlzLl9wb3N0UHJvY2VzcyA/IGJpbmQodGhpcy5fcG9zdFByb2Nlc3MsIHRoaXMpIDogbnVsbDtcbiAgICB2YXIgd2F0Y2hlciA9IHRoaXMuX3dhdGNoZXIgPSBuZXcgV2F0Y2hlcih0aGlzLnZtLCB0aGlzLmV4cHJlc3Npb24sIHRoaXMuX3VwZGF0ZSwgLy8gY2FsbGJhY2tcbiAgICB7XG4gICAgICBmaWx0ZXJzOiB0aGlzLmZpbHRlcnMsXG4gICAgICB0d29XYXk6IHRoaXMudHdvV2F5LFxuICAgICAgZGVlcDogdGhpcy5kZWVwLFxuICAgICAgcHJlUHJvY2VzczogcHJlUHJvY2VzcyxcbiAgICAgIHBvc3RQcm9jZXNzOiBwb3N0UHJvY2VzcyxcbiAgICAgIHNjb3BlOiB0aGlzLl9zY29wZVxuICAgIH0pO1xuICAgIC8vIHYtbW9kZWwgd2l0aCBpbml0YWwgaW5saW5lIHZhbHVlIG5lZWQgdG8gc3luYyBiYWNrIHRvXG4gICAgLy8gbW9kZWwgaW5zdGVhZCBvZiB1cGRhdGUgdG8gRE9NIG9uIGluaXQuIFRoZXkgd291bGRcbiAgICAvLyBzZXQgdGhlIGFmdGVyQmluZCBob29rIHRvIGluZGljYXRlIHRoYXQuXG4gICAgaWYgKHRoaXMuYWZ0ZXJCaW5kKSB7XG4gICAgICB0aGlzLmFmdGVyQmluZCgpO1xuICAgIH0gZWxzZSBpZiAodGhpcy51cGRhdGUpIHtcbiAgICAgIHRoaXMudXBkYXRlKHdhdGNoZXIudmFsdWUpO1xuICAgIH1cbiAgfVxufTtcblxuLyoqXG4gKiBTZXR1cCBhbGwgcGFyYW0gYXR0cmlidXRlcywgZS5nLiB0cmFjay1ieSxcbiAqIHRyYW5zaXRpb24tbW9kZSwgZXRjLi4uXG4gKi9cblxuRGlyZWN0aXZlLnByb3RvdHlwZS5fc2V0dXBQYXJhbXMgPSBmdW5jdGlvbiAoKSB7XG4gIGlmICghdGhpcy5wYXJhbXMpIHtcbiAgICByZXR1cm47XG4gIH1cbiAgdmFyIHBhcmFtcyA9IHRoaXMucGFyYW1zO1xuICAvLyBzd2FwIHRoZSBwYXJhbXMgYXJyYXkgd2l0aCBhIGZyZXNoIG9iamVjdC5cbiAgdGhpcy5wYXJhbXMgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuICB2YXIgaSA9IHBhcmFtcy5sZW5ndGg7XG4gIHZhciBrZXksIHZhbCwgbWFwcGVkS2V5O1xuICB3aGlsZSAoaS0tKSB7XG4gICAga2V5ID0gaHlwaGVuYXRlKHBhcmFtc1tpXSk7XG4gICAgbWFwcGVkS2V5ID0gY2FtZWxpemUoa2V5KTtcbiAgICB2YWwgPSBnZXRCaW5kQXR0cih0aGlzLmVsLCBrZXkpO1xuICAgIGlmICh2YWwgIT0gbnVsbCkge1xuICAgICAgLy8gZHluYW1pY1xuICAgICAgdGhpcy5fc2V0dXBQYXJhbVdhdGNoZXIobWFwcGVkS2V5LCB2YWwpO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBzdGF0aWNcbiAgICAgIHZhbCA9IGdldEF0dHIodGhpcy5lbCwga2V5KTtcbiAgICAgIGlmICh2YWwgIT0gbnVsbCkge1xuICAgICAgICB0aGlzLnBhcmFtc1ttYXBwZWRLZXldID0gdmFsID09PSAnJyA/IHRydWUgOiB2YWw7XG4gICAgICB9XG4gICAgfVxuICB9XG59O1xuXG4vKipcbiAqIFNldHVwIGEgd2F0Y2hlciBmb3IgYSBkeW5hbWljIHBhcmFtLlxuICpcbiAqIEBwYXJhbSB7U3RyaW5nfSBrZXlcbiAqIEBwYXJhbSB7U3RyaW5nfSBleHByZXNzaW9uXG4gKi9cblxuRGlyZWN0aXZlLnByb3RvdHlwZS5fc2V0dXBQYXJhbVdhdGNoZXIgPSBmdW5jdGlvbiAoa2V5LCBleHByZXNzaW9uKSB7XG4gIHZhciBzZWxmID0gdGhpcztcbiAgdmFyIGNhbGxlZCA9IGZhbHNlO1xuICB2YXIgdW53YXRjaCA9ICh0aGlzLl9zY29wZSB8fCB0aGlzLnZtKS4kd2F0Y2goZXhwcmVzc2lvbiwgZnVuY3Rpb24gKHZhbCwgb2xkVmFsKSB7XG4gICAgc2VsZi5wYXJhbXNba2V5XSA9IHZhbDtcbiAgICAvLyBzaW5jZSB3ZSBhcmUgaW4gaW1tZWRpYXRlIG1vZGUsXG4gICAgLy8gb25seSBjYWxsIHRoZSBwYXJhbSBjaGFuZ2UgY2FsbGJhY2tzIGlmIHRoaXMgaXMgbm90IHRoZSBmaXJzdCB1cGRhdGUuXG4gICAgaWYgKGNhbGxlZCkge1xuICAgICAgdmFyIGNiID0gc2VsZi5wYXJhbVdhdGNoZXJzICYmIHNlbGYucGFyYW1XYXRjaGVyc1trZXldO1xuICAgICAgaWYgKGNiKSB7XG4gICAgICAgIGNiLmNhbGwoc2VsZiwgdmFsLCBvbGRWYWwpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBjYWxsZWQgPSB0cnVlO1xuICAgIH1cbiAgfSwge1xuICAgIGltbWVkaWF0ZTogdHJ1ZSxcbiAgICB1c2VyOiBmYWxzZVxuICB9KTsodGhpcy5fcGFyYW1VbndhdGNoRm5zIHx8ICh0aGlzLl9wYXJhbVVud2F0Y2hGbnMgPSBbXSkpLnB1c2godW53YXRjaCk7XG59O1xuXG4vKipcbiAqIENoZWNrIGlmIHRoZSBkaXJlY3RpdmUgaXMgYSBmdW5jdGlvbiBjYWxsZXJcbiAqIGFuZCBpZiB0aGUgZXhwcmVzc2lvbiBpcyBhIGNhbGxhYmxlIG9uZS4gSWYgYm90aCB0cnVlLFxuICogd2Ugd3JhcCB1cCB0aGUgZXhwcmVzc2lvbiBhbmQgdXNlIGl0IGFzIHRoZSBldmVudFxuICogaGFuZGxlci5cbiAqXG4gKiBlLmcuIG9uLWNsaWNrPVwiYSsrXCJcbiAqXG4gKiBAcmV0dXJuIHtCb29sZWFufVxuICovXG5cbkRpcmVjdGl2ZS5wcm90b3R5cGUuX2NoZWNrU3RhdGVtZW50ID0gZnVuY3Rpb24gKCkge1xuICB2YXIgZXhwcmVzc2lvbiA9IHRoaXMuZXhwcmVzc2lvbjtcbiAgaWYgKGV4cHJlc3Npb24gJiYgdGhpcy5hY2NlcHRTdGF0ZW1lbnQgJiYgIWlzU2ltcGxlUGF0aChleHByZXNzaW9uKSkge1xuICAgIHZhciBmbiA9IHBhcnNlRXhwcmVzc2lvbihleHByZXNzaW9uKS5nZXQ7XG4gICAgdmFyIHNjb3BlID0gdGhpcy5fc2NvcGUgfHwgdGhpcy52bTtcbiAgICB2YXIgaGFuZGxlciA9IGZ1bmN0aW9uIGhhbmRsZXIoZSkge1xuICAgICAgc2NvcGUuJGV2ZW50ID0gZTtcbiAgICAgIGZuLmNhbGwoc2NvcGUsIHNjb3BlKTtcbiAgICAgIHNjb3BlLiRldmVudCA9IG51bGw7XG4gICAgfTtcbiAgICBpZiAodGhpcy5maWx0ZXJzKSB7XG4gICAgICBoYW5kbGVyID0gc2NvcGUuX2FwcGx5RmlsdGVycyhoYW5kbGVyLCBudWxsLCB0aGlzLmZpbHRlcnMpO1xuICAgIH1cbiAgICB0aGlzLnVwZGF0ZShoYW5kbGVyKTtcbiAgICByZXR1cm4gdHJ1ZTtcbiAgfVxufTtcblxuLyoqXG4gKiBTZXQgdGhlIGNvcnJlc3BvbmRpbmcgdmFsdWUgd2l0aCB0aGUgc2V0dGVyLlxuICogVGhpcyBzaG91bGQgb25seSBiZSB1c2VkIGluIHR3by13YXkgZGlyZWN0aXZlc1xuICogZS5nLiB2LW1vZGVsLlxuICpcbiAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAqIEBwdWJsaWNcbiAqL1xuXG5EaXJlY3RpdmUucHJvdG90eXBlLnNldCA9IGZ1bmN0aW9uICh2YWx1ZSkge1xuICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICBpZiAodGhpcy50d29XYXkpIHtcbiAgICB0aGlzLl93aXRoTG9jayhmdW5jdGlvbiAoKSB7XG4gICAgICB0aGlzLl93YXRjaGVyLnNldCh2YWx1ZSk7XG4gICAgfSk7XG4gIH0gZWxzZSBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgIHdhcm4oJ0RpcmVjdGl2ZS5zZXQoKSBjYW4gb25seSBiZSB1c2VkIGluc2lkZSB0d29XYXknICsgJ2RpcmVjdGl2ZXMuJyk7XG4gIH1cbn07XG5cbi8qKlxuICogRXhlY3V0ZSBhIGZ1bmN0aW9uIHdoaWxlIHByZXZlbnRpbmcgdGhhdCBmdW5jdGlvbiBmcm9tXG4gKiB0cmlnZ2VyaW5nIHVwZGF0ZXMgb24gdGhpcyBkaXJlY3RpdmUgaW5zdGFuY2UuXG4gKlxuICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAqL1xuXG5EaXJlY3RpdmUucHJvdG90eXBlLl93aXRoTG9jayA9IGZ1bmN0aW9uIChmbikge1xuICB2YXIgc2VsZiA9IHRoaXM7XG4gIHNlbGYuX2xvY2tlZCA9IHRydWU7XG4gIGZuLmNhbGwoc2VsZik7XG4gIG5leHRUaWNrKGZ1bmN0aW9uICgpIHtcbiAgICBzZWxmLl9sb2NrZWQgPSBmYWxzZTtcbiAgfSk7XG59O1xuXG4vKipcbiAqIENvbnZlbmllbmNlIG1ldGhvZCB0aGF0IGF0dGFjaGVzIGEgRE9NIGV2ZW50IGxpc3RlbmVyXG4gKiB0byB0aGUgZGlyZWN0aXZlIGVsZW1lbnQgYW5kIGF1dG9tZXRpY2FsbHkgdGVhcnMgaXQgZG93blxuICogZHVyaW5nIHVuYmluZC5cbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGhhbmRsZXJcbiAqIEBwYXJhbSB7Qm9vbGVhbn0gW3VzZUNhcHR1cmVdXG4gKi9cblxuRGlyZWN0aXZlLnByb3RvdHlwZS5vbiA9IGZ1bmN0aW9uIChldmVudCwgaGFuZGxlciwgdXNlQ2FwdHVyZSkge1xuICBvbih0aGlzLmVsLCBldmVudCwgaGFuZGxlciwgdXNlQ2FwdHVyZSk7KHRoaXMuX2xpc3RlbmVycyB8fCAodGhpcy5fbGlzdGVuZXJzID0gW10pKS5wdXNoKFtldmVudCwgaGFuZGxlcl0pO1xufTtcblxuLyoqXG4gKiBUZWFyZG93biB0aGUgd2F0Y2hlciBhbmQgY2FsbCB1bmJpbmQuXG4gKi9cblxuRGlyZWN0aXZlLnByb3RvdHlwZS5fdGVhcmRvd24gPSBmdW5jdGlvbiAoKSB7XG4gIGlmICh0aGlzLl9ib3VuZCkge1xuICAgIHRoaXMuX2JvdW5kID0gZmFsc2U7XG4gICAgaWYgKHRoaXMudW5iaW5kKSB7XG4gICAgICB0aGlzLnVuYmluZCgpO1xuICAgIH1cbiAgICBpZiAodGhpcy5fd2F0Y2hlcikge1xuICAgICAgdGhpcy5fd2F0Y2hlci50ZWFyZG93bigpO1xuICAgIH1cbiAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgIHZhciBpO1xuICAgIGlmIChsaXN0ZW5lcnMpIHtcbiAgICAgIGkgPSBsaXN0ZW5lcnMubGVuZ3RoO1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICBvZmYodGhpcy5lbCwgbGlzdGVuZXJzW2ldWzBdLCBsaXN0ZW5lcnNbaV1bMV0pO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgdW53YXRjaEZucyA9IHRoaXMuX3BhcmFtVW53YXRjaEZucztcbiAgICBpZiAodW53YXRjaEZucykge1xuICAgICAgaSA9IHVud2F0Y2hGbnMubGVuZ3RoO1xuICAgICAgd2hpbGUgKGktLSkge1xuICAgICAgICB1bndhdGNoRm5zW2ldKCk7XG4gICAgICB9XG4gICAgfVxuICAgIGlmIChwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHRoaXMuZWwpIHtcbiAgICAgIHRoaXMuZWwuX3Z1ZV9kaXJlY3RpdmVzLiRyZW1vdmUodGhpcyk7XG4gICAgfVxuICAgIHRoaXMudm0gPSB0aGlzLmVsID0gdGhpcy5fd2F0Y2hlciA9IHRoaXMuX2xpc3RlbmVycyA9IG51bGw7XG4gIH1cbn07XG5cbmZ1bmN0aW9uIGxpZmVjeWNsZU1peGluIChWdWUpIHtcbiAgLyoqXG4gICAqIFVwZGF0ZSB2LXJlZiBmb3IgY29tcG9uZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IHJlbW92ZVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl91cGRhdGVSZWYgPSBmdW5jdGlvbiAocmVtb3ZlKSB7XG4gICAgdmFyIHJlZiA9IHRoaXMuJG9wdGlvbnMuX3JlZjtcbiAgICBpZiAocmVmKSB7XG4gICAgICB2YXIgcmVmcyA9ICh0aGlzLl9zY29wZSB8fCB0aGlzLl9jb250ZXh0KS4kcmVmcztcbiAgICAgIGlmIChyZW1vdmUpIHtcbiAgICAgICAgaWYgKHJlZnNbcmVmXSA9PT0gdGhpcykge1xuICAgICAgICAgIHJlZnNbcmVmXSA9IG51bGw7XG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJlZnNbcmVmXSA9IHRoaXM7XG4gICAgICB9XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBUcmFuc2NsdWRlLCBjb21waWxlIGFuZCBsaW5rIGVsZW1lbnQuXG4gICAqXG4gICAqIElmIGEgcHJlLWNvbXBpbGVkIGxpbmtlciBpcyBhdmFpbGFibGUsIHRoYXQgbWVhbnMgdGhlXG4gICAqIHBhc3NlZCBpbiBlbGVtZW50IHdpbGwgYmUgcHJlLXRyYW5zY2x1ZGVkIGFuZCBjb21waWxlZFxuICAgKiBhcyB3ZWxsIC0gYWxsIHdlIG5lZWQgdG8gZG8gaXMgdG8gY2FsbCB0aGUgbGlua2VyLlxuICAgKlxuICAgKiBPdGhlcndpc2Ugd2UgbmVlZCB0byBjYWxsIHRyYW5zY2x1ZGUvY29tcGlsZS9saW5rIGhlcmUuXG4gICAqXG4gICAqIEBwYXJhbSB7RWxlbWVudH0gZWxcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS5fY29tcGlsZSA9IGZ1bmN0aW9uIChlbCkge1xuICAgIHZhciBvcHRpb25zID0gdGhpcy4kb3B0aW9ucztcblxuICAgIC8vIHRyYW5zY2x1ZGUgYW5kIGluaXQgZWxlbWVudFxuICAgIC8vIHRyYW5zY2x1ZGUgY2FuIHBvdGVudGlhbGx5IHJlcGxhY2Ugb3JpZ2luYWxcbiAgICAvLyBzbyB3ZSBuZWVkIHRvIGtlZXAgcmVmZXJlbmNlOyB0aGlzIHN0ZXAgYWxzbyBpbmplY3RzXG4gICAgLy8gdGhlIHRlbXBsYXRlIGFuZCBjYWNoZXMgdGhlIG9yaWdpbmFsIGF0dHJpYnV0ZXNcbiAgICAvLyBvbiB0aGUgY29udGFpbmVyIG5vZGUgYW5kIHJlcGxhY2VyIG5vZGUuXG4gICAgdmFyIG9yaWdpbmFsID0gZWw7XG4gICAgZWwgPSB0cmFuc2NsdWRlKGVsLCBvcHRpb25zKTtcbiAgICB0aGlzLl9pbml0RWxlbWVudChlbCk7XG5cbiAgICAvLyBoYW5kbGUgdi1wcmUgb24gcm9vdCBub2RlICgjMjAyNilcbiAgICBpZiAoZWwubm9kZVR5cGUgPT09IDEgJiYgZ2V0QXR0cihlbCwgJ3YtcHJlJykgIT09IG51bGwpIHtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyByb290IGlzIGFsd2F5cyBjb21waWxlZCBwZXItaW5zdGFuY2UsIGJlY2F1c2VcbiAgICAvLyBjb250YWluZXIgYXR0cnMgYW5kIHByb3BzIGNhbiBiZSBkaWZmZXJlbnQgZXZlcnkgdGltZS5cbiAgICB2YXIgY29udGV4dE9wdGlvbnMgPSB0aGlzLl9jb250ZXh0ICYmIHRoaXMuX2NvbnRleHQuJG9wdGlvbnM7XG4gICAgdmFyIHJvb3RMaW5rZXIgPSBjb21waWxlUm9vdChlbCwgb3B0aW9ucywgY29udGV4dE9wdGlvbnMpO1xuXG4gICAgLy8gcmVzb2x2ZSBzbG90IGRpc3RyaWJ1dGlvblxuICAgIHJlc29sdmVTbG90cyh0aGlzLCBvcHRpb25zLl9jb250ZW50KTtcblxuICAgIC8vIGNvbXBpbGUgYW5kIGxpbmsgdGhlIHJlc3RcbiAgICB2YXIgY29udGVudExpbmtGbjtcbiAgICB2YXIgY3RvciA9IHRoaXMuY29uc3RydWN0b3I7XG4gICAgLy8gY29tcG9uZW50IGNvbXBpbGF0aW9uIGNhbiBiZSBjYWNoZWRcbiAgICAvLyBhcyBsb25nIGFzIGl0J3Mgbm90IHVzaW5nIGlubGluZS10ZW1wbGF0ZVxuICAgIGlmIChvcHRpb25zLl9saW5rZXJDYWNoYWJsZSkge1xuICAgICAgY29udGVudExpbmtGbiA9IGN0b3IubGlua2VyO1xuICAgICAgaWYgKCFjb250ZW50TGlua0ZuKSB7XG4gICAgICAgIGNvbnRlbnRMaW5rRm4gPSBjdG9yLmxpbmtlciA9IGNvbXBpbGUoZWwsIG9wdGlvbnMpO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8vIGxpbmsgcGhhc2VcbiAgICAvLyBtYWtlIHN1cmUgdG8gbGluayByb290IHdpdGggcHJvcCBzY29wZSFcbiAgICB2YXIgcm9vdFVubGlua0ZuID0gcm9vdExpbmtlcih0aGlzLCBlbCwgdGhpcy5fc2NvcGUpO1xuICAgIHZhciBjb250ZW50VW5saW5rRm4gPSBjb250ZW50TGlua0ZuID8gY29udGVudExpbmtGbih0aGlzLCBlbCkgOiBjb21waWxlKGVsLCBvcHRpb25zKSh0aGlzLCBlbCk7XG5cbiAgICAvLyByZWdpc3RlciBjb21wb3NpdGUgdW5saW5rIGZ1bmN0aW9uXG4gICAgLy8gdG8gYmUgY2FsbGVkIGR1cmluZyBpbnN0YW5jZSBkZXN0cnVjdGlvblxuICAgIHRoaXMuX3VubGlua0ZuID0gZnVuY3Rpb24gKCkge1xuICAgICAgcm9vdFVubGlua0ZuKCk7XG4gICAgICAvLyBwYXNzaW5nIGRlc3Ryb3lpbmc6IHRydWUgdG8gYXZvaWQgc2VhcmNoaW5nIGFuZFxuICAgICAgLy8gc3BsaWNpbmcgdGhlIGRpcmVjdGl2ZXNcbiAgICAgIGNvbnRlbnRVbmxpbmtGbih0cnVlKTtcbiAgICB9O1xuXG4gICAgLy8gZmluYWxseSByZXBsYWNlIG9yaWdpbmFsXG4gICAgaWYgKG9wdGlvbnMucmVwbGFjZSkge1xuICAgICAgcmVwbGFjZShvcmlnaW5hbCwgZWwpO1xuICAgIH1cblxuICAgIHRoaXMuX2lzQ29tcGlsZWQgPSB0cnVlO1xuICAgIHRoaXMuX2NhbGxIb29rKCdjb21waWxlZCcpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBJbml0aWFsaXplIGluc3RhbmNlIGVsZW1lbnQuIENhbGxlZCBpbiB0aGUgcHVibGljXG4gICAqICRtb3VudCgpIG1ldGhvZC5cbiAgICpcbiAgICogQHBhcmFtIHtFbGVtZW50fSBlbFxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9pbml0RWxlbWVudCA9IGZ1bmN0aW9uIChlbCkge1xuICAgIGlmIChpc0ZyYWdtZW50KGVsKSkge1xuICAgICAgdGhpcy5faXNGcmFnbWVudCA9IHRydWU7XG4gICAgICB0aGlzLiRlbCA9IHRoaXMuX2ZyYWdtZW50U3RhcnQgPSBlbC5maXJzdENoaWxkO1xuICAgICAgdGhpcy5fZnJhZ21lbnRFbmQgPSBlbC5sYXN0Q2hpbGQ7XG4gICAgICAvLyBzZXQgcGVyc2lzdGVkIHRleHQgYW5jaG9ycyB0byBlbXB0eVxuICAgICAgaWYgKHRoaXMuX2ZyYWdtZW50U3RhcnQubm9kZVR5cGUgPT09IDMpIHtcbiAgICAgICAgdGhpcy5fZnJhZ21lbnRTdGFydC5kYXRhID0gdGhpcy5fZnJhZ21lbnRFbmQuZGF0YSA9ICcnO1xuICAgICAgfVxuICAgICAgdGhpcy5fZnJhZ21lbnQgPSBlbDtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy4kZWwgPSBlbDtcbiAgICB9XG4gICAgdGhpcy4kZWwuX192dWVfXyA9IHRoaXM7XG4gICAgdGhpcy5fY2FsbEhvb2soJ2JlZm9yZUNvbXBpbGUnKTtcbiAgfTtcblxuICAvKipcbiAgICogQ3JlYXRlIGFuZCBiaW5kIGEgZGlyZWN0aXZlIHRvIGFuIGVsZW1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBkZXNjcmlwdG9yIC0gcGFyc2VkIGRpcmVjdGl2ZSBkZXNjcmlwdG9yXG4gICAqIEBwYXJhbSB7Tm9kZX0gbm9kZSAgIC0gdGFyZ2V0IG5vZGVcbiAgICogQHBhcmFtIHtWdWV9IFtob3N0XSAtIHRyYW5zY2x1c2lvbiBob3N0IGNvbXBvbmVudFxuICAgKiBAcGFyYW0ge09iamVjdH0gW3Njb3BlXSAtIHYtZm9yIHNjb3BlXG4gICAqIEBwYXJhbSB7RnJhZ21lbnR9IFtmcmFnXSAtIG93bmVyIGZyYWdtZW50XG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2JpbmREaXIgPSBmdW5jdGlvbiAoZGVzY3JpcHRvciwgbm9kZSwgaG9zdCwgc2NvcGUsIGZyYWcpIHtcbiAgICB0aGlzLl9kaXJlY3RpdmVzLnB1c2gobmV3IERpcmVjdGl2ZShkZXNjcmlwdG9yLCB0aGlzLCBub2RlLCBob3N0LCBzY29wZSwgZnJhZykpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBUZWFyZG93biBhbiBpbnN0YW5jZSwgdW5vYnNlcnZlcyB0aGUgZGF0YSwgdW5iaW5kIGFsbCB0aGVcbiAgICogZGlyZWN0aXZlcywgdHVybiBvZmYgYWxsIHRoZSBldmVudCBsaXN0ZW5lcnMsIGV0Yy5cbiAgICpcbiAgICogQHBhcmFtIHtCb29sZWFufSByZW1vdmUgLSB3aGV0aGVyIHRvIHJlbW92ZSB0aGUgRE9NIG5vZGUuXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gZGVmZXJDbGVhbnVwIC0gaWYgdHJ1ZSwgZGVmZXIgY2xlYW51cCB0b1xuICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJlIGNhbGxlZCBsYXRlclxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9kZXN0cm95ID0gZnVuY3Rpb24gKHJlbW92ZSwgZGVmZXJDbGVhbnVwKSB7XG4gICAgaWYgKHRoaXMuX2lzQmVpbmdEZXN0cm95ZWQpIHtcbiAgICAgIGlmICghZGVmZXJDbGVhbnVwKSB7XG4gICAgICAgIHRoaXMuX2NsZWFudXAoKTtcbiAgICAgIH1cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICB2YXIgZGVzdHJveVJlYWR5O1xuICAgIHZhciBwZW5kaW5nUmVtb3ZhbDtcblxuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAvLyBDbGVhbnVwIHNob3VsZCBiZSBjYWxsZWQgZWl0aGVyIHN5bmNocm9ub3VzbHkgb3IgYXN5bmNocm9ub3lzbHkgYXNcbiAgICAvLyBjYWxsYmFjayBvZiB0aGlzLiRyZW1vdmUoKSwgb3IgaWYgcmVtb3ZlIGFuZCBkZWZlckNsZWFudXAgYXJlIGZhbHNlLlxuICAgIC8vIEluIGFueSBjYXNlIGl0IHNob3VsZCBiZSBjYWxsZWQgYWZ0ZXIgYWxsIG90aGVyIHJlbW92aW5nLCB1bmJpbmRpbmcgYW5kXG4gICAgLy8gdHVybmluZyBvZiBpcyBkb25lXG4gICAgdmFyIGNsZWFudXBJZlBvc3NpYmxlID0gZnVuY3Rpb24gY2xlYW51cElmUG9zc2libGUoKSB7XG4gICAgICBpZiAoZGVzdHJveVJlYWR5ICYmICFwZW5kaW5nUmVtb3ZhbCAmJiAhZGVmZXJDbGVhbnVwKSB7XG4gICAgICAgIHNlbGYuX2NsZWFudXAoKTtcbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gcmVtb3ZlIERPTSBlbGVtZW50XG4gICAgaWYgKHJlbW92ZSAmJiB0aGlzLiRlbCkge1xuICAgICAgcGVuZGluZ1JlbW92YWwgPSB0cnVlO1xuICAgICAgdGhpcy4kcmVtb3ZlKGZ1bmN0aW9uICgpIHtcbiAgICAgICAgcGVuZGluZ1JlbW92YWwgPSBmYWxzZTtcbiAgICAgICAgY2xlYW51cElmUG9zc2libGUoKTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIHRoaXMuX2NhbGxIb29rKCdiZWZvcmVEZXN0cm95Jyk7XG4gICAgdGhpcy5faXNCZWluZ0Rlc3Ryb3llZCA9IHRydWU7XG4gICAgdmFyIGk7XG4gICAgLy8gcmVtb3ZlIHNlbGYgZnJvbSBwYXJlbnQuIG9ubHkgbmVjZXNzYXJ5XG4gICAgLy8gaWYgcGFyZW50IGlzIG5vdCBiZWluZyBkZXN0cm95ZWQgYXMgd2VsbC5cbiAgICB2YXIgcGFyZW50ID0gdGhpcy4kcGFyZW50O1xuICAgIGlmIChwYXJlbnQgJiYgIXBhcmVudC5faXNCZWluZ0Rlc3Ryb3llZCkge1xuICAgICAgcGFyZW50LiRjaGlsZHJlbi4kcmVtb3ZlKHRoaXMpO1xuICAgICAgLy8gdW5yZWdpc3RlciByZWYgKHJlbW92ZTogdHJ1ZSlcbiAgICAgIHRoaXMuX3VwZGF0ZVJlZih0cnVlKTtcbiAgICB9XG4gICAgLy8gZGVzdHJveSBhbGwgY2hpbGRyZW4uXG4gICAgaSA9IHRoaXMuJGNoaWxkcmVuLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICB0aGlzLiRjaGlsZHJlbltpXS4kZGVzdHJveSgpO1xuICAgIH1cbiAgICAvLyB0ZWFyZG93biBwcm9wc1xuICAgIGlmICh0aGlzLl9wcm9wc1VubGlua0ZuKSB7XG4gICAgICB0aGlzLl9wcm9wc1VubGlua0ZuKCk7XG4gICAgfVxuICAgIC8vIHRlYXJkb3duIGFsbCBkaXJlY3RpdmVzLiB0aGlzIGFsc28gdGVhcnNkb3duIGFsbFxuICAgIC8vIGRpcmVjdGl2ZS1vd25lZCB3YXRjaGVycy5cbiAgICBpZiAodGhpcy5fdW5saW5rRm4pIHtcbiAgICAgIHRoaXMuX3VubGlua0ZuKCk7XG4gICAgfVxuICAgIGkgPSB0aGlzLl93YXRjaGVycy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgdGhpcy5fd2F0Y2hlcnNbaV0udGVhcmRvd24oKTtcbiAgICB9XG4gICAgLy8gcmVtb3ZlIHJlZmVyZW5jZSB0byBzZWxmIG9uICRlbFxuICAgIGlmICh0aGlzLiRlbCkge1xuICAgICAgdGhpcy4kZWwuX192dWVfXyA9IG51bGw7XG4gICAgfVxuXG4gICAgZGVzdHJveVJlYWR5ID0gdHJ1ZTtcbiAgICBjbGVhbnVwSWZQb3NzaWJsZSgpO1xuICB9O1xuXG4gIC8qKlxuICAgKiBDbGVhbiB1cCB0byBlbnN1cmUgZ2FyYmFnZSBjb2xsZWN0aW9uLlxuICAgKiBUaGlzIGlzIGNhbGxlZCBhZnRlciB0aGUgbGVhdmUgdHJhbnNpdGlvbiBpZiB0aGVyZVxuICAgKiBpcyBhbnkuXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuX2NsZWFudXAgPSBmdW5jdGlvbiAoKSB7XG4gICAgaWYgKHRoaXMuX2lzRGVzdHJveWVkKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIHJlbW92ZSBzZWxmIGZyb20gb3duZXIgZnJhZ21lbnRcbiAgICAvLyBkbyBpdCBpbiBjbGVhbnVwIHNvIHRoYXQgd2UgY2FuIGNhbGwgJGRlc3Ryb3kgd2l0aFxuICAgIC8vIGRlZmVyIHJpZ2h0IHdoZW4gYSBmcmFnbWVudCBpcyBhYm91dCB0byBiZSByZW1vdmVkLlxuICAgIGlmICh0aGlzLl9mcmFnKSB7XG4gICAgICB0aGlzLl9mcmFnLmNoaWxkcmVuLiRyZW1vdmUodGhpcyk7XG4gICAgfVxuICAgIC8vIHJlbW92ZSByZWZlcmVuY2UgZnJvbSBkYXRhIG9iXG4gICAgLy8gZnJvemVuIG9iamVjdCBtYXkgbm90IGhhdmUgb2JzZXJ2ZXIuXG4gICAgaWYgKHRoaXMuX2RhdGEgJiYgdGhpcy5fZGF0YS5fX29iX18pIHtcbiAgICAgIHRoaXMuX2RhdGEuX19vYl9fLnJlbW92ZVZtKHRoaXMpO1xuICAgIH1cbiAgICAvLyBDbGVhbiB1cCByZWZlcmVuY2VzIHRvIHByaXZhdGUgcHJvcGVydGllcyBhbmQgb3RoZXJcbiAgICAvLyBpbnN0YW5jZXMuIHByZXNlcnZlIHJlZmVyZW5jZSB0byBfZGF0YSBzbyB0aGF0IHByb3h5XG4gICAgLy8gYWNjZXNzb3JzIHN0aWxsIHdvcmsuIFRoZSBvbmx5IHBvdGVudGlhbCBzaWRlIGVmZmVjdFxuICAgIC8vIGhlcmUgaXMgdGhhdCBtdXRhdGluZyB0aGUgaW5zdGFuY2UgYWZ0ZXIgaXQncyBkZXN0cm95ZWRcbiAgICAvLyBtYXkgYWZmZWN0IHRoZSBzdGF0ZSBvZiBvdGhlciBjb21wb25lbnRzIHRoYXQgYXJlIHN0aWxsXG4gICAgLy8gb2JzZXJ2aW5nIHRoZSBzYW1lIG9iamVjdCwgYnV0IHRoYXQgc2VlbXMgdG8gYmUgYVxuICAgIC8vIHJlYXNvbmFibGUgcmVzcG9uc2liaWxpdHkgZm9yIHRoZSB1c2VyIHJhdGhlciB0aGFuXG4gICAgLy8gYWx3YXlzIHRocm93aW5nIGFuIGVycm9yIG9uIHRoZW0uXG4gICAgdGhpcy4kZWwgPSB0aGlzLiRwYXJlbnQgPSB0aGlzLiRyb290ID0gdGhpcy4kY2hpbGRyZW4gPSB0aGlzLl93YXRjaGVycyA9IHRoaXMuX2NvbnRleHQgPSB0aGlzLl9zY29wZSA9IHRoaXMuX2RpcmVjdGl2ZXMgPSBudWxsO1xuICAgIC8vIGNhbGwgdGhlIGxhc3QgaG9vay4uLlxuICAgIHRoaXMuX2lzRGVzdHJveWVkID0gdHJ1ZTtcbiAgICB0aGlzLl9jYWxsSG9vaygnZGVzdHJveWVkJyk7XG4gICAgLy8gdHVybiBvZmYgYWxsIGluc3RhbmNlIGxpc3RlbmVycy5cbiAgICB0aGlzLiRvZmYoKTtcbiAgfTtcbn1cblxuZnVuY3Rpb24gbWlzY01peGluIChWdWUpIHtcbiAgLyoqXG4gICAqIEFwcGx5IGEgbGlzdCBvZiBmaWx0ZXIgKGRlc2NyaXB0b3JzKSB0byBhIHZhbHVlLlxuICAgKiBVc2luZyBwbGFpbiBmb3IgbG9vcHMgaGVyZSBiZWNhdXNlIHRoaXMgd2lsbCBiZSBjYWxsZWQgaW5cbiAgICogdGhlIGdldHRlciBvZiBhbnkgd2F0Y2hlciB3aXRoIGZpbHRlcnMgc28gaXQgaXMgdmVyeVxuICAgKiBwZXJmb3JtYW5jZSBzZW5zaXRpdmUuXG4gICAqXG4gICAqIEBwYXJhbSB7Kn0gdmFsdWVcbiAgICogQHBhcmFtIHsqfSBbb2xkVmFsdWVdXG4gICAqIEBwYXJhbSB7QXJyYXl9IGZpbHRlcnNcbiAgICogQHBhcmFtIHtCb29sZWFufSB3cml0ZVxuICAgKiBAcmV0dXJuIHsqfVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9hcHBseUZpbHRlcnMgPSBmdW5jdGlvbiAodmFsdWUsIG9sZFZhbHVlLCBmaWx0ZXJzLCB3cml0ZSkge1xuICAgIHZhciBmaWx0ZXIsIGZuLCBhcmdzLCBhcmcsIG9mZnNldCwgaSwgbCwgaiwgaztcbiAgICBmb3IgKGkgPSAwLCBsID0gZmlsdGVycy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIGZpbHRlciA9IGZpbHRlcnNbd3JpdGUgPyBsIC0gaSAtIDEgOiBpXTtcbiAgICAgIGZuID0gcmVzb2x2ZUFzc2V0KHRoaXMuJG9wdGlvbnMsICdmaWx0ZXJzJywgZmlsdGVyLm5hbWUsIHRydWUpO1xuICAgICAgaWYgKCFmbikgY29udGludWU7XG4gICAgICBmbiA9IHdyaXRlID8gZm4ud3JpdGUgOiBmbi5yZWFkIHx8IGZuO1xuICAgICAgaWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykgY29udGludWU7XG4gICAgICBhcmdzID0gd3JpdGUgPyBbdmFsdWUsIG9sZFZhbHVlXSA6IFt2YWx1ZV07XG4gICAgICBvZmZzZXQgPSB3cml0ZSA/IDIgOiAxO1xuICAgICAgaWYgKGZpbHRlci5hcmdzKSB7XG4gICAgICAgIGZvciAoaiA9IDAsIGsgPSBmaWx0ZXIuYXJncy5sZW5ndGg7IGogPCBrOyBqKyspIHtcbiAgICAgICAgICBhcmcgPSBmaWx0ZXIuYXJnc1tqXTtcbiAgICAgICAgICBhcmdzW2ogKyBvZmZzZXRdID0gYXJnLmR5bmFtaWMgPyB0aGlzLiRnZXQoYXJnLnZhbHVlKSA6IGFyZy52YWx1ZTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgICAgdmFsdWUgPSBmbi5hcHBseSh0aGlzLCBhcmdzKTtcbiAgICB9XG4gICAgcmV0dXJuIHZhbHVlO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZXNvbHZlIGEgY29tcG9uZW50LCBkZXBlbmRpbmcgb24gd2hldGhlciB0aGUgY29tcG9uZW50XG4gICAqIGlzIGRlZmluZWQgbm9ybWFsbHkgb3IgdXNpbmcgYW4gYXN5bmMgZmFjdG9yeSBmdW5jdGlvbi5cbiAgICogUmVzb2x2ZXMgc3luY2hyb25vdXNseSBpZiBhbHJlYWR5IHJlc29sdmVkLCBvdGhlcndpc2VcbiAgICogcmVzb2x2ZXMgYXN5bmNocm9ub3VzbHkgYW5kIGNhY2hlcyB0aGUgcmVzb2x2ZWRcbiAgICogY29uc3RydWN0b3Igb24gdGhlIGZhY3RvcnkuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfEZ1bmN0aW9ufSB2YWx1ZVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYlxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLl9yZXNvbHZlQ29tcG9uZW50ID0gZnVuY3Rpb24gKHZhbHVlLCBjYikge1xuICAgIHZhciBmYWN0b3J5O1xuICAgIGlmICh0eXBlb2YgdmFsdWUgPT09ICdmdW5jdGlvbicpIHtcbiAgICAgIGZhY3RvcnkgPSB2YWx1ZTtcbiAgICB9IGVsc2Uge1xuICAgICAgZmFjdG9yeSA9IHJlc29sdmVBc3NldCh0aGlzLiRvcHRpb25zLCAnY29tcG9uZW50cycsIHZhbHVlLCB0cnVlKTtcbiAgICB9XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGlmICovXG4gICAgaWYgKCFmYWN0b3J5KSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuICAgIC8vIGFzeW5jIGNvbXBvbmVudCBmYWN0b3J5XG4gICAgaWYgKCFmYWN0b3J5Lm9wdGlvbnMpIHtcbiAgICAgIGlmIChmYWN0b3J5LnJlc29sdmVkKSB7XG4gICAgICAgIC8vIGNhY2hlZFxuICAgICAgICBjYihmYWN0b3J5LnJlc29sdmVkKTtcbiAgICAgIH0gZWxzZSBpZiAoZmFjdG9yeS5yZXF1ZXN0ZWQpIHtcbiAgICAgICAgLy8gcG9vbCBjYWxsYmFja3NcbiAgICAgICAgZmFjdG9yeS5wZW5kaW5nQ2FsbGJhY2tzLnB1c2goY2IpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgZmFjdG9yeS5yZXF1ZXN0ZWQgPSB0cnVlO1xuICAgICAgICB2YXIgY2JzID0gZmFjdG9yeS5wZW5kaW5nQ2FsbGJhY2tzID0gW2NiXTtcbiAgICAgICAgZmFjdG9yeS5jYWxsKHRoaXMsIGZ1bmN0aW9uIHJlc29sdmUocmVzKSB7XG4gICAgICAgICAgaWYgKGlzUGxhaW5PYmplY3QocmVzKSkge1xuICAgICAgICAgICAgcmVzID0gVnVlLmV4dGVuZChyZXMpO1xuICAgICAgICAgIH1cbiAgICAgICAgICAvLyBjYWNoZSByZXNvbHZlZFxuICAgICAgICAgIGZhY3RvcnkucmVzb2x2ZWQgPSByZXM7XG4gICAgICAgICAgLy8gaW52b2tlIGNhbGxiYWNrc1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gY2JzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgY2JzW2ldKHJlcyk7XG4gICAgICAgICAgfVxuICAgICAgICB9LCBmdW5jdGlvbiByZWplY3QocmVhc29uKSB7XG4gICAgICAgICAgcHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiB3YXJuKCdGYWlsZWQgdG8gcmVzb2x2ZSBhc3luYyBjb21wb25lbnQnICsgKHR5cGVvZiB2YWx1ZSA9PT0gJ3N0cmluZycgPyAnOiAnICsgdmFsdWUgOiAnJykgKyAnLiAnICsgKHJlYXNvbiA/ICdcXG5SZWFzb246ICcgKyByZWFzb24gOiAnJykpO1xuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbm9ybWFsIGNvbXBvbmVudFxuICAgICAgY2IoZmFjdG9yeSk7XG4gICAgfVxuICB9O1xufVxuXG52YXIgZmlsdGVyUkUkMSA9IC9bXnxdXFx8W158XS87XG5cbmZ1bmN0aW9uIGRhdGFBUEkgKFZ1ZSkge1xuICAvKipcbiAgICogR2V0IHRoZSB2YWx1ZSBmcm9tIGFuIGV4cHJlc3Npb24gb24gdGhpcyB2bS5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV4cFxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFthc1N0YXRlbWVudF1cbiAgICogQHJldHVybiB7Kn1cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kZ2V0ID0gZnVuY3Rpb24gKGV4cCwgYXNTdGF0ZW1lbnQpIHtcbiAgICB2YXIgcmVzID0gcGFyc2VFeHByZXNzaW9uKGV4cCk7XG4gICAgaWYgKHJlcykge1xuICAgICAgaWYgKGFzU3RhdGVtZW50KSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgcmV0dXJuIGZ1bmN0aW9uIHN0YXRlbWVudEhhbmRsZXIoKSB7XG4gICAgICAgICAgc2VsZi4kYXJndW1lbnRzID0gdG9BcnJheShhcmd1bWVudHMpO1xuICAgICAgICAgIHZhciByZXN1bHQgPSByZXMuZ2V0LmNhbGwoc2VsZiwgc2VsZik7XG4gICAgICAgICAgc2VsZi4kYXJndW1lbnRzID0gbnVsbDtcbiAgICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgICAgICB9O1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXR1cm4gcmVzLmdldC5jYWxsKHRoaXMsIHRoaXMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7fVxuICAgICAgfVxuICAgIH1cbiAgfTtcblxuICAvKipcbiAgICogU2V0IHRoZSB2YWx1ZSBmcm9tIGFuIGV4cHJlc3Npb24gb24gdGhpcyB2bS5cbiAgICogVGhlIGV4cHJlc3Npb24gbXVzdCBiZSBhIHZhbGlkIGxlZnQtaGFuZFxuICAgKiBleHByZXNzaW9uIGluIGFuIGFzc2lnbm1lbnQuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBleHBcbiAgICogQHBhcmFtIHsqfSB2YWxcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kc2V0ID0gZnVuY3Rpb24gKGV4cCwgdmFsKSB7XG4gICAgdmFyIHJlcyA9IHBhcnNlRXhwcmVzc2lvbihleHAsIHRydWUpO1xuICAgIGlmIChyZXMgJiYgcmVzLnNldCkge1xuICAgICAgcmVzLnNldC5jYWxsKHRoaXMsIHRoaXMsIHZhbCk7XG4gICAgfVxuICB9O1xuXG4gIC8qKlxuICAgKiBEZWxldGUgYSBwcm9wZXJ0eSBvbiB0aGUgVk1cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGtleVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRkZWxldGUgPSBmdW5jdGlvbiAoa2V5KSB7XG4gICAgZGVsKHRoaXMuX2RhdGEsIGtleSk7XG4gIH07XG5cbiAgLyoqXG4gICAqIFdhdGNoIGFuIGV4cHJlc3Npb24sIHRyaWdnZXIgY2FsbGJhY2sgd2hlbiBpdHNcbiAgICogdmFsdWUgY2hhbmdlcy5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd8RnVuY3Rpb259IGV4cE9yRm5cbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2JcbiAgICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICAgKiAgICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gZGVlcFxuICAgKiAgICAgICAgICAgICAgICAgLSB7Qm9vbGVhbn0gaW1tZWRpYXRlXG4gICAqIEByZXR1cm4ge0Z1bmN0aW9ufSAtIHVud2F0Y2hGblxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiR3YXRjaCA9IGZ1bmN0aW9uIChleHBPckZuLCBjYiwgb3B0aW9ucykge1xuICAgIHZhciB2bSA9IHRoaXM7XG4gICAgdmFyIHBhcnNlZDtcbiAgICBpZiAodHlwZW9mIGV4cE9yRm4gPT09ICdzdHJpbmcnKSB7XG4gICAgICBwYXJzZWQgPSBwYXJzZURpcmVjdGl2ZShleHBPckZuKTtcbiAgICAgIGV4cE9yRm4gPSBwYXJzZWQuZXhwcmVzc2lvbjtcbiAgICB9XG4gICAgdmFyIHdhdGNoZXIgPSBuZXcgV2F0Y2hlcih2bSwgZXhwT3JGbiwgY2IsIHtcbiAgICAgIGRlZXA6IG9wdGlvbnMgJiYgb3B0aW9ucy5kZWVwLFxuICAgICAgc3luYzogb3B0aW9ucyAmJiBvcHRpb25zLnN5bmMsXG4gICAgICBmaWx0ZXJzOiBwYXJzZWQgJiYgcGFyc2VkLmZpbHRlcnMsXG4gICAgICB1c2VyOiAhb3B0aW9ucyB8fCBvcHRpb25zLnVzZXIgIT09IGZhbHNlXG4gICAgfSk7XG4gICAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy5pbW1lZGlhdGUpIHtcbiAgICAgIGNiLmNhbGwodm0sIHdhdGNoZXIudmFsdWUpO1xuICAgIH1cbiAgICByZXR1cm4gZnVuY3Rpb24gdW53YXRjaEZuKCkge1xuICAgICAgd2F0Y2hlci50ZWFyZG93bigpO1xuICAgIH07XG4gIH07XG5cbiAgLyoqXG4gICAqIEV2YWx1YXRlIGEgdGV4dCBkaXJlY3RpdmUsIGluY2x1ZGluZyBmaWx0ZXJzLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gdGV4dFxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFthc1N0YXRlbWVudF1cbiAgICogQHJldHVybiB7U3RyaW5nfVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRldmFsID0gZnVuY3Rpb24gKHRleHQsIGFzU3RhdGVtZW50KSB7XG4gICAgLy8gY2hlY2sgZm9yIGZpbHRlcnMuXG4gICAgaWYgKGZpbHRlclJFJDEudGVzdCh0ZXh0KSkge1xuICAgICAgdmFyIGRpciA9IHBhcnNlRGlyZWN0aXZlKHRleHQpO1xuICAgICAgLy8gdGhlIGZpbHRlciByZWdleCBjaGVjayBtaWdodCBnaXZlIGZhbHNlIHBvc2l0aXZlXG4gICAgICAvLyBmb3IgcGlwZXMgaW5zaWRlIHN0cmluZ3MsIHNvIGl0J3MgcG9zc2libGUgdGhhdFxuICAgICAgLy8gd2UgZG9uJ3QgZ2V0IGFueSBmaWx0ZXJzIGhlcmVcbiAgICAgIHZhciB2YWwgPSB0aGlzLiRnZXQoZGlyLmV4cHJlc3Npb24sIGFzU3RhdGVtZW50KTtcbiAgICAgIHJldHVybiBkaXIuZmlsdGVycyA/IHRoaXMuX2FwcGx5RmlsdGVycyh2YWwsIG51bGwsIGRpci5maWx0ZXJzKSA6IHZhbDtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gbm8gZmlsdGVyXG4gICAgICByZXR1cm4gdGhpcy4kZ2V0KHRleHQsIGFzU3RhdGVtZW50KTtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIEludGVycG9sYXRlIGEgcGllY2Ugb2YgdGVtcGxhdGUgdGV4dC5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IHRleHRcbiAgICogQHJldHVybiB7U3RyaW5nfVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRpbnRlcnBvbGF0ZSA9IGZ1bmN0aW9uICh0ZXh0KSB7XG4gICAgdmFyIHRva2VucyA9IHBhcnNlVGV4dCh0ZXh0KTtcbiAgICB2YXIgdm0gPSB0aGlzO1xuICAgIGlmICh0b2tlbnMpIHtcbiAgICAgIGlmICh0b2tlbnMubGVuZ3RoID09PSAxKSB7XG4gICAgICAgIHJldHVybiB2bS4kZXZhbCh0b2tlbnNbMF0udmFsdWUpICsgJyc7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICByZXR1cm4gdG9rZW5zLm1hcChmdW5jdGlvbiAodG9rZW4pIHtcbiAgICAgICAgICByZXR1cm4gdG9rZW4udGFnID8gdm0uJGV2YWwodG9rZW4udmFsdWUpIDogdG9rZW4udmFsdWU7XG4gICAgICAgIH0pLmpvaW4oJycpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGV4dDtcbiAgICB9XG4gIH07XG5cbiAgLyoqXG4gICAqIExvZyBpbnN0YW5jZSBkYXRhIGFzIGEgcGxhaW4gSlMgb2JqZWN0XG4gICAqIHNvIHRoYXQgaXQgaXMgZWFzaWVyIHRvIGluc3BlY3QgaW4gY29uc29sZS5cbiAgICogVGhpcyBtZXRob2QgYXNzdW1lcyBjb25zb2xlIGlzIGF2YWlsYWJsZS5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IFtwYXRoXVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRsb2cgPSBmdW5jdGlvbiAocGF0aCkge1xuICAgIHZhciBkYXRhID0gcGF0aCA/IGdldFBhdGgodGhpcy5fZGF0YSwgcGF0aCkgOiB0aGlzLl9kYXRhO1xuICAgIGlmIChkYXRhKSB7XG4gICAgICBkYXRhID0gY2xlYW4oZGF0YSk7XG4gICAgfVxuICAgIC8vIGluY2x1ZGUgY29tcHV0ZWQgZmllbGRzXG4gICAgaWYgKCFwYXRoKSB7XG4gICAgICB2YXIga2V5O1xuICAgICAgZm9yIChrZXkgaW4gdGhpcy4kb3B0aW9ucy5jb21wdXRlZCkge1xuICAgICAgICBkYXRhW2tleV0gPSBjbGVhbih0aGlzW2tleV0pO1xuICAgICAgfVxuICAgICAgaWYgKHRoaXMuX3Byb3BzKSB7XG4gICAgICAgIGZvciAoa2V5IGluIHRoaXMuX3Byb3BzKSB7XG4gICAgICAgICAgZGF0YVtrZXldID0gY2xlYW4odGhpc1trZXldKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICBjb25zb2xlLmxvZyhkYXRhKTtcbiAgfTtcblxuICAvKipcbiAgICogXCJjbGVhblwiIGEgZ2V0dGVyL3NldHRlciBjb252ZXJ0ZWQgb2JqZWN0IGludG8gYSBwbGFpblxuICAgKiBvYmplY3QgY29weS5cbiAgICpcbiAgICogQHBhcmFtIHtPYmplY3R9IC0gb2JqXG4gICAqIEByZXR1cm4ge09iamVjdH1cbiAgICovXG5cbiAgZnVuY3Rpb24gY2xlYW4ob2JqKSB7XG4gICAgcmV0dXJuIEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZG9tQVBJIChWdWUpIHtcbiAgLyoqXG4gICAqIENvbnZlbmllbmNlIG9uLWluc3RhbmNlIG5leHRUaWNrLiBUaGUgY2FsbGJhY2sgaXNcbiAgICogYXV0by1ib3VuZCB0byB0aGUgaW5zdGFuY2UsIGFuZCB0aGlzIGF2b2lkcyBjb21wb25lbnRcbiAgICogbW9kdWxlcyBoYXZpbmcgdG8gcmVseSBvbiB0aGUgZ2xvYmFsIFZ1ZS5cbiAgICpcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kbmV4dFRpY2sgPSBmdW5jdGlvbiAoZm4pIHtcbiAgICBuZXh0VGljayhmbiwgdGhpcyk7XG4gIH07XG5cbiAgLyoqXG4gICAqIEFwcGVuZCBpbnN0YW5jZSB0byB0YXJnZXRcbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfSB0YXJnZXRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKiBAcGFyYW0ge0Jvb2xlYW59IFt3aXRoVHJhbnNpdGlvbl0gLSBkZWZhdWx0cyB0byB0cnVlXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuJGFwcGVuZFRvID0gZnVuY3Rpb24gKHRhcmdldCwgY2IsIHdpdGhUcmFuc2l0aW9uKSB7XG4gICAgcmV0dXJuIGluc2VydCh0aGlzLCB0YXJnZXQsIGNiLCB3aXRoVHJhbnNpdGlvbiwgYXBwZW5kLCBhcHBlbmRXaXRoVHJhbnNpdGlvbik7XG4gIH07XG5cbiAgLyoqXG4gICAqIFByZXBlbmQgaW5zdGFuY2UgdG8gdGFyZ2V0XG4gICAqXG4gICAqIEBwYXJhbSB7Tm9kZX0gdGFyZ2V0XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICogQHBhcmFtIHtCb29sZWFufSBbd2l0aFRyYW5zaXRpb25dIC0gZGVmYXVsdHMgdG8gdHJ1ZVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRwcmVwZW5kVG8gPSBmdW5jdGlvbiAodGFyZ2V0LCBjYiwgd2l0aFRyYW5zaXRpb24pIHtcbiAgICB0YXJnZXQgPSBxdWVyeSh0YXJnZXQpO1xuICAgIGlmICh0YXJnZXQuaGFzQ2hpbGROb2RlcygpKSB7XG4gICAgICB0aGlzLiRiZWZvcmUodGFyZ2V0LmZpcnN0Q2hpbGQsIGNiLCB3aXRoVHJhbnNpdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuJGFwcGVuZFRvKHRhcmdldCwgY2IsIHdpdGhUcmFuc2l0aW9uKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIEluc2VydCBpbnN0YW5jZSBiZWZvcmUgdGFyZ2V0XG4gICAqXG4gICAqIEBwYXJhbSB7Tm9kZX0gdGFyZ2V0XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICogQHBhcmFtIHtCb29sZWFufSBbd2l0aFRyYW5zaXRpb25dIC0gZGVmYXVsdHMgdG8gdHJ1ZVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRiZWZvcmUgPSBmdW5jdGlvbiAodGFyZ2V0LCBjYiwgd2l0aFRyYW5zaXRpb24pIHtcbiAgICByZXR1cm4gaW5zZXJ0KHRoaXMsIHRhcmdldCwgY2IsIHdpdGhUcmFuc2l0aW9uLCBiZWZvcmVXaXRoQ2IsIGJlZm9yZVdpdGhUcmFuc2l0aW9uKTtcbiAgfTtcblxuICAvKipcbiAgICogSW5zZXJ0IGluc3RhbmNlIGFmdGVyIHRhcmdldFxuICAgKlxuICAgKiBAcGFyYW0ge05vZGV9IHRhcmdldFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gW3dpdGhUcmFuc2l0aW9uXSAtIGRlZmF1bHRzIHRvIHRydWVcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kYWZ0ZXIgPSBmdW5jdGlvbiAodGFyZ2V0LCBjYiwgd2l0aFRyYW5zaXRpb24pIHtcbiAgICB0YXJnZXQgPSBxdWVyeSh0YXJnZXQpO1xuICAgIGlmICh0YXJnZXQubmV4dFNpYmxpbmcpIHtcbiAgICAgIHRoaXMuJGJlZm9yZSh0YXJnZXQubmV4dFNpYmxpbmcsIGNiLCB3aXRoVHJhbnNpdGlvbik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuJGFwcGVuZFRvKHRhcmdldC5wYXJlbnROb2RlLCBjYiwgd2l0aFRyYW5zaXRpb24pO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogUmVtb3ZlIGluc3RhbmNlIGZyb20gRE9NXG4gICAqXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICogQHBhcmFtIHtCb29sZWFufSBbd2l0aFRyYW5zaXRpb25dIC0gZGVmYXVsdHMgdG8gdHJ1ZVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRyZW1vdmUgPSBmdW5jdGlvbiAoY2IsIHdpdGhUcmFuc2l0aW9uKSB7XG4gICAgaWYgKCF0aGlzLiRlbC5wYXJlbnROb2RlKSB7XG4gICAgICByZXR1cm4gY2IgJiYgY2IoKTtcbiAgICB9XG4gICAgdmFyIGluRG9jdW1lbnQgPSB0aGlzLl9pc0F0dGFjaGVkICYmIGluRG9jKHRoaXMuJGVsKTtcbiAgICAvLyBpZiB3ZSBhcmUgbm90IGluIGRvY3VtZW50LCBubyBuZWVkIHRvIGNoZWNrXG4gICAgLy8gZm9yIHRyYW5zaXRpb25zXG4gICAgaWYgKCFpbkRvY3VtZW50KSB3aXRoVHJhbnNpdGlvbiA9IGZhbHNlO1xuICAgIHZhciBzZWxmID0gdGhpcztcbiAgICB2YXIgcmVhbENiID0gZnVuY3Rpb24gcmVhbENiKCkge1xuICAgICAgaWYgKGluRG9jdW1lbnQpIHNlbGYuX2NhbGxIb29rKCdkZXRhY2hlZCcpO1xuICAgICAgaWYgKGNiKSBjYigpO1xuICAgIH07XG4gICAgaWYgKHRoaXMuX2lzRnJhZ21lbnQpIHtcbiAgICAgIHJlbW92ZU5vZGVSYW5nZSh0aGlzLl9mcmFnbWVudFN0YXJ0LCB0aGlzLl9mcmFnbWVudEVuZCwgdGhpcywgdGhpcy5fZnJhZ21lbnQsIHJlYWxDYik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciBvcCA9IHdpdGhUcmFuc2l0aW9uID09PSBmYWxzZSA/IHJlbW92ZVdpdGhDYiA6IHJlbW92ZVdpdGhUcmFuc2l0aW9uO1xuICAgICAgb3AodGhpcy4kZWwsIHRoaXMsIHJlYWxDYik7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBTaGFyZWQgRE9NIGluc2VydGlvbiBmdW5jdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIHtWdWV9IHZtXG4gICAqIEBwYXJhbSB7RWxlbWVudH0gdGFyZ2V0XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYl1cbiAgICogQHBhcmFtIHtCb29sZWFufSBbd2l0aFRyYW5zaXRpb25dXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IG9wMSAtIG9wIGZvciBub24tdHJhbnNpdGlvbiBpbnNlcnRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gb3AyIC0gb3AgZm9yIHRyYW5zaXRpb24gaW5zZXJ0XG4gICAqIEByZXR1cm4gdm1cbiAgICovXG5cbiAgZnVuY3Rpb24gaW5zZXJ0KHZtLCB0YXJnZXQsIGNiLCB3aXRoVHJhbnNpdGlvbiwgb3AxLCBvcDIpIHtcbiAgICB0YXJnZXQgPSBxdWVyeSh0YXJnZXQpO1xuICAgIHZhciB0YXJnZXRJc0RldGFjaGVkID0gIWluRG9jKHRhcmdldCk7XG4gICAgdmFyIG9wID0gd2l0aFRyYW5zaXRpb24gPT09IGZhbHNlIHx8IHRhcmdldElzRGV0YWNoZWQgPyBvcDEgOiBvcDI7XG4gICAgdmFyIHNob3VsZENhbGxIb29rID0gIXRhcmdldElzRGV0YWNoZWQgJiYgIXZtLl9pc0F0dGFjaGVkICYmICFpbkRvYyh2bS4kZWwpO1xuICAgIGlmICh2bS5faXNGcmFnbWVudCkge1xuICAgICAgbWFwTm9kZVJhbmdlKHZtLl9mcmFnbWVudFN0YXJ0LCB2bS5fZnJhZ21lbnRFbmQsIGZ1bmN0aW9uIChub2RlKSB7XG4gICAgICAgIG9wKG5vZGUsIHRhcmdldCwgdm0pO1xuICAgICAgfSk7XG4gICAgICBjYiAmJiBjYigpO1xuICAgIH0gZWxzZSB7XG4gICAgICBvcCh2bS4kZWwsIHRhcmdldCwgdm0sIGNiKTtcbiAgICB9XG4gICAgaWYgKHNob3VsZENhbGxIb29rKSB7XG4gICAgICB2bS5fY2FsbEhvb2soJ2F0dGFjaGVkJyk7XG4gICAgfVxuICAgIHJldHVybiB2bTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDaGVjayBmb3Igc2VsZWN0b3JzXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfEVsZW1lbnR9IGVsXG4gICAqL1xuXG4gIGZ1bmN0aW9uIHF1ZXJ5KGVsKSB7XG4gICAgcmV0dXJuIHR5cGVvZiBlbCA9PT0gJ3N0cmluZycgPyBkb2N1bWVudC5xdWVyeVNlbGVjdG9yKGVsKSA6IGVsO1xuICB9XG5cbiAgLyoqXG4gICAqIEFwcGVuZCBvcGVyYXRpb24gdGhhdCB0YWtlcyBhIGNhbGxiYWNrLlxuICAgKlxuICAgKiBAcGFyYW0ge05vZGV9IGVsXG4gICAqIEBwYXJhbSB7Tm9kZX0gdGFyZ2V0XG4gICAqIEBwYXJhbSB7VnVlfSB2bSAtIHVudXNlZFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2JdXG4gICAqL1xuXG4gIGZ1bmN0aW9uIGFwcGVuZChlbCwgdGFyZ2V0LCB2bSwgY2IpIHtcbiAgICB0YXJnZXQuYXBwZW5kQ2hpbGQoZWwpO1xuICAgIGlmIChjYikgY2IoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBJbnNlcnRCZWZvcmUgb3BlcmF0aW9uIHRoYXQgdGFrZXMgYSBjYWxsYmFjay5cbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfSBlbFxuICAgKiBAcGFyYW0ge05vZGV9IHRhcmdldFxuICAgKiBAcGFyYW0ge1Z1ZX0gdm0gLSB1bnVzZWRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKi9cblxuICBmdW5jdGlvbiBiZWZvcmVXaXRoQ2IoZWwsIHRhcmdldCwgdm0sIGNiKSB7XG4gICAgYmVmb3JlKGVsLCB0YXJnZXQpO1xuICAgIGlmIChjYikgY2IoKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBSZW1vdmUgb3BlcmF0aW9uIHRoYXQgdGFrZXMgYSBjYWxsYmFjay5cbiAgICpcbiAgICogQHBhcmFtIHtOb2RlfSBlbFxuICAgKiBAcGFyYW0ge1Z1ZX0gdm0gLSB1bnVzZWRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gW2NiXVxuICAgKi9cblxuICBmdW5jdGlvbiByZW1vdmVXaXRoQ2IoZWwsIHZtLCBjYikge1xuICAgIHJlbW92ZShlbCk7XG4gICAgaWYgKGNiKSBjYigpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGV2ZW50c0FQSSAoVnVlKSB7XG4gIC8qKlxuICAgKiBMaXN0ZW4gb24gdGhlIGdpdmVuIGBldmVudGAgd2l0aCBgZm5gLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kb24gPSBmdW5jdGlvbiAoZXZlbnQsIGZuKSB7XG4gICAgKHRoaXMuX2V2ZW50c1tldmVudF0gfHwgKHRoaXMuX2V2ZW50c1tldmVudF0gPSBbXSkpLnB1c2goZm4pO1xuICAgIG1vZGlmeUxpc3RlbmVyQ291bnQodGhpcywgZXZlbnQsIDEpO1xuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBZGRzIGFuIGBldmVudGAgbGlzdGVuZXIgdGhhdCB3aWxsIGJlIGludm9rZWQgYSBzaW5nbGVcbiAgICogdGltZSB0aGVuIGF1dG9tYXRpY2FsbHkgcmVtb3ZlZC5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGZuXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuJG9uY2UgPSBmdW5jdGlvbiAoZXZlbnQsIGZuKSB7XG4gICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgIGZ1bmN0aW9uIG9uKCkge1xuICAgICAgc2VsZi4kb2ZmKGV2ZW50LCBvbik7XG4gICAgICBmbi5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH1cbiAgICBvbi5mbiA9IGZuO1xuICAgIHRoaXMuJG9uKGV2ZW50LCBvbik7XG4gICAgcmV0dXJuIHRoaXM7XG4gIH07XG5cbiAgLyoqXG4gICAqIFJlbW92ZSB0aGUgZ2l2ZW4gY2FsbGJhY2sgZm9yIGBldmVudGAgb3IgYWxsXG4gICAqIHJlZ2lzdGVyZWQgY2FsbGJhY2tzLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gZXZlbnRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gZm5cbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kb2ZmID0gZnVuY3Rpb24gKGV2ZW50LCBmbikge1xuICAgIHZhciBjYnM7XG4gICAgLy8gYWxsXG4gICAgaWYgKCFhcmd1bWVudHMubGVuZ3RoKSB7XG4gICAgICBpZiAodGhpcy4kcGFyZW50KSB7XG4gICAgICAgIGZvciAoZXZlbnQgaW4gdGhpcy5fZXZlbnRzKSB7XG4gICAgICAgICAgY2JzID0gdGhpcy5fZXZlbnRzW2V2ZW50XTtcbiAgICAgICAgICBpZiAoY2JzKSB7XG4gICAgICAgICAgICBtb2RpZnlMaXN0ZW5lckNvdW50KHRoaXMsIGV2ZW50LCAtY2JzLmxlbmd0aCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICB9XG4gICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICAvLyBzcGVjaWZpYyBldmVudFxuICAgIGNicyA9IHRoaXMuX2V2ZW50c1tldmVudF07XG4gICAgaWYgKCFjYnMpIHtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cbiAgICBpZiAoYXJndW1lbnRzLmxlbmd0aCA9PT0gMSkge1xuICAgICAgbW9kaWZ5TGlzdGVuZXJDb3VudCh0aGlzLCBldmVudCwgLWNicy5sZW5ndGgpO1xuICAgICAgdGhpcy5fZXZlbnRzW2V2ZW50XSA9IG51bGw7XG4gICAgICByZXR1cm4gdGhpcztcbiAgICB9XG4gICAgLy8gc3BlY2lmaWMgaGFuZGxlclxuICAgIHZhciBjYjtcbiAgICB2YXIgaSA9IGNicy5sZW5ndGg7XG4gICAgd2hpbGUgKGktLSkge1xuICAgICAgY2IgPSBjYnNbaV07XG4gICAgICBpZiAoY2IgPT09IGZuIHx8IGNiLmZuID09PSBmbikge1xuICAgICAgICBtb2RpZnlMaXN0ZW5lckNvdW50KHRoaXMsIGV2ZW50LCAtMSk7XG4gICAgICAgIGNicy5zcGxpY2UoaSwgMSk7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogVHJpZ2dlciBhbiBldmVudCBvbiBzZWxmLlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ3xPYmplY3R9IGV2ZW50XG4gICAqIEByZXR1cm4ge0Jvb2xlYW59IHNob3VsZFByb3BhZ2F0ZVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRlbWl0ID0gZnVuY3Rpb24gKGV2ZW50KSB7XG4gICAgdmFyIGlzU291cmNlID0gdHlwZW9mIGV2ZW50ID09PSAnc3RyaW5nJztcbiAgICBldmVudCA9IGlzU291cmNlID8gZXZlbnQgOiBldmVudC5uYW1lO1xuICAgIHZhciBjYnMgPSB0aGlzLl9ldmVudHNbZXZlbnRdO1xuICAgIHZhciBzaG91bGRQcm9wYWdhdGUgPSBpc1NvdXJjZSB8fCAhY2JzO1xuICAgIGlmIChjYnMpIHtcbiAgICAgIGNicyA9IGNicy5sZW5ndGggPiAxID8gdG9BcnJheShjYnMpIDogY2JzO1xuICAgICAgLy8gdGhpcyBpcyBhIHNvbWV3aGF0IGhhY2t5IHNvbHV0aW9uIHRvIHRoZSBxdWVzdGlvbiByYWlzZWRcbiAgICAgIC8vIGluICMyMTAyOiBmb3IgYW4gaW5saW5lIGNvbXBvbmVudCBsaXN0ZW5lciBsaWtlIDxjb21wIEB0ZXN0PVwiZG9UaGlzXCI+LFxuICAgICAgLy8gdGhlIHByb3BhZ2F0aW9uIGhhbmRsaW5nIGlzIHNvbWV3aGF0IGJyb2tlbi4gVGhlcmVmb3JlIHdlXG4gICAgICAvLyBuZWVkIHRvIHRyZWF0IHRoZXNlIGlubGluZSBjYWxsYmFja3MgZGlmZmVyZW50bHkuXG4gICAgICB2YXIgaGFzUGFyZW50Q2JzID0gaXNTb3VyY2UgJiYgY2JzLnNvbWUoZnVuY3Rpb24gKGNiKSB7XG4gICAgICAgIHJldHVybiBjYi5fZnJvbVBhcmVudDtcbiAgICAgIH0pO1xuICAgICAgaWYgKGhhc1BhcmVudENicykge1xuICAgICAgICBzaG91bGRQcm9wYWdhdGUgPSBmYWxzZTtcbiAgICAgIH1cbiAgICAgIHZhciBhcmdzID0gdG9BcnJheShhcmd1bWVudHMsIDEpO1xuICAgICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjYnMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIHZhciBjYiA9IGNic1tpXTtcbiAgICAgICAgdmFyIHJlcyA9IGNiLmFwcGx5KHRoaXMsIGFyZ3MpO1xuICAgICAgICBpZiAocmVzID09PSB0cnVlICYmICghaGFzUGFyZW50Q2JzIHx8IGNiLl9mcm9tUGFyZW50KSkge1xuICAgICAgICAgIHNob3VsZFByb3BhZ2F0ZSA9IHRydWU7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIHNob3VsZFByb3BhZ2F0ZTtcbiAgfTtcblxuICAvKipcbiAgICogUmVjdXJzaXZlbHkgYnJvYWRjYXN0IGFuIGV2ZW50IHRvIGFsbCBjaGlsZHJlbiBpbnN0YW5jZXMuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfE9iamVjdH0gZXZlbnRcbiAgICogQHBhcmFtIHsuLi4qfSBhZGRpdGlvbmFsIGFyZ3VtZW50c1xuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRicm9hZGNhc3QgPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICB2YXIgaXNTb3VyY2UgPSB0eXBlb2YgZXZlbnQgPT09ICdzdHJpbmcnO1xuICAgIGV2ZW50ID0gaXNTb3VyY2UgPyBldmVudCA6IGV2ZW50Lm5hbWU7XG4gICAgLy8gaWYgbm8gY2hpbGQgaGFzIHJlZ2lzdGVyZWQgZm9yIHRoaXMgZXZlbnQsXG4gICAgLy8gdGhlbiB0aGVyZSdzIG5vIG5lZWQgdG8gYnJvYWRjYXN0LlxuICAgIGlmICghdGhpcy5fZXZlbnRzQ291bnRbZXZlbnRdKSByZXR1cm47XG4gICAgdmFyIGNoaWxkcmVuID0gdGhpcy4kY2hpbGRyZW47XG4gICAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cyk7XG4gICAgaWYgKGlzU291cmNlKSB7XG4gICAgICAvLyB1c2Ugb2JqZWN0IGV2ZW50IHRvIGluZGljYXRlIG5vbi1zb3VyY2UgZW1pdFxuICAgICAgLy8gb24gY2hpbGRyZW5cbiAgICAgIGFyZ3NbMF0gPSB7IG5hbWU6IGV2ZW50LCBzb3VyY2U6IHRoaXMgfTtcbiAgICB9XG4gICAgZm9yICh2YXIgaSA9IDAsIGwgPSBjaGlsZHJlbi5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICAgIHZhciBjaGlsZCA9IGNoaWxkcmVuW2ldO1xuICAgICAgdmFyIHNob3VsZFByb3BhZ2F0ZSA9IGNoaWxkLiRlbWl0LmFwcGx5KGNoaWxkLCBhcmdzKTtcbiAgICAgIGlmIChzaG91bGRQcm9wYWdhdGUpIHtcbiAgICAgICAgY2hpbGQuJGJyb2FkY2FzdC5hcHBseShjaGlsZCwgYXJncyk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBSZWN1cnNpdmVseSBwcm9wYWdhdGUgYW4gZXZlbnQgdXAgdGhlIHBhcmVudCBjaGFpbi5cbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gICAqIEBwYXJhbSB7Li4uKn0gYWRkaXRpb25hbCBhcmd1bWVudHNcbiAgICovXG5cbiAgVnVlLnByb3RvdHlwZS4kZGlzcGF0Y2ggPSBmdW5jdGlvbiAoZXZlbnQpIHtcbiAgICB2YXIgc2hvdWxkUHJvcGFnYXRlID0gdGhpcy4kZW1pdC5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIGlmICghc2hvdWxkUHJvcGFnYXRlKSByZXR1cm47XG4gICAgdmFyIHBhcmVudCA9IHRoaXMuJHBhcmVudDtcbiAgICB2YXIgYXJncyA9IHRvQXJyYXkoYXJndW1lbnRzKTtcbiAgICAvLyB1c2Ugb2JqZWN0IGV2ZW50IHRvIGluZGljYXRlIG5vbi1zb3VyY2UgZW1pdFxuICAgIC8vIG9uIHBhcmVudHNcbiAgICBhcmdzWzBdID0geyBuYW1lOiBldmVudCwgc291cmNlOiB0aGlzIH07XG4gICAgd2hpbGUgKHBhcmVudCkge1xuICAgICAgc2hvdWxkUHJvcGFnYXRlID0gcGFyZW50LiRlbWl0LmFwcGx5KHBhcmVudCwgYXJncyk7XG4gICAgICBwYXJlbnQgPSBzaG91bGRQcm9wYWdhdGUgPyBwYXJlbnQuJHBhcmVudCA6IG51bGw7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBNb2RpZnkgdGhlIGxpc3RlbmVyIGNvdW50cyBvbiBhbGwgcGFyZW50cy5cbiAgICogVGhpcyBib29ra2VlcGluZyBhbGxvd3MgJGJyb2FkY2FzdCB0byByZXR1cm4gZWFybHkgd2hlblxuICAgKiBubyBjaGlsZCBoYXMgbGlzdGVuZWQgdG8gYSBjZXJ0YWluIGV2ZW50LlxuICAgKlxuICAgKiBAcGFyYW0ge1Z1ZX0gdm1cbiAgICogQHBhcmFtIHtTdHJpbmd9IGV2ZW50XG4gICAqIEBwYXJhbSB7TnVtYmVyfSBjb3VudFxuICAgKi9cblxuICB2YXIgaG9va1JFID0gL15ob29rOi87XG4gIGZ1bmN0aW9uIG1vZGlmeUxpc3RlbmVyQ291bnQodm0sIGV2ZW50LCBjb3VudCkge1xuICAgIHZhciBwYXJlbnQgPSB2bS4kcGFyZW50O1xuICAgIC8vIGhvb2tzIGRvIG5vdCBnZXQgYnJvYWRjYXN0ZWQgc28gbm8gbmVlZFxuICAgIC8vIHRvIGRvIGJvb2trZWVwaW5nIGZvciB0aGVtXG4gICAgaWYgKCFwYXJlbnQgfHwgIWNvdW50IHx8IGhvb2tSRS50ZXN0KGV2ZW50KSkgcmV0dXJuO1xuICAgIHdoaWxlIChwYXJlbnQpIHtcbiAgICAgIHBhcmVudC5fZXZlbnRzQ291bnRbZXZlbnRdID0gKHBhcmVudC5fZXZlbnRzQ291bnRbZXZlbnRdIHx8IDApICsgY291bnQ7XG4gICAgICBwYXJlbnQgPSBwYXJlbnQuJHBhcmVudDtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gbGlmZWN5Y2xlQVBJIChWdWUpIHtcbiAgLyoqXG4gICAqIFNldCBpbnN0YW5jZSB0YXJnZXQgZWxlbWVudCBhbmQga2ljayBvZmYgdGhlIGNvbXBpbGF0aW9uXG4gICAqIHByb2Nlc3MuIFRoZSBwYXNzZWQgaW4gYGVsYCBjYW4gYmUgYSBzZWxlY3RvciBzdHJpbmcsIGFuXG4gICAqIGV4aXN0aW5nIEVsZW1lbnQsIG9yIGEgRG9jdW1lbnRGcmFnbWVudCAoZm9yIGJsb2NrXG4gICAqIGluc3RhbmNlcykuXG4gICAqXG4gICAqIEBwYXJhbSB7RWxlbWVudHxEb2N1bWVudEZyYWdtZW50fHN0cmluZ30gZWxcbiAgICogQHB1YmxpY1xuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRtb3VudCA9IGZ1bmN0aW9uIChlbCkge1xuICAgIGlmICh0aGlzLl9pc0NvbXBpbGVkKSB7XG4gICAgICBwcm9jZXNzLmVudi5OT0RFX0VOViAhPT0gJ3Byb2R1Y3Rpb24nICYmIHdhcm4oJyRtb3VudCgpIHNob3VsZCBiZSBjYWxsZWQgb25seSBvbmNlLicsIHRoaXMpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBlbCA9IHF1ZXJ5KGVsKTtcbiAgICBpZiAoIWVsKSB7XG4gICAgICBlbCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICAgIH1cbiAgICB0aGlzLl9jb21waWxlKGVsKTtcbiAgICB0aGlzLl9pbml0RE9NSG9va3MoKTtcbiAgICBpZiAoaW5Eb2ModGhpcy4kZWwpKSB7XG4gICAgICB0aGlzLl9jYWxsSG9vaygnYXR0YWNoZWQnKTtcbiAgICAgIHJlYWR5LmNhbGwodGhpcyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuJG9uY2UoJ2hvb2s6YXR0YWNoZWQnLCByZWFkeSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9O1xuXG4gIC8qKlxuICAgKiBNYXJrIGFuIGluc3RhbmNlIGFzIHJlYWR5LlxuICAgKi9cblxuICBmdW5jdGlvbiByZWFkeSgpIHtcbiAgICB0aGlzLl9pc0F0dGFjaGVkID0gdHJ1ZTtcbiAgICB0aGlzLl9pc1JlYWR5ID0gdHJ1ZTtcbiAgICB0aGlzLl9jYWxsSG9vaygncmVhZHknKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBUZWFyZG93biB0aGUgaW5zdGFuY2UsIHNpbXBseSBkZWxlZ2F0ZSB0byB0aGUgaW50ZXJuYWxcbiAgICogX2Rlc3Ryb3kuXG4gICAqXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gcmVtb3ZlXG4gICAqIEBwYXJhbSB7Qm9vbGVhbn0gZGVmZXJDbGVhbnVwXG4gICAqL1xuXG4gIFZ1ZS5wcm90b3R5cGUuJGRlc3Ryb3kgPSBmdW5jdGlvbiAocmVtb3ZlLCBkZWZlckNsZWFudXApIHtcbiAgICB0aGlzLl9kZXN0cm95KHJlbW92ZSwgZGVmZXJDbGVhbnVwKTtcbiAgfTtcblxuICAvKipcbiAgICogUGFydGlhbGx5IGNvbXBpbGUgYSBwaWVjZSBvZiBET00gYW5kIHJldHVybiBhXG4gICAqIGRlY29tcGlsZSBmdW5jdGlvbi5cbiAgICpcbiAgICogQHBhcmFtIHtFbGVtZW50fERvY3VtZW50RnJhZ21lbnR9IGVsXG4gICAqIEBwYXJhbSB7VnVlfSBbaG9zdF1cbiAgICogQHBhcmFtIHtPYmplY3R9IFtzY29wZV1cbiAgICogQHBhcmFtIHtGcmFnbWVudH0gW2ZyYWddXG4gICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgKi9cblxuICBWdWUucHJvdG90eXBlLiRjb21waWxlID0gZnVuY3Rpb24gKGVsLCBob3N0LCBzY29wZSwgZnJhZykge1xuICAgIHJldHVybiBjb21waWxlKGVsLCB0aGlzLiRvcHRpb25zLCB0cnVlKSh0aGlzLCBlbCwgaG9zdCwgc2NvcGUsIGZyYWcpO1xuICB9O1xufVxuXG4vKipcbiAqIFRoZSBleHBvc2VkIFZ1ZSBjb25zdHJ1Y3Rvci5cbiAqXG4gKiBBUEkgY29udmVudGlvbnM6XG4gKiAtIHB1YmxpYyBBUEkgbWV0aG9kcy9wcm9wZXJ0aWVzIGFyZSBwcmVmaXhlZCB3aXRoIGAkYFxuICogLSBpbnRlcm5hbCBtZXRob2RzL3Byb3BlcnRpZXMgYXJlIHByZWZpeGVkIHdpdGggYF9gXG4gKiAtIG5vbi1wcmVmaXhlZCBwcm9wZXJ0aWVzIGFyZSBhc3N1bWVkIHRvIGJlIHByb3hpZWQgdXNlclxuICogICBkYXRhLlxuICpcbiAqIEBjb25zdHJ1Y3RvclxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zXVxuICogQHB1YmxpY1xuICovXG5cbmZ1bmN0aW9uIFZ1ZShvcHRpb25zKSB7XG4gIHRoaXMuX2luaXQob3B0aW9ucyk7XG59XG5cbi8vIGluc3RhbGwgaW50ZXJuYWxzXG5pbml0TWl4aW4oVnVlKTtcbnN0YXRlTWl4aW4oVnVlKTtcbmV2ZW50c01peGluKFZ1ZSk7XG5saWZlY3ljbGVNaXhpbihWdWUpO1xubWlzY01peGluKFZ1ZSk7XG5cbi8vIGluc3RhbGwgaW5zdGFuY2UgQVBJc1xuZGF0YUFQSShWdWUpO1xuZG9tQVBJKFZ1ZSk7XG5ldmVudHNBUEkoVnVlKTtcbmxpZmVjeWNsZUFQSShWdWUpO1xuXG52YXIgc2xvdCA9IHtcblxuICBwcmlvcml0eTogU0xPVCxcbiAgcGFyYW1zOiBbJ25hbWUnXSxcblxuICBiaW5kOiBmdW5jdGlvbiBiaW5kKCkge1xuICAgIC8vIHRoaXMgd2FzIHJlc29sdmVkIGR1cmluZyBjb21wb25lbnQgdHJhbnNjbHVzaW9uXG4gICAgdmFyIG5hbWUgPSB0aGlzLnBhcmFtcy5uYW1lIHx8ICdkZWZhdWx0JztcbiAgICB2YXIgY29udGVudCA9IHRoaXMudm0uX3Nsb3RDb250ZW50cyAmJiB0aGlzLnZtLl9zbG90Q29udGVudHNbbmFtZV07XG4gICAgaWYgKCFjb250ZW50IHx8ICFjb250ZW50Lmhhc0NoaWxkTm9kZXMoKSkge1xuICAgICAgdGhpcy5mYWxsYmFjaygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmNvbXBpbGUoY29udGVudC5jbG9uZU5vZGUodHJ1ZSksIHRoaXMudm0uX2NvbnRleHQsIHRoaXMudm0pO1xuICAgIH1cbiAgfSxcblxuICBjb21waWxlOiBmdW5jdGlvbiBjb21waWxlKGNvbnRlbnQsIGNvbnRleHQsIGhvc3QpIHtcbiAgICBpZiAoY29udGVudCAmJiBjb250ZXh0KSB7XG4gICAgICBpZiAodGhpcy5lbC5oYXNDaGlsZE5vZGVzKCkgJiYgY29udGVudC5jaGlsZE5vZGVzLmxlbmd0aCA9PT0gMSAmJiBjb250ZW50LmNoaWxkTm9kZXNbMF0ubm9kZVR5cGUgPT09IDEgJiYgY29udGVudC5jaGlsZE5vZGVzWzBdLmhhc0F0dHJpYnV0ZSgndi1pZicpKSB7XG4gICAgICAgIC8vIGlmIHRoZSBpbnNlcnRlZCBzbG90IGhhcyB2LWlmXG4gICAgICAgIC8vIGluamVjdCBmYWxsYmFjayBjb250ZW50IGFzIHRoZSB2LWVsc2VcbiAgICAgICAgdmFyIGVsc2VCbG9jayA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3RlbXBsYXRlJyk7XG4gICAgICAgIGVsc2VCbG9jay5zZXRBdHRyaWJ1dGUoJ3YtZWxzZScsICcnKTtcbiAgICAgICAgZWxzZUJsb2NrLmlubmVySFRNTCA9IHRoaXMuZWwuaW5uZXJIVE1MO1xuICAgICAgICAvLyB0aGUgZWxzZSBibG9jayBzaG91bGQgYmUgY29tcGlsZWQgaW4gY2hpbGQgc2NvcGVcbiAgICAgICAgZWxzZUJsb2NrLl9jb250ZXh0ID0gdGhpcy52bTtcbiAgICAgICAgY29udGVudC5hcHBlbmRDaGlsZChlbHNlQmxvY2spO1xuICAgICAgfVxuICAgICAgdmFyIHNjb3BlID0gaG9zdCA/IGhvc3QuX3Njb3BlIDogdGhpcy5fc2NvcGU7XG4gICAgICB0aGlzLnVubGluayA9IGNvbnRleHQuJGNvbXBpbGUoY29udGVudCwgaG9zdCwgc2NvcGUsIHRoaXMuX2ZyYWcpO1xuICAgIH1cbiAgICBpZiAoY29udGVudCkge1xuICAgICAgcmVwbGFjZSh0aGlzLmVsLCBjb250ZW50KTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmVtb3ZlKHRoaXMuZWwpO1xuICAgIH1cbiAgfSxcblxuICBmYWxsYmFjazogZnVuY3Rpb24gZmFsbGJhY2soKSB7XG4gICAgdGhpcy5jb21waWxlKGV4dHJhY3RDb250ZW50KHRoaXMuZWwsIHRydWUpLCB0aGlzLnZtKTtcbiAgfSxcblxuICB1bmJpbmQ6IGZ1bmN0aW9uIHVuYmluZCgpIHtcbiAgICBpZiAodGhpcy51bmxpbmspIHtcbiAgICAgIHRoaXMudW5saW5rKCk7XG4gICAgfVxuICB9XG59O1xuXG52YXIgcGFydGlhbCA9IHtcblxuICBwcmlvcml0eTogUEFSVElBTCxcblxuICBwYXJhbXM6IFsnbmFtZSddLFxuXG4gIC8vIHdhdGNoIGNoYW5nZXMgdG8gbmFtZSBmb3IgZHluYW1pYyBwYXJ0aWFsc1xuICBwYXJhbVdhdGNoZXJzOiB7XG4gICAgbmFtZTogZnVuY3Rpb24gbmFtZSh2YWx1ZSkge1xuICAgICAgdklmLnJlbW92ZS5jYWxsKHRoaXMpO1xuICAgICAgaWYgKHZhbHVlKSB7XG4gICAgICAgIHRoaXMuaW5zZXJ0KHZhbHVlKTtcbiAgICAgIH1cbiAgICB9XG4gIH0sXG5cbiAgYmluZDogZnVuY3Rpb24gYmluZCgpIHtcbiAgICB0aGlzLmFuY2hvciA9IGNyZWF0ZUFuY2hvcigndi1wYXJ0aWFsJyk7XG4gICAgcmVwbGFjZSh0aGlzLmVsLCB0aGlzLmFuY2hvcik7XG4gICAgdGhpcy5pbnNlcnQodGhpcy5wYXJhbXMubmFtZSk7XG4gIH0sXG5cbiAgaW5zZXJ0OiBmdW5jdGlvbiBpbnNlcnQoaWQpIHtcbiAgICB2YXIgcGFydGlhbCA9IHJlc29sdmVBc3NldCh0aGlzLnZtLiRvcHRpb25zLCAncGFydGlhbHMnLCBpZCwgdHJ1ZSk7XG4gICAgaWYgKHBhcnRpYWwpIHtcbiAgICAgIHRoaXMuZmFjdG9yeSA9IG5ldyBGcmFnbWVudEZhY3RvcnkodGhpcy52bSwgcGFydGlhbCk7XG4gICAgICB2SWYuaW5zZXJ0LmNhbGwodGhpcyk7XG4gICAgfVxuICB9LFxuXG4gIHVuYmluZDogZnVuY3Rpb24gdW5iaW5kKCkge1xuICAgIGlmICh0aGlzLmZyYWcpIHtcbiAgICAgIHRoaXMuZnJhZy5kZXN0cm95KCk7XG4gICAgfVxuICB9XG59O1xuXG52YXIgZWxlbWVudERpcmVjdGl2ZXMgPSB7XG4gIHNsb3Q6IHNsb3QsXG4gIHBhcnRpYWw6IHBhcnRpYWxcbn07XG5cbnZhciBjb252ZXJ0QXJyYXkgPSB2Rm9yLl9wb3N0UHJvY2VzcztcblxuLyoqXG4gKiBMaW1pdCBmaWx0ZXIgZm9yIGFycmF5c1xuICpcbiAqIEBwYXJhbSB7TnVtYmVyfSBuXG4gKiBAcGFyYW0ge051bWJlcn0gb2Zmc2V0IChEZWNpbWFsIGV4cGVjdGVkKVxuICovXG5cbmZ1bmN0aW9uIGxpbWl0QnkoYXJyLCBuLCBvZmZzZXQpIHtcbiAgb2Zmc2V0ID0gb2Zmc2V0ID8gcGFyc2VJbnQob2Zmc2V0LCAxMCkgOiAwO1xuICBuID0gdG9OdW1iZXIobik7XG4gIHJldHVybiB0eXBlb2YgbiA9PT0gJ251bWJlcicgPyBhcnIuc2xpY2Uob2Zmc2V0LCBvZmZzZXQgKyBuKSA6IGFycjtcbn1cblxuLyoqXG4gKiBGaWx0ZXIgZmlsdGVyIGZvciBhcnJheXNcbiAqXG4gKiBAcGFyYW0ge1N0cmluZ30gc2VhcmNoXG4gKiBAcGFyYW0ge1N0cmluZ30gW2RlbGltaXRlcl1cbiAqIEBwYXJhbSB7U3RyaW5nfSAuLi5kYXRhS2V5c1xuICovXG5cbmZ1bmN0aW9uIGZpbHRlckJ5KGFyciwgc2VhcmNoLCBkZWxpbWl0ZXIpIHtcbiAgYXJyID0gY29udmVydEFycmF5KGFycik7XG4gIGlmIChzZWFyY2ggPT0gbnVsbCkge1xuICAgIHJldHVybiBhcnI7XG4gIH1cbiAgaWYgKHR5cGVvZiBzZWFyY2ggPT09ICdmdW5jdGlvbicpIHtcbiAgICByZXR1cm4gYXJyLmZpbHRlcihzZWFyY2gpO1xuICB9XG4gIC8vIGNhc3QgdG8gbG93ZXJjYXNlIHN0cmluZ1xuICBzZWFyY2ggPSAoJycgKyBzZWFyY2gpLnRvTG93ZXJDYXNlKCk7XG4gIC8vIGFsbG93IG9wdGlvbmFsIGBpbmAgZGVsaW1pdGVyXG4gIC8vIGJlY2F1c2Ugd2h5IG5vdFxuICB2YXIgbiA9IGRlbGltaXRlciA9PT0gJ2luJyA/IDMgOiAyO1xuICAvLyBleHRyYWN0IGFuZCBmbGF0dGVuIGtleXNcbiAgdmFyIGtleXMgPSBBcnJheS5wcm90b3R5cGUuY29uY2F0LmFwcGx5KFtdLCB0b0FycmF5KGFyZ3VtZW50cywgbikpO1xuICB2YXIgcmVzID0gW107XG4gIHZhciBpdGVtLCBrZXksIHZhbCwgajtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSBhcnIubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgaXRlbSA9IGFycltpXTtcbiAgICB2YWwgPSBpdGVtICYmIGl0ZW0uJHZhbHVlIHx8IGl0ZW07XG4gICAgaiA9IGtleXMubGVuZ3RoO1xuICAgIGlmIChqKSB7XG4gICAgICB3aGlsZSAoai0tKSB7XG4gICAgICAgIGtleSA9IGtleXNbal07XG4gICAgICAgIGlmIChrZXkgPT09ICcka2V5JyAmJiBjb250YWlucyhpdGVtLiRrZXksIHNlYXJjaCkgfHwgY29udGFpbnMoZ2V0UGF0aCh2YWwsIGtleSksIHNlYXJjaCkpIHtcbiAgICAgICAgICByZXMucHVzaChpdGVtKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoY29udGFpbnMoaXRlbSwgc2VhcmNoKSkge1xuICAgICAgcmVzLnB1c2goaXRlbSk7XG4gICAgfVxuICB9XG4gIHJldHVybiByZXM7XG59XG5cbi8qKlxuICogRmlsdGVyIGZpbHRlciBmb3IgYXJyYXlzXG4gKlxuICogQHBhcmFtIHtTdHJpbmd8QXJyYXk8U3RyaW5nPnxGdW5jdGlvbn0gLi4uc29ydEtleXNcbiAqIEBwYXJhbSB7TnVtYmVyfSBbb3JkZXJdXG4gKi9cblxuZnVuY3Rpb24gb3JkZXJCeShhcnIpIHtcbiAgdmFyIGNvbXBhcmF0b3IgPSBudWxsO1xuICB2YXIgc29ydEtleXMgPSB1bmRlZmluZWQ7XG4gIGFyciA9IGNvbnZlcnRBcnJheShhcnIpO1xuXG4gIC8vIGRldGVybWluZSBvcmRlciAobGFzdCBhcmd1bWVudClcbiAgdmFyIGFyZ3MgPSB0b0FycmF5KGFyZ3VtZW50cywgMSk7XG4gIHZhciBvcmRlciA9IGFyZ3NbYXJncy5sZW5ndGggLSAxXTtcbiAgaWYgKHR5cGVvZiBvcmRlciA9PT0gJ251bWJlcicpIHtcbiAgICBvcmRlciA9IG9yZGVyIDwgMCA/IC0xIDogMTtcbiAgICBhcmdzID0gYXJncy5sZW5ndGggPiAxID8gYXJncy5zbGljZSgwLCAtMSkgOiBhcmdzO1xuICB9IGVsc2Uge1xuICAgIG9yZGVyID0gMTtcbiAgfVxuXG4gIC8vIGRldGVybWluZSBzb3J0S2V5cyAmIGNvbXBhcmF0b3JcbiAgdmFyIGZpcnN0QXJnID0gYXJnc1swXTtcbiAgaWYgKCFmaXJzdEFyZykge1xuICAgIHJldHVybiBhcnI7XG4gIH0gZWxzZSBpZiAodHlwZW9mIGZpcnN0QXJnID09PSAnZnVuY3Rpb24nKSB7XG4gICAgLy8gY3VzdG9tIGNvbXBhcmF0b3JcbiAgICBjb21wYXJhdG9yID0gZnVuY3Rpb24gKGEsIGIpIHtcbiAgICAgIHJldHVybiBmaXJzdEFyZyhhLCBiKSAqIG9yZGVyO1xuICAgIH07XG4gIH0gZWxzZSB7XG4gICAgLy8gc3RyaW5nIGtleXMuIGZsYXR0ZW4gZmlyc3RcbiAgICBzb3J0S2V5cyA9IEFycmF5LnByb3RvdHlwZS5jb25jYXQuYXBwbHkoW10sIGFyZ3MpO1xuICAgIGNvbXBhcmF0b3IgPSBmdW5jdGlvbiAoYSwgYiwgaSkge1xuICAgICAgaSA9IGkgfHwgMDtcbiAgICAgIHJldHVybiBpID49IHNvcnRLZXlzLmxlbmd0aCAtIDEgPyBiYXNlQ29tcGFyZShhLCBiLCBpKSA6IGJhc2VDb21wYXJlKGEsIGIsIGkpIHx8IGNvbXBhcmF0b3IoYSwgYiwgaSArIDEpO1xuICAgIH07XG4gIH1cblxuICBmdW5jdGlvbiBiYXNlQ29tcGFyZShhLCBiLCBzb3J0S2V5SW5kZXgpIHtcbiAgICB2YXIgc29ydEtleSA9IHNvcnRLZXlzW3NvcnRLZXlJbmRleF07XG4gICAgaWYgKHNvcnRLZXkpIHtcbiAgICAgIGlmIChzb3J0S2V5ICE9PSAnJGtleScpIHtcbiAgICAgICAgaWYgKGlzT2JqZWN0KGEpICYmICckdmFsdWUnIGluIGEpIGEgPSBhLiR2YWx1ZTtcbiAgICAgICAgaWYgKGlzT2JqZWN0KGIpICYmICckdmFsdWUnIGluIGIpIGIgPSBiLiR2YWx1ZTtcbiAgICAgIH1cbiAgICAgIGEgPSBpc09iamVjdChhKSA/IGdldFBhdGgoYSwgc29ydEtleSkgOiBhO1xuICAgICAgYiA9IGlzT2JqZWN0KGIpID8gZ2V0UGF0aChiLCBzb3J0S2V5KSA6IGI7XG4gICAgfVxuICAgIHJldHVybiBhID09PSBiID8gMCA6IGEgPiBiID8gb3JkZXIgOiAtb3JkZXI7XG4gIH1cblxuICAvLyBzb3J0IG9uIGEgY29weSB0byBhdm9pZCBtdXRhdGluZyBvcmlnaW5hbCBhcnJheVxuICByZXR1cm4gYXJyLnNsaWNlKCkuc29ydChjb21wYXJhdG9yKTtcbn1cblxuLyoqXG4gKiBTdHJpbmcgY29udGFpbiBoZWxwZXJcbiAqXG4gKiBAcGFyYW0geyp9IHZhbFxuICogQHBhcmFtIHtTdHJpbmd9IHNlYXJjaFxuICovXG5cbmZ1bmN0aW9uIGNvbnRhaW5zKHZhbCwgc2VhcmNoKSB7XG4gIHZhciBpO1xuICBpZiAoaXNQbGFpbk9iamVjdCh2YWwpKSB7XG4gICAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh2YWwpO1xuICAgIGkgPSBrZXlzLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBpZiAoY29udGFpbnModmFsW2tleXNbaV1dLCBzZWFyY2gpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmIChpc0FycmF5KHZhbCkpIHtcbiAgICBpID0gdmFsLmxlbmd0aDtcbiAgICB3aGlsZSAoaS0tKSB7XG4gICAgICBpZiAoY29udGFpbnModmFsW2ldLCBzZWFyY2gpKSB7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgfSBlbHNlIGlmICh2YWwgIT0gbnVsbCkge1xuICAgIHJldHVybiB2YWwudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpLmluZGV4T2Yoc2VhcmNoKSA+IC0xO1xuICB9XG59XG5cbnZhciBkaWdpdHNSRSA9IC8oXFxkezN9KSg/PVxcZCkvZztcblxuLy8gYXNzZXQgY29sbGVjdGlvbnMgbXVzdCBiZSBhIHBsYWluIG9iamVjdC5cbnZhciBmaWx0ZXJzID0ge1xuXG4gIG9yZGVyQnk6IG9yZGVyQnksXG4gIGZpbHRlckJ5OiBmaWx0ZXJCeSxcbiAgbGltaXRCeTogbGltaXRCeSxcblxuICAvKipcbiAgICogU3RyaW5naWZ5IHZhbHVlLlxuICAgKlxuICAgKiBAcGFyYW0ge051bWJlcn0gaW5kZW50XG4gICAqL1xuXG4gIGpzb246IHtcbiAgICByZWFkOiBmdW5jdGlvbiByZWFkKHZhbHVlLCBpbmRlbnQpIHtcbiAgICAgIHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnID8gdmFsdWUgOiBKU09OLnN0cmluZ2lmeSh2YWx1ZSwgbnVsbCwgTnVtYmVyKGluZGVudCkgfHwgMik7XG4gICAgfSxcbiAgICB3cml0ZTogZnVuY3Rpb24gd3JpdGUodmFsdWUpIHtcbiAgICAgIHRyeSB7XG4gICAgICAgIHJldHVybiBKU09OLnBhcnNlKHZhbHVlKTtcbiAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgfVxuICAgIH1cbiAgfSxcblxuICAvKipcbiAgICogJ2FiYycgPT4gJ0FiYydcbiAgICovXG5cbiAgY2FwaXRhbGl6ZTogZnVuY3Rpb24gY2FwaXRhbGl6ZSh2YWx1ZSkge1xuICAgIGlmICghdmFsdWUgJiYgdmFsdWUgIT09IDApIHJldHVybiAnJztcbiAgICB2YWx1ZSA9IHZhbHVlLnRvU3RyaW5nKCk7XG4gICAgcmV0dXJuIHZhbHVlLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpICsgdmFsdWUuc2xpY2UoMSk7XG4gIH0sXG5cbiAgLyoqXG4gICAqICdhYmMnID0+ICdBQkMnXG4gICAqL1xuXG4gIHVwcGVyY2FzZTogZnVuY3Rpb24gdXBwZXJjYXNlKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlIHx8IHZhbHVlID09PSAwID8gdmFsdWUudG9TdHJpbmcoKS50b1VwcGVyQ2FzZSgpIDogJyc7XG4gIH0sXG5cbiAgLyoqXG4gICAqICdBYkMnID0+ICdhYmMnXG4gICAqL1xuXG4gIGxvd2VyY2FzZTogZnVuY3Rpb24gbG93ZXJjYXNlKHZhbHVlKSB7XG4gICAgcmV0dXJuIHZhbHVlIHx8IHZhbHVlID09PSAwID8gdmFsdWUudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpIDogJyc7XG4gIH0sXG5cbiAgLyoqXG4gICAqIDEyMzQ1ID0+ICQxMiwzNDUuMDBcbiAgICpcbiAgICogQHBhcmFtIHtTdHJpbmd9IHNpZ25cbiAgICogQHBhcmFtIHtOdW1iZXJ9IGRlY2ltYWxzIERlY2ltYWwgcGxhY2VzXG4gICAqL1xuXG4gIGN1cnJlbmN5OiBmdW5jdGlvbiBjdXJyZW5jeSh2YWx1ZSwgX2N1cnJlbmN5LCBkZWNpbWFscykge1xuICAgIHZhbHVlID0gcGFyc2VGbG9hdCh2YWx1ZSk7XG4gICAgaWYgKCFpc0Zpbml0ZSh2YWx1ZSkgfHwgIXZhbHVlICYmIHZhbHVlICE9PSAwKSByZXR1cm4gJyc7XG4gICAgX2N1cnJlbmN5ID0gX2N1cnJlbmN5ICE9IG51bGwgPyBfY3VycmVuY3kgOiAnJCc7XG4gICAgZGVjaW1hbHMgPSBkZWNpbWFscyAhPSBudWxsID8gZGVjaW1hbHMgOiAyO1xuICAgIHZhciBzdHJpbmdpZmllZCA9IE1hdGguYWJzKHZhbHVlKS50b0ZpeGVkKGRlY2ltYWxzKTtcbiAgICB2YXIgX2ludCA9IGRlY2ltYWxzID8gc3RyaW5naWZpZWQuc2xpY2UoMCwgLTEgLSBkZWNpbWFscykgOiBzdHJpbmdpZmllZDtcbiAgICB2YXIgaSA9IF9pbnQubGVuZ3RoICUgMztcbiAgICB2YXIgaGVhZCA9IGkgPiAwID8gX2ludC5zbGljZSgwLCBpKSArIChfaW50Lmxlbmd0aCA+IDMgPyAnLCcgOiAnJykgOiAnJztcbiAgICB2YXIgX2Zsb2F0ID0gZGVjaW1hbHMgPyBzdHJpbmdpZmllZC5zbGljZSgtMSAtIGRlY2ltYWxzKSA6ICcnO1xuICAgIHZhciBzaWduID0gdmFsdWUgPCAwID8gJy0nIDogJyc7XG4gICAgcmV0dXJuIHNpZ24gKyBfY3VycmVuY3kgKyBoZWFkICsgX2ludC5zbGljZShpKS5yZXBsYWNlKGRpZ2l0c1JFLCAnJDEsJykgKyBfZmxvYXQ7XG4gIH0sXG5cbiAgLyoqXG4gICAqICdpdGVtJyA9PiAnaXRlbXMnXG4gICAqXG4gICAqIEBwYXJhbXNcbiAgICogIGFuIGFycmF5IG9mIHN0cmluZ3MgY29ycmVzcG9uZGluZyB0b1xuICAgKiAgdGhlIHNpbmdsZSwgZG91YmxlLCB0cmlwbGUgLi4uIGZvcm1zIG9mIHRoZSB3b3JkIHRvXG4gICAqICBiZSBwbHVyYWxpemVkLiBXaGVuIHRoZSBudW1iZXIgdG8gYmUgcGx1cmFsaXplZFxuICAgKiAgZXhjZWVkcyB0aGUgbGVuZ3RoIG9mIHRoZSBhcmdzLCBpdCB3aWxsIHVzZSB0aGUgbGFzdFxuICAgKiAgZW50cnkgaW4gdGhlIGFycmF5LlxuICAgKlxuICAgKiAgZS5nLiBbJ3NpbmdsZScsICdkb3VibGUnLCAndHJpcGxlJywgJ211bHRpcGxlJ11cbiAgICovXG5cbiAgcGx1cmFsaXplOiBmdW5jdGlvbiBwbHVyYWxpemUodmFsdWUpIHtcbiAgICB2YXIgYXJncyA9IHRvQXJyYXkoYXJndW1lbnRzLCAxKTtcbiAgICByZXR1cm4gYXJncy5sZW5ndGggPiAxID8gYXJnc1t2YWx1ZSAlIDEwIC0gMV0gfHwgYXJnc1thcmdzLmxlbmd0aCAtIDFdIDogYXJnc1swXSArICh2YWx1ZSA9PT0gMSA/ICcnIDogJ3MnKTtcbiAgfSxcblxuICAvKipcbiAgICogRGVib3VuY2UgYSBoYW5kbGVyIGZ1bmN0aW9uLlxuICAgKlxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBoYW5kbGVyXG4gICAqIEBwYXJhbSB7TnVtYmVyfSBkZWxheSA9IDMwMFxuICAgKiBAcmV0dXJuIHtGdW5jdGlvbn1cbiAgICovXG5cbiAgZGVib3VuY2U6IGZ1bmN0aW9uIGRlYm91bmNlKGhhbmRsZXIsIGRlbGF5KSB7XG4gICAgaWYgKCFoYW5kbGVyKSByZXR1cm47XG4gICAgaWYgKCFkZWxheSkge1xuICAgICAgZGVsYXkgPSAzMDA7XG4gICAgfVxuICAgIHJldHVybiBfZGVib3VuY2UoaGFuZGxlciwgZGVsYXkpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBpbnN0YWxsR2xvYmFsQVBJIChWdWUpIHtcbiAgLyoqXG4gICAqIFZ1ZSBhbmQgZXZlcnkgY29uc3RydWN0b3IgdGhhdCBleHRlbmRzIFZ1ZSBoYXMgYW5cbiAgICogYXNzb2NpYXRlZCBvcHRpb25zIG9iamVjdCwgd2hpY2ggY2FuIGJlIGFjY2Vzc2VkIGR1cmluZ1xuICAgKiBjb21waWxhdGlvbiBzdGVwcyBhcyBgdGhpcy5jb25zdHJ1Y3Rvci5vcHRpb25zYC5cbiAgICpcbiAgICogVGhlc2UgY2FuIGJlIHNlZW4gYXMgdGhlIGRlZmF1bHQgb3B0aW9ucyBvZiBldmVyeVxuICAgKiBWdWUgaW5zdGFuY2UuXG4gICAqL1xuXG4gIFZ1ZS5vcHRpb25zID0ge1xuICAgIGRpcmVjdGl2ZXM6IGRpcmVjdGl2ZXMsXG4gICAgZWxlbWVudERpcmVjdGl2ZXM6IGVsZW1lbnREaXJlY3RpdmVzLFxuICAgIGZpbHRlcnM6IGZpbHRlcnMsXG4gICAgdHJhbnNpdGlvbnM6IHt9LFxuICAgIGNvbXBvbmVudHM6IHt9LFxuICAgIHBhcnRpYWxzOiB7fSxcbiAgICByZXBsYWNlOiB0cnVlXG4gIH07XG5cbiAgLyoqXG4gICAqIEV4cG9zZSB1c2VmdWwgaW50ZXJuYWxzXG4gICAqL1xuXG4gIFZ1ZS51dGlsID0gdXRpbDtcbiAgVnVlLmNvbmZpZyA9IGNvbmZpZztcbiAgVnVlLnNldCA9IHNldDtcbiAgVnVlWydkZWxldGUnXSA9IGRlbDtcbiAgVnVlLm5leHRUaWNrID0gbmV4dFRpY2s7XG5cbiAgLyoqXG4gICAqIFRoZSBmb2xsb3dpbmcgYXJlIGV4cG9zZWQgZm9yIGFkdmFuY2VkIHVzYWdlIC8gcGx1Z2luc1xuICAgKi9cblxuICBWdWUuY29tcGlsZXIgPSBjb21waWxlcjtcbiAgVnVlLkZyYWdtZW50RmFjdG9yeSA9IEZyYWdtZW50RmFjdG9yeTtcbiAgVnVlLmludGVybmFsRGlyZWN0aXZlcyA9IGludGVybmFsRGlyZWN0aXZlcztcbiAgVnVlLnBhcnNlcnMgPSB7XG4gICAgcGF0aDogcGF0aCxcbiAgICB0ZXh0OiB0ZXh0LFxuICAgIHRlbXBsYXRlOiB0ZW1wbGF0ZSxcbiAgICBkaXJlY3RpdmU6IGRpcmVjdGl2ZSxcbiAgICBleHByZXNzaW9uOiBleHByZXNzaW9uXG4gIH07XG5cbiAgLyoqXG4gICAqIEVhY2ggaW5zdGFuY2UgY29uc3RydWN0b3IsIGluY2x1ZGluZyBWdWUsIGhhcyBhIHVuaXF1ZVxuICAgKiBjaWQuIFRoaXMgZW5hYmxlcyB1cyB0byBjcmVhdGUgd3JhcHBlZCBcImNoaWxkXG4gICAqIGNvbnN0cnVjdG9yc1wiIGZvciBwcm90b3R5cGFsIGluaGVyaXRhbmNlIGFuZCBjYWNoZSB0aGVtLlxuICAgKi9cblxuICBWdWUuY2lkID0gMDtcbiAgdmFyIGNpZCA9IDE7XG5cbiAgLyoqXG4gICAqIENsYXNzIGluaGVyaXRhbmNlXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBleHRlbmRPcHRpb25zXG4gICAqL1xuXG4gIFZ1ZS5leHRlbmQgPSBmdW5jdGlvbiAoZXh0ZW5kT3B0aW9ucykge1xuICAgIGV4dGVuZE9wdGlvbnMgPSBleHRlbmRPcHRpb25zIHx8IHt9O1xuICAgIHZhciBTdXBlciA9IHRoaXM7XG4gICAgdmFyIGlzRmlyc3RFeHRlbmQgPSBTdXBlci5jaWQgPT09IDA7XG4gICAgaWYgKGlzRmlyc3RFeHRlbmQgJiYgZXh0ZW5kT3B0aW9ucy5fQ3Rvcikge1xuICAgICAgcmV0dXJuIGV4dGVuZE9wdGlvbnMuX0N0b3I7XG4gICAgfVxuICAgIHZhciBuYW1lID0gZXh0ZW5kT3B0aW9ucy5uYW1lIHx8IFN1cGVyLm9wdGlvbnMubmFtZTtcbiAgICBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJykge1xuICAgICAgaWYgKCEvXlthLXpBLVpdW1xcdy1dKiQvLnRlc3QobmFtZSkpIHtcbiAgICAgICAgd2FybignSW52YWxpZCBjb21wb25lbnQgbmFtZTogXCInICsgbmFtZSArICdcIi4gQ29tcG9uZW50IG5hbWVzICcgKyAnY2FuIG9ubHkgY29udGFpbiBhbHBoYW51bWVyaWMgY2hhcmFjYXRlcnMgYW5kIHRoZSBoeXBoZW4uJyk7XG4gICAgICAgIG5hbWUgPSBudWxsO1xuICAgICAgfVxuICAgIH1cbiAgICB2YXIgU3ViID0gY3JlYXRlQ2xhc3MobmFtZSB8fCAnVnVlQ29tcG9uZW50Jyk7XG4gICAgU3ViLnByb3RvdHlwZSA9IE9iamVjdC5jcmVhdGUoU3VwZXIucHJvdG90eXBlKTtcbiAgICBTdWIucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gU3ViO1xuICAgIFN1Yi5jaWQgPSBjaWQrKztcbiAgICBTdWIub3B0aW9ucyA9IG1lcmdlT3B0aW9ucyhTdXBlci5vcHRpb25zLCBleHRlbmRPcHRpb25zKTtcbiAgICBTdWJbJ3N1cGVyJ10gPSBTdXBlcjtcbiAgICAvLyBhbGxvdyBmdXJ0aGVyIGV4dGVuc2lvblxuICAgIFN1Yi5leHRlbmQgPSBTdXBlci5leHRlbmQ7XG4gICAgLy8gY3JlYXRlIGFzc2V0IHJlZ2lzdGVycywgc28gZXh0ZW5kZWQgY2xhc3Nlc1xuICAgIC8vIGNhbiBoYXZlIHRoZWlyIHByaXZhdGUgYXNzZXRzIHRvby5cbiAgICBjb25maWcuX2Fzc2V0VHlwZXMuZm9yRWFjaChmdW5jdGlvbiAodHlwZSkge1xuICAgICAgU3ViW3R5cGVdID0gU3VwZXJbdHlwZV07XG4gICAgfSk7XG4gICAgLy8gZW5hYmxlIHJlY3Vyc2l2ZSBzZWxmLWxvb2t1cFxuICAgIGlmIChuYW1lKSB7XG4gICAgICBTdWIub3B0aW9ucy5jb21wb25lbnRzW25hbWVdID0gU3ViO1xuICAgIH1cbiAgICAvLyBjYWNoZSBjb25zdHJ1Y3RvclxuICAgIGlmIChpc0ZpcnN0RXh0ZW5kKSB7XG4gICAgICBleHRlbmRPcHRpb25zLl9DdG9yID0gU3ViO1xuICAgIH1cbiAgICByZXR1cm4gU3ViO1xuICB9O1xuXG4gIC8qKlxuICAgKiBBIGZ1bmN0aW9uIHRoYXQgcmV0dXJucyBhIHN1Yi1jbGFzcyBjb25zdHJ1Y3RvciB3aXRoIHRoZVxuICAgKiBnaXZlbiBuYW1lLiBUaGlzIGdpdmVzIHVzIG11Y2ggbmljZXIgb3V0cHV0IHdoZW5cbiAgICogbG9nZ2luZyBpbnN0YW5jZXMgaW4gdGhlIGNvbnNvbGUuXG4gICAqXG4gICAqIEBwYXJhbSB7U3RyaW5nfSBuYW1lXG4gICAqIEByZXR1cm4ge0Z1bmN0aW9ufVxuICAgKi9cblxuICBmdW5jdGlvbiBjcmVhdGVDbGFzcyhuYW1lKSB7XG4gICAgLyogZXNsaW50LWRpc2FibGUgbm8tbmV3LWZ1bmMgKi9cbiAgICByZXR1cm4gbmV3IEZ1bmN0aW9uKCdyZXR1cm4gZnVuY3Rpb24gJyArIGNsYXNzaWZ5KG5hbWUpICsgJyAob3B0aW9ucykgeyB0aGlzLl9pbml0KG9wdGlvbnMpIH0nKSgpO1xuICAgIC8qIGVzbGludC1lbmFibGUgbm8tbmV3LWZ1bmMgKi9cbiAgfVxuXG4gIC8qKlxuICAgKiBQbHVnaW4gc3lzdGVtXG4gICAqXG4gICAqIEBwYXJhbSB7T2JqZWN0fSBwbHVnaW5cbiAgICovXG5cbiAgVnVlLnVzZSA9IGZ1bmN0aW9uIChwbHVnaW4pIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICBpZiAocGx1Z2luLmluc3RhbGxlZCkge1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICAvLyBhZGRpdGlvbmFsIHBhcmFtZXRlcnNcbiAgICB2YXIgYXJncyA9IHRvQXJyYXkoYXJndW1lbnRzLCAxKTtcbiAgICBhcmdzLnVuc2hpZnQodGhpcyk7XG4gICAgaWYgKHR5cGVvZiBwbHVnaW4uaW5zdGFsbCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgcGx1Z2luLmluc3RhbGwuYXBwbHkocGx1Z2luLCBhcmdzKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcGx1Z2luLmFwcGx5KG51bGwsIGFyZ3MpO1xuICAgIH1cbiAgICBwbHVnaW4uaW5zdGFsbGVkID0gdHJ1ZTtcbiAgICByZXR1cm4gdGhpcztcbiAgfTtcblxuICAvKipcbiAgICogQXBwbHkgYSBnbG9iYWwgbWl4aW4gYnkgbWVyZ2luZyBpdCBpbnRvIHRoZSBkZWZhdWx0XG4gICAqIG9wdGlvbnMuXG4gICAqL1xuXG4gIFZ1ZS5taXhpbiA9IGZ1bmN0aW9uIChtaXhpbikge1xuICAgIFZ1ZS5vcHRpb25zID0gbWVyZ2VPcHRpb25zKFZ1ZS5vcHRpb25zLCBtaXhpbik7XG4gIH07XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhc3NldCByZWdpc3RyYXRpb24gbWV0aG9kcyB3aXRoIHRoZSBmb2xsb3dpbmdcbiAgICogc2lnbmF0dXJlOlxuICAgKlxuICAgKiBAcGFyYW0ge1N0cmluZ30gaWRcbiAgICogQHBhcmFtIHsqfSBkZWZpbml0aW9uXG4gICAqL1xuXG4gIGNvbmZpZy5fYXNzZXRUeXBlcy5mb3JFYWNoKGZ1bmN0aW9uICh0eXBlKSB7XG4gICAgVnVlW3R5cGVdID0gZnVuY3Rpb24gKGlkLCBkZWZpbml0aW9uKSB7XG4gICAgICBpZiAoIWRlZmluaXRpb24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMub3B0aW9uc1t0eXBlICsgJ3MnXVtpZF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgaWYgKi9cbiAgICAgICAgaWYgKHByb2Nlc3MuZW52Lk5PREVfRU5WICE9PSAncHJvZHVjdGlvbicpIHtcbiAgICAgICAgICBpZiAodHlwZSA9PT0gJ2NvbXBvbmVudCcgJiYgKGNvbW1vblRhZ1JFLnRlc3QoaWQpIHx8IHJlc2VydmVkVGFnUkUudGVzdChpZCkpKSB7XG4gICAgICAgICAgICB3YXJuKCdEbyBub3QgdXNlIGJ1aWx0LWluIG9yIHJlc2VydmVkIEhUTUwgZWxlbWVudHMgYXMgY29tcG9uZW50ICcgKyAnaWQ6ICcgKyBpZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGlmICh0eXBlID09PSAnY29tcG9uZW50JyAmJiBpc1BsYWluT2JqZWN0KGRlZmluaXRpb24pKSB7XG4gICAgICAgICAgZGVmaW5pdGlvbi5uYW1lID0gaWQ7XG4gICAgICAgICAgZGVmaW5pdGlvbiA9IFZ1ZS5leHRlbmQoZGVmaW5pdGlvbik7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5vcHRpb25zW3R5cGUgKyAncyddW2lkXSA9IGRlZmluaXRpb247XG4gICAgICAgIHJldHVybiBkZWZpbml0aW9uO1xuICAgICAgfVxuICAgIH07XG4gIH0pO1xuXG4gIC8vIGV4cG9zZSBpbnRlcm5hbCB0cmFuc2l0aW9uIEFQSVxuICBleHRlbmQoVnVlLnRyYW5zaXRpb24sIHRyYW5zaXRpb24pO1xufVxuXG5pbnN0YWxsR2xvYmFsQVBJKFZ1ZSk7XG5cblZ1ZS52ZXJzaW9uID0gJzEuMC4yNCc7XG5cbi8vIGRldnRvb2xzIGdsb2JhbCBob29rXG4vKiBpc3RhbmJ1bCBpZ25vcmUgbmV4dCAqL1xuc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gIGlmIChjb25maWcuZGV2dG9vbHMpIHtcbiAgICBpZiAoZGV2dG9vbHMpIHtcbiAgICAgIGRldnRvb2xzLmVtaXQoJ2luaXQnLCBWdWUpO1xuICAgIH0gZWxzZSBpZiAocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09ICdwcm9kdWN0aW9uJyAmJiBpbkJyb3dzZXIgJiYgL0Nocm9tZVxcL1xcZCsvLnRlc3Qod2luZG93Lm5hdmlnYXRvci51c2VyQWdlbnQpKSB7XG4gICAgICBjb25zb2xlLmxvZygnRG93bmxvYWQgdGhlIFZ1ZSBEZXZ0b29scyBmb3IgYSBiZXR0ZXIgZGV2ZWxvcG1lbnQgZXhwZXJpZW5jZTpcXG4nICsgJ2h0dHBzOi8vZ2l0aHViLmNvbS92dWVqcy92dWUtZGV2dG9vbHMnKTtcbiAgICB9XG4gIH1cbn0sIDApO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFZ1ZTsiLCJ2YXIgaW5zZXJ0ZWQgPSBleHBvcnRzLmNhY2hlID0ge31cblxuZXhwb3J0cy5pbnNlcnQgPSBmdW5jdGlvbiAoY3NzKSB7XG4gIGlmIChpbnNlcnRlZFtjc3NdKSByZXR1cm5cbiAgaW5zZXJ0ZWRbY3NzXSA9IHRydWVcblxuICB2YXIgZWxlbSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJylcbiAgZWxlbS5zZXRBdHRyaWJ1dGUoJ3R5cGUnLCAndGV4dC9jc3MnKVxuXG4gIGlmICgndGV4dENvbnRlbnQnIGluIGVsZW0pIHtcbiAgICBlbGVtLnRleHRDb250ZW50ID0gY3NzXG4gIH0gZWxzZSB7XG4gICAgZWxlbS5zdHlsZVNoZWV0LmNzc1RleHQgPSBjc3NcbiAgfVxuXG4gIGRvY3VtZW50LmdldEVsZW1lbnRzQnlUYWdOYW1lKCdoZWFkJylbMF0uYXBwZW5kQ2hpbGQoZWxlbSlcbiAgcmV0dXJuIGVsZW1cbn1cbiIsInZhciBfX3Z1ZWlmeV9pbnNlcnRfXyA9IHJlcXVpcmUoXCJkOlxcXFxnaXRcXFxcQXNrRGFpbHlcXFxcbm9kZV9tb2R1bGVzXFxcXHZ1ZWlmeVxcXFxsaWJcXFxcaW5zZXJ0LWNzcy5qc1wiKVxudmFyIF9fdnVlaWZ5X3N0eWxlX18gPSBfX3Z1ZWlmeV9pbnNlcnRfXy5pbnNlcnQoXCIuY2FsZW5kYXJbX3YtNDI1OThhNDJde21heC13aWR0aDozOTJweDttYXgtd2lkdGg6MjQuNXJlbTtvdmVyZmxvdzpoaWRkZW47bWFyZ2luOjAgYXV0bztmb250LXNpemU6MTZweDtmb250LXNpemU6MXJlbTtsaW5lLWhlaWdodDoxLjU7Y29sb3I6cmdiYSgwLDAsMCwuODcpfS5jYWxlbmRhciBhW192LTQyNTk4YTQyXXtjb2xvcjppbmhlcml0O3RleHQtZGVjb3JhdGlvbjpub25lfS5jYWxlbmRhciBsaVtfdi00MjU5OGE0Ml0sLmNhbGVuZGFyIHVsW192LTQyNTk4YTQyXXttYXJnaW46MDtwYWRkaW5nOjB9LmNhbGVuZGFyLWhlYWRlcltfdi00MjU5OGE0Ml17Y29sb3I6cmdiYSgwLDAsMCwuNTQpfS5jYWxlbmRhci1jdHJsW192LTQyNTk4YTQyXXtmb250LXNpemU6MTlweDtmb250LXNpemU6MS4ycmVtO21hcmdpbi1ib3R0b206OHB4O21hcmdpbi1ib3R0b206LjVyZW19LmNhbGVuZGFyLWNlbGxbX3YtNDI1OThhNDJdLC5jYWxlbmRhci1jdHJsIGxpW192LTQyNTk4YTQyXXt0ZXh0LWFsaWduOmNlbnRlcn0uY2FsZW5kYXItY3RybCAucHJldltfdi00MjU5OGE0Ml17ZmxvYXQ6bGVmdH0uY2FsZW5kYXItY3RybCAucHJldltfdi00MjU5OGE0Ml06YmVmb3Jley13ZWJraXQtdHJhbnNmb3JtOnJvdGF0ZSgyMjVkZWcpOy1tcy10cmFuc2Zvcm06cm90YXRlKDIyNWRlZyk7dHJhbnNmb3JtOnJvdGF0ZSgyMjVkZWcpfS5jYWxlbmRhci1jdHJsIC5uZXh0W192LTQyNTk4YTQyXTpiZWZvcmV7LXdlYmtpdC10cmFuc2Zvcm06cm90YXRlKDQ1ZGVnKTstbXMtdHJhbnNmb3JtOnJvdGF0ZSg0NWRlZyk7dHJhbnNmb3JtOnJvdGF0ZSg0NWRlZyl9LmNhbGVuZGFyLWN0cmwgLm5leHRbX3YtNDI1OThhNDJde2Zsb2F0OnJpZ2h0fS5jYWxlbmRhci1jdHJsIC5uZXh0W192LTQyNTk4YTQyXSwuY2FsZW5kYXItY3RybCAucHJldltfdi00MjU5OGE0Ml17d2lkdGg6NTZweDt3aWR0aDozLjVyZW07Y3Vyc29yOnBvaW50ZXJ9LmNhbGVuZGFyLWN0cmwgLm5leHRbX3YtNDI1OThhNDJdOmJlZm9yZSwuY2FsZW5kYXItY3RybCAucHJldltfdi00MjU5OGE0Ml06YmVmb3Jle2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjVweDtoZWlnaHQ6NXB4O2JvcmRlci13aWR0aDozcHggM3B4IDAgMDtib3JkZXItc3R5bGU6c29saWQ7Ym9yZGVyLWNvbG9yOiMzMDMwMzA7Y29udGVudDonJzt0cmFuc2l0aW9uOmFsbCAuMnMgZWFzZS1pbi1vdXR9LmNhbGVuZGFyLWN0cmwgLm5leHRbX3YtNDI1OThhNDJdOmhvdmVyOmJlZm9yZSwuY2FsZW5kYXItY3RybCAucHJldltfdi00MjU5OGE0Ml06aG92ZXI6YmVmb3Jle2JvcmRlci1jb2xvcjojMDA5Njg4O3RyYW5zaXRpb246YWxsIC4ycyBlYXNlLWluLW91dH0uY2FsZW5kYXItY3RybCAuY3VycmVudFtfdi00MjU5OGE0Ml17bWFyZ2luOjAgNTZweDttYXJnaW46MCAzLjVyZW07Zm9udC13ZWlnaHQ6NzAwfS5jYWxlbmRhci1jZWxsW192LTQyNTk4YTQyXXt3aWR0aDo1NnB4O3dpZHRoOjMuNXJlbTtoZWlnaHQ6NTZweDtoZWlnaHQ6My41cmVtfS5jYWxlbmRhci1kYXlbX3YtNDI1OThhNDJde2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjQwcHg7d2lkdGg6Mi41cmVtO2hlaWdodDo0MHB4O2hlaWdodDoyLjVyZW07bGluZS1oZWlnaHQ6NDBweDtsaW5lLWhlaWdodDoyLjVyZW07Y29sb3I6cmdiYSgwLDAsMCwuNTQpfS5jYWxlbmRhci1kYXkudmFsaWRbX3YtNDI1OThhNDJde2NvbG9yOmluaGVyaXR9LmNhbGVuZGFyLWRheS5hY3RpdmVbX3YtNDI1OThhNDJde2NvbG9yOmhzbGEoMCwwJSwxMDAlLC45NSk7YmFja2dyb3VuZC1jb2xvcjpyZ2JhKDAsMTUwLDEzNiwuNSk7dHJhbnNpdGlvbjphbGwgLjJzIGVhc2UtaW4tb3V0fS5jYWxlbmRhci1kYXkuYWN0aXZlW192LTQyNTk4YTQyXTpob3ZlcntiYWNrZ3JvdW5kLWNvbG9yOiMwMDk2ODg7dHJhbnNpdGlvbjphbGwgLjJzIGVhc2UtaW4tb3V0fS5jYWxlbmRhci1kYXkubm93W192LTQyNTk4YTQyXXtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMCwxNTAsMTM2LC41KX0uY2FsZW5kYXItZGF5Lm5vdy5hY3RpdmVbX3YtNDI1OThhNDJde2JvcmRlcjpub25lfS5jYWxlbmRhci1kYXkuYWN0aXZlW192LTQyNTk4YTQyXSwuY2FsZW5kYXItZGF5Lm5vd1tfdi00MjU5OGE0Ml17Ym9yZGVyLXJhZGl1czoxMDAlfS5tb3ZlLXByZXZbX3YtNDI1OThhNDJdey13ZWJraXQtYW5pbWF0aW9uOmEgLjFzO2FuaW1hdGlvbjphIC4xc30ubW92ZS1uZXh0W192LTQyNTk4YTQyXXstd2Via2l0LWFuaW1hdGlvbjpiIC4xczthbmltYXRpb246YiAuMXN9QC13ZWJraXQta2V5ZnJhbWVzIGF7MCV7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlKC01cmVtKTt0cmFuc2Zvcm06dHJhbnNsYXRlKC01cmVtKX10b3std2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGUoMCk7dHJhbnNmb3JtOnRyYW5zbGF0ZSgwKX19QGtleWZyYW1lcyBhezAley13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZSgtNXJlbSk7dHJhbnNmb3JtOnRyYW5zbGF0ZSgtNXJlbSl9dG97LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlKDApO3RyYW5zZm9ybTp0cmFuc2xhdGUoMCl9fUAtd2Via2l0LWtleWZyYW1lcyBiezAley13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZSg1cmVtKTt0cmFuc2Zvcm06dHJhbnNsYXRlKDVyZW0pfXRvey13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZSgwKTt0cmFuc2Zvcm06dHJhbnNsYXRlKDApfX1Aa2V5ZnJhbWVzIGJ7MCV7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlKDVyZW0pO3RyYW5zZm9ybTp0cmFuc2xhdGUoNXJlbSl9dG97LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlKDApO3RyYW5zZm9ybTp0cmFuc2xhdGUoMCl9fVwiKVxuJ3VzZSBzdHJpY3QnO1xuXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoZXhwb3J0cywgXCJfX2VzTW9kdWxlXCIsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG52YXIgX2VsZW1lbnRDbGFzcyA9IHJlcXVpcmUoJ2VsZW1lbnQtY2xhc3MnKTtcblxudmFyIF9lbGVtZW50Q2xhc3MyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZWxlbWVudENsYXNzKTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgZGVmYXVsdDogb2JqIH07IH1cblxudmFyIE1PTlRIUyA9IFsnSmFudWFyeScsICdGZWJydWFyeScsICdNYXJjaCcsICdBcHJpbCcsICdNYXknLCAnSnVuZScsICdKdWx5JywgJ0F1Z3VzdCcsICdTZXB0ZW1iZXInLCAnT2N0b2JlcicsICdOb3ZlbWJlcicsICdEZWNlbWJlciddO1xuXG52YXIgV0VFS0RBWVMgPSBbJ1N1bicsICdNb24nLCAnVHVlJywgJ1dlZCcsICdUaHUnLCAnRnJpJywgJ1NhdCddO1xuXG5leHBvcnRzLmRlZmF1bHQgPSB7XG4gIHByb3BzOiBbJ2RhdGEtcXMnXSxcbiAgZGF0YTogZnVuY3Rpb24gZGF0YSgpIHtcbiAgICByZXR1cm4ge1xuICAgICAgdGl0bGU6ICcnLFxuICAgICAgbW92ZTogdHJ1ZSwgLy8gYW5pbWF0aW9uXG4gICAgICB5ZWFyOiAwLFxuICAgICAgbW9udGg6IDAsXG4gICAgICBkYXk6IDAsXG4gICAgICB0b2RheTogbmV3IERhdGUoKSxcbiAgICAgIG1vdmVQcmV2OiBmYWxzZSxcbiAgICAgIG1vdmVOZXh0OiBmYWxzZSxcbiAgICAgIHdlZWtzOiBbXSxcbiAgICAgIHdlZWtkYXlzOiBXRUVLREFZUyxcbiAgICAgIGFjdGl2ZXM6IHRoaXMuZ2V0QWN0aXZlcygpXG4gICAgfTtcbiAgfSxcbiAgY3JlYXRlZDogZnVuY3Rpb24gY3JlYXRlZCgpIHtcbiAgICB2YXIgbm93ID0gdGhpcy5nZXREYXRlKHRoaXMudG9kYXkpO1xuICAgIHRoaXMueWVhciA9IG5vdy55ZWFyO1xuICAgIHRoaXMubW9udGggPSBub3cubW9udGg7XG4gICAgdGhpcy5kYXkgPSBub3cuZGF5O1xuXG4gICAgdGhpcy5hY3RpdmVzID0gdGhpcy5nZXRBY3RpdmVzKCk7XG4gICAgdGhpcy5yZW5kZXIoKTtcbiAgfSxcblxuICB3YXRjaDoge1xuICAgIG1vdmVQcmV2OiBmdW5jdGlvbiBtb3ZlUHJldih2YWwsIG9sZFZhbCkge1xuICAgICAgdmFyIG1vdmVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeUNsYXNzTmFtZSgnbW92ZScpO1xuXG4gICAgICBpZiAodmFsKSBmb3IgKHZhciBpID0gMCwgbGVuID0gbW92ZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcbiAgICAgICAgKDAsIF9lbGVtZW50Q2xhc3MyLmRlZmF1bHQpKG1vdmVzW2ldKS5hZGQoJ21vdmUtcHJldicpO1xuICAgICAgfSBlbHNlIGZvciAodmFyIF9pID0gMCwgX2xlbiA9IG1vdmVzLmxlbmd0aDsgX2kgPCBfbGVuOyBfaSsrKSB7XG4gICAgICAgICgwLCBfZWxlbWVudENsYXNzMi5kZWZhdWx0KShtb3Zlc1tfaV0pLnJlbW92ZSgnbW92ZS1wcmV2Jyk7XG4gICAgICB9XG4gICAgfSxcbiAgICBtb3ZlTmV4dDogZnVuY3Rpb24gbW92ZU5leHQodmFsLCBvbGRWYWwpIHtcbiAgICAgIHZhciBtb3ZlcyA9IGRvY3VtZW50LmdldEVsZW1lbnRzQnlDbGFzc05hbWUoJ21vdmUnKTtcblxuICAgICAgaWYgKHZhbCkgZm9yICh2YXIgaSA9IDAsIGxlbiA9IG1vdmVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgICgwLCBfZWxlbWVudENsYXNzMi5kZWZhdWx0KShtb3Zlc1tpXSkuYWRkKCdtb3ZlLW5leHQnKTtcbiAgICAgIH0gZWxzZSBmb3IgKHZhciBfaTIgPSAwLCBfbGVuMiA9IG1vdmVzLmxlbmd0aDsgX2kyIDwgX2xlbjI7IF9pMisrKSB7XG4gICAgICAgICgwLCBfZWxlbWVudENsYXNzMi5kZWZhdWx0KShtb3Zlc1tfaTJdKS5yZW1vdmUoJ21vdmUtbmV4dCcpO1xuICAgICAgfVxuICAgIH1cbiAgfSxcbiAgbWV0aG9kczoge1xuICAgIHJlbmRlcjogZnVuY3Rpb24gcmVuZGVyKCkge1xuICAgICAgdmFyIGN1ck1vbnRoRmlyc3REYXRlID0gbmV3IERhdGUodGhpcy55ZWFyLCB0aGlzLm1vbnRoLCAxKS5nZXREYXkoKTsgLy8gVGhlIGZpcnN0IGRheSBjdXJyZW50IG1vbnRoXG4gICAgICB2YXIgY3VyTW9udGhEYXlzID0gbmV3IERhdGUodGhpcy55ZWFyLCB0aGlzLm1vbnRoICsgMSwgMCkuZ2V0RGF0ZSgpO1xuICAgICAgdmFyIGxhc3RNb250aERheXMgPSBuZXcgRGF0ZSh0aGlzLnllYXIsIHRoaXMubW9udGgsIDApLmdldERhdGUoKTtcblxuICAgICAgdGhpcy50aXRsZSA9IE1PTlRIU1t0aGlzLm1vbnRoXSArICcgJyArIHRoaXMueWVhcjtcblxuICAgICAgdGhpcy53ZWVrcyA9IFtdO1xuICAgICAgZm9yICh2YXIgaSA9IDE7IGkgPD0gY3VyTW9udGhEYXlzOykge1xuICAgICAgICB2YXIgd2VlayA9IFtdO1xuICAgICAgICB2YXIgY291bnQgPSAwO1xuXG4gICAgICAgIHdoaWxlIChjb3VudCA8IDcpIHtcbiAgICAgICAgICB2YXIgdGhpc0RheSA9IG5ldyBEYXRlKHRoaXMueWVhciwgdGhpcy5tb250aCwgaSk7XG4gICAgICAgICAgdmFyIHRoaXNXZWVrRGF5ID0gdGhpc0RheS5nZXREYXkoKTtcblxuICAgICAgICAgIGlmIChpID09PSAxICYmIHRoaXNXZWVrRGF5ICE9PSAwKSB7XG4gICAgICAgICAgICBmb3IgKHZhciBqID0gdGhpc1dlZWtEYXkgLSAxOyBqID49IDA7IGotLSkge1xuICAgICAgICAgICAgICB3ZWVrLnB1c2goe1xuICAgICAgICAgICAgICAgIGRhdGU6IGxhc3RNb250aERheXMgLSBqLFxuICAgICAgICAgICAgICAgIGlzTm93OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgaXNWYWxpZDogZmFsc2VcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgd2Vlay5wdXNoKHtcbiAgICAgICAgICAgIGRhdGU6IGksXG4gICAgICAgICAgICBpc05vdzogdGhpcy5zYW1lRGF5KHRoaXNEYXksIHRoaXMudG9kYXkpLFxuICAgICAgICAgICAgaXNBY3RpdmU6IHRoaXMuaXNJbkFjdGl2ZSh0aGlzRGF5KSxcbiAgICAgICAgICAgIGlzVmFsaWQ6IHRydWUgJiYgKHRoaXMubW9udGggIT09IHRoaXMudG9kYXkuZ2V0TW9udGgoKSB8fCBpIDw9IHRoaXMudG9kYXkuZ2V0RGF0ZSgpKSxcbiAgICAgICAgICAgIGhyZWY6IHRoaXMuZGF0ZTJocmVmKHRoaXMueWVhciwgdGhpcy5tb250aCwgaSlcbiAgICAgICAgICB9KTtcbiAgICAgICAgICBjb3VudCsrO1xuXG4gICAgICAgICAgaWYgKGkgPT09IGN1ck1vbnRoRGF5cyAmJiB0aGlzV2Vla0RheSAhPT0gNikge1xuICAgICAgICAgICAgZm9yICh2YXIgX2ogPSAxOyBfaiA8IDcgLSB0aGlzV2Vla0RheTsgX2orKykge1xuICAgICAgICAgICAgICB3ZWVrLnB1c2goe1xuICAgICAgICAgICAgICAgIGRhdGU6IF9qLFxuICAgICAgICAgICAgICAgIGlzTm93OiBmYWxzZSxcbiAgICAgICAgICAgICAgICBpc0FjdGl2ZTogZmFsc2UsXG4gICAgICAgICAgICAgICAgaXNWYWxpZDogZmFsc2VcbiAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgIGNvdW50Kys7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaSsrO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMud2Vla3MucHVzaCh3ZWVrKTtcbiAgICAgIH1cbiAgICB9LFxuICAgIHByZXY6IGZ1bmN0aW9uIHByZXYoKSB7XG4gICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgICBpZiAodGhpcy5tb250aCA9PT0gMCkge1xuICAgICAgICB0aGlzLm1vbnRoID0gMTE7XG4gICAgICAgIHRoaXMueWVhci0tO1xuICAgICAgfSBlbHNlIHRoaXMubW9udGgtLTtcblxuICAgICAgdGhpcy5tb3ZlID0gZmFsc2U7XG4gICAgICB0aGlzLm1vdmVQcmV2ID0gdHJ1ZTtcbiAgICAgIHRoaXMucmVuZGVyKCk7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uICgpIHtcbiAgICAgICAgX3RoaXMubW92ZVByZXYgPSBmYWxzZTtcbiAgICAgIH0sIDEwMCk7XG4gICAgfSxcbiAgICBuZXh0OiBmdW5jdGlvbiBuZXh0KCkge1xuICAgICAgdmFyIF90aGlzMiA9IHRoaXM7XG5cbiAgICAgIGlmICh0aGlzLm1vbnRoID09PSAxMSkge1xuICAgICAgICB0aGlzLm1vbnRoID0gMDtcbiAgICAgICAgdGhpcy55ZWFyKys7XG4gICAgICB9IGVsc2UgdGhpcy5tb250aCsrO1xuXG4gICAgICB0aGlzLm1vdmUgPSB0cnVlO1xuICAgICAgdGhpcy5tb3ZlTmV4dCA9IHRydWU7XG4gICAgICB0aGlzLnJlbmRlcigpO1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbiAoKSB7XG4gICAgICAgIF90aGlzMi5tb3ZlTmV4dCA9IGZhbHNlO1xuICAgICAgfSwgMTAwKTtcbiAgICB9LFxuICAgIGdldEFjdGl2ZXM6IGZ1bmN0aW9uIGdldEFjdGl2ZXMoKSB7XG4gICAgICByZXR1cm4gdGhpcy5fcHJvcHMuZGF0YVFzLnJhdy5zcGxpdCgnLCcpO1xuICAgIH0sXG4gICAgZ2V0RGF0ZTogZnVuY3Rpb24gZ2V0RGF0ZShkYXRlKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICB5ZWFyOiBkYXRlLmdldEZ1bGxZZWFyKCksXG4gICAgICAgIG1vbnRoOiBkYXRlLmdldE1vbnRoKCksXG4gICAgICAgIGRheTogZGF0ZS5nZXREYXRlKCksXG4gICAgICAgIHdlZWtkYXk6IGRhdGUuZ2V0RGF5KClcbiAgICAgIH07XG4gICAgfSxcbiAgICBwYWQ6IGZ1bmN0aW9uIHBhZChudW0sIG4pIHtcbiAgICAgIHZhciBsZW4gPSBudW0udG9TdHJpbmcoKS5sZW5ndGg7XG4gICAgICB3aGlsZSAobGVuIDwgbikge1xuICAgICAgICBudW0gPSAnMCcgKyBudW07XG4gICAgICAgIGxlbisrO1xuICAgICAgfVxuICAgICAgcmV0dXJuIG51bTtcbiAgICB9LFxuICAgIGRhdGUyc3RyaW5nOiBmdW5jdGlvbiBkYXRlMnN0cmluZyhkYXRlKSB7XG4gICAgICB2YXIgZCA9IHRoaXMuZ2V0RGF0ZShkYXRlKTtcbiAgICAgIHJldHVybiBbdGhpcy5wYWQoZC55ZWFyLCA0KSwgdGhpcy5wYWQoZC5tb250aCArIDEsIDIpLCB0aGlzLnBhZChkLmRheSwgMildLmpvaW4oJy0nKTtcbiAgICB9LFxuICAgIHNhbWVEYXk6IGZ1bmN0aW9uIHNhbWVEYXkoZGF0ZUEsIGRhdGVCKSB7XG4gICAgICB2YXIgZDEgPSB0aGlzLmdldERhdGUoZGF0ZUEpLFxuICAgICAgICAgIGQyID0gdGhpcy5nZXREYXRlKGRhdGVCKTtcbiAgICAgIHJldHVybiBkMS55ZWFyID09PSBkMi55ZWFyICYmIGQxLm1vbnRoID09PSBkMi5tb250aCAmJiBkMS5kYXkgPT09IGQyLmRheTtcbiAgICB9LFxuICAgIGlzSW5BY3RpdmU6IGZ1bmN0aW9uIGlzSW5BY3RpdmUoZGF0ZSkge1xuICAgICAgcmV0dXJuIHRoaXMuYWN0aXZlcy5pbmRleE9mKHRoaXMuZGF0ZTJzdHJpbmcoZGF0ZSkpICE9PSAtMTtcbiAgICB9LFxuICAgIGRhdGUyaHJlZjogZnVuY3Rpb24gZGF0ZTJocmVmKHllYXIsIG1vbnRoLCBkYXkpIHtcbiAgICAgIHZhciB5ID0gdGhpcy5wYWQoeWVhciwgNCksXG4gICAgICAgICAgbSA9IHRoaXMucGFkKG1vbnRoICsgMSwgMiksXG4gICAgICAgICAgZCA9IHRoaXMucGFkKGRheSwgMik7XG4gICAgICByZXR1cm4gJy4vJyArIHkgKyAnLycgKyBtICsgJy8nICsgeSArICctJyArIG0gKyAnLScgKyBkICsgJy5odG1sJztcbiAgICB9XG4gIH1cbn07XG5pZiAobW9kdWxlLmV4cG9ydHMuX19lc01vZHVsZSkgbW9kdWxlLmV4cG9ydHMgPSBtb2R1bGUuZXhwb3J0cy5kZWZhdWx0XG47KHR5cGVvZiBtb2R1bGUuZXhwb3J0cyA9PT0gXCJmdW5jdGlvblwiPyBtb2R1bGUuZXhwb3J0cy5vcHRpb25zOiBtb2R1bGUuZXhwb3J0cykudGVtcGxhdGUgPSBcIlxcbjxkaXYgY2xhc3M9XFxcImNhbGVuZGFyXFxcIiBfdi00MjU5OGE0Mj1cXFwiXFxcIj5cXG4gIDxuYXYgY2xhc3M9XFxcImNhbGVuZGFyLXJvdyBjYWxlbmRhci1jdHJsXFxcIiBfdi00MjU5OGE0Mj1cXFwiXFxcIj5cXG4gICAgPHVsIF92LTQyNTk4YTQyPVxcXCJcXFwiPlxcbiAgICAgIDxsaSBjbGFzcz1cXFwicHJldlxcXCIgdi1vbjpjbGljaz1cXFwicHJldlxcXCIgX3YtNDI1OThhNDI9XFxcIlxcXCI+PC9saT5cXG4gICAgICA8bGkgdi1pZj1cXFwidG9kYXkuZ2V0RnVsbFllYXIoKSA+IHllYXIgfHwgdG9kYXkuZ2V0TW9udGgoKSA+IG1vbnRoXFxcIiBjbGFzcz1cXFwibmV4dFxcXCIgdi1vbjpjbGljaz1cXFwibmV4dFxcXCIgX3YtNDI1OThhNDI9XFxcIlxcXCI+PC9saT5cXG4gICAgICA8bGkgY2xhc3M9XFxcImN1cnJlbnQgbW92ZVxcXCIgX3YtNDI1OThhNDI9XFxcIlxcXCI+e3sgdGl0bGUgfX08L2xpPlxcbiAgICA8L3VsPlxcbiAgPC9uYXY+XFxuICA8ZGl2IF92LTQyNTk4YTQyPVxcXCJcXFwiPlxcbiAgICA8dGFibGUgY2xhc3M9XFxcIm1vdmVcXFwiIF92LTQyNTk4YTQyPVxcXCJcXFwiPlxcbiAgICAgIDx0aGVhZCBjbGFzcz1cXFwiY2FsZW5kYXItaGVhZGVyXFxcIiBfdi00MjU5OGE0Mj1cXFwiXFxcIj5cXG4gICAgICAgIDx0ciBjbGFzcz1cXFwiY2FsZW5kYXItcm93XFxcIiBfdi00MjU5OGE0Mj1cXFwiXFxcIj5cXG4gICAgICAgICAgPHRoIGNsYXNzPVxcXCJjYWxlbmRhci1jZWxsXFxcIiB2LWZvcj1cXFwid2QgaW4gd2Vla2RheXNcXFwiIF92LTQyNTk4YTQyPVxcXCJcXFwiPnt7IHdkIH19PC90aD5cXG4gICAgICAgIDwvdHI+XFxuICAgICAgPC90aGVhZD5cXG4gICAgICA8dGJvZHkgY2xhc3M9XFxcImNhbGVuZGFyLWJvZHlcXFwiIF92LTQyNTk4YTQyPVxcXCJcXFwiPlxcbiAgICAgICAgPHRyIGNsYXNzPVxcXCJjYWxlbmRhci1yb3dcXFwiIHYtZm9yPVxcXCJ3ZWVrIGluIHdlZWtzXFxcIiBfdi00MjU5OGE0Mj1cXFwiXFxcIj5cXG4gICAgICAgICAgPHRkIGNsYXNzPVxcXCJjYWxlbmRhci1jZWxsXFxcIiB2LWZvcj1cXFwiZGF5IGluIHdlZWtcXFwiIF92LTQyNTk4YTQyPVxcXCJcXFwiPlxcbiAgICAgICAgICA8YSB2LWlmPVxcXCJkYXkuaHJlZiAmYW1wOyZhbXA7IGRheS5pc0FjdGl2ZVxcXCIgY2xhc3M9XFxcImNhbGVuZGFyLWRheVxcXCIgOmNsYXNzPVxcXCJ7ICZxdW90O25vdyZxdW90OzogZGF5LmlzTm93LCAmcXVvdDthY3RpdmUmcXVvdDs6IGRheS5pc0FjdGl2ZSwgJnF1b3Q7dmFsaWQmcXVvdDs6IGRheS5pc1ZhbGlkIH1cXFwiIDpocmVmPVxcXCJkYXkuaHJlZlxcXCIgX3YtNDI1OThhNDI9XFxcIlxcXCI+XFxuICAgICAgICAgICAgPHNwYW4gX3YtNDI1OThhNDI9XFxcIlxcXCI+e3sgZGF5LmRhdGUgfX08L3NwYW4+XFxuICAgICAgICAgIDwvYT5cXG4gICAgICAgICAgPHNwYW4gdi1lbHNlPVxcXCJcXFwiIGNsYXNzPVxcXCJjYWxlbmRhci1kYXlcXFwiIDpjbGFzcz1cXFwieyAmcXVvdDtub3cmcXVvdDs6IGRheS5pc05vdywgJnF1b3Q7YWN0aXZlJnF1b3Q7OiBkYXkuaXNBY3RpdmUsICZxdW90O3ZhbGlkJnF1b3Q7OiBkYXkuaXNWYWxpZCB9XFxcIiBfdi00MjU5OGE0Mj1cXFwiXFxcIj57eyBkYXkuZGF0ZSB9fTwvc3Bhbj5cXG4gICAgICAgICAgPC90ZD5cXG4gICAgICAgIDwvdHI+XFxuICAgICAgPC90Ym9keT5cXG4gICAgPC90YWJsZT5cXG4gIDwvZGl2PlxcbjwvZGl2PlxcblwiXG5pZiAobW9kdWxlLmhvdCkgeyhmdW5jdGlvbiAoKSB7ICBtb2R1bGUuaG90LmFjY2VwdCgpXG4gIHZhciBob3RBUEkgPSByZXF1aXJlKFwiZDpcXFxcZ2l0XFxcXEFza0RhaWx5XFxcXG5vZGVfbW9kdWxlc1xcXFx2dWUtaG90LXJlbG9hZC1hcGlcXFxcaW5kZXguanNcIilcbiAgaG90QVBJLmluc3RhbGwocmVxdWlyZShcInZ1ZVwiKSwgdHJ1ZSlcbiAgaWYgKCFob3RBUEkuY29tcGF0aWJsZSkgcmV0dXJuXG4gIHZhciBpZCA9IFwiZDpcXFxcZ2l0XFxcXEFza0RhaWx5XFxcXHNyY1xcXFxjb21wb25lbnRzXFxcXENhbGVuZGFyLnZ1ZVwiXG4gIG1vZHVsZS5ob3QuZGlzcG9zZShmdW5jdGlvbiAoKSB7XG4gICAgX192dWVpZnlfaW5zZXJ0X18uY2FjaGVbXCIuY2FsZW5kYXJbX3YtNDI1OThhNDJde21heC13aWR0aDozOTJweDttYXgtd2lkdGg6MjQuNXJlbTtvdmVyZmxvdzpoaWRkZW47bWFyZ2luOjAgYXV0bztmb250LXNpemU6MTZweDtmb250LXNpemU6MXJlbTtsaW5lLWhlaWdodDoxLjU7Y29sb3I6cmdiYSgwLDAsMCwuODcpfS5jYWxlbmRhciBhW192LTQyNTk4YTQyXXtjb2xvcjppbmhlcml0O3RleHQtZGVjb3JhdGlvbjpub25lfS5jYWxlbmRhciBsaVtfdi00MjU5OGE0Ml0sLmNhbGVuZGFyIHVsW192LTQyNTk4YTQyXXttYXJnaW46MDtwYWRkaW5nOjB9LmNhbGVuZGFyLWhlYWRlcltfdi00MjU5OGE0Ml17Y29sb3I6cmdiYSgwLDAsMCwuNTQpfS5jYWxlbmRhci1jdHJsW192LTQyNTk4YTQyXXtmb250LXNpemU6MTlweDtmb250LXNpemU6MS4ycmVtO21hcmdpbi1ib3R0b206OHB4O21hcmdpbi1ib3R0b206LjVyZW19LmNhbGVuZGFyLWNlbGxbX3YtNDI1OThhNDJdLC5jYWxlbmRhci1jdHJsIGxpW192LTQyNTk4YTQyXXt0ZXh0LWFsaWduOmNlbnRlcn0uY2FsZW5kYXItY3RybCAucHJldltfdi00MjU5OGE0Ml17ZmxvYXQ6bGVmdH0uY2FsZW5kYXItY3RybCAucHJldltfdi00MjU5OGE0Ml06YmVmb3Jley13ZWJraXQtdHJhbnNmb3JtOnJvdGF0ZSgyMjVkZWcpOy1tcy10cmFuc2Zvcm06cm90YXRlKDIyNWRlZyk7dHJhbnNmb3JtOnJvdGF0ZSgyMjVkZWcpfS5jYWxlbmRhci1jdHJsIC5uZXh0W192LTQyNTk4YTQyXTpiZWZvcmV7LXdlYmtpdC10cmFuc2Zvcm06cm90YXRlKDQ1ZGVnKTstbXMtdHJhbnNmb3JtOnJvdGF0ZSg0NWRlZyk7dHJhbnNmb3JtOnJvdGF0ZSg0NWRlZyl9LmNhbGVuZGFyLWN0cmwgLm5leHRbX3YtNDI1OThhNDJde2Zsb2F0OnJpZ2h0fS5jYWxlbmRhci1jdHJsIC5uZXh0W192LTQyNTk4YTQyXSwuY2FsZW5kYXItY3RybCAucHJldltfdi00MjU5OGE0Ml17d2lkdGg6NTZweDt3aWR0aDozLjVyZW07Y3Vyc29yOnBvaW50ZXJ9LmNhbGVuZGFyLWN0cmwgLm5leHRbX3YtNDI1OThhNDJdOmJlZm9yZSwuY2FsZW5kYXItY3RybCAucHJldltfdi00MjU5OGE0Ml06YmVmb3Jle2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjVweDtoZWlnaHQ6NXB4O2JvcmRlci13aWR0aDozcHggM3B4IDAgMDtib3JkZXItc3R5bGU6c29saWQ7Ym9yZGVyLWNvbG9yOiMzMDMwMzA7Y29udGVudDonJzt0cmFuc2l0aW9uOmFsbCAuMnMgZWFzZS1pbi1vdXR9LmNhbGVuZGFyLWN0cmwgLm5leHRbX3YtNDI1OThhNDJdOmhvdmVyOmJlZm9yZSwuY2FsZW5kYXItY3RybCAucHJldltfdi00MjU5OGE0Ml06aG92ZXI6YmVmb3Jle2JvcmRlci1jb2xvcjojMDA5Njg4O3RyYW5zaXRpb246YWxsIC4ycyBlYXNlLWluLW91dH0uY2FsZW5kYXItY3RybCAuY3VycmVudFtfdi00MjU5OGE0Ml17bWFyZ2luOjAgNTZweDttYXJnaW46MCAzLjVyZW07Zm9udC13ZWlnaHQ6NzAwfS5jYWxlbmRhci1jZWxsW192LTQyNTk4YTQyXXt3aWR0aDo1NnB4O3dpZHRoOjMuNXJlbTtoZWlnaHQ6NTZweDtoZWlnaHQ6My41cmVtfS5jYWxlbmRhci1kYXlbX3YtNDI1OThhNDJde2Rpc3BsYXk6aW5saW5lLWJsb2NrO3dpZHRoOjQwcHg7d2lkdGg6Mi41cmVtO2hlaWdodDo0MHB4O2hlaWdodDoyLjVyZW07bGluZS1oZWlnaHQ6NDBweDtsaW5lLWhlaWdodDoyLjVyZW07Y29sb3I6cmdiYSgwLDAsMCwuNTQpfS5jYWxlbmRhci1kYXkudmFsaWRbX3YtNDI1OThhNDJde2NvbG9yOmluaGVyaXR9LmNhbGVuZGFyLWRheS5hY3RpdmVbX3YtNDI1OThhNDJde2NvbG9yOmhzbGEoMCwwJSwxMDAlLC45NSk7YmFja2dyb3VuZC1jb2xvcjpyZ2JhKDAsMTUwLDEzNiwuNSk7dHJhbnNpdGlvbjphbGwgLjJzIGVhc2UtaW4tb3V0fS5jYWxlbmRhci1kYXkuYWN0aXZlW192LTQyNTk4YTQyXTpob3ZlcntiYWNrZ3JvdW5kLWNvbG9yOiMwMDk2ODg7dHJhbnNpdGlvbjphbGwgLjJzIGVhc2UtaW4tb3V0fS5jYWxlbmRhci1kYXkubm93W192LTQyNTk4YTQyXXtib3JkZXI6MXB4IHNvbGlkIHJnYmEoMCwxNTAsMTM2LC41KX0uY2FsZW5kYXItZGF5Lm5vdy5hY3RpdmVbX3YtNDI1OThhNDJde2JvcmRlcjpub25lfS5jYWxlbmRhci1kYXkuYWN0aXZlW192LTQyNTk4YTQyXSwuY2FsZW5kYXItZGF5Lm5vd1tfdi00MjU5OGE0Ml17Ym9yZGVyLXJhZGl1czoxMDAlfS5tb3ZlLXByZXZbX3YtNDI1OThhNDJdey13ZWJraXQtYW5pbWF0aW9uOmEgLjFzO2FuaW1hdGlvbjphIC4xc30ubW92ZS1uZXh0W192LTQyNTk4YTQyXXstd2Via2l0LWFuaW1hdGlvbjpiIC4xczthbmltYXRpb246YiAuMXN9QC13ZWJraXQta2V5ZnJhbWVzIGF7MCV7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlKC01cmVtKTt0cmFuc2Zvcm06dHJhbnNsYXRlKC01cmVtKX10b3std2Via2l0LXRyYW5zZm9ybTp0cmFuc2xhdGUoMCk7dHJhbnNmb3JtOnRyYW5zbGF0ZSgwKX19QGtleWZyYW1lcyBhezAley13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZSgtNXJlbSk7dHJhbnNmb3JtOnRyYW5zbGF0ZSgtNXJlbSl9dG97LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlKDApO3RyYW5zZm9ybTp0cmFuc2xhdGUoMCl9fUAtd2Via2l0LWtleWZyYW1lcyBiezAley13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZSg1cmVtKTt0cmFuc2Zvcm06dHJhbnNsYXRlKDVyZW0pfXRvey13ZWJraXQtdHJhbnNmb3JtOnRyYW5zbGF0ZSgwKTt0cmFuc2Zvcm06dHJhbnNsYXRlKDApfX1Aa2V5ZnJhbWVzIGJ7MCV7LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlKDVyZW0pO3RyYW5zZm9ybTp0cmFuc2xhdGUoNXJlbSl9dG97LXdlYmtpdC10cmFuc2Zvcm06dHJhbnNsYXRlKDApO3RyYW5zZm9ybTp0cmFuc2xhdGUoMCl9fVwiXSA9IGZhbHNlXG4gICAgZG9jdW1lbnQuaGVhZC5yZW1vdmVDaGlsZChfX3Z1ZWlmeV9zdHlsZV9fKVxuICB9KVxuICBpZiAoIW1vZHVsZS5ob3QuZGF0YSkge1xuICAgIGhvdEFQSS5jcmVhdGVSZWNvcmQoaWQsIG1vZHVsZS5leHBvcnRzKVxuICB9IGVsc2Uge1xuICAgIGhvdEFQSS51cGRhdGUoaWQsIG1vZHVsZS5leHBvcnRzLCAodHlwZW9mIG1vZHVsZS5leHBvcnRzID09PSBcImZ1bmN0aW9uXCIgPyBtb2R1bGUuZXhwb3J0cy5vcHRpb25zIDogbW9kdWxlLmV4cG9ydHMpLnRlbXBsYXRlKVxuICB9XG59KSgpfSIsImltcG9ydCBWdWUgZnJvbSAndnVlJ1xyXG5pbXBvcnQgQ2FsZW5kYXIgZnJvbSAnLi9DYWxlbmRhci52dWUnXHJcblxyXG5uZXcgVnVlKHtcclxuICBlbDogJ21haW4nLFxyXG4gIGNvbXBvbmVudHM6IHsgQ2FsZW5kYXIgfVxyXG59KVxyXG4iXX0=
