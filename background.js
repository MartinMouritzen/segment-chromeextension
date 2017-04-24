var trackedEvents = new Array();

function zeroPad(i) {
	if (i < 10) {
		i = "0" + i
	}
	return i;
}

function updateTrackedEventsForTab(tabId,port) {
	var sendEvents = [];
	
	for(var i=0;i<trackedEvents.length;i++) {
		if (trackedEvents[i].tabId == tabId) {
			sendEvents.push(trackedEvents[i]);
		}
	}
	
	port.postMessage({
		type: 'update',
		events: sendEvents
	});
}
chrome.extension.onConnect.addListener((port) => {
	port.onMessage.addListener((msg) => {
		var tabId = msg.tabId;
		if (msg.type == 'update') {
			updateTrackedEventsForTab(tabId,port);
		}
	});
});

chrome.webRequest.onBeforeRequest.addListener(
	(details) => {
		if (details.url == 'https://api.segment.io/v1/t') {
			var postedString = decodeURIComponent(String.fromCharCode.apply(null,new Uint8Array(details.requestBody.raw[0].bytes)));
			
			var rawEvent = JSON.parse(postedString);
			
			var today = new Date();
			
			var h = zeroPad(today.getHours());
			var m = zeroPad(today.getMinutes());
			var s = zeroPad(today.getSeconds());

			chrome.tabs.query({
				active: true,
				currentWindow: true
			}, (tabs) => {
				var tab = tabs[0];
				var url = tab.url;
				
				var event = {
					eventName: rawEvent.event,
					raw: postedString,
					trackedTime: h + ':' + m + ':' + s,
					hostName: url,
					tabId: tab.id
				};
				trackedEvents.unshift(event);
			});

		}
	},
	{
	urls: [
		"https://*/*",
		"http://*/*"
	]},
	['blocking','requestBody']
);