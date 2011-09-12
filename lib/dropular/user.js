var sys = require('sys'),
    couchdb = require('couchdb'),
    querystring = require("querystring"),
    hash = require('oui/hash'),
    authToken = require('oui/auth-token'),
    config = require('./config'),
    strfold = require('../strfold'),
    legacyUser; // lazy to avoid conflict
var users = config.db.users;

// import conflicting modules
process.nextTick(function(){
  legacyUser = require('dropular/legacy-user');
});

// ----------------------------------------------------------------------------
// User object
var User = exports.User = function(){}

// Mixin User.prototype into object doc (e.g. which have been returned from the
// database).
User.fromDocument = function(doc) {
  mixin(doc, User.prototype);
  return doc;
}

const charsAllowedInCanonicalUsername = 'abcdefghijklmnopqrstuvwxyz0123456789_$()+-/';
User.canonicalizeUsername = function(username) {
  return strfold.fold(username.toLowerCase(), charsAllowedInCanonicalUsername);
}

User.canonicalUsername = function(user) {
  var canonicalUsername;
  if (typeof user === 'object') {
    if (user instanceof User) {
      // a user object was passed
      canonicalUsername = user.canonicalUsername;
    } else if (user.data && user.data.user) {
      // a valid session object was passed
      canonicalUsername = user.data.user.username;
    } else {
      // The above allows any object with a canonicalUsername member to be used.
      // an unknown object was passed
      canonicalUsername = user.canonicalUsername;
    }
  } else if (user && (user = String(user)).length > 0) {
    canonicalUsername = User.canonicalizeUsername(user);
  }
  return canonicalUsername;
}

// Explicit list of instance members which are sent to any client (authed or
// not). Used by User.prototype.publicRepresentation
User.publicMembers = [
  'canonicalUsername',
  'username',
  'created',
  'modified',
  'following',
  'real_name',
  'url',
  'about',
  'level',
  'subscriptions'
];

User.findUsername

// Find a user by username. If not found, undefined is passed to the callback.
User.find = function(username, callback) {
  var canonicalUsername = User.canonicalUsername(username);
  if (!canonicalUsername) {
    return callback(new Error('bad input: username'));
  } else if (canonicalUsername.length === 0) {
    return callback(); // not found
  }
  // Construct URI key
  var key = querystring.escape('user-'+canonicalUsername);
  // GET from users database
	users.get(key, function(err, doc, res) {
	  var user;
	  if (err) {
	    if (res.statusCode === 404) err = undefined;
    } else if (doc) {
  	  user = User.fromDocument(doc);
  	}
  	callback(err, user, res);
	});
}

/**
 * Find a user by username. If not found, 404 is send and callback isn't called.
 *   [username, ]req, callback(User user)
 * If username is not passed, username will be derived from:
 *   req.session.data.user.username || req.params.username
 * If there's no valid user in a session, or no "username" parameter, the user
 * will not be found.
 */
User.findOrSend404 = function(username, req, callback) {
  if (arguments.length === 2) {
    callback = req;
    req = username;
    if (req.session && req.session.data && req.session.data.user) {
      // optimization: User.find will be able to skip the canonicalization step
      //               of username if we pass a user object.
      username = req.session.data.user;
    } else if (req.params) {
      username = req.params.username;
    }
  }
  if (!username || String(username).length === 0) {
    req.response.sendError(404, 'User not found');
  } else {
    return User.find(username, function(err, user){
      if (err)
        req.response.sendError(err);
      else if (!user)
        req.response.sendError(404, 'User not found');
      else
        callback(user);
    });
  }
}

// Create or update user in database
User.put = function(doc, callback) {
  // TODO: add possibility to retry put-ing until 409 Conflict is not returned.
  //       Problem with retrying is how to handle merging...?
  //
  // General idea:
  //
  //   1. Upon a 409 Conflict response, perform a GET for the latest version.
  //   2. Calculate differences between this and the GET-ed version.
  //   3. Patch this (choosing  most recent version for conflicts).
  //   4. PUT and possiblty repeat steps 1-4 if yet another conflict.
  //
  // This should probably be a part of of the couchdb module which checks for:
  //
  //   obj.differencesFromDocument(Object document) -> Diff
  //   obj.mergeWithDocument(Object document, Diff diff) -> Object
  //
  // This way, since mergind is highly domain-specific, we can house the boiler
  // plate code (PUTing, GETing, retrying, etc) in the coucdb module and leave
  // merging to the application. We should probably also provide default diff
  // and merge implementations.
  
  // sanity check
  if (!doc._id) {
    if (callback) callback(new Error('_id is missing'));
    return;
  }
  doc.modified = Date.currentUTCTimestamp;
  if (!doc.created) doc.created = doc.modified;
  config.db.users.put(doc._id, doc, callback);
}

