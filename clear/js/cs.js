(function() {

// The initial response received from the locked? query (used to Load)
var queryResponse;

// A flag to indicate if the DOM content has loaded (used to Load)
var contentLoaded = false;

// Simple access to the Ui components
var ui;

// a queue of commands that are waiting to run at startup.
var pending = [];

// Converts milliseconds into a decent time
var TimeDesc = function(t) {
  var m = t / 60000;
  if (m < 0) {
    return 'less than a minute';
  }
  return (m | 0) + ' minutes';
};

// new element utility
var E = function(type) {
  return $(document.createElement(type));
};

var ShowToast = function(msg, time) {
  E('div').attr('id', 'clear-toast')
    .css('display', 'none')
    .text(msg)
    .appendTo($(document.body))
    .fadeIn(200)
    .delay(time)
    .fadeOut(200, function() {
      $(this).remove();
    });
};

// Creates the UI components in an unlocked state
var CreateUi = function() {
  var body = $(document.body),
      head = $(document.head),
      overflow = body.css('overflow'),
      showing = false,
      self;

  // inject the ui stylesheet
  // TODO(knorton): need to inline resources to avoid flicker
  $(document.createElement('link'))
    .attr('href', chrome.runtime.getURL('ss/cs.css'))
    .attr('rel', 'stylesheet')
    .attr('type', 'text/css')
    .appendTo(head);

  // inject raleway into the page
  // TODO(knorton): can i inline this?
  $(document.createElement('link'))
    .attr('href', 'https://fonts.googleapis.com/css?family=Raleway:400')
    .attr('rel', 'stylesheet')
    .attr('type', 'text/css')
    .appendTo(head);

  // create the upper element of the lock ui
  var upper = $(document.createElement('div'))
    .attr('id', 'clear-upper');

  // create all the interactive parts
  var button = $(document.createElement('div'))
    .appendTo(upper);
  $(document.createElement('div'))
    .addClass('button')
    .appendTo(button)
    .append($(document.createElement('a'))
      .attr('href', 'javascript:void(0)')
      .on('click', function() {
        chrome.extension.sendMessage({
          q:'unlock!',
          host: window.location.host
        });
      }));

  // add text below lock
  $(document.createElement('div'))
    .text('It\u2019s for your own good.')
    .addClass('title')
    .appendTo(button);

  // create the lower element of the lock ui
  var lower = $(document.createElement('div'))
    .attr('id', 'clear-lower')
    .css('top', window.innerHeight);

  // create the signature link pointing to my site
  $(document.createElement('div'))
    .appendTo(lower)
    .append($(document.createElement('a'))
      .attr('href', 'http://kellegous.com/')
      .attr('target', '_blank')
      .attr('title', 'made by kellegous'));

  // put both elements into the DOM
  body.append(upper, lower);

  // shows the lock ui
  var Show = function(callback) {
    if (showing) {
      return;
    }
    showing = true;

    var wh = window.innerHeight;
    var sh = 350;

    // special case for small windows (like facebook auth) just put the shudder
    // at the bottom.
    if (wh < sh) {
      sh = wh;
    }

    upper.css('display', '')
      .animate({height:sh}, 200);
    lower.css('display', '')
      .animate({top:sh}, 200, function() {
        callback && callback();
      });
    body.css('overflow', 'hidden');
    return self;
  };

  // hides the lock ui
  var Hide = function(callback) {
    if (!showing) {
      return;
    }
    showing = false;

    upper.animate({
      height: 380
    }, 200, function() {
      upper.animate({height:0}, 200, function() {
        upper.css('display', 'none');
        body.css('overflow', overflow);        
      });
      lower.animate({top:window.innerHeight}, 200, function() {
        lower.css('display', 'none');
        callback && callback();
      });
    });
    return self;
  };

  return self = { Show: Show, Hide: Hide };
};

var Load = function() {
  // do we have everything we need?
  if (!queryResponse || !contentLoaded) {
    return;
  }

  // is this a host that will ever lock?
  if (!queryResponse.canlock) {
    return;
  }

  // create the lock ui
  ui = CreateUi();

  // is this host unlocked now?
  if (!queryResponse.locked) {
    return;
  }

  ui.Show();
};

var Handle = function(msg) {
  switch (msg.q) {
  case 'lock!':
    if (!ui) {
      ui = CreateUi();
    }
    ui.Show();
    break;
  case 'unlock!':
    if (!ui) {
      return;
    }
    ui.Hide(function() {
      ShowToast('fine, take ' + TimeDesc(msg.timeout) + '.', 2000);
    });
    break;
  case 'warn!':
    ShowToast('30 seconds!', 2000);
    break;
  case 'mod!':
    console.log('mod!');
    break;
  case 'unmod!':
    console.log('unmod!');
    break;
  }
};

// listen for commands from the background page
chrome.extension.onMessage.addListener(function(req, sender, responseWith) {
  if (pending) {
    pending.push(req);
    return;
  }

  Handle(req);
});

// wait for the page's content to load
window.addEventListener('DOMContentLoaded', function(e) {
  // install raf jquery changes
  UseRafTimer();

  // dispatch any pending messages.
  if (pending.length > 0) {
    pending.forEach(Handle);
  }
  pending = null;

  // TODO(knorton): setup a congested ui state flag.
}, false);


var UseRafTimer = function() {
  var animating,
      lastTime = 0,
      requestAnimationFrame = webkitRequestAnimationFrame,
      cancelAnimationFrame = webkitCancelAnimationFrame;

  var tick = function() {
    if (!animating)
      return;
    requestAnimationFrame(tick);
    jQuery.fx.tick();
  }

  jQuery.fx.timer = function(timer) {
    if (timer() && jQuery.timers.push(timer) && !animating) {
      animating = true;
      tick();
    }
  };

  jQuery.fx.stop = function() {
    animating = false;
  };
};

})();