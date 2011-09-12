#!/usr/bin/env node --
// This program imports documents into a couchdb
// usage: import-docs.js <database> <filename> ..
var sys = require('sys'),
    fs = require('fs'),
    couchdb = require('../../lib/couchdb');

var status = 0, p, p2;
var rawDocs = [];
var database = process.argv[2];
if (!database) {
  sys.error('usage: import-docs.js <database> <filename> ..');
  process.exit(1);
} else if (database.charAt(0) === '{') {
  database = JSON.parse(database);
} else if ((p = database.indexOf(':')) !== -1) {
  var db = '';
  if ((p2 = database.indexOf('/')) !== -1) {
    db = database.substr(p2+1);
    database = database.substr(0, p2);
  }
  database = {
    host: database.substr(0, p),
    port: parseInt(database.substr(p+1)),
    db: db
  }
}
var db = new couchdb.Db(database);

db.get('', function(err, r) {
  if (err) {
    if (err.couchDbError === 'not_found') sys.error('no such database '+sys.inspect(database));
    else sys.error('['+err.couchDbError+'] '+err);
    return process.exit(1);
  }

  // go on and load data
  process.argv.slice(3).forEach(function(filename){
    try {
      db.post('', fs.readFileSync(filename), function(err, result){
        if (err) {
          sys.error(err+'\n'+sys.inspect(result));
          process.exit(1);
        } else {
          sys.log('successfully imported '+filename+'\n'+sys.inspect(result));
        }
      });
    } catch (e) {
      if (e.message === 'No such file or directory') sys.error(e.message+': '+filename);
      else sys.error(e.stack || e);
      process.exit(1);
    }
  });
});