/**
 * Convenience functions which can be used to decide is `user` is at a certain
 * level of authority. Lower levels represent higher authority.
 *
 *   0 -- super users (administrators).
 *   1 -- premium users who can create drops.
 * >=2 -- regular users.
 */
User.isAdmin = User.isLevel0 = function(user){
  return user.level && parseInt(user.level) === 0;
}
User.isLevel1 = function(user){
  return ('level' in user) && !isNaN((user.level = parseInt(user.level))) && (user.level < 2);
}

// ----------------
// instance methods

mixin(User.prototype, {
  get sessionRepresentation() {
    return new exports.SessionUser(this);
  },

  get publicRepresentation() {
    var self = this, obj = {};
    User.publicMembers.forEach(function(key){
      if (key in self) obj[key] = self[key];
    });
    obj.gravatar = hash.md5(this.email, 16);
    return obj;
  },

  get authedRepresentation() {
    var self = this, obj = {};
    Object.keys(this).forEach(function(key){
      if (User.hiddenMembers.indexOf(key) === -1)
        obj[key] = self[key];
    });
    obj.gravatar = hash.md5(this.email, 16);
    return obj;
  },
  
  get documentRepresentation() {
    var key, doc = {};
    for (key in this) {
      if (!(key in User.prototype)) doc[key] = this[key];
    }
    return doc;
  },

  get canonicalUsername() {
    if (this._id) {
      return this._id.substr(5); // "user-"
    } else if (this.username) {
      var cu = User.canonicalizeUsername(this.username);
      this._id = 'user-' + cu;
      return cu;
    }
  },
  
  // level convenience proxies
  get isLevel0() { return User.isLevel0(this); },
  get isLevel1() { return User.isLevel1(this); },
  
  // Convenience method to verify a username == user.
  equals: function(user) {
    var t = typeof user;
    if (t === 'string') {
      return this.canonicalUsername === User.canonicalizeUsername(user);
    } else if (t === 'object') {
      return this.canonicalUsername === (user.canonicalUsername
        ? user.canonicalUsername : User.canonicalizeUsername(user.username));
    }
    return false;
  },
  
  setPasswd: function(password, callback) {
    // passhash = BASE16( SHA1( username ":" password ) )
    this.passhash = hash.sha1(this.username+":"+password, 16);
    this.save(callback);
  },
  
  save: function(callback) {
    return User.put(this.documentRepresentation, callback);
  },
  
  onAuthResurrected: function(finalizecb) {
    this.updateDropsView(finalizecb);
    return true; // take over responsibilty to call finalizecb.
  },
  
  handleAuthSuccessResponse: function(params, req, res, session, finalizecb) {
    return this.onAuthResurrected(finalizecb);
  },
  
  updateDropsView: function(force, callback) {
    var self = this;
    if (typeof force === 'function') { callback = force; force = undefined; }
    var path = '_design/user-drops-'+encodeURIComponent(this.canonicalUsername);
    config.db.drops.get(path, function(err, doc, res) {
      //sys.log('err => '+sys.inspect(err)+', doc => '+sys.inspect(doc));
      var is404 = false;
      if (err) {
        is404 = String(err.message).indexOf('not_found') !== -1;
        if (!err.message || !is404)
          return callback(err);
        doc = null;
      }
      if (!Array.isArray(self.following) && is404) {
        sys.log('[user] updateDropsView warning: user.following is not an array'+
          ' -- skipping for '+self.username);
        return callback(err);
      }
      var followingJSON = Array.isArray(self.following) ? JSON.stringify(self.following) : '[]',
          newDoc, newFun;
      // construct new view doc
      newDoc = JSON.parse(exports.userDropsViewTemplate);
      newFun = newDoc.views["from-following"].map = newDoc.views["from-following"].map
        .replace(/%FOLLOWING/g, followingJSON);
      // compare existing, if found
      if (doc) {
        var existingFun = doc.views["from-following"].map;
        //sys.log('newFun => '+newFun);
        //sys.log('existingFun => '+existingFun);
        if (newFun === existingFun && !force) {
          // not changed -- everything is up to date
          return callback();
        }
        sys.log('[user] updateDropsView updating modified view '+path+' for '+self.username);
        newDoc._rev = doc._rev;
      } else {
        sys.log('[user] updateDropsView creating view '+path+' for '+self.username);
      }
      // put the new view
      config.db.drops.put(path, newDoc, function(err, doc, cdres) {
        callback(err);
      });
    });
  },

  // custom auth handler for legacy users
  handleAuthRequest: function(params, req, res, session) {
    if (this.passhash || !this.legacy) {
      // this request is not intended for us
      return false;
    } else if (!this.legacy.passhash) {
      // Legacy user without legacy.passhash -- nothing we can do about this.
      sys.log('[dropular] Ignoring auth request for legacy user which is missing legacy.passhash');
      res.sendError(401, 'Bad credentials');
    } else if (!params.legacy_auth) {
      // Tell the client we are expecting legacy authentication
      res.sendObject({ expect: 'legacy_auth' });
    } else if (req.method !== 'POST') {
      res.sendError(400, 'Bad request: auth response must be done using POST');
    } else if (!params.password) {
      // The client provided an illegal legacy auth request
      res.sendError(401, 'Incomplete legacy auth request');
    } else {
      sys.log('[dropular] authenticating legacy user '+this.username);
      // The client has provided us with a valid legacy auth request
      var self = this;
      legacyUser.authenticate(this.username, params.password, function(err, user) {
        if (err) {
          sys.log('[dropular] error while authenticating legacy user '+self.username+': '+err);
          return res.sendError(err);
        }
        if (!user) {
          sys.log('[dropular] bad credentials for legacy user '+self.username);
          res.sendError(401, 'Bad credentials');
        } else {
          sys.log('[dropular] successfully authenticated legacy user '+self.username);
          // transition user into a "regular" user by setting its passhash
          self.setPasswd(params.password, function(err) {
            if (err) return res.sendError(err);
            sys.log('[dropular] successfully converted legacy user '+self.username);
            session.data.authToken = authToken.generate(
              config.server.authSecret, self.passhash);
            session.data.user = self.sessionRepresentation;
            user.handleAuthSuccessResponse(params, req, res, session, function(err) {
              if (err) return res.sendError(err);
              var msg = {user: self.authedRepresentation};
              if (session.data.authToken)
                msg.auth_token = session.data.authToken;
              res.sendObject(msg);
            });
          })
        }
      });
    }
    return true; // we took over responsibility
  }

  /* LEGACY replicateDrops: function(callback) {
    if (!this.following || !this.following.length)
      return callback();
    var db = new couchdb.Db({auth: config.db._auth});
    var body = {
      source: "dropular-drops",
      target: "dropular-user-drops-"+this.canonicalUsername,
      create_target: true,
      filter: "replication/user-drops",
      query_params: {
        usernames: this.following
      }
    };
    db.post('_replicate', body, function(err, result, res){
      callback(err, result, res);
    });
  }*/
});

