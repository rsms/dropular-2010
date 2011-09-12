#!/usr/bin/env node --
var sys = require('sys'), fs = require('fs'), path = require('path');
require.paths.unshift(path.join(path.dirname(fs.realpathSync(__filename)), '/../../lib'));
var legacy_user = require('dropular/legacy-user'),
    dbslayer = require('dbslayer');

legacy_user.db = new dbslayer.Server('hal.hunch.se', 9090, 15000);

if (process.argv.length < 4) throw new Error('too few arguments');

legacy_user.passwdCheck(process.argv[2], process.argv[3], function(err, match) {
  if (err) throw err;
  if (match) {
    sys.error('success -- todo: re-encrypt password and store it');
  } else {
    sys.error('bad password');
  }
})
