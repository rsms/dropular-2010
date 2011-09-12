var strfold = require('../strfold');
exports.allowedChars = 'abcdefghijklmnopqrstuvwxyz0123456789_$()+-_/';

/**
 * Return canonical representation of tag which can be a string or an array of
 * strings.
 */
exports.canonicalize = function(tag) {
  if (Array.isArray(tag)) {
    for (var i=0,t; (t = tag[i]); ++i) {
      t = String(t).toLowerCase();
      if (t.length)
        tag[i] = strfold.fold(t, exports.allowedChars);
    }
    tag = tag.unique();
    tag.sort();
    return tag;
  } else {
    return strfold.fold(String(tag).toLowerCase(), exports.allowedChars);
  }
}
