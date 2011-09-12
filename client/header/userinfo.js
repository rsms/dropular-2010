var repositionFunc; // stored here so we can unbind it later

exports.resetFormSubmitEvent = function(){
  $('#login-sheet').unbind('submit').bind('submit', function(){
    // NEVER enable the browser to bubble the event
    // http://twitter.com/joshuabaker/status/12535803672
    ev.preventDefault();
  });
};

exports.on('load', function(){
  exports.resetFormSubmitEvent();
});

function onUserchange(){
  // top-right corner "Hi, username"
  var self = this,
      placeholder = $('header .user-info'),
      template, sheet, didChangeAnchor;
  if (!this.user) {
    // Setup the view for "signed-out"
    template = __html('.user-info.signed-out');
    sheet = $('#login-sheet');
    // "Sign in" link
    template.find('a.signin').toggle(function(){
      var signInLink = $(this);
      // make the login sheet stick when resizing the window
      repositionFunc = function(){
        var position = signInLink.offset();
        position.top += signInLink.height();
        sheet.css(position);
      };
      $(window).resize(repositionFunc);
      repositionFunc();
      
      // Show the sheet with an animation
      sheet.show().css({opacity:0.0}).animate({opacity: 1.0}, 100);
      // Give username focus
      var prevUsername = oui.cookie.get('dr_username');
      var usernameField = sheet.find('input[name=username]');
      if (prevUsername && prevUsername.length && usernameField.get(0)) {
        usernameField.get(0).value = prevUsername;
        sheet.find('input[name=password]').focus();
      } else {
        usernameField.focus();
      }
      // Rebind submit action
      sheet.bind('submit', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        var $password = sheet.find('input[name=password]'),
            username = usernameField.get(0).value.trim(),
            password = $password.get(0).value,
            submitButton = sheet.find('input[type=submit]');
        oui.cookie.set('dr_username', username, 60*60*24*9000); // 9k days TTL
        submitButton.attr('value', 'Signing in...').attr('disabled', 'true');
        oui.app.session.signIn(username, password, function(err){
          submitButton.attr('value', 'Sign in').removeAttr('disabled');
          if (err) {
            util.notify.show(err, 3000);
            $password.focus();
            $password.get(0).select();
          } else {
            exports.resetFormSubmitEvent();
            $password.get(0).value = '';
            template.find('a.signin').trigger('click');
            oui.app.session.on('userchange', true, function(){
              console.log('oui.app.session.userMeta =>', oui.app.session.userMeta);
              if (oui.app.session.userMeta && oui.app.session.userMeta.legacy) {
                var msg = util.notify.__html('.messages .legacy-welcome').html();
                util.notify.show(msg);
              }
            });
          }
        });
        return false;
      });
    }, function(){
      $(window).unbind('resize', repositionFunc);
      exports.resetFormSubmitEvent();
      sheet.animate({opacity: 0.0}, 100, function(){ sheet.hide(); });
    });
    // TODO: make ESC key hide the login sheet while it's active.

    placeholder.replaceWith(template);
  }
  else {
    // logged in
    template = __html('.user-info.signed-in');
    var usera = template.find('a.user');
    usera.attr('href', '#users/'+self.user.username).text(self.user.username);
    usera.click(function(){
      console.warn('TODO: show profile for user '+self.user.username);
    });
    template.find('a.signout').click(function(ev){
      $(this).removeAttr('href').unbind(ev).text('Signing out...');
      oui.app.session.signOut();
      
      return false;
    });
    placeholder.replaceWith(template);
    // set default anchor if none set
    if (document.location.hash.substr(1) === '') {
      document.location.hash = '#drops';
      didChangeAnchor = true;
    }
  }
  /*if (!didChangeAnchor) {
    oui.anchor.reload();
  }*/
}

oui.app.on('start', function(){
  onUserchange.call(oui.app.session);
  oui.app.session.on('userchange', onUserchange);
});
