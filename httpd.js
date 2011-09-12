#!/usr/bin/env node
var sys = require('sys'), fs = require('fs'), path = require('path');
__dirname = path.dirname(fs.realpathSync(__filename));
require.paths.unshift(__dirname + '/lib');
var oui = require('oui'),
    couchdb = require('couchdb'),
    imagemagick = require('imagemagick'),
    config = require('dropular/config'),
    User = require('dropular/user').User,
    Drop = require('dropular/drop').Drop,
    Tag = require('dropular/tag');

process.addListener('uncaughtException', function(err){
  try {
    sys.error('Uncaught exception: '+
      (err.type ? '['+err.type+'] ' : '')+
      (err ? (err.stack || err) : '<unknown error>'));
  } catch (e) {
    sys.error('CRITICAL: error in error handler');
  }
  process.exit(4);
});

// Parse command line options
// TODO: move into oui and use trollop
// Default options
var opt = {
  port: 8100,
  quiet: false,
  addr: '0.0.0.0'
}
// Load local config
try {
  var localOpt = require(__dirname+'/httpd.conf');
  mixin(opt, localOpt);
} catch (e) { /*discard*/ }
// Parse args
var args = process.argv.slice(2);
for (var i=0,arg; arg = args[i]; i++) {
  switch (arg) {
    case '-q':
    case '--quiet':
      opt.quiet = true; break
    case '-d':
    case '--debug':
      opt.debug = true; opt.quiet = false; break
    case '-N':
    case '--no-debug':
      opt.debug = false; break
    case '-a':
    case '--addr':
      opt.addr = args[++i]; break;
    case '-p':
    case '--port':
      opt.port = args[++i]; break;
    case '-h':
    case '--help':
      sys.error('usage: server.js [options]\n'+
        'options:\n'+
        '  -q, --quiet        Disable logging to stdout.\n'+
        '  -d, --debug        Enable debug mode.\n'+
        '  -N, --no-debug     Disable debug mode (if enabled by httpd.conf.js).\n'+
        '  -a, --addr <addr>  Address to bind to. Defaults to '+opt.addr+'.\n'+
        '  -p, --port <port>  Port to bind to. Defaults to '+opt.port+'.\n'+
        '  -h, --help         Display usage and exit 3.\n');
      process.exit(3)
  }
}

// debug mode?
if (opt.debug) {
  sys.log('debug mode');
  oui.debug = true;
  for (var k in config.db) config.db[k].debug = true;
  couchdb.debug = true;
}

// Start a server
var server = oui.server.start({
  addr: opt.addr,
  port: opt.port,
  documentRoot: __dirname + '/public',
  pathPrefix: '/api',
  
  // site origins allowed to interface with the server from a browser (CORS)
  allowedOrigin: /^https?:\/\/(?:(?:.+\.|)(?:dropular|hunch)\.[^\.]+|localhost|.+\.local)(?::[0-9]*|)$/,
  
  // never reveal this and never change it:
  authSecret: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  
  userPrototype: User,
  verbose: !opt.quiet
});

// save a reference to the server in config, making it easy accessible.
config.server = server;

// Enable standard functionality (static file handling, sessions, etc).
server.enableStandardHandlers();

