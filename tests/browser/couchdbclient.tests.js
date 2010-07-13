var COUCH = window.COUCH;

module("CouchDB Client");

test("Creates client",
  function () {
    ok(COUCH.createClient(XMLHttpRequest) !== null);
    ok(COUCH.createClient(XMLHttpRequest, 1234).port === 1234);
    ok(COUCH.createClient(XMLHttpRequest, 1234, "wb.com").host === "wb.com");
    ok(COUCH.createClient(XMLHttpRequest, "wb.com").host === "wb.com");
  });

test("All DBs",
  function() {
    var 
      responseText = "{}",
      client = getCouchClient(responseText, 
        {
          "beforeOpen": function(req, method, url, async) { 
            equals(method, "GET", "Method should be GET");
            equals(url, "http://localhost:5984/_all_dbs");
            equals(async, true, "Async should be true");
          }
        });
    
    stop();
    
    client.allDbs(function(err, resp) {
      equals(err, null);
      same(resp, JSON.parse(responseText));
      start();
    });
  });
  
function getCouchClient(responseText, xhrListeners) {
  var
    xhr    = getMockXHR(responseText),
    client = COUCH.createClient(xhr);
  
  for (var k in xhrListeners) {
    if (xhrListeners[k].forEach) {
      xhrListeners[k].forEach(function(listener) {
        xhr.addListener(k, listener);
      });
    } else {
      xhr.addListener(k, xhrListeners[k]);
    }
  }
  
  return client;
}

test("config",
  function() {
    var
      responseText = "{}",
      xhr = getMockXHR(responseText),
      client = getCouchClient(responseText,
        {
          "beforeOpen": function(req, method, url, async) {
            equals(method, "GET", "Method should be GET");
            equals(url, "http://localhost:5984/_config");
            equals(async, true, "Async should be true");
          }
        });
    
    stop();
    
    client.config(function(err, resp) {
      equals(err, null);
      same(resp, JSON.parse(responseText));
      start();
    });
  });

test("uuids",
  function() {
    var
      count = 5,
      responseText = "{}",
      client = getCouchClient(responseText, 
        { 
          "beforeOpen": function(req, method, url, async) { 
            equals(method, "GET", "Method should be 'GET'");
            equals(url, "http://localhost:5984/_uuids?count=" + count);
            equals(async, true, "Should be async");
          } 
        });
        
    stop();
    
    client.uuids(count, function(err, resp) {
      equals(err, null);
      same(resp, JSON.parse(responseText));
      start();
    });
  });

test("replicate",
  function() {
    var 
      responseText = '{ "hello": "world" }',
      source       = "http://source.com",
      target       = "http://whiteboard-it.com",
      client       = getCouchClient(responseText,
                                    {
                                      "beforeOpen": function(req, method, url, async) {
                                        equals(method, "POST", "Method should should be 'POST'");
                                        equals(url, "http://localhost:5984/_replicate");
                                        equals(async, true, "Should be async");
                                      },
                                      "beforeSend": function(req, data) {
                                        equals(data, JSON.stringify({ source: source, target: target }))
                                      }
                                    });
    
    stop();
    
    client.replicate(source, target, function(err, resp) {
      equals(err, null);
      same(resp, JSON.parse(responseText));
      start();
    });
  });

test("stats", 
  function() {
    var
      responseText = '{ "hello": "stats" }',
      client       = getCouchClient(responseText,
                                    {
                                      "beforeOpen": function(req, method, url, async) {
                                        equals(method, "GET", "Method should be 'GET'");
                                        equals(url, "http://localhost:5984/_stats");
                                        equals(async, true, "Should be async");
                                      }
                                    });
      
    stop();
    
    client.stats(function(err, resp) {
      equals(err, null);
      same(resp, JSON.parse(responseText));
      start();
    });
  });

module("Database");

test("exists", 
  function() {
    var
      responseText = '{ "hello": "exists" }',
      client       = getCouchClient(responseText, 
                        {
                          "beforeOpen": function(req, method, url, async) {
                            equals(method, "GET", "Method should be 'GET'");
                            equals(url, "http://localhost:5984/test");
                            equals(async, true, "Should be async");
                          }
                        }),
      db           = client.db("test");
      
    stop();
    
    db.exists(function(err, found) {
      equals(err, null);
      equals(found, true);
      start();
    });
  });
  
