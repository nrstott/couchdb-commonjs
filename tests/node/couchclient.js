var
  DB_NAME  = "commonjs-couchdb-client-test",
  DB_NAME2 = "commonjs-couchdb-client-test-mirror",
  TEST_ID  = "ABC123",
  TEST_DOC = { hello: "world" },
  assert   = require("assert"),
  couchdb  = require("../../lib/couchdb"),
  Q        = require("promised-io/promise"),
  when     = Q.when,
  client   = couchdb.createClient({ 
               port: 5984, 
               host: "192.168.15.52", 
               user: "dev", 
               password: "asdfasdf"
             }),
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
  
  return when(client.uuids(count), function(resp) {
    assert.notEqual(null, resp.uuids, "resp.uuids should not be null.  "+JSON.stringify(resp));
    assert.equal(count, resp.uuids.length, "Expected "+count+" uuids.  "+JSON.stringify(resp.uuids));
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

exports["should get states"] = function() {
  return when(client.stats(),
    function(resp) {
      assert.notEqual(null, resp.couchdb);
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
      console.log("exists:"+exists);
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
      console.log("allDocs");
      return when(db.allDocs(), function(resp) {
        assert.ok(Array.isArray(resp.rows));
        assert.equal(0, resp.rows.length);
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
          console.log(JSON.stringify(resp));
          assert.ok(resp.ok);
        });
    }
  };
    
  exports["database tests"] = {};
  
  for (var test in tests) {
    exports["database tests"][test] = function() {
      return when(before(), function() {
        return when(tests[test](), 
          function() {
            return after();
          }, 
          function(err) {
            assert.ok(false, err);
            after();
          });
        });
    };
  }
})();

if (require.main == module) {
  require("patr/runner").run(exports);
}

/*exports["should create db"] = function(assert, beforeExit) {
  var response = null;
  
  client.db(DB_NAME).create(function(err, resp) {
    response = resp;
  });
  
  client.db(DB_NAME).exists(function(err, found) {
    assert.ok(found);
  });
  
  client.db(DB_NAME).remove(function(err, resp) {
    assert.equal(null, err, JSON.stringify(err));
    assert.ok(resp.ok, JSON.stringify(resp));
  });
  
  beforeExit(function() {
    assert.notEqual(null, response);
  });
};*/

/*
exports["should not find database that does not exist"] = function(assert, beforeExit) {
  var hasRun = false;
  
  client.db("asdfasdfadsfsdukiuy").exists(function(err, found) {
    hasRun = true;
    assert.equal(null, err);
    assert.equal(found, false, "Should not find db that does not exist");
  });
  
  beforeExit(function() {
    assert.ok(hasRun, "Should have called callback");
  });
};

exports["should save documnet WITH _id specified"] = function(assert, beforeExit) {
  var 
    hasRun = false,
    db     = client.db(DB_NAME),
    doc    = { _id: "test-doc", hello: "world" };
  
  db.openDoc(doc._id, function(err, existingDoc) {
    // Remove the doc if it exists
    if (!err && existingDoc) {
      require("sys").puts("Removing existing doc");
      db.removeDoc(existingDoc._id, existingDoc._rev, function(err, resp) { 
        require("sys").puts(JSON.stringify(err));
        require("sys").puts(JSON.stringify(resp));
      });
    }
    
    db.saveDoc(doc, function(err, resp) {
      hasRun = true;
      assert.equal(null, err);
      assert.equal(doc._id, resp.id, JSON.stringify(resp));
      assert.equal("string", typeof resp.rev, JSON.stringify(resp));
      
      db.removeDoc(doc._id, resp.rev, function(err, resp) { 
        assert.equal(null, err, JSON.stringify(err));
      });
    });
  });
  
  beforeExit(function() {
    assert.ok(hasRun, "Should have called callback");
  });
};

exports["should save document WITHOUT _id specified"] = function(assert, beforeExit) {
  var 
    hasRun = false,
    db     = client.db(DB_NAME),
    doc    = { hello: "world" };
  
  db.saveDoc(doc, function(err, resp) {
    hasRun = true;
    assert.equal(null, err);
    assert.equal("string", typeof resp.id);
    assert.equal("string", typeof resp.rev);
    
    db.removeDoc(resp.id, resp.rev, function(err, resp) {
      assert.equal(null, err, JSON.stringify(err));
      assert.ok(resp.ok, JSON.stringify(resp));
    });
  });
  
  beforeExit(function() {
    assert.ok(hasRun, "Should have called callback");
  });
}*/