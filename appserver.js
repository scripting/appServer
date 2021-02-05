var myVersion = "0.5.4", myProductName = "daveAppServer"; 

exports.start = startup; 
exports.notifySocketSubscribers = notifySocketSubscribers;
exports.saveStats = saveStats;
exports.getConfig = getConfig;

const fs = require ("fs");
var dns = require ("dns");
var os = require ("os");
const request = require ("request");
const websocket = require ("nodejs-websocket"); 
const utils = require ("daveutils");
const davehttp = require ("davehttp");
const davetwitter = require ("davetwitter");
const filesystem = require ("davefilesystem"); 

const whenStart = new Date ();

var config = {
	productName: "randomApp",
	productNameForDisplay: "Random App",
	version: myVersion,
	prefsPath: "prefs.json",
	docsPath: "myDocs/",
	flLogToConsole: true,
	port: process.env.PORT || 1420,
	websocketPort: 1422,
	flAllowAccessFromAnywhere: true,
	flPostEnabled: true, //12/21/20 by DW
	flWebsocketEnabled: true,
	urlServerForClient: "http://tagserver.opml.org/",
	urlWebsocketServerForClient: "ws://tagserver.opml.org:1422/",
	flEnableLogin: true, //user can log in via twitter
	blockedAddresses: [], 
	flForceTwitterLogin: true,
	
	flStorageEnabled: true,
	privateFilesPath: "privateFiles/users/",
	publicFilesPath: "publicFiles/users/"
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
function checkPathForIllegalChars (path) {
	function isIllegal (ch) {
		if (utils.isAlpha (ch) || utils.isNumeric (ch)) {
			return (false);
			}
		switch (ch) {
			case "/": case "_": case "-": case ".":  case " ": case "*":
				return (false);
			}
		return (true);
		}
	for (var i = 0; i < path.length; i++) {
		if (isIllegal (path [i])) {
			return (false);
			}
		}
	if (utils.stringContains (path, "./")) {
		return (false);
		}
	return (true);
	}
function getDomainName (clientIp, callback) { //11/14/15 by DW
	if (clientIp === undefined) {
		if (callback !== undefined) {
			callback ("undefined");
			}
		}
	else {
		dns.reverse (clientIp, function (err, domains) {
			var name = clientIp;
			if (!err) {
				if (domains.length > 0) {
					name = domains [0];
					}
				}
			if (callback !== undefined) {
				callback (name);
				}
			});
		}
	}

//sockets
	var theWsServer = undefined;
	
	function notifySocketSubscribers (verb, jstruct) {
		if (theWsServer !== undefined) {
			var ctUpdates = 0, now = new Date (), jsontext = "";
			if (jstruct !== undefined) { 
				jsontext = utils.jsonStringify (jstruct);
				}
			theWsServer.connections.forEach (function (conn, ix) {
				if (conn.appData !== undefined) { //it's one of ours
					try {
						conn.sendText (verb + "\r" + jsontext);
						conn.appData.whenLastUpdate = now;
						conn.appData.ctUpdates++;
						ctUpdates++;
						}
					catch (err) {
						console.log ("notifySocketSubscribers: socket #" + i + ": error updating");
						}
					}
				});
			if (ctUpdates > 0) {
				console.log ("\nnotifySocketSubscribers: " + ctUpdates + " sockets were updated.\n");
				}
			}
		}
	function checkWebSocketCalls () { //expire timed-out calls
		}
	function countOpenSockets () {
		if (theWsServer === undefined) { //12/18/15 by DW
			return (0);
			}
		else {
			return (theWsServer.connections.length);
			}
		}
	function getOpenSocketsArray () { //return an array with data about open sockets
		var theArray = new Array ();
		theWsServer.connections.forEach (function (conn, ix) {
			if (conn.appData !== undefined) { //it's one of ours
				theArray.push ({
					arrayIndex: ix,
					lastVerb: conn.appData.lastVerb,
					urlToWatch: conn.appData.urlToWatch,
					domain: conn.appData.domain,
					whenStarted: utils.viewDate (conn.appData.whenStarted),
					whenLastUpdate: utils.viewDate (conn.appData.whenLastUpdate)
					});
				}
			});
		return (theArray);
		}
	function handleWebSocketConnection (conn) { 
		var now = new Date ();
		conn.appData = { //initialize
			whenStarted: now,
			ctUpdates: 0,
			whenLastUpdate: new Date (0),
			lastVerb: undefined,
			urlToWatch: undefined,
			domain: undefined
			};
		
		function logToConsole (conn, verb, value) {
			getDomainName (conn.socket.remoteAddress, function (theName) { //log the request
				var freemem = utils.gigabyteString (os.freemem ()), method = "WS:" + verb, now = new Date (); 
				if (theName === undefined) {
					theName = conn.socket.remoteAddress;
					}
				console.log (now.toLocaleTimeString () + " " + freemem + " " + method + " " + value + " " + theName);
				conn.appData.domain = theName; 
				});
			}
		
		conn.on ("text", function (s) {
			var words = s.split (" ");
			if (words.length > 1) { //new protocol as of 11/29/15 by DW
				conn.appData.whenLastUpdate = now;
				conn.appData.lastVerb = words [0];
				switch (words [0]) {
					case "watch":
						conn.appData.urlToWatch = utils.trimWhitespace (words [1]);
						logToConsole (conn, conn.appData.lastVerb, conn.appData.urlToWatch);
						break;
					}
				}
			else {
				conn.close ();
				}
			});
		conn.on ("close", function () {
			});
		conn.on ("error", function (err) {
			});
		}
	function webSocketStartup () {
		if (config.flWebsocketEnabled) {
			try {
				theWsServer = websocket.createServer (handleWebSocketConnection);
				console.log ("webSocketStartup: config.websocketPort == " + config.websocketPort);
				theWsServer.listen (config.websocketPort);
				}
			catch (err) {
				console.log ("webSocketStartup: err.message == " + err.message);
				}
			}
		}
//storage functions
	function getFilePath (screenname, relpath, flprivate) {
		const folder = (flprivate) ? config.privateFilesPath : config.publicFilesPath;
		const f = folder + screenname + "/" + relpath;
		return (f);
		}
	function publishFile (screenname, relpath, type, flprivate, filetext, callback) {
		if (config.flStorageEnabled) {
			var f = getFilePath (screenname, relpath, flprivate);
			utils.sureFilePath (f, function () {
				var now = new Date ();
				fs.writeFile (f, filetext, function (err) {
					if (err) {
						callback (err);
						}
					else {
						var url = (flprivate) ? undefined : config.urlServerForClient + screenname + "/" + relpath;
						if (!flprivate) {
							notifySocketSubscribers ("update", filetext);
							}
						callback (undefined, {
							url,
							whenLastUpdate: now
							});
						}
					});
				});
			}
		else {
			callback ({message: "Can't publish the file because the feature is not enabled on the server."});
			}
		}
	function getFile (screenname, relpath, flprivate, callback) {
		if (config.flStorageEnabled) {
			var f = getFilePath (screenname, relpath, flprivate);
			fs.readFile (f, function (err, filetext) {
				if (err) {
					if (err.code == "ENOENT") {
						err.status = 500;
						err.code = "NoSuchKey";
						}
					callback (err);
					}
				else {
					callback (undefined, {filedata: filetext.toString ()});
					}
				});
			}
		else {
			callback ({message: "Can't publish the file because the feature is not enabled on the server."});
			}
		}
	function getFileList (screenname, flprivate, callback) {
		var folder = getFilePath (screenname, "", flprivate);
		filesystem.getFolderInfo (folder, function (theList) {
			var returnedList = new Array ();
			theList.forEach (function (item) {
				var fname = utils.stringLastField (item.f, "/");
				if (fname != ".DS_Store") {
					returnedList.push ({
						path: utils.stringDelete (item.f, 1, folder.length),
						whenLastChange: item.whenModified,
						whenCreated: item.whenCreated,
						ctChars: item.size
						});
					}
				});
			console.log ("getFileList: folder == " + folder + ", returnedList == " + utils.jsonStringify (returnedList));
			if (callback != undefined) {
				callback (undefined, returnedList);
				}
			});
		}

function startup (options, callback) {
	function readConfig (f, theConfig, flReportError, callback) { 
		fs.readFile (f, function (err, jsontext) {
			if (err) {
				if (flReportError) { //1/21/21 by DW
					console.log ("readConfig: err.message == " + err.message);
					}
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
	function startDavetwitter (httpRequestCallback) { //patch over a design problem in starting up davetwitter and davehttp -- 7/20/20 by DW 
		if (config.twitter === undefined) {
			config.twitter = new Object ();
			}
		config.twitter.myPort = config.port;
		config.twitter.httpPort = config.port;
		config.twitter.myDomain = config.myDomain;
		config.twitter.flLogToConsole = config.flLogToConsole;
		config.twitter.flAllowAccessFromAnywhere = config.flAllowAccessFromAnywhere;
		config.twitter.flPostEnabled = config.flPostEnabled;
		config.twitter.blockedAddresses = config.blockedAddresses;
		config.twitter.httpRequestCallback = httpRequestCallback;
		config.twitter.http404Callback = http404Callback; //1/24/21 by DW
		config.twitter.twitterConsumerKey = config.twitterConsumerKey;
		config.twitter.twitterConsumerSecret = config.twitterConsumerSecret;
		davetwitter.start (config.twitter);
		}
	function handleHttpRequest (theRequest) {
		const params = theRequest.params;
		const token = params.oauth_token;
		const secret = params.oauth_token_secret;
		const flprivate = (params.flprivate === undefined) ? false : utils.getBoolean (params.flprivate);
		
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
		function httpReturn (err, jstruct) {
			if (err) {
				returnError (err);
				}
			else {
				returnData (jstruct);
				}
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
			request (config.urlServerHomePageSource, function (error, response, templatetext) {
				if (!error && response.statusCode == 200) {
					var pagetable = {
						productName: config.productName, 
						productNameForDisplay: config.productNameForDisplay, 
						version: config.version,
						urlServerForClient: config.urlServerForClient,
						urlWebsocketServerForClient: config.urlWebsocketServerForClient,
						flEnableLogin: config.flEnableLogin,
						prefsPath: config.prefsPath,
						docsPath: config.docsPath
						};
					if (config.addMacroToPagetable !== undefined) {
						config.addMacroToPagetable (pagetable);
						}
					var pagetext = utils.multipleReplaceAll (templatetext, pagetable, false, "[%", "%]");
					returnHtml (pagetext);
					}
				});
			}
		function callWithScreenname (callback) {
			davetwitter.getScreenName (token, secret, function (screenname) {
				if (screenname === undefined) {
					returnError ({message: "Can't do the thing you want because the accessToken is not valid."});    
					}
				else {
					callback (screenname);
					}
				});
			}
		
		if (config.httpRequest !== undefined) {
			if (config.httpRequest (theRequest)) { //consumed by callback
				return (true);
				}
			}
		switch (theRequest.lowermethod) {
			case "post":
				switch (theRequest.lowerpath) {
					case "/publishfile": //1/22/21 by DW
						callWithScreenname (function (screenname) {
							publishFile (screenname, params.relpath, params.type, flprivate, theRequest.postBody.toString (), function (err, data) {
								if (err) {
									returnError (err);
									}
								else { //quirk in API, it wants a string, not a JSON struct
									returnPlainText (utils.jsonStringify (data));
									}
								});
							});
						return (true);
					}
				break;
			case "get":
				switch (theRequest.lowerpath) {
					case "/":
						returnServerHomePage ();
						return (true);
					case "/now":
						returnPlainText (new Date ());
						return (true);
					case "/version":
						returnData ({
							productName: config.productName,
							version: config.version
							});
						return (true);
					case "/stats":
						returnData (stats);
						return (true);
					case "/getfile":
						callWithScreenname (function (screenname) {
							getFile (screenname, params.relpath, flprivate, httpReturn);
							});
						return (true); 
					case "/getoptionalfile": 
						callWithScreenname (function (screenname) {
							getFile (screenname, params.relpath, flprivate, function (err, data) {
								if (err) {
									returnData ({}); //return nothing
									}
								else {
									returnData ({data});
									}
								});
							});
						return (true); 
					case "/getfilelist": 
						callWithScreenname (function (screenname) {
							getFileList (screenname, flprivate, httpReturn);
							});
						return (true); 
					}
				break;
			}
		return (false);
		}
	function http404Callback (theRequest) {
		if (config.flStorageEnabled) {
			if (checkPathForIllegalChars (theRequest.path)) {
				function return404 () {
					theRequest.httpReturn (404, "text/plain", "Not found.");
					}
				function returnPlainText (s) {
					theRequest.httpReturn (200, "text/plain", s.toString ());
					}
				var path = utils.stringDelete (theRequest.path, 1, 1); //delete leading slash
				var screenname = utils.stringNthField (path, "/", 1);
				var relpath = utils.stringDelete (path, 1, screenname.length + 1);
				var flprivate = false;
				getFile (screenname, relpath, flprivate, function (err, data) {
					if (err) {
						return404 ();
						}
					else {
						returnPlainText (data.filedata);
						}
					});
				}
			else {
				return404 ();
				}
			return (true); //tell davetwitter we handled it
			}
		else {
			return (false); //tell davetwitter we didn't handle it
			}
		}
	function everyMinute () {
		var now = new Date ();
		if (config.everyMinute !== undefined) {
			config.everyMinute ();
			}
		if (now.getMinutes () == 0) {
			console.log ("\n" + now.toLocaleTimeString () + ": " + config.productName + " v" + config.version + " running on port " + config.port + ".\n");
			}
		}
	function everySecond () {
		if (flStatsChanged) {
			stats.ctWrites++;
			flStatsChanged = false;
			fs.writeFile (fnameStats, utils.jsonStringify (stats), function () {
				});
			}
		if (config.everySecond !== undefined) {
			config.everySecond ();
			}
		}
	
	utils.copyScalars (options, config); //1/22/21 by DW
	readConfig (fnameConfig, config, true, function () { //anything can be overridden by config.json
		readConfig (fnameStats, stats, false, function () {
			if (process.env.PORT !== undefined) { //8/6/20 by DW
				config.port = process.env.PORT;
				}
			stats.ctStarts++;
			stats.ctHitsThisRun = 0;
			stats.whenLastStart = whenStart;
			statsChanged ();
			console.log ("\n" + config.productName + " v" + config.version + " running on port " + config.port + ".\n");
			console.log ("config == " + utils.jsonStringify (config)); 
			startDavetwitter (handleHttpRequest);
			if (config.myDomain === undefined) {
				console.log ("startup: can't start the server because config.myDomain is not defined.");
				}
			else {
				config.urlServerForClient = "http://" + config.myDomain + "/";
				config.urlWebsocketServerForClient = "ws://" + utils.stringNthField (config.myDomain, ":", 1) + ":" + config.websocketPort + "/";
				webSocketStartup (); 
				setInterval (everySecond, 1000); 
				utils.runEveryMinute (everyMinute); 
				if (callback !== undefined) {
					callback (config);
					}
				}
			});
		});
	}
