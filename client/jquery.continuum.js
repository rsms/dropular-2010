/**
 * Continuum provides a way of filling in content when reaching the end of
 * scroll in a document.
 *
 * Released under an MIT license:
 *
 * Copyright (c) 2010 Rasmus Andersson <http://hunch.se/>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
(function($){

$.fn.continuum = function(options, callback) {
  var ctx = $.extend({
    threshold: 400
  }, typeof options === 'object' || {filler: options});
  
  // Keep single set of refrences and jQuery objects. No leakin' here bouy!
  if (!$.continuum) {
    $.continuum = {
      '$doc': $(document),
      '$win': $(window)
    };
  }
  
  // Locals hanging out at the pub
  var $doc = $.continuum.$doc,
      $win = $.continuum.$win,
      self = this,
      winHeight = $win.height();

 /* var onscroll = function(){
    var distance = $doc.height() - window.pageYOffset - winHeight;
    // on MSIE, replace window.pageYOffset with document.body.scrollTop
    if (distance < ctx.threshold) {
      //console.log('distance < threshold -- ', distance, '<', ctx.threshold);
      ctx.waiting = true;
      $win.unbind('scroll.continuum');
      ctx.filler.call(this, function(stop){
        ctx.waiting = false;
        if (stop) {
          ctx.stopped = true;
        } else {
          $win.bind('scroll.continuum', onscroll);
        }
      });
    }
  };
  */
  
   //console.log('distance < threshold -- ', distance, '<', ctx.threshold);
  ctx.waiting = true;
  ctx.filler.call(this, function(stop){
    ctx.waiting = false;
      if (stop) {
        ctx.stopped = true;
      }
  });
  
  // Adjust window height when needed
 // $win.bind('resize.continuum', function(){ winHeight = $win.height(); });

  // Check distance when scrolling
  //$win.bind('scroll.continuum', onscroll);

  return this;
};

})(jQuery);