var sys = require('sys'), puts = sys.puts,
    couchdb = require('../../lib/couchdb');

// 'http://127.0.0.1:5984/dropular-drops/_design/offline/_view/drop-popularity?group=true'

var doc = {
   "_id": "zuogmAnKkYukKptwCQoIExYsksT",
   "_rev": "1-e7ce58de20b859b98c91651b1c46c9d7",
   "url": "http://retrospace.tumblr.com/page/23",
   "users": {
       "chrismeisner": [
           1251418913002,
           1
       ],
       "jamesplankton": [
           1251418913013,
           1
       ],
       "joshuabrantley": [
           1251418913003,
           1
       ],
       "mildenstein": [
           1251418913020,
           1
       ],
       "nitzan": [
           1251418913010,
           1
       ],
       "elnitro": [
           1251418913025,
           1
       ],
       "hallisar": [
           1251418913016,
           1
       ],
       "zeroversion": [
           1251418913000,
           2
       ],
       "landock": [
           1251418913019,
           1
       ],
       "deucedly": [
           1251418913005,
           1
       ],
       "mortenmarius": [
           1251418913026,
           1
       ],
       "ericson": [
           1251418913023,
           1
       ],
       "thonk": [
           1251418913006,
           1
       ],
       "digz": [
           1251418913017,
           1
       ],
       "okapi": [
           1251418913012,
           1
       ],
       "stefan": [
           1251518913007,
           1
       ],
       "dr_kab": [
           1251418913024,
           1
       ],
       "karollorak": [
           1251418913004,
           1
       ],
       "connaisseur": [
           1251418513022,
           1
       ],
       "sydeffex": [
           1251418913018,
           1
       ],
       "horizonfire": [
           1251418913015,
           1
       ],
       "zerospace1984": [
           1251418913021,
           1
       ],
       "falcadia": [
           1251418913001,
           1
       ],
       "goreki": [
           1251419913009,
           1
       ],
       "imadesigner": [
           1251428913011,
           1
       ],
       "ttwice": [
           1251448913028,
           1
       ],
       "proclaim": [
           1251418913029,
           1
       ],
       "serf": [
           1251418918008,
           1
       ],
       "henry": [
           1251418913014,
           1
       ],
       "restate": [
           1251418913027,
           1
       ]
   },
   "origin": "http://retrospace.tumblr.com/page/23",
   "tags": [
       "celebrity",
       "yearbook",
       "photography"
   ],
   "title": "Retrospace Zeta"
};

var lowRankingDoc = {_id: "2CEMEKQ6C8o9nwFLy2wJg36lz0q", 
_rev: "1-a6b4339dda56e2979b1fccceac4ad3a0", 
url: "http://www.modcloth.com/store/ModCloth/Apartment/Decor/Kitchen+Bath/Bear+Bottle+Opener", users: {
  igotsmagicpants: [1251474121000, 2], rwquigley: [1251474121001, 1], rwquiglex: [1251474121002, 1]
}, origin: "http://www.modcloth.com/store/ModCloth/Apartment/Decor/Kitchen+Bath/Bear+Bottle+Opener", tags: ["bear", "animals", "bottles", "bottle opener", "modcloth", "wants", "home", "decor", "kitsch", "wants"], title: "Bear Bottle Opener-Mod Retro Indie Clothing & Vintage Clothes"}

var mediumRankingDoc = {
   "_id": "zwFSuj8V7vznBHfsY4YuE0Sv6Ux",
   "_rev": "1-80524382c0b05a5963ff6e8444d50da1",
   "url": "http://www.boston.com/bigpicture/2009/01/more_of_london_from_above_at_n.html",
   "users": {
       "markr": [1270012955001, 2],
       "abc":   [1251512945000, 1]
   },
   "origin": "http://www.boston.com/bigpicture/2009/01/more_of_london_from_above_at_n.html",
   "tags": [
       "ferris",
       "eye",
       "london"
   ],
   "title": "More of London from above, at night - The Big Picture - Boston.com"
}

var newDrop = {_id: "yPHfe47t0QyIP2EQrzzcr3Yvju2", _rev: "1-4edc72543958ec0ae9af22e62368be2e", 
  url: "http://farm3.static.flickr.com/2735/4486171859_3da7759a55_t.jpg", users: {
    rsms: [1270983496533, 2]}};

/*
timeDecayEffect =
----
1.0:
     2199
   234165
      217
0.9999:
     3389
   240455
      335
0.999:
    14091
   297061
     1398
0.99:
   121118
   863122
    12025
0.9:
  1191387
  6523735
   118294
0:
  11894071
  63129867
   1180979
*/

