#### 7/21/22 by DW -- 0.5.52

New config setting, config.whitelist. Defaults to undefined. 

If undefined, the app doesn't have a whitelist and anyone is authorized to use it, ie everyone is whitelisted. 

If not undefined, it's an array of screennames of people who are authorized to use the software. 

There's a new call /useriswhitelisted that determines if a user is whitelisted. 

#### 7/3/22 by DW -- 0.5.49

In writeWholeFile if config.publishFile was defined, we'd call back with a type param that wasn't defined. We defined it. 

Added this file to the project to be consistent with other new projects.

