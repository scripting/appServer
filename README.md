# appserver

A new release of nodeStorage that removes all the historical addons, streamlines configuration, only serves from the local file system, and serves the home page of the app. It could be thought of as v2.0 of nodeStorage except it is not backward compatible. 

### Overview

Over the years nodeStorage got a lot of appendages and add-ons that most apps don't use. 

The configuration file was confusing and not well documented.

It was one of the first things I wrote for Node, and I learned a lot over time.

FInally when one of my programming partners had difficulty understanding the code, I realizaed I did too, and decided to rebuild it from scratch using components I had already developed, such as davehttp, davetwitter, etc. 

I have converted Little Outliner to use this backend. The app was only modified in how it's configured. Everything else remains the same. It uses the same api glue file that it used to access nodeStorage. 

### Configuring

Below is an example of config.json file that goes in the same directory as the appserver.js file.

### Example

```json{	"productName": "littleOutliner",	"productNameForDisplay": "Little Outliner",	"urlServerHomePageSource": "http://littleoutliner.com/testing/1.9.0/index.html",	"prefsPath": "outlinerPrefs.json",	"docsPath": "myOutlines/",		"port": 1962,	"flWebsocketEnabled": true,	"websocketPort": 1963,	"myDomain": "test.littleoutliner.com",		"twitterConsumerKey": "1234567890123456789012345",	"twitterConsumerSecret": "12345678901234567890123456789012345678901234567890"	}```

### Explanation

The first section provides configuration information about and to the app that's running on the server's home page.  

1. productName is an id that can be used to identify the product. No specified use.

2. productNameForDisplay is what the app should use in its user interface.

3. urlServerHomePageSource is the address of an HTML page that is served through the home page of the server. It can contain macros that plug in values from the server. 

4. prefsPath is the name of the prefs file for the app. This is the file you should read and save to, to maintain the state of the app for the user. 

5. docsPath is where the documents for this app are stored in the user's storage on the server.

6. urlServerForClient is the address the app uses to call back to the server. 

7. urlWebsocketServerForClient is the address of the web socket that reports on changes to files stored on the server. This address can be included in the app files so that apps that read the files can subbscribe to changes. 

The second section configures the HTTP server and the connection to Twitter for identity. 

1. port is the port the HTTP server will run on, unless process.env.PORT is specified. It overrides the port choice in the config file.

2. flWebsocketEnabled, a boolean, determines whether or not we initialize the websocket server, if it's true then websocketPort is the port it's listening on. 

3. myDomain, the domain assigned to this app. It's the domain you'd use to access the home page. If that includes a port, include the port in this value.

4. twitterConsumerKey and twitterConsumerSecret are the values that identify the app for Twitter, as assigned on developer.twitter.com. 

### Updates

#### v0.5.48 -- 3/18/22 by DW

Exports three routines: fileExists, readWholeFile, writeWholeFile.

#### v0.5.44 -- 3/18/22 by DW

New callback, config.publishFile. If defined we call back with the file, screenname, relpath, flprivate, filetext and the url of the file if it's public.

It's called when we handle a /publishfile or /writewholefile message.

#### v0.5.32 -- 12/4/21 by DW

Added a new callback, publicFileSaved, which is called when the user updates a public file. 

Fixed a bug where a user couldn't create a new file if their public files folder was empty. 

#### v0.5.32 -- 9/26/21 by DW

Fixed the example app to require "../appserver.js" instead of "lib/daveappserver.js" which only exists on my development machine. 

#### v0.5.31 -- 9/15/21 by DW

writeWholeFile was meant to be sure the path to the file exists before writing the file. It wasn't doing it, now it does. 

