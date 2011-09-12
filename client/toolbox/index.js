index.mixinViewControl(exports, '#toolbox');

var $subs;

exports.rebuildSubscriptionsList = function(subscriptions) {
  var ul, li, a;
  ul = $subs.find('ul').empty();
  if (!subscriptions && oui.app.session.user)
    subscriptions = oui.app.session.user.subscriptions;
  if (subscriptions) {
    for (var i=0,tag; (tag = subscriptions[i]); ++i) {
      a = document.createElement('a');
      a.setAttribute('href', '#drops/tagged/'+encodeURIComponent(tag));
      a.appendChild(document.createTextNode(tag));

  /* Remove button ready... but not the delete call I guess?
  
      rmv = document.createElement('a');
      rmv.setAttribute('class', 'rmv-btn');
      rmv.setAttribute('id', encodeURIComponent(tag));
      rmv.appendChild(document.createTextNode('-'));
	*/
	
      li = document.createElement('li');
      li.appendChild(a);
   //   li.appendChild(rmv);


      ul.append(li);
    }
  }
};

// clear the toolbox when a user logs out
oui.app.session.on('userchange', function(ev, prevUser){
  /*if (!this.user) {
    console.log('clearing #toolbox')
    toolbox.clear();
  }*/
});

// update subscriptions when a user's info changed
oui.app.session.on('userinfo', function(ev, prevUser, added, updated){
  if ( !prevUser
    || (added && added.b && added.b.subscriptions)
    || (updated && updated.b && updated.b.subscriptions) )
  {
    exports.rebuildSubscriptionsList(this.user.subscriptions);
    toolbox.setView($subs);
  }
});

// Bind UI actions
$(function(){


  // Subscriptions (+) button
  $subs = $('#toolbox-subscriptions');
  var $addButton = $subs.find('a.add'),
      $addForm = $subs.find('form.add').hide();

  /* Remove button ready... but not the delete call I guess?

  $('.rmv-btn').live('click', function(){
    var tags = this.id, S = oui.app.session,
      uri = 'users/'+encodeURIComponent(S.user.username)+'/subscriptions/remove';
    S.post(uri, {tags:tags}, function(err, res){
      // Hide the form
      index.reloadUser(); // defer reloading of user's info
      });
      });	

	*/

  var activeSubmitHandler = function(ev){
    ev.preventDefault();
    console.log('submit', this);
    // Disable inputs
    $addForm.find('input').each(function(){ this.disabled = true; });
    var tagsTF = $addForm.find('input[type=text]').get(0);
    // TODO "saving..."?
    var tags = tagsTF.value.split(/\s+/), S = oui.app.session,
      uri = 'users/'+encodeURIComponent(S.user.username)+'/subscriptions';
    S.post(uri, {tags:tags}, function(err, res){
      // Hide the form
      tagsTF.value = '';
      $addButton.click();
      index.reloadUser(); // defer reloading of user's info
    });
  };
  var passiveSubmitHandler = function(ev){ ev.preventDefault(); };
  
  $addButton.toggle(function(){
    // When clicking the (+) in state A, fade it in and enable the form
    $addButton.after($addForm.fadeIn(200));
    // Enable inputs
    $addForm.find('input').each(function(){ this.disabled = false; });
    $addForm.unbind('submit');
    $addForm.one('submit', activeSubmitHandler).find('input[type=text]').focus();
  }, function(){
    // When clicking the (+) in state B, fade out and disable the form
    $addButton.nextAll('form').fadeOut(200);
    // Disable accidental submission
    $addForm.unbind('submit');
    $addForm.one('submit', passiveSubmitHandler);
  });
});
