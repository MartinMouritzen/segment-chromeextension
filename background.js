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

function formatDateToTime(date) {
	return date.toLocaleTimeString()
}

function withOpenTab(callback) {
	chrome.tabs.query({
		active: true,
		currentWindow: true
	}, (tabs) => {
		var tab = tabs[0];

		if (tab) {
			callback(tab);
		}
	});
}

function addEvent(event) {
	trackedEvents.unshift(event);
	chrome.runtime.sendMessage({ type: "new_event" });
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

function onOwnServerResponse(url, callback) {
	withOpenTab((tab) => {
		if ((new URL(tab.url)).host === (new URL(url)).host) {
			callback();
		}
	})
}

function eventTypeToName(eventType) {
	switch(eventType) {
		case 'identify':
			return 'Identify'
		case 'pageLoad':
			return 'Page Loaded'
		case 'batch':
			return 'Batch'
	}
}

chrome.webRequest.onBeforeRequest.addListener(
	(details) => {
		if (isSegmentApiCall(details.url)) {
			var postedString = String.fromCharCode.apply(null,new Uint8Array(details.requestBody.raw[0].bytes));

			var rawEvent = JSON.parse(postedString);

			var event = {
				raw: postedString,
				trackedTime: formatDateToTime(new Date()),
			};

			withOpenTab((tab) => {
				event.hostName = tab.url;
				event.tabId = tab.id;

				if (details.url.endsWith('/v1/t') || details.url.endsWith('/v2/t')) {
					event.type = 'track';
				}
				else if (details.url.endsWith('/v1/i') || details.url.endsWith('/v2/i')) {
					event.type = 'identify';
				}
				else if (details.url.endsWith('/v1/p') || details.url.endsWith('/v2/p')) {
					event.type = 'pageLoad';
				}
				else if (details.url.endsWith('/v1/batch') || details.url.endsWith('/v2/batch') || details.url.endsWith('/v1/b') || details.url.endsWith('/v2/b')) {
					event.type = 'batch';
				}

				if (event.type) {
					event.eventName = eventTypeToName(event.type) || rawEvent.event
					addEvent(event);
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

chrome.webRequest.onHeadersReceived.addListener(
	(details) => {
		onOwnServerResponse(details.url, () => {
			var eventsHeader = details.responseHeaders.find((header) => header.name === 'X-Tracked-Events');
			if (!eventsHeader) return

			withOpenTab((tab) => {
				var serverTrackedEvents = JSON.parse(eventsHeader.value);
				serverTrackedEvents.forEach((serverEvent) => {
					var event = {
						type: serverEvent.type,
						eventName: serverEvent.event || eventTypeToName(serverEvent.type),
						raw: JSON.stringify(serverEvent),
						trackedTime: formatDateToTime(new Date(serverEvent.timestamp)),
						hostName: details.url,
						tabId: tab.id
					};

					addEvent(event);
				})
			});
		})
	},
	{
	urls: [
		"https://*/*",
		"http://*/*"
	]},
	['responseHeaders']
);
