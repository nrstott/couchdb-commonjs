var
  DB_NAME  = "commonjs-couchdb-client-test",
  DB_NAME2 = "commonjs-couchdb-client-test-mirror",
  TEST_ID  = "ABC123",
  TEST_DOC = { hello: "world" },
  assert   = require("assert"),
  couchdb  = require("../../lib/couchdb"),
  Q        = require("promised-io/promise"),
  when     = Q.when,
  settings = require("./settings").couchdb,
  client   = couchdb.createClient(settings),
  sys      = require("sys");

exports["should get all dbs"] = function() {
  var 
    hsaRun = false,
    response = null;
    
  var HttpClient = require("promised-io/http-client").Client;
  var httpClient = new HttpClient();

  return when(client.allDbs(), function success(resp) {
    assert.notEqual(null, resp);
    assert.ok(Array.isArray(resp), "Response should be an array: " + sys.inspect(resp));
  }, function error(err) {
    assert.ok(false, err);
  });
};

exports["should get UUIDs"] = function() {
  var count  = 5;
  
  return when(client.uuids(count), function(uuids) {
    assert.notEqual(null, uuids, "uuids should not be null.  "+JSON.stringify(uuids));
    assert.equal(count, uuids.length, "Expected "+count+" uuids.  "+JSON.stringify(uuids));
  });
};

exports["should get config"] = function() {
  return when(client.config()
  , function(resp) {
    assert.notEqual(null, resp);
  }
  , function(err) { assert.ok(false, err); });
};

exports["should create and remove db"] = function() {
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

exports["should signup user"] = function() {
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

exports["should login"] = function() {
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

exports["should get stats"] = function() {
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

exports["should replicate"] = function() {
  var 
    db1 = client.db(DB_NAME),
    db2 = client.db(DB_NAME2);
  
  return when(
    Q.all([db1.create(), db2.create()]),
    function() {
      return when(
        client.replicate(DB_NAME, DB_NAME2),
        function(resp) {
          assert.ok(resp);
          assert.ok(!resp.error);
        },
        function(err) {
          assert.ok(false, err);
        }
      )
    }
  );
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
    "should have no documents": function() {
      return when(db.allDocs(), function(resp) {
        assert.ok(Array.isArray(resp.rows), "Expected resp.rows to be an array but it is '"+typeof(resp.rows)+"'");
        assert.equal(0, resp.rows.length, "Expected 0 rows, found '"+resp.rows.length+"'");
      });
    }, 
    "should create document with id": function() {
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
    "should create document without id": function() {
      return when(db.saveDoc({ hello: "world" }), 
        function(resp) {
          assert.ok(resp.ok);
        });
    },
    "should get security object": function() {
      return when(db.security(), function(resp) {
        assert.deepEqual({}, resp);
      });
    },
    "should set security object": function() {
      var securityObj = { readers: { names: ["tester"], roles: ["test_reader"] } };
      return when(db.security(securityObj), function(resp) { 
        assert.ok(resp.ok);
        return when(db.security(), function(resp) {
          assert.deepEqual(resp, securityObj);
        })
      });
    },
    "should remove document": function() {
      var
        docId = "ABCZZZ",
        saveDocPromise = db.saveDoc({ _id: docId });
      
      return when(saveDocPromise, function(resp) {
        return when(db.removeDoc(resp.id, resp.rev), function(resp) {
          assert.ok(resp.ok);
        });
      });
    },
    "should be conflicted": function() {
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
          removeDoc();
        });
      });
    }
  };
    
  exports["database tests"] = {};
  
  var keys= [];
  for (var k in tests) {
    keys.push(k);
  }
  
  keys.forEach(function(test) {
    exports["database tests"][test] = function() {
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
  require("patr/runner").run(exports);
}
