// drop entitiy
var sys = require('sys'),
    querystring = require("querystring"),
    path = require('path'),
    http = require('http'),
    hash = require('oui/hash'),
    ouiutil = require('oui/util'),
    mimetypes = require('oui/mimetypes'),
    _tag = require('./tag'),
    User = require('./user').User,
    config = require('./config');


function mkerr(message, statusCode, type) {
  var err = new Error(message);
  err.statusCode = statusCode;
  if (type) err.type = type;
  return err;
}

var Drop = exports.Drop = function(){};

const imageExts = {'.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.gif':'image/gif'};
const s3baseURL = 'http://BUCKET.s3.amazonaws.com';
const s3baseKey = '/drops/images/';

mixin(Drop.prototype, {
  get documentRepresentation() {
    var key, doc = {};
    for (key in this) {
      if (!(key in Drop.prototype)) doc[key] = this[key];
    }
    return doc;
  },

  get publicRepresentation() {
    return this.documentRepresentation;
  },

  save: function(callback) {
    return Drop.put(this.documentRepresentation, callback);
  },

  get originalImageURL() {
    return Drop.largeImageURLFromId(this._id || this.id, this.url);
  },

  get originalImageKey() {
    return Drop.imageKeyFromId(this._id || this.id, this.url);
  }
});


