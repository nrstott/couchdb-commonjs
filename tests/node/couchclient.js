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
    console.log("UUIDS:"+JSON.stringify(uuids));
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
  return when(client.signup({ name: "tester" }, "asdfasdf"), function(resp) {
    console.log("signup resp:"+require('sys').inspect(resp));
    assert.ok(resp.ok);
  });
};

exports["should login"] = function() {
  var cookieClient = couchdb.createClient({
    host: settings.host,
    port: settings.port
  });
  
  return when(cookieClient.login(settings.user, settings.password), function(resp) {
    console.log("login resp:"+require('sys').inspect(resp));
    assert.ok(resp.ok);
    
    var db = cookieClient.db("cookie-auth-creation-test");
    return when(db.create(), function(resp) {
      console.log("create response:"+JSON.stringify(resp));
      assert.ok(resp.ok);
      
      return when(db.remove(), function(resp) {
        console.log("remove respons:"+JSON.stringify(resp));
        assert.ok(resp.ok);
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
          console.log("replicate response:"+JSON.stringify(resp));
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
      return when(db.saveDoc({ _id: "ABC123", hello: "world" }), function(resp) {
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
        console.log("Secuirty:"+JSON.stringify(resp));
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
