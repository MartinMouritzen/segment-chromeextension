var trackedEvents = new Array();
var apiDomainDefault = 'api.segment.io';
var apiDomain = apiDomainDefault;

chrome.storage.local.get(['segment_api_domain'], function(result) {
	apiDomain = result.segment_api_domain || apiDomainDefault;
})

chrome.storage.onChanged.addListener(function(changes, namespace) {
	if(namespace === 'local' && changes && changes.segment_api_domain) {
		apiDomain = changes.segment_api_domain.newValue || apiDomainDefault;
	}
});

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

function clearTrackedEventsForTab(tabId,port) {
	var newTrackedEvents = [];			
	for(var i=0;i<trackedEvents.length;i++) {
		if (trackedEvents[i].tabId != tabId) {
			newTrackedEvents.push(trackedEvents[i]);
		}
	}
	trackedEvents = newTrackedEvents;
}

chrome.extension.onConnect.addListener((port) => {
	port.onMessage.addListener((msg) => {
		var tabId = msg.tabId;
		if (msg.type == 'update') {
			updateTrackedEventsForTab(tabId,port);
		}
		else if (msg.type == 'clear') {
			clearTrackedEventsForTab(tabId,port);
			updateTrackedEventsForTab(tabId,port);
		}
	});
});

function isSegmentApiCall(url) {
	var apiDomainParts = apiDomain.split(',');
	return apiDomainParts.findIndex(d => url.startsWith(`https://${d.trim()}`)) != -1;
}

chrome.webRequest.onBeforeRequest.addListener(
	(details) => {
		if (isSegmentApiCall(details.url)) {
			var postedString = String.fromCharCode.apply(null,new Uint8Array(details.requestBody.raw[0].bytes));
			
			var rawEvent = JSON.parse(postedString);
			
			var today = new Date();
			
			var h = zeroPad(today.getHours());
			var m = zeroPad(today.getMinutes());
			var s = zeroPad(today.getSeconds());

			var event = {
				eventName: rawEvent.event,
				raw: postedString,
				trackedTime: h + ':' + m + ':' + s,
			};

			chrome.tabs.query({
				active: true,
				currentWindow: true
			}, (tabs) => {
				var tab = tabs[0];
				
				event.hostName = tab.url;
				event.tabId = tab.id;

				if (details.url.endsWith('/v1/t') || details.url.endsWith('/v2/t')) {
					event.type = 'track';
					
					trackedEvents.unshift(event);
				}
				else if (details.url.endsWith('/v1/i') || details.url.endsWith('/v2/i')) {
					event.eventName = 'Identify';
					event.type = 'identify';
					
					trackedEvents.unshift(event);
				}
				else if (details.url.endsWith('/v1/p') || details.url.endsWith('/v2/p')) {
					event.eventName = 'Page loaded';
					event.type = 'pageLoad';
					
					trackedEvents.unshift(event);
				}
				else if (details.url.endsWith('/v1/batch') || details.url.endsWith('/v2/batch')) {
					event.eventName = 'Batch';
					event.type = 'batch';
					
					trackedEvents.unshift(event);
				}
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
