#### 5/25/25; 1:07:27 PM by DW -- v0.8.0

I wrote the test app i mentioned in the previous note. Set it up to do what we do when sending notifications about new feed items, only instead of using the older websockets package, i use the new one. worked perfectly, no double-notifications. so now i'm going to convert to use the new package here. 

#### 5/21/25; 11:09:32 AM by DW -- v0.7.16

I was trying to debug why we're getting double notification of new items via the websockets interface. 

It's a real mystery, but the problem is not in the database code, it's in the websockets code. 

I'm going to handle the problem by writing a special server app that just spools out new items via websockets, all new code, let's see if we can find the doubling-up that way. 

#### 10/6/24; 12:38:10 PM by DW

wordpressHandleRequest/checkPendingConfirmation was trying to delete a non-existing confirmation record. Added a check for err that should have been there. 

#### 11/14/23; 5:24:09 PM by DW

For WordPress identity to work on a multi-instance setup, we have to use the same confirmation approach we use for email signup. So every call to the WordPress event handler we add two callbacks to the options object to support creating an identification record in the database, and checking it on callback from WordPress that the value is correct in the state record then send back with the confirmation. 

Note -- to get this functionality you must set config.flUseDatabaseForConfirmations to true. 

#### 11/11/23; 1:01:55 PM by DW

Change config.flEnableSupervisorMode to default true instead of false.

#### 10/31/23; 9:06:37 AM by DW

WordPress login.

Previously, we added code that let WordPress have access to every http event, this made it possible to develop the WordPress verbs in Drummer scripting. 

Now we want to do more, allow an appserver client app to grab the logon event, when the user has given us permission and we've gotten an accessToken.

So there's a callback, search for, that in turn calls a callback in the client app, that then does what it wants to with the login.

In the case of FeedLand, the fit is pretty tight. FL needs what WP can provide -- a unique name and an email address. 

This connection is made here in daveappserver.

#### 10/30/23; 1:52:52 PM by DW

Fixed a crashing bug in http404Callback.

#### 9/20/23; 10:33:40 AM by DW

Two new optional callbacks, getStaticFile and publishStaticFile.

FeedLand uses this to store static files in a database table instead of S3.

#### 9/16/23; 10:46:52 AM by DW

Reorganized returnServerHomePage so we read the template text after calling the callbacks. They can change the url of the home page source. This was needed when we added newsproduct rendering to the FeedLand server.

#### 9/11/23; 10:34:58 AM by DW

How to set up for WordPress

1. First set up a new app <a href="https://developer.wordpress.com/apps/new/">here</a>. 

2. There's a new section of config.json called wordpress. In it are these values:

```JavaScript"wordpress": {	"clientId": 123456789,	"clientSecret": "xxx",	"urlRedirect": "https://myserver.com/callbackFromWordpress",	"scope": "global"	 }```

3. Include this in the &lt;head> section of your home page HTML

<code>&lt;script src="//s3.amazonaws.com/scripting.com/code/wpidentity/client/api.js">&lt;/script></code>

#### 9/10/23; 4:27:32 PM by DW -- v0.7.0

WordPress functionality. An app running on daveappserver will be able to log the user on to WordPress, and perform basic operations like creating, updating and deleting posts, getting a list of all their sites. Using the wpidentity package. 

There are two points of integration, at startup and when handling an http request. 

#### 8/15/23; 6:54:54 PM by DW

New config setting, flTraceOnError. Defaults false. If true, when davehttp handles a request, it gives you a stack trace that seems pretty useless and it hides where the actual error is happening. You can turn it back on if you feel it is useful. 

#### 8/14/23; 11:39:18 AM by DW

We need the option of storing pending confirmations in a database, not in memory. 

new config setting: flUseDatabaseForConfirmations, default false

config.database must also be defined, but we don't check.

#### 7/27/23; 2:27:42 PM by DW

dns.reverse can crash, so do the call in a try statement.

#### 7/26/23; 3:15:15 PM by DW

There was a stray bit of code that's first running today but was written on May 8 this year (that's the creation date on the outline element). 

Obviously a direction I thought of going in but didn't.

It made it into the published package and into the NPM version. 

getPagetableForHomePage (function (err, pagetable) { 

});

#### 3/17/23; 12:27:58 PM by DW

Only alpha, numeric and underscore characters allowed in user names.

#### 3/8/23; 12:13:06 PM by DW

email addresses become unicase.

we do this by converting the email address as it enters the system from the client. 

sendConfirmingEmail

callWithScreenname

#### 3/3/23; 10:49:28 AM by DW

I want to be able to send a confirming email from Electric Drummer and have it return with the emailMemory record to a localhost address. 

This means that the sendConfirmingEmail call must have a new parameter, urlredirect which, if specified, is where we redirect to on confirmation.

#### 2/8/23; 10:03:25 AM by DW

New config.json setting -- flSecureWebsocket. If true we initiate connections with wss:// otherwise ws://

#### 2/8/23; 8:57:32 AM by DW

At startup we look for config.js in the same folder as the app, if it's present we require it, and use the result in place of config.json.

This approach is needed in certain hosting situations including WordPress VIP. 

#### 1/30/23; 12:38:16 PM by DW

If config.urlServerForClient is set, don't set it to the default. 

Same with config.urlWebsocketServerForClient.

Made sure that config.urlServerForClient and urlWebsocketServerForClient were undefined if not specified in config.json, so we would set the defaults when needed.

#### 1/23/23; 3:35:25 PM by DW

Support SMTP mail sending in addition to SES.

New values in config.json to support this:

"smtpHost": "smtp.mailhost.com",

"smtpPort": 587,

"smtpUsername": "bullman",

"smtpPassword": "getoutahere",

#### 9/16/22 by DW -- 0.5.57

Changed /useriswhitelisted call so that it reads config.json itself, so the system doesn't have to be rebooted to make a change to the whitelist.

#### 8/14/22 by DW -- 0.5.56

Exporting getFilePath so FeedLand server can find the user's prefs.json file. 

#### 8/14/22 by DW -- 0.5.55

New userLogonCallback callback. Called when the user has successfully logged in via davetwitter. We send back the information about the login, the user's screenname, userid, token and secret. 

#### 8/10/22 by DW -- 0.5.53, 0.5.54

In returnServerHomePage we add a new param to the addMacroToPagetable callback, the request object. 

#### 7/21/22 by DW -- 0.5.52

New config setting, config.whitelist. Defaults to undefined. 

If undefined, the app doesn't have a whitelist and anyone is authorized to use it, ie everyone is whitelisted. 

If not undefined, it's an array of screennames of people who are authorized to use the software. 

There's a new call /useriswhitelisted that determines if a user is whitelisted. 

#### 7/3/22 by DW -- 0.5.49

In writeWholeFile if config.publishFile was defined, we'd call back with a type param that wasn't defined. We defined it. 

Added this file to the project to be consistent with other new projects.