function requestDrops(method, params, req, res, options, callback) {
  var opt = {
    maxLimit: 100,
    defaultLimit: 10,
    allowComplete: false,
    defaultComplete: false,
    path: null,
    db: config.db.drops,
    notfoundSendsEmptyResult: false
  }
  mixin(opt, options);
  var query = {
    include_docs: (params.complete === 'true') || !!parseInt(params.complete),
    limit: parseInt(params.limit),
  };
  
  if (typeof opt.query === 'object')
    mixin(query, opt.query);

  if (isNaN(query.limit) || (typeof query.limit !== 'number'))
    query.limit = 40;
  else if (query.limit > opt.maxLimit)
    query.limit = opt.maxLimit;
  
  if (params.skip && (params.skip = parseInt(params.skip)) && !isNaN(params.skip))
    query.skip = params.skip;

  if (opt.defaultComplete) opt.allowComplete = true;
  if (query.include_docs && !opt.allowComplete)
    delete query.include_docs;
  else if (query.include_docs === undefined && opt.defaultComplete)
    query.include_docs = true;
  
  var q = {
    path: opt.path,
    query: query
  };
  
  // todo: respect and bounce around cache headers, like "If-none-match".
  
  var handler = function(err, r, cdres){
    if (err) {
	    if (callback) return callback(err, r, cdres);
	    if (cdres.statusCode === 404) {
	      if (opt.notfoundSendsEmptyResult) {
	        res.sendObject({
	          drop:[],
	          total: 0,
	          offset: 0
	        });
	      } else {
	        res.sendError(404);
        }
      }
	    else res.sendError(err);
	    return;
    }
    if (callback) return callback(null, r, res);
	  res.sendObject({
	    drops: r.rows,
	    total: r.total_rows,
	    offset: r.offset
	  });
	};
  
  if (method === 'GET') {
	  opt.db.get(q, handler);
  } else if (method === 'POST') {
	  opt.db.post(q, opt.body, handler);
  } else {
    throw new Error('bad method '+method);
  }
}

function getDrops(params, req, res, options, callback) {
  return requestDrops('GET', params, req, res, options, callback);
}

function postDrops(params, req, res, options, callback) {
  return requestDrops('POST', params, req, res, options, callback);
}

function requireParam(params, param, type, req, res) {
  var validType, value = params[param];
  if (value === undefined) {
    return res.sendError(400, 'Missing '+param+' parameter');
  } else if (typeof value === 'string') {
    value = value.trim();
  }
  if (type instanceof RegExp) {
    if (!String(value).match(type))
      return res.sendError(400, 'bad format of parameter '+param);
  } else {
    validType = (type === 'array') ?
      Array.isArray(value) : (typeof value === type);
    if (!validType) {
      return res.sendError(400, param+' parameter it not a '+type);
    } else if (typeof value === 'string' && value.length === 0) {
      return res.sendError(400, param+' parameter is empty');
    }
  }
  return value;
}

// -----------------------------------------------------------------------------
// Handlers

// Get recently created drops (by all users)
server.on('GET', '/drops/drop/:id', function(params, req, res){
  config.db.drops.get(encodeURIComponent(params.id), function(err, result, cdres){
	  if (err) return res.sendError(err);
	  res.sendObject(result);
  });
});

// Get recently created drops (by all users)
server.on('GET', '/drops/recent', function(params, req, res){
  getDrops(params, req, res, {
    path:'_design/drops/_view/recently-created',
    defaultLimit: 40,
    maxLimit: 54,
    allowComplete: true,
    query: {
      descending: true
    }
  });
});

// Get interesting drops (by all users)
server.on('GET', '/drops/interesting', function(params, req, res){
  // http://127.0.0.1:5985/dropular-drops/_design/drops/_view/popular?startkey=%220%22&endkey=0&descending=true&stale=ok&limit=100
  var query = {
    startkey: '0',
    endkey: 0,
    descending: true
  };
  getDrops(params, req, res, {
    path:'_design/drops/_view/popular',
    defaultLimit: 50,
    maxLimit: 100,
    allowComplete: true,
    query: query,
  });
});

// Get drops tagged with :tags (by all users)
server.on('GET', '/drops/tagged/:tags', function(params, req, res){
  // http://127.0.0.1:5984/dropular-drops/_design/tags/_view/all?startkey=%5B%221%22%2C0%5D&endkey=%5B%22z%22%2C%220%22%5D&descending=true&limit=10
  if (!params.tags) return res.sendError(400, 'no tags specified');
  if (typeof params.tags === 'string')
    params.tags = params.tags.split(/[+\/,]+/);
  else if (!Array.isArray(params.tags))
    return res.sendError(400, '"tags" parameter must be an array');
  if (params.tags.length === 0)
    return res.sendError(400, 'no tags specified');
  var tag = params.tags[0];
  // TODO: multi-tag queries
  var query = {
    startkey: [tag, '0'],
    endkey: [tag, 0],
    inclusive_end: true,
    descending: true // newest first
  };
  getDrops(params, req, res, {
    path:'_design/tags/_view/all',
    defaultLimit: 50,
    maxLimit: 100,
    allowComplete: true,
    query: query,
  });
});

