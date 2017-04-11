function showEvent(number) {
	document.getElementById('eventContent_' + number).style.display = 'block';
}
function printVariable(jsonObject,level) {
	var returnString = '';
	for (var key in jsonObject) {
		if (jsonObject.hasOwnProperty(key)) {
			returnString += '<div style="padding-left: ' + (level * 10) + 'px;">';
			returnString += '<span class="key">';
			returnString += key;
			returnString += '</span>';
			
			if (typeof jsonObject[key] == 'object') {
				returnString += ' {' + printVariable(jsonObject[key],level + 1) + '}';
			}
			else {
				var type = 'number';
				if (isNaN(jsonObject[key])) {
					type = 'string';
				}
				
				returnString += ': ';
				returnString += '<span class="' + type + '">';
				returnString += jsonObject[key];
				returnString += '</span>';
			}
			returnString += '</div>';
		}
	}
	return returnString;
}

var port = chrome.extension.connect({
	name: "trackPopup"
});
port.postMessage({
	type: "update"
});

port.onMessage.addListener((msg) => {
	if (msg.type == "update") {
		// console.log(jsonObject);
		
		var prettyEventsString = '';
		for (var i=0;i<msg.events.length;i++) {
			var event = msg.events[i];
			
			var jsonObject = JSON.parse(event.raw)
			var eventString = '';
			eventString += '<div class="eventTracked">';
				eventString += '<div class="eventInfo" number="' + i + '"><span class="eventName">' + event.eventName + '</span> - ' + event.trackedTime + '<br />' + event.hostName + '</div>';
				eventString += '<div class="eventContent" id="eventContent_' + i + '">';
					eventString += printVariable(jsonObject,0);
				eventString += '</div>';
			eventString += '</div>';
			
			prettyEventsString += eventString;
		}
		document.getElementById('trackMessages').innerHTML = prettyEventsString;

		var eventElements = document.getElementsByClassName("eventInfo");
		for (var i=0;i<eventElements.length;i++) {
			eventElements[i].onclick = function() {
				var number = this.getAttribute('number');
				if (document.getElementById('eventContent_' + number).style.display == 'block') {
					document.getElementById('eventContent_' + number).style.display = 'none';
				}
				else {
					document.getElementById('eventContent_' + number).style.display = 'block';
				}
			};
		}
	}
});