mixin(Drop, {
  // Mixin Drop.prototype into object doc (e.g. which have been returned from the
  // database).
  fromDocument: function(doc) {
    mixin(doc, Drop.prototype);
    return doc;
  },
  
  /**
   * @param creatorUser Can be either a user object or a username String.
   */
  fromUserInput: function(params, creatorUser, callback) {
    /*
    A drop document looks like this:

    "f4M5oRKeBveKONIRlU1uPezaBmX" => {
      "url":      "http://bar.com/finger/fashion/fingertip-shoes.jpg",
      "origin":   "http://www.foundshit.com/finger-tip-shoe-fashion/",
      "tags":     ["shoes", "fashion"],
      "title":    "Finger Tip Fashion \u00bb Funny, Bizarre, Amazing Pictures",
      "desc":     "Crazy little shoe for fingers",
      "disabled": true,
      "nsfw":     true,
      "users": {
        "foo": [1258195680123, 2],
        "someuser": [1258195681123, 1],
        "mrtroll": [1258195682123, 1]
      }
    }
    */
    
    // username
    var canonicalUsername = User.canonicalUsername(creatorUser);
    if (!canonicalUsername) {
      return callback(mkerr(
        'Bad argument "creatorUser" passed to Drop.fromUserInput', 400));
    }
    
    // the new drop object
    var drop = new Drop();
    
    // sanitize input
    var err = ouiutil.sanitizeInput(params, drop, {
      url:    {type:'url', required:true},
      origin: {type:'url'},
      tags:   {type:'array', filter:_tag.canonicalize},
      title:  {type:'string'},
      desc:   {type:'string'},
      nsfw:   {type:'boolean'}
    });
    if (err) return callback(err);

    // calculate id
    drop._id = hash.sha1(drop.url, 62);

    // fetch any previous version
    Drop.find(drop._id, function(err, prevDrop, cdres) {
      // TODO: repeat this if there are conflicts when PUT-ing (should be
      //       implemented in the couchdb module using Object.merge3)
      var modified = true, isnew = false, err2;
      if (err) {
        sys.p(cdres);
        return callback(err);
      }
      drop.users = {};
      if (prevDrop) {
        // merge
        if (!prevDrop.users || !(canonicalUsername in prevDrop.users))
          drop.users[canonicalUsername] = [Date.currentUTCTimestamp, 1];
        var a = prevDrop.documentRepresentation,
            b = drop.documentRepresentation,
            m3;
        // make sure input can not override some existing, already set properties
        (['origin', 'title', 'desc', 'nsfw']).forEach(function(n){
          if (n in a && n in b) delete b[n];
        });
        // 3-way merge
        m3 = Object.merge3(a, b, a);
        //sys.debug('merge3 => '+sys.inspect(m3, false, 10));
        // error on conflicts
        if (m3.conflicts) {
          err2 = new Error('Conflicting edits. Please retry.');
          err2.statusCode = 409;
          drop = undefined;
        } else {
          drop = Drop.fromDocument(m3.merged);
          modified = (m3.added || m3.updated);
        }
      } else {
        // new drop
        // TODO: apply user-specific score when we have such
        drop.users[canonicalUsername] = [Date.currentUTCTimestamp, 2];
        isnew = true;
      }
      // the drop is complete
      callback(err2, drop, modified, isnew);
    });
  },
  
  imageKeyFromId: function(id, deduceFileExtFromURLOrFileExt) {
    var ext = '.jpg';
    if (deduceFileExtFromURLOrFileExt) {
      if (deduceFileExtFromURLOrFileExt.charAt(0) === '.') {
        ext = deduceFileExtFromURLOrFileExt;
      } else {
        // TODO: parse url, or at least parse away ?xyz=123 etc
        ext = path.extname(deduceFileExtFromURLOrFileExt, '.jpg');
      }
    }
    ext = ext.toLowerCase();
    if (!(ext in imageExts)) ext = '.jpg';
    return s3baseKey + id.charAt(0)+'/'+id.substr(1,2)+'/'+id.substr(3) + ext;
  },
  
  largeImageURLFromId: function(id, deduceFileExtFromURLOrFileExt) {
    return s3baseURL + Drop.imageKeyFromId(id, deduceFileExtFromURLOrFileExt);
  },

  uploadImageFromURL: function(url, id, callback) {
    sys.log('[drop s3] fetching '+url);
    http.cat(url, "binary", function (err, contentBody) {
      if (err) return callback(err);
      var p, key = Drop.imageKeyFromId(id, url),
          fileext = path.extname(key),
          contentType = imageExts[fileext],
          s3bucket = config.s3.static,
          s3url = s3bucket.urlTo(key);
      sys.log('[drop s3] uploading '+s3url);
      //var b = new require('buffer').Buffer(contentBody.length);
      //b.write(contentBody, 'binary', 0);
      s3bucket.put(key, contentBody, contentType, function(err, data, res){
        if (!err && (res.statusCode < 200 || res.statusCode >= 300)) {
          // TODO parse error message
          err = new Error('AWS responded with '+res.statusCode);
        }
        if (!err) {
          sys.log("[drop s3] upload to s3 finished: "+s3url+
            ' (http status '+res.statusCode+')');
        } else {
          sys.log("[drop s3] upload to s3 FAILED: "+(err.stack || err)+'\n'+data);
        }
        if (callback) callback(err, key, contentBody, fileext.substr(1));
      });
    });
  },

  // Find a drop by its id
  find: function(id, asDropObject, callback) {
    if (typeof asDropObject === 'function') {
      callback = asDropObject;
      asDropObject = undefined;
    }
    if (asDropObject === undefined) asDropObject = true;
  	config.db.drops.get(querystring.escape(id), function(err, doc, res) {
  	  var drop;
  	  if (err) {
  	    if (res.statusCode === 404) err = undefined;
      } else if (doc) {
    	  drop = asDropObject ? Drop.fromDocument(doc) : doc;
    	}
    	callback(err, drop, res);
  	});
  },

  put: function(drop, callback) {
    config.db.drops.put(drop._id, drop, callback);
  }
});

mixin(Drop.prototype, {
  toJSON: function() {
    var key, obj = {};
    for (key in this) {
      if (!(key in Drop.prototype)) obj[key] = this[key];
    }
    return obj;
  },
});

// Used by Drop.prototype.publicRepresentation
Drop.hiddenMembers = Object.keys(Drop.prototype);