// Insance members which are never sent to the outside. Used by
// User.prototype.authedRepresentation.
// Need to be run down here, as we use User.prototype
User.hiddenMembers = Object.keys(User.prototype).concat([
  'passhash', 'legacy'
]);

// ----------------------------------------------------------------------------
// object used to represent a user in persistent session storage

exports.SessionUser = function(user){
  exports.User.call(this);
  if (user) {
    this.username = user.canonicalUsername;
    this.level = user.level;
  }
};

// This enables us to do "obj instanceof User"
sys.inherits(exports.SessionUser, exports.User);

// remove all but some things from the prototype
Object.keys(exports.SessionUser.prototype).filter(function(k){
  // prototype members which should be included in a SessionUser
  return k !== 'equals';
}).forEach(function(k){
  delete exports.SessionUser.prototype[k];
});

// ----------------------------------------------------------------------------
// Drop from following view template

exports.userDropsViewTemplate = JSON.stringify({
   "_id": "_design/user-drops-", // + canonicalUsername
   "language": "javascript",
   "views": {
       "from-following": {
           "map": "function(doc) {\n"+
                  "  var following = %FOLLOWING;\n"+
                  "  var user, createdBy, created; // find lowest timestamp\n"+
                  "  for (user in doc.users) {\n"+
                  "    var t = doc.users[user][0];\n"+
                  "    if (!created || t < created) {\n"+
                  "       created = t;\n"+
                  "       createdBy = user;\n"+
                  "    }\n"+
                  "  }\n"+
                  "  for (user in doc.users) {\n"+
                  "    for (i=following.length; --i > -1;) {\n"+
                  "      if (following[i] === user)\n"+
                  "        emit([created, user], doc._id);\n"+
                  "    }\n"+
                  "  }\n"+
                  "}" // s/%FOLLOWING/JSON.stringify(user.following)/g
       }
   }
});
