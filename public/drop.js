(function(){

// don't run this script if we're on a dropular site
if (document.location.hostname.toLowerCase().indexOf('dropular') !== -1)
  return;

var imgs = document.images;
var currentUrl = document.location.href;
var theTitle = document.title;
var badWordsRE = /sex|dick|fuck|sex|anal|pron|porn|lesbians?/i;
var allowedImageNamesRE = /\.(gif|jpe?g|png)/i;
var knownImageNamesRE = /\.(gif|jpe?g|png|tiff?|bmp)/;

// abort on bad words
if (currentUrl.match(badWordsRE)) return;

var imgcount = 0;
var imgClickHandler = function(){
  var imgUrl = this.src;
  if (!imgUrl.match(/^http.?:\/\//i)) {
    if (imgUrl.substr(0,1) === '/') {
      imgUrl = currentUrl.replace(/^(http.?:\/\/[^\/]+)\/.*$/i, '$1')+imgUrl;
    } else if (!currentUrl.match(/\/$/)) {
      imgUrl = currentUrl.replace(/\/[^\/]+$/i, '/') + imgUrl;
    } else {
      imgUrl = currentUrl + imgUrl;
    }
  }
	
	var title = this.title;
	if (title) {
	  title = String(title).replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
	  if (title.length === 0) title = null;
  } else if (this.alt) {
	  title = String(this.alt).replace(/^[ \t\r\n]+|[ \t\r\n]+$/g, '');
	  if (title.length === 0) title = null;
  }
  if (!title && currentUrl !== this.src)
    title = theTitle;
  
	myLink = "http://dropular.net/#drop/?"+
	  "origin="+encodeURIComponent(currentUrl)+
	  "&url="+encodeURIComponent(imgUrl);
  if (title)
	  myLink += "&title="+encodeURIComponent(title);
	window.open(myLink, 'Droplet',
	  'width=455,height=110,status=yes,scrollbars=no');
	return false;
};

for(i=0;i<imgs.length;i++){ (function(img){
	if ( img.width >= 128
	  && img.height >= 128
	  && img.src !== ""
	  && img.src.match(allowedImageNamesRE)
	   )
	{
		img.style.border = '10px solid #f20606';
		img.style.marginRight = '20px';
		img.onmouseover = function() {
		  this.style.border='10px solid #ffde00';
		}
		img.onmouseout = function() {
		  this.style.border='10px solid #f20606';
		}
		imgcount++;
		img.onclick = imgClickHandler;
  }
})(imgs[i]); }

// add an info banner, unless we are looking directly at an image
if (imgcount > 0 && !currentUrl.match(knownImageNamesRE)) {
  function addHTML (html) {
  	if (document.all) {
  		document.body.insertAdjacentHTML('beforeEnd', html);
  	} else if (document.createRange) {
  		var range = document.createRange();
  		range.setStartAfter(document.body.lastChild);
  		var docFrag = range.createContextualFragment(html);
  		document.body.appendChild(docFrag);
  	} else if (document.layers) {
  		var l = new Layer(window.innerWidth);
  		l.document.open();
  		l.document.write(html);
  		l.document.close();
  		l.top = document.height;
  		document.height += l.document.height;
  		l.visibility = 'show';
  	}
  }
	addHTML("<style>body { margin-top: 70px !important } #dropTop a, #dropTop a:link { color: white !important; font-weight:bold; font-family: Arial, sans-serif !important; text-decoration: none !important; font-size: 11px !important; background:#f20606; }</style><style>#dropTop a:hover { color: black !important; }</style><style>#dropTop img { border='0px'}</style><style>#dropTop { visibility: visible; }</style><div id='dropTop' style='z-index: 9999; font-family: Helvetica, Arial, sans-serif !important; text-align: center; font-size: 18px; font-weight: bold !important; position: fixed; top: 0px; left: 0; width: 100%; padding: 10px; background: #f20606; color: white'><div margin-left:auto; margin-right:auto;'>Click on any of the bordered images below to add to Dropular.</div>");
}

})();