// Get info about a user.
// Auth: optional
server.on('GET', '/users/:username', function(params, req, res){
  User.findOrSend404(params.username, req, function(user) {
    if (user.equals(req.authorizedUser))
      res.sendObject(user.authedRepresentation);
    else
      res.sendObject(user.publicRepresentation);
  });
});

// Get drops created or re-dropped by a user
server.on('GET', '/users/:username/drops', function(params, req, res){
  var username = requireParam(params, 'username', 'string', req, res);
  if (!username) return;
  username = User.canonicalizeUsername(username);
  getDrops(params, req, res, {
    path:'_design/drops/_view/by-username-and-time',
    defaultLimit: 40,
    maxLimit: 54,
    allowComplete: true,
    query: {
      startkey: [username, 'A'],
      endkey: [username],
      descending: true
    }
  });
});

// Get drops from people `username` is following
server.on('GET', '/users/:username/following/drops', function(params, req, res){
  var username;
  if (!(username = requireParam(params, 'username', 'string', req, res))) return;
  username = User.canonicalizeUsername(username);
  getDrops(params, req, res, {
    path:'_design/user-drops-'+encodeURIComponent(username)+
      '/_view/from-following',
    defaultLimit: 18,
    maxLimit: 54,
    allowComplete: true,
    notfoundSendsEmptyResult: true,
    query: {
      descending: true
    }
  });
});

// Add one or more tag subscriptions for :username
// Auth: any
server.on('POST', '/users/:username/subscriptions', function(params, req, res){
  // for the sake of keeping URLs semantic, we make sure the username is the
  // same as for the authorized user.
  if (req.abortUnlessAuthorized(function(user){
    return user.equals(params.username);
  })) return;
  // Check that we got some input
  var tags = params.tags;

  if (!tags)
    return res.send(200);
  else if (!Array.isArray(tags))
    return res.sendError(400, '"tags" parameter is not an array');
  else if (tags.length === 0)
    return res.send(304);
  else if (tags.length > 25)
    return res.sendError(400, 'too many tags');

  User.findOrSend404(req, function(user) {
    // First, canonicalize the tags
    tags = Tag.canonicalize(tags);
    // Create or append
    if (user.subscriptions)
      tags = user.subscriptions.concat(tags);
    // Make sure there are no duplicates
    tags = tags.unique();
    // If no new tags was added, skip saving
    if (user.subscriptions && user.subscriptions.diff(tags).length === 0)
      return res.send(304);
    user.subscriptions = tags;
    // Save
    user.save(function(err, result){
      if (err) res.sendError(err);
      res.sendObject(result);
    });
  });
});

// Remove one or more tag subscriptions for :username
// Auth: any
server.on('POST', '/users/:username/subscriptions/remove', function(params, req, res){
  // for the sake of keeping URLs semantic, we make sure the username is the
  // same as for the authorized user.
  if (req.abortUnlessAuthorized(function(user){
    return user.equals(params.username);
  })) return;
  // Check that we got some input
  var removeTags = params.tags;

  if (!removeTags)
    return res.send(200);
  else if (!Array.isArray(removeTags))
    return res.sendError(400, '"tags" parameter is not an array');
  else if (removeTags.length === 0)
    return res.sendError(400, 'Empty "tags" parameter');
  else if (removeTags.length > 1000)
    return res.sendError(400, 'Too many tags');

  User.findOrSend404(req, function(user) {
    var modified = false;
    // First, canonicalize the tags
    removeTags = Tag.canonicalize(removeTags);
    // Remove any from subscriptions
    if (user.subscriptions && user.subscriptions.length) {
      user.subscriptions = user.subscriptions.filter(function(tag){
        if (removeTags.indexOf(tag) !== -1) {
          return false;
          modified = true;
        }
        return true;
      });
    }
    if (!modified)
      return res.send(304);
    // Save
    user.save(function(err, result){
      if (err) res.sendError(err);
      res.sendObject(result);
    });
  });
});

