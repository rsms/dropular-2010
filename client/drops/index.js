exports.on('load', function(ev, view){
  console.log('drops loaded', view);
});

function basename(fn) {
  var p = fn.lastIndexOf('/');
  if (p !== -1) fn = fn.substr(p+1);
  return fn;
}
function extname(fn, _default) {
  if (fn && (fn = String(fn)) && fn.length) {
    fn = basename(fn);
    var p = fn.lastIndexOf('.');
    if (p !== -1) return fn.substr(p);
  }
  return _default;
}
exports.dropURLfromId = function(id, url, requestedSize, originalSize) {
  var base = 'http://static.dropular.net.s3.amazonaws.com/drops/images/';
  var ext = extname(url, '.jpg');
  var imageExts = {'.jpg':1, '.jpeg':1, '.png':1, '.gif':1};
  if (!imageExts[ext.toLowerCase()]) ext = '.jpg';

  var orgsize;
  if (typeof originalSize === 'object') {
    orgsize = Math.max(originalSize.width, originalSize.height);
  } else if (typeof originalSize === 'number') {
    orgsize = originalSize;
  }

  if (requestedSize && orgsize) {
    requestedSize = requestedSize.substr(0,1).toLowerCase();
    if (requestedSize === 's') {
      if (orgsize > 256) ext = '.256.jpg';
    } else if (requestedSize === 'm') {
      if (orgsize > 720) ext = '.720.jpg';
    }
  }
  // otherwise the URL for the original is returned
  
  url = base + id.charAt(0)+'/'+id.substr(1,2)+'/'+id.substr(3)+ext;
  
  return url;
};

function img_adjustVerticalAlignment() {
  var q = $(this);
  var thumbsize = 209;//parseInt(q.closest('drop').css('width'));//broken
  var w = this.width, h = this.height, r = w/h, z;
  console.log(h, w, r, 'loaded');
  if (w > h) {
    z = w/thumbsize;
    w /= z;
    h /= z;
    q.css('marginTop', Math.round((thumbsize-h)/2)+'px');
  } else {
    // no need for h-alignment as that is taken care of by CSS
  }
}

exports.createView = function(drops){
  var i, drop, img,
      view = __html('content'),
      items = view.find('drops');

  exports.appendDrops(items.empty(), drops);
  return view;

};

