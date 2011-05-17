(function (exports) {
  if (typeof JSON === "undefined") {
    throw new Error("JSON is required.  Plesae include json2.js if you are running this in the browser");
  }

  var 
    Q              = require("promised-io/lib/promise"),
    HttpClient     = require("promised-io/lib/http-client").Client,
    Trait          = require("traits").Trait,
    base64         = require("./base64"),
    when           = Q.when,  
    defineProperty = Object.defineProperty,
    httpMethod     = {
      POST:   "POST",
      GET:    "GET",
      DELETE: "DELETE",
      PUT:    "PUT"
    };

  exports.createClient = function(opts) {
    opts = opts || {};

    var 
      client = new HttpClient(),
      couchClient = Trait.create(new CouchClient(client), Trait(opts));
    
    return couchClient;
  };
  
  function CouchClient(httpClient){
    this.httpClient = httpClient;
  }
  
  /**
   * Get options for http client request
   *
   * @api private
   * @return {Object} Request options
   */
  CouchClient.prototype.getRequestOptions = function(opts) {
    var defaults = {
      protocol: 'http',
      hostname: this.host,
      port: this.port,
      headers: { "Content-Type": "application/json" }
    };
    
    opts = complete(opts, defaults);
    if (opts.headers["Content-Type"] === undefined || opts.headers["Content-Type"] === null) {
      opts.headers["Content-Type"] = "application/json";
    }
        
    if (this.user) {
      opts.headers["Authorization"] = "Basic "+base64.encode(this.user+":"+this.password);
    } else if (this.authSession) {
      if (opts.headers.cookie) {
        opts.headers.cookie += ";";
      } else {
        opts.headers.cookie = "";
      }
      opts.headers.cookie += "AuthSession="+this.authSession;
    }
    
    if (typeof opts.body === "string") { 
      opts.body = [opts.body];
    }
    
    return opts;
  };
  
  var parseBody = exports.parseBody = function(resp) {
    var body = "";
    return when(resp.body.forEach(function(chunk) { body += chunk; }), function() {
      var val;
        
      try {
        val = JSON.parse(body);
      } catch (err) {
        console.log("parse error:" + body);
        throw { error: 'ParseError', reason: body };
      }
      
      if (resp.status >= 400) {
        val.status = resp.status;
        throw val;
      }
      
      return val;
    });
  }
  
  CouchClient.prototype.requestRaw = function(opts) {
    var opts = this.getRequestOptions(opts);
    
    return this.httpClient.request(opts);
  };
    
  CouchClient.prototype.request = function(opts) {
    var opts = this.getRequestOptions(opts);
    
    return when(this.httpClient.request(opts), function success(resp) { 
      var body = "";
      return parseBody(resp);
    });
  };
  
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
   * @returns {Promise} A promise that resolves to the users database
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
  
  CouchClient.prototype.signup = function(user, newPassword, opts) {
    var self = this;
    
    opts = opts || {};
    
    return when(this.userDb(), function(db) {
      return when(self.prepareUserDoc(user, newPassword), function(doc) { 
        return db.saveDoc(doc);
      });
    });
  };
  
  CouchClient.prototype.login = function(name, password) {
    return this.requestRaw({
      pathInfo: "/_session",
      method: httpMethod.POST,
      headers: { "Content-Type": "application/x-www-form-urlencoded", "X-CouchDB-WWW-Authenticate": "Cookie" },
      body: "name="+encodeURIComponent(name)+"&password="+encodeURIComponent(password)
    });
  };
  
  CouchClient.prototype.logout = CouchClient.prototype.logoff = function() {
    return this.request({
      pathInfo: "/_session",
      method: httpMethod.DELETE,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-CouchDB-WWW-Authenticate": "Cookie"
      }
    });
  };

  CouchClient.prototype.allDbs = function() {
    return this.request({
      pathInfo: "/_all_dbs"
    });
  };
  
  CouchClient.prototype.config = function() {
    return this.request({
      pathInfo: "/_config"
    });
  };
  
  CouchClient.prototype.session = function() {
    return this.request({
      pathInfo: "/_session"
    });
  };
  
  /**
   * Retrieve unique identifiers generated by CouchDB
   *
   * @param {Number|Function} count   If this is a function, it becomes the callback.  If it is a number, it is the number of unique identifiers to retrieve
   * @param {Function} cb Callback
   * @api public
   */
  CouchClient.prototype.uuids = function(count) {
    var jsgiRequest = {
      pathInfo: "/_uuids"
    };
    
    if (count) {
      jsgiRequest.queryString = "count="+count;
    }

    return when(this.request(jsgiRequest), function(resp) {
      return resp.uuids;
    });
  };
  
  CouchClient.prototype.replicate = function(source, target, opts) {
    opts = complete({}, {
      source: source,
      target: target
    }, opts);
    
    var req = {
      method: httpMethod.POST,
      pathInfo: "/_replicate",
      body: [JSON.stringify(opts)]
    };
    
    if (opts.queryString) {
      req.queryString = opts.queryString;
      delete opts.queryString;
    }
    
    return this.request(req);
  };
  
  CouchClient.prototype.stats = function() {
    var args = Array.prototype.slice.call(arguments);
      
    return this.request({
      pathInfo: "/_stats" + ((args && args.length > 0) ? "/" + args.join("/") : "")
    });
  };
  
  CouchClient.prototype.activeTasks = function() {
    return this.request({
      path: "/_active_tasks"
    });
  };
  
  CouchClient.prototype.session = function() {
    return this.request({
      pathInfo: "/_session"
    });
  };
  
  CouchClient.prototype.db = function(name) {
    if (name === undefined || name === null || name === "") {
      throw new Error("Name must contain a value");
    }
    
    var
      couchClient = this;
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
      opts.pathInfo = "/"+name+(opts.path || "");
      
      return couchClient.request(opts);
    };
    db.view = function(designDoc, viewName, opts){
        opts = opts || {};
         opts.pathInfo = "/" + this.name +"/_design/" + designDoc + "/_view/" + viewName + encodeOptions(opts);
        return couchClient.request(opts);
    };
    return db;
  };
  
  var Database = exports.Database = function() {};
  
  Database.prototype.exists = function() {
    return when(this.request({ pathInfo: "" }), function(resp) {
      return true;
    }, function(err) { 
      return !(err.error && err.error === "not_found");
    });
  };
  
  Database.prototype.info = function() {
    return this.request({}, cb);
  };
  
  Database.prototype.create = function() {
    return this.request({
      method: httpMethod.PUT
    });
  };
  
  /**
   * Permanently delete database
   *
   * @return {Promise} a promise
   * @api public
   */
  Database.prototype.remove = function() {
    return this.request({
      method: httpMethod.DELETE
    });
  };
  
  Database.prototype.allDocs = function() {
    return this.request({
      path: "/_all_docs"
    });
  };
  
  /**
   * Retrieve document by unique identifier
   *
   * @param {String}   id  Unique identifier of the document
   * @param {Function} cb  Callback
   * @api public
   */
  Database.prototype.getDoc = Database.prototype.openDoc = function(id) {
    return when(this.request({
      path: "/"+id
    }), function(doc) { 
      return doc;
    }, function(err) {
      if (err.status === 404) {
        return null;
      }
      
      throw err;
    });
  };



