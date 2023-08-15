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

