var utf8 = require('./utf8');
 
exports.encode = function (input) {
  var output = "", chr1, chr2, chr3, enc1, enc2, enc3, enc4, i = 0,
      input = utf8.encode(input), L = input.length;
  while (i < L) {
    chr1 = input.charCodeAt(i++);
    chr2 = input.charCodeAt(i++);
    chr3 = input.charCodeAt(i++);
    
    enc1 = chr1 >> 2;
    enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
    enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
    enc4 = chr3 & 63;
    
    if (isNaN(chr2)) {
      enc3 = enc4 = 64;
    } else if (isNaN(chr3)) {
      enc4 = 64;
    }
    
    output += MAP.charAt(enc1) + MAP.charAt(enc2)+
              MAP.charAt(enc3) + MAP.charAt(enc4);
  }
  return output;
}

exports.decode = function (input) {
  var output = "", chr1, chr2, chr3, enc1, enc2, enc3, enc4, i = 0,
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, "");
  var L = input.length;
  while (i < L) {
    enc1 = MAPi[input.charAt(i++)];
    enc2 = MAPi[input.charAt(i++)];
    enc3 = MAPi[input.charAt(i++)];
    enc4 = MAPi[input.charAt(i++)];

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 != 64) output += String.fromCharCode(chr2);
    if (enc4 != 64) output += String.fromCharCode(chr3);
  }
  return utf8.decode(output);
}

const MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
var MAPi = {};
(function(){
  for (var i=0,L=MAP.length;i<L;++i) MAPi[MAP[i]] = i;
})();

// ---------- simple test ----------
/*var assert = require('assert');
var a_raw = "¨ß∂˙ª•™™´˚µ˜ç˚ß∆˙∂˚∆å˙ß∂µçˆåßø∂˚˜ç·°ﬁ›˝⁄ÓÔı„catasd'\\1ƒƒf.";
var a_encoded = "wqjDn+KIgsuZwqrigKLihKLihKLCtMuawrXLnMOny5rDn+KIhsuZ4oiCy"+
                "5riiIbDpcuZw5/iiILCtcOny4bDpcOfw7jiiILLmsucw6fCt8Kw76yB4o"+
                "C6y53igYTDk8OUxLHigJ5jYXRhc2QnXDHGksaSZi4=";
// sanity checks
assert.equal(exports.encode(a_raw), a_encoded);
assert.equal(exports.decode(a_encoded), a_raw);
assert.equal(exports.encode('hello'), 'aGVsbG8=');
assert.equal(exports.decode('aGVsbG8='), 'hello');*/
