if (window.oui && oui.debug && window.chrome && chrome.loadTimes) {
  
  oui.debugTraceEvents = function(){
    if (oui.debugTraceEvents.on) {
      return 'already tracing events';
    }
    oui.debugTraceEvents.on = true;
    var knownEvents = ('click mousedown mouseup mouseover mousemove mouseout '+
      'DOMSubtreeModified DOMNodeInserted DOMNodeRemoved DOMNodeRemovedFromDocument '+
      'DOMNodeInsertedIntoDocument DOMAttrModified DOMCharacterDataModified '+
      'load unload abort error select change submit reset focus blur resize scroll').split(/[ \t\n\r]+/);
    var logEv = {handleEvent: function(ev) {
      console.log('\u2605 '+ev.type, ev);
    }};
    for (var i=0; i < knownEvents.length; ++i)
      document.addEventListener(knownEvents[i], logEv, true);
    return 'now tracing '+knownEvents.length+' types of events.';
  };
  
  $(window).load(function(){
    var dumpStats = function(st){
      /*
      startLoadTime:            1271714433.483945
      commitLoadTime:           1271714433.49696
      firstPaintTime:           1271714433.670031
      finishDocumentLoadTime:   1271714433.871984
      finishLoadTime:           1271714434.356144
      firstPaintAfterLoadTime:  1271714434.379138
      navigationType: "Reload"
      requestTime: 0
      wasFetchedViaSpdy: fals
      */
      var fixed = function(f){ return Number(f).toFixed(3); };
      console.group('Load statistics');
  
      console.info('load --['+fixed(st.commitLoadTime - st.startLoadTime)+'ms]--> commit '+
        '--['+fixed(st.finishLoadTime - st.commitLoadTime)+']--> finish --> '+
        fixed(st.finishLoadTime - st.startLoadTime) + 'ms');
  
      console.info('  firstPaint --['+fixed(st.firstPaintAfterLoadTime - st.firstPaintTime)+'ms]--> firstPaintAfterLoad'+
        ' ('+fixed(st.firstPaintAfterLoadTime - st.startLoadTime)+'ms)');
  
      console.groupEnd();
    };
    var timer, st;
    timer = setInterval(function(){
      st = chrome.loadTimes();
      if (st.firstPaintAfterLoadTime !== 0) {
        clearInterval(timer);
        dumpStats(st);
      }
    }, 10);
  });
}