// Email opt-in
server.on('POST', '/etc/email-opt-in', function(params, req, res){
  var email;
  if (!(email = requireParam(params, 'email', /^.+@.+\..+$/, req, res))) return;
  email = email.toLowerCase();
  var key = encodeURIComponent(email),
      doc = {
        created: (new Date).toString(),
        ip_address: req.headers['x-client-addr'] || req.connection.remoteAddress
      };
  // Add arbitrary strings from params
  Object.keys(params).forEach(function(k){
    if (k !== 'email' && typeof params[k] === 'string' && k.charAt(0) !== '_') {
      doc[k] = params[k].trim();
    }
  });
  config.db.newslist.put(key, doc, function(err, result, cdres){
    if (result && result.error === 'conflict') {
      res.send(304);
    } else {
      sys.log('[dropular] newslist: registered '+email);
      res.sendObject(result, 201);
    }
  });
});


function _resizeImage(options, data, callback) {
  var opt = {srcData: data};
  for (var k in options) opt[k] = options[k];
  imagemagick.resize(opt, callback);
}

function _s3_put(key, contentBody, contentType, callback) {
  var s3bucket = config.s3.static,
      s3url = s3bucket.urlTo(key);
  sys.log('[s3] uploading '+s3url);
  s3bucket.put(key, contentBody, contentType, function(err, data, res){
    if (!err && (res.statusCode < 200 || res.statusCode >= 300)) {
      // TODO parse error message
      err = new Error('AWS S3 responded with '+res.statusCode);
    }
    if (!err) {
      sys.log("[s3] upload to s3 finished: "+s3url+' (http status '+res.statusCode+')');
    } else {
      sys.log("[s3] upload to s3 FAILED ("+s3url+"): "+(err.stack || err)+'\n'+data);
    }
    if (callback) callback(err);
  });
}


// Drop something
// Auth: level1
server.on('POST', '/drop', function(params, req, res){
  if (req.abortUnlessAuthorized(User.isLevel1)) return;
  Drop.fromUserInput(params, req.session.data.user, function(err, drop, modified, isnew){
    if (err) {
      // error
      return res.sendError(err);
    } else if (!modified) {
      // not modified
      return res.sendObject({ok:true, noop:true, id:drop._id, rev:drop._rev}, 200);
    } else {
      // new or modified
      if (isnew) {
        // New drop
        // 1/3 -- Upload image
        Drop.uploadImageFromURL(drop.url, drop._id, function(err, key, contentBody, imageFormat){
          if (err) return res.sendError(err);
          // 2/3 -- Generate resized versions and upload to S3
          var _resizeAndUpload = function(size, data, props, callback) {
            if (props.width <= size && props.height <= size)
              return callback(data, false);
            var key2 = key.replace(/\.([^\.]+)$/, '.'+size+'.jpg');
            // downsize to fit within size
            imagemagick.resize({width:size, format:'jpg', srcData:data}, function(err, imdata){
              if (err) return res.sendError(err);
              _s3_put(key2, imdata, 'image/jpeg', function(err){
                if (err) return res.sendError(err);
                callback(imdata, true);
              });
            });
          };
          // identify image dimensions & resize as appropriate
          imagemagick.identify({data:contentBody}, function(err, props) {
            _resizeAndUpload(720, contentBody, props, function(contentBody720){
              _resizeAndUpload(256, contentBody720, props, function(contentBody256){
                // 3/3 -- Create the drop by PUT
                drop.image = props;
                drop.save(function(err, result, cdRes) {
                  if (err) return res.sendError(err);
                  res.sendObject(result, cdRes.statusCode);
                });
              }); // {key -".jpg"} + ".256.jpg"
            }); // {key -".jpg"} + ".720.jpg"
          }); // identify
        }); 
      } else {
        // Existing drop
        // 1/1: Save modifications
        drop.save(function(err, result, cdRes) {
          if (err) return res.sendError(err);
          res.sendObject(result, cdRes.statusCode);
        });
      }
    }
  });
});

// ----------------------------------------------------------------------------
if (opt.debug) {
  sys.log('[debug] routes =>\n  '+String(server.routes).replace(/\n/g, '\n  '));
}