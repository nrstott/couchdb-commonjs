var 
  Q              = require("promised-io/lib/promise"),
  base64         = require("./base64"),
  when           = Q.when,
  request        = require('request'),
  defineProperty = Object.defineProperty,
  url            = require('url'),
  httpMethod     = {
    POST:   "POST",
    GET:    "GET",
    DELETE: "DELETE",
    PUT:    "PUT"
  };

exports.version = [0,3,7];

/* ----------------------------------------------------------------------------*/
exports.createClient = function() {
  var port
    , host
    , opts
    , couchClient
    , args = Array.prototype.slice.call(arguments)
    , oldRequest;

  if (args.length === 3) {
    opts = args.pop();
    host = args.pop();
    port = args.pop();
    opts.host = host;
    opts.port = port;
  } else if (args.length === 2) {
    host = args.pop();
    port = args.pop();
    opts = { host: host, port: port };
  } else if (args.length === 1) {
    opts = args.pop();
  } else {
    throw "Invalid Argument List, createClient expects at least one argument and at most three";
  }

  couchClient = new CouchClient(opts);
  
  return couchClient;
};

/**
 * CouchClient
 *
 * @param {Object} opts
 *
 * @constructor
 */
function CouchClient(opts){
  for (var k in opts) {
    this[k] = opts[k];
  }
}

/* ----------------------------------------------------------------------------*/
/**
 * Get options for http client request
 *
 * @api private
 * @return {Object} Request options
 */
CouchClient.prototype.getRequestOptions = function(opts) {
  var defaults = {
    uri: {
      protocol: 'http:',
      hostname: this.host,
      port: this.port,
      pathname: ''
    },
    headers: { "Content-Type": "application/json" }
  };

  opts = complete(opts, defaults);
  opts.uri.href = url.format(opts.uri);
  opts.uri.pathname = removeAttr.call(opts, 'pathname') || '';
  if (opts.query) {
    opts.uri.query = removeAttr.call(opts, 'query');
  }
  if (opts.search) {
    opts.uri.search = removeAttr.call(opts, 'search');
  }

  if (opts.headers["Content-Type"] === undefined || opts.headers["Content-Type"] === null) {
    opts.headers["Content-Type"] = "application/json";
  }
      
  if (this.user) {
    opts.headers["Authorization"] = "Basic "+base64.encode(this.user+":"+this.password);
  }
  
  if (typeof opts.body === "string") { 
    opts.body = [opts.body];
  }
  if (opts.body) {
    opts.uri.body = opts.body;
  }
  
  return opts;
};

/**
 * @api private
 */
CouchClient.prototype.requestRaw = function(opts) {
  var opts = this.getRequestOptions(opts)
    , deferred = Q.defer();
  
  request(opts, function(err, response, body) {
    if (err) {
      return deferred.reject(err);
    }

    return deferred.resolve(body);
  });

  return deferred.promise;
};
  
/**
 * Request helper.
 *
 * @api private
 */
CouchClient.prototype.request = function(opts) {
  var opts = this.getRequestOptions(opts)
    , deferred = Q.defer();
  
  request(opts, function(err, response, body) {
    var body;

    if (err) {
      return deferred.reject(err);
    }

    try {
      body = JSON.parse(body);
    } catch (err) {
      deferred.reject('Error parsing CouchDB response: '+body);
    }

    if (response.statusCode >= 400) {
      body.status = response.statusCode;
      return deferred.reject(body);
    }

    deferred.resolve(body);
  });

  return deferred.promise;
};

/* ----------------------------------------------------------------------------*/
CouchClient.prototype.prepareUserDoc = function(doc, password) { 
  doc._id = doc._id || USER_PREFIX+doc.name;
  doc.type = "user";
  doc.roles = doc.roles || [];
  
  if (password) {
    return when(this.uuids(1), function(uuids) {
      doc.salt = uuids[0];
      doc.password_sha = require("./sha1").hex_sha1(password + doc.salt);
      
      return doc;
    });

  }
  return doc;
};

