var
  DB_NAME  = "commonjs-couchdb-client-test",
  DB_NAME2 = "commonjs-couchdb-client-test-mirror",
  TEST_ID  = "ABC123",
  TEST_DOC = { hello: "world" },
  assert   = require("assert"),
  couchdb  = require("../../lib/couchdb"),
  Q        = require("promised-io/lib/promise"),
  when     = Q.when,
  settings = require("./settings").couchdb,
  client   = couchdb.createClient(settings),
  sys      = require("sys");
           
exports["test should get all dbs"] = function() {
  var 
    hsaRun = false,
    response = null;
       var test = {something:function(arg1, arg2){}};
  var HttpClient = require("promised-io/lib/http-client").Client;
  var httpClient = new HttpClient();

  return when(client.allDbs(), function success(resp) {
    assert.notEqual(null, resp);
    assert.ok(Array.isArray(resp), "Response should be an array: " + sys.inspect(resp));
  }, function error(err) {
    assert.ok(false, err);
  });
};

exports["test should get UUIDs"] = function() {
  var count  = 5;
  
  return when(client.uuids(count), function(uuids) {
    assert.notEqual(null, uuids, "uuids should not be null.  "+JSON.stringify(uuids));
    assert.equal(count, uuids.length, "Expected "+count+" uuids.  "+JSON.stringify(uuids));
  });
};

exports["test should get config"] = function() {
  return when(client.config()
  , function(resp) {
    assert.notEqual(null, resp);
  }
  , function(err) { assert.ok(false, err); });
};

exports["test should create and remove db"] = function() {
  var db = client.db(DB_NAME);
  
  return when(db.create(), 
    function success(resp) {
      assert.notEqual(null, resp);
      assert.ok(resp.ok, JSON.stringify(resp));
    
      return when(db.remove(), 
        function(resp) {
        assert.notEqual(null, resp);
        assert.ok(resp.ok, JSON.stringify(resp));
      });
    }, 
    function error(err) {
      assert.ok(false, err);
    });
};

exports["test should signup user"] = function() {
  var
    name = "tester",
    signupPromise = client.signup({ name: name }, "asdfasdf");
  
  return when(signupPromise, function(resp) {
    assert.ok(resp.ok);
    
    return when(client.userDb(), function(userDb) {
      return when(userDb.openDoc(couchdb.USER_PREFIX+name), function(doc) {
        return userDb.removeDoc(doc._id, doc._rev);
      })
    });
  });
};

exports["test should login"] = function() {
  var cookieClient = couchdb.createClient({
    host: settings.host,
    port: settings.port
  });
  
  return when(cookieClient.login(settings.user, settings.password), function(resp) {
    return when(couchdb.parseBody(resp), function(body) {
      assert.ok(body.ok);
      var db = cookieClient.db("cookie-auth-creation-test");
      return when(db.create(), function(resp) {
        assert.ok(resp.ok);
        
        return when(db.remove(), function(resp) {
          assert.ok(resp.ok);
          
          return when(cookieClient.logout(), function(resp) { 
            assert.ok(resp.ok);
          });
        });
      });
    });
  });
};

exports["test should get stats"] = function() {
  return when(client.stats(),
    function(resp) {
      assert.notEqual(null, resp.couchdb);
    });
};

exports["should get session"] = function() {
  return when(client.session(), function(resp) {
    assert.notEqual(null, resp);
    assert.ok(resp.ok);
    assert.ok(resp.info);
  });
};

exports["test should replicate"] = function() {
  var 
    db1 = client.db(DB_NAME),
    db2 = client.db(DB_NAME2),
    deferred = Q.defer();
  
  when(Q.all([db1.create(), db2.create()]),
    function() {
      return when(
        client.replicate(DB_NAME, DB_NAME2),
        function(resp) {
          assert.ok(resp, "Should have received a response");
          assert.ok(!resp.error, "Response contains error: "+JSON.stringify(resp));
          deferred.resolve();
        },
        function(err) {
          deferred.reject(err);
        }
      )
    }, function onReject(rejection) { 
      deferred.reject(JSON.stringify(rejection));
    });
  
  return deferred.promise;
};

