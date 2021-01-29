const daveappserver = require ("./lib/daveappserver.js"); 
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
		switch (theRequest.lowerpath) {
			case "/slogan":
				stats.ctslogans++;
				stats.whenLastSlogan = now;
				daveappserver.saveStats (stats);
				theRequest.returnPlainText (utils.getRandomSnarkySlogan ());
				return (true);
			}
		return (false); //not consumed
		}
	}
daveappserver.start (options);