/**
 * Get the users DB for this CouchDB Server
 *
 * @returns {Promise} A promise that resolves to the user database
 */
CouchClient.prototype.userDb = function() {
  var self = this;
  
  return when(this.session(), function(resp) {
    var
      userDbName = resp.info.authentication_db,
      userDb = self.db(userDbName);
    
    userDb.hasUser = function(name) {
      return this.exists(USER_PREFIX+name);
    };
    
    return userDb;
  });
};

/* ----------------------------------------------------------------------------*/
CouchClient.prototype.signup = function(user, newPassword, opts) {
  var self = this;
  
  opts = opts || {};
  
  return when(this.userDb(), function(db) {
    return when(self.prepareUserDoc(user, newPassword), function(doc) { 
      return db.saveDoc(doc);
    });
  });
};

/* ----------------------------------------------------------------------------*/
CouchClient.prototype.allDbs = function() {
  return this.request({
    pathname: "/_all_dbs"
  });
};

/* ----------------------------------------------------------------------------*/
CouchClient.prototype.config = function() {
  return this.request({
    pathname: "/_config"
  });
};

/* ----------------------------------------------------------------------------*/
CouchClient.prototype.session = function() {
  return this.request({
    pathname: "/_session"
  });
};

/* ----------------------------------------------------------------------------*/
/**
 * Retrieve unique identifiers generated by CouchDB
 *
 * @param {Number|Function} count   If this is a function, it becomes the callback.  If it is a number, it is the number of unique identifiers to retrieve
 * @param {Function} cb Callback
 * @api public
 */
CouchClient.prototype.uuids = function(count) {
  var opts = {
    pathname: "/_uuids"
  };
  
  if (count) {
    opts.search = '?count=' + count;
  }

  return when(this.request(opts), function(resp) {
    return resp.uuids;
  });
};

/* ----------------------------------------------------------------------------*/
CouchClient.prototype.replicate = function(source, target, opts) {
  opts = complete({}, {
    source: source,
    target: target
  }, opts);
  
  var req = {
    method: httpMethod.POST,
    pathname: "/_replicate",
    body: [JSON.stringify(opts)]
  };
  
  if (opts.queryString) {
    req.queryString = opts.queryString;
    delete opts.queryString;
  }
  
  return this.request(req);
};

/* ----------------------------------------------------------------------------*/
CouchClient.prototype.stats = function() {
  var args = Array.prototype.slice.call(arguments)
    , pathname = "/_stats" + ((args && args.length > 0) ? "/" + args.join("/") : "");
    console.log('pathname', pathname);
  return this.request({
    pathname: pathname
  });
};

/* ----------------------------------------------------------------------------*/
CouchClient.prototype.activeTasks = function() {
  return this.request({
    pathname: "/_active_tasks"
  });
};

/* ----------------------------------------------------------------------------*/
CouchClient.prototype.session = function() {
  return this.request({
    pathname: "/_session"
  });
};

/* ----------------------------------------------------------------------------*/
CouchClient.prototype.db = function(name) {
  if (name === undefined || name === null || name === "") {
    throw new Error("Name must contain a value");
  }
  
  var couchClient = this,
      db          = Object.create(new Database(), 
                                  { 
                                    "name": {
                                      get: function() { return name; }
                                    },
                                    "client": {
                                      get: function() { return couchClient; }
                                    }
                                  });
  
  db.request = function(opts) {
    opts = opts || {};
    opts.pathname = "/"+name+(opts.appendName || "")+(opts.pathname || "");
    
    return couchClient.request(opts);
  };

  db.view = function(designDoc, viewName, opts){
      opts = opts || {};
       opts.pathname = "/" + this.name +"/_design/" + designDoc + "/_view/" + viewName + encodeOptions(opts);
      return couchClient.request(opts);
  };

  return db;
};

