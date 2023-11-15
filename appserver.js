var myVersion = "0.7.12", myProductName = "daveAppServer";   

exports.start = startup; 
exports.notifySocketSubscribers = notifySocketSubscribers;
exports.saveStats = saveStats;
exports.getStats = getStats; //6/28/21 by DW
exports.getConfig = getConfig;
exports.publishFile = publishFile; //12/13/21 by DW
exports.readWholeFile = readWholeFile; //5/28/22 by DW
exports.writeWholeFile = writeWholeFile; //5/28/22 by DW
exports.getFilePath = getFilePath; //9/13/22 by DW

const fs = require ("fs");
var dns = require ("dns");
var os = require ("os");
const request = require ("request");
const websocket = require ("nodejs-websocket"); 
const utils = require ("daveutils");
const davehttp = require ("davehttp");
const davetwitter = require ("davetwitter");
const filesystem = require ("davefilesystem"); 
const folderToJson = require ("foldertojson");
const zip = require ("davezip");
const s3 = require ("daves3"); 
const qs = require ("querystring");
const mail = require ("davemail");
const requireFromString = require ("require-from-string"); //2/10/23 by DW
const davesql = require ("davesql"); //8/14/23 by DW
const wordpress = require ("wpidentity"); //9/10/23 by DW

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
	flEnableLogin: true, //user can log in via twitter
	blockedAddresses: [], 
	flForceTwitterLogin: true,
	flUseTwitterIdentity: false, //2/6/23 by DW
	flTraceOnError: false, //8/15/23 by DW
	
	flStorageEnabled: true,
	privateFilesPath: "privateFiles/users/",
	publicFilesPath: "publicFiles/users/",
	
	defaultContentType: "text/plain", //8/3/21 by DW
	
	userAgent: myProductName + " v" + myVersion, //11/8/21 by DW
	
	whitelist: undefined, //7/21/22 by DW
	
	confirmEmailSubject: "FeedLand confirmation", //12/7/22 by DW
	fnameEmailTemplate: "emailtemplate.html",
	operationToConfirm: "add your email address to your FeedLand user profile",
	mailSender: "dave@scripting.com",
	dataFolder: "data/",
	confirmationExpiresAfter: 60 * 60 * 24, //emails expire after 24 hours
	
	flSecureWebsocket: false, //2/8/23 by DW
	
	flUseS3ForStorage: false, //2/15/23 by DW
	
	flUseDatabaseForConfirmations: false, //8/14/23 by DW
	
	flAllowWordpressIdentity: true, //10/31/23 by DW
	
	flEnableSupervisorMode: true, //11/3/23 by DW
	
	findUserWithScreenname: function (screenname, callback) { //2/6/23 by DW
		callback (false);
		},
	findUserWithEmail: function (emailaddress, callback) { //11/4/23 by DW
		callback (false);
		},
	getScreenNameFromEmail: function (screenname, callback) { //2/7/23 by DW
		callback (undefined, screenname);
		},
	
	isUserAdmin: function (emailaddress, callback) { //11/3/23 by DW
		callback (false);
		}
	};
const fnameConfig = "config.json";

var stats = {
	whenFirstStart: whenStart, ctStarts: 0,
	whenLastStart: undefined,
	ctWrites: 0,
	ctHits: 0, ctHitsToday: 0, ctHitsThisRun:0, 
	whenLastHit: new Date (0),
	pendingConfirmations: new Array () //12/7/22 by DW
	};
const fnameStats = "stats.json";

function userIsWhitelisted (screenname, callback) { //9/16/22 by DW
	fs.readFile (fnameConfig, function (err, jsontext) {
		var flWhitelisted = false; 
		if (!err) {
			var jstruct;
			try {
				jstruct = JSON.parse (jsontext);
				if (jstruct.whitelist === undefined) { //no whitelist
					flWhitelisted = true;
					}
				else {
					flWhitelisted = jstruct.whitelist.includes (screenname);
					}
				}
			catch (err) {
				}
			}
		console.log ("userIsWhitelisted: screenname == " + screenname + ", flWhitelisted == " + flWhitelisted);
		callback (undefined, {flWhitelisted});
		});
	}
function statsChanged () {
	flStatsChanged = true;
	}
function saveStats (theStats) {
	for (var x in theStats) {
		stats [x] = theStats [x];
		}
	statsChanged ();
	}
