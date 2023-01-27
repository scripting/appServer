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

#### 8/10/22; 10:48:22 AM by DW -- 0.5.53, 0.5.54

In returnServerHomePage we add a new param to the addMacroToPagetable callback, the request object. 

#### 7/21/22 by DW -- 0.5.52

New config setting, config.whitelist. Defaults to undefined. 

If undefined, the app doesn't have a whitelist and anyone is authorized to use it, ie everyone is whitelisted. 

If not undefined, it's an array of screennames of people who are authorized to use the software. 

There's a new call /useriswhitelisted that determines if a user is whitelisted. 

#### 7/3/22 by DW -- 0.5.49

In writeWholeFile if config.publishFile was defined, we'd call back with a type param that wasn't defined. We defined it. 

Added this file to the project to be consistent with other new projects.