/* ----------------------------------------------------------------------------*/
var Database = exports.Database = function() {};

/* ----------------------------------------------------------------------------*/
Database.prototype.exists = function() {
  return when(this.request({ pathname: "" }), function(resp) {
    return true;
  }, function(err) {
    if (err.error && err.error === "not_found") {
      return false;
    }

    throw err;
  });
};

/* ----------------------------------------------------------------------------*/
Database.prototype.info = function() {
  return this.request({}, cb);
};

/* ----------------------------------------------------------------------------*/
Database.prototype.create = function() {
  return this.request({
    method: httpMethod.PUT
  });
};

/* ----------------------------------------------------------------------------*/
/**
 * Permanently delete database
 *
 * @return {Promise} a promise
 * @api public
 */
Database.prototype.remove = function() {
  if (arguments.length > 0) {
    return reject('Database.prototype.remove deletes the database. You passed arguments when none are used. '+
      'Are you sure you did not mean to use removeDoc?');
  }

  return this.request({
    method: httpMethod.DELETE
  });
};

Database.prototype.allDocs = function(opts) {
  return this.request(complete({
    pathname: "/_all_docs"
  }, opts));
};

/**
 * Retrieve document by unique identifier
 *
 * @param {String}   id  Unique identifier of the document
 * @param {Function} cb  Callback
 * @api public
 */

Database.prototype.getDoc = Database.prototype.openDoc = function(id, options) {
  if (Array.isArray(id)) {
    return Q.when(this.allDocs({
      search: '?include_docs=true',
      body: JSON.stringify({ keys: id }),
      method: httpMethod.POST
    }), function(res) {
      return res.rows.map(function(x) { return x.doc; });
    });
  }

  return when(this.request({
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    pathname: "/"+id + encodeOptions(options)    
  }), function(doc) { 
    return doc;
  }, function(err) {
    if (err.status === 404) {
      return null;
    }
    
    throw err;
  });
};

/* ----------------------------------------------------------------------------*/
Database.prototype.getAttachmentResponse = function(doc, attachmentName){
     return this.request({
         method:httpMethod.GET,
         pathname:"/"+this.name + "/" + doc._id  + "/" + attachmentName
     })
};

/**
 * Note: If the doc is an array or if a 'bulk: true' is included in opts, bulk
 *       processing of the document(s) is performed.                          
 *
 * @param {Object|Array} doc Document to save.  A promise for a document or Array is also accepted.
 */ 
Database.prototype.saveDoc = function(doc, opts) {
  var self = this
    , method = httpMethod.PUT
    , path = "/"
    , buf;
  
  return Q.when(doc, function(doc) {
    if (doc._id === undefined) {
      method = httpMethod.POST;
    } else {
      path += doc._id;
    }
    
    // Test the doc to see if it is an array.
    if(Array.isArray(doc)){
      // It is an array, so wrap the array for bulk processing.
      doc = {"docs":doc};
      // Create a 'bulk' option to force 'bulk' processing.
      if(opts) {
        opts.bulk = true;
      } else {
        opts = { bulk : true };
      }
    }

    buf = new Buffer(JSON.stringify(doc), 'utf-8');
    
    return self.request({
      appendName: (opts && opts.bulk) ? "/_bulk_docs" : "", // Define factor appended to DB name.
      method: method,
      pathname: path,
      body: typeof doc === "string" ? [doc] : buf
    });    
  });
};

/**
 * Delete a document.
 *
 * @param {String} id  Unique identifier of the document.
 * @param {String} rev Revision of the document.
 * @returns {Promise}
 */
Database.prototype.removeDoc = function(id, rev) {
  if (!id) {
    var deferred = Q.defer();
    deferred.reject('when calling removeDoc, id must not be null or undefined');
    return deferred.promise;
  }

  return this.request({
    method: httpMethod.DELETE,
    pathname: "/"+id,
    search: "?rev="+rev
  });
};

