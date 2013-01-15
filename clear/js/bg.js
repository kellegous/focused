(function() {

var TIMEOUT = 10 * 1000;

var domains = {
  'www.facebook.com' : 0,
  'plus.google.com' : 0,
  'news.ycombinator.com' : 0
};

var Broadcast = function(host, msg) {
  chrome.tabs.query({ url: '*://' + host + '/*'}, function(tabs) {
    tabs.forEach(function(tab) {
      chrome.tabs.sendMessage(tab.id, msg);
    });
  });
};

var Lock = function(host) {
  console.log('Lock', host);
  Broadcast(host, {
    q: 'lock!',
    host: host
  });
};

var Unlock = function(host) {
  console.log('Unlock', host);

  // compute and record the timeout
  var exp = Date.now() + TIMEOUT;
  domains[host] = exp;

  // broadcast to all tabs on this host
  Broadcast(host, {
    q: 'unlock!',
    host: host
  });

  // schedule a timer to re-lock
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

var CanLock = function(host) {
  return domains[host] !== undefined;
};

chrome.extension.onMessage.addListener(function(req, sender, respondWith) {
  var now = Date.now();
  switch (req.q) {
  case 'locked?':
    respondWith({
      locked: IsLocked(req.host),
      canlock: CanLock(req.host)
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