(function() {

var domains = {
  'www.facebook.com' : true,
  'plus.google.com' : true,
  'news.ycombinator.com' : true
};

chrome.extension.onMessage.addListener(function(req, sender, respondWith) {
  respondWith({locked: !!domains[req.host]});
});

})();