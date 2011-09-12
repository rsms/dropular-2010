oui.anchor.on(/^about\/(<page>[^\/]+)/, function(params){
  var modname = oui.util.canonicalizeModuleName(params.page),
      mod = about[modname],
      view;
  if (!mod || !mod.__html || (view = mod.__html('div:first')).length === 0) {
    error.present({title:'Not found'});
  } else {
    mainView.setView(view);
  }
});
