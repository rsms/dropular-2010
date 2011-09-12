var sys = require('sys'),
    http = require('http');

function Db(id) {
  this.id = parseInt(id);
}
exports.Db = Db;

Db.prototype.rpcCall = function(method, args, callback){
  var reqObject = {
    method: method,
    params: args
  };
  var reqBody = JSON.stringify(reqObject);
  var headers = {
    'Content-Length': reqBody.length,
    'Content-Type': 'application/json'
  };
  var conn = http.createClient(31128, '127.0.0.1');
  var req = conn.request('POST', '/JSON-RPC', headers);
  req.write(reqBody, 'utf-8');
  req.addListener('response', function (res) {
    var data = '';
    res.addListener('data', function (chunk){
      data += chunk;
    });
    res.addListener('end', function(){
      try {
        var e, r = JSON.parse(data);
        if (r.fault !== undefined) {
          var e = new Error('ImgDBError: '+(r.faultString || r.fault));
          e.type = r.fault;
          e.code = r.faultCode;
        } else if (Array.isArray(r)) {
          if (r.length === 1) r = r[0];
          else if (r.length === 0) r = null;
        }
        callback(e, r);
      } catch (err) {
        callback(err);
      }
    });
  })
  req.end();
}

Db.prototype.queryImageId = function(imgId, limit, callback){
  if (typeof limit === 'function') { callback = limit; limit = null; }
  if (!limit) limit = 25;
  this.rpcCall("queryImgID", [this.id, imgId, limit], callback);
}

Db.prototype.addImage = function(imgId, filename, callback){
  this.rpcCall("addImg", [this.id, imgId, filename], callback);
}

Db.prototype.appendImg = function(filename, callback){
  this.rpcCall("appendImg", [this.id, filename], callback);
}

/* // Test
var db = new Db(1);
db.queryImageId(30, 25, function(err, rsp) {
  sys.p(rsp);
});
db.appendImg('/Users/rasmus/similar-images/numbered/30.jpg', function(err, rsp) {
  if (err) sys.error(err.stack || err);
  sys.p(rsp);
});
*/