/* ----------------------------------------------------------------------------*/
Database.prototype.security = function(obj) {
  if (obj === undefined || obj === null) {
    return this.request({
      method: httpMethod.GET,
      pathname: "/_security"
    });
  }
  
  return this.request({
    method: httpMethod.PUT,
    pathname: "/_security",
    body: [ JSON.stringify(obj) ]
  });
};

/* ----------------------------------------------------------------------------*/
/**
 * @api private
 */
function getRequestOptions(args) {
  args = Array.prototype.slice.call(args);
  
  var 
    cb     = args.pop(),
    method = args.shift(),
    path   = args.shift(),
    data   = args.shift(),
    opts;
  

  if (typeof method === "object") {
    opts = method;
  } else if (typeof method === "string" && typeof path !== "string") {
    opts = {
      pathname: method,
      query: path
    };
  } else {
    opts = {
      method: method,
      pathname: path,
      data: data
    };
  }
  
  opts.cb = cb;
  opts.jar = false;
  
  return opts;
}

/* ----------------------------------------------------------------------------*/
function removeAttr(attr) {
  var val = this[attr];
  delete this[attr];
  
  return val;
}

/* ----------------------------------------------------------------------------*/
/**
 * Stringify function embedded inside of objects. Useful for couch views.
 * @api private
 */
function toJSON(data) {
  return JSON.stringify(data, function(key, val) {
    if (typeof val == 'function') {
      return val.toString();
    }
    return val;
  });
}
  
/* ----------------------------------------------------------------------------*/
// Convert a options object to an url query string.
// ex: {key:'value',key2:'value2'} becomes '?key="value"&key2="value2"'
function encodeOptions(options) {
  var buf = [];
  if (typeof(options) == "object" && options !== null) {
    for (var name in options) {
      if (options.hasOwnProperty(name)) { 
        var value = options[name];
        if (name == "key" || name == "startkey" || name == "endkey") {
          value = toJSON(value);
        }
        buf.push(encodeURIComponent(name) + "=" + encodeURIComponent(value));
      }
    }
  }
  if (!buf.length) {
    return "";
  }
  return "?" + buf.join("&");
}

/**
 * Updates an object with the properties of another object(s) if those
 * properties are not already defined for the target object. First argument is
 * the object to complete, the remaining arguments are considered sources to
 * complete from. If multiple sources contain the same property, the value of
 * the first source with that property will be the one inserted in to the
 * target.
 *
 * example usage:
 * util.complete({}, { hello: "world" });  // -> { hello: "world" }
 * util.complete({ hello: "narwhal" }, { hello: "world" }); // -> { hello: "narwhal" }
 * util.complete({}, { hello: "world" }, { hello: "le monde" }); // -> { hello: "world" }
 *
 * @returns Completed object
 * @type Object
 * @api private
 */
function complete() {
    return variadicHelper(arguments, function(target, source) {
        var key;
        for (key in source) {
            if (
                Object.prototype.hasOwnProperty.call(source, key) &&
                !Object.prototype.hasOwnProperty.call(target, key)
            ) {
                target[key] = source[key];
            }
        }
    });
}

/**
 * @param args Arguments list of the calling function
 * First argument should be a callback that takes target and source parameters.
 * Second argument should be target.
 * Remaining arguments are treated a sources.
 *
 * @returns Target
 * @type Object
 * @api private
 */
function variadicHelper(args, callback) {
    var sources = Array.prototype.slice.call(args);
    var target = sources.shift();

    sources.forEach(function(source) {
        callback(target, source);
    });

    return target;
}

function reject(reason) {
  var deferred = Q.defer();
  deferred.reject(reason);
  return deferred.promise;
}

/* ----------------------------------------------------------------------------*/
var USER_PREFIX = exports.USER_PREFIX = "org.couchdb.user:";
