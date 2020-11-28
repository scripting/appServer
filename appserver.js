var myVersion = "0.4.5", myProductName = "daveAppServer";

exports.start = startup; 
exports.notifySocketSubscribers = notifySocketSubscribers;
exports.saveStats = saveStats;
exports.getConfig = getConfig;

const fs = require ("fs");
const request = require ("request");
const websocket = require ("nodejs-websocket"); 
const utils = require ("daveutils");
const davehttp = require ("davehttp");
const davetwitter = require ("davetwitter");

const whenStart = new Date ();

var config = {
	flLogToConsole: true,
	port: process.env.PORT || 1420,
	websocketPort: 1422,
	flAllowAccessFromAnywhere: true,
	flWebsocketEnabled: true,
	urlServerForClient: "http://tagserver.opml.org/",
	urlWebsocketServerForClient: "ws://tagserver.opml.org:1422/",
	flEnableLogin: true, //user can log in via twitter
	};
const fnameConfig = "config.json";

var stats = {
	whenFirstStart: whenStart, ctStarts: 0,
	whenLastStart: undefined,
	ctWrites: 0,
	ctHits: 0, ctHitsToday: 0, ctHitsThisRun:0, 
	whenLastHit: new Date (0)
	};
const fnameStats = "stats.json";
var theWsServer = undefined;

function statsChanged () {
	flStatsChanged = true;
	}
function saveStats (theStats) {
	for (var x in theStats) {
		stats [x] = theStats [x];
		}
	statsChanged ();
	}
function getConfig () {
	return (config);
	}
function httpReadUrl (url, callback) {
	request (url, function (err, response, data) {
		if (err) {
			callback (err);
			}
		else {
			if (response.statusCode != 200) {
				const errstruct = {
					message: "Can't read the URL, \"" + url + "\" because we received a status code of " + response.statusCode + ".",
					statusCode: response.statusCode
					};
				callback (errstruct);
				}
			else {
				callback (undefined, data);
				}
			}
		});
	}
function notifySocketSubscribers (verb, jstruct) {
	if (theWsServer !== undefined) {
		var ctUpdates = 0, now = new Date (), jsontext = "";
		if (jstruct !== undefined) { 
			jsontext = utils.jsonStringify (jstruct);
			}
		for (var i = 0; i < theWsServer.connections.length; i++) {
			var conn = theWsServer.connections [i];
			if (conn.bingeworthyData !== undefined) { //it's one of ours
				try {
					conn.sendText (verb + "\r" + jsontext);
					conn.bingeworthyData.whenLastUpdate = now;
					conn.bingeworthyData.ctUpdates++;
					ctUpdates++;
					}
				catch (err) {
					console.log ("notifySocketSubscribers: socket #" + i + ": error updating");
					}
				}
			}
		if (ctUpdates > 0) {
			console.log ("\nnotifySocketSubscribers: " + ctUpdates + " sockets were updated.\n");
			}
		}
	}
function webSocketStartup () {
	if (config.flWebsocketEnabled) {
		try {
			theWsServer = websocket.createServer (function (conn) {
				conn.bingeworthyData = {
					whenLastUpdate: new Date (0),
					ctUpdates: 0
					};
				});
			theWsServer.listen (config.websocketPort);
			}
		catch (err) {
			console.log ("webSocketStartup: err.message == " + err.message);
			}
		}
	}

