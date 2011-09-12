var sys = require('sys'),
    http = require('http'),
    querystring = require('querystring'),
    base64 = require('./base64'),
    pool = require('./pool');

// -----------------------------------------------------------------------------
// connection pools keyed by "host:port:secure?"

var connectionPools = {},
    connectionPoolDefaults = {
      limit: 250,
      keepalive: 1
    };

exports.getConnectionPool = function(host, port, secure) {
  var key = host+':'+port+(secure ? ':1' : ':0'),
      p = connectionPools[key];
  if (!p) {
    p = new pool.HTTPConnectionPool(
        connectionPoolDefaults.keepalive,
        connectionPoolDefaults.limit,
        port, host, secure);
    connectionPools[key] = p;
  }
  return p;
}

// -----------------------------------------------------------------------------
// Make a request

/**
 * Make a request
 *
 * Returns an object emitting the following events:
 *
 *  - connection(options, connection) -- when a connection has been made.
 *
 *  - request(options, request) -- when a request is just about to be sent.
 *
 *  - timeout(options, request) -- when a request timed out (only possible if
 *      options.timeout is a number and > 0).
 *
 *  - response(options, request, response) -- when a response has started.
 *
 */
exports.request = function(options, callback) {
  var timeoutId, req, res, cbFired, k, x, ev = new process.EventEmitter();
  // Options
  var opt = {
    method: 'GET',
    host: '127.0.0.1',
    port: 80,
    path: '/',
    headers: {},
    // Optional:
    // ctxid: 'myapp'
    // path: "/some/path"
    // query: {param1:"value1"}
    // body: "hello"
    // timeout: 5000
    // debug: true
    // auth: {type:"basic", username:"jdoe", password:"secret"}
    // secure: {ca_certs:x, crl_list:x, private_key:x, certificate:x}
    // connectionPool: <pool.HTTPConnectionPool>
  }

  // parse arguments
  if (typeof options === 'string') opt.path = options;
  else if (typeof options !== 'object') throw new Error('options must be a string or an object');
  else for (k in options) opt[k] = options[k];
  if (callback && typeof callback !== 'function')
    throw new Error('callback must be a function');
  opt.method = opt.method.toUpperCase();

  // Context id?
  if (!opt.ctxid) opt.ctxid = module.id;

  // Connection
  if (!opt.connectionPool)
    opt.connectionPool = exports.getConnectionPool(opt.host, opt.port || 80, opt.secure);

  // Normalize headers (so we can easily override them)
  if (typeof opt.headers === 'object') {
    x = {};
    for (k in opt.headers)
      x[k.toLowerCase()] = opt.headers[k];
    opt.headers = x;
  } else {
    opt.headers = {};
  }

  // Auth?
  if (opt.auth) {
    var authType = opt.auth.type || 'basic';
    if (authType !== 'basic')
      throw new Error('only "basic" auth.type is supported');
    opt.headers.authorization = 'Basic '+
      base64.encode(opt.auth.username+":"+opt.auth.password);
  }

  // Setup headers
  if (!opt.headers.host)
    opt.headers.host = opt.host;
  if (!opt.headers.connection)
    opt.headers.connection = (opt.connectionPool.keep < 1) ? 'Close' : 'Keep-Alive';

  // Setup path
  if (typeof opt.path !== 'string') throw new Error('path option must be a string');
  opt.path = '/'+String(opt.path).replace(/^\/+/, '');
  if (opt.query) {
    if (typeof opt.query === 'object') {
      k = querystring.stringify(opt.query);
      if (k.length)
        opt.path += '?' + k;
    } else if (typeof opt.query === 'string' && opt.query.length !== 0) {
      opt.path += '?' + opt.query;
    }
  }

  // Setup body
  if (opt.body && (opt.method === 'PUT' || opt.method === 'POST')) {
    if (typeof opt.body !== 'string') {
      opt.body = JSON.stringify(opt.body);
      opt.headers['content-type'] = 'application/json';
      opt.bodyEncoding = 'utf-8';
    }
    opt.headers['content-length'] = opt.body.length;
  } else if (opt.body) {
    opt.body = undefined;
  }
  if (!opt.bodyEncoding)
    opt.bodyEncoding = 'binary';

  // Defer until we have a connection
  var onconn = function(err, conn) {
    ev.emit('connection', opt, conn);
    if (err) return (!cbFired) && (cbFired = 1) && callback && callback(err);
    var onConnClose = function(hadError, reason) {
      if (hadError && callback && !cbFired) {
        cbFired = true; callback(new Error(reason || 'Connection error'));
      }
      conn.removeListener('close', onConnClose);
    }
    conn.addListener('close', onConnClose);
    req = conn.request(opt.method, opt.path, opt.headers);
    if (opt.debug) {
      sys.log('['+opt.ctxid+'] --> '+opt.method+' '+opt.path+'\n  '+
        Object.keys(opt.headers).map(function(k){ return k+': '+opt.headers[k]; }).join('\n  ')+
        (opt.body ? '\n\n  '+opt.body : ''));
    }
    if (opt.body) {
      req.write(opt.body, opt.bodyEncoding);
    }
    req.addListener('response', function (_res) {
      res = _res;
      var data = '';
      ev.emit('response', opt, req, res);
      //res.setBodyEncoding(opt.bodyEncoding); // why does this fail?
      res.addListener('data', function (chunk){
        data += chunk;
      });
      res.addListener('end', function(){
        if (timeoutId !== undefined) clearTimeout(timeoutId);
        conn.removeListener('close', onConnClose);
        opt.connectionPool.put(conn);
        // log
        if (opt.debug) {
          sys.log('['+opt.ctxid+'] <-- '+opt.method+' '+opt.path+' ['+res.statusCode+']\n  '+
            Object.keys(res.headers).map(function(k){ return k+': '+res.headers[k]; }).join('\n  ')+
            (data.length ? '\n\n  '+data : ''));
        }
        // parse body if it's json
        var contentType = res.headers['content-type'];
        if (contentType && contentType.indexOf('application/json') !== -1) {
          try {
            data = JSON.parse(data);
          } catch (err) {
            if (!cbFired) {
              err.message = 'JSON parse error: '+err.message+'. Input was: '+sys.inspect(data);
              cbFired = 1;
              if (callback) callback(err, undefined, res);
            }
          }
        }
        // check and handle result
        if (!cbFired) {
          cbFired = 1;
          if (callback) callback(null, data, res);
        }
      });
    });
    ev.emit('request', opt, req);
    req.end();
  }

  // Timeout
  opt.timeout = opt.timeout;
  if (typeof opt.timeout === 'number' && opt.timeout > 0) {
    timeoutId = setTimeout(function(){
      opt.connectionPool.cancelGet(onconn);
      if (req) req.removeAllListeners('response');
      if (res) {
        res.removeAllListeners('data');
        res.removeAllListeners('end');
      }
      ev.emit('timeout', opt, req);
      if (opt.debug) {
        sys.log('['+opt.ctxid+'] --X '+opt.method+' '+opt.path+' timed out after '+
          (opt.timeout/1000.0)+' seconds');
      }
      if (!cbFired) {
        cbFired = 1;
        if (callback) callback(new Error(
          req ? 'CounchDB connection timeout' : 'CouchDB connection pool timeout'));
      }
    }, opt.timeout);
  }

  // Request a connection from the pool
  process.nextTick(function(){
    // next tick so the caller is guaranteed to be able to add listeners to ev
    opt.connectionPool.get(onconn);
  });

  // return the EventEmitter
  return ev;
}
