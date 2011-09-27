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
  client   = couchdb.createClient(settings.port, settings.host, settings),
  sys      = require("sys"),
  db, db2;

function identity() {}

function before() {
  return db.create();
};

function test(callback) {
  return function(done) {
    callback().then(function() {
      done();
    }, function(err) {
      done();
      assert.ok(false, sys.inspect(err));
    });
  };
}

exports.setup = function(done) {
  db  = client.db(DB_NAME);
  db2 = client.db(DB_NAME2);

  var db2Promise = db2.exists().then(function(exists) {
    if (exists) {
      return db2.remove().then(identity, function(err) {
        if (err.error !== 'not_found') {
          throw err;
        }
      });
    }
  }, function() {
    console.log('unable to delete db');
  });

  var dbPromise = db.exists().then(function(exists) {
    if (exists) {
      return db.remove().then(identity, function(err) {
        if (err.error !== 'not_found') {
          throw err;
        }
      });
    }
  }, function() {
    console.log('unable to delete db');
  });

  Q.all([ db2Promise, dbPromise ]).then(done, function(err) {
    done();
  });
};
           
exports["test should get all dbs as an array"] = test(function() {
  var hasRun = false;

  return client.allDbs().then(function(resp) {
    assert.notEqual(null, resp);
    assert.ok(Array.isArray(resp), 'Response should be an array, was "'+typeof(resp)+'"');
  });
});

exports["test should get UUIDs"] = test(function() {
  var count = 5;
  
  return client.uuids(count).then(function(uuids) {
    assert.notEqual(null, uuids, "uuids should not be null.");
    assert.equal(count, uuids.length, "Expected "+count+" uuids.  "+JSON.stringify(uuids));
  });
});

exports["test should get config"] = test(function() {
  var response = null;

  return client.config().then(function(resp) {
    assert.isNotNull(resp, 'Response should not be null');
  });
});

exports["test should create and remove db"] = test(function() {
  var db = client.db(DB_NAME)
    , createResponse = null
    , removeResponse = db;

  return db.create().then(function(resp) {
    createResponse = resp;

    assert.isNotNull(createResponse, 'Create response should not be null');
    assert.ok(createResponse.ok, 'createResponse.ok should be truthy');

    db.remove().then(function(resp) {
      removeResponse = resp;

      assert.isNotNull(removeResponse, 'Remove response should not be null');
      assert.ok(removeResponse.ok, 'removeResponse.ok should be truthy');
    });
  });
});


exports["test should signup user"] = test(function() {
  var name = "couchdb-commonjs-test"
    , response = null;
  
  return client.signup({ name: name }, "asdfasdf").then(function(resp) {
    assert.isNotNull(resp, 'response should not be null');
    assert.ok(resp.ok, 'response.ok should be truthy');

    return client.userDb().then(function(userDb) {
      return userDb.openDoc('org.couchdb.user:'+name).then(function(doc) {
        return userDb.removeDoc(doc._id, doc._rev);
      });
    });
  });
});


exports["test should login"] = test(function() {
  var removed = false
    , cookieClient = couchdb.createClient({
        host: settings.host,
        port: settings.port
      });

  return cookieClient.login(settings.user, settings.password).then(function(resp) {
    var db = cookieClient.db('cookie-auth-creation-test');

    return db.create().then(function() {
      return db.remove().then(function() {
        cookieClient.logout();

        assert.ok(true);
      });
    });
  });
});

exports["test should get stats"] = test(function() {
  var response = null;

  return client.stats().then(function(resp) {
    assert.isNotNull(resp, 'response should not be null');
    assert.isNotNull(resp.couchdb, 'response.couchdb should not be null');
  });
});

exports["should get session"] = test(function() {
  var response = null;

  return client.session().then(function(resp) {
    assert.notEqual(null, resp);
    assert.ok(resp.ok);
    assert.ok(resp.info);
  });
});