function startup (options, callback) {
	function readConfig (f, theConfig, callback) { 
		fs.readFile (f, function (err, jsontext) {
			if (err) {
				console.log ("readConfig: err.message == " + err.message);
				}
			else {
				try {
					var jstruct = JSON.parse (jsontext);
					for (var x in jstruct) {
						theConfig [x] = jstruct [x];
						}
					}
				catch (err) {
					console.log ("readConfig: err.message == " + err.message);
					}
				}
			callback ();
			});
		}
	function handleHttpRequest (theRequest) {
		const params = theRequest.params;
		const token = params.oauth_token, secret = params.oauth_token_secret;
		
		stats.ctHits++;
		stats.ctHitsToday++;
		stats.ctHitsThisRun++;
		stats.whenLastHit = new Date ();
		statsChanged ();
		
		function returnPlainText (s) {
			theRequest.httpReturn (200, "text/plain", s.toString ());
			}
		function returnData (jstruct) {
			if (jstruct === undefined) {
				jstruct = {};
				}
			theRequest.httpReturn (200, "application/json", utils.jsonStringify (jstruct));
			}
		function returnHtml (htmltext) {
			theRequest.httpReturn (200, "text/html", htmltext);
			}
		function returnXml (xmltext) {
			theRequest.httpReturn (200, "text/xml", xmltext);
			}
		function returnNotFound () {
			theRequest.httpReturn (404, "text/plain", "Not found.");
			}
		function returnError (jstruct) {
			theRequest.httpReturn (500, "application/json", utils.jsonStringify (jstruct));
			}
		function httpReturnObject (err, jstruct) {
			if (err) {
				returnError (err);
				}
			else {
				returnData (jstruct);
				}
			}
		function returnServerHomePage () {
			request (options.urlServerHomePageSource, function (error, response, templatetext) {
				if (!error && response.statusCode == 200) {
					var pagetable = {
						productName: options.productName, 
						productNameForDisplay: options.productNameForDisplay, 
						version: options.version,
						urlServerForClient: config.urlServerForClient,
						urlWebsocketServerForClient: config.urlWebsocketServerForClient,
						flEnableLogin: config.flEnableLogin
						};
					var pagetext = utils.multipleReplaceAll (templatetext, pagetable, false, "[%", "%]");
					returnHtml (pagetext);
					}
				});
			}
		
		if (options.httpRequest !== undefined) {
			if (options.httpRequest (theRequest)) { //consumed by callback
				return (true);
				}
			}
		switch (theRequest.lowerpath) {
			case "/":
				returnServerHomePage ();
				return (true);
			case "/now":
				returnPlainText (new Date ());
				return (true);
			case "/version":
				returnData ({
					productName: options.productName,
					version: options.version
					});
				return (true);
			case "/stats":
				returnData (stats);
				return (true);
			}
		return (false);
		}
	function startDavetwitter (httpRequestCallback) { //patch over a design problem in starting up davetwitter and davehttp -- 7/20/20 by DW 
		config.twitter.myPort = config.port;
		config.twitter.httpPort = config.port;
		config.twitter.flLogToConsole = config.flLogToConsole;
		config.twitter.flAllowAccessFromAnywhere = config.flAllowAccessFromAnywhere;
		config.twitter.flPostEnabled = config.flPostEnabled;
		config.twitter.blockedAddresses = config.blockedAddresses;
		config.twitter.httpRequestCallback = httpRequestCallback;
		davetwitter.start (config.twitter);
		}
	function everyMinute () {
		var now = new Date ();
		if (options.everyMinute !== undefined) {
			options.everyMinute ();
			}
		if (now.getMinutes () == 0) {
			console.log ("\n" + now.toLocaleTimeString () + ": " + options.productName + " v" + options.version + " running on port " + config.port + ".\n");
			}
		}
	function everySecond () {
		if (flStatsChanged) {
			stats.ctWrites++;
			flStatsChanged = false;
			fs.writeFile (fnameStats, utils.jsonStringify (stats), function () {
				});
			}
		if (options.everySecond !== undefined) {
			options.everySecond ();
			}
		}
	readConfig (fnameConfig, config, function () {
		readConfig (fnameStats, stats, function () {
			if (process.env.PORT !== undefined) { //8/6/20 by DW
				config.port = process.env.PORT;
				}
			stats.ctStarts++;
			stats.ctHitsThisRun = 0;
			stats.whenLastStart = whenStart;
			statsChanged ();
			console.log ("\n" + options.productName + " v" + options.version + " running on port " + config.port + ".\n");
			console.log ("config == " + utils.jsonStringify (config)); 
			startDavetwitter (handleHttpRequest);
			webSocketStartup (); 
			setInterval (everySecond, 1000); 
			utils.runEveryMinute (everyMinute); 
			if (callback !== undefined) {
				callback (config);
				}
			});
		});
	}
