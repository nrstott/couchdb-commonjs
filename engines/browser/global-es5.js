// -- kriskowal Kris Kowal Copyright (C) 2009-2010 MIT License
// -- tlrobinson Tom Robinson
// dantman Daniel Friesen

/*!
    Copyright (c) 2009, 280 North Inc. http://280north.com/
    MIT License. http://github.com/280north/narwhal/blob/master/README.md
*/

  // Brings an environment as close to ECMAScript 5 compliance
  // as is possible with the facilities of erstwhile engines.
  
  // ES5 Draft
  // http://www.ecma-international.org/publications/files/drafts/tc39-2009-050.pdf
  
  // NOTE: this is a draft, and as such, the URL is subject to change.  If the
  // link is broken, check in the parent directory for the latest TC39 PDF.
  // http://www.ecma-international.org/publications/files/drafts/
  
  // Previous ES5 Draft
  // http://www.ecma-international.org/publications/files/drafts/tc39-2009-025.pdf
  // This is a broken link to the previous draft of ES5 on which most of the
  // numbered specification references and quotes herein were taken.  Updating
  // these references and quotes to reflect the new document would be a welcome
  // volunteer project.
  
  //
  // Array
  // =====
  //
  
  // ES5 15.4.3.2 
  if (!Array.isArray) {
    Array.isArray = function(obj) {
      return Object.prototype.toString.call(obj) == "[object Array]";
    };
  }
  
  // ES5 15.4.4.18
  if (!Array.prototype.forEach) {
    Array.prototype.forEach =  function(block, thisObject) {
      var len = this.length >>> 0;
      for (var i = 0; i < len; i++) {
        if (i in this) {
          block.call(thisObject, this[i], i, this);
        }
      }
    };
  }
  
  // ES5 15.4.4.19
  // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/map
  if (!Array.prototype.map) {
    Array.prototype.map = function(fun /*, thisp*/) {
      var len = this.length >>> 0;
      if (typeof fun != "function") {
        throw new TypeError();
      }
  
      var res = new Array(len);
      var thisp = arguments[1];
      for (var i = 0; i < len; i++) {
        if (i in this) {
          res[i] = fun.call(thisp, this[i], i, this);
        }
      }
  
      return res;
    };
  }
  
  // ES5 15.4.4.20
  if (!Array.prototype.filter) {
    Array.prototype.filter = function (block /*, thisp */) {
      var values = [];
      var thisp = arguments[1];
      for (var i = 0; i < this.length; i++) {
        if (block.call(thisp, this[i])) {
          values.push(this[i]);
        }
      }
      return values;
    };
  }
  
  // ES5 15.4.4.16
  if (!Array.prototype.every) {
    Array.prototype.every = function (block /*, thisp */) {
      var thisp = arguments[1];
      for (var i = 0; i < this.length; i++) {
        if (!block.call(thisp, this[i])) {
          return false;
        }
      }
      return true;
    };
  }
  
  // ES5 15.4.4.17
  if (!Array.prototype.some) {
    Array.prototype.some = function (block /*, thisp */) {
      var thisp = arguments[1];
      for (var i = 0; i < this.length; i++) {
        if (block.call(thisp, this[i])) {
          return true;
        }
      }
      return false;
    };
  }
  
  // ES5 15.4.4.21
  // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/reduce
  if (!Array.prototype.reduce) {
    Array.prototype.reduce = function(fun /*, initial*/) {
      var len = this.length >>> 0;
      if (typeof fun != "function") {
        throw new TypeError();
      }
  
      // no value to return if no initial value and an empty array
      if (len === 0 && arguments.length === 1) {
        throw new TypeError();
      }
  
      var i = 0, rv;
      if (arguments.length >= 2) {
        rv = arguments[1];
      } else {
        do {
          if (i in this) {
            rv = this[i++];
            break;
          }
  
          // if array contains no values, no initial value to return
          if (++i >= len) {
            throw new TypeError();
          }
        } while (true);
      }
  
      for (; i < len; i++) {
        if (i in this) {
          rv = fun.call(null, rv, this[i], i, this);
        }
      }
  
      return rv;
    };
  }
  
  // ES5 15.4.4.22
  // https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/Array/reduceRight
  if (!Array.prototype.reduceRight) {
    Array.prototype.reduceRight = function(fun /*, initial*/) {
      var len = this.length >>> 0;
      if (typeof fun != "function") {
        throw new TypeError();
      }
  
      // no value to return if no initial value, empty array
      if (len === 0 && arguments.length === 1) {
        throw new TypeError();
      }
  
      var i = len - 1, rv;
      if (arguments.length >= 2) {
        rv = arguments[1];
      } else {
        do {
          if (i in this) {
            rv = this[i--];
            break;
          }
  
          // if array contains no values, no initial value to return
          if (--i < 0) {
            throw new TypeError();
          }
        } while (true);
      }
  
      for (; i >= 0; i--) {
        if (i in this) {
          rv = fun.call(null, rv, this[i], i, this);
        }
      }
  
      return rv;
    };
  }
  
  // ES5 15.4.4.14
  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (value /*, fromIndex */ ) {
      var length = this.length;
      if (!length) {
        return -1;
      }
      var i = arguments[1] || 0;
      if (i >= length) {
        return -1;
      }
      if (i < 0) {
        i += length;
      }
      for (; i < length; i++) {
        if (!Object.prototype.hasOwnProperty.call(this, i)) {
          continue;
        }
        if (value === this[i]) {
          return i;
        }
      }
      return -1;
    };
  }
  
  // ES5 15.4.4.15
  if (!Array.prototype.lastIndexOf) {
    Array.prototype.lastIndexOf = function (value /*, fromIndex */) {
      var length = this.length;
      if (!length) {
        return -1;
      }
      var i = arguments[1] || length;
      if (i < 0) {
        i += length;
      }
      i = Math.min(i, length - 1);
      for (; i >= 0; i--) {
        if (!Object.prototype.hasOwnProperty.call(this, i)) {
          continue;
        }
        if (value === this[i]) {
          return i;
        }
      }
      return -1;
    };
  }
  
