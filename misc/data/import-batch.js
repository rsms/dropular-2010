#!/usr/bin/env node --
// This program imports a batch of documents into couchdb.
//
// usage: import-batch.js <database> <filename> ..
// - Each line of <filename> should be a document i.e. {"_id":"foo","field1":123}.
// - A line not starting with a "{" is ignored.
// - Any trailing "," and whitespace on a line is ignored and can thus exists.
//
var sys = require('sys'),
    fs = require('fs'),
    querystring = require('querystring'),
    http = require('http'),
    couchdb = require('../../lib/couchdb');

// Parse options and load data
var lines = '';
var database = process.argv[2];
if (!database) {
  sys.error('usage: import-batch.js <database> <filename> ..');
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
// check for db existance
db.get('', function(err, r) {
  if (!err) return;
  if (err.couchDbError === 'not_found') sys.error('no such database '+sys.inspect(database));
  else sys.error('['+err.couchDbError+'] '+err);
  process.exit(1);
});
// go on and load data
process.argv.slice(3).forEach(function(filename){
  try {
    lines += fs.readFileSync(filename);
  } catch (e) {
    if (e.message === 'No such file or directory') {
      sys.error(e.message+': '+filename);
      process.exit(1);
    }
    throw e;
  }
});
if (lines.length === 0) {
  sys.error('No input files or they are empty -- aborting');
  process.exit(1);
}
lines = lines.trim().split('\n');
sys.log('loaded '+lines.length+' prepared documents');

// proceed with sequentially submitted batches of 100
function postNextBatch(offset, length) {
  var body = lines.slice(offset, offset+length);
  var count = body.length;
  body = '{"docs":[' + body.filter(function(line){
    return line.length && line.charAt(0) === '{';
  }).map(function(line){
    return line.replace(/[,\n ]+$/,'');
  }).join(',\n') + ']}';
  db.post('_bulk_docs', body, function(err, result) {
    if (err) sys.error(err.stack);
    else {
      // ignore conflict errors, but abort on other errors
      if (Array.isArray(result)) {
        var hadError = false;
        result.forEach(function(status){
          if (status.error && status.error !== 'conflict') {
            sys.error('couchdb ['+status.error+'] '+status.reason+' (key: '+status.id+')');
            hadError = true;
          }
        });
        if (hadError) return;
      } else if (typeof result === 'object' && result.error) {
        sys.error('couchdb ['+status.error+'] '+status.reason+' -- '+sys.inspect(result));
        return;
      }
      sys.log('posted ['+offset+','+count+'] ('+(offset+length)+' of '+lines.length+')');
      if (count === length)
        postNextBatch(offset+length, length);
    }
  });
}
postNextBatch(0, 100);