Database.prototype.getAttachmentResponse = function(doc, attachmentName){
     return this.request({
         method:httpMethod.GET,
         path:"/"+this.name + "/" + doc._id  + "/" + attachmentName
     })
};

  Database.prototype.saveDoc = function(doc, opts) {
    var 
      method = httpMethod.PUT
    , path = "/";
    
    if (doc._id === undefined) {
      method = httpMethod.POST;
    } else {
      path += doc._id;
    }
    
    return this.request({
      method: method,
      path: path,
      body: typeof doc === "string" ? [doc] : [JSON.stringify(doc)]
    });
  };
  
  Database.prototype.removeDoc = function(id, rev) {
    return this.request({
      method: httpMethod.DELETE,
      path: "/"+id,
      queryString: "rev="+rev
    });
  };
  
  Database.prototype.security = function(obj) {
    if (obj === undefined || obj === null) {
      return this.request({
        method: httpMethod.GET,
        path: "/_security"
      });
    }
    
    return this.request({
      method: httpMethod.PUT,
      path: "/_security",
      body: [ JSON.stringify(obj) ]
    });
  };
  
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
        path: method,
        query: path
      };
    } else {
      opts = {
        method: method,
        path: path,
        data: data
      };
    }
    
    opts.cb = cb;
    
    return opts;
  }
  
  function removeAttr(attr) {
    var val = this[attr];
    delete this[attr];
    
    return val;
  }
  
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
  
  var USER_PREFIX = exports.USER_PREFIX = "org.couchdb.user:";
  
})(exports);
