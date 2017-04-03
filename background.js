var trackedEvents = new Array();

function zeroPad(i) {
    if (i < 10) {i = "0" + i};  // add zero in front of numbers < 10
    return i;
}

chrome.extension.onConnect.addListener(function(port) {
    port.onMessage.addListener(function(msg) {
    	if (msg.type == 'update') {
        	port.postMessage({
        		type: 'update',
        		events: trackedEvents
        	});
        }
    });
});


chrome.webRequest.onBeforeRequest.addListener(
	function(details) {
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
			}, function(tabs) {
				var tab = tabs[0];
				var url = tab.url;
				
				var event = {
					eventName: rawEvent.event,
					raw: postedString,
					trackedTime: h + ':' + m + ':' + s,
					hostName: url
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