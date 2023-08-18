redditp
=======

A full screen reddit presentation or slide show.

http://github.com/utopiabound/redditp

Useable Links:
https://utopiabound.github.io/redditp/?/r/popular
https://redditp.utopiabound.net/
file:///path/to/redditp/index.html?/r/gifs

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
* Swipe gestures on touch interfaces (same as arrow keys)
* ? - Help popups
* v - Information popup
* enter - play embeded

Features
--------

* All /r/ subreddits, including different sortings.
* Support for /r/random, /r/randnsfw, /r/popular virtual subreddits
* /user/ , /domain/ , /me/ url's work.
* Url's ending with ['.jpg', '.jpeg', '.gif', '.bmp', '.png'], or URLs from parsable domains
* Video support (either direct or embeded)
* Autonext waits for the end of a video (does not work for gif, but does work for gifv)
* Parsing for a collection of domains including: (see createDiv() and processPhoto() for complete list)
* Special browsing in addition to reddit.com: (See Help (?) popup)
	* Imgur		(User/Tag/Trending support)  /imgur/[u/*USER*|t/*TAG*]
	* Tumblr	(Album support) /tumblr/*HOSTNAME*[t/*TAG*]
	* WordPress	(Album support) /wp/*HOSTNAME*[t/*TAG*] (both self, and wp hosted)
	* Gfycat	(User/Tag/Trending support) /gfycat/[u/*USER*|t/*TAG*]
	* Blogger	(Album support) /blogger/*HOSTNAME*
	* Flickr	(User/Tag/Search/Trending support) /flickr/[u/*USER*[/*ALBUM*]|t/*TAG*[,*tag2*...]|s/*SEARCH*]
* Deduplication support when browsing mulitple reddits (e.g. a multireddit /user/NAME/m/MULTIREDDIT or /r/funny+pics)
* Albums will display inline for subreddits
* You can use this project locally
* Albums/Video/More in comments will be detected in title and automatically found
* For subreddits that have "requests", responses will be shown as albums, also 'PsBattles:' is similarly special cased
* Works on iOS 9+ and modern browsers

Supported Browsers
------------------
* Modern Desktop (firefox, chrome, safari, webkit, opera, etc.)
* iOS 9.x+
   * Pre-11 - No Unicode Regex (titles won't have as many substitutions / links)
* Android (tested on FireOS 7 ~ Android 9)

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

## Supported Sites (imgur, flickr, ...)
* /SITE
* /SITE/u/USER
* /SITE/t/TAG[+TAG...]
* /SITE/s/SEARCH

## Supported Blogs (wp, wp2, blogger, tumblr)
* /TYPE/HOSTNAME
* /TYPE/HOSTNAME/t/TAG
* /TYPE/HOSTNAME/u/USER
* /TYPE/HOSTNAME/c/CATEGORY

## Other Services:
See Help (?) popup
* /imgur			Popular Imgur Items
* /imgur/u/USER		Images from that USER
* /imgur/t/TAG		Items with that TAG
* /wp/HOSTNAME		(with or without .wordpress.com)
* /wp2/HOSTNAME		(fqdn of Self-hosted wordpress site aka API version 2)
* /tumblr/HOSTNAME	(with or without .tumblr.com)
* /blogger/HOSTNAME	(fqdn of blogger hosted site)
* /flickr			Popular Flickr Items
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
