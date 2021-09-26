const daveappserver = require ("../appserver.js"); 
const utils = require ("daveutils"); 

var stats = {
	ctslogans: 0,
	whenLastSlogan: undefined
	};
var options = {
	everySecond: function () {
		},
	everyMinute: function () {
		},
	httpRequest: function (theRequest) {
		var now = new Date ();
		function returnPlainText (s) {
			theRequest.httpReturn (200, "text/plain", s.toString ());
			}
		function returnData (jstruct) {
			if (jstruct === undefined) {
				jstruct = {};
				}
			theRequest.httpReturn (200, "application/json", utils.jsonStringify (jstruct));
			}
		switch (theRequest.lowerpath) {
			case "/slogan":
				stats.ctslogans++;
				stats.whenLastSlogan = now;
				daveappserver.saveStats (stats);
				returnData ({slogan: utils.getRandomSnarkySlogan ()});
				return (true);
			}
		return (false); //not consumed
		}
	}
daveappserver.start (options);
