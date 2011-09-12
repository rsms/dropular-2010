var Base62 = function(pattern, encoder, ignore) {
  this.parser = new Parser(ignore);
  if (pattern) this.parser.put(pattern, "");
  this.encoder = encoder;
};

Base62.WORDS = /\b[\da-zA-Z]\b|\w{2,}/g;

Base62.ENCODE10 = "String";
Base62.ENCODE36 = "function(c){return c.toString(36)}";
Base62.ENCODE62 = "function(c){return(c<62?'':e(parseInt(c/62)))+((c=c%62)>35?String.fromCharCode(c+29):c.toString(36))}";

Base62.UNPACK = "eval(function(p,a,c,k,e,r){e=%5;if('0'.replace(0,e)==0){while(c--)r[e(c)]=k[c];" +
    "k=[function(e){return r[e]||e}];e=function(){return'%6'};c=1};while(c--)if(k[c])p=p." +
    "replace(new RegExp('\\\\b'+e(c)+'\\\\b','g'),k[c]);return p}('%1',%2,%3,'%4'.split('|'),0,{}))";

mixin(Base62.prototype, {
  parser: null,
  encoder: undefined,

  search: function(script) {
    var words = new Words;
    this.parser.putAt(-1, function(word) {
      words.add(word);
    });
    this.parser.exec(script);
    return words;
  },

  encode: function(script) {
    var words = this.search(script);

    words.sort();

    var encoded = new Collection; // a dictionary of base62 -> base10
    var size = words.size();
    for (var i = 0; i < size; i++) {
      encoded.put(Packer.encode62(i), i);
    }

    function replacement(word) {
      return words["#" + word].replacement;
    };

    var empty = K("");
    var index = 0;
    forEach (words, function(word) {
      if (encoded.has(word)) {
        word.index = encoded.get(word);
        word.toString = empty;
      } else {
        while (words.has(Packer.encode62(index))) index++;
        word.index = index++;
        if (word.count == 1) {
          word.toString = empty;
        }
      }
      word.replacement = Packer.encode62(word.index);
      if (word.replacement.length == word.toString().length) {
        word.toString = empty;
      }
    });

    // sort by encoding
    words.sort(function(word1, word2) {
      return word1.index - word2.index;
    });

    // trim unencoded words
    words = words.slice(0, this.getKeyWords(words).split("|").length);
    
    script = script.replace(this.getPattern(words), replacement);

    /* build the packed script */

    var p = this.escape(script);
    var a = "[]";
    var c = this.getCount(words);
    var k = this.getKeyWords(words);
    var e = this.getEncoder(words);
    var d = this.getDecoder(words);

    // the whole thing
    return format(Base62.UNPACK, p,a,c,k,e,d);
  },
  
  search: function(script) {
    var words = new Words;
    forEach (script.match(Base62.WORDS), words.add, words);
    return words;
  },

  escape: function(script) {
    // Single quotes wrap the final string so escape them.
    // Also, escape new lines (required by conditional comments).
    return script.replace(/([\\'])/g, "\\$1").replace(/[\r\n]+/g, "\\n");
  },

  getCount: function(words) {
    return words.size() || 1;
  },

  getDecoder: function(words) {
    // returns a pattern used for fast decoding of the packed script
    var trim = new RegGrp({
      "(\\d)(\\|\\d)+\\|(\\d)": "$1-$3",
      "([a-z])(\\|[a-z])+\\|([a-z])": "$1-$3",
      "([A-Z])(\\|[A-Z])+\\|([A-Z])": "$1-$3",
      "\\|": ""
    });
    var pattern = trim.exec(words.map(function(word) {
      if (word.toString()) return word.replacement;
      return "";
    }).slice(0, 62).join("|"));

    if (!pattern) return "^$";

    pattern = "[" + pattern + "]";

    var size = words.size();
    if (size > 62) {
      pattern = "(" + pattern + "|";
      var c = Packer.encode62(size).charAt(0);
      if (c > "9") {
        pattern += "[\\\\d";
        if (c >= "a") {
          pattern += "a";
          if (c >= "z") {
            pattern += "-z";
            if (c >= "A") {
              pattern += "A";
              if (c > "A") pattern += "-" + c;
            }
          } else if (c == "b") {
            pattern += "-" + c;
          }
        }
        pattern += "]";
      } else if (c == 9) {
        pattern += "\\\\d";
      } else if (c == 2) {
        pattern += "[12]";
      } else if (c == 1) {
        pattern += "1";
      } else {
        pattern += "[1-" + c + "]";
      }

      pattern += "\\\\w)";
    }
    return pattern;
  },

  getEncoder: function(words) {
    var size = words.size();
    return Base62["ENCODE" + (size > 10 ? size > 36 ? 62 : 36 : 10)];
  },

  getKeyWords: function(words) {
    return words.map(String).join("|").replace(/\|+$/, "");
  },

  getPattern: function(words) {
    var words = words.map(String).join("|").replace(/\|{2,}/g, "|").replace(/^\|+|\|+$/g, "") || "\\x0";
    return new RegExp("\\b(" + words + ")\\b", "g");
  }
});