function getStats () { //6/28/21 by DW
	return (stats);
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
function httpFullRequest (jsontext, callback) { //11/5/21 by DW
	var theRequest;
	function isErrorStatusCode (theCode) { //11/8/21 by DW
		return ((theCode < 200) || (theCode > 299));
		}
	try {
		theRequest = JSON.parse (jsontext);
		}
	catch (err) {
		callback (err);
		return;
		}
	request (theRequest, function (err, response, data) {
		if (err) {
			callback (err);
			}
		else {
			if (isErrorStatusCode (response.statusCode)) { //11/8/21 by DW
				const errstruct = {
					message: "Can't read the URL, \"" + theRequest.url + "\" because we received a status code of " + response.statusCode + ".",
					statusCode: response.statusCode,
					data //11/8/21 by DW
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
			case "/": case "_": case "-": case ".":  case " ": case "*": case "@":
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
		try { //7/27/23 by DW
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
		catch (err) {
			if (callback !== undefined) {
				callback (name);
				}
			}
		}
	}
function getDomainNameVerb (clientIp, callback) { //2/27/21 by DW
	dns.reverse (clientIp, function (err, domains) {
		if (err) {
			callback (err);
			}
		else {
			var name = (domains.length > 0) ? name = domains [0] : clientIp;
			callback (undefined, {name});
			}
		});
	}
function getDottedIdVerb (name, callback) { //2/27/21 by DW
	dns.lookup (name, null, function (err, dottedid) {
		if (err) {
			callback (err);
			}
		else {
			callback (undefined, {dottedid});
			}
		});
	}
function cleanFileStats (stats) { //4/19/21 by DW
	function formatDate (d) {
		return (new Date (d).toUTCString ());
		}
	var cleanStats = {
		size: stats.size, //number of bytes in file
		whenAccessed: formatDate (stats.atime), //when last read
		whenCreated: formatDate (stats.birthtime),
		whenModified: formatDate (stats.mtime),
		flPrivate: stats.flPrivate
		}
	return (cleanStats);
	}

//sockets
	var theWsServer = undefined;
	
	function getWsProtocol () { //2/8/23 by DW
		const protocol = (utils.getBoolean (config.flSecureWebsocket)) ? "wss://" : "ws://";
		return (protocol);
		}
	function notifySocketSubscribers (verb, payload, flPayloadIsString, callbackToQualify) {
		if (theWsServer !== undefined) {
			var ctUpdates = 0, now = new Date (), ctTotalSockets = 0;
			if (payload !== undefined) { 
				if (!flPayloadIsString) {
					payload = utils.jsonStringify (payload);
					}
				}
			theWsServer.connections.forEach (function (conn, ix) {
				ctTotalSockets++;
				if (conn.appData !== undefined) { //it's one of ours
					var flnotify = true;
					if (callbackToQualify !== undefined) {
						flnotify = callbackToQualify (conn);
						}
					if (flnotify) {
						try {
							conn.sendText (verb + "\r" + payload);
							conn.appData.whenLastUpdate = now;
							conn.appData.ctUpdates++;
							ctUpdates++;
							}
						catch (err) {
							console.log ("notifySocketSubscribers: socket #" + i + ": error updating");
							}
						}
					}
				});
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
		
		function kissOtherLogonsGoodnight (screenname, theNewConnection) { //12/14/21 by DW
			theWsServer.connections.forEach (function (conn, ix) {
				if (conn.appData !== undefined) { //it's one of ours
					if (conn != theNewConnection) { //it's not the new one
						if (conn.appData.screenname == screenname) {
							console.log ("kissOtherLogonsGoodnight: \"" + conn.appData.screenname + "\" = \"" + screenname + "\""); //2/12/23 by DW
							conn.sendText ("goodnight");
							}
						}
					}
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
					case "user": //9/29/21 by DW
						if (config.flUseTwitterIdentity) { //2/12/23 by DW
							var token = words [1], secret = words [2];
							conn.appData.twOauthToken = token;
							conn.appData.twOauthTokenSecret = secret;
							conn.appData.urlToWatch = "";
							davetwitter.getScreenName (token, secret, function (screenname) {
								conn.appData.screenname = screenname;
								kissOtherLogonsGoodnight (screenname, conn); //12/14/21 by DW
								logToConsole (conn, conn.appData.lastVerb, conn.appData.screenname);
								});
							}
						else {
							var emailAddress = words [1], emailSecret = words [2];
							config.findUserWithEmail (emailAddress, function (flInDatabase, userRec) {
								if (flInDatabase) {
									conn.appData.emailAddress = userRec.emailAddress;
									conn.appData.screenname = userRec.emailAddress;
									conn.appData.emailSecret = userRec.emailSecret;
									conn.appData.urlToWatch = "";
									kissOtherLogonsGoodnight (conn.appData.screenname, conn); 
									logToConsole (conn, conn.appData.lastVerb, conn.appData.screenname);
									}
								});
							}
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
//s3 storage -- 2/14/23 by DW
	
	function getS3FilePath (screenname, relpath, flprivate) {
		const folder = (flprivate) ? config.privateFilesPath : config.publicFilesPath;
		const f = folder + screenname + "/" + relpath;
		const s3path = config.s3PathForStorage + f;
		return (s3path);
		}
	
	function getFileFromS3 (screenname, relpath, flprivate, callback) {
		function formatDate (d) {
			return (new Date (d).toUTCString ());
			}
		s3.getObject (getS3FilePath (screenname, relpath, flprivate), function (err, data) {
			if (err) {
				callback (err);
				}
			else {
				var data = {
					filedata: data.Body.toString (),
					filestats: {
						whenModified: formatDate (data.LastModified)
						}
					};
				callback (undefined, data);
				}
			});
		}
	function saveFileToS3 (screenname, relpath, type, flprivate, filetext, callback) {
		const acl = undefined; //use the default
		s3.newObject (getS3FilePath (screenname, relpath, flprivate), filetext, type, acl, callback);
		}
//storage functions
	function getFilePath (screenname, relpath, flprivate) {
		const folder = (flprivate) ? config.privateFilesPath : config.publicFilesPath;
		const f = folder + screenname + "/" + relpath;
		return (f);
		}
	function findFile (screenname, relpath, callback) { //4/1/21 by DW
		var f = getFilePath (screenname, relpath, false); //public version
		fs.stat (f, function (err, stats) {
			if (err) {
				f = getFilePath (screenname, relpath, true); //private version
				fs.stat (f, function (err, stats) {
					if (err) {
						callback (err);
						}
					else {
						stats.flPrivate = true;
						callback (undefined, stats);
						}
					});
				}
			else {
				stats.flPrivate = false;
				callback (undefined, stats);
				}
			});
		}
	function publishFile (screenname, relpath, type, flprivate, filetext, callback) {
		if (config.publishStaticFile !== undefined) { //9/20/23 by DW
			config.publishStaticFile (screenname, relpath, type, flprivate, filetext, callback);
			}
		else {
			if (config.flStorageEnabled) {
				if (config.flUseS3ForStorage) { 
					saveFileToS3 (screenname, relpath, type, flprivate, filetext, callback);
					}
				else {
					var f = getFilePath (screenname, relpath, flprivate);
					utils.sureFilePath (f, function () {
						var now = new Date ();
						fs.writeFile (f, filetext, function (err) {
							if (err) {
								callback (err);
								}
							else {
								var url = (flprivate) ? undefined : config.urlServerForClient + screenname + "/" + relpath;
								if (config.publishFile !== undefined) { //3/18/22 by DW
									config.publishFile (f, screenname, relpath, type, flprivate, filetext, url);
									}
								if (!flprivate) {
									notifySocketSubscribers ("update", filetext, true, function (conn) { //3/6/2 by DW -- payload is a string
										if (conn.appData.urlToWatch == url) {
											return (true);
											}
										else {
											return (false);
											}
										});
									}
								callback (undefined, {
									url,
									whenLastUpdate: now
									});
								}
							});
						});
					}
				}
			else {
				callback ({message: "Can't publish the file because the feature is not enabled on the server."});
				}
			}
		}
	function getFile (screenname, relpath, flprivate, callback) {
		function errcallback (err) {
			if (err.code == "ENOENT") {
				err.status = 500;
				err.code = "NoSuchKey";
				}
			callback (err);
			}
		function getFromStaticFIlesystem () {
			if (config.flStorageEnabled) {
				if (config.flUseS3ForStorage) {
					getFileFromS3 (screenname, relpath, flprivate, callback);
					}
				else {
					var f = getFilePath (screenname, relpath, flprivate);
					fs.readFile (f, function (err, filetext) {
						if (err) {
							errcallback (err);
							}
						else {
							fs.stat (f, function (err, stats) {
								if (err) {
									errcallback (err);
									}
								else {
									var data = {
										filedata: filetext.toString (),
										filestats: cleanFileStats (stats)
										};
									callback (undefined, data);
									}
								});
							}
						});
					}
				}
			else {
				callback ({message: "Can't get the file because the feature is not enabled on the server."});
				}
			}
		if (config.getStaticFile !== undefined) { //9/20/23 by DW
			config.getStaticFile (screenname, relpath, flprivate, function (err, data) {
				if (err) {
					getFromStaticFIlesystem ();
					}
				else {
					callback (undefined, data);
					}
				});
			}
		else {
			getFromStaticFIlesystem ();
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
			if (callback != undefined) {
				callback (undefined, returnedList);
				}
			});
		}
	
	function getPublicFileUrl (screenname, relpath) { //12/4/21 by DW
		var urlpublic = config.urlServerForClient + screenname + "/" + relpath;
		return (urlpublic);
		}
	
	function makeFilePublic (screenname, relpath, callback) { //2/20/21 by DW
		console.log ("makeFilePublic: relpath == " + relpath);
		getFile (screenname, relpath, false, function (err, data) {
			var urlpublic = config.urlServerForClient + screenname + "/" + relpath;
			if (err) { //public file doesn't exist, read the private file
				getFile (screenname, relpath, true, function (err, filetext) {
					if (err) { //file not there, can't make the file public
						var message = "Can't make the file public because we can't read the private file.";
						console.log ("makeFilePublic: err.message == " + err.message);
						callback ({message});
						}
					else {
						publishFile (screenname, relpath, "text/plain", false, filetext, function (err, data) {
							if (err) {
								var message = "Can't make the file public because we can't write the new file.";
								callback ({message});
								}
							else {
								callback (undefined, {url: urlpublic});
								}
							});
						}
					});
				}
			else { //it exists, return the public url of the file
				callback (undefined, {url: urlpublic});
				}
			});
		}
	function getFileHierarchy (screenname, callback) { //2/21/21 by DW
		folderToJson.getObject (config.privateFilesPath + screenname + "/", function (err, privateSubs) {
			if (err) {
				callback (err);
				}
			else {
				folderToJson.getObject (config.publicFilesPath + screenname + "/", function (err, publicSubs) {
					function legitError (err) {
						if (err) {
							if (err.code == "ENOENT") {
								publicSubs = new Object ();
								return (false);
								}
							else {
								return (true);
								}
							}
						else {
							return (false);
							}
						}
					if (legitError (err)) {
						callback (err);
						}
					else {
						var theHierarchy = {
							publicFiles: {
								subs: publicSubs
								},
							privateFiles: {
								subs: privateSubs
								}
							};
						callback (undefined, theHierarchy);
						}
					});
				}
			});
		}
	function deleteFile (screenname, relpath, callback) { //2/23/21 by DW
		if (config.flStorageEnabled) {
			function deleteone (flprivate, callback) {
				var f = getFilePath (screenname, relpath, flprivate);
				fs.unlink (f, callback);
				}
			deleteone (true, function (errPrivate) {
				deleteone (false, function (errPublic) {
					if (errPrivate && errPublic) {
						callback ({message: "Can't delete the file because it doesn't exist."});
						}
					else {
						callback (undefined);
						}
					});
				});
			}
		else {
			callback ({message: "Can't delete the file because the feature is not enabled on the server."});
			}
		}
	function fileExists (screenname, relpath, callback) { //5/29/21 by DW
		readWholeFile (screenname, relpath, function (err, data) {
			var flExists = err === undefined;
			callback (undefined, {flExists});
			});
		}
	function readWholeFile (screenname, relpath, callback) { //2/24/21 by DW
		if (config.flStorageEnabled) {
			function readone (flprivate, callback) {
				var f = getFilePath (screenname, relpath, flprivate);
				fs.readFile (f, function (err, filetext) {
					if (err) {
						callback (err);
						}
					else {
						filetext = filetext.toString (); //it's a buffer
						callback (undefined, {filetext});
						}
					});
				}
			readone (false, function (err, fileinfo) { //look for public version first
				if (err) {
					readone (true, function (err, fileinfo) { //look for private version
						if (err) {
							callback ({message: "Can't read the file because it doesn't exist."});
							}
						else {
							callback (undefined, fileinfo);
							}
						});
					}
				else {
					callback (undefined, fileinfo);
					}
				});
			}
		else {
			callback ({message: "Can't read the file because the feature is not enabled on the server."});
			}
		}
	function storageMustBeEnabled (namefunction, httpReturn, callback) {
		if (config.flStorageEnabled) {
			callback ();
			}
		else {
			httpReturn ({message: "Can't " + namefunction + " the file because the feature is not enabled on the server."});
			}
		}
	function writeWholeFile (screenname, relpath, filetext, callback) {
		storageMustBeEnabled ("write", callback, function () {
			function readone (flprivate, callback) {
				var f = getFilePath (screenname, relpath, flprivate);
				fs.readFile (f, function (err, filetext) {
					if (err) {
						callback (err);
						}
					else {
						filetext = filetext.toString (); //it's a buffer
						callback (undefined, {filetext});
						}
					});
				}
			function writethefile (flprivate) {
				var f = getFilePath (screenname, relpath, flprivate);
				utils.sureFilePath (f, function () { //9/15/21 by DW
					fs.writeFile (f, filetext, function (err) {
						if (err) {
							callback (err);
							}
						else {
							if (config.publishFile !== undefined) { //3/18/22 by DW
								const url = (flprivate) ? undefined : config.urlServerForClient + screenname + "/" + relpath;
								const type = utils.httpExt2MIME (utils.stringLastField (f, ".")); //7/3/22 by DW
								config.publishFile (f, screenname, relpath, type, flprivate, filetext, url);
								}
							callback (undefined);
							}
						});
					});
				}
			readone (false, function (err, data) {
				if (err) { //write a private file
					writethefile (true);
					}
				else { //public version exists
					writethefile (false);
					}
				});
			});
		}
	function getPublicUrl (screenname, relpath) { //8/24/21 by DW
		return (config.urlServerForClient + screenname + "/" + relpath);
		}
	function getFileInfo (screenname, relpath, callback) { //4/1/21 by DW
		if (config.flStorageEnabled) {
			findFile (screenname, relpath, function (err, stats) {
				if (err) {
					callback (err);
					}
				else {
					function formatDate (d) {
						return (new Date (d).toUTCString ());
						}
					callback (undefined, {
						size: stats.size, //number of bytes in file
						whenAccessed: formatDate (stats.atime), //when last red
						whenCreated: formatDate (stats.birthtime),
						whenModified: formatDate (stats.mtime),
						flPrivate: stats.flPrivate,
						urlPublic: (stats.flPrivate) ? undefined : getPublicUrl (screenname, relpath) //8/24/21 by DW
						});
					}
				});
			}
		else {
			callback ({message: "Can't read the file because the feature is not enabled on the server."});
			}
		}
	function getUserData (screenname, callback) { //4/14/20 by DW
		storageMustBeEnabled ("get user data", callback, function () {
			const tmpfolder = "tmp/", archivefile = tmpfolder + screenname + ".zip"; 
			utils.sureFilePath (archivefile, function () {
				var theArchive = zip.createArchive (archivefile, function (err, data) {
					if (callback !== undefined) {
						callback (err, archivefile);
						}
					});
				var pathPublicFiles = getFilePath (screenname, "", false);
				var pathPrivateFiles = getFilePath (screenname, "", true);
				theArchive.addDirectoryToArchive (pathPublicFiles, "Public Files");
				theArchive.addDirectoryToArchive (pathPrivateFiles, "Private Files");
				theArchive.finalize ();
				});
			});
		}
//github -- 11/8/21 by DW
	function handleGithubOauthCallback (theCode, callback) { //11/8/21 by DW
		var params = {
			client_id: config.githubClientId,
			client_secret: config.githubClientSecret,
			code: theCode
			};
		var apiUrl = "https://github.com/login/oauth/access_token?" + utils.buildParamList (params);
		var githubRequest = {
			method: "POST",
			url: apiUrl
			};
		console.log ("handleGithubOauthCallback: githubRequest === " + utils.jsonStringify (githubRequest));
		request (githubRequest, function (err, response, body) {
			if (err) {
				console.log ("handleGithubOauthCallback: err.message == " + err.message);
				callback (err);
				}
			else {
				var postbody = qs.parse (body);
				var urlRedirect = "/?githubaccesstoken=" + postbody.access_token;
				console.log ("handleGithubOauthCallback: urlRedirect = " + urlRedirect);
				callback (undefined, urlRedirect);
				}
			});
		}
	function downloadFromGithub (username, repository, path, accessToken, callback) { //calls back with the JSON structure GitHub returns
		if (!utils.beginsWith (path, "/")) {
			path = "/" + path;
			}
		var url = "https://api.github.com/repos/" + username + "/" + repository + "/contents" + path;
		var theRequest = {
			url: url,
			jar: true, //"remember cookies for future use"
			maxRedirects: 5,
			headers: {
				"User-Agent": config.userAgent,
				"Authorization": "token " + accessToken
				}
			};
		request (theRequest, function (err, response, jsontext) {
			if (err) {
				callback (err);
				}
			else {
				if (response.statusCode == 404) {
					callback ({message: "The file \"" + path + "\" was not found."});
					}
				else {
					if (response.headers ["x-ratelimit-remaining"] == 0) {
						var theLimit = response.headers ["x-ratelimit-limit"];
						callback ({"message": "GitHub reported a rate limit error. You are limited to " + theLimit + " calls per hour."});
						}
					else {
						try {
							var jstruct = JSON.parse (jsontext);
							callback (undefined, jstruct);
							}
						catch (err) {
							callback (err);
							}
						}
					}
				}
			});
		}
	function uploadToGithub (jsontext, data, callback) {
		var options;
		try {
			options = JSON.parse (jsontext);
			}
		catch (err) {
			callback (err);
			return;
			}
		options.data = data;
		if (options.userAgent === undefined) {
			options.userAgent = config.userAgent;
			}
		if (options.type === undefined) {
			options.type = utils.httpExt2MIME (options.path);
			}
		if (options.message === undefined) {
			options.message = utils.getRandomSnarkySlogan ();
			}
		
		var bodyStruct = { 
			message: options.message,
			committer: options.committer,
			content: Buffer.from (options.data).toString ("base64")
			};
		downloadFromGithub (options.username, options.repository, options.path, options.accessToken, function (err, jstruct) {
			if (jstruct !== undefined) {
				bodyStruct.sha = jstruct.sha;
				}
			var url = "https://api.github.com/repos/" + options.username + "/" + options.repository + "/contents/" + options.path;
			var theRequest = {
				method: "PUT",
				url,
				body: JSON.stringify (bodyStruct),
				headers: {
					"User-Agent": options.userAgent,
					"Authorization": "token " + options.accessToken,
					"Content-Type": options.type
					}
				};
			request (theRequest, function (err, response, body) { 
				if (err) {
					callback (err);
					}
				else {
					var rateLimitMessage;
					if (response.headers ["x-ratelimit-remaining"] == 0) {
						var theLimit = response.headers ["x-ratelimit-limit"];
						rateLimitMessage = "GitHub reported a rate limit error. You are limited to " + theLimit + " calls per hour.";
						}
					var returnedStruct = JSON.parse (body);
					returnedStruct.statusCode = response.statusCode;
					returnedStruct.rateLimitMessage = rateLimitMessage;
					callback (undefined, returnedStruct);
					}
				});
			});
		}
	function getGithubDirectory (username, repository, path, accessToken, callback) {
		function loadDirectory (theArray, parentpath, callback) {
			function nextFile (ix) {
				if (ix < theArray.length) {
					var item = theArray [ix];
					if (item.type == "dir") {
						getGithubDirectory (username, repository, item.path, accessToken, function (err, jstruct) {
							if (jstruct !== undefined) { //no error
								item.subs = jstruct;
								}
							nextFile (ix + 1);
							});
						}
					else {
						nextFile (ix + 1);
						}
					}
				else {
					callback ();
					}
				}
			nextFile (0);
			}
		if (utils.beginsWith (path, "/")) {
			path = utils.stringDelete (path, 1, 1);
			}
		var theRequest = {
			method: "GET",
			url: "https://api.github.com/repos/" + username + "/" + repository + "/contents/" + path,
			headers: {
				"User-Agent": config.userAgent,
				"Authorization": "token " + accessToken,
				}
			};
		request (theRequest, function (err, response, body) { 
			if (err) {
				callback (err);
				}
			else {
				try {
					var jstruct = JSON.parse (body);
					if (Array.isArray (jstruct)) { //it's a directory
						loadDirectory (jstruct, path, function () {
							callback (undefined, jstruct);
							});
						}
					else {
						callback (undefined, jstruct);
						}
					}
				catch (err) {
					if (callback !== undefined) {
						callback (err);
						}
					}
				}
			});
		}
	function getGithubUserInfo (username, accessToken, callback) {
		var url = "https://api.github.com/user";
		if (username !== undefined) {
			url += "s/" + username
			}
		var theRequest = {
			method: "GET",
			url,
			headers: {
				"User-Agent": config.userAgent,
				"Authorization": "token " + accessToken
				}
			};
		request (theRequest, function (err, response, body) { 
			if (err) {
				callback (err);
				}
			else {
				try {
					var jstruct = JSON.parse (body);
					callback (undefined, jstruct);
					}
				catch (err) {
					callback (err);
					}
				}
			});
		}
//email registration -- 12/7/22 by DW
	function addPendingConfirmation (theConfirmation, callback) { //8/14/23 by DW
		if (config.flUseDatabaseForConfirmations) {
			theConfirmation.whenCreated = theConfirmation.when;
			delete theConfirmation.when;
			
			var sqltext = "replace into pendingConfirmations " + davesql.encodeValues (theConfirmation);
			davesql.runSqltext (sqltext, function (err, result) {
				if (err) {
					callback (err);
					}
				else {
					console.log ("addPendingConfirmation: email == " + theConfirmation.email);
					callback (undefined);
					}
				});
			}
		else {
			stats.pendingConfirmations.push (theConfirmation);
			statsChanged ();
			callback (undefined); //no error
			}
		}
	function findPendingConfirmation (magicString, callback) { //8/14/23 by DW
		if (config.flUseDatabaseForConfirmations) {
			var sqltext = "select * from pendingConfirmations where magicString=" + davesql.encode (magicString) + ";";
			davesql.runSqltext (sqltext, function (err, result) {
				if (err) {
					console.log ("findPendingConfirmation: err.message == " + err.message);
					callback (err);
					}
				else {
					if (result.length == 0) {
						const message = "Can't find the pending confirmation.";
						callback ({message});
						}
					else {
						var theConfirmation = result [0];
						if (theConfirmation.urlRedirect == null) {
							theConfirmation.urlRedirect = undefined;
							}
						callback (undefined, theConfirmation);
						}
					}
				});
			}
		else {
			var flFoundConfirm = false;
			stats.pendingConfirmations.forEach (function (item) {
				if (item.magicString == magicString) {
					callback (undefined, item);
					flFoundConfirm = true;
					}
				});
			if (!flFoundConfirm) {
				const message = "Can't find the pending confirmation.";
				callback ({message});
				}
			}
		}
	function deletePendingConfirmation (item, callback) { //8/14/23 by DW
		if (config.flUseDatabaseForConfirmations) {
			const sqltext = "delete from pendingConfirmations where magicString = " + davesql.encode (item.magicString) + ";"; //8/15/23 by DW
			davesql.runSqltext (sqltext, function (err, result) {
				if (err) {
					if (callback !== undefined) {
						callback (err);
						}
					}
				else {
					if (callback !== undefined) {
						callback (undefined);
						}
					}
				});
			}
		else {
			item.flDeleted = true; 
			}
		}
	function checkPendingConfirmations (callback) { //8/14/23 by DW
		if (config.flUseDatabaseForConfirmations) {
			const sqltext = "delete from pendingConfirmations where whenCreated < now() - interval " + config.confirmationExpiresAfter + " minute;";
			davesql.runSqltext (sqltext, function (err, result) {
				if (err) {
					if (callback !== undefined) {
						callback (err);
						}
					}
				else {
					if (callback !== undefined) {
						callback (undefined);
						}
					}
				});
			}
		else {
			var flChanged = false;
			var newArray = new Array ();
			stats.pendingConfirmations.forEach (function (item) {
				if ((!item.flDeleted) && (utils.secondsSince (item.when) < config.confirmationExpiresAfter)) {
					newArray.push (item);
					}
				else {
					flChanged = true;
					}
				});
			if (flChanged) {
				stats.pendingConfirmations = newArray;
				statsChanged ();
				}
			}
		}
	
	function sendConfirmingEmail (email, screenname, flNewUser=false, urlRedirect, callback) {
		email = utils.stringLower (email); //3/8/23 by DW
		function getScreenname (callback) {
			function containsIllegalCharacter (name) { //3/17/23 by DW
				function isLegal (ch) {
					return (utils.isAlpha (ch) || utils.isNumeric (ch) || (ch == "_") || (ch == ".") || (ch == "@"));
					}
				for (var i = 0; i < name.length; i++) {
					let ch = name [i];
					if (!isLegal (ch)) {
						return (true);
						}
					}
				return (false);
				}
			if (flNewUser) { //the caller had to provide it
				if (containsIllegalCharacter (screenname)) { //3/17/23 by DW
					const message = "Can't create the user \"" + screenname + "\" because only alpha, numeric and underscore characters are allowed in names."
					callback ({message});
					}
				else {
					config.findUserWithScreenname (screenname, function (flInDatabase) {
						if (flInDatabase) {
							const message = "Can't create the user \"" + screenname + "\" because there already is a user with that name."
							callback ({message});
							}
						else {
							callback (undefined, screenname);
							}
						});
					}
				}
			else { //we have to look it up
				config.getScreenNameFromEmail (email, callback);
				}
			}
		getScreenname (function (err, screenname) {
			if (err) {
				callback (err);
				}
			else {
				const magicString = utils.getRandomPassword (10);
				const urlWebApp = config.urlServerForEmail; //2/6/23 by DW
				console.log ("sendConfirmingEmail: email == " + email + ", urlWebApp == " + urlWebApp);
				var obj = {
					magicString: magicString,
					email: email,
					flDeleted: false,
					screenname,
					flNewUser, //1/7/23 by DW
					urlRedirect, //3/3/23 by DW
					when: new Date ()
					};
				addPendingConfirmation (obj, function (err) { //8/14/23 by DW
					if (err) {
						callback (err);
						}
					else {
						console.log ("sendConfirmingEmail: obj == " + utils.jsonStringify (obj));
						var params = {
							title: config.confirmEmailSubject,
							operationToConfirm: config.operationToConfirm,
							confirmationUrl: urlWebApp + "userconfirms?emailConfirmCode=" + encodeURIComponent (magicString)
							};
						fs.readFile (config.fnameEmailTemplate, function (err, emailTemplate) {
							if (err) {
								const message = "Error reading email template.";
								console.log ("sendConfirmingEmail: err.message == " + err.message);
								callback ({message});
								}
							else {
								var mailtext = utils.multipleReplaceAll (emailTemplate.toString (), params, false, "[%", "%]");
								mail.send (email, params.title, mailtext, config.mailSender, function (err, data) {
									if (err) {
										callback (err);
										}
									else {
										callback (undefined, {message: "Please check your email."});
										}
									});
								const f = config.dataFolder + "lastmail.html";
								utils.sureFilePath (f, function () {
									fs.writeFile (f, mailtext, function (err) {
										});
									});
								}
							});
						}
					});
				}
			});
		}
	function receiveConfirmation (emailConfirmCode, callback) {
		var urlWebApp = config.urlServerForClient; //2/5/23 by DW
		var urlRedirect = undefined, flFoundConfirm = false;
		function encode (s) {
			return (encodeURIComponent (s));
			}
		
		findPendingConfirmation (emailConfirmCode, function (err, item) {
			if (err) {
				if (urlRedirect === undefined) {
					urlRedirect = urlWebApp;
					}
				callback (urlRedirect + "?failedLogin=true&message=" + encode (err.message));
				}
			else {
				if (config.addEmailToUserInDatabase !== undefined) { 
					if (item.urlRedirect !== undefined) { //3/3/23 by DW
						urlWebApp = item.urlRedirect;
						}
					config.addEmailToUserInDatabase (item.screenname, item.email, item.magicString, item.flNewUser, function (err, emailSecret) {
						if (err) {
							urlRedirect = urlWebApp + "?failedLogin=true&message=" + encode (err.message); 
							}
						else {
							urlRedirect = urlWebApp + "?emailconfirmed=true&email=" + encode (item.email) + "&code=" + encode (emailSecret) + "&screenname=" + encode (item.screenname);
							deletePendingConfirmation (item);
							}
						callback (urlRedirect);
						});
					}
				}
			});
		}
//wordpress -- 10/31/23 by DW
	function wordpressHandleRequest (theRequest) {
		function encode (s) {
			return (encodeURIComponent (s));
			}
		function returnRedirect (url, code=302) {
			var headers = {
				location: url
				};
			theRequest.httpReturn (code, "text/plain", code + " REDIRECT", headers);
			}
		function useWordpressAccount (accessToken, theUserInfo) {
			console.log ("useWordpressAccount: accessToken == " + accessToken);
			console.log ("useWordpressAccount: theUserInfo == " + utils.jsonStringify (theUserInfo));
			config.loginWordpressUser (accessToken, theUserInfo, function (err, userRec) {
				if (err) {
					returnRedirect (config.urlServerForClient + "?failedLogin=true&message=" + encode (err.message)); 
					}
				else {
					returnRedirect (config.urlServerForClient + "?emailconfirmed=true&email=" + encode (userRec.emailAddress) + "&code=" + encode (userRec.emailSecret) + "&screenname=" + encode (userRec.screenname));
					}
				});
			}
		function createPendingConfirmation (callback) { //11/14/23 by DW
			const obj = {
				magicString: utils.getRandomPassword (10),
				flDeleted: false,
				when: new Date ()
				};
			addPendingConfirmation (obj, function (err) { 
				if (err) {
					callback (err);
					}
				else {
					callback (undefined, obj);
					}
				});
			}
		function checkPendingConfirmation (confirmCode, callback) { //11/14/23 by DW
			findPendingConfirmation (confirmCode, function (err, item) {
				deletePendingConfirmation (item);
				callback (err); //return success or failure
				});
			}
		
		var options = undefined;
		if (config.flAllowWordpressIdentity) {
			options = {
				useWordpressAccount
				};
			if (config.flUseDatabaseForConfirmations) { //11/14/23 by DW
				options.createPendingConfirmation = createPendingConfirmation;
				options.checkPendingConfirmation = checkPendingConfirmation;
				}
			}
		
		const flHandled = wordpress.handleHttpRequest (theRequest, options);
		return (flHandled);
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
	function readConfigJson (callback) { //2/8/23 by DW
		fs.readFile ("config.js", function (err, scripttext) {
			var flReadConfigJson = true;
			if (!err) {
				try {
					scripttext = scripttext.toString ();
					var jstruct = requireFromString (scripttext);
					for (var x in jstruct) {
						config [x] = jstruct [x];
						}
					flReadConfigJson = false;
					callback ();
					}
				catch (err) {
					console.log (err.message);
					}
				}
			if (flReadConfigJson) {
				readConfig (fnameConfig, config, true, callback);
				}
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
		config.twitter.flTraceOnError = config.flTraceOnError; //8/15/23 by DW
		config.twitter.blockedAddresses = config.blockedAddresses;
		config.twitter.httpRequestCallback = httpRequestCallback;
		config.twitter.http404Callback = http404Callback; //1/24/21 by DW
		config.twitter.twitterConsumerKey = config.twitterConsumerKey;
		config.twitter.twitterConsumerSecret = config.twitterConsumerSecret;
		config.twitter.userLogonCallback = userLogonCallback; //8/14/22 by DW
		if (config.urlFavicon !== undefined) { //1/26/23 by DW
			config.twitter.urlFavicon = config.urlFavicon;
			}
		davetwitter.start (config.twitter);
		}
	function startDavemail () { //1/23/23 by DW
		var options;
		if (config.smtpHost === undefined) {
			options = {
				flUseSes: true
				};
			}
		else {
			options = {
				flUseSes: false,
				smtpHost: config.smtpHost,
				port: config.smtpPort,
				username: config.smtpUsername,
				password: config.smtpPassword
				};
			}
		mail.start (options);
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
		function httpReturnRedirect (url, code) { //9/30/20 by DW
			var headers = {
				location: url
				};
			if (code === undefined) {
				code = 302;
				}
			theRequest.httpReturn (code, "text/plain", code + " REDIRECT", headers);
			}
			
		function httpReturnObject (err, jstruct) {
			if (err) {
				returnError (err);
				}
			else {
				returnData (jstruct);
				}
			}
		function httpReturnZipFile (f) { //4/13/20 by DW
			fs.readFile (f, function (err, data) {
				if (err) {
					returnError (err);
					}
				else {
					theRequest.httpReturn (200, "application/zip", data);
					}
				});
			}
		function returnServerHomePage () {
			var pagetable = {
				productName: config.productName, 
				productNameForDisplay: config.productNameForDisplay, 
				version: config.version,
				urlServerForClient: config.urlServerForClient,
				urlWebsocketServerForClient: config.urlWebsocketServerForClient,
				flEnableLogin: config.flEnableLogin,
				prefsPath: config.prefsPath,
				docsPath: config.docsPath,
				flUseTwitterIdentity: config.flUseTwitterIdentity, //2/6/23 by DW
				idGitHubClient: config.githubClientId, //11/9/21 by DW
				flWebsocketEnabled: config.flWebsocketEnabled, //2/8/23 by DW
				urlServerHomePageSource: config.urlServerHomePageSource, //9/16/23 by DW
				pathServerHomePageSource: config.pathServerHomePageSource //9/16/23 by DW
				};
			function getTemplateText (callback) {
				if (pagetable.pathServerHomePageSource !== undefined) {
					fs.readFile (pagetable.pathServerHomePageSource, function (err, templatetext) {
						if (err) {
							callback (err);
							}
						else {
							callback (undefined, templatetext);
							}
						});
					}
				else {
					request (pagetable.urlServerHomePageSource, function (err, response, templatetext) {
						if (err) {
							callback (err);
							}
						else {
							if ((response.statusCode >= 200) && (response.statusCode <= 299)) {
								callback (undefined, templatetext);
								}
							else {
								const message = "HTTP error == " + response.statusCode;
								callback ({message});
								}
							}
						});
					}
				}
			function buildAndServeHomepage () {
				getTemplateText (function (err, templatetext) {
					if (err) {
						returnError (err);
						}
					else {
						const pagetext = utils.multipleReplaceAll (templatetext.toString (), pagetable, false, "[%", "%]");
						returnHtml (pagetext);
						}
					});
				}
			if (theRequest.addToPagetable !== undefined) { //3/9/21 by DW
				for (var x in theRequest.addToPagetable) {
					pagetable [x] = theRequest.addToPagetable [x];
					}
				}
			if (config.addMacroToPagetable !== undefined) {
				config.addMacroToPagetable (pagetable, theRequest); //8/10/22 by DW
				}
			if (config.asyncAddMacroToPagetable !== undefined) { //8/10/22 by DW
				config.asyncAddMacroToPagetable (pagetable, theRequest, function () {
					buildAndServeHomepage ();
					});
				}
			else {
				buildAndServeHomepage ();
				}
			}
		function callWithScreenname (callback) {
			
			function actingAsFilter (email, callback) { //11/3/23 by DW
				if (config.flEnableSupervisorMode) {
					if (params.actingas === undefined) {
						callback (email);
						}
					else {
						config.isUserAdmin (email, function (flAdmin, userRec) {
							if (flAdmin) {
								config.findUserWithScreenname (params.actingas, function (flInDatabase, userRec) {
									if (flInDatabase) {
										if (userRec.emailAddress === undefined) {
											callback (email);
											}
										else {
											callback (userRec.emailAddress);
											}
										}
									else {
										callback (email); 
										}
									});
								}
							else {
								callback (email);
								}
							});
						}
					}
				else {
					callback (email);
					}
				}
			
			if (config.flUseTwitterIdentity) { //2/6/23 by DW
				if (config.getScreenname === undefined) {
					davetwitter.getScreenName (token, secret, function (screenname) {
						if (screenname === undefined) {
							returnError ({message: "Can't do the thing you want because the accessToken is not valid."});    
							}
						else {
							callback (screenname);
							}
						});
					}
				else {
					config.getScreenname (params, function (err, screenname) { //12/23/22 by DW
						if (err) {
							returnError (err);
							}
						else {
							callback (screenname);
							}
						});
					}
				}
			else {
				if ((params.emailaddress !== undefined) && (params.emailcode !== undefined)) { 
					const email = utils.stringLower (params.emailaddress); //3/8/23 by DW
					config.findUserWithEmail (email, function (flInDatabase, userRec) {
						if (flInDatabase) {
							if (params.emailcode == userRec.emailSecret) {
								actingAsFilter (email, function (whoActingAs) {
									console.log ("\nappserver: whoActingAs == " + whoActingAs + "\n");
									callback (whoActingAs);  
									});
								}
							else {
								const message = "Can't do what you wanted the correct email authentication wasn't provided.";
								returnError ({message});
								}
							}
						else {
							const message = "Can't do what you wanted because the email address isn't in the database.";
							returnError ({message});
							}
						});
					}
				else {
					const message = "Can't do what you wanted because the call is missing email authentication.";
					returnError ({message});
					}
				}
			}
		
		if (config.httpRequest !== undefined) {
			if (config.httpRequest (theRequest)) { //consumed by callback
				return (true);
				}
			}
		
		if (wordpressHandleRequest (theRequest)) { //9/10/23 by DW
			return (true);
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
									if (!flprivate) {
										if (config.publicFileSaved !== undefined) {
											config.publicFileSaved (token, secret, getPublicFileUrl (screenname, params.relpath));
											}
										}
									returnPlainText (utils.jsonStringify (data));
									}
								});
							});
						return (true);
					case "/writewholefile": //2/25/21 by DW -- special way to write a file, for scripting
						callWithScreenname (function (screenname) {
							writeWholeFile (screenname, params.relpath, theRequest.postBody.toString (), httpReturn);
							});
						return (true);
					case "/uploadtogithub":  //11/9/21 by DW
						uploadToGithub (params.options, theRequest.postBody, httpReturn);
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
					case "/makefilepublic": //2/20/21 by DW
						callWithScreenname (function (screenname) {
							makeFilePublic (screenname, params.relpath, httpReturn);
							});
						return (true); 
					case "/getfilehierarchy": //2/21/21 by DW
						callWithScreenname (function (screenname) {
							getFileHierarchy (screenname, httpReturn);
							});
						return (true); 
					case "/deletefile": //2/23/21 by DW
						callWithScreenname (function (screenname) {
							deleteFile (screenname, params.relpath, httpReturn);
							});
						return (true); 
					case "/readwholefile": //2/24/21 by DW
						callWithScreenname (function (screenname) {
							readWholeFile (screenname, params.relpath, httpReturn);
							});
						return (true); 
					case "/fileexists": //5/29/21 by DW
						callWithScreenname (function (screenname) {
							fileExists (screenname, params.relpath, httpReturn);
							});
						return (true); 
					case "/httpreadurl": //2/26/21 by DW
						callWithScreenname (function (screenname) {
							httpReadUrl (params.url, httpReturn);
							});
						return (true); 
					case "/httprequest": //11/5/21 by DW
						callWithScreenname (function (screenname) {
							httpFullRequest (params.request, httpReturn);
							});
						return (true); 
					case "/getdomainname": //2/27/21 by DW
						callWithScreenname (function (screenname) {
							getDomainNameVerb (params.dottedid, httpReturn);
							});
						return (true); 
					case "/getdottedid": //2/27/21 by DW
						callWithScreenname (function (screenname) {
							getDottedIdVerb (params.name, httpReturn);
							});
						return (true); 
					case "/myfiles": //3/7/21 by DW
						callWithScreenname (function (screenname) {
							getUserData (screenname, function (err, zipfile) {
								if (err) {
									errorResponse (err);
									}
								else {
									httpReturnZipFile (zipfile);
									}
								});
							});
						return (true); 
					case "/getfileinfo": //4/1/21 by DW
						callWithScreenname (function (screenname) {
							getFileInfo (screenname, params.relpath, httpReturn);
							});
						return (true); 
					case "/githuboauthcallback": //11/8/21 by DW
						handleGithubOauthCallback (params.code, function (err, urlRedirect) {
							if (err) {
								returnError (err);
								}
							else {
								httpReturnRedirect (urlRedirect);
								}
							});
						return (true); 
					case "/downloadfromgithub":  //11/8/21 by DW
						downloadFromGithub (params.username, params.repository, params.path, params.accessToken, httpReturn);
						return (true); 
					case "/githubgetdirectory":  //11/10/21 by DW
						getGithubDirectory (params.username, params.repository, params.path, params.accessToken, httpReturn);
						return (true); 
					case "/githubgetuserinfo":  //11/10/21 by DW
						callWithScreenname (function (screenname) {
							getGithubUserInfo (params.username, params.accessToken, httpReturn);
							});
						return (true); 
					case "/useriswhitelisted": //7/21/22 by DW
						callWithScreenname (function (screenname) {
							userIsWhitelisted (screenname, httpReturn); //9/16/22 by DW
							});
						return (true); 
					case "/sendconfirmingemail": //12/7/22 by DW
						sendConfirmingEmail (params.email, undefined, false, params.urlredirect, httpReturn); //3/3/23 by DW
						return (true);
					case "/createnewuser": //1/7/23 by DW
						sendConfirmingEmail (params.email, params.name, true, params.urlredirect, httpReturn); //3/3/23 by DW
						return (true);
					case "/userconfirms": //12/7/22 by DW
						receiveConfirmation (params.emailConfirmCode, httpReturnRedirect);
						return (true);
					
					}
				break;
			}
		return (false);
		}
	function http404Callback (theRequest) {
		function return404 () {
			theRequest.httpReturn (404, "text/plain", "Not found.");
			}
		function returnPlainText (s) {
			theRequest.httpReturn (200, "text/plain", s.toString ());
			}
		if (config.flStorageEnabled) {
			if (checkPathForIllegalChars (theRequest.path)) {
				
				function getFileContent (screenname, relpath, flprivate, callback) { //9/8/21 by DW
					var f = getFilePath (screenname, relpath, flprivate);
					fs.readFile (f, function (err, filetext) {
						if (err) {
							callback (err);
							}
						else {
							callback (undefined, filetext);
							}
						});
					}
				
				var path = utils.stringDelete (theRequest.path, 1, 1); //delete leading slash
				var screenname = utils.stringNthField (path, "/", 1);
				var relpath = utils.stringDelete (path, 1, screenname.length + 1);
				var flprivate = false;
				getFileContent (screenname, relpath, flprivate, function (err, filedata) {
					if (err) {
						return404 ();
						}
					else {
						const ext = utils.stringLastField (relpath, "."); //8/3/21 by DW
						if (ext == relpath) { //no extension
							type = config.defaultContentType;
							}
						else {
							type = utils.httpExt2MIME (ext, config.defaultContentType);
							}
						theRequest.httpReturn (200, type, filedata);
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
	function userLogonCallback (options) { //8/14/22 by DW
		if (config.userLogonCallback !== undefined) {
			config.userLogonCallback (options);
			}
		}
	function everyMinute () {
		var now = new Date ();
		if (config.everyMinute !== undefined) {
			config.everyMinute ();
			}
		if (now.getMinutes () == 0) {
			console.log ("\n" + now.toLocaleTimeString () + ": " + config.productName + " v" + config.version + " running on port " + config.port + ".\n");
			checkPendingConfirmations (); //12/7/22 by DW
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
	readConfigJson (function () { //readConfig (fnameConfig, config, true, function () { //anything can be overridden by config.json
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
			startDavemail (); //1/23/23 by DW
			
			if (config.wordpress !== undefined) { //9/10/23 by DW
				wordpress.start (config.wordpress, function () {
					});
				}
			
			if (config.myDomain === undefined) {
				console.log ("startup: can't start the server because config.myDomain is not defined.");
				}
			else {
				if (config.urlServerForClient === undefined) { //1/30/23 by DW
					config.urlServerForClient = "http://" + config.myDomain + "/";
					}
				if (config.urlWebsocketServerForClient === undefined) { //1/30/23 by DW
					config.urlWebsocketServerForClient = getWsProtocol () + utils.stringNthField (config.myDomain, ":", 1) + ":" + config.websocketPort + "/";
					}
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
