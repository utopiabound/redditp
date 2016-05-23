redditp
=======

A full screen reddit presentation or slide show.

http://redditp.com

Hotkeys
-------

* a/space - toggles auto-next (play/pause)
* t - collapse/uncollapse title
* c - collapse/uncollapse controls
* i - open image in a new tab
* r - open comments in a new tab
* f - toggle full screen mode
* m - unmute/mute videos
* Arrow keys, pgup/pgdown change slides
* Swipe gestures on phones

Features
--------

* All /r/ subreddits, including different ?sort stuff.
* /user/ , /domain/ , /me/ url's work.
* Url's ending with ['.jpg', '.jpeg', '.gif', '.bmp', '.png'], or URLs from parsable domains
* Video support (either direct or embeded)
* Autonext waits for the end of a video (does not work for gif, but does work for gifv)
* Parsing for a collection of domains including: (see source for complete list)
	* Imagur (adds album links)
	* Tumblr (adds album links)
	* Gfycat
	* vimeo (embed only - no autonext)
	* Youtube (embed only - no autonext)
* Deduplication support when browsing mulitple reddits (e.g. a multireddit /user/NAME/m/MULTIREDDIT or /r/funny+pics)
* Browse imgur gallaries/albums (/imgur/a/ID), and tumblr gallaries (/tumblr/DOMAIN/ID), or a whole tumblr blog (/tumblr/DOMAIN)
* You can save the html file locally and use it, just make sure you add a separator e.g. the question mark in file:///c/myredditp.html?/r/gifs so the browser knows to pick up the right file and go to the right subreddit.

Possible future features, depending on feedback:
* Zoom/Pan for comics
* Support for /r/random and /r/randnsfw virtual subreddits. These'll be tricky unless I cheat as they contain redirects.
* Offline access support, though I don't know if this is even possible actually (caching external image resources).

Credits
----------

* Ubershmekel http://yuvalg.com/
* [js-cookie](https://github.com/js-cookie/js-cookie) for managing cookies
* Favicon by Double-J designs http://www.iconfinder.com/icondetails/68600/64/_icon
* Slideshow based on http://demo.marcofolio.net/fullscreen_image_slider/
* Author of slideshow base: Marco Kuiper (http://www.marcofolio.net/)
