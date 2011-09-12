// show welcome for non-logged in users
/*oui.app.session.on('userchange', function(ev, prevUser){
  if (!this.user)
    mainView.setView(exports.$view);
});*/

oui.app.on('start', function(ev, willAuthUser){
	// trick to keep a reference to the intro view
  exports.$view = mainView.$container.find('div.welcome-view');
  
  //setTimeout(function(){
    oui.anchor.on("", function(){
      if (oui.app.session.user)
        document.location.hash = '#drops';
      else
        mainView.setView(exports.$view);
    });
    

  //},1); // next tick
  
  // if the app is trying to authenticate a returning user, hide the welcome
  // message (it will be shown again if the user turned out not to be logged in)
  //if (willAuthUser)
  //  exports.$view.hide();
});