exports.appendDrops = function(appendToElement, drops) {
  var i, drop, img, imgURL;
  for (i=0,drop; (drop = drops[i]); i++) { (function(){

    if (drop.doc.disabled) return;
    var item = __html('drop');

    $.each(drop.doc.users, function(index, value) { 
            
    if (! oui.app.session.user || oui.app.session.user.username === index) {
      item.find('.droppy').css('display','none');
     }
    });

    /*  
    var createdBy, created, user;
      for (user in drop.doc.users) {
        var t = drop.doc.users[user][0];
          if (!created || t < created) {
            created = t;
            createdBy = user;
        }
      }
    */

    imgURL = exports.dropURLfromId(drop.id, drop.doc.url, 'small', drop.doc.image);
    img = item.find('img').attr('src', imgURL);
    // align image vertically on load
    img.one('load', function(){
      img_adjustVerticalAlignment.call(this);
      item.addClass('loaded');

    });
    
   item.find('a').attr('href', '#drops/'+drop.id);
    item.find('.droppy').attr('id', drop.doc.url);
    item.find('.droppy').attr('title', drop.doc.origin);

    var title;

    if (drop.doc.title) {
      title = drop.doc.title.replace( /http:\/\//, "").replace( /www./, "").substring(0,35);
    } else if (!title) {
      if (drop.doc.origin) {
        title = drop.doc.origin.replace( /http:\/\//, "").replace( /www./, "").substring(0,35);
      } else if (drop.doc.url) {
        title = drop.doc.url.replace( /http:\/\//, "").replace( /www./, "").substring(0,35);
      } else {
        title = "Untitled";
      }
    }
    item.find('.info-wrapper').find('.from').text(title);
    
    if (drop.doc.origin)
      item.find('.info-wrapper').find('a.from').attr('href', drop.doc.origin);
    
    appendToElement.append(item);
  
  })(); }

};

exports.build = function(url, params, callback) {
  if (typeof params === 'function') {
    callback = params;
    params = undefined;
  }
  var request, continuumFiller, continuumState = {};
  var start = true;

  params.skip = params.skip ? parseInt(params.skip) : 0;
  params.limit = params.limit !== undefined ? parseInt(params.limit) : 10;
  
  continuumFiller = function(continuumCallback) {
    var $drops = continuumState.view.find('drops');
    var throbber = new util.throbber.Throbber();
    $drops.after(throbber.$html);
  
    throbber.show();
    params.skip += params.limit;
    oui.app.session.get(url, params, function(err, result){
      
      throbber.remove();
      if (err) {
        util.notify.show(err);
        continuumCallback(true); // stop
      } else {
        if (!result || !result.drops || result.drops.length === 0) {
          continuumCallback(true); // stop
        } else {
        if (!start) {
        exports.appendDrops($drops, result.drops);
        continuumCallback();
        //
        }
        }
      }
    });
  };
  
  $('more').live('click', function(err, result){
    $(continuumState.view).continuum(continuumFiller);
    start = false;
  });
    
  oui.app.session.get(url, params, function(err, result){
 
    if (result.drops.length !== 18) {
        $('more').hide();
    } else {
        $('more').show();
    }

    console.log(url+' -->', err, result);
    if (!err)
      continuumState.view = exports.createView(result.drops);
    if (callback) {
      callback(err, continuumState.view, continuumFiller);
      if (!err && continuumFiller)
        $(continuumState.view).continuum(continuumFiller);
    }
  });
};

exports.display_ = function(url, params, callback){
  exports.build(url, params, function(err, view, filler){
    if (err) {
      error.present(err);
    } else {
      mainView.setView(view);
    }
    if (callback) callback(err);
  });
};

exports.displayRecent = function(callback){
  exports.display_('drops/recent', {complete:1, limit:18}, callback);
};

exports.displayInteresting = function(callback){
  exports.display_('drops/interesting', {complete:1, limit:18}, callback);
};

exports.displayTagged = function(tags, callback){
  if (!tags) return callback && callback(new Error('bad tags param'));
  exports.display_('drops/tagged/'+oui.urlesc(tags.join('|')),
    {complete:1, limit:18}, callback);
};

exports.displayFromUser_ = function(path, username, callback){
  exports.display_('users/'+oui.urlesc(username)+'/'+path,
    {complete:1, limit:18}, callback);
};

exports.displayFromFollowing = function(username, callback){
  exports.displayFromUser_('following/drops', username, callback);
};

exports.displayFromUser = function(username, callback){
  exports.displayFromUser_('drops', username, callback);
};

// handlers

oui.app.on('start', function(){

  var oldhit;

  $('drop').live('mouseenter', function(){
    $(this).find('.info-wrapper').css('visibility','visible');
  }).live('mouseleave', function(){
    $(this).find('.info-wrapper').css('visibility','hidden');  
  });

  $('#toolbox-wrap a').live('click', function(){
    $(oldhit).removeClass('active');  
    $(this).addClass('active');
    oldhit = this;
  });



  $('.droppy').live('click', function(){
    redropit(this.id, $(this).attr('title'));
    $(this).hide();
  });
  
  var redropit = function(u,org) {
    var msg = { 'url' : u, 'origin' : org };
        oui.app.session.post('drop', msg, function(err, r, res){
    });
  };

  function prepare(source) {
    var sourceClass = source || 'home';
    // set active source "tab"
    __html().find('sources a').removeClass('active')
      .filter('a[href=#drops'+(source ? '/'+source : '')+']').addClass('active');
    // show relevant title
    __html().find('div.title').hide().filter('.'+sourceClass).show();
  }
  
  oui.anchor.on('drops', function(params, path, prevPath) {
    prepare();
    if (oui.app.session.user) {
      console.log('drops: displaying recent');
      exports.displayRecent();
    } else {
      setTimeout(function(){
        if (oui.app.session.user) {
          exports.displayRecent();
        } else {
          exports.displayRecent();
          //error.present({title:'Not found', message:'Drops...what?!'});
        }
      }, 500);
    }
  });
  
  oui.anchor.on('drops/follow', function(params, path, prevPath) {
    prepare('recent');
    console.log('drops: displaying from followers');
    exports.displayFromFollowing(oui.app.session.user.username);
  });
  
  oui.anchor.on('drops/interesting', function(params, path, prevPath) {
    prepare('interesting');
    console.log('drops: displaying interesting');
    exports.displayInteresting();
  });
  
  oui.anchor.on('drops/tagged/:tags', function(params, path, prevPath) {
    prepare('tagged');
    var tags = params.tags.split(/[+\/,]+/);
    console.log('drops: displaying tagged', tags);
    __html().find('div.title.tagged h1 .tags').text(tags.join(', '));
    exports.displayTagged(tags);
  });
});