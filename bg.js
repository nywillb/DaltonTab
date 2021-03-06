chrome.runtime.onInstalled.addListener(function(details){
    if(details.reason == "install"){
		chrome.tabs.create({
			url: chrome.runtime.getURL("index.html")
		});
    }
});

chrome.tabs.onCreated.addListener(function() {
	var today = new Date().getDay();
	chrome.storage.sync.get("lastDate", function(dateResponse) {
		chrome.storage.sync.get("tabCount", function(response) {
			if (dateResponse.lastDate == today) {
				var tabCountLocal = response.tabCount;
				if (!tabCountLocal) {
					tabCountLocal = 1;
				} else {
					tabCountLocal++;
				}
				chrome.storage.sync.set({tabCount: tabCountLocal}, function(){});
			} else {
				chrome.storage.sync.set({tabCount: 1}, function(){});
				chrome.storage.sync.set({lastDate: today}, function(){});
			}
		});
	});
});

chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
	// monitor for myhomeworkspace signin completion
	if (changeInfo.url) {
		var prefix = "https://stuff.myhomework.space/daltontabCallbackHelper.html";
		if (changeInfo.url.indexOf(prefix) === 0) {
			// find the token
			var token = unescape(changeInfo.url.match("\\?token=(.*?)(&|$)")[1]);
			
			chrome.storage.sync.set({
				mhsToken: token
			}, function() {
				// redirect
				var newURL = chrome.runtime.getURL("index.html#mhsComplete");
				chrome.tabs.update(tabId, {
					url: newURL
				}, function() {
					// yay
				});
			});
		}
	}
});