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

  $(document.createElement('link'))
    .attr('href', chrome.runtime.getURL('ss/cs.css'))
    .attr('rel', 'stylesheet')
    .attr('type', 'text/css')
    .appendTo(head);

  // inject raleway into the page
  $(document.createElement('link'))
    .attr('href', 'https://fonts.googleapis.com/css?family=Raleway')
    .attr('rel', 'stylesheet')
    .attr('type', 'text/css')
    .appendTo(head);

  // create the upper element of the lock ui
  var upper = $(document.createElement('div'))
    .attr('id', 'clear-upper');

  // create the lower element of the lock ui
  var lower = $(document.createElement('div'))
    .attr('id', 'clear-lower')
    .css('top', window.innerHeight);

  $(document.createElement('div'))
    .appendTo(lower)
    .append($(document.createElement('a'))
      .attr('href', 'http://kellegous.com/')
      .attr('target', '_blank')
      .attr('title', 'made by kellegous'));

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
        self.Hide();
      }));

  $(document.createElement('div'))
    .text('It\u2019s for your own good.')
    .addClass('title')
    .appendTo(button);

  body.append(upper, lower);

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
  setTimeout(Load, 100);
}, false);


console.log(document.head);

})();