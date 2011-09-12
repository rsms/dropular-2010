// Auto-complete can be done by a combo of startkey, endkey and limit
// - startkey should be the current prefix
// - endkey should be the current prefix + high character (\u9999 in the examples below)
// - limit should be whatever is reasonable (5 in the examples below)
//
// See <http://wiki.apache.org/couchdb/View_collation> for details.

-> "r"
"_design/users/_view/by_email?startkey=%22r%22&endkey=%22r\u9999%22&limit=5"
{"id":"bbbeeccaa","key":"foo@bar.com","value":null},
{"id":"bug_barn","key":"foo@bar.com","value":null},
{"id":"cirone7","key":"foo@bar.com","value":null},
{"id":"rxmxa","key":"foo@bar.com","value":null},
{"id":"rachul","key":"foo@bar.com","value":null}

-> "ra"
"_design/users/_view/by_email?startkey=%22ra%22&endkey=%22ra\u9999%22&limit=5"
{"id":"bbbeeccaa","key":"foo@bar.com","value":null},
{"id":"bug_barn","key":"foo@bar.com","value":null},
{"id":"cirone7","key":"foo@bar.com","value":null},
{"id":"rxmxa","key":"foo@bar.com","value":null},
{"id":"rachul","key":"foo@bar.com","value":null}

-> "ras"
"_design/users/_view/by_email?startkey=%22ras%22&endkey=%22ras\u9999%22&limit=5"
{"id":"HUSKMELK","key":"foo@bar.com","value":null},
{"id":"rsms","key":"foo@bar.com","value":null}

-> "rasm"
"_design/users/_view/by_email?startkey=%22rasm%22&endkey=%22rasm\u9999%22&limit=5"
{"id":"rsms","key":"foo@bar.com","value":null}
