(function() {

var TIMEOUT = 10 * 1000;

var domains = {
  'www.facebook.com' : 0,
  'plus.google.com' : 0,
  'news.ycombinator.com' : 0
};


var Lock = function(host) {
  console.log('Lock', host);
  // query all the tabs that match the host
  chrome.tabs.query({url: '*://' + host + '/*'}, function(tabs) {
    tabs.forEach(function(tab) {
      chrome.tabs.sendMessage(tab.id, {
        q: 'lock!',
        host: host
      });
      console.log('unlock', t);
    });
  });
};

var Unlock = function(host) {
  console.log('Unlock', host);
  var exp = Date.now() + TIMEOUT;
  domains[host] = exp;

  var tick = function() {
    console.log('tick', host);
    var now = Date.now();
    if (now < exp) {
      setTimeout(tick, exp - now);
      return;
    }

    Lock(host);
  };

  setTimeout(tick, TIMEOUT);
};

var IsLocked = function(host) {
  var exp = domains[host];
  return exp === undefined ? false : exp < Date.now();
};

chrome.extension.onMessage.addListener(function(req, sender, respondWith) {
  var now = Date.now();
  switch (req.q) {
  case 'locked?':
    respondWith({
      locked: IsLocked(req.host)
    });
    break;
  case 'unlock!':
    Unlock(req.host);
    respondWith({
      locked: true
    });
    break;
  }
});

})();