test("info",
  function() {
    var
      responseText = '{}',
      client       = getCouchClient(responseText,
                        {
                          "beforeOpen": function(req, method, url, async) {
                            equals(method, "GET", "Method should be 'GET'");
                            equals(url, "http://localhost:5984/test");
                            equals(async, true, "Should be async");
                          }
                        }),
      db            = client.db("test");
      
      stop();
      
      db.info(function(err, resp) {
        same(resp, JSON.parse(responseText));
        equals(err, null, JSON.stringify(err));
        start();
      });
  });

test("create",
  function() {
    var
      responseText = "{}",
      dbName       = "testDB",
      client       = getCouchClient(responseText,
                       {
                         "beforeOpen": function(req, method, url, async) {
                           equals(method, "PUT", "Method should be 'PUT'");
                           equals(url, "http://localhost:5984/"+dbName);
                           equals(async, true, "Should be async");
                         }
                       }),
      db           = client.db(dbName);
    
    stop();
    
    db.create(function(err, resp) {
      equals(err, null);
      same(resp, JSON.parse(responseText));
      start();
    });
  });
  
test("remove",
  function() {
    var
      responseText = '{ "removed": true }',
      dbName       = "testDB",
      client       = getCouchClient(responseText,
                        {
                          "beforeOpen": function(req, method, url, async) {
                            equals(method, "DELETE", "Method should be 'DELETE'");
                            equals(url, "http://localhost:5984/"+dbName);
                            equals(async, true, "Should be async");
                          }
                        }),
      db           = client.db(dbName);
    
    stop();
    
    db.remove(function(err, resp) {
      equals(err, null);
      same(resp, JSON.parse(responseText));
      start();
    });
  });

test("removeDoc",
  function() {
    var
      responseText = '{ "removedDoc": true }',
      dbName       = "testDB",
      id           = "ABC123",
      rev          = "1-23123ABC",
      client       = getCouchClient(responseText,
                                     {
                                       "beforeOpen": function(req, method, url, async) {
                                         equals(method, "DELETE", "Method should be 'DELETE'");
                                         equals(url, "http://localhost:5984/"+dbName+"/"+id+"?rev="+rev);
                                         equals(async, true, "Should be async");
                                       }
                                     }),
      db           = client.db(dbName);
    
    stop();
    
    db.removeDoc(id, rev, function(err, resp) {
      equals(err, null);
      same(resp, JSON.parse(responseText));
      start();
    });
  });
  
function getMockXHR(responseText) {
  var 
    eventEmitter = new EventEmitter(),
    mockType = function() {
    };
    
  ["emit","addListener","removeListener","removeAllListeners"]
      .forEach(function(x) { mockType[x] = function() { return eventEmitter[x].apply(eventEmitter, arguments); } });
  
  mockType.prototype = {
    readyState: 0,
    headers: {},
    open: function(method, url, async) {
      mockType.emit("beforeOpen", this, method, url, async);
      this.readyState = 1;
      this.async = async;
      
      this.onreadystatechange && this.onreadystatechange();
    },
    send: function(data) {
      mockType.emit("beforeSend", this, data);
      
      var self = this;
      setTimeout(function() {
        self.readyState = 3;
        self.onreadystatechange();
        self.responseText = responseText;
        self.readyState = 4;
        self.onreadystatechange && self.onreadystatechange();
      }, 0);
    },
    setRequestHeader: function(k, v) {
      this.headers[k] = v;
    },
    abort: function() {
      this.readyState = 0;
      this.responseText = this.responseXML = "";
      this.headers = {};
      
      this.onreadystatechange && this.onreadystatechange();
    }
  }  
  
  return mockType;
}

// Adapted from node.js events library
// http://github.com/ry/node/blob/master/lib/events.js

var EventEmitter = function() {
};

EventEmitter.prototype.emit = function (type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (this._events.error instanceof Array && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1];
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  if (!this._events[type]) return false;

  if (typeof this._events[type] == 'function') {
    if (arguments.length < 3) {
      // fast case
      this._events[type].call( this
                             , arguments[1]
                             , arguments[2]
                             );
    } else {
      // slower
      var args = Array.prototype.slice.call(arguments, 1);
      this._events[type].apply(this, args);
    }
    return true;

  } else if (this._events[type] instanceof Array) {
    var args = Array.prototype.slice.call(arguments, 1);


    var listeners = this._events[type].slice(0);
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

EventEmitter.prototype.addListener = function (type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit("newListener", type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (this._events[type] instanceof Array) {
    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.removeListener = function (type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (list instanceof Array) {
    var i = list.indexOf(listener);
    if (i < 0) return this;
    list.splice(i, 1);
  } else if (this._events[type] === listener) {
    this._events[type] = null;
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function (type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function (type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!(this._events[type] instanceof Array)) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};