//nowTime = 1270983496533;
var emit = function(key, value){ puts(key+' => '+JSON.stringify(value)+'\n-------------'); };
var mapfun = 

// --------- BEGIN -----------
function(doc) {
  // oldest drop 2009-01-25T10:42:21.000Z
  var refTime = 1232883741000,
      nowDate = new Date(),
      timeDecayEffect = 0.999,
      loneDropPunishment = 4.0, // higher = lower score
      decayBase = 60*60*1000, // 1 hour
      nowTime = nowDate.getTime()+(nowDate.getTimezoneOffset()*60*1000);

  function applyTimeDecay(score, time, effect) {
    if (effect === 0) return score;
    var decay, nscore = score, delta = nowTime-time;
    if (delta > decayBase) {
      decay = delta/decayBase;
      nscore /= decay;
      //puts('score2: '+score+', D: '+delta+', decay: '+decay)
    } else if (delta > 1000) {
      decay = delta/decayBase;
      nscore /= 1.0+decay;
      //puts('score2: '+score+', D: '+delta+', decay: '+decay)
    } else {
      //puts('score2: '+score+', D: '+delta+', decay: -')
    }
    if (effect === 1.0)
      return nscore;
    return score + ((nscore - score) * effect);
  }

  function calculateDropScore(doc) {
    var user, timeCreated,
        userdrops = [],
        endscoreDivisor = 45000;
    // first, remap userdrops to ordered list
    for (user in doc.users) {
      tuple = doc.users[user];
      userdrops.push({username:user, time:tuple[0], score:tuple[1]});
    }
  
    // special case for empty or single drops
    if (userdrops.length === 0) {
      return 0.0;
    } else {
      userdrops.sort(function(a, b){ return b.time - a.time; });
      timeCreated = userdrops[0].time;
      if (userdrops.length === 1) {
        score = (timeCreated - refTime)/(endscoreDivisor*loneDropPunishment);
        score = applyTimeDecay(score, timeCreated, timeDecayEffect);
        return score / (loneDropPunishment/2);
      }
    }
  
    var t, x, y, i, td, score = 0,
        tdpowerPunish = 1.5, tdpowerPraise = 1000*30;

    t = timeCreated - refTime;
    d = nowTime - timeCreated;
    x = 0;
    td = 0;
  
    //puts(d+', '+(t/d) + ', '+ (d/t));
    t *= t/d;
  
    for (i in userdrops) {
      x += userdrops[i].score;
      if (i > 0)
        td = userdrops[i].time - userdrops[i-1].time;
      //sys.error('td '+td)
      if (td > 0) {
        if (td < userdrops.length) {
          // punish sequential drops
          t /= td*tdpowerPunish;
        } else {
          // praise
          t += td*tdpowerPraise;
        }
      }
    }

    if (x > 0) y = 1;
    else if (x === 0) y = 0;
    else y = -1;
  
    if (userdrops.length === 1) {
      t *= 0.5; // demote new drops to 50%
    } else if (userdrops.length) {
      t *= userdrops.length;
    }

    z = (Math.abs(x) >=1 && Math.abs(x) || 1);
    score = Math.log(z) + (y*t)/endscoreDivisor;
  
    score = applyTimeDecay(score, timeCreated, timeDecayEffect);
  
    return score;
  }
  emit(calculateDropScore(doc), doc);
}
// --------- END -----------

mapfun(doc);
mapfun(mediumRankingDoc);
mapfun(lowRankingDoc);
mapfun(newDrop);



var
  tuple, score = 0,
  prevTime, timeDelta = 0,
  massCounterWeight = 0,
  refTime = 1232883741000,
  set = []

for (user in doc.users) {
  tuple = doc.users[user];
  set.push({username:user, time:tuple[0], score:tuple[1]});
}

set.sort(function(a, b){ return a.time - b.time; });
massCounterWeight = set.length * 0.5;

/*set.forEach(function(o) {
  if (prevTime)
    timeDelta = o.time - prevTime;
  prevTime = o.time;
  timeDelta = timeDelta - refTime;
  sys.p(timeDelta);
  score += o.score;
  // slightly demote mass droppings
  if (massCounterWeight > 0)
    score /= massCounterWeight;
  sys.puts('score -> '+score);
});*/

process.exit(0);

var db = new couchdb.Db('dropular-drops');
db.get('_design/offline/_view/drop-popularity?group=true', function(err, r, res) {
  if (err) return sys.error(err.stack || err);
  r=r.rows;
  r.sort(function(a,b){ return b.value - a.value; });
  r = r.map(function(x){ return [x.value, x.key]; });
  sys.p(r);
})