exports["test should replicate"] = test(function() {
  var response
    , db1 = client.db(DB_NAME)
    , db2 = client.db(DB_NAME2);
  
  return Q.all([ db1.create(), db2.create() ]).then(function() {

    return client.replicate(DB_NAME, DB_NAME2)
          .then(function(resp) {
            assert.ok(resp, 'Should have received a response');
            assert.ok(!resp.error, 'Response should not contain an error: '+JSON.stringify(response));
          })
          .then(function() {
            db1.remove();
            db2.remove();
          });

  }, function(err) {
    var reason = '';
    if (err && err.reason) {
      reason = err.reason;
    }

    throw 'Error creating databases: '+reason;
  });
});

exports["test should have no documents"] = test(function() {
  var response = null;

  return before().then(function() {
    db.allDocs().then(function(resp) {
      assert.ok(Array.isArray(resp.rows), "Expected resp.rows to be an array but it is '"+typeof(resp.rows)+"'");
      assert.equal(0, resp.rows.length, "Expected 0 rows, found '"+resp.rows.length+"'");
    });
  });
  
});

exports["test should remove document"] = test(function() {
  var docId = "ABCZZZ"
    , response = null
    , saveDocPromise = db.saveDoc({ _id: docId });
  
  return before().then(function() {
      return when(saveDocPromise, function(resp) {
        return when(db.removeDoc(resp.id, resp.rev), function(resp) {
          assert.ok(resp.ok);
        });
    });
  });
});
/*
exports["test should create document with id"] = function(beforeExit) {

  before().then(function() {
    console.log('should create document with id');
    var response = null
      , docId = "ABC123"
      , saveDocPromise = db.saveDoc({ _id: docId, hello: "world" });
    
    saveDocPromise.then(function() {
      db.openDoc(docId).then(function(doc) {
        if (doc !== null) {
          db.removeDoc(doc._id, doc._rev);
        }
      });
    });

    beforeExit(function(resp) {
      console.log('-beforeExit');
      assert.notEqual(null, response);
      assert.ok(response.ok);
    });
          
    when(saveDocPromise, function(resp) {
      response = resp;
    }).then(after, after);
  });
};

exports["test should create document without id"] = function(beforeExit) {

  before().then(function() {
    console.log('should create document without id');
    var response = null;

    when(db.saveDoc({ hello: "world" }), function(resp) {
      response = resp;
    }).then(after, after);

    beforeExit(function() {
      console.log('--beforeExit');
      assert.ok(response.ok);
    });
  });
};

exports["test should get security object"] = function(beforeExit) {

  before().then(function() {
    var response = null;

    when(db.security(), function(resp) {
      response = resp;
    }).then(after, after);

    beforeExit(function() {
      assert.deepEqual({}, response);
    });
          
  });
};


exports["test should set security object"] = function(beforeExit) {
  before().then(function() {  
    var securityObj = { readers: { names: ["tester"], roles: ["test_reader"] } }
      , response = null;

    beforeExit(function() {
      assert.ok(response.ok);
      assert.deepEqual(securityObj, response);
    });

    return when(db.security(securityObj), function(resp) { 
      return when(db.security(), function(resp) {
        response = resp;
      })
    });
  });
};

    
exports["test should be conflicted"] = function(beforeExit) {
  before().then(function() {
    var isConflicted = false;

    when(db.saveDoc( { _id: "hello-world" }), function() {
      var conflictPromise = db.saveDoc({ _id: "hello-world" })
        , removeDoc;
      
      removeDoc = function() {
        return db.openDoc("hello-world").then(function(doc) {
          console.log('got doc:'+JSON.stringify(doc));
          return db.removeDoc(doc._id, doc._rev);
        });
      }
      
      return when(conflictPromise, function() {
        return removeDoc();
      }, function(err) {
        isConflicted = true;
        return removeDoc();
      });
    });

    beforeExit(function() {
      assert.ok(isConflicted, 'Should have been conflicted');
    });
  });
};

exports["test should get view"] = function(beforeExit){
  before().then(function() {
     var db = client.db(DB_NAME)
       , response = null;
     
     var saveDocPromise = db.saveDoc({
      _id: "_design/test",
      views: { "test": { map: "function(){emit(doc._id, doc)}" } }
     });

     beforeExit(function() {
       assert.ok(response.rows, "rows should be defined");
     });

     return when(saveDocPromise, function() {
       return when(db.view("test", "test"), function success(resp){
          response = resp;
       });
     });
  });
}
*/
