var sys = require('sys');

// ----------------------------------------------------------------------------
// Simple instance pool (aka free list)

function Pool(keep, limit) {
  process.EventEmitter.call(this);
  this.keep = keep || 0;
  this.limit = limit || 128;
  this.free = []; // push used to end/right, shift new from front/left
  this.busy = 0;
  this.getQueue = [];
}
exports.Pool = Pool;
sys.inherits(Pool, process.EventEmitter);
Pool.prototype.create = function() { throw new Error('not implemeted'); }
Pool.prototype.get = function(callback) {
  var instance = this.free.shift();
  if (!instance) {
    if (this.busy < this.limit) {
      instance = this.create();
    } else {
      if (callback) this.getQueue.push(callback);
      return;
    }
  }
  this.busy++;
  if (callback) callback(null, instance);
  return instance;
}
Pool.prototype.cancelGet = function(callbackToCancel) {
  var i = this.getQueue.indexOf(callbackToCancel), found = (i !== -1);
  if (found) this.getQueue.splice(i,1);
  return found;
}
Pool.prototype.put = function(instance) {
  if (this.getQueue.length) {
    this.getQueue.shift()(null, instance);
  } else {
    this.busy--;
    if (this.free.length < this.keep) this.free.push(instance);
    else this.destroy(instance);
  }
}
Pool.prototype.remove = function(item, noDestroy) {
  var i = this.free.indexOf(item), found = (i !== -1);
  if (found) this.free.splice(i,1);
  if (!noDestroy) this.destroy(item);
  return found;
}
Pool.prototype.removeAll = function(noDestroy) {
  if (!noDestroy)
    for (var i=0,item; (item = this.free[i]); i++) this.destroy(item);
  this.free = [];
}
Pool.prototype.destroy = function(item) { }

// ----------------------------------------------------------------------------
// HTTP connection pool

var http = require('http');

function HTTPConnectionPool(keep, limit, port, host, secure) {
  Pool.call(this, keep, limit);
  this.port = port;
  this.host = host;
  this.secure = secure;
  var self = this;
  process.addListener("exit", function (){
    // avoid lingering FDs
    try { self.removeAll(); }catch(e){}
    try { delete self; }catch(e){}
  });
}
exports.HTTPConnectionPool = HTTPConnectionPool;
sys.inherits(HTTPConnectionPool, Pool);
HTTPConnectionPool.prototype.create = function(){
  var self = this, conn = http.createClient(this.port, this.host);
  if (this.secure) {
    if (typeof this.secure !== 'object') this.secure = {};
	  conn.setSecure('X509_PEM', this.secure.ca_certs, this.secure.crl_list,
	    this.secure.private_key, this.secure.certificate);
  }
  conn._onclose = function(hadError, reason) {
    self.remove(conn);
    if (hadError)
      self.emit('error', new Error('Connection error'+(reason ? ': '+reason : '')));
    try { conn.removeListener('close', conn._onclose); }catch(e){}
  }
  conn.addListener('close', conn._onclose);
  return conn;
}
HTTPConnectionPool.prototype.destroy = function(conn){
  try { conn.removeListener('close', conn._onclose); }catch(e){}
  try { conn.end(); }catch(e){}
}