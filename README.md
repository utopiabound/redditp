redditp
=======

A full screen reddit presentation or slide show.

http://github.com/utopiabound/redditp

Useable Links:
https://utopiabound.github.io/redditp/?/r/popular
https://redditp.utopiabound.net/

Fork from Ubershmekel's

http://redditp.com

Hotkeys
-------

* space - toggles auto-next (play/pause)
* t - collapse/uncollapse title
* c - collapse/uncollapse controls
* i - open image in a new tab
* o - open comments in a new tab
* d - open duplicates in a new tab
* u - hide/show duplciates box
* f - toggle full screen mode
* m - unmute/mute videos
* n - toggle nsfw
* s - load images from comments
* Arrow keys, pgup/pgdown change slides
    * Up/Down, page-up / page-down - switch Albums
    * left/right - switch pictures within albums (and also to next/previous album)
* Swipe gestures on phones
* enter - play embeded

Features
--------

* All /r/ subreddits, including different ?sort stuff.
* /user/ , /domain/ , /me/ url's work.
* Url's ending with ['.jpg', '.jpeg', '.gif', '.bmp', '.png'], or URLs from parsable domains
* Video support (either direct or embeded)
* Autonext waits for the end of a video (does not work for gif, but does work for gifv)
* Parsing for a collection of domains including: (see createDiv() and processPhoto() for complete list)
* Special User / Album browsing in addition to reddit.com:
	* Imgur		(User support)  /imgur/[u/*USER*|t/*TAG*]
	* Tumblr	(Album support) /tumblr/*HOSTNAME*
	* WordPress	(Album support) /wp/*HOSTNAME* (both self, and wp hosted)
	* Gfycat	(User/Tag/Trending support) /gfycat/[u/*USER*|t/*TAG*]
	* Blogger	(Album support) /blogger/*HOSTNAME*
	* Flickr	(User/Album support) /flickr/*USER*[/*ALBUM*]
* Deduplication support when browsing mulitple reddits (e.g. a multireddit /user/NAME/m/MULTIREDDIT or /r/funny+pics)
* Albums will display inline for subreddits
* You can save the html file locally and use it, just make sure you add a separator e.g. the question mark in file:///path/to/redditp/index.html?/r/gifs so the browser knows to pick up the right file and go to the right subreddit.
* Support for /r/random, /r/randnsfw, /r/popular virtual subreddits
* Albums/Video/More in comments will be detected in title and automatically found
* For subreddits that have "requests", responses will be shown as albums, also 'PsBattles:' is similarly special cased

Possible future features, depending on feedback:
* Zoom/Pan for comics

URLs
----

## Reddit Specific:
* /r/*SUBREDDIT*
* /r/*SUB1*+*SUB2...*
* /r/randnsfw
* /r/random
* /r/all
* /r/popular
* /  - will be /r/popular, or homepage if logged in
* /domain/DOMAIN

### Reddit URL Suffixes:
These are available from the popup menu
* /.../new
* /.../top
* /.../rising
* /.../controversial

### Reddit Users
* /user/USER/submitted (also /u/USER/submitted)
* /user/USER/m/MULTIREDDIT

## Other Services:
* /imgur/			Popular Imgur Items
* /imgur/u/USER			Images from that USER
* /imgur/t/TAG			Items with that TAG
* /gfycat				Trending gfycat items
* /gfycat/u/USER		Gfycat items from that USER
* /gfycat/t/TAG		Gfycat items with that TAG
* /wp/HOSTNAME		(with or without .wordpress.com)
* /wp2/HOSTNAME		(fqdn of Self-hosted wordpress site aka API version 2)
* /tumblr/HOSTNAME	(with or without .tumblr.com)
* /blogger/HOSTNAME	(fqdn of blogger hosted site)
* /flickr/USER[/ALBUM] (username of flickr user)

### Blog Order (Tumblr, WordPress, WordPress (v2)):
These are available from the popup menu
* /.../new
* /.../old


Installation
------------
* Can be setup to use base url:

Just git checkout in /PATH/TO/, and then setup an apache .conf file as below:

        <VirtualHost *:80>
        	ServerName redditp.example.com
        	DocumentRoot "/PATH/TO/redditp"
        	ServerAdmin hostmaster@example.com
        	<Location />
        		Order allow,deny
        		Allow from all
        		Deny from none
        	</Location>
        </VirtualHost>

Access via:

http://redditp.example.com/r/popular


* Can be setup in subdirectory without rewriting

Checkout in a directory available via the web, or have an Alias added to apache:

        Alias /redditp /PATH/TO/redditp

Access via standard CGI format:

https://utopiabound.github.io/redditp/?/r/popular or
https://utopiabound.github.io/redditp/index.html?/r/popular

Known Issues
------------

* access via http://HOST/redditp/r/aww fails due to the rewrite rules

Credits
----------

* Ubershmekel http://yuvalg.com/
* [js-cookie](https://github.com/js-cookie/js-cookie) for managing cookies
* Favicon by Double-J designs http://www.iconfinder.com/icondetails/68600/64/_icon
* Slideshow based on http://demo.marcofolio.net/fullscreen_image_slider/
* Author of slideshow base: Marco Kuiper (http://www.marcofolio.net/)
* Touch screen swipe code: Andreas Waltl, netCU Internetagentur (http://www.netcu.de)
* Loglevel v1.5.1: Tim Perry https://github.com/pimterry/loglevel
