redditp
=======

A full screen reddit presentation or slide show.

http://github.com/utopiabound/redditp

Fork from Ubershmekel's

http://redditp.com

Hotkeys
-------

* space - toggles auto-next (play/pause)
* t - collapse/uncollapse title
* c - collapse/uncollapse controls
* i - open image in a new tab
* o - open comments in a new tab
* p - open duplicates in a new tab
* u - hide/show duplciates box
* f - toggle full screen mode
* m - unmute/mute videos
* w a s d - left-handed navigation (same as arrow keys)
* Arrow keys, pgup/pgdown change slides
** Up/Down, page-up / page-down - switch Albums
** left/right - switch pictures within albums (and also to next/previous album)
* Swipe gestures on phones

Features
--------

* All /r/ subreddits, including different ?sort stuff.
* /user/ , /domain/ , /me/ url's work.
* Url's ending with ['.jpg', '.jpeg', '.gif', '.bmp', '.png'], or URLs from parsable domains
* Video support (either direct or embeded)
* Autonext waits for the end of a video (does not work for gif, but does work for gifv)
* Parsing for a collection of domains including: (see source for complete list)
	* Imgur		(Album support)
	* Tumblr	(Album support)
	* Eroshare	(Album support)
	* Gfycat
	* vimeo		(embed only - no autonext)
	* Youtube	(embed only - no autonext)
* Deduplication support when browsing mulitple reddits (e.g. a multireddit /user/NAME/m/MULTIREDDIT or /r/funny+pics)
* Add '+' to the end of single subreddit to enabled duplicate tracking
* Albums will display inline for subreddits
* Browse imgur gallaries/albums (/imgur/a/ID), and tumblr gallaries (/tumblr/DOMAIN/ID), or a whole tumblr blog (/tumblr/DOMAIN)
* You can save the html file locally and use it, just make sure you add a separator e.g. the question mark in file:///c/myredditp.html?/r/gifs so the browser knows to pick up the right file and go to the right subreddit.
* Support for /r/random, /r/randnsfw, /r/popular virtual subreddits
* Albums will be detected for title that specify it's in the comments
* "More in comments" will result in an album of the "more" specified
* For subreddits that have "requests", responses will be shown as albums, also 'PsBattles:' is similarly special cased

Possible future features, depending on feedback:
* Zoom/Pan for comics

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

http://utopiabound.github.io/redditp/?/r/popular or
http://utopiabound.github.io/redditp/index.html?/r/popular

Known Issues
------------

* iPad/iPhone support is iffy
* access via http://HOST/redditp/r/aww fails due to the rewrite rules

Credits
----------

* Ubershmekel http://yuvalg.com/
* [js-cookie](https://github.com/js-cookie/js-cookie) for managing cookies
* Favicon by Double-J designs http://www.iconfinder.com/icondetails/68600/64/_icon
* Slideshow based on http://demo.marcofolio.net/fullscreen_image_slider/
* Author of slideshow base: Marco Kuiper (http://www.marcofolio.net/)
