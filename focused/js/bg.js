(function() {

const MINUTES = 60 * 1000;
const TIMEOUT = 5 * MINUTES;
const WARNING = 30 * 1000;
// const TIMEOUT = 10 * 1000;
// const WARNING = 5 * 1000;

var DEFAULTS = [
  'www.facebook.com',
  'plus.google.com',
  'news.ycombinator.com',
  'pinterest.com',
  'twitter.com',
  'www.reddit.com'
];

// a map from host that can be locked an the lock timeout.
var domains = {};

var modsByTarget = {};
var modsBySource = {};

var Mod = function(source, name, targets) {
  targets.forEach(function(t) {
    modsByTarget[t] = [source, name];
  });
  modsBySource[source] = [targets, name];
};

Mod('plus.google.com', 'MuteSandbar', [
  'www.google.com',
  'www.youtube.com',
  'mail.google.com',
  'drive.google.com',
  'groups.google.com',
  'play.google.com',
  'news.google.com'
]);


// A simple model
var Model = (function() {
  var domains = {},
      self = {};

  var Store = function() {
    var list = [];
    for (var key in domains) {
      list.push(key);
    }
    chrome.storage.local.set({ domains: list });
  };

  var Add = function(host) {
    return domains[host] = {
      lockAt: 0,
      timer: null
    };
  };


  chrome.storage.local.get(['domains'], function(res) {
    var list = res.domains || DEFAULTS;
    list.forEach(Add);
  });

  self.Get = function(host) {
    return domains[host];
  };

  self.Add = function(host) {
    var s = Add(host);
    Store();
    return s;
  };

  self.Del = function(host) {
    delete domains[host];
    Store();
  };

  return self;
})();


// determines if the url is http or https
var IsHttpUrl = function(url) {
  return url.indexOf('http://') == 0 || url.indexOf('https://') == 0;
};


// parse a url and determine the host
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


// broadcast a message to all tabs with a page from a particular host
var Broadcast = function(host, msg) {
  chrome.tabs.query({ url: '*://' + host + '/*'}, function(tabs) {
    tabs.forEach(function(tab) {
      chrome.tabs.sendMessage(tab.id, msg);
    });
  });
};


// issue a close warning to the host
var Warn = function(host) {
  Broadcast(host, {
    q: 'warn!',
    host: host,
    timeout: WARNING
  });
};


// lock a host
var Lock = function(host) {
  console.log('Lock', host);
  Broadcast(host, {
    q: 'lock!',
    host: host
  });

  // handle mods
  var mod = modsBySource[host];
  if (!mod) {
    return;
  }

  mod[0].forEach(function(target) {
    Mod(target, host, mod[1]);
  });
};


// unlocks the specified host and drive the re-lock timers and multi-tab
// coordination
var Unlock = function(host, timeout) {
  console.log('Unlock', host);

  // broadcast to all tabs on this host
  Broadcast(host, {
    q: 'unlock!',
    host: host,
    timeout: timeout
  });

  var mods = modsBySource[host];
  if (mods) {
    mods[0].forEach(function(target) {
      Unmod(target, host, mods[1]);
    });
  }

  // unlock forever?
  if (timeout == 0) {
    Model.Del(host);
    return;
  }

  // compute and record the timeout
  var warnAt = Date.now() + timeout;
  var lockAt = warnAt + WARNING;

  var state = Model.Get(host);
  state.lockAt = lockAt;

  // timer loop for re-lock
  var tickLock = function() {
    var now = Date.now();
    if (now < lockAt) {
      state.timer = setTimeout(tickLock, lockAt - now);
      return;
    }

    state.timer = null;
    Lock(host);
  };

  // timer loop for warning
  var tickWarn = function() {
    var now = Date.now();
    if (now < warnAt) {
      state.timer = setTimeout(tickWarn, warnAt - now);
      return;
    }

    Warn(host);
    state.timer = setTimeout(tickLock, WARNING);
  };

  // start the ticker waiting for warning
  state.timer = setTimeout(tickWarn, TIMEOUT);
};


// apply a mod to a host
var Mod = function(target, source, name) {
  Broadcast(target, {
    q: 'mod!',
    host: source,
    name: name
  });
};


// unapply a mod on a host
var Unmod = function(target, source, name) {
  Broadcast(target,{
    q: 'unmod!',
    host: source,
    name: name
  });
};


// is this host currently locked?
var IsLocked = function(host) {
  var exp = Model.Get(host);
  return exp === undefined ? false : exp.lockAt < Date.now();
};


var CanLock = function(host) {
  return Model.Get(host) !== undefined;
};


var UpdateBrowserAction = function(canLock, tabid) {
  chrome.browserAction.setIcon({
    path: canLock ? 'im/ba-hi.png' : 'im/ba-lo.png',
    tabId: tabid
  });
};


var UpdateTab = function(tab) {
  if (!IsHttpUrl(tab.url)) {
    return;
  }

  var host = HostOf(tab.url);

  UpdateBrowserAction(CanLock(host), tab.id);

  if (IsLocked(host)) {
    Lock(host);
    return;
  }

  var mod = modsByTarget[host];
  if (!mod) {
    return;
  }

  if (IsLocked(mod[0])) {
    Mod(host, mod[0], mod[1]);
  }
};

// listens from commands from the host pages
chrome.extension.onMessage.addListener(function(req, sender, respondWith) {
  switch (req.q) {
  case 'unlock!':
    Unlock(req.host, TIMEOUT);
    break;
  }
});


// use this to monitor tabs that should be locked or modded
chrome.tabs.onUpdated.addListener(function(id, change, tab) {
  if (tab.status !== 'loading') {
    return;
  }

  UpdateTab(tab);
});


chrome.browserAction.onClicked.addListener(function(tab) {
  var host = HostOf(tab.url);

  // if locked we unlock forever.
  if (IsLocked(host)) {
    Unlock(host, 0);
    UpdateBrowserAction(false, tab.id);
    return;
  }

  // if not locked and isn't temporarily open, we add the host and lock
  if (!CanLock(host)) {
    Model.Add(host);
    Lock(host);
    UpdateBrowserAction(true, tab.id);
    return;
  }

  // host is temporarily open so we just lock it immediately
  var state = Model.Get(host);
  if (state.timer != null) {
    state.lockAt = 0;
    clearTimeout(state.timer);
  }

  Lock(host);
});

// get everything in a working state on install
chrome.runtime.onInstalled.addListener(function(details) {
  console.log('onInstalled');
  if (details.reason !== 'install') {
    return;
  }

  // inject the content script into every tab
  chrome.tabs.query({}, function(tabs) {
    tabs.forEach(function(tab) {
      chrome.tabs.executeScript(tab.id, {
        file: 'js/jquery.min.js'
      });
      chrome.tabs.executeScript(tab.id, {
        file: 'js/cs.js'
      }, function() {
        UpdateTab(tab);
      });
    });
  });
});

})();