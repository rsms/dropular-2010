var sys = require('sys'),
    hash = require('../oui/hash'),
    User = require('./user').User;

function passwd_encode(password) {
  var salt = "";
  // I know, it's a fucking joke...
  for (var i=0; i<password.length; i++)
    salt += hash.md5(password.charAt(i));
  return hash.md5(salt);
}

function remotecrypt(value, key, callback) {
  // winner of uglyhack2010... a web service doing <?= crypt(value, key); ?>
  var http = require('http');
  var conn = http.createClient(80, 'hunch.se');
  var path = '/dropular/uglyhack2010/crypt.php?'+
    'value='+encodeURIComponent(value)+
    '&key='+encodeURIComponent(key);
  var request = conn.request('GET', path, {'Host': 'hunch.se',});  
  request.addListener('response', function(response) {
    //sys.error('response => '+response);
    //var clen = parseInt(response.headers['content-length']);
    var buf = '';
    response.addListener('data', function (chunk) {
  		buf += chunk;
  		/*if (buf.length >= clen) {
  		  callback(null, buf);
  		  sys.error('chunk => '+chunk);
  		}*/
  	});
    response.addListener('end', function(){
      //sys.error('response end');
      callback(null, buf);
    })
  });
  request.close();
  return request;
}

exports.authenticate = function(username, password, callback) {
  User.find(username, function(err, user) {
    if (err) return callback(err);
    if (!user.legacy) return callback();
    var passhash = passwd_encode(password);
    remotecrypt(passhash, user.legacy.passhash, function(err, result) {
      //sys.error('crypt result => '+result);
      callback(err, (result === user.legacy.passhash) ? user : null);
    });
  });
}