(function() {
  var 
    self = this, 
    db;
    
  function before() {
    db = client.db(DB_NAME);
    return when(db.exists(), function(exists) {
      if (exists) {
        return when(db.remove(), function() { 
          return db.create();
        }, function() { 
          console.log("could not remove db");
        });
      } else {
        return db.create();
      }
    });
  }
  
  function after() {
    return db.remove();
  }
  
  var tests = {
    "test should have no documents": function() {
      return when(db.allDocs(), function(resp) {
        assert.ok(Array.isArray(resp.rows), "Expected resp.rows to be an array but it is '"+typeof(resp.rows)+"'");
        assert.equal(0, resp.rows.length, "Expected 0 rows, found '"+resp.rows.length+"'");
      });
    }, 
    "test should create document with id": function() {
      var
        docId = "ABC123",
        saveDocPromise = db.saveDoc({ _id: docId, hello: "world" });
      
      saveDocPromise.then(function() {
        db.openDoc(docId).then(function(doc) {
          if (doc !== null) {
            db.removeDoc(doc._id, doc._rev);
          }
        });
      });
      
      return when(saveDocPromise, function(resp) {
        assert.notEqual(null, resp);
        assert.ok(resp.ok);
      });
    }, 
    "test should create document without id": function() {
      return when(db.saveDoc({ hello: "world" }), 
        function(resp) {
          assert.ok(resp.ok);
        });
    },
    "test should get security object": function() {
      return when(db.security(), function(resp) {
        assert.deepEqual({}, resp);
      });
    },
    "test should set security object": function() {
      var securityObj = { readers: { names: ["tester"], roles: ["test_reader"] } };
      return when(db.security(securityObj), function(resp) { 
        assert.ok(resp.ok);
        return when(db.security(), function(resp) {
          assert.deepEqual(resp, securityObj);
        })
      });
    },
    "test should remove document": function() {
      var
        docId = "ABCZZZ",
        saveDocPromise = db.saveDoc({ _id: docId });
      
      return when(saveDocPromise, function(resp) {
        console.log("removing " + resp.id + " " + resp.rev);
        return when(db.removeDoc(resp.id, resp.rev), function(resp) {
          assert.ok(resp.ok);
        });
      });
    },
    "test should be conflicted": function() {
      return when(db.saveDoc( { _id: "hello-world" }), function() {
        var conflictPromise = db.saveDoc({ _id: "hello-world" });
        
        function removeDoc() {
          return db.openDoc("hello-world").then(function(doc) {
            return db.removeDoc(doc._id, doc._rev);
          });
        }
        
        return when(conflictPromise, function() { 
          assert.ok(false);
          return removeDoc();
        }, function(err) { 
          assert.ok(err);
          return removeDoc();
        });
      });
    },

    "test should get view": function(){
       var db = client.db(DB_NAME);
       
       var saveDocPromise = db.saveDoc({
        _id: "_design/test",
        views: { "test": { map: "function(){emit(doc._id, doc)}" } }
       });

       return when(saveDocPromise, function() {
         return when(db.view("test", "test"), function success(resp){
            assert.ok(resp.rows, "rows should be defined");
         });
       });
    }

  };
    
  exports["test database"] = {};
  
  var keys= [];
  for (var k in tests) {
    keys.push(k);
  }
  
  keys.forEach(function(test) {
    exports["test database"][test] = function() {
      return when(before(), function() {
        return when(tests[test](), 
          function() {
            return after();
          }, 
          function(err) {
            console.log("ERR:"+JSON.stringify(err));
            assert.ok(false, err, JSON.stringify(err));
            return after();
          });
        });
    };
  });
})();

if (require.main == module) {
  require("patr/lib/runner").run(exports);
}
