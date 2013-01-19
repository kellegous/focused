(function() {

// Simple access to the Ui components
var ui;

// a queue of commands that are waiting to run at startup.
var pending = [];

// the ui thread is really busy at DOMContentLoaded, so we postpone our animations
// until a bit later to avoid the rush. This is the time we can start doing our
// thing.
var congestionEndsAt;


// converts milliseconds into a decent time
var TimeDesc = function(t) {
  var s = t / 1000;
  if (s < 60) {
    return (s | 0) + ' seconds';
  }

  var m = s / 60;
  if (m < 60) {
    return (m | 0) + ' minutes';
  }

  return ((m / 60) | 0) + ' hours';
};


// new element utility
var E = function(type) {
  return $(document.createElement(type));
};


// show a simple toast-style message for the specified time
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


// creates the UI components in an unlocked state
var CreateUi = function() {
  var body = $(document.body),
      head = $(document.head),
      overflow = body.css('overflow'),
      showing = false,
      self;

  // inject the ui stylesheet
  // TODO(knorton): need to inline resources to avoid flicker
  E('link').attr('rel', 'stylesheet')
    .attr('href', chrome.runtime.getURL('ss/cs.css'))
    .attr('type', 'text/css')
    .appendTo(head);

  // inject raleway into the page
  // TODO(knorton): can i inline this?
  E('link').attr('rel', 'stylesheet')
    .attr('href', 'https://fonts.googleapis.com/css?family=Raleway:400')
    .attr('type', 'text/css')
    .appendTo(head);

  // create the upper element of the lock ui
  var upper = E('div')
    .attr('id', 'clear-upper');

  // create all the interactive parts
  var button = E('div')
    .appendTo(upper);
  E('div').addClass('button')
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
  E('div')
    .text('It\u2019s for your own good.')
    .addClass('title')
    .appendTo(button);

  // create the lower element of the lock ui
  var lower = E('div')
    .attr('id', 'clear-lower')
    .css('top', window.innerHeight);

  // create the signature link pointing to my site
  E('div')
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


// locks the screen
var Lock = function(msg) {
  if (!ui) {
    ui = CreateUi();
  }

  var when = congestionEndsAt - Date.now();
  if (when <= 0) {
    ui.Show();
    return;
  }

  setTimeout(function() {
    ui.Show();
  }, when);
};


// the main message handler
var Handle = function(msg) {
  console.assert(pending == null);

  switch (msg.q) {
  case 'lock!':
    Lock(msg);
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
    ShowToast(TimeDesc(msg.timeout) + '!', 2000);
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
  // if we are still in a pending state, queue messages
  if (pending) {
    pending.push(req);
    return;
  }

  // handle messages
  Handle(req);
});


// wait for the page's content to load
window.addEventListener('DOMContentLoaded', function(e) {
  // install raf jquery changes
  UseRafTimer();

  // record the time when congestion might be better in the ui
  congestionEndsAt = Date.now() + 500;

  // dispatch any pending messages and end pending state
  var toHandle = pending;
  pending = null;
  if (toHandle.length > 0) {
    toHandle.forEach(Handle);
  }

}, false);


// monkey patch jquery to use raf callbacks rather than setInterval
var UseRafTimer = function() {
  var animating,
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