var fs = require('fs'),
    path = require('path'),
    couchdb = require('../couchdb'),
    s3 = require("../aws/s3");
__dirname = path.dirname(fs.realpathSync(__filename));


// Load user config
exports.config = {}
try {
  exports.config = require(__dirname+'/../../config');
} catch (e) {}
var cf = exports.config;

// Databases
exports.db = {
  //_auth: {type:'basic', username:'dropular', password:'abc'},
  users: new couchdb.Db(cf.users_db || {db:'dropular-users', timeout:15000}),
  drops: new couchdb.Db(cf.drops_db || 'dropular-drops'),
  newslist: new couchdb.Db(cf.newslist_db || 'dropular-newslist'),
}

exports.s3 = {
  'static': new s3.Bucket('static.dropular.net',
    'API_KEY', 'PRIVATE_KEY')
};
