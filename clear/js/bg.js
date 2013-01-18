(function() {

const MINUTES = 60 * 1000;
const TIMEOUT = 5 * MINUTES;
const WARNING = 30 * 1000;
// const TIMEOUT = 10 * 1000;
// const WARNING = 5 * 1000;

var domains = {
  'www.facebook.com'      : 0,
  'plus.google.com'       : 0,
  'news.ycombinator.com'  : 0,
  'pinterest.com'         : 0,
  'twitter.com'           : 0,
  'kellegous.com'         : 0,
};

var IsHttpUrl = function(url) {
  return url.indexOf('http://') == 0 || url.indexOf('https://');
};

var HostOf = function(url) {
  // TODO(knorton): ignore authority for now
  var ix = url.indexOf(':') + 1;
  if (ix == 0 || ix == url.length) {
    throw new Error('bad url');
  }

  while (url.charAt(ix) === '/') {
    ix++;
  }

  var jx = url.indexOf('/', ix);
  if (jx == -1) {
    return url.substring(ix);
  }

  return url.substring(ix, jx);
};

var Broadcast = function(host, msg) {
  chrome.tabs.query({ url: '*://' + host + '/*'}, function(tabs) {
    tabs.forEach(function(tab) {
      chrome.tabs.sendMessage(tab.id, msg);
    });
  });
};

var Warn = function(host) {
  Broadcast(host, {
    q: 'warn!',
    host: host,
    timeout: WARNING
  });
};

var Lock = function(host) {
  console.log('Lock', host);
  Broadcast(host, {
    q: 'lock!',
    host: host,
    timeout: TIMEOUT
  });
};

var Unlock = function(host) {
  console.log('Unlock', host);

  // compute and record the timeout
  var warnAt = Date.now() + TIMEOUT;
  var lockAt = warnAt + WARNING;

  domains[host] = lockAt;

  // broadcast to all tabs on this host
  Broadcast(host, {
    q: 'unlock!',
    host: host
  });

  // timer loop for re-lock
  var tickLock = function() {
    var now = Date.now();
    if (now < lockAt) {
      setTimeout(tickLock, lockAt - now);
      return;
    }

    Lock(host);
  };

  // timer loop for warning
  var tickWarn = function() {
    var now = Date.now();
    if (now < warnAt) {
      setTimeout(tickWarn, warnAt - now);
      return;
    }

    Warn(host);
    setTimeout(tickLock, WARNING);
  };

  // start the ticker waiting for warning
  setTimeout(tickWarn, TIMEOUT);
};

var IsLocked = function(host) {
  var exp = domains[host];
  return exp === undefined ? false : exp < Date.now();
};

var CanLock = function(host) {
  return domains[host] !== undefined;
};

// TODO(knorton): Refactor this to only receive 'unlock!' command.
// chrome.extension.onMessage.addListener(function(req, sender, respondWith) {
//   var now = Date.now();
//   switch (req.q) {
//   case 'locked?':
//     console.log(req);
//     respondWith({
//       locked: IsLocked(req.host),
//       canlock: CanLock(req.host)
//     });
//     break;
//   case 'unlock!':
//     Unlock(req.host);
//     respondWith({
//       timeout: TIMEOUT
//     });
//     break;
//   }
// });

chrome.extension.onMessage.addListener(function(req, sender, respondWith) {
  switch (req.q) {
  case 'unlock!':
    Unlock(req.host);
    break;
  }
});

chrome.tabs.onUpdated.addListener(function(id, change, tab) {
  if (!IsHttpUrl(tab.url)) {
    return;
  }

  var host = HostOf(tab.url);

  if (!IsLocked(host)) {
    return;
  }

  Lock(host);
});

})();