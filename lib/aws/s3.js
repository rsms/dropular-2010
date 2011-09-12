var http = require("http"),
    sys = require("sys"),
    sha1 = require('./sha1'),
    httputil = require('./httputil');

function Bucket(id, key, secret){
  this.id = id;
  this.key = key;
  this.secret = secret;
}
exports.Bucket = Bucket;

Bucket.prototype.urlTo = function(path){
  return 'http://'+
    (this.id ? this.id+'.' : '') + 's3.amazonaws.com'+
    path;
}

Bucket.prototype.request = function(options, callback){
  if (typeof options === 'function') { callback = options; options = undefined; }
  
  // Default options
  var opt = {
    host: (this.id ? this.id+'.' : '') + 's3.amazonaws.com',
    //debug: true,
    headers: {},
    ctxid: module.id
  };

  // mixin options
  if (typeof options === 'object') {
    // method, path, query, body, contentType, headers
    for (var k in options) opt[k] = options[k];
  }

  // create request
  var ev = httputil.request(opt, function(err, data, res){
    callback(err, data, res);
  });

  // prepare just before the request is actually sent
  var self = this;
  ev.addListener('connection', function(opt, conn){
    // user agent
    if (!('user-agent' in opt.headers))
      opt.headers['user-agent'] = 'node-aws';
    // sign?
    if (self.secret) {
      self.signRequest(opt);
    }
  });
  
  return ev;
}


Bucket.prototype.get = function(path, query, headers, callback){
  if (typeof headers === 'function') { callback = headers; headers = undefined; }
  else if (typeof query === 'function') { callback = query; query = undefined; }
  return this.request({
    path: path,
    query: query,
    headers: headers
  }, callback);
}

Bucket.prototype.put = function(path, data, contentType, options, callback){
  if (typeof options === 'function') { callback = options; options = undefined; }
  else if (typeof contentType === 'function') { callback = contentType; contentType = undefined; }

  var opt = {
    method: 'PUT',
    path: path,
    body: data,
    headers: {}
  };

  if (typeof options === 'object')
    for (var k in options) opt[k] = options[k];

  if (typeof opt.headers !== 'object')
    opt.headers = {};

  if (!('x-amz-acl' in opt.headers))
    opt.headers['x-amz-acl'] = 'public-read';

  if (contentType) {
    if (typeof opt.headers !== 'object') opt.headers = {};
    opt.headers['content-type'] = contentType;
  }

  return this.request(opt, callback);
}

Bucket.prototype.del = function(path, options, callback){
  if (typeof options === 'function') { callback = options; options = undefined; }
  var opt = {
    method: 'DELETE',
    path: path
  };
  if (typeof options === 'object')
    for (var k in options) opt[k] = options[k];
  return this.request(opt, callback);
}
  
// Sign a request
Bucket.prototype.signRequest = function(opt, date){
  var date = new Date(),
      resource = (opt.path || '/');
  if (this.id) resource = "/"+this.id + resource;
  opt.headers.date = date.toUTCString();
  opt.headers.authorization = 'AWS '+this.key+':'+this.sign(opt.method,
    opt.headers['content-md5'], opt.headers['content-type'],
    date, opt.headers, resource);
}

// Create signature
Bucket.prototype.sign = function(verb, contentMD5, contentType, date, amzHeaders, resource){
  /*
  Example:
    Authorization: AWS 0PN5J17HBGZHT7JJ3X82:frJIUN8DYpKDtOLCwo//yllqDzg=

  BNF:
    Authorization = "AWS" + " " + AWSAccessKeyId + ":" + Signature;

    Signature = Base64( HMAC-SHA1( UTF-8-Encoding-Of( YourSecretAccessKeyID, StringToSign ) ) );

    StringToSign = HTTP-Verb + "\n" +
      Content-MD5 + "\n" +
      Content-Type + "\n" +
      Date + "\n" +
      CanonicalizedAmzHeaders +
      CanonicalizedResource;

    CanonicalizedResource = [ "/" + Bucket ] +
      <HTTP-Request-URI, from the protocol name up to the query string> +
      [ sub-resource, if present. For example "?acl", "?location", "?logging", or "?torrent"];

    CanonicalizedAmzHeaders = <see http://docs.amazonwebservices.com/AmazonS3/latest/index.html?RESTAuthentication.html>
  */
  var s, amzHeadersIsObj = (typeof amzHeaders === 'object');

  // Format date
  if (!date) {
    if (amzHeadersIsObj && amzHeaders['x-amz-date']) date = amzHeaders['x-amz-date'];
    else if (amzHeadersIsObj && amzHeaders['date']) date = amzHeaders['date'];
    else date = (new Date()).toUTCString();
  } else if (typeof date === 'object') {
    date = date.toUTCString();
  }

  // Fix headers
  if (amzHeadersIsObj) {
    s = '';
    for (var k in amzHeaders) {
      if (k.indexOf('x-amz-') === 0) s += k+':'+amzHeaders[k]+'\n';
    }
    amzHeaders = s;
  } else {
    amzHeaders = '\n';
  }

  s = verb+"\n"+
      (contentMD5 || '')+"\n"+
      (contentType || '')+"\n"+
      date+"\n"+
      amzHeaders+
      resource;
  //sys.error(s.replace(/\n/gm, '\\n\n'));
  return sha1.b64_hmac_sha1(this.secret, s);
}

/*var b = new Bucket('static.dropular.net',
  'key', 'secret');

b.put('/test1.txt', 'hello test1', 'text/plain', function(err, data, res){
  if (err) throw err;
  b.get('/test1.txt', function(err, data, res){
    if (err) throw err;
    b.del('/test1.txt', function(err, data, res){
      if (err) throw err;
    })
  })
})
*/
