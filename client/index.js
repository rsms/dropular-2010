if (window.OUI_HELP) {
  // Extend the message from help
  window.OUI_HELP.sections.Examples +=
      "\n"+
      "  Creating or updating a drop:\n"+
      "    oui.app.session.post('drop', {'url':'http://www.com/some/image.jpg'},\n"+
      "      function(err, result, resp) { console.log(err, result, resp); });\n";
}

// BEGIN TEMPORARY FIX
if (!oui.cookie.get('amazonfuckedupourserver')) {
  oui.cookie.clear('auth_token');
  oui.cookie.set('amazonfuckedupourserver', 'ohhowsad', 60*60*24*365*10);
}
// END TEMPORARY FIX

exports.reloadUser = function(callback){
  if (oui.app.session.user) {
    console.log(__name+': reloading user '+oui.app.session.user.username);
    users.User.find(oui.app.session.user.username, function(err, user){
      if (err) {
        util.notify.show(err);
      } else {
        console.log(__name+': reloaded user '+(user ? user.username : '<null>'));
        oui.app.session.setUser(user);
      }
      if (callback) callback(err);
    });
  } else {
    if (callback) callback();
  }
};

exports.updateUserLevelStyle = function(user) {
  user = user || oui.app.session.user;
  // lazily create the style tag, controlling visibility
  if (!exports.$userLevelStyle) {
    var $head = $('html > head');
    $head.append('<style type="text/css"></style>');
    exports.$userLevelStyle = $head.find('style:last');
  }
  // Hide/show any elements according to user's level
  var s = [], i, levels = 3, level = levels;
  if (user && typeof user.level === 'number')
    level = user.level;
  // refresh trick -- might be needed for legacy browsers. Let's keep it for now.
  for (i=levels; --i >= level; ) {
    s.push('.userlevel'+i+' { display:block; }');
  }
  for (i=level; --i > -1; ) {
    s.push('.userlevel'+i+' { display:none; }');
  }
  for (i=0;i<levels;++i) {
    if (i === level) s.push('.userlevel-eq-'+i+' { display:block; }');
                else s.push('.userlevel-eq-'+i+' { display:none; }');
  }
  if (!user) s.push('.userlevel-none { visibility:visible; }');
        else s.push('.userlevel-none { display:none; }');
  exports.$userLevelStyle.html(s.join('\n'));
};

// set some UI stuff on start
oui.app.on('start', function(){
  
  // It's a shame we need to do this in the year 2010... Mozilla, why??!?!
  
  if (navigator.userAgent.indexOf('Firefox') !== -1)
    $('head').prepend('<style type="text/css">*{outline:none;}</style>');

  // update universal UI stuff on userchange
  oui.app.session.on('userchange', function(ev, prevUser){
    exports.updateUserLevelStyle(this.user);
 
    if (this.user) {
      $('.following').css('display','block');
    } else{
      $('.following').css('display','none');
    }
    
    if (!this.user && prevUser && document.location.hash === '#drops') {
      // when a user logs out while at a user-restricted view, send her to home:
      $('.following').css('display','none');
      document.location.hash = '#';      
    }
   $('grid').delay(200).show();
  });
});

// Scroll state persistence
var getScroll;
if (document.all) {
  getScroll = function() {
    return { x: document.scrollLeft, y: document.scrollTop };
  };
} else {
  getScroll = function() {
    return { x: window.pageXOffset, y: window.pageYOffset };
  };
}
// keyed by document.location.hash
exports.scrollStates = {};
oui.anchor.events.addListener('change', function(ev, path, prevPath, routes){
  exports.scrollStates[prevPath] = getScroll();
});
oui.anchor.events.addListener('changed', function(ev, path, prevPath, routes){
  var scrollState = exports.scrollStates[path];
  if (scrollState) {
    exports.scrollStates[path] = undefined;
    oui.app.session.on('idle', true, function(){
      setTimeout(function(){
        console.debug('restoring scroll to', scrollState.x, scrollState.y);
        window.scrollTo(scrollState.x, scrollState.y);
      },500); // todo: this is a shaky solution. must be some event we can listen for...
    });
  }
});


exports.mixinViewControl = function (exports, selector) {
  $(document).ready(function(){
    exports.$container = $(selector);

	$('#taglookup input').focus(function() {
		$("#taglookup input").val("");
	});
    
	$('#taglookup').submit(function() {
		if ($("#taglookup input").val()) {
			to_url = window.location.href.replace( /#.*/, "")+'#drops/tagged/'+encodeURIComponent($("#taglookup input").val());
			document.location = to_url; 
			return false;
		}
		return false;
	});
  });

	
  exports.events = new oui.EventEmitter();

  exports.visible = function(view){
    if (view) {
      return (exports.$container.has(view).length !== 0
           && view.css('display') !== 'none'
           && view.css('opacity') !== '0');
    } else {
      return (exports.$container.children().length !== 0
           && exports.$container.css('display') !== 'none'
           && exports.$container.css('opacity') !== '0');
    }
  };

  exports.clear = function(callback) {
    if (exports.visible) {
      exports.events.emit('viewclear');
      exports.events.emit('viewchange');
      exports.$container.fadeOut(200, callback);
    }
  };

  exports.title = function(title) {
    var $h1 = exports.$container.find('h1'), currTitle = $h1.text();
    if (title)
      $h1.text(title);
    return currTitle;
  };

  exports.viewQueuedForDisplay = null;

  exports.setView = function(view, callback, title){
    if (typeof view === 'function') {
      callback = view;
      view = null;
    }

    exports.events.emit('viewchange');
    if (!view) {
      exports.$container.fadeIn(200, callback);
    } else if (!exports.visible(view)) {
      exports.viewQueuedForDisplay = view;
      exports.$container.fadeOut(100, function(){
        if (view === exports.viewQueuedForDisplay) {
          exports.viewQueuedForDisplay = null;
          // defer to next tick, since otherwise the object is display:none
          // and things like input focus will not work.
          setTimeout(function(){
            (view.ouiModule ? view.ouiModule.$html : view).triggerHandler('load', view);
            if (view.ouiModule) view.ouiModule.emit('load', view);
          },1);
          exports.$container.empty().append(view.show()).fadeIn(200, callback);
        }
      });
    } else if (callback) {
      callback();
    }
  };
};

