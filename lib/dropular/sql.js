// prefabs
exports.FIELDS_USER = "u.id, u.username, u.real_name, u.description,"+
	" CONVERT_TZ(u.created, @@global.time_zone, '+00:00') as date_created,"+
	" CONVERT_TZ(u.modified, @@global.time_zone, '+00:00') as date_modified ";

exports.FIELDS_DROP = "drops.id, drops.score, drops.media_url, drops.origin_url, "+
                  "drops.title, drops.description,"+
	" CONVERT_TZ(drops.created, @@global.time_zone, '+00:00') as date_created,"+
	" CONVERT_TZ(drops.modified, @@global.time_zone, '+00:00') as date_modified ";

// fragments
exports.FRAG_USERS_DROPS = "SELECT "+exports.FIELDS_DROP+","+
		" CONVERT_TZ(user_drop.created, @@global.time_zone, '+00:00') as date_dropped "+
	" FROM drops, user_drop"+
	" WHERE drops.id = user_drop.drop_id ";

exports.FRAG_USERS_DROPS1 = "SELECT d.id,\
		d.score,\
		d.media_url   as murl,\
		d.origin_url  as ourl,\
		d.title,\
		d.description as `desc`,\
		CONVERT_TZ(d.created, @@global.time_zone, '+00:00') as dcreated,\
		CONVERT_TZ(d.modified, @@global.time_zone, '+00:00') as dmod,\
		CONVERT_TZ(j.created, @@global.time_zone, '+00:00') as ddropped,\
		GROUP_CONCAT(u.username ORDER BY j.created SEPARATOR ' ') AS users\
 FROM drops AS d\
 INNER JOIN user_drop AS j ON j.drop_id = d.id\
 INNER JOIN users AS u ON u.id = j.user_id\
 WHERE d.id IN((SELECT drop_id FROM user_drop WHERE user_id = ",
// (SELECT id FROM users WHERE username = str) | N
	exports.FRAG_USERS_DROPS2 = "))\
 GROUP BY d.id\
 ORDER BY j.created DESC";

exports.FRAG_FIND_USER_BY_USERNAME = "SELECT * FROM users WHERE username=";

// ----------------------------------------------------------------------------
// Utilities

exports.partUserId = function(db, params, simple) {
	if (params.user_id)
		return db.escape(params.user_id)
	else if (params.username)
		return "(SELECT id FROM users WHERE username = "+db.escape(params.username)+")";
	throw new Error('missing required parameter "username"')
}

exports.enrichUser = function(user) {
	user.created = new Date(user.created + ' +0000')
	user.modified = new Date(user.modified + ' +0000')
	return user
}
