# CouchDB Client

CouchDB-CommonJS is a promise-based CouchDB client.  It can be used in the browser or on the server
via Node.js.

## Example Usage in Node.js

Create a module named hello-couch.js and add the following code:

    var couchdb = require('couchdb');
    var client  = couchdb.createClient(5984, 'localhost');
    var db      = client.db('helloCouch');

    var doc = { _id: 'helloCouch', text: 'Hello CouchDB!' };

    db.saveDoc(doc).then(function() {
    	console.log('document saved!');

    	db.openDoc('helloCouch').then(function(doc) {
    		console.log('retrieved document!');
    		console.log(JSON.stringify(doc));
    	});
    });

Before executing this module, create a database in your CouchDB named `helloCouch`
using [futon](http://localhost:5984/_utils).

This program creates a document in the CouchDB Database *helloCouch*.  Next,
it saves a document to the database with a key of *helloCouch* and a text
property.  Then, it retrieves the document from the database and prints the
contents of the document to the console.

## Promises

Methods on `CouchClient` and `Database` return [promises](http://wiki.commonjs.org/wiki/Promises).
The promises are [Promises/A](http://wiki.commonjs.org/wiki/Promises/A) compliant. You may be familiar
with [promises in jQuery](http://www.erichynds.com/jquery/using-deferreds-in-jquery/) as they have recently 
been added to make Ajax calls cleaner.