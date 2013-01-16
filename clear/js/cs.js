(function() {

// The initial response received from the locked? query (used to Load)
var queryResponse;

// A flag to indicate if the DOM content has loaded (used to Load)
var contentLoaded = false;

// Simple access to the Ui components
var ui;

// Creates the UI components in an unlocked state
var CreateUi = function() {
  var self = {},
      bg = chrome.runtime.getURL('im/bg.png'),
      locklo = chrome.runtime.getURL('im/lock-lo.png'),
      lockhi = chrome.runtime.getURL('im/lock-hi.png'),
      body = $(document.body),
      overflow = body.css('overflow'),
      showing = false,
      head = $(document.head);

  // we need hover for the link, so we inject a couple of style rules to avoid doing
  // that work in javascript
  $(document.createElement('style'))
    .attr('type', 'text/css')
    .appendTo(head)
    .text(
      '.clear_lock {background-image: url("' + locklo + '"), url("' + bg + '");}' +
      '.clear_lock:hover {background-image: url("' + lockhi + '"), url("' + bg + '");}'
    );

  // inject raleway into the page
  $(document.createElement('link'))
    .attr('href', 'https://fonts.googleapis.com/css?family=Raleway')
    .attr('rel', 'stylesheet')
    .attr('type', 'text/css')
    .appendTo(head);

  // create the upper element of the lock ui
  var upper = $(document.createElement('div'))
    .css('background-image', 'url("' + bg + '")')
    .css('position', 'fixed')
    .css('top', 0)
    .css('left', -2)
    .css('right', -2)
    .css('height', 0)
    .css('z-index', 60001)
    .css('box-shadow', '0 2px 10px rgba(0,0,0,0.1)')
    .css('border', '1px solid #aaa')
    .css('-webkit-user-select', 'none')
    .appendTo(body);

  // create the lower element of the lock ui
  var lower = $(document.createElement('div'))
    .css('background-image', 'url("' + bg + '")')
    .css('position', 'fixed')
    .css('top', window.innerHeight)
    .css('left', -2)
    .css('right', -2)
    .css('bottom', 0)
    .css('z-index', 60000)
    .css('overflow', 'hidden')
    .appendTo(body);

  $(document.createElement('div'))
    .css('position', 'absolute')
    .css('left', 0)
    .css('right', 0)
    .css('bottom', 0)
    .appendTo(lower)
    .append($(document.createElement('a'))
      .attr('href', 'http://kellegous.com/')
      .attr('title', 'made by kellegous')
      .css('width', 80)
      .css('height', 50)
      .css('background', 'url("http://kellegous.com/s/sig.png")  no-repeat 0 0')
      .css('display', 'block')
      .css('margin', '0 auto 20px auto')
      .css('opacity', 0.3));


  // create all the interactive parts
  var button = $(document.createElement('div'))
    .css('position', 'absolute')
    .css('left', 0)
    .css('right', 0)
    .css('bottom', 30)
    .appendTo(upper);

  $(document.createElement('div'))
    .css('width', 44)
    .css('height', 44)
    .css('background-color', '#aaa')
    .css('border-radius', '30px')
    .css('padding', 4)
    .css('margin', '0 auto')
    .css('border', '1px solid #999')
    .appendTo(button)
    .append($(document.createElement('a'))
      .addClass('clear_lock')
      .attr('href', 'javascript:void(0)')
      .css('display', 'block')
      .css('width', 42)
      .css('height', 42)
      .css('border-radius', '21px')
      .css('box-shadow', '0 2px 2px rgba(0,0,0,0.2)')
      .css('border', '1px solid #999')
      .css('background-position', '50% 50%, 0 0')
      .css('background-repeat', 'no-repeat, repeat')
      .on('click', function() {
        chrome.extension.sendMessage({
          q:'unlock!',
          host: window.location.host
        });
        self.Hide();
      }));

  $(document.createElement('div'))
    .text('It\u2019s for your own good.')
    .css('text-align', 'center')
    .css('margin-top', 12)
    .css('color', '#999')
    .css('text-shadow', '1px 1px 1px #fff')
    .css('font-size', '20px')
    .css('cursor', 'default')
    .css('font-family', '\'Raleway\', sans-serif')
    .appendTo(button);

  self.Show = function() {
    if (showing) {
      return;
    }
    showing = true;

    upper.animate({height:350}, 200);
    lower.animate({top:350}, 200);
    body.css('overflow', 'hidden');
    return self;
  };

  self.Hide = function() {
    if (!showing) {
      return;
    }
    showing = false;

    upper.animate({
      height: 380
    }, 200, function() {
      upper.animate({height:0}, 200, function() {
        body.css('overflow', overflow);        
      });
      lower.animate({top:window.innerHeight}, 200);
    });
    return self;
  };

  return self;
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

// ask the background page about locking this page
chrome.extension.sendMessage({q:'locked?', host: window.location.host},
  function(rsp) {
    queryResponse = rsp;
    Load();
  });

// listen for commands from the background page
chrome.extension.onMessage.addListener(function(req, sender, responseWith) {
  if (!ui) {
    return;
  }

  switch (req.q) {
  case 'lock!':
    ui.Show();
    break;
  case 'unlock!':
    ui.Hide();
    break;
  }
});

// wait for the page's content to load
window.addEventListener('DOMContentLoaded', function(e) {
  contentLoaded = true;
  setTimeout(Load, 10);
}, false);


console.log(document.head);

})();