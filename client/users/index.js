function User() {}
exports.User = User;

User.fromDocument = function(doc) {
  var u = new User();
  oui.mixin(u, doc);
  return u;
};

User.find = function(username, callback) {
  if (!callback)
    throw new Error(__name+'.User.find: callback parameter must be a function');
  oui.app.session.get('users/'+oui.urlesc(username), callback);
};
