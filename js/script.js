/* -*- mode: javascript -*-
 * Author: Yuval Greenfield (http://uberpython.wordpress.com)
 * Also: Nathaniel Clark <nathaniel.clark@misrule.us>
 * 
 * You can save the HTML file and use it locally btw like so:
 * file:///wherever/index.html?/r/aww
 * 
 * Check out the original source at:
 * https://github.com/ubershmekel/redditp
 * This Fork:
 * http://github.com/utopiabound/redditp
 *
 * Notes on naming conventions:
 * - "photo" generally refers to a (prospective) element in rp.photos
 * - "pic" generally refers to either photo or album item (usually in presence of photo variable)
 * 
 * In Browser Storage (window.storage)
 * redditp-decivolume           - int     - Volume of videos (value/10)
 * redditp-nsfw                 - boolean - load NSFW content
 * redditp-redditBearer         - string  - auth bearer token from reddit.com
 * redditp-redditRefreshBy      - int     - time that bearer token expires
 * redditp-shouldAutoNextSlide  - boolean - on timeout, go to next image
 * redditp-showEmbed            - boolean - Show embeded content (iframes, no timeout)
 * redditp-showUserSub          - boolean - Show user subreddits in duplicates
 * redditp-timeToNextSlide      - int     - timeout in seconds
 * redditp-favicons             - hash of strings       - cached result of hostname to favicon url
 * redditp-wordpressv2          - hash of booleans      - cached result of speculative WPv2 lookup
 * redditp-insecure             - hash of booleans      - cached result of https GET of WPv2 lookup
 * redditp-blogger              - hash of booleans      - cached result of speculative blogger lookup
 * redditp-flickrnsid           - hash of strings       - cached userid to NSID
 * 
 * (window.history)
 * Set/push/replace state
 * 
 * Cookies - NONE
 *
 * Locations for per-Site processing:
 * rp.favicons    - limited number of favicons based on second level domain (for major sites that don't support http://fqdn/favicon.ico)
 * processPhoto() - initial processing of photo.url, if it can be determined to be photo/video/later
 * fillLaterDiv() - where photo's tagged as later, are processed via ajax callout
 * fixupTitle()   - any urls that can be added/processed from a photo.title (only affects photo.title)
 * fixupUrl()     - known https: sites
 *
 * initPhotoYoutube() - wrapper around initPhotoEmbed()
 *
 * per-Site Duplicate handling:
 * addPhotoDupe()
 * getRedditDupe()
 * updateDuplicates()
 * animateNavigationBox()
 * processUrls() - RESTORE
 */
/* Data Structures:
 * rp.photos = ARRAY of HASH
 *      type:           ENUM of imageTypes     (will be set by processPhoto())
 *      url:            URL link of "photo"    (addImageSlide() will call fixupUrl())
 *      dupes:          ARRAY of HASH of duplicate images (dependent on site type)
 *      over18:         BOOLEAN is nsfw (or any item in album is nsfw)
 *      title:          HTML Title of image     (creator of object needs to call fixupTitle())
 *      id:             TEXT Unique ID based on site+subreddit or blog
 *      -- Optional --
 *      date:           INT  Date in seconds
 *      author:         TEXT reddit username
 *      comments:       URL  link to photo comments
 *      commentN:       INT  Number of comments (if this is set, comments needs to be set too)
 *      extraLoaded:    BOOL Have loaded comment images or duplicate listings
 *      cross_id:       TEXT ID in duplictes of original link
 *      extra:          HTML Extra information for links concerning photo
 *      thumb:          URL  thumbnail of image (e.g. cached version from reddit)
 *      flair:          TEXT text flair put next to title
 *      favicon:        URL  link to favicon for photo (c.f. setFavicon())
 *      score:          INT  Score (upvotes - downvotes)
 *      fallback:       ARRAY of URLs Fallback urls (if processed pic.url fails, try pic.fallback)
 *      fb_thumb:       ARRAY of URLs Fallback thumbnail urls (must be images)
 *
 *      -- Other, NOT creator setable --
 *      o_url:          URL original URL [set by processPhoto()]
 *      insertAt:       INT where to insert pictures in album [set by addAlbumItem()]
 *      duration:       INT length of video in seconds [set by showVideo()]
 *      times:          INT number of times to play video [set by showVideo()]
 *      index:          INT index in rp.photos, used by album functions [set by addImageSlide()]
 *
 *      -- Depending on host site getRedditImages() vs getTumblrBlog() --
 *      subreddit:      TEXT of subreddit name
 *      tumblr:         HASH (e.g. 'https://'+tumblr.blog+'.tumblr.com'+/post/+tumblr.id )
 *              blog:   TEXT blog name
 *              id:     TEXT tumblr post id
 *      flickr:         HASH
 *              nsid:   TEXT of flickr user NSID
 *      gfycat:         HASH
 *              user:   TEXT username
 *              type:   TEXT (gfycat|redgifs)
 *      -- Depending on image Type --
 *      video:          HASH for video ext to url + thumbnail (see showVideo() / rp.mime2ext)
 *              thumb:  URL of thumbnail
 *              TYPE:   URL or ARRAY of URLs (type is ext c.f. rp.ext2mime video/*)
 *              audio:  HASH of TYPE to URL (type is ext c.f. rp.ext2mime audio/*)
 *      album:          ARRAY of HASH (hash items are very similar to photo structure, but are not allowed to be albums)
 *      html:           TEXT html to insert
 *
 * rp.photos[i].dupes = ARRAY of HASH
 *      id:             TEXT Unique ID (subreddit article id, tumblr post id, etc.)
 *      -- Optional --
 *      extraLoaded:    BOOL True if extra loaded (same as above)
 *      title:          TEXT (same as above)
 *      -- Site Dependent: Reddit --
 *      subreddit:      TEXT subreddit name (same as above)
 *      date:           INT  (same as above)
 *      commentN:       INT  (same as above)
 *      -- Site Dependent: Tumblr --
 *      tumblr:         TEXT Tumblr site
 *      url:            URL  link to duplicate post
 */

var rp = {};
// This can be set to TRACE, DEBUG, INFO, WARN. ERROR, SLIENT (nothing printed)
log.setLevel(log.levels.INFO);
RegExp.quote = function(str) {
    var re = /[.*+?^${}()\\|[\]]/g;
    return (str+'').replace(re, "\\$&");
};

rp.settings = {
    // JSON/JSONP timeout in milliseconds
    ajaxTimeout: 10000,
    // Speed of the animation
    animationSpeed: 1000,
    shouldAutoNextSlide: false,
    timeToNextSlide: 8,
    goodImageExtensions: ['jpg', 'jpeg', 'gif', 'bmp', 'png', 'svg'],
    goodVideoExtensions: ['webm', 'mp4', 'mov'], // Matched entry required in rp.mime2ext
    alwaysSecure: true,
    minScore: 1,
    decivolume: 5,
    // show Embeded Items
    embed: false,
    // show NSFW Items
    nsfw: false,
    // Show user subreddit links in duplicates
    usersub: false,
    mute: true,
};

rp.mime2ext = {
    'audio/mpeg': 'mp3',
    'audio/ogg':  'ogg',
    'audio/wav':  'wav',
    'image/jpeg': 'jpg',
    'image/png':  'png',
    'image/gif':  'gif',
    'video/webm': 'webm',
    'video/mp4':  'mp4',
    'video/quicktime': 'mov'
};
rp.ext2mime = Object.keys(rp.mime2ext).reduce(function(obj,key){
    obj[ rp.mime2ext[key] ] = key;
    return obj;
},{});

rp.session = {
    // 0-based index to set which picture to show first
    // init to -1 until the first image is loaded
    activeIndex: -1,
    activeAlbumIndex: -1,

    // Variable to store if the animation is playing or not
    isAnimating: false,
    needReanimation: false,

    // Id of timer
    nextSlideTimeoutId: null,

    // Reddit filter "After"
    after: "",

    // Login dependent values
    loginExpire: undefined, // Used to determin if login has expired
    loadedMultiList: false,
    loginNeeded: false, // true if current subreddit needs a login to work correctly

    // Status variables
    loadingNextImages: false,
    loadAfter: null,
    loading: 0,
    loadingMessage: "",

    needsPlayButton: false,
    volumeIsMute: false,  // Volume 0/1 should be used as mute/unmount - no volume control
    fakeStorage: false,
    showRedditLink: true,
    redditHdr: {}
};
// In case browser doesn't support localStorage
// This can happen in iOS Safari in Private Browsing mode
rp.storage = {};

// Stored in localStorage or in rp.storage if localStorage isn't available
rp.wpv2 = {};
rp.insecure = {};
rp.blogger = {};
rp.flickr = { nsid2u: {},
              u2nsid: {} };
rp.faviconcache = {};

rp.history = window.history;

// CHANGE THESE FOR A DIFFERENT Reddit Application
rp.api_key = {tumblr:  'sVRWGhAGTVlP042sOgkZ0oaznmUOzD8BRiRwAm5ELlzEaz4kwU',
              blogger: 'AIzaSyDbkU7e2ewiPeBtPwr1cfExV0XxMAQKhTg',
              flickr:  '24ee6b81f406711f8c7d3a9070fe47a7',
              reddit:  '7yKYY2Z-tUioLA',
              imgur:   'ae493e76de2e724'
             };
rp.redirect = 'http://redditp.utopiabound.net/auth';

// Hosts will default to originOf(url)+'/favicon.ico'
// this list overrides based on second level domain (e.g. mywebsite.wordpress.com -> wordpress)
rp.favicons = { tumblr:  'https://assets.tumblr.com/images/favicons/favicon.ico',
                wordpress: 'https://s1.wp.com/i/favicon.ico',
                dropbox: 'https://cfl.dropboxstatic.com/static/images/favicon.ico',
                redgifs: 'https://www.redgifs.com/assets/favicon-16x16.png',
                // i.redd.it/v.redd.it - reddit hosted images
                redd: 'https://www.redditstatic.com/icon.png'
              };

// Variable to store the images we need to set as background
// which also includes some text and url's.
rp.photos = [];

// maybe checkout http://engineeredweb.com/blog/09/12/preloading-images-jquery-and-javascript/
// for implementing the old precache
rp.cache = {};
// use dedupAdd() and dedupVal()
rp.dedup = {};
rp.url = {
    choice: "", // c.f. setupChoices()
    root:   '', // root of redditp app
    subreddit: "",
    base: '',
    get:  '',
    api:  '',
    path: '',
    vars: ""
};

rp.fn = {};

$(function () {
    $("#navboxTitle").text("Loading Reddit Slideshow");

    const LOAD_PREV_ALBUM = -2;

    // Value for each image Type is name of Google icon
    const imageTypesIcon = {
        i: 'image',
        v: 'movie',
        e: 'ondemand_video',
        a: 'photo_library',
        l: 'file_download',
        t: 'insert_photo',
        h: 'message',
        X: 'broken_image'
    };
    // Each must be different, since we compair on value, not on name
    // these map to the above enum for google icons (see typeIcon())
    const imageTypes = {
        image: 'i',
        video: 'v',
        embed: 'e',
        album: 'a',
        later: 'l',
        thumb: 't',
        html:  'h',
        fail:  'X'
    };

    const configNames = {
        nsfw: "nsfw",
        embed: "showEmbed",
        usersub: "showUserSub",
        mute: "videoMute",
        shouldAutoNextSlide: "shouldAutoNextSlide",
        timeToNextSlide: "timeToNextSlide",
        minScore: "minScore",
        redditBearer: 'redditBearer',
        redditRefreshBy: 'redditRefreshBy',
        blogger: 'blogger',
        wpv2: 'wordpressv2',
        nsid: 'flickrnsid',
        favicon: 'favicon',
        decivolume:  'decivolume',
        insecure: 'insecure'
    };

    // takes an integer number of seconds and returns eithe days, hours or minutes
    function sec2dms(secs) {
        if (secs >= 31556736)
            return Math.floor(secs/31556736)+'y';
        if (secs >= 604800)
            return Math.floor(secs/604800)+'w';
        if (secs >= 86400)
            return Math.floor(secs/86400)+'d';
        if (secs >= 3600)
            return Math.floor(secs/3600)+'h';
        if (secs > 60)
            return Math.floor(secs/60)+'m';
        else
            return "1m";
    }

    // Limit output to 3 significant digits
    function humanReadInt(val) {
        var suffix;
        if (val >= 1000000) {
            val /= 1000000;
            suffix = "M";
        } else if (val >= 1000) {
            val /= 1000;
            suffix = "K";
        } else
            return val;

        if (val > 100)
            return val.toFixed(0)+suffix;
        else
            return val.toFixed(1)+suffix;
    }

    var getNextPhotoOk = function(pic) {
        var photo = photoParent(pic);

        if (!rp.settings.nsfw && photo.over18)
            return false;

        if (pic.type == imageTypes.fail)
            return false;

        return true;
    };

    var getNextSlideIndex = function(currentIndex) {
        for(var i = currentIndex + 1; i < rp.photos.length; i++) {
            if (!getNextPhotoOk(rp.photos[i]))
                continue;
            return i;
        }
        return currentIndex;
    };

    var getPrevSlideIndex = function(currentIndex) {
        for(var i = currentIndex - 1; i >= 0; i--) {
            if (!getNextPhotoOk(rp.photos[i]))
                continue;
             return i;
        }
        log.debug("["+currentIndex+"] Couldn't find previous index.");
        return currentIndex;
    };

    function loadMoreSlides() {
        if (rp.session.loadAfter !== null &&
            (!rp.session.loginNeeded || rp.session.loginExpire))
            rp.session.loadAfter();
    }

    function nextAlbumSlide() {
        nextSlide(true);
    }

    function nextSlide(inalbum) {
        var index, albumIndex;

        if (inalbum === undefined || inalbum == false || rp.session.activeIndex < 0) {
            albumIndex = -1; // need to increment
            index = getNextSlideIndex(rp.session.activeIndex);
            if (index == rp.session.activeIndex) {
                loadMoreSlides()
                return;
            }

        } else {
            albumIndex = rp.session.activeAlbumIndex;
            if (albumIndex < 0)
                albumIndex = -1;
            index = rp.session.activeIndex;
        }

        while(index < rp.photos.length) {
            var photo = rp.photos[index];
            if (photo === undefined) {
                log.error("FAILED to fetch photo index: "+index);
                return;
            }
            if (photo.type == imageTypes.album) {
                for (var i = albumIndex+1; i < photo.album.length; ++i) {
                    if (!getNextPhotoOk(photo.album[i]))
                        continue;
                    startAnimation(index, i);
                    return;
                }

            } else if (index != rp.session.activeIndex) {
                startAnimation(index);
                return;
            }

            albumIndex = getNextSlideIndex(index);
            if (albumIndex == index) {
                loadMoreSlides();
                return;
            }

            index = albumIndex;
            albumIndex = -1;
        }
    }

    function prevAlbumSlide() {
        prevSlide(true);
    }

    function prevSlide(inalbum) {
        var index, albumIndex;

        if (inalbum === undefined || inalbum == false) {
            index = getPrevSlideIndex(rp.session.activeIndex);
            // short circuit if there's no earlier available index
            if (index == rp.session.activeIndex)
                return;

            albumIndex = 1; // need to decrement later
            inalbum = false;
        } else {
            albumIndex = rp.session.activeAlbumIndex;
            index = rp.session.activeIndex;
        }
        if (index < 0)
            return;

        do {
            if (rp.photos[index] === undefined)
                log.error("FAILED to fetch photo index: "+index);
            if (rp.photos[index].type == imageTypes.album) {
                if (albumIndex == LOAD_PREV_ALBUM)
                    albumIndex = rp.photos[index].album.length;

                if (albumIndex > 0) {
                    for (var i = albumIndex-1; i >= 0; --i) {
                        if (!getNextPhotoOk(rp.photos[index].album[i]))
                            continue;
                        startAnimation(index, i);
                        return;
                    }
                }

            } else if (index != rp.session.activeIndex || index == 0) {
                startAnimation(index, LOAD_PREV_ALBUM);
                return;
            }
            index = getPrevSlideIndex(index);
            if (inalbum)
                albumIndex = LOAD_PREV_ALBUM;
            else
                albumIndex = 1;
        } while (index >= 0 && index != rp.session.activeIndex);
    }

    var autoNextSlide = function () {
        if (rp.settings.shouldAutoNextSlide) {
            // startAnimation takes care of the setTimeout
            nextAlbumSlide();
            return true;
        }
        return false;
    };

    var shouldStillPlay = function(index) {
        if (index != rp.session.activeIndex)
            return false;
        var photo = rp.photos[index];
        if (!photo)
            return false;
        if (photo.times == 1) {
            if (photo.duration < rp.settings.timeToNextSlide)
                photo.times = Math.ceil(rp.settings.timeToNextSlide/photo.duration);
            return false;
        }
        photo.times -= 1;
        return true;
    };

    var youtubeURL = function(id, start) {
        var ytExtra = '?';
        if (start !== undefined)
            ytExtra += 'start='+start+'&';

        ytExtra += 'autoplay=1&origin='+encodeURI(window.location.origin);
        //var ytExtra = '?enablejsapi=1';
        return 'https://www.youtube.com/embed/'+id+ytExtra;
    };

    var tumblrJsonURL = function(hn, id) {
        var sid = "";
        if (id)
            sid = '&id='+id;

        // reblog_info=true to get "duplicate" information for reblogged_from_* and reblogged_root_*
        return 'https://api.tumblr.com/v2/blog/'+hn+'/posts?reblog_info=true&api_key='+rp.api_key.tumblr+sid;
    }

    var flickrJsonURL = function(method, args) {
        if (!args)
            args = {};
        return 'https://www.flickr.com/services/rest/?method='+method+'&api_key='+rp.api_key.flickr+
            Object.keys(args).map(function(k){ return '&'+k+'='+args[k]}).join("")+
            '&format=json&jsoncallback=?';
    }

    var _infoAnchor = function(url, text, urlalt, classes) {
        if (urlalt === undefined)
            urlalt = "";
        if (classes === undefined)
            classes = "info infol";
        return $('<a>', {href: url, class: classes, title: urlalt}).html(text);
    }

    // url - foreign URL
    // local - local URL
    // -- optional --
    // text - text of local Url (default: local URL)
    // urlalt - alt text of foreign and local URLs
    // favicon - url of favicon
    // classes - additional class of links (default: "info")
    var _localLink = function(url, local, text, urlalt, favicon, classes) {
        if (text === undefined)
            text = local;
        if (urlalt === undefined)
            urlalt = "";
        // favicon set in setFavicon
        if (classes === undefined)
            classes = "info";

        var data = $('<div/>');
        data.append(_infoAnchor(rp.url.base+local, text, urlalt, classes+" infol local"));
        var link = _infoAnchor(url, '', urlalt, classes+" infor remote");
        if (favicon === "reddit") {
            if (rp.session.showRedditLink)
                link.html($('<img>', { class: "reddit",
                                       src: rp.url.root+'images/reddit.svg' }));
        } else if (favicon !== null)
            setFavicon(link, { url: url, favicon: favicon });
        data.append(link);
        return data.html();
    };

    var redditLink = function(path, pathalt, pathname) {
        return _localLink(rp.redditBaseUrl+path, path, pathname, pathalt, "reddit");
    };

    // Same as redditLink, but no info class
    var titleRLink = function(path, pathname) {
        return _localLink(rp.redditBaseUrl+path, path, pathname, undefined, "reddit", "");
    };

    var titleLLink = function(url, path, pathname) {
        return _localLink(url, path, pathname, undefined, undefined, "");
    };

    var localLink = function(url, text, local, urlalt, favicon) {
        return _localLink(url, local, text, urlalt, favicon);
    };

    var localLinkFailed = function(url, text, local, urlalt, favicon) {
        return _localLink(url, local, text, urlalt, favicon, "info failed");
    };

    var gfycatApiUserLink = function(user, type) {
        if (type == 'gfycat')
            return localLink('https://gfycat.com/@'+user, user, '/gfycat/'+user);
        else if (type == 'redgifs')
            return localLink('https://www.redgifs.com/users/'+user, user, '/redgifs/'+user);
        else
            throw("Uknown gfycat API user: "+type);
    };

    var titleFLink = function(url, text) {
        var data = $('<div/>');
        data.append($('<a>', { href: url, class: "remote infor" }).html(text));
        return data.html();
    };

    // info - foreign link
    // text - Text of foreign link
    var infoLink = function(url, text) {
        var data = $('<div/>');
        data.append(_infoAnchor(url, text));
        return data.html();
    };

    var typeIcon = function(type) {
        return googleIcon(imageTypesIcon[type]);
    };

    var googleIcon = function(icon_name) {
        return $('<i>', { class: 'material-icons' }).text(icon_name);
    };

    var playButton = function(cb) {
        var lem = $('<a>', { title: 'Play Video (Enter)',
                             href: '#' }).html(googleIcon('play_circle_filled'));
        lem.click(function (event) {
            if (event) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
            clearSlideTimeout();
            cb();
        });
        return $('<span>', { id: 'playbutton' }).html(lem);
    }

    var unescapeHTML = function(blob) {
        return $('<div />').html(blob).text();
    };

    function open_in_background(selector){
        var link = $(selector)[0];
        open_in_background_url(link);
    }

    function open_in_background_url(link){
        // as per https://developer.mozilla.org/en-US/docs/Web/API/event.initMouseEvent
        // works on latest chrome, safari and opera
        if (link === undefined)
            return;

        // Pause Auto-Next
        if (rp.settings.shouldAutoNextSlide)
            $("#autoNextSlide").click();

        window.open(link.href, '_blank');
    }

    var volume_set = function(vol) {
        if (!isFinite(vol))
            vol = rp.settings.decivolume;
        var viaclick = false;
        if (vol > 10)
            vol = 10;
        else if (vol <= 0) {
            if (!isVideoMuted())
                viaclick = true;
            vol = 1;
        } else if (isVideoMuted() && vol > rp.settings.decivolume)
            viaclick = true;
        rp.settings.decivolume = vol;
        setConfig(configNames.decivolume, rp.settings.decivolume);
        $('#navboxVolume').html(rp.settings.decivolume);

        if (viaclick)
            $('#mute').click();
        else
            updateVideoMute();
    }

    var volume_adjust = function(val) {
        if (!isFinite(val))
            val = parseInt($(this).data('value'), 10);
        if (val > 0 && isVideoMuted())
            $('#mute').click();
        else
            volume_set(rp.settings.decivolume+val);
    }

    // **************************************************************
    // URL processign Helpers
    //

    // onlysld (optional) - SLD.TLD
    var hostnameOf = function(url, onlysld) {
        var hostname = $('<a>').attr('href', url).prop('hostname');
        if (onlysld === undefined)
            onlysld=false;
        if (onlysld) {
            var a = hostname.match(/[^.]*\.[^.]*$/);
            if (a)
                hostname = a[0];
        }
        return hostname;
    };
    var pathnameOf = function(url) {
        return $('<a>').attr('href', url).prop('pathname');
    };

    // ORIGIN == PROTO://HOSTNAME:PORT
    var originOf = function(url) {
        return $('<a>').attr('href', url).prop('origin');
    };

    var searchOf = function(url)  {
        var a = {};
        var b = $('<a>').attr('href', url).prop('search').substring(1);
        b.split('&').forEach(function(val) {
            var arr = val.split('=');
            a[arr[0]] = arr[1];
        });
        return a;
    };

    var searchValueOf = function(url, key) {
        return searchOf(url)[key];
    };

    var extensionOf = function(url) {
        var path = pathnameOf(url);
        var dotLocation = path.lastIndexOf('.');
        if (dotLocation < 0)
            return '';
        var end = path.lastIndexOf(':');
        if (end < dotLocation)
            end = undefined;
        return path.substring(dotLocation+1, end);
    };

    // Take a URL and strip it down to the "shortid"
    // url2shortid(url [, index [, seperator]])
    // Index actually starts at 1 since 0 is always empty
    // "/this/is/a/path/".split('/') == [ "", "this", "is", "a", "path", "" ]
    // seperator (usually '-') seperates chafe from shortid
    // hostname.tld/media/this-is-a-title-SHORTID/widget.extention
    // url2shortid(url, 2, '-') yields SHORTID
    var url2shortid = function(url, index, sep) {
        var shortid;
        var path = pathnameOf(url);

        var a = path.split('/');
        if (a[a.length-1] == "")
            a.pop();

        if (index === undefined || index == -1 || index >= a.length)
            index = a.length-1;

        shortid = a[index];

        // Trim off file extenstion
        if (shortid.indexOf('.') != -1)
            shortid = shortid.substr(0, shortid.lastIndexOf('.'));

        // Trim down chafe-chafe-chafe<SEP><SHORTID>
        if (sep !== undefined && shortid.indexOf(sep) != -1)
            shortid = shortid.substr(shortid.lastIndexOf(sep)+sep.length);

        if (!shortid)
            throw("No shortid for url");

        return shortid;
    };

    rp.fn.url2shortid = url2shortid;

    var isImageExtension = function (url) {
        var extension = extensionOf(url);
        if (extension === '')
            return false;

        if (rp.settings.goodImageExtensions.indexOf(extension) >= 0)
            return extension;

        else
            return false;
    };

    var isVideoExtension = function (url) { 
        var extension = extensionOf(url);
        if (extension === '')
            return false;

        if (rp.settings.goodVideoExtensions.indexOf(extension) >= 0)
            return extension;

        else
            return false;
    };

    //
    // Get Values from photo (or album item)
    //
    var picTitle = function(pic) {
        if (pic.title)
            return pic.title;
        var photo = photoParent(pic);
        if (photo.title)
            return photo.title;
        return "";
    };
    var picTitleText = function(pic) {
        return $("<div />").html(picTitle(pic)).text();
    };
    var picFlair = function(pic) {
        if (pic.flair !== undefined)
            return pic.flair;
        var photo = photoParent(pic);
        if (photo.flair !== undefined)
            return photo.flair;
        return "";
    };
    var picExtra = function(pic) {
        if (pic.extra !== undefined)
            return pic.extra;
        var photo = photoParent(pic);
        if (photo.extra !== undefined)
            return photo.extra;
        return "";
    };

    // **************************************************************
    // rp.dedup Helper functions
    //

    // orig_sub and orig_id are optional for SELF links
    var dedupAdd = function(sub, id, link) {
        if (!link)
            link = "SELF";
        if (!rp.dedup[sub])
            rp.dedup[sub] = {};
        if (!rp.dedup[sub][id])
            rp.dedup[sub][id] = link;
        return rp.dedup[sub][id];
    };

    var dedupVal = function(sub, id) {
        return (rp.dedup[sub]) ?rp.dedup[sub][id] :undefined;
    };

    // **************************************************************

    $("#pictureSlider").touchwipe({
        // wipeLeft means the user moved his finger from right to left.
        wipeLeft: nextAlbumSlide,
        wipeRight: prevAlbumSlide,
        wipeUp: prevSlide,
        wipeDown: nextSlide,
        min_move_x: 20,
        min_move_y: 20,
        preventDefaultEvents: false
    });

    var STATE = "openstate";
    $('.hcollapser').click(function () {
        var state = $(this).data(STATE);
        var sym;
        if (state == "open") {
            // close it
            sym = $(this).attr('symbol-close');
            if (sym)
                $(this).html(sym);
            else
                $(this).html("&rarr;");
            // move to the left just enough so the collapser arrow is visible
            var arrowLeftPoint = $(this).position().left;
            $(this).parent().animate({
                left: "-" + arrowLeftPoint + "px"
            });
            $(this).data(STATE, "closed");
        } else {
            // open it
            sym = $(this).attr('symbol-open');
            if (sym)
                $(this).html(sym);
            else
                $(this).html("&larr;");
            $(this).parent().animate({
                left: "0px"
            });
            $(this).data(STATE, "open");
        }
    });

    $('.vcollapser').click(function () {
        var state = $(this).data(STATE);
        var divname = $(this).data('controldiv');
        var div = $('#'+divname);
        var sym;
        if (state == "open") {
            // close it
            sym = $(this).data('closehtml') || $(this).attr('symbol-close');
            if (sym)
                $(this).html(sym);
            else
                $(this).html("&darr;"); // down arrow
            $(div).hide();
            $(this).data(STATE, "closed");
        } else { // closed or empty
            // open it
            sym = $(this).attr('symbol-open');
            if (sym)
                $(this).html(sym);
            else
                $(this).html("&uarr;"); // up arrow
            $(div).show();
            $(this).data(STATE, "open");
        }
    });

    // Called to fixup input.icontoggle
    // can be invoked: fixIconToggle.call($('#NAME'))
    var fixIconToggle = function() {
        var attrname = $(this).is(':checked') ?"icon-on" :"icon-off";
        $('label[for="'+$(this).attr('id')+'"] i').text($(this).attr(attrname));
    };

    $(document).on('click', 'input.icontoggle', fixIconToggle);


    var setConfig = function (c_name, c_value) {
        var value = JSON.stringify(c_value);
        var name = "redditp-"+c_name;
        log.debug("Setting Config "+c_name+" = "+value);
        if (rp.session.fakeStorage) {
            rp.storage[c_name] = value;
            return;
        }

        try {
            window.localStorage[name] = value;

        } catch (e) {
            log.error("Real localStoage is not supported: "+e.message);
            rp.session.fakeStorage = true;
            rp.storage[c_name] = value;
        }
    };

    var getConfig = function (c_name, defaultValue) {
        // undefined in case nothing found
        var value;
        var name = "redditp-"+c_name;
        if (rp.session.fakeStorage)
            value = rp.storage[c_name];
        else
            value = window.localStorage[name];
        if (value === "undefined" || value == undefined)
            return defaultValue;
        value = JSON.parse(value);
        log.debug("Getting Config "+c_name+" = "+value);
        return value;
    };

    var clearConfig = function(c_name) {
        var name = "redditp-"+c_name;
        if (rp.session.fakeStorage)
            delete rp.storage[c_name];
        else
            delete window.localStorage[name];
    };

    var clearSlideTimeout = function(type) {
        // If type, only clear it we "should"
        if (type !== undefined &&
            !(type == imageTypes.video ||
              type == imageTypes.later ||
              (type == imageTypes.embed && rp.settings.embed)))
            return;
        log.debug('clear timout');
        window.clearTimeout(rp.session.nextSlideTimeoutId);
    };

    var resetNextSlideTimer = function (timeout) {
        if (timeout === undefined) {
            timeout = rp.settings.timeToNextSlide;
        }
        timeout *= 1000;
        window.clearTimeout(rp.session.nextSlideTimeoutId);
        log.debug('set timeout (ms): ' + timeout);
        rp.session.nextSlideTimeoutId = window.setTimeout(autoNextSlide, timeout);
    };

    var isVideoMuted = function() {
        return $("#mute").is(':checked');
    };

    var updateVideoMute = function() {
        var vid = $('#gfyvid');
        var aud = $('#gfyaudio');
        var videoMuted = isVideoMuted();
        if (vid !== undefined) {
            vid.prop('muted', videoMuted);
            if (rp.session.volumeIsMute)
                vid.prop('volume', (videoMuted) ?0 :1);
            else
                vid.prop('volume', rp.settings.decivolume/10);
        }
        if (aud !== undefined) {
            aud.prop('muted', videoMuted);
            if (rp.session.volumeIsMute)
                aud.prop('volume', (videoMuted) ?0 :1);
            else
                aud.currentTime = vid.currentTime;
                aud.prop('volume', rp.settings.decivolume/10);
        }
    };

    var updateAutoNextSlide = function () {
        rp.settings.shouldAutoNextSlide = $("#autoNextSlide").is(':checked');
        if (rp.settings.shouldAutoNextSlide) {
            $('#controlsDiv .collapser').css({color: 'red'});
        } else {
            $('#controlsDiv .collapser').css({color: ""});
        }
        setConfig(configNames.shouldAutoNextSlide, rp.settings.shouldAutoNextSlide);
        // Check if active image is a video before reseting timer
        if (rp.session.activeIndex == -1 ||
            rp.photos[rp.session.activeIndex].times === undefined)
            resetNextSlideTimer();
    };

    var updateExtraLoad = function () {
        var photo = rp.photos[rp.session.activeIndex];
        if (photo.extraLoaded)
            $('#navboxExtraLoad').html(googleIcon("check_box")).attr('title', "Extras Already Loaded");
        else if (!photo.comments || !photo.commentN)
            $('#navboxExtraLoad').html(googleIcon("speaker_notes_off")).attr('title', 'No Comments Available');
        else
            $('#navboxExtraLoad').html(googleIcon("mms")).attr('title', "Load Extras from Comments (e)");
    };

    var initState = function () {
        rp.wpv2 = getConfig(configNames.wpv2, {});
        rp.insecure = getConfig(configNames.insecure, {});
        rp.blogger = getConfig(configNames.blogger, {});
        rp.flickr.u2nsid = getConfig(configNames.nsid, {});
        // Build reverse map
        if (rp.flickr.u2nsid)
            rp.flickr.nsid2u = Object.keys(rp.flickr.u2nsid).reduce(function(obj,key){
                obj[ rp.flickr.u2nsid[key] ] = key;
                return obj;
            }, {});
        rp.faviconcache = getConfig(configNames.favicon, {});

        ["nsfw", "embed", "usersub", "mute"].forEach(function (item) {
            var config = getConfig(configNames[item]);
            var ref = $('#'+item);
            ref.change(function () {
                var id = $(this).attr('id');
                rp.settings[id] = $(this).is(':checked');
                var cl = $(this).data('toggleclass');
                if (cl) {
                    if (rp.settings[id])
                        $('.'+cl).removeClass('hidden');
                    else
                        $('.'+cl).addClass('hidden');
                }
                setConfig(configNames[id], rp.settings[id]);
            });
            if (config !== undefined)
                rp.settings[item] = config;

            if (ref.is(':checked') != rp.settings[item])
                ref.click();
            else
                fixIconToggle.call(ref)
        });

        $('#mute').change(updateVideoMute);

        var autoByConfig = getConfig(configNames.shouldAutoNextSlide);
        $('#autoNextSlide').change(updateAutoNextSlide);
        if (autoByConfig !== undefined)
            rp.settings.shouldAutoNextSlide = autoByConfig;
        if ($("#autoNextSlide").is(':checked') != rp.settings.shouldAutoNextSlide)
            $("#autoNextSlide").click();
        else
            updateAutoNextSlide();

        var updateTimeToNextSlide = function (c_val) {
            if (!isFinite(c_val))
                c_val = $('#timeToNextSlide').val();
            var val = parseFloat(c_val);
            if (!(val > 0))
                return;
            rp.settings.timeToNextSlide = val;
            setConfig(configNames.timeToNextSlide, rp.settings.timeToNextSlide);
            $('#timeToNextSlide').val(rp.settings.timeToNextSlide);
        };
        updateTimeToNextSlide(getConfig(configNames.timeToNextSlide));

        var updateMinScore = function(c_val) {
            if (!isFinite(c_val))
                c_val = $('#minScore').val();
            var val = parseInt(c_val, 10);
            if (!(val >= 0))
                return;
            rp.settings.minScore = val;
            setConfig(configNames.minScore, rp.settings.minScore);
            $('#minScore').val(rp.settings.minScore);
        };
        updateMinScore(getConfig(configNames.minScore));

        volume_set(getConfig(configNames.decivolume));
        $("a.volume").click(volume_adjust);

        $('#fullscreen').change(function() {
            var elem = document.getElementById('page');
            if (document.fullscreenElement || // alternative standard method
                document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) { // current working methods
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.msExitFullscreen) {
                    document.msExitFullscreen();
                } else if (document.mozCancelFullScreen) {
                    document.mozCancelFullScreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                }
            } else {
                if (elem.requestFullscreen) {
                    elem.requestFullscreen();
                } else if (elem.msRequestFullscreen) {
                    elem.msRequestFullscreen();
                } else if (elem.mozRequestFullScreen) {
                    elem.mozRequestFullScreen();
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
                }
            }
        });

        $('#timeToNextSlide').keyup(updateTimeToNextSlide);
        $('#minScore').keyup(updateMinScore);

        $('#prevButton').click(prevAlbumSlide);
        $('#nextButton').click(nextAlbumSlide);

        $('#subredditForm').on('submit', function (event) {
            if (event) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
            processUrls($('#subredditUrl').val());
            $('#subredditUrl').blur();
        });
        $('#subredditUrl').keyup(function (event) {
            // don't forward keyup to document
            if (event) {
                event.preventDefault();
                event.stopImmediatePropagation();
            }
        });

        // Remove elements that require ability to login
        if (hostnameOf(rp.redirect) != window.location.hostname)
            $('.canlogin').remove();
        else
            $('.needlogin').hide();

        // OS/Browser Specific
        if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
            var v = (navigator.userAgent).match(/OS (\d+)/);
            if (parseInt(v[1], 10) < 10) {
                log.debug("User Agent is pre-10 iOS");
                rp.session.needsPlayButton = true;
                // no volume or mute/unmute support
                $('.volume-mute').hide();
                $('.volume').hide();
            } else {
                rp.session.volumeIsMute = true;
                // volume can be used as a mute button
                // 0 - muted
                // 1 - user controlled volume
                log.debug("User Agent is 10+ iOS");
            }
            // caues fatfinger presses
            rp.session.showRedditLink = false;

            // Hide useless "fullscreen" button on iOS safari
            $('#fullscreen').parent().remove();

            // New mobile site doesn't work for auth if not logged in
            rp.redditLoginUrl = 'https://old.reddit.com';

            // Remove :hover on #loginLi, so it only responds to clicks
            $('#loginLi').removeClass('use-hover');

            $(document).on('click', 'a.remote', function (event) {
                if (event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
                open_in_background($(this));
            });
        }
        if (rp.session.volumeIsMute) {
            $('.volume').hide();
        }
    };

    var addNumberButton = function (numberButton) {
        var buttonUl = $("#allNumberButtons");
        var newListItem = $("<li />").appendTo(buttonUl);
        numberButton.appendTo(newListItem);
    };

    var initPhotoImage = function(photo, url) {
        var oldType = photo.type;
        photo.type = imageTypes.image;
        if (url !== undefined)
            photo.url = url;
        if (oldType != photo.type)
            fixPhotoButton(photo);
    };

    var initPhotoThumb = function(photo, url) {
        photo.url = (url) ?url :photo.thumb;
        photo.type = imageTypes.thumb;
        fixPhotoButton(photo);
    };

    var initPhotoFailed = function(photo) {
        photo.type = imageTypes.fail;

        delete photo.album;

        fixPhotoButton(photo);
    };

    var initPhotoEmbed = function(photo, url, thumb) {
        photo.type = imageTypes.embed;
        if (url !== undefined)
            photo.url = url;
        if (thumb && !photo.thumb)
            photo.thumb = thumb;
        fixPhotoButton(photo);
    };

    var initPhotoYoutube = function(photo, shortid, startat) {
        var oldthumb = photo.thumb;
        initPhotoEmbed(photo, youtubeURL(shortid, startat));
        photo.thumb = 'https://i.ytimg.com/vi/'+shortid+'/maxresdefault.jpg';
        if (!photo.fb_thumb)
            photo.fb_thumb = [];
        photo.fb_thumb.push('https://i.ytimg.com/vi/'+shortid+'/hqdefault.jpg');
        if (oldthumb)
            photo.fb_thumb.push(oldthumb);
    };

    var addPhotoDupe = function(photo, dupe) {
        if (photo.id == dupe.id &&
            photo.subreddit == dupe.subreddit &&
            ((photo.tumblr) ?photo.tumblr.blog :undefined) == dupe.tumblr)
            return 0;
        for(var i = 0; i < photo.dupes.length; ++i) {
            if (photo.dupes[i].id == dupe.id &&
                photo.dupes[i].subreddit == dupe.subreddit &&
                photo.dupes[i].tumblr == dupe.tumblr)
                return -i;
        }
        return photo.dupes.push(dupe);
    };

    var addVideoUrl = function(photo, type, url) {
        if (!photo.video[type])
            photo.video[type] = url;
        else if (Array.isArray(photo.video[type]))
            photo.video[type].push(url);
        else
            photo.video[type] = [ photo.video[type], url ];
    }

    // url is undefined, string, or array
    var initPhotoVideo = function (photo, url, thumbnail) {
        photo.type = imageTypes.video;
        photo.video = {};
        var urls;

        if (url === undefined)
            urls = [ photo.url ];

        else if (Array.isArray(url))
            urls = url;

        else
            urls = [ url ];

        urls.forEach(function(url) {
            if (!url)
                return;

            var extension = isVideoExtension(url);
            if (!extension) {
                log.debug("video missing extension ("+url+"), using mp4 photo: ", photo.url);
                extension = 'mp4';
            }
            addVideoUrl(photo, extension, url);
        });

        if (thumbnail !== undefined)
            photo.video.thumb = fixupUrl(thumbnail);

        else if (photo.thumb)
            photo.video.thumb = photo.thumb;

        fixPhotoButton(photo);
    };

    var initPhotoHtml = function(photo, html) {
        photo.type = imageTypes.html;
        photo.html = html;

        fixPhotoButton(photo);
    };

    var isActive = function (pic) {
        var photo = photoParent(pic);
        return (photo.index !== undefined &&
                photo.index == rp.session.activeIndex);
    };

    // re-index Album elements starting from index
    var reindexPhotoAlbum = function(photo, index) {
        if (index === undefined)
            index = 0;

        if (!isActive(photo))
            return;

        for (var i = index; i < photo.album.length; ++i) {
            var a = $('#albumNumberButtons ul').children(":nth-child("+(i+1)+")").children("a");
            var oldindex = a.data('index');

            a.attr('id', "albumButton" + (i+1)).data('index', i).text(i+1);

            fixPhotoButton(photo.album[i], a);

            // Update rp.cache when re-indexing if required
            if (rp.cache[photo.index] !== undefined &&
                rp.cache[photo.index][oldindex] !== undefined) {
                rp.cache[photo.index][i] = rp.cache[photo.index][oldindex];
                rp.cache[photo.index][oldindex] = undefined;
            }
        }
    };

    // unwind albumifcation if album has only 1 element.
    var checkPhotoAlbum = function(photo) {
        if (photo.type != imageTypes.album) {
            fixPhotoButton(photo);
            return;
        }

        if (photo.album.length > 1) {
            fixPhotoButton(photo);
            log.debug("["+rp.session.activeIndex+"]["+rp.session.activeAlbumIndex+"] checked photo:"+photo.index);
            // Advance to first album item if needed
            if (isActive(photo))
                startAnimation(photo.index, indexPhotoAlbum(photo, photo.index, rp.session.activeAlbumIndex));
            return;
        }

        // creating album failed
        if (photo.album.length == 0) {
            log.info("failed photo album [album length 0]: "+photo.url);
            initPhotoFailed(photo);
            return;
        }

        // Resurect Initial image
        var pic = photo.album[0];
        if (pic.type == imageTypes.image ||
            pic.type == imageTypes.later ||
            pic.type == imageTypes.fail ||
            pic.type == imageTypes.thumb ||
            pic.type == imageTypes.embed) {
            photo.type = pic.type;
            photo.url = pic.url;

        } else if (pic.type == imageTypes.video) {
            photo.type = pic.type;
            photo.video = pic.video;

        } else if (pic.type == imageTypes.html) {
            photo.type = pic.type;
            photo.html = pic.html;

        } else {
            log.error("Delete of bad type:"+pic.type+" for photo: "+photo.url);
            return;
        }
        if (!photo.date && pic.date)
            photo.date = pic.date;
        if (!photo.extra && pic.extra)
            photo.extra = pic.extra;
        log.debug("moved first album to primary item: "+photo.url);
        fixPhotoButton(photo);
        delete photo.album;
    };

    var initPhotoAlbum = function (pic, keepfirst) {
        var photo = photoParent(pic);
        if (keepfirst === undefined)
            keepfirst = true;

        if (photo.type != imageTypes.album) {
            var img = {
                url: photo.url,
                thumb: photo.thumb,
                type: photo.type,
                extra: photo.extra,
            };
            delete photo.extra;

            if (photo.type == imageTypes.video) {
                img.video = photo.video;
                delete photo.video;

            } else if (pic.type == imageTypes.html) {
                img.html = photo.html;
                delete photo.html;
            }

            photo.type = imageTypes.album;
            photo.insertAt = -1;
            photo.album = [];

            if (keepfirst) {
                if (!processPhoto(img))
                    initPhotoFailed(img);
                log.debug("moved primary to first album item: "+img.url);
                addAlbumItem(photo, img);
            } else if (photo.o_url === undefined)
                photo.o_url = photo.url;
            return photo;
        }

        // If we want to keep everything, just return
        if (keepfirst)
            return photo;

        // if initPhotoAlbum(photo, true) was called but we need to kill it, if it's
        // re-called with false.
        if (photo.album.length > 0 && pic == photo && photo.url == photo.album[0].url)
            pic = photo.album[0];

        if (photo !== pic) {
            // remove old AlbumItem
            var index = photo.album.indexOf(pic);
            if (index >= 0) {
                photo.insertAt = index;
                photo.album.splice(index, 1);
                if (isActive(photo)) {
                    $('#albumNumberButtons ul').children(":nth-child("+(index+1)+")").remove();
                    reindexPhotoAlbum(photo, index);
                }
            }
        }
        return photo;
    };

    // Call to destroy album
    var laterPhotoFailed = function(photo) {
        // don't clear if album was populated
        if (photo.type == imageTypes.album &&
            photo.album.length > 0) {
            log.error("laterPhotoFailed called on valid album: "+photo.url);
            return;
        }

        initPhotoFailed(photo);
    };


    // Call after all addAlbumItem calls
    // setup number button and session.activeAlbumIndex
    // returns index of image to display
    var indexPhotoAlbum = function (photo, imageIndex, albumIndex) {
        if (photo.type != imageTypes.album)
            return -1;

        if (imageIndex < 0)
            return 0;

        if (albumIndex !== undefined) {
            if (albumIndex == LOAD_PREV_ALBUM ||
                albumIndex >= photo.album.length)
                return photo.album.length-1;

            if (albumIndex >= 0)
                return albumIndex;
        }

        if (imageIndex != rp.session.activeIndex)
            return 0;

        if (rp.session.activeAlbumIndex == LOAD_PREV_ALBUM)
            return photo.album.length-1;

        if (rp.session.activeAlbumIndex == -1)
            return 0;

        return rp.session.activeAlbumIndex;
    };

    var albumButtonLi = function (pic, index) {
        var button = $("<a />", { class: "numberButton albumButton",
                                  title: picTitleText(pic),
                                  id: "albumButton" + (index + 1)
                                }).data("index", index).html(index + 1);
        addButtonClass(button, pic);
        return $('<li>').append(button);
    };

    var populateAlbumButtons = function (photo) {
        // clear old
        $("#albumNumberButtons").detach();

        var div = $("<div>", { id: 'albumNumberButtons',
                               class: 'numberButtonList'
                             });
        var ul = $("<ul />");
        div.append(ul);

        if (photo.type == imageTypes.album) {
            $.each(photo.album, function(index, pic) {
                ul.append(albumButtonLi(pic, index));
            });

            if ($('#albumCollapser').data(STATE) == "closed")
                $(div).hide();
        } else {
            $(div).hide();
        }
        $("#navboxContents").append(div);
    };

    var photoParent = function(pic) {
        if (pic.parentIndex !== undefined)
            return rp.photos[pic.parentIndex];
        if (pic.parent !== undefined)
            return pic.parent;
        return pic;
    };

    var addPhotoParent = function(pic, parent) {
        if (parent.index !== undefined)
            pic.parentIndex = parent.index;
        else
            pic.parent = parent;
    };

    var isAlbumDupe = function (photo, url) {
        for(var i = 0; i < photo.album.length; ++i) {
            if ((photo.album[i].url == url) ||
                (photo.album[i].o_url && photo.album[i].o_url == url)
               )
                return true
            if (photo.album[i].type == imageTypes.video &&
                Object.values(photo.album[i].video).includes(url)
               )
                return true
        }
        return false;
    }

    var addAlbumItem = function (photo, pic) {
        // check for duplicates
        if (isAlbumDupe(photo, pic.url)) {
            log.debug("cannot display url [sub-album dup]: "+pic.url);
            return;
        }
        // promote nsfw tag from album item to main photo
        if (pic.over18 === true)
            photo.over18 = true;
        delete pic.over18; // only track nsfw on main photo

        addPhotoParent(pic, photo);
        var sld = hostnameOf(pic.url, true).match(/[^.]*/)[0];
        if (rp.favicons[sld])
            pic.favicon = rp.favicons[sld];

        else if (photo.favicon !== undefined &&
                 hostnameOf(photo.url, true) == hostnameOf(pic.url, true))
            pic.favicon = photo.favicon;

        if (photo.insertAt < 0) {
            photo.album.push(pic);
            if (isActive(photo))
                $('#albumNumberButtons ul').append(albumButtonLi(pic, photo.album.length-1));

        } else {
            var index = photo.insertAt++;
            photo.album.splice(index, 0, pic);
            if (isActive(photo)) {
                $('#albumNumberButtons ul').children(":nth-child("+(photo.insertAt)+")").after(albumButtonLi(pic, photo.insertAt));
                reindexPhotoAlbum(photo, index);
            }
        }
    };

    var fixPhotoButton = function(pic, button) {
        var parent = photoParent(pic);

        // no buttons exist
        if (parent.index === undefined)
            return;

        if (pic == parent) {
            if (button == undefined)
                button = $('#numberButton'+(pic.index+1));

        } else if (!isActive(parent))
            return;

        else if (button == undefined)
            button = $('#albumNumberButtons ul').children(":nth-child("+(parent.album.indexOf(pic)+1)+")").children("a");

        button.removeClass('embed album over18 later video failed html');
        if (isActive(parent))
            $("#albumNumberButtons").hide();

        addButtonClass(button, pic);
    };

    var processPhoto = function(pic) {
        if (pic === undefined ||
            pic.url === undefined)
            return false;

        if (pic.o_url === undefined)
            pic.o_url = pic.url;

        if (pic.type === undefined)
            pic.type = imageTypes.image;

        else if (pic.type == imageTypes.fail)
            return false;

        pic.url = fixupUrl(pic.url);
        // hostname only: second-level-domain.tld
        var hostname = hostnameOf(pic.url, true);
        var sld = hostname.match(/[^.]*/)[0];

        if (rp.favicons[sld] && pic.type != imageTypes.thumb)
            pic.favicon = rp.favicons[sld];

        // If this already has an album attached
        if (pic.type == imageTypes.album &&
            pic.album !== undefined)
            return true;

        // return if already setup as video
        if (pic.type == imageTypes.video &&
            pic.video !== undefined)
            return true;

        if (pic.type == imageTypes.html &&
            pic.html !== undefined)
            return true;

        // return if already setup as embeded
        if (pic.type == imageTypes.embed)
            return true;

        var shortid, a, o, host;
        var fqdn = hostnameOf(pic.url);
        var orig_hn = hostnameOf(pic.o_url, true);

        try {
            if (pic.type == imageTypes.thumb &&
                (orig_hn == 'dropbox.com' ||
                 orig_hn == 'tumblr.com')) {
                // capture items we want to skip from tryPreview()
                log.info("REJECTED: "+pic.o_url);
                return false;

            } else if (hostname == 'imgur.com') {
                pic.url = fixImgurPicUrl(pic.url);
                if (pic.url.indexOf("/a/") > 0 ||
                    pic.url.indexOf('/gallery/') > 0)
                    pic.type = imageTypes.later;

                else if (isVideoExtension(pic.url))
                    initPhotoVideo(pic);

                else if (extensionOf(pic.url) == 'gif')
                    pic.type = imageTypes.later;

                // otherwise simple image

            } else if (hostname == 'gfycat.com') {
                // set photo url to sane value (incase it's originally a thumb link)
                shortid = url2shortid(pic.url);
                // Strip everything trailing '-'
                if (shortid.indexOf('-') != -1)
                    shortid = shortid.substr(0, shortid.indexOf('-'));
                if (shortid == 'about')
                    return false;

                pic.url = 'https://gfycat.com/'+shortid;

                // These domains should be processed later, unless direct link to video
                pic.type = imageTypes.later;

            } else if (hostname == 'wordpress.com' ||
                       hostname == 'wp.com') {
                // https://iN.wp.com/WP-SITE/wp-content/uploads/YYYY/MM/INDEX.jpg ==
                // https://WP-SITE/wp-content/uploads/YYYY/MM/INDEX.jpg

                // strip out search portion
                if (isImageExtension(pic.url)) {
                    var anc = $('<a>', { href: pic.url });
                    pic.url = anc.prop('origin')+anc.prop('pathname');

                } else if (pathnameOf(pic.url) == "/")
                    throw "full-blog not post";

                else if (url2shortid(pic.url))
                    pic.type = imageTypes.later;

                else
                    return false;

            } else if (hostname == 'sta.sh' ||
                       hostname == 'fav.me') {
                shortid = url2shortid(pic.url);
                if (shortid) {
                    pic.url = originOf(pic.url)+'/'+shortid;
                    pic.type = imageTypes.later;
                }

            } else if (hostname == 'apnews.com' ||
                       hostname == 'deviantart.com' ||
                       hostname == 'livestream.com' ||
                       hostname == 'streamable.com') {
                if (url2shortid(pic.url))
                    // These domains should always be processed later
                    pic.type = imageTypes.later;

            } else if (hostname == 'twitter.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[2] == "status") {
                    pic.url = 'https://twitter.com/'+a.slice(1,4).join("/");
                    pic.type = imageTypes.later;
                } else
                    throw "unknown twitter url";

            } else if (fqdn == 'clips.twitch.tv') {
                shortid = url2shortid(pic.url);
                host = window.location.host;
                if (host)
                    initPhotoEmbed(pic, 'https://clips.twitch.tv/embed?autoplay=true&parent='+host+'&clip='+shortid);
                // can set muted=0|1
                else
                    throw "twitch needs embedding fqdn";

            } else if (hostname == 'twitch.tv') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'videos')
                    initPhotoEmbed(pic, 'https://player.twitch.tv/?video=v'+a[2]);

                else if (a[2] == 'clip') {
                    if (host)
                        initPhotoEmbed(pic, 'https://clips.twitch.tv/embed?autoplay=true&parent='+host+'&clip='+shortid);
                    // can set muted=0|1
                    else
                        throw "twitch needs embedding fqdn";


                } else
                    throw "unknown twitch url";

            } else if (hostname == 'gifs.com') {
                shortid = url2shortid(pic.url, -1, '-');
                initPhotoVideo(pic, [ 'https://j.gifs.com/'+shortid+'@large.mp4',
                                      'https://j.gifs.com/'+shortid+'.mp4' ],
                               'https://j.gifs.com/'+shortid+'.jpg');

            } else if (hostname == 'giphy.com') {
                // giphy.com/gifs/NAME-OF-VIDEO-SHORTID
                // media.giphy.com/media/SHORTID/giphy.TYPE
                // i.giphy.com/SHORTID.TYPE
                shortid = url2shortid(pic.url, 2, '-');
                initPhotoVideo(pic, 'https://i.giphy.com/media/'+shortid+'/giphy.mp4');

            } else if (hostname == 'youtube.com' ||
                       hostname == 'youtu.be') {
                // youtu.be/SHORTID
                // www.youtube.com/embed/SHORTID
                // www.youtube.com/watch?v=SHORTID
                shortid = url2shortid(pic.url);
                a = searchOf(pic.url);
                if (shortid == 'attribution_link') {
                    o = originOf(pic.url)+decodeUrl(a.u);
                    shortid = url2shortid(o);
                    a = searchOf(o);
                }
                if (shortid == 'watch')
                    shortid = a.v;
                initPhotoYoutube(pic, shortid, a.t || a.start);

            } else if (hostname == 'makeagif.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'media') {
                    o = pic.url.substring(0, pic.url.lastIndexOf('.'));
                    initPhotoVideo(pic, o+".mp4", o+".jpg");
                } else {
                    shortid = url2shortid(pic.url, -1, '-');
                    initPhotoEmbed(pic, 'https://makeagif.com/i/'+shortid);
                }

            } else if (hostname == 'pornhub.com') {
                // JSON Info about video
                // 'https://www.pornhub.com/webmasters/video_by_id?id='+shortid
                a = searchOf(pic.url);

                shortid = a.viewkey;

                if (a.pkey)
                    pic.extra = infoLink('https://www.pornhub.com/playlist/'+a.pkey, 'Playlist');

                if (shortid)
                    initPhotoEmbed(pic, 'https://www.pornhub.com/embed/'+shortid+'?autoplay=1');

                else
                    throw "search not supported";

            } else if (hostname == 'xtube.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, 'https://www.xtube.com/video-watch/embedded/'+shortid+'?embedsize=big')

            } else if (hostname == 'redtube.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, 'https://embed.redtube.com/?bgcolor=000000&autoplay=1&id='+shortid);

            } else if (hostname == 'tnaflix.com') {
                shortid = url2shortid(pic.url, -1, 'video');
                initPhotoEmbed(pic, 'https://player.tnaflix.com/video/'+shortid);

            } else if (hostname == 'tube8.com') {
                shortid = pathnameOf(pic.url);
                initPhotoEmbed(pic, 'https://www.tube8.com/embed'+shortid+'?autoplay=1');

            } else if (hostname == 'vimeo.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, 'https://player.vimeo.com/video/'+shortid+'?autoplay=1');

            } else if (hostname == 'sendvid.com' ||
                       hostname == 'vporn.com') {
                // these need full shortid
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, originOf(pic.url)+'/embed/'+shortid+'?autoplay=1');

            } else if (hostname == 'youjizz.com') {
                shortid = url2shortid(pic.url, 2, '-');
                initPhotoEmbed(pic, originOf(pic.url)+'/videos/embed/'+shortid);

            } else if (hostname == 'openload.co' ||
                       hostname.startsWith('oload.')) {
                // //openload.co/embed/SHORTID/Name_Of_original_file
                // //openload.co/f/SHORTID/Title_of_picture
                // final name/title is optional
                shortid = url2shortid(pic.url, 2);

                // no autostart
                initPhotoEmbed(pic, 'https://www.openload.co/embed/'+shortid);

            } else if (hostname == 'msnbc.com') {
                // https://www.msnbc.com/SHOW/watch/TITLE-OF-VIDEO-ID
                a = pathnameOf(pic.url).split('/');
                if (a[2] != "watch")
                    return false;
                shortid = url2shortid(pic.url, -1, '-');
                initPhotoEmbed(pic, "https://www.msnbc.com/msnbc/embedded-video/mmvo"+shortid);

            } else if (hostname == 'nbcnews.com') {
                // https://www.nbcnews.com/widget/video-embed/ID
                // https://www.nbcnews.com/video/title-of-video-ID
                // https://www.nbcnews.com/SHOW/video/title-of-video-ID
                a = pathnameOf(pic.url).split('/');
                if (! (a[1] == 'video' ||
                       a[2] == 'video' ||
                       a[2] == 'video-embed') )
                    return false;
                shortid = url2shortid(pic.url, -1, '-');

                // no autostart
                initPhotoEmbed(pic, "https://www.nbcnews.com/widget/video-embed/"+shortid);

            } else if (hostname == 'cbsnews.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'video')
                    initPhotoEmbed(pic, pic.url);
                else
                    return false;

            } else if (hostname == 'iloopit.net') {
                // VIDEO:
                // https://gifs.iloopit.net/resources/UUID/converted.gif
                // https://cdn.iloopit.net/resources/UUID/converted.{mp4,webm}
                // https://cdn.iloopit.net/resources/UUID/thumb.jpeg
                // GIFV: (no easy way to convert ID (uint32-ish) to VIDEO UUID)
                // https://iloopit.net/ID/TITLE-NAME.gifv
                // https://iloopit.net/ID/TITLE/ - though text in title doesn't matter
                var ext = extensionOf(pic.url);
                if (ext == 'gif' || isVideoExtension(pic.url)) {
                    shortid = url2shortid(pic.url, 2);
                    initPhotoVideo(pic, ['https://cdn.iloopit.net/resources/'+shortid+'/converted.mp4',
                                         'https://cdn.iloopit.net/resources/'+shortid+'/converted.webm'],
                                   'https://cdn.iloopit.net/resources/'+shortid+'/thumb.jpeg');

                } else if (ext == 'gifv')
                    initPhotoEmbed(pic);

                else if (ext == "") {
                    shortid = searchValueOf(pic.url, 'loopid');
                    if (shortid)
                        initPhotoEmbed(pic, 'https://iloopit.net/'+shortid+'/loopit/');
                    else
                        initPhotoEmbed(pic);

                } else
                    throw "unknown iloopit format";

            } else if (hostname == 'dropbox.com') {
                pic.url = originOf(pic.url)+pathnameOf(pic.url)+'?dl=1';
                if (isVideoExtension(pic.url))
                    initPhotoVideo(pic);

                else if (isImageExtension(pic.url))
                    pic.url = pic.url;

                else
                    return false;

            } else if (hostname == 'redgifs.com' ||
                       hostname == 'gifdeliverynetwork.com') {
                shortid = url2shortid(pic.url).toLowerCase();
                if (shortid.indexOf('-') != -1)
                    shortid = shortid.substr(0, shortid.indexOf('-'));
                pic.url = 'https://www.redgifs.com/watch/'+shortid;
                pic.type = imageTypes.later;

            } else if (hostname == 'clippituser.tv' ||
                       hostname == 'clippit.tv') {
                if (fqdn == 'clips.clippit.tv')
                    shortid = url2shortid(pic.url, 1);
                else
                    shortid = url2shortid(pic.url);
                initPhotoVideo(pic, ['https://clips.clippit.tv/'+shortid+'/720.mp4',
                                     'https://clips.clippit.tv/'+shortid+'/360.mp4'],
                               'https://clips.clippit.tv/'+shortid+'/thumbnail.jpg');

            } else if (hostname == "gounlimited.to") {
                shortid = url2shortid(pic.url, 1, '-');
                initPhotoEmbed(pic, originOf(pic.url)+"/embed-"+shortid+".html");

            } else if (hostname == "streamtape.com") {
                shortid = url2shortid(pic.url, 2);
                initPhotoEmbed(pic, originOf(pic.url)+"/e/"+shortid+"/")

            } else if (isVideoExtension(pic.url)) {
                initPhotoVideo(pic);

            } else if (fqdn == 'preview.redd.it') {
                pic.url = 'https://i.redd.it'+pathnameOf(pic.url);

            } else if (hostname == 'vidble.com') {
                shortid = url2shortid(pic.url);
                if (shortid == 'watch') {
                    shortid = searchValueOf(pic.url, 'v');
                    if (!shortid)
                        throw("Failed to parse vidble url");

                    initPhotoVideo(pic, 'https://www.vidble.com/'+shortid+'.mp4',
                                   'https://www.vidble.com/'+shortid+'.png');

                } else if (pic.url.indexOf("/album/") > 0)
                    // @@TODO : figure out /album/ on vidble.com/api
                    throw("no vidble album processing");

                else {
                    shortid = shortid.replace(/_.+/, '');
                    pic.url = 'https://www.vidble.com/'+shortid+'.jpg';
                }

            } else if (isImageExtension(pic.url) ||
                       fqdn == 'i.reddituploads.com') {
                // simple image

            } else if (hostname == 'tumblr.com') {
                if (pic.url.indexOf('/post/') > 0)
                    // Don't process bare tumblr blogs, nor /day/YYYY/MM/DD/ format
                    // only BLOGNAME.tumblr.com/post/SHORTID/...
                    pic.type = imageTypes.later;

                else
                    return false;

            } else if (hostname == 'worldsex.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, originOf(pic.url)+'/videos/embed/'+shortid+'?autoplay=1');

            } else if (hostname == 'd.tube') {
                a = pathnameOf(pic.url).split('/');
                initPhotoEmbed(pic, 'https://emb.d.tube/#!/'+a.slice(2,4).join('/'));

            } else if (hostname == 'facebook.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'watch' || a[2] == 'videos')
                    // @@ mute doesn't change with toggle
                    initPhotoEmbed(pic, 'https://www.facebook.com/plugins/video.php?autoplay=1&mute='+
                                   ((isVideoMuted()) ?"1" :"0")
                                   +'&show_text=0&href='+encodeURIComponent(pic.url))
                else
                    return false;

            } else if (hostname == 'gyazo.com') {
                shortid = url2shortid(pic.url);
                pic.url = 'https://i.gyazo.com/'+shortid+'.png';
                pic.fallback = [ 'https://i.gyazo.com/'+shortid+'.jpg',
                                 'https://i.gyazo.com/'+shortid+'.mp4' ];

            } else if (hostname == 'spankbang.com') {
                shortid = url2shortid(pic.url, 1);

                // no autostart
                initPhotoEmbed(pic, 'https://spankbang.com/embed/'+shortid);

            } else if (hostname == 'pixeldrain.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'u')
                    initPhotoVideo(pic, 'https://pixeldrain.com/api/file/'+a[2],
                                   'https://pixeldrain.com/api/file/'+a[2]+'/thumbnail');
                else
                    throw("Unrecognized pixeldrain url");

            } else if (hostname == 'flickr.com') {
                // flickr.com/photos/USERID/ID[/*]
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'photos' && a.length > 3)
                    pic.type = imageTypes.later;

                else
                    throw("unknown flickr url");

            } else if (hostname == 'hotnessrater.com') {
                a = pathnameOf(pic.url).split('/');
                initPhotoImage(pic, ["https://img1.hotnessrater.com", a[2], a[3]].join("/")+".jpg");

            } else if (hostname == 'pornflip.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1].length < 3)
                    shortid = a[2];
                else
                    shortid = a[1];
                initPhotoEmbed(pic, originOf(pic.url)+'/embed/'+shortid+'?t=00:00&quality=1080');

            } else if (hostname == 'streamvi.com') {
                shortid = url2shortid(pic.url);
                initPhotoVideo(pic, 'https://cdnvistreamviz.r.worldssl.net/uploads/'+shortid+'.mp4',
                               'https://cdn.streamvi.com/uploads/'+shortid+'.jpg');

            } else if (hostname == 'triller.fail') {
                shortid = searchValueOf(pic.url, 'v');
                if (!shortid)
                    shortid = url2shortid(pic.url);

                initPhotoVideo(pic, 'https://v.triller.fail/'+shortid+'.mp4');

            } else if (pic.type != imageTypes.thumb) {
                a = pathnameOf(pic.url).split('/');
                if (a.length > 2 &&
                    (a[1] == 'video' ||
                     a[1] == 'videos' ||
                     a[1] == 'watch' ||
                     a[1] == 'v')) {
                    // Sites that definitely don't work with above
                    if (hostname == 'mulemax.com' ||
                        hostname == 'watchmygf.me' ||
                        hostname == 'gothdporn.com' ||
                        hostname == 'xfantasy.tv')
                        return false;

                    shortid = url2shortid(pic.url, 2, '-');
                    var href = $('<a>').attr('href', pic.url);
                    if (href.prop('hostname').startsWith('m.'))
                        href.prop('hostname', href.prop('hostname').replace('m.', 'www.'));

                    if (shortid.match(/^\d+$/)) {
                        initPhotoEmbed(pic, href.prop('origin')+'/embed/'+shortid+'?autoplay=1');
                        return true;
                    }
                    shortid = url2shortid(pic.url, 2);
                    initPhotoEmbed(pic, href.prop('origin')+'/embed/'+shortid+'?autoplay=1');
                    return true;
                }
                return false;

            } else {
                return false;
            }
        } catch (e) {
            log.info("cannot display url ["+e+"]: "+pic.url);
            return false;
        }
        return true;
    };

    var addButtonClass = function(button, pic) {
        var photo = photoParent(pic);

        if (photo.over18)
            button.addClass("over18");

        if (photo.type == imageTypes.album && isActive(photo))
            $("#albumNumberButtons").show();

        if (pic.type == imageTypes.embed)
            button.addClass("embed");

        else if (pic.type == imageTypes.album)
            button.addClass("album");

        else if (pic.type == imageTypes.video)
            button.addClass("video");

        else if (pic.type == imageTypes.later)
            button.addClass("later");

        else if (pic.type == imageTypes.html)
            button.addClass("html");

        else if (pic.type == imageTypes.fail)
            button.addClass("failed");

    };

    // Re-entrant okay
    var addImageSlide = function (photo) {
        // Check if this photo is already in rp.photos
        if (photo.index !== undefined)
            return true;

        if (photo.dupes === undefined)
            photo.dupes = [];

        if (!processPhoto(photo)) {
            log.info('cannot display url [no image]: ' + photo.url);
            return false;
        }

        var index = rp.photos.push(photo)-1;
        photo.index = index;
        if (photo.album && photo.album.length) {
            for(var i = 0; i < photo.album.length; ++i) {
                photo.album[i].parentIndex = index;
                delete photo.album[i].parent;
            }
        }

        var numberButton = $("<a />").html(index + 1)
            .data("index", index)
            .attr("title", picTitleText(rp.photos[index]))
            .attr("id", "numberButton" + (index + 1));


        addButtonClass(numberButton, photo);

        numberButton.click(function () {
            // Retrieve the index we need to use
            var imageIndex = $(this).data("index");

            startAnimation(imageIndex);
        });
        numberButton.addClass("numberButton");
        addNumberButton(numberButton);

        // show the first valid image
        if (rp.session.activeIndex < 0)
            startAnimation(getNextSlideIndex(-1));

        // Preload images if we've missed it initially
        else if (index < rp.session.activeIndex+2)
            preloadNextImage(rp.session.activeIndex);

        return true;
    };

    var setFavicon = function(elem, pic, url) {
        var fixFavicon = function(e) {
            if (e.type == "error" ||
                this.naturalHeight <= 1 ||
                this.naturalWidth <= 1) {
                var b;
                if (e.data.backup.length > 0) {
                    var origin = e.data.backup.shift();
                    b = $("<img />", {'class': 'favicon', src: origin});
                    b.on('error', e.data, fixFavicon);
                    b.on('load',  e.data, fixFavicon);
                } else {
                    rp.faviconcache[e.data.hn] = "";
                    setConfig(configNames.favicon, rp.faviconcache);
                    b = googleIcon("link")
                }

                e.data.elem.html(b);
            } else {
                rp.faviconcache[e.data.hn] = $(this).attr('src');
                setConfig(configNames.favicon, rp.faviconcache);
            }
        };

        if (url === undefined)
            url = pic.o_url || pic.url;
        // #1 pic.favicon
        var fav = pic.favicon;
        // #2 rp.favicon[]
        if (fav === undefined) {
            var sld = hostnameOf(url, true).match(/[^.]*/)[0];
            fav = rp.favicons[sld];
        }
        var hostname = hostnameOf(url);
        // #3 rp.faviconcache
        if (fav === undefined) {
            // cached failed lookup
            if (rp.faviconcache[hostname] === "") {
                elem.html(googleIcon("link"));
                return;
            }
            fav = rp.faviconcache[hostname];
        }
        if (fav) {
            elem.html($("<img />", {'class': 'favicon', src: fav}));
            return;
        }

        // #3 try //site/favicon.ico
        var origin = originOf(url);
        var img = $("<img />", {'class': 'favicon', src: fixupUrl(origin+'/favicon.ico')});

        // #4a try originOf(pic.url)/favicon.ico (if different from pic.o_url)
        // #4b try sld-only hostname of url
        // #FINAL fallback to just link icon
        var backup = [fixupUrl(origin+'/favicon.png'),
                      fixupUrl(origin+'/favicon-16x16.png'),
                      fixupUrl(origin+'/assets/img/favicon.ico')
                     ];
        var a = hostname.split('.');
        while (a.length > 2) {
            a.shift();
            var hn = a.join('.');
            backup.push(origin.replace(hostname, hn)+'/favicon.ico');
            backup.push(origin.replace(hostname, hn)+'/favicon.png');
            backup.push(origin.replace(hostname, hn)+'/favicon-16x16.png');
        }
        // #4c check if wordpress v2 site
        if (rp.wpv2[hostname] === true)
            backup.push(rp.favicons.wordpress);

        img.on('error', { hn: hostname, elem: elem, backup: backup }, fixFavicon);
        img.on('load',  { hn: hostname, elem: elem, backup: backup }, fixFavicon);

        elem.html(img);
    };

    const arrow = {
        left: 37,
        up: 38,
        right: 39,
        down: 40
    };
    const KP_MINUS_KEY = 109; // '-'
    const KP_PLUS_KEY  = 107; // '+'
    const MINUS_KEY = 173; // '-' / '_'
    const EQUALS_KEY = 61; // '=' / '+'
    const ZERO_KEY  = 48;
    const ONE_KEY   = 49;
    const TWO_KEY   = 50;
    const THREE_KEY = 51;
    const FOUR_KEY  = 52;
    const FIVE_KEY  = 53;
    const SIX_KEY   = 54;
    const SEVEN_KEY = 55;
    const EIGHT_KEY = 56;
    const NINE_KEY  = 57;

    const SPACE = 32;
    const PAGEUP = 33;
    const PAGEDOWN = 34;
    const ENTER = 13;

    const A_KEY = 65;
    const C_KEY = 67;
    const D_KEY = 68;
    const E_KEY = 69;
    const F_KEY = 70;
    const G_KEY = 71;
    const I_KEY = 73;
    const L_KEY = 76;
    const M_KEY = 77;
    const N_KEY = 78;
    const O_KEY = 79;
    const R_KEY = 82;
    const T_KEY = 84;
    const U_KEY = 85;

    // Register keyboard events on the whole document
    $(document).keyup(function (e) {
        if (e.ctrlKey || e.altKey || e.metaKey) {
            // ctrl key is pressed so we're most likely switching tabs or doing something
            // unrelated to redditp UI
            return;
        }

        //log.info(e.keyCode, e.which, e.charCode);

        // 37 - left
        // 38 - up
        // 39 - right
        // 40 - down
        // More info: http://stackoverflow.com/questions/302122/jquery-event-keypress-which-key-was-pressed
        // http://stackoverflow.com/questions/1402698/binding-arrow-keys-in-js-jquery
        var code = e.keyCode || e.which;
        var i = 0;

        switch (code) {
        case A_KEY:
            open_in_background("#navboxAlbumOrigLink");
            break;
        case C_KEY:
            $('#controlsDiv .collapser').click();
            break;
        case T_KEY:
            $('#titleDiv .collapser').click();
            break;
        case D_KEY:
            open_in_background("#navboxDuplicatesLink");
            break;
        case F_KEY:
            $('#fullscreen').click();
            break;
        case G_KEY:
            open_in_background('#navboxImageSearch');
            break;
        case I_KEY:
            open_in_background("#navboxLink");
            break;
        case L_KEY:
            open_in_background("#navboxOrigLink");
            break;
        case M_KEY:
            $('#mute').click();
            break;
        case N_KEY:
            $('#nsfw').click();
            break;
            // O_KEY is with ZERO_KEY below
        case R_KEY:
            open_in_background("#navboxDuplicatesMulti");
            break;
        case E_KEY:
            $('#navboxExtraLoad').click();
            break;
        case SPACE:
            $("#autoNextSlide").click();
            break;
        case ENTER:
            $('#playbutton a').click();
            break;
        case KP_PLUS_KEY:
        case EQUALS_KEY:
            volume_adjust(+1);
            break;
        case KP_MINUS_KEY:
        case MINUS_KEY:
            volume_adjust(-1);
            break;
        case PAGEUP:
        case arrow.up:
            prevSlide();
            break;
        case arrow.left:
            prevAlbumSlide();
            break;
        case PAGEDOWN:
        case arrow.down:
            nextSlide();
            break;
        case arrow.right:
            nextAlbumSlide();
            break;
        case U_KEY:
            $("#duplicateCollapser").click();
            break;
        case NINE_KEY:
            ++i;
        case EIGHT_KEY:
            ++i;
        case SEVEN_KEY:
            ++i;
        case SIX_KEY:
            ++i;
        case FIVE_KEY:
            ++i;
        case FOUR_KEY:
            ++i;
        case THREE_KEY:
            ++i;
        case TWO_KEY:
            ++i;
        case ONE_KEY:
            if ($('#duplicateUl li .infor')[i])
                open_in_background_url($('#duplicateUl li .infor')[i]);
            break;
        case O_KEY: // open comment
        case ZERO_KEY:
            open_in_background_url($('#navboxSubreddit a:last-of-type')[0]);
            break;
        }
    });

    // Capture all clicks on infop links (links that direct locally
    $(document).on('click', 'a.local', function (event) {
        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
        if ($('#login').is(':checked'))
            $('#login').click();
        if ($('#choice').is(':checked'))
            $('#choice').click();

        var path = $(this).prop('pathname')+$(this).prop('search');
        processUrls(path);
    });

    // Capture clicks on AlbumButtons
    $(document).on('click', 'a.albumButton', function (event) {
        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
        startAnimation($('#allNumberButtons a.active').data("index"),
                       $(this).data("index"));
    });

    $(document).on('click', '#navboxExtraLoad', function (event) {
        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
        var photo = rp.photos[rp.session.activeIndex];
        if (photo.subreddit)
            getRedditComments(photo);

        getRedditDupe(photo);

        photo.dupes.forEach(function(item) {
            if (item.subreddit)
                getRedditComments(photo, item);
            else
                getRedditDupe(photo, item);
        });
    });

    // Bind to PopState Event
    //rp.history.Adapter.bind(window, 'popstate', function(e) {
    window.onpopstate = function(e) {
        var state = e.state;
        var newurl = window.location.pathname+window.location.search;

        if (rp.url.path !== newurl)
            processUrls(newurl, false, state);
        return true;
    };

    var preloadNextImage = function(imageIndex, albumIndex) {
        if (albumIndex === undefined)
            albumIndex = -1;
        if (imageIndex < 0)
            imageIndex = 0;
        var next = getNextSlideIndex(imageIndex);
        var prev = getPrevSlideIndex(imageIndex);
        if (next == imageIndex) {
            // Load if last image, but not if first image This is because
            // for dedup, we'll get called by image 0, before other images
            // have come in.
            if (imageIndex != 0)
                loadMoreSlides();
            return;

        } else if (rp.cache[next] === undefined) {
            var oldCache = rp.cache;
            rp.cache = {};
            if (oldCache[next])
                rp.cache[next] = oldCache[next];
            else
                rp.cache[next] = {};

            if (rp.cache[next][0] === undefined)
                rp.cache[next][0] = createDiv(next);

            // Also create next+1
            var next1 = getNextSlideIndex(next);
            if (next1 == next)
                loadMoreSlides();
            else if (oldCache[next1])
                rp.cache[next1] = oldCache[next1];
            else {
                    rp.cache[next1] = {};
                    rp.cache[next1][0] = createDiv(next1);
            }

            // save next+2, but don't create it
            var next2 = getNextSlideIndex(next1);
            if (next2 == next1 && next2 != next)
                loadMoreSlides();
            else if (oldCache[next2])
                rp.cache[next2] = oldCache[next2];

            // save previous
            if (prev >= 0 && oldCache[prev])
                rp.cache[prev] = oldCache[prev];

            if (oldCache[rp.session.activeIndex])
                rp.cache[rp.session.activeIndex] = oldCache[rp.session.activeIndex];

            // save prev-1, but don't create it
            next = getPrevSlideIndex(prev);
            if (oldCache[next])
                rp.cache[next] = oldCache[next];
        }

        // Preload previous image
        if (rp.cache[prev] === undefined) {
            rp.cache[prev] = {};
            rp.cache[prev][0] = createDiv(prev);
        }
        if (rp.photos[prev].type == imageTypes.album) {
            var ind = rp.photos[prev].album.length-1;
            if (rp.cache[prev][ind] === undefined)
                rp.cache[prev][ind] = createDiv(prev, ind);
        }

        if (albumIndex < 0)
            return;

        next = albumIndex+1;
        if (next < rp.photos[imageIndex].album.length) {
            if (rp.cache[imageIndex] === undefined)
                rp.cache[imageIndex] = {};

            if (rp.cache[imageIndex][next] === undefined)
                rp.cache[imageIndex][next] = createDiv(imageIndex, next);
        }
    };

    //
    // Starts the animation, based on the image index
    //
    // Variable to store if the animation is playing or not
    var startAnimation = function (imageIndex, albumIndex) {
        if (albumIndex === undefined)
            albumIndex = -1;

        resetNextSlideTimer();

        log.debug("startAnimation("+imageIndex+", "+albumIndex+")");

        // If the same number has been chosen, or the index is outside the
        // rp.photos range, or we're already animating, do nothing
        if (imageIndex < 0 || imageIndex >= rp.photos.length ||
            rp.session.isAnimating || rp.photos.length == 0) {

            log.debug("NOT ANIMATING photo.length=="+rp.photos.length+" isAnimating:"+rp.session.isAnimating);
            if (imageIndex >= rp.photos.length)
                loadMoreSlides();
            if (rp.session.isAnimating)
                rp.session.needReanimation=true;
            return;
        }

        if (rp.session.activeIndex == imageIndex) {
            if (rp.photos[imageIndex].type != imageTypes.album)
                return;

            if (albumIndex >= rp.photos[imageIndex].album.length) {
                log.error("["+imageIndex+"] album index ("+albumIndex+") past end of album length:"+
                          rp.photos[imageIndex].album.length);
                return;
            }
            if (rp.session.activeAlbumIndex == albumIndex && albumIndex >= 0)
                return;
        }
        if (rp.photos[imageIndex].type == imageTypes.album && albumIndex < 0) {
            if (albumIndex == LOAD_PREV_ALBUM)
                albumIndex = rp.photos[imageIndex].album.length-1;
            else
                albumIndex = 0;
        }

        var oldIndex = rp.session.activeIndex;
        var oldAlbumIndex = rp.session.activeAlbumIndex;

        // will be cleared in replaceBackgroundDiv()
        rp.session.isAnimating = true;
        var divNode = getBackgroundDiv(imageIndex, albumIndex);
        animateNavigationBox(imageIndex, oldIndex, albumIndex, oldAlbumIndex);
        replaceBackgroundDiv(divNode);

        // rp.session.activeAlbumIndex may have changed in createDiv called by slideBackgroundPhoto
        preloadNextImage(imageIndex, rp.session.activeAlbumIndex);

        // Save current State
        var state = { photos: rp.photos,
                      index: rp.session.activeIndex,
                      album: rp.session.activeAlbumIndex,
                      after: rp.session.after,
                      subreddit: rp.url.subreddit,
                      loadAfter: (rp.session.loadAfter) ?rp.session.loadAfter.name :null,
                      filler: null};
        rp.history.replaceState(state, "", rp.url.path); 
    };

    // Mystic VooDoo to scroll the number buttons, so that
    // it shows a single row of buttons above.
    // This knows page structure for button lists:
    // <div id=divName"><ul><li><a BUTTON></a></li>...</ul></div>
    var scrollNumberButton = function (button, divName) {
        var offset = button[0].offsetTop;
        var height = button.parent().height();
        if (offset > height)
            offset -= height;
        $('#'+divName).scrollTop(offset-$('#'+divName+' ul')[0].offsetTop);
    }

    var toggleNumberButton = function (imageIndex, turnOn) {
        if (imageIndex < 0)
            return;
        var numberButton = $('#numberButton' + (imageIndex + 1));
        if (turnOn) {
            numberButton.addClass('active');
            scrollNumberButton(numberButton, 'allNumberButtonList');
        } else {
            numberButton.removeClass('active');
        }
    };

    var toggleAlbumButton = function (imageIndex, turnOn) {
        if (imageIndex < 0)
            return;
        var numberButton = $('#albumButton' + (imageIndex + 1));
        if (numberButton.length === undefined)
            return;
        if (turnOn) {
            numberButton.addClass('active');
            scrollNumberButton(numberButton, 'albumNumberButtons');
        } else {
            numberButton.removeClass('active');
        }
    };

    var updateDuplicates = function(photo) {
        if (!isActive(photo))
            return;
        $('#duplicateUl').html("");
        var total = 0;
        if (photo.dupes.length > 0) {
            var multi = [];
            var usermulti = [];
            if (photo.subreddit)
                multi.push(photo.subreddit);
            photo.dupes.forEach(function(item) {
                var li = $("<li>", { class: 'list'});

                if (item.subreddit) {
                    var nli = $('#duplicateUl').find('[subreddit='+item.subreddit+']');
                    if (nli.length) {
                        li = $(nli);
                    } else {
                        var subr = '/r/' +item.subreddit;
                        li.attr('subreddit', item.subreddit);

                        if (item.subreddit.startsWith('u_')) {
                            li.addClass('usersub');
                            if (rp.settings.usersub)
                                ++ total;
                            else
                                li.addClass('hidden');
                            usermulti.push(item.subreddit);
                        } else {
                            ++ total;
                            multi.push(item.subreddit);
                        }
                        li.html(redditLink(subr, item.title));
                    }
                    li.append($("<a>", { href: rp.redditBaseUrl + subr + "/comments/"+item.id,
                                         class: 'info infoc',
                                         title: (new Date(item.date*1000)).toString(),
                                       }).text('('+item.commentN+')'));

                } else if (item.tumblr) {
                    if (item.off)
                        li.html(localLinkFailed(item.url, item.tumblr, '/tumblr/'+item.tumblr, item.title));
                    else
                        li.html(localLink(item.url, item.tumblr, '/tumblr/'+item.tumblr, item.title));
                    ++ total;

                } else {
                    log.error("Unknown Duplicate Type", item);
                    return;
                }

                if (photo.cross_id && photo.cross_id == item.id)
                    li.addClass('xorig');
                if (li.parent().length == 0)
                    $('#duplicateUl').append(li);
            });
            // @@ usermulti
            if (multi) {
                $('#navboxDuplicatesMulti').attr('href', rp.redditBaseUrl+'/r/'+multi.join('+'));
                $('#navboxDuplicatesMultiP').attr('href', rp.url.base+'/r/'+multi.join('+'));
                if (total)
                    $('#duplicateCollapser').data('closehtml', '<span id="duplicateCount">('+total+')</span>');
                else
                    $('#duplicateCollapser').data('closehtml', '');
            }
        } else {
            if (photo.subreddit) {
                $('#navboxDuplicatesMulti').attr('href', rp.redditBaseUrl+'/r/'+photo.subreddit);
                $('#navboxDuplicatesMultiP').attr('href', rp.url.base+'/r/'+photo.subreddit);
            }
        }
        if ($('#duplicateCollapser').data(STATE) == "closed") {
            if (total)
                $('#duplicateCollapser').html('<span id="duplicateCount">('+total+')</span>');
            else
                $('#duplicateCollapser').html($('#duplicateCollapser').attr('symbol-close'));
        } else {
            $('#duplicateCount').hide();
            if (total > 0) {
                $('#duplicateCollapser').data(STATE, 'open');
                $('#duplicates').show();
            } else {
                $('#duplicateCollapser').data(STATE, 'empty');
                $('#duplicates').hide();
            }
        }
    };

    //
    // Animate the navigation box
    //
    var animateNavigationBox = function (imageIndex, oldIndex, albumIndex, oldAlbumIndex) {
        if (oldAlbumIndex === undefined)
            oldAlbumIndex = -1;

        var photo = rp.photos[imageIndex];
        albumIndex = indexPhotoAlbum(photo, imageIndex, albumIndex);

        // Set Active Items
        rp.session.activeIndex = imageIndex;
        rp.session.activeAlbumIndex = albumIndex;

        log.debug("animateNavigationBox("+imageIndex+", "+oldIndex+", "+albumIndex+", "+oldAlbumIndex+")");
        var image = photo;
        if (albumIndex >= 0)
            image = photo.album[albumIndex];
        var subreddit = '/r/' + photo.subreddit;
        var now = Date.now()/1000;

        var authName = image.author || photo.author;

        // COMMENTS/BUTTON LIST Box
        updateExtraLoad();

        var url = image.o_url || image.url;
        $('#navboxOrigLink').attr('href', url).removeClass('hidden');
        setFavicon($('#navboxOrigLink'), image, url);
        $('#navboxImageSearch').attr('href', 'https://www.google.com/searchbyimage?encoded_image=&image_content=&filename=&hl=en&image_url='+image.url).removeClass('hidden');
        switch (image.type) {
        case imageTypes.image:
        case imageTypes.thumb:
        case imageTypes.fail:
            break;
        default:
            $('#navboxImageSearch').addClass('hidden');
            break;
        }

        if (albumIndex >= 0) {
            $('#navboxAlbumOrigLink').attr('href', photo.o_url).attr('title', photo.title+" (a)");
            setFavicon($('#navboxAlbumOrigLink'), photo);
            $('#navboxAlbumOrigLink').removeClass('hidden');
            if (url == photo.o_url)
                $('#navboxOrigLink').addClass('hidden');
        } else
            $('#navboxAlbumOrigLink').addClass('hidden');
        $('#navboxOrigDomain').attr('href', '/domain/'+hostnameOf(photo.o_url));

        if (rp.session.loginExpire &&
            now > rp.session.loginExpire-30)
            clearRedditLogin();

        // TITLE BOX
        $('#navboxTitle').html(picTitle(image));
        var flair = picFlair(image);
        if (flair)
            $('#navboxTitle').prepend($('<span>', { class: 'linkflair' }).text(flair));
        if (photo.score !== undefined) {
            $('#navboxScore').removeClass("hidden");
            $('#navboxScore span').attr('title', 'Score: '+photo.score).text(humanReadInt(photo.score));
        } else
            $('#navboxScore').addClass("hidden");
        $('#navboxLink').attr('href', image.url).attr('title', picTitleText(image)+" (i)").html(typeIcon(image.type));
        $('#navboxExtra').html(picExtra(image));
        if (albumIndex >= 0)
            $('#navboxExtra').append($('<span>', { class: 'info infol' }).text((albumIndex+1)+"/"+rp.photos[imageIndex].album.length));

        if (photo.subreddit)
            $('#navboxSubreddit').html(redditLink(subreddit)).show();

        else if (photo.gfycat)
            $('#navboxSubreddit').html(gfycatApiUserLink(photo.gfycat.user, photo.gfycat.type));

        else if (photo.tumblr)
            $('#navboxSubreddit').html(localLink('https://'+photo.tumblr.blog+'.tumblr.com',
                                                 photo.tumblr.blog, '/tumblr/'+photo.tumblr.blog));
        else
            $('#navboxSubreddit').hide();

        if (authName)
            $('#navboxAuthor').html(redditLink('/user/'+authName+'/submitted',  authName, '/u/'+authName)).show();
        else if (photo.flickr)
            $('#navboxAuthor').html(localLink('https://flickr.com/'+photo.flickr.nsid,
                                              flickrUserPP(photo.flickr.nsid),
                                              '/flickr/'+photo.flickr.nsid)).show();
        else
            $('#navboxAuthor').hide();

        if (photo.comments)
            $('#navboxSubreddit').append($('<a>', { href: photo.comments,
                                                    class: "info infoc",
                                                    title: "Comments (o)" }
                                          ).text('('+photo.commentN+")"));
        var date = image.date || photo.date;
        if (date)
            $('#navboxDate').attr("title", (new Date(date*1000)).toString()).text(sec2dms(now - date));
        else
            $('#navboxDate').attr("title", "").text("");

        $('#navboxDuplicatesLink').attr('href',  rp.redditBaseUrl + '/r/' +
                                        photo.subreddit + '/duplicates/' + photo.id);

        updateDuplicates(photo);

        if (oldIndex != imageIndex) {
            toggleNumberButton(oldIndex, false);
            toggleAlbumButton(oldAlbumIndex, false);
            toggleNumberButton(imageIndex, true);
            populateAlbumButtons(photo);

        } else if (oldAlbumIndex < 0)
            populateAlbumButtons(photo);

        if (albumIndex >= 0 &&
            (albumIndex != oldAlbumIndex || oldIndex != imageIndex)) {
            toggleAlbumButton(oldAlbumIndex, false);
            toggleAlbumButton(albumIndex, true);
        }
    };

    var setupLoading = function(val, msg) {
        if (rp.session.loadingNextImages)
            return false;
        if (rp.session.loading != 0) {
            log.error("Loading not zero: "+rp.session.loading);
            rp.session.loading = 0;
        }
        addLoading(val);
        rp.session.loadingNextImages = true;
        if (msg)
            rp.session.loadingMessage = msg;
        else
            rp.session.loadingMessage = "";
        return true;
    };

    var addLoading = function(val) {
        if (!isFinite(val))
            val = 1;
        rp.session.loading += val;
    };

    var doneLoading = function(message) {
        if (--rp.session.loading == 0)
            failCleanup(message);
    };

    var failCleanup = function(message) {
        rp.session.loadingNextImages = false;
        if (message === undefined)
            message = rp.session.loadingMessage;
        if (rp.photos.length > 0) {
            // already loaded images, don't ruin the existing experience
            return;
        }

        // remove "loading" title
        $('#navboxTitle').html($('<span>', { class: 'error' }).html(message));

        // display alternate recommendations
        $('#recommend').css({'display':'block'});
    };

    var failedAjax = function (xhr, ajaxOptions, thrownError) {
        if (xhr.status == 401 && rp.session.loginExpire)
            clearRedditLogin();
        log.info("ActiveIndex:["+rp.session.activeIndex+"]["+rp.session.activeAlbumIndex+"]");
        log.info("xhr:", xhr);
        log.info("ajaxOptions:", ajaxOptions);
        log.error("error:", thrownError);
        log.info("this:", $(this));
    };
    var failedAjaxDone = function (xhr, ajaxOptions, thrownError) {
        failedAjax(xhr, ajaxOptions, thrownError);
        var text;
        if (xhr.status == 0)
            text = "<br> Check tracking protection";
        else
            text = ": "+thrownError+" "+xhr.status;
        failCleanup("Failed to get "+rp.url.subreddit+text);
    };

    function replaceBackgroundDiv(newDiv) {
        var oldDiv = $("#pictureSlider div:first-of-type");
        if (oldDiv[0] == newDiv[0]) {
            rp.session.isAnimating = false;
            if (rp.session.needReanimation) {
                rp.session.needReanimation=false;
                startAnimation(rp.session.activeIndex, rp.session.activeAlbumIndex);
            }
            return;
        }
        newDiv.prependTo("#pictureSlider");
        newDiv.fadeIn(rp.settings.animationSpeed);
        newDiv.trigger("rpdisplay");
        oldDiv.fadeOut(rp.settings.animationSpeed, function () {
            oldDiv.detach();

            var vid = $('#gfyvid');
            if (vid) {
                vid.prop('autoplay', true);
                if (vid[0])
                    vid[0].play();
            }
            updateVideoMute();

            rp.session.isAnimating = false;
            if (rp.session.needReanimation) {
                rp.session.needReanimation=false;
                startAnimation(rp.session.activeIndex, rp.session.activeAlbumIndex);
            }
        });
        return oldDiv;
    }

    //
    // Slides the background photos
    // Only called with rp.session.activeIndex, rp.session.activeAlbumIndex
    function getBackgroundDiv(index, albumIndex) {
        var divNode;
        var type;
        var aIndex = albumIndex

        if (albumIndex < 0)
            aIndex = 0;

        // Look for div in Cache
        if (rp.cache[index] === undefined ||
            rp.cache[index][aIndex] === undefined) {

            divNode = createDiv(index, albumIndex);

            // may change from LOAD_PREV_ALBUM
            if (albumIndex < 0) {
                albumIndex = indexPhotoAlbum(rp.photos[index], index, albumIndex);
                if (albumIndex >= 0)
                    aIndex = albumIndex;
            }

            if (rp.cache[index] === undefined)
                rp.cache[index] = {};
            rp.cache[index][aIndex] = divNode;

        } else
            divNode = rp.cache[index][aIndex];

        // Read type here, since it may change during createDiv()
        if (albumIndex < 0) {
            type = rp.photos[index].type;

            if (type == imageTypes.album) {
                log.error("["+index+"] type is ALBUM with albumIndex:"+albumIndex);

                type = rp.photos[index].album[0].type;
            }

        } else
            type = rp.photos[index].album[aIndex].type;

        clearSlideTimeout(type);

        return divNode;
    }

    var createDiv = function(imageIndex, albumIndex) {
        if (albumIndex === undefined)
            albumIndex = -1;

        log.debug("createDiv("+imageIndex+", "+albumIndex+")");
        // Retrieve the accompanying photo based on the index
        var photo;
        if (albumIndex >= 0)
            photo = rp.photos[imageIndex].album[albumIndex];

        else if (rp.photos[imageIndex].type == imageTypes.album)
            photo = rp.photos[imageIndex].album[0];

        else
            photo = rp.photos[imageIndex];

        // Used by showVideo and showImage
        var divNode = $("<div />", { class: "fullscreen"});
        divNode.on("rpdisplay", function() {});

        if (photo === undefined)
            return divNode;

        var find_fallback = function(pic, thumb) {
            if (thumb) {
                var photo = photoParent(pic);
                if (pic.fb_thumb && pic.fb_thumb.length)
                    pic.thumb = pic.fb_thumb.shift();

                else if (photo == pic)
                    return false;

                else if (pic.thumb != photo.thumb)
                    pic.thumb = photo.thumb;

                else {
                    var rc = find_fallback(photo);
                    pic.thumb = photo.thumb;
                    return rc;
                }
                if (pic.thumb) {
                    showPic(pic);
                    return true;
                }

            } else {
                if (pic.fallback && pic.fallback.length) {
                    pic.url = pic.fallback.shift();
                    delete pic.type;
                    if (processPhoto(pic)) {
                        showPic(pic);
                        return true;
                    }
                }
            }
            return false;
        }

        // Create a new div and apply the CSS
        var showImage = function(url, needreset, thumb) {
            if (needreset === undefined)
                needreset = true;
            if (thumb === undefined)
                thumb = false;

            var img = $('<img />', { class: "fullscreen", src: url});

            img.on('error', function() {
                if (find_fallback(photo, thumb))
                    return;
                log.info("cannot display photo [load error]: "+photo.url);
                initPhotoFailed(photo);
                // ensure no infinite loop
                if (!thumb)
                    showThumb(photo);
            });

            var hn = hostnameOf(url, true);
            // https://i.redd.it/removed.png is 130x60
            if (hn == 'redd.it')
                img.on('load', function() {
                    if ($(this)[0].naturalHeight == 60 &&
                        $(this)[0].naturalWidth == 130) {
                        log.info("["+photo.index+"] Image has been removed: "+photo.url);
                        initPhotoFailed(photo);
                        if (!thumb)
                            showThumb(photo);
                    }
                });
            // https://i.imgur.com/removed.png is 161x81
            else if (hn == 'imgur.com')
                img.on('load', function() {
                    if ($(this)[0].naturalHeight == 81 &&
                        $(this)[0].naturalWidth == 161) {
                        log.info("["+photo.index+"] Image has been removed: "+photo.url);
                        initPhotoFailed(photo);
                        if (!thumb)
                            showThumb(photo);
                    }
                });
            // YouTube 404 thumbnail is 120x90
            else if (hn == 'youtube.com' ||
                     hn == 'youtu.be' ||
                     hn == 'ytimg.com')
                img.on('load', function() {
                    if ($(this)[0].naturalHeight == 90 &&
                        $(this)[0].naturalWidth == 120) {
                        if (thumb) {
                            log.info("cannot display thumb [place holder]: "+url);
                            find_fallback(photo, thumb);
                            return;
                        }
                        log.info("["+photo.index+"] Image has been removed: "+url);
                        initPhotoFailed(photo);
                        if (!thumb)
                            showThumb(photo);
                    }
                });
            // 404 221x80
            else if (hn == 'ezgif.com')
                img.on('load', function() {
                    if ($(this)[0].naturalHeight == 80 &&
                        $(this)[0].naturalWidth == 221) {
                        if (thumb) {
                            log.info("cannot display thumb [place holder]: "+url);
                            find_fallback(photo, thumb);
                            return;
                        }
                        log.info("["+photo.index+"] Image has been removed: "+url);
                        initPhotoFailed(photo);
                        if (!thumb)
                            showThumb(photo);
                    }
                });
            divNode.html(img);

            if (needreset && imageIndex == rp.session.activeIndex)
                resetNextSlideTimer();
        };

        var showThumb = function(pic, needreset) {
            var thumb = pic.thumb || photoParent(pic).thumb;
            if (thumb)
                showImage(thumb, needreset, true);
        }

        // Called with showVideo({'thumbnail': jpgurl, 'mp4': mp4url, 'webm': webmurl})
        var showVideo = function(data) {
            var video = $('<video id="gfyvid" class="fullscreen" preload="metadata" playsinline />');
            var lastsource;

            video.prop('playsinline', '');
            if (data.thumb !== undefined)
                video.attr('poster', fixupUrl(data.thumb));
            if (isVideoMuted()) {
                video.prop('muted', true);
                if (rp.session.volumeIsMute)
                    video.prop('volume', 0);
            }

            rp.settings.goodVideoExtensions.forEach(function(type) {
                if (!data[type])
                    return;

                var list = (Array.isArray(data[type])) ?data[type] :[ data[type] ];
                list.forEach(function(url) {
                    lastsource = $('<source />', { type: rp.ext2mime[type],
                                                   src: url});
                    video.append(lastsource);
                });
            });
            divNode.html(video);

            if (data.audio !== undefined) {
                var audio = $('<audio id="gfyaudio" />');
                if (rp.session.volumeIsMute) {
                    audio.prop('volume', isVideoMuted() ?0 :1);
                } else {
                    if (isVideoMuted())
                        audio.prop('muted', true);
                    else
                        audio[0].currentTime = video[0].currentTime;
                    audio.prop('volume', rp.settings.decivolume/10);
                }
                var type, ls;
                for (type in data.audio) {
                    ls = $('<source />', { src: data.audio[type],
                                           type: rp.ext2mime[type] });
                    audio.append(ls);
                }
                $(ls).on('error', function() {
                    delete data.audio;
                    $(audio).remove();
                    log.info("Failed to load src for audio: "+photo.url);
                });
                $(audio).on('error', function() {
                    log.info("Failed to load audio: "+photo.url);
                });
                video.on('playing', function() { audio[0].currentTime = video[0].currentTime; audio[0].play() });
                video.on('pause', function() { audio[0].pause() });
                divNode.append(audio);
            }

            $(lastsource).on('error', function() {
                log.info("["+imageIndex+"] video failed to load last source: "+photo.url);
                if (photo.fallback && photo.fallback.length) {
                    photo.url = photo.fallback.shift();

                    delete photo.type;
                    delete photo.video;
                    if (processPhoto(photo)) {
                        showPic(photo);
                        return;
                    }
                }
                initPhotoFailed(photo);
                resetNextSlideTimer();
            });

            $(video).on('error', function() {
                log.info("["+imageIndex+"] video failed to load: "+photo.url);
                initPhotoFailed(photo);
                resetNextSlideTimer();
            });

            $(video).on('ended', function() {
                log.debug("["+imageIndex+"] video ended");
                if ($.contains(document, $(video)[0]) && (shouldStillPlay(imageIndex) || !autoNextSlide())) {
                    var audio = $('#gfyaudio')[0];
                    if (audio) {
                        audio.pause();
                        audio.currentTime=0;
                    }
                    $(video)[0].play();
                }
            });

            $(video).on("loadeddata", function(e) {
                if (e.target.duration == 2 &&
                    e.target.videoWidth == 640 &&
                    e.target.videoHeight == 480 &&
                    hostnameOf(e.target.currentSrc, true) == 'gfycat.com') {
                    log.info("cannot display video [copyright claim]: "+photo.url);
                    initPhotoFailed(photo);
                    resetNextSlideTimer();
                    showThumb(photo);
               }
                photo.duration = e.target.duration;
                if (photo.duration < rp.settings.timeToNextSlide) {
                    photo.times = Math.ceil(rp.settings.timeToNextSlide/photo.duration);
                } else {
                    photo.times = 1;
                }
                log.debug("["+imageIndex+"] Video loadeddata video: "+photo.duration+" playing "+photo.times);
            });

            // PROGRESS BAR
            var prog = $('<div />', { class: "progressbar" }
                                       ).html($('<div />',
                                                { class: "progress",
                                                  style: "width: 0%"
                                                }));
            divNode.append(prog);

            var updateProgress = function(e) {
                var vid = e.target;
                if (!vid.buffered.length)
                    return;
                var prog = e.data.find('div.progress');
                prog.css('width', (vid.buffered.end(0) / vid.duration * 100)+"%");
            };

            $(video).on("progress loadedmetadata loadeddata timeupdate", prog, updateProgress);

            // Set Autoplay for iOS devices
            var addPlayButton = function () {
                divNode.prepend(playButton(function() {
                    $(video)[0].play();
                    $('#playbutton').remove();
                }));
                // if video starts playing, nuke play button
                $(video).on('play', function () {
                    $('#playbutton').remove();
                });
            };

            if (rp.session.needsPlayButton) {
                // Always add play button
                if ($(video)[0].paused)
                    addPlayButton();

            } else {
                var onCanPlay = function() {
                    $(video).off('canplaythrough', onCanPlay);
                    if ($.contains(document, $(video)[0]))
                        $(video)[0].play();
                };
                $(video).on('canplaythrough', onCanPlay);

                if (rp.session.volumeIsMute && !isVideoMuted())
                    addPlayButton();

            }
        };

        // Called with showEmbed(urlForIframe)
        var iFrame = function(pic) {
            var iframe = $('<iframe/>', { id: "gfyembed",
                                          class: "fullscreen",
                                          allow: "autoplay",
                                          sandbox: "allow-same-origin allow-scripts",
                                          frameborder: 0,
                                          allowtransparency: true,
                                          webkitallowfullscreen: true,
                                          mozallowfullscreen: true,
                                          allowfullscreen: true });
            // ensure updateAutoNext doesn't reset timer
            photo.times = 1;

            $(iframe).on("error", function() {
                log.info("["+imageIndex+"] FAILED TO LOAD: "+pic.url);
            });
            $(iframe).attr('src', pic.url);
            return iframe;
        };

        var showEmbed = function(pic) {
            if (rp.settings.embed) {
                divNode.append(iFrame(pic));
                return;
            }
            showThumb(pic);
            // Add play button
            var lem = playButton(function() {
                replaceBackgroundDiv($('<div>', { class: "fullscreen" }).html(iFrame(pic)));
            });

            var title = $('<span>', { class: "title" }).html(hostnameOf(pic.url, true));
            divNode.prepend($(lem).append(title));
        }

        var showHtml = function(html, needreset) {
            if (needreset === undefined)
                needreset = true;
            // can't be <div> because of replaceBackgroundDiv()
            var iframe = $('<blockquote/>', { id: "gfyhtml",
                                              class: "fullscreen",
                                              frameborder: 0,
                                              webkitallowfullscreen: true,
                                              allowfullscreen: true });
            iframe.html(html);
            divNode.html(iframe);

            if (needreset && imageIndex == rp.session.activeIndex)
                resetNextSlideTimer();
        }

        var showPic = function(pic) {
            if (pic.type == imageTypes.album) {
                var index = indexPhotoAlbum(photoParent(pic), imageIndex, albumIndex);
                if (index < 0) {
                    log.error("["+imageIndex+"]["+albumIndex+"] album is zero-length ("+index+") failing to thumbnail: "+pic.url);
                    showThumb(pic);
                    return;
                }
                pic = pic.album[index];
            }

            if (pic.type == imageTypes.video)
                showVideo(pic.video);

            else if (pic.type == imageTypes.html)
                showHtml(pic.html)

            else if (pic.type == imageTypes.embed) {
                // If divNode already attached, just redisplay
                if (divNode.parent()[0] == $('#pictureSlider')[0]) {
                    divNode.trigger("rpdisplay");
                    return;
                }
                // triggered in replaceBackgroundDiv
                divNode.on("rpdisplay", function () {
                    divNode.empty();
                    showEmbed(pic);
                });

            } else if (pic.type == imageTypes.fail)
                showThumb(pic);

            else if (pic.type == imageTypes.later) {
                log.error("called showPic() on later type: "+pic.url);
                fillLaterDiv(photo, showPic);

            } else // Default to image type
                showImage(pic.url);
        };

        if (photo.type == imageTypes.image ||
            photo.type == imageTypes.thumb) {
            showImage(photo.url, false);
            return divNode;

        } else if (photo.type == imageTypes.fail) {
            showThumb(photo, false);
            return divNode;

        } else if (photo.type == imageTypes.html) {
            showHtml(photo.html, false);
            return divNode;
        }
            
        // Preloading, don't mess with timeout
        if (imageIndex == rp.session.activeIndex &&
            albumIndex == rp.session.activeAlbumIndex)
            clearSlideTimeout();

        if (photo.type == imageTypes.later)
            fillLaterDiv(photo, showPic);

        else
            showPic(photo);

        return divNode;
    };

    // Find username from gfyItem, but ignore "anonymous" users
    var gfyItemUser = function(item) {
        if (item === undefined)
            return undefined;
        var user = item.userName || item.username;
        if (!user && item.userData)
            user = item.userData.username;
        // ignore "anonymous" user
        return (user === 'anonymous') ?undefined :user;
    }

    var handleGfycatApiItem = function(photo, data, showCB, type) {
        if (data.gfyItem === undefined) {
            if (data.error !== undefined) {
                log.info("failed to display gfycat [error]: "+data.error);
            }
            initPhotoFailed(photo);
            showCB(photo);
            return;
        }

        var user = gfyItemUser(data.gfyItem);
        if (user)
            photo.extra = gfycatApiUserLink(user, type);

        initPhotoVideo(photo, [ (data.gfyItem.mp4) ?data.gfyItem.mp4.url :data.gfyItem.mp4Url,
                                (data.gfyItem.webm) ?data.gfyItem.webm.url :data.gfyItem.webmUrl,
                                (data.gfyItem.mobile) ?data.gfyItem.mobile.url :data.gfyItem.mobileUrl ],
                       data.gfyItem.posterUrl);

        showCB(photo);
    };

    var fillLaterDiv = function(photo, showCB) {
        var jsonUrl;
        var dataType = 'json';
        var postType = 'GET';
        var postData;
        var handleData;
        var headerData;
        var handleErrorOrig = function (xhr) {
            initPhotoFailed(photo);
            showCB(photo);
            //failedAjax(xhr, ajaxOptions, thrownError);
            log.info('failed to load url [error '+xhr.status+']: ' + photo.url);
        };
        var handleError = handleErrorOrig;
        var url = photo.url;

        var hostname = hostnameOf(url, true);
        var fqdn = hostnameOf(url);
        var shortid = url2shortid(url);

        var handleOembed = function(data) {
            if (data.author_name && data.author_url)
                photo.extra = infoLink(data.author_url, data.author_name);

            if (data.error) {
                log.info("cannot display url ["+(data.message || data.error)+"]: "+photo.url);
                initPhotoFailed(photo);

            } else if (data.type == 'photo') {
                initPhotoImage(photo, data.url);

            } else if (data.type == 'video') {
                var f = $.parseHTML(data.html);

                initPhotoEmbed(photo, f[0].src);

            } else if (data.fullsize_url && (data.type == 'rich' && data.type == 'link')) {
                // non-standard deviantart extention
                initPhotoImage(photo, data.fullsize_url);

            } else {
                log.info("cannot display url [unhandled type "+data.type+"]: "+photo.url);
                initPhotoFailed(photo);
            }
            showCB(photo);
        };

        if (hostname == 'apnews.com') {
            jsonUrl = 'https://storage.googleapis.com/afs-prod/contents/urn:publicid:ap.org:'+shortid;

            handleData = function(data) {
                if (data.mediaCount == 0) {
                    initPhotoThumb(photo);
                    showCB(photo);
                    return;
                }
                photo = initPhotoAlbum(photo, false);
                data.media.forEach(function(item) {
                    var pic = { url: item.gcsBaseUrl+item.imageRenderedSizes[0]+item.imageFileExtension,
                                title: item.flattenedCaption || item.altText };
                    if (item.videoFileExtension)
                        initPhotoVideo(pic, item.gcsBaseUrl+item.videoRenderedSizes[0]+item.videoFileExtension,
                                       pic.url);

                    if (processPhoto(pic))
                        addAlbumItem(photo, pic);
                    });
                checkPhotoAlbum(photo);
                showCB(photo);
            };

        } else if (hostname == 'livestream.com') {
            jsonUrl = originOf(photo.url)+'/oembed?url=' + encodeURIComponent(photo.url);

            handleData = handleOembed;

        } else if (hostname == 'deviantart.com' ||
                   hostname == 'sta.sh' ||
                   hostname == 'fav.me') {
            jsonUrl = 'https://backend.deviantart.com/oembed?format=jsonp&url=' + encodeURIComponent(photo.url);
            dataType = 'jsonp';

            handleData = handleOembed;

        } else if (hostname == 'flickr.com') {
            dataType = 'jsonp';

            // /photos/USERID/PHOTOID
            shortid = url2shortid(photo.url, 3);
            var userid = url2shortid(photo.url, 2);

            if (shortid == 'albums' || shortid == 'sets') {
                var ReqData = { photoset_id: url2shortid(photo.url, 4),
                                user_id: flickrUserNSID(userid),
                                extras: 'media,url_o,url_h,url_k,url_b'};
                jsonUrl = flickrJsonURL('flickr.photosets.getPhotos', ReqData)
                handleData = function(data) {
                    if (data.stat !== 'ok') {
                        var errFunc = function(data) {
                            log.info("failed to load flickr [error: "+data.message+"]: "+photo.url)
                            initPhotoFailed(photo);
                            showCB(photo);
                        };
                        if (data.code == 2)
                            flickrUserLookup(userid, handleData, 'flickr.photosets.getPhotos', ReqData, errFunc);
                        else
                            errFunc(data);
                        return;
                    }

                    photo = initPhotoAlbum(photo, false);
                    // @@TODO: check to see if data.photoset.total > data.photoset.perpage
                    $.each(data.photoset.photo, function(i, item) {
                        var pic = { extra: localLink('https://flickr.com/'+userid,
                                                     flickrUserPP(userid),
                                                     '/flickr/'+flickrUserNSID(userid)),
                                url: flickrPhotoUrl(item),
                                o_url: ['https://flickr.com/photos', userid, item.id].join('/'),
                                thumb: flickrThumbnail(item) };
                        if (processPhoto(pic))
                            addAlbumItem(photo, pic);
                    });
                    checkPhotoAlbum(photo);
                    showCB(photo);
                };

            } else {
                photo.extra = localLink('https://flickr.com/'+userid,
                                        flickrUserPP(userid),
                                        '/flickr/'+flickrUserNSID(userid));

                jsonUrl = flickrJsonURL('flickr.photos.getSizes', { photo_id: shortid })

                handleData = function(data) {
                    var i;
                    if (data.stat !== 'ok') {
                        log.info("failed to load flickr [error: "+data.message+"]: "+photo.url)
                        initPhotoFailed(photo);
                        showCB(photo);
                        return;
                    }
                    var sp = 0, sv = 0;
                    var p, v;
                    for (i = 0; i < data.sizes.size.length; ++i) {
                        var s = parseInt(data.sizes.size[i].width, 10)+parseInt(data.sizes.size[i].height, 10);
                        if (data.sizes.size[i].media == 'photo') {
                            if (s <= sp)
                                continue;

                            sp = s;
                            p = data.sizes.size[i];
                        } else if (data.sizes.size[i].media == 'video') {
                            if (s <= sv)
                                continue;
                            if (extensionOf(data.sizes.size[i].source) == 'swf')
                                continue;
                            sv = s;
                            v = data.sizes.size[i];
                        }
                    }
                    if (v) {
                        initPhotoVideo(photo, [], p.source);
                        if (v.label.toLowerCase().indexOf('mp4') >= 0)
                            addVideoUrl(photo, 'mp4', v.source);
                        if (v.label.toLowerCase().indexOf('webm') >= 0)
                            addVideoUrl(photo, 'webm', v.source);
                        photo.url = v.url;
                    } else if (p)
                        initPhotoImage(photo, p.source);
                    else
                        initPhotoFailed(photo);

                    showCB(photo);
                };
            }

        } else if (hostname == 'gfycat.com') {
            jsonUrl = "https://api.gfycat.com/v1/gfycats/" + shortid;

            handleData = function (data) {
                handleGfycatApiItem(photo, data, showCB, 'gfycat')
            };

            handleError = function() {
                jsonUrl = "https://api.redgifs.com/v1/gfycats/" + shortid;
                var hData = function (data) {
                    handleGfycatApiItem(photo, data, showCB, 'redgifs')
                };

                $.ajax({
                    url: jsonUrl,
                    type: postType,
                    data: postData,
                    headers: headerData,
                    dataType: dataType,
                    success: hData,
                    error: handleErrorOrig,
                    timeout: rp.settings.ajaxTimeout,
                    crossDomain: true
                });
            };

        } else if (hostname == 'redgifs.com') {
            jsonUrl = "https://api.redgifs.com/v1/gfycats/" + shortid;

            handleData = function (data) {
                handleGfycatApiItem(photo, data, showCB, 'redgifs')
            };

        } else if (hostname == 'imgur.com') {
            headerData = { Authorization: "Client-ID "+ rp.api_key.imgur };
            var a = pathnameOf(photo.url).split('/');

            var imgurHandleAlbum = function (list, o_link) {
                photo = initPhotoAlbum(photo, false);
                if (list.length > 0) {
                    list.forEach(function(item) {
                        if (item.is_ad) {
                            log.info("not displaying image [is ad]: "+item.link);
                            return;
                        }
                        var pic = {
                            title: fixupTitle(item.title || item.description),
                            url: item.link,
                            o_url: o_link,
                        };
                        if (item.account_url)
                            pic.extra = localLink('https://'+item.account_url+'.imgur.com',
                                                  item.account_url, '/imgur/'+item.account_url);
                        if (item.animated)
                            initPhotoVideo(pic, fixImgurPicUrl(item.mp4));
                        else
                            initPhotoImage(pic, fixImgurPicUrl(item.link));

                        addAlbumItem(photo, pic);
                    });
                }
                checkPhotoAlbum(photo);

                showCB(photo);
            };

            if (a[1] == 'a') {
                jsonUrl = "https://api.imgur.com/3/album/" + a[2];
                handleData = function(data) {
                    if (data.data.account_url)
                        photo.extra = localLink('https://'+data.data.account_url+'.imgur.com',
                                                data.data.account_url, '/imgur/'+data.data.account_url);
                    imgurHandleAlbum(data.data.images, data.data.link);
                }

            } else if (a[1] == 'gallery') {
                jsonUrl = "https://api.imgur.com/3/gallery/" + a[2];

                handleError = function () {
                    jsonUrl = "https://api.imgur.com/3/album/" + a[2];
                    var hdata = function (data) {
                        if (data.data.account_url)
                            photo.extra = localLink('https://'+data.data.account_url+'.imgur.com',
                                                    data.data.account_url, '/imgur/'+data.data.account_url);
                        imgurHandleAlbum(data.data.images, data.data.link);
                        if (isActive(photo)) {
                            var p = photoParent(photo);
                            animateNavigationBox(p.index, p.index, rp.session.activeAlbumIndex);
                        }
                    };
                    var herr = function() {
                        initPhotoImage(photo, "https://i.imgur.com/"+shortid+".jpg");

                        showCB(photo);
                    };
                    $.ajax({
                        url: jsonUrl,
                        type: postType,
                        data: postData,
                        headers: headerData,
                        dataType: dataType,
                        success: hdata,
                        error: herr,
                        timeout: rp.settings.ajaxTimeout,
                        crossDomain: true
                    });
                };

                handleData = function (data) {
                    if (data === undefined) {
                        initPhotoImage(photo, "https://i.imgur.com/"+shortid+".jpg");
                        showCB(photo);
                        return;
                    }
                    var list;
                    if (data.data.account_url)
                        photo.extra = localLink('https://'+data.data.account_url+'.imgur.com',
                                                data.data.account_url, '/imgur/'+data.data.account_url);
                    if (Array.isArray(data.data))
                        list = data.data;
                    else if (data.data.is_album)
                        list = data.data.images;
                    else
                        list = [ data.data ];
                    imgurHandleAlbum(list, "https://imgur.com/gallery/"+shortid);
                };

            } else {
                jsonUrl = "https://api.imgur.com/3/image/" + shortid;

                handleData = function (data) {
                    if (data.data.account_url)
                        photo.extra = localLink('https://'+data.data.account_url+'.imgur.com',
                                                data.data.account_url, '/imgur/'+data.data.account_url);
                    if (data.data.animated == true) {
                        var arr = [];
                        if (data.data.mp4)
                            arr.push(data.data.mp4)
                        if (data.data.webm)
                            arr.push(data.data.webm)
                        initPhotoVideo(photo, arr);

                    } else
                        initPhotoImage(photo, fixImgurPicUrl(data.data.link));

                    showCB(photo);
                };
            }

        } else if (hostname == 'twitter.com') {
            jsonUrl = 'https://publish.twitter.com/oembed?dnt=true&align=center&url='+photo.url;
            photo.type = imageTypes.html;
            dataType = 'jsonp';

            handleData = function(data) {
                initPhotoHtml(photo, data.html);
                showCB(photo);
            };


        } else if (hostname == 'streamable.com') {
            jsonUrl = "https://api.streamable.com/videos/" + shortid;

            handleData = function(data) {
                var list = [];
                if (data.files.mp4)
                    list.push(data.files.mp4.url);
                if (data.files.webm)
                    list.push(data.files.webm.url);
                // Remove ?height=100 from thumbnail to get full size image
                if (list.length)
                    initPhotoVideo(photo, list, data.thumbnail_url.split(/[?#]/)[0]);
                else {
                    log.info("cannot to load video [no files]: "+photo.url);
                    initPhotoFailed(photo);
                }
                showCB(photo);
            };

        } else if (hostname == 'supload.com') {
            jsonUrl = "https://supload.com/graphql";
            postType = 'POST';
            shortid = url2shortid(photo.url, 1);
            postData = 'query={image(imageId:"'+ shortid + '"){id date type description uname title albumIds private album copyright adult images { id description type } }}';

            handleData = function(data) {
                if (data.errors) {
                    log.info("cannot get info ["+data.errors[0].message+"]: "+photo.url);
                    initPhotoFailed(photo);
                    showCB(photo);
                    return;
                }
                if (data.data.image.adult)
                    photo.over18 = true;

                if (data.data.image.uname)
                    photo.extra = infoLink('https://supload.com/u/'+data.data.image.uname, data.data.image.uname);
                photo = initPhotoAlbum(photo, false);
                data.data.image.images.forEach(function(img) {
                    var pic = { title: img.description || data.data.image.title };
                    if (img.type == 'image/gif') {
                        initPhotoVideo(pic, ['https://i.supload.com/'+img.id+'-hd.webm', 'https://i.supload.com/'+img.id+'-hd.mp4'],
                                       'https://i.supload.com/'+img.id+'/thumb.jpg');
                    } else if (img.type.startsWith("image")) {
                        initPhotoImage(pic, 'https://i.supload.com/'+img.id+'.'+rp.mime2ext[img.type]);

                    } else if (img.type.startsWith("video")) {
                        initPhotoVideo(pic, 'https://i.supload.com/'+img.id+'-hd.'+rp.mime2ext[img.type],
                                       'https://i.supload.com/'+img.id+'/thumb.jpg');

                    } else {
                        log.info("unknown type ["+img.type+" id:"+img.id+"]: "+photo.url);
                        return;
                    }
                    addAlbumItem(photo, pic);
                });
                checkPhotoAlbum(photo);
                showCB(photo);
            };

        } else if (hostname == 'tumblr.com') {
            shortid = url2shortid(photo.url, 2);

            jsonUrl = tumblrJsonURL(fqdn, shortid);
            dataType = 'jsonp';

            handleData = function(data) {
                photo.extra = localLink(data.response.blog.url, data.response.blog.name,
                                        '/tumblr/'+data.response.blog.name,
                                        data.response.blog.title, rp.favicons.tumblr);
                processTumblrPost(photo, data.response.posts[0]);
                showCB(photoParent(photo));
            };

        } else if (hostname == 'wordpress.com') {
            photo.url = photo.url.replace(/\/amp\/?$/, '');
            shortid = url2shortid(photo.url);

            jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+fqdn+'/posts/slug:'+shortid;

            handleData = function(data) {
                processWordPressPost(photo, data);
                showCB(photoParent(photo));
            };

        } else {
            log.error("["+photo.index+"] Unknown site ["+hostname+"]: "+photo.url);
            initPhotoFailed(photo);
            showCB(photo);
        }

        if (jsonUrl !== undefined) {
            var wrapHandleData = function(data) {
                handleData(data);
                // Refresh navbox
                if (isActive(photo)) {
                    var p = photoParent(photo);
                    animateNavigationBox(p.index, p.index, rp.session.activeAlbumIndex);
                }
            };

            $.ajax({
                url: jsonUrl,
                type: postType,
                data: postData,
                headers: headerData,
                dataType: dataType,
                success: wrapHandleData,
                error: handleError,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true
            });

        } else if (isActive(photo)) {
            // refresh navbox
            var p = photoParent(photo);
            animateNavigationBox(p.index, p.index, rp.session.activeAlbumIndex);
        }
    };

    var fixImgurPicUrl = function (url) {
        var hostname = hostnameOf(url);

        // regexp removes /r/<sub>/ prefix if it exists
        // E.g. http://imgur.com/r/aww/x9q6yW9 or http://imgur.com/t/mashup/YjBiWcL
        // replace with gallery because it might be an album or a picture
        url = url.replace(/[rt]\/[^ /]+\//, 'gallery/');

        if (url.indexOf('?') > 0)
            url = url.replace(/\?[^.]*/, '');

        if (rp.settings.alwaysSecure)
            url = url.replace(/^http:/, "https:");

        if (url.indexOf("/a/") > 0 ||
            url.indexOf('/gallery/') > 0) {
            var a = url.split('/');
            return ['https://imgur.com', a[3], a[4].split(".")[0]].join("/");
        }

        // process individual file
        if (hostname.indexOf('i.') !== 0)
            url = url.replace(/[\w.]*imgur.com/i, 'i.imgur.com');
        // convert gifs to videos
        url = url.replace(/gifv$/, "mp4");
        // use jpg instead of webp images
        url = url.replace(/\.webp.*/, "jpg");

        if (isImageExtension(url)) {
            // remove _d.jpg which is thumbnail
            url = url.replace(/_d(\.[^./])/, "$1");
            // remove thumbnail modifier
            url = url.replace(/(\/\w{7}|\/\w{5})[sbtrlg]\./, "$1.");

        } else if (!isVideoExtension(url))
            // imgur is really nice and serves the image with whatever extension
            // you give it. '.jpg' is arbitrary
            url += ".jpg";
        return url;
    };

    var fixupUrl = function (url) {
        // fix reddit bad quoting
        url = url.replace(/&amp;/gi, '&');
        if (!rp.settings.alwaysSecure)
            return url;

        var hostname = hostnameOf(url, true);

        if (url.startsWith('//'))
            url = ((rp.insecure[hostname]) ?"http:" :"https:")+url;

        if (hostname == 'gfycat.com' ||
            hostname == 'imgur.com' ||
            hostname == 'wp.com' ||
            hostname == 'wordpress.com' ||
            hostname == 'pornhub.com' ||
            hostname == 'xhamster.com' ||
            hostname == 'youporn.com' ||
            hostname == 'xvideos.com' ||
            hostname == 'sendvid.com' ||
            hostname == 'juicygif.com')
            url = url.replace(/^http:/, "https:");

        return url;
    };

    var urlregexp = new RegExp('https?://[\\w\\._-]{1,256}\\.[a-z]{2,6}(/[\\w/\\.-]*)?', 'gi');

    var fixupTitle = function(origtitle) {
        var title = unescapeHTML(origtitle);
        if (!title)
            return title;

        // Do URLs first, so we don't pickup those added later
        var t1 = title.replace(urlregexp, function(match) {
            var fqdn = hostnameOf(match);
            var path = pathnameOf(match);

            var domains = fqdn.split('.').reverse();
            var hn = domains[1]+'.'+domains[0];

            if (hn == 'tumblr.com')
                return titleLLink(match, '/tumblr/'+fqdn, domains[2]);
            if (hn == 'instagram.com')
                return titleFLink(match, '@'+path.replace(/^[/]/, '').replace(/\/.*/,''));
            else
                return titleFLink(match, fqdn+path);
        });

        // @InstagramName
        t1 = t1.replace(/(?=^|\W)@([\w.]+)/g, function(match, p1) {
            return titleFLink('https://instagram.com/'+p1, '@'+p1); });

        // r/subreddit
        t1 = t1.replace(/(?=^|\W|\b)\/?(r\/[\w-]+)\s*/gi, function(match, p1) {
            return titleRLink('/'+p1, p1); });

        // u/redditUser
        t1 = t1.replace(/(?=^|\W|\b)\/?u\/([\w-]+)\s*/gi, function(match, p1) {
            return titleRLink('/user/'+p1+'/submitted', 'u/'+p1); });

        return t1;
    };

    var decodeUrl = function (url) {
        return decodeURIComponent(url.replace(/\+/g, " "));
    };

    var clearRedditLogin = function () {
        if (!rp.session.loginExpire)
            return;

        rp.session.loginExpire = 0;
        rp.session.redditHdr = {};
        rp.url.api = rp.redditBaseUrl;
        $('#loginUsername').html(googleIcon('account_box'));
        $('#loginUsername').attr('title', 'Expired');
        $('label[for=login]').html(googleIcon('account_box'));
        $('.needlogin').hide();
        log.info("Clearing bearer is obsolete EOL:"+rp.session.loginExpire+" < now:"+Date.now()/1000);
        clearConfig(configNames.redditBearer);
        clearConfig(configNames.redditRefreshBy);
    };

    var redditMultiAppend = function(data, list) {
        data.forEach(function(item) {
            var path;
            var cl = "multi";
            if (item.data.visibility == "public")
                path = item.data.path;
            else if (item.data.visibility == "private") {
                path = "/me/m/"+item.data.name;
                cl += " needlogin";
            } else // hidden == ignore
                return;
            if (item.data.over_18)
                cl += " show-nsfw";

            var link = redditLink(path, item.data.description_md, item.data.display_name);

            list.append($('<li>', {class: cl}).html(link));
        });
    };

    var loadRedditMultiList = function () {
        if (rp.session.loadedMultiList == true)
            return;

        var jsonUrl = rp.url.api+'/api/multi/mine';
        var handleData = function(data) {
            rp.session.loadedMultiList = true;
            var list = $('#multiListDiv ul:first-of-type');
            list.empty();

            redditMultiAppend(data, list);
        };

        $.ajax({
            url: jsonUrl,
            headers: rp.session.redditHdr,
            dataType: 'json',
            success: handleData,
            error: failedAjax,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var setupRedditLogin = function (bearer, by) {
        if (hostnameOf(rp.redirect) != window.location.hostname)
            return;
        if (bearer === undefined)
            bearer = getConfig(configNames.redditBearer, '');
        if (by === undefined)
            by = getConfig(configNames.redditRefreshBy, 0);
        if (rp.session.loginExpire &&
            rp.session.loginExpire > (Date.now()/1000)-60)
            return;
        $('#loginUsername').attr('href', rp.redditLoginUrl + '/api/v1/authorize?' +
                                 ['client_id=' + rp.api_key.reddit,
                                  'response_type=token',
                                  'state='+encodeURIComponent(rp.url.path),
                                  'redirect_uri='+encodeURIComponent(rp.redirect),
                                  // read - /r/ALL, /me/m/ALL
                                  // history - /user/USER/submitted
                                  'scope=read,history'].join('&'));
        if (by-60 > Date.now()/1000) {
            var d = new Date(by*1000);
            rp.session.loginExpire = by;
            rp.session.redditHdr = { Authorization: 'bearer '+bearer };
            $('.needlogin').show();
            $('#loginUsername').html(googleIcon('verified_user'));
            $('#loginUsername').attr('title', 'Expires at '+d);
            $('label[for=login]').html(googleIcon('verified_user'));
            rp.url.api = 'https://oauth.reddit.com';
            loadRedditMultiList();

        } else
            clearRedditLogin();
    };

    var setupChoices = function () {
        // Supported choices:
        // /[*best*, hot, new, top, rising, controversial, gilded]
        // /r/SUBREDDIT/[*hot*, new, top, rising, controversial, gilded]
        // /r/freinds [*new*, gilded]
        // /me/m/MULTI/[*hot*, new, top, rising, controversial, gilded]
        // /user/USERNAME/m/MULTI/[*hot*, new, top, rising, controversial, gilded]
        // /user/USERNAME/submitted?sort=[*new*, top, controversial, gilded]
        // /flickr/USERNAME/[*photos*, albums]
        var arr = [ "best", "hot", "new", "top", "rising", "controversial", "gilded" ];
        var s = rp.url.subreddit.split('/');
        var prefix = '/';
        var base;
        var mod = arr.indexOf(s[1]);
        var user;
        var submitted = false;
        rp.url.choice = "";

        if (mod >= 0) {
            base = '/';
            prefix = '';

        } else if (rp.url.subreddit == '/') {
            base = '/';
            prefix = '';
            mod = 0;

        } else if (s[2] == 'friends' && s[1] == 'r') {
            base = s.slice(0,3).join('/');
            arr = [ "new", 'gilded' ];
            mod = (s.length > 3) ?arr.indexOf(s[3]) :0;

        } else if (s[1] == 'r' ||
                   s[1] == 'domain') {
            base = s.slice(0,3).join('/');
            arr = [ "hot", "new", "top", "rising", "controversial", 'gilded' ];
            mod = (s.length > 3) ?arr.indexOf(s[3]) :0;

        } else if (s[1] == 'user') {
            user = s[2];
            if (s[3] == 'submitted') {
                base = s.slice(0,4).join('/');
                arr = [ "hot", "new", "top", "controversial" ];
                mod = (s.length > 4) ?arr.indexOf(s[4]) :0;

            } else if (s[3] == 'm') {
                submitted = true;
                base = s.slice(0,5).join('/');
                arr = [ "hot", "new", "top", "rising", "controversial", 'gilded' ];
                mod = (s.length > 5) ?arr.indexOf(s[5]) :0;

            } else {
                log.error("Unknown URL format for Choice: "+rp.url.subreddit);
                return;
            }

        } else if (s[1] == 'me') {
            base = s.slice(0,4).join('/');
            arr = [ "hot", "new", "top", "rising", "controversial", 'gilded' ];
            mod = (s.length > 4) ?arr.indexOf(s[4]) :0;

        } else if (s[1] == 'wp' ||
                   s[1] == 'wp2') {
            arr = [ "new", "old" ];
            base = s.slice(0,3).join('/');
            mod = (s.length > 3) ?arr.indexOf(s[3]) :0;

        } else if (s[1] == 'flickr') {
            arr = [ "photos", "albums" ];
            base = s.slice(0,3).join('/');
            mod = (s.length > 3) ?arr.indexOf(s[3]) :0;

        } else {
            return;
        }

        if (mod < 0)
            mod = 0;
        else if (mod > 0)
            rp.url.choice = arr[mod];

        var list = $('#subredditPopup ul');
        list.empty();
        for(var i = 0; i < arr.length; ++i) {
            var a = _infoAnchor(rp.url.base+base+((i) ?prefix+arr[i] :""),
                                arr[i], arr[i], "info infol local");
            if (mod == i)
                a.addClass('selected');

            var li = $('<li>').append(a);
            if (arr[i] == 'top') {
                var tsel = searchValueOf(rp.url.get+rp.url.path, 't');
                var times = ['day', 'week', 'month', 'year', 'all'];
                for (var t in times) {
                    a = _infoAnchor(rp.url.base+base+prefix+"top?sort=top&t="+times[t],
                                    times[t][0].toUpperCase(), times[t], "info infol local");
                    if (tsel == times[t])
                        a.addClass('selected');
                    li.append(a);
                }
            }
            list.append(li);
        }
        if (user) {
            if (submitted) {
                list.append($('<li>').append($('<hr>', { class: "split" })));
                list.append($('<li>').append(redditLink('/user/'+user+'/submitted', "submitted", "submitted")));
            }
            var jsonUrl = rp.url.api + '/api/multi/user/' + user;
            var handleData = function (data) {
                if (data.length) {
                    var list = $('#subredditPopup ul');
                    list.append($('<li>').append($('<hr>', { class: "split" })));
                    redditMultiAppend(data, list);
                }
            };
            $.ajax({
                url: jsonUrl,
                headers: rp.session.redditHdr,
                dataType: 'json',
                success: handleData,
                error: failedAjax,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true,
            });
        }

        $('#choiceTitle').text(base);
        $('#choiceLi').show();
    };

    //
    // Site Specific Loading / Processing
    //

    // Get duplicate reddit entries for a non-reddit photo.url
    // Also load comments of new subreddits
    var getRedditDupe = function(photo, dupe) {
        var site;
        var shortid;

        var hn = hostnameOf(photo.url, true);

        if (dupe) {
            shortid = dupe.id;
            if (dupe.tumblr)
                site = dupe.tumblr;

            else if (dupe.site) // for fake load
                site = dupe.site;

            else
                return;

        } else if (photo.tumblr) {
            site = photo.tumblr.blog;
            shortid = photo.tumblr.id;

            if (photo.extraLoaded)
                return;

            photo.extraLoaded = true;

        } else if (photo.flickr) {
            site = 'flickr.com';
            shortid = photo.id;

        }

        if (site === undefined) {
            if (hn == 'imgur.com' ||
                hn == 'gfycat.com' ||
                hn == 'redgifs.com') {
                site = hn;
                shortid = url2shortid(photo.url);

            } else
                return;
        }

        // https://www.reddit.com/search.json?q=url:SHORTID+site:HOSTNAME
        var jsonUrl = rp.url.get + '/search.json?include_over_18=on&q=url:'+shortid+'+site:'+site;
        var handleData = function (data) {
            if (isActive(photo))
                updateExtraLoad();
            if (data.data.dist == 0)
                return;
            data.data.children.forEach(function (dupe) {
                var len = addPhotoDupe(photo, {subreddit: dupe.data.subreddit,
                                               commentN: dupe.data.num_comments,
                                               title: dupe.data.title,
                                               date: dupe.data.created,
                                               id: dupe.data.id});
                if (len > 0)
                    getRedditComments(photo, photo.dupes[len-1]);
            });
            updateDuplicates(photo);
        };

        log.info("loading alternate submissions: "+site+":"+shortid);
        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedAjax,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true,
        });
    };

    // Assume: photo has been run through processPhoto() at least once
    var getRedditComments = function (photo, dupe) {
        var comments;
        if (dupe) {
            // This could be:
            // comments = [rp.rp.redditBaseUrl, "comments", id].join('/');
            if (!dupe.commentN || dupe.extraLoaded)
                return;
            dupe.extraLoaded = true;
            comments = [rp.redditBaseUrl, 'r', dupe.subreddit, "comments", dupe.id].join("/");

        } else {
            // Only load comments once per photo
            if (photo.extraLoaded)
                return;

            photo.extraLoaded = true;

            if (!photo.commentN || !photo.comments)
                return;
            comments = photo.comments;
        }

        var jsonUrl = rp.url.get + pathnameOf(comments) + '.json';
        var failedData = function (xhr, ajaxOptions, thrownError) {
            photo.extraLoaded = false;
            failedAjax(xhr, ajaxOptions, thrownError);
        }

        // var handleMoreComments = function(data) {
        //     var comments = data.json.data.things;
        //     var i;

        //     photo = initPhotoAlbum(photo, true);

        //     for (i = 0; i < comments.length; ++i)
        //         processRedditComment(photo, comments[i]);

        //     checkPhotoAlbum(photo);
        // };

        var processRedditComment = function(photo, comment) {
            var j;
            if (comment.kind == "more") {
                // @@ API hits CORS issue
                // var jsonUrl = rp.url.get+'/api/morechildren';
                // var postData = 'limit_children=False&api_type=json&children='+comment.data.children.join(",")+
                //     "&link_id="+(comment.data.link_id || comment.data.link)+
                //     "&id="+(comment.data.name || comment.data.id);
                // log.info("loading more comments: "+comment.data.id);
                // $.ajax({
                //     url: jsonUrl,
                //     headers: hdrData,
                //     type: postType,
                //     data: postData,
                //     dataType: 'json',
                //     success: handleMoreComments,
                //     error: failedData,
                //     timeout: rp.settings.ajaxTimeout,
                //     crossDomain: true,
                // });
                return;
            }
            if (comment.kind != "t1") {
                log.error("unknown comment type ["+comment.kind+"]: "+photo.url);
                return;
            }
            if (comment.data.author == 'AutoModerator')
                return;

            if (comment.data.score >= rp.settings.minScore) {
                var links = [];
                if (comment.data.body_html) {

                    var ownerDocument = document.implementation.createHTMLDocument('virtual');

                    links = $('<div />', ownerDocument).html(unescapeHTML(comment.data.body_html)).find('a');
                } else {
                    log.info("cannot display comment["+comment.permalink+"] [no body]: "+photo.url);
                }

                for (j = 0; j < links.length; ++j) {
                    var img = { author: comment.data.author,
                                url: links[j].href
                              };

                    if (links[j].innerText !== "" &&
                        links[j].innerText !== img.url)
                        img.title = fixupTitle(links[j].innerText);

                    log.debug("RC-Try:["+photo.comments+"]:"+img.url);
                    if (processPhoto(img))
                        addAlbumItem(photo, img);
                    else
                        log.info("cannot load comment link [no photos]: "+img.url);
                }
            }

            if (comment.data.replies)
                for (j = 0; j < comment.data.replies.data.children.length; ++j)
                    processRedditComment(photo, comment.data.replies.data.children[j]);
        };

        var handleData = function (data) {
            var comments = data[1].data.children;
            var i;

            if (isActive(photo))
                updateExtraLoad();

            photo = initPhotoAlbum(photo, true);

            for (i = 0; i < comments.length; ++i)
                processRedditComment(photo, comments[i]);

            checkPhotoAlbum(photo);
            addImageSlide(photo);
        };

        log.info("loading comments: "+comments);
        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedData,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true,
        });
    };

    var getRedditImages = function () {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        setupRedditLogin();

        var jsonUrl = rp.url.api + rp.url.subreddit + ".json?";
        var dataType = 'json';
        var hdrData = rp.session.redditHdr;

        if (rp.url.subreddit.startsWith('/r/random') ||
            rp.url.subreddit.startsWith('/r/randnsfw')) {
            jsonUrl = rp.redditBaseUrl + rp.url.subreddit + ".json?jsonp=redditcallback";
            dataType = 'jsonp';
        }

        jsonUrl += rp.url.vars + rp.session.after;

        var addImageSlideRedditT3 = function (idorig, duplicates) {
            var val = dedupVal(idorig.subreddit, idorig.id);
            if (val) {
                log.info('cannot display url [simul-dup:'+val+']: '+idorig.url);
                return;
            }

            if (idorig.score < rp.settings.minScore) {
                log.info('cannot display url [score too low: '+idorig.score+']: '+idorig.url);
                return;
            }

            if (duplicates === undefined)
                duplicates = [];

            // parse parent if crosspost
            var idx = idorig;
            while (idx.crosspost_parent_list !== undefined &&
                   idx.crosspost_parent_list.length > 0) {
                idx = idx.crosspost_parent_list[0];
            }

            var title = fixupTitle(idorig.title)

            var flair = "";
            // Add flair (but remove if also in title)
            if (idorig.link_flair_text) {
                flair = idorig.link_flair_text.trim();
                if (flair) {
                    var re = new RegExp('[\\[\\{\\(]'+RegExp.quote(flair)+'[\\]\\}\\)]', "ig");
                    title = title.replace(re, "").trim();
                }
            }

            var url = fixupUrl(idx.url || idx.url_overridden_by_dest);

            var photo = {
                url: url,
                o_url: url,
                title: title,
                flair: flair,
                id: idorig.id,
                over18: idorig.over_18,
                subreddit: idorig.subreddit,
                author: idorig.author,
                date: idorig.created_utc,
                dupes: duplicates,
                score: idorig.score,
                commentN: idorig.num_comments,
                comments: rp.redditBaseUrl + idorig.permalink
            };
            if (idx.id != photo.id)
                photo.cross_id = idx.id;

            if (idorig.preview)
                photo.thumb = fixupUrl(idorig.preview.images[0].source.url);

            else if (idorig.thumbnail != 'default' && idorig.thumbnail != 'nsfw')
                photo.thumb = fixupUrl(idorig.thumbnail);

            // Reddit Gallery Function
            if (idx.gallery_data) {
                initPhotoAlbum(photo, false);

                idx.gallery_data.items.forEach(function(item) {
                    var t;
                    if (item.caption)
                        t = fixupTitle(item.caption);
                    else
                        t = title;
                    var media = idx.media_metadata[item.media_id];
                    if (media.status == "failed")
                        return;
                    var pic = { title: t, url: media.s.u };
                    if (item.outbound_url)
                        pic.extra = infoLink(item.outbound_url, 'link');
                    // @@ check media.e != "Image"
                    if (media.e != "Image") {
                        log.error("Reddit Gallery element not 'Image': "+media);
                    }
                    if (processPhoto(pic))
                        addAlbumItem(photo, pic)
                });
                checkPhotoAlbum(photo);
            }
            // Reddit hosted videos
            else if (idx.domain == 'v.redd.it') {
                // intentionally load with empty video, load mp4 below
                initPhotoVideo(photo, []);
                var media = (idx.media) ?idx.media.reddit_video
                    :(idx.secure_media) ?idx.secure_media.reddit_video
                    :undefined;

                if (media) {
                    var ind = media.fallback_url.indexOf('/DASH_');
                    if (ind > 0) {
                        addVideoUrl(photo, 'mp4', media.fallback_url);
                        photo.video.audio = { mp3: media.fallback_url.substr(0,ind)+"/DASH_audio.mp4" };

                    } else {
                        log.error(photo.id+": cannot display video [bad fallback_url]: "+
                                  media.fallback_url);
                        return;
                    }
                } else {
                    log.error(photo.id+": cannot display video [no reddit_video]: "+photo.url);
                    return;
                }

            } else if (idorig.domain == 'reddit.com') {
                // these shouldn't be added via tryPreview nor speculative lookups
                log.info('will not display url [no image]: ' + photo.o_url);
                return;
            }

            var tryPreview = function(photo, idorig, msg) {
                if (msg === undefined)
                    msg = 'no image';
                if (idorig.preview &&
                    idorig.preview.images.length > 0) {
                    initPhotoThumb(photo, unescapeHTML(idorig.preview.images[0].source.url));
                    log.info('using thumbnail ['+msg+']: '+photo.o_url);
                    if (addImageSlide(photo))
                        return;
                }
                log.info('cannot display '+msg + ': ' + photo.o_url);
                return;
            };

            var rc = processPhoto(photo);

            if ((photo.type != imageTypes.fail) &&
                (photo.flair.toLowerCase() == 'request' ||
                 photo.title.match(/[[({]request[\])}]/i) ||
                 photo.title.match(/^psbattle:/i) ||
                 photo.flair.match(/(more|source|video|album).*in.*com/i) ||
                 idorig.title.match(/(source|more|video|album).*in.*com/i) ||
                 idorig.title.match(/in.*comment/i) ||
                 idorig.title.match(/[[({\d\s][asvm]ic([\])}]|$)/i)))
                getRedditComments(photo);

            if (rc) {
                addImageSlide(photo);
                return;
            }

            // SPECULATIVE LOOKUPS

            var path = pathnameOf(photo.url);
            var hn = hostnameOf(photo.url);
            var a, handleData, jsonUrl, failedData;

            var tryWPv2 = function () {
                var origin = originOf(photo.url);
                var slug = url2shortid(photo.url);
                jsonUrl = origin+'/wp-json/wp/v2/posts/?slug='+slug+'&_jsonp=?';
                log.debug("WPv2 Trying: "+photo.url);
                handleData = function (data) {
                    if (rp.wpv2[hn] !== true) {
                        rp.wpv2[hn] = true;
                        setConfig(configNames.wpv2, rp.wpv2);
                    }
                    getPostWPv2(photo, data[0], function() { tryPreview(photo, idorig, "WPv2 no photos"); });
                };
                failedData = function () {
                    rp.wpv2[hn] = false;
                    setConfig(configNames.wpv2, rp.wpv2);
                    tryPreview(photo, idorig, "not WPv2 site");
                };
                $.ajax({
                    url: jsonUrl,
                    dataType: 'jsonp',
                    success: handleData,
                    error: failedData,
                    timeout: rp.settings.ajaxTimeout,
                    crossDomain: true
                });
            };

            if (rp.wpv2[hn] !== false &&
                (a = path.match(/^\/(?:\d+\/)*([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/))) {
                // This check to see if bare url is actually a wordpress site

                var slug = a[1];
                jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+hn+'/posts/slug:'+slug;
                log.debug("WP Trying: "+photo.url);
                handleData = function (data) {
                    if (data.error)
                        log.info("Cannot display wordpress ["+data.error+"]: "+photo.url);
                    else if (processWordPressPost(photo, data))
                        addImageSlide(photo);
                    else
                        tryPreview(photo, idorig, "WP no photos");
                };
                failedData = tryWPv2;
                // We already know we need to talk directly to site:
                if (rp.wpv2[hn] === true) {
                    failedData();
                    return;
                }

            } else if (rp.wpv2[hn] !== false &&
                       (a = path.match(/^\/index.php\/(?:\d+\/)*([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/))) {
                tryWPv2();

            } else if (( rp.blogger[hn] === undefined || rp.blogger[hn] > 0) &&
                       (path.match(/^\/(?:\d+\/)*([a-z0-9]+(?:-[a-z0-9]+)*.html)$/))) {
                // Blogger:
                // 1. lookup blogger blogID by url
                // 2. lookup post by URL (need blogID)

                jsonUrl = 'https://www.googleapis.com/blogger/v3/blogs/byurl?url='+originOf(photo.url)+'&key='+rp.api_key.blogger;
                handleData = function (data) {
                    if (data.error) {
                        log.error("cannot log blogger ["+data.error.message+"]: "+photo.url);
                        return;
                    }
                    var id = data.id;

                    if (!rp.blogger[hn]) {
                        rp.blogger[hn] = id;
                        setConfig(configNames.blogger, rp.blogger);                        
                    }

                    jsonUrl = data.posts.selfLink+'/bypath?path='+path+'&key='+rp.api_key.blogger;

                    handleData = function(data) {
                        if (data.error) {
                            log.error("cannot log blogger ["+data.error.message+"]: "+photo.url);
                            return;
                        }
                        if (processBloggerPost(photo, data))
                            addImageSlide(photo);
                    };

                    $.ajax({
                        url: jsonUrl,
                        dataType: 'json',
                        success: handleData,
                        error: failedData,
                        timeout: rp.settings.ajaxTimeout,
                        crossDomain: true
                    });
                };
                failedData = function (xhr) {
                    var err = JSON.parse(xhr.responseText);
                    if (xhr.status == 404) {
                        rp.blogger[hn] = 0;
                        setConfig(configNames.blogger, rp.blogger);
                    } else {
                        log.error("cannot load blogger ["+xhr.status+" "+err.error.message+"]: "+photo.url);
                    }
                    tryPreview(photo, idorig, "Blogger: "+err.error.message);
                };

            } else {
                tryPreview(photo, idorig);
                return;
            }

            if (rp.blogger[hn]) {
                var id = rp.blogger[hn];
                handleData({ id: id,
                             posts: {
                                 selfLink: 'https://www.googleapis.com/blogger/v3/blogs/'+id+'/posts'
                             } });

            } else {
                $.ajax({
                    url: jsonUrl,
                    dataType: 'json',
                    success: handleData,
                    error: failedData,
                    timeout: rp.settings.ajaxTimeout,
                    crossDomain: true,
                });
            }
        }; // END addImageSlideRedditT3

        var handleData = function (data) {
            //redditData = data //global for debugging data
            // NOTE: if data.data.after is null then this causes us to start
            // from the top on the next getRedditImages which is fine.
            if (data.data.after !== null) {
                rp.session.after = "&after=" + data.data.after;
                rp.session.loadAfter = getRedditImages;

            } else {
                rp.session.loadAfter = null;
            }

            if (data.data.children.length === 0) {
                log.info("No more data");
                rp.session.loadingNextImages = false;
                return;
            }

            // Watch out for "fake" subreddits
            if (rp.url.subreddit.startsWith('/r/random') ||
                rp.url.subreddit.startsWith('/r/randnsfw')) {
                rp.url.origsubreddit = rp.url.subreddit;
                // add rest of URL to subreddit e.g. /r/random/top
                var end = rp.url.subreddit.replace(/^\/r\/rand(om|nsfw)/i,'');
                rp.url.subreddit = '/r/' + data.data.children[0].data.subreddit+end;

                $('#subredditLink').prop('href', rp.redditBaseUrl + rp.url.subreddit);
                $('#subredditUrl').val(rp.url.subreddit);
                // fix choices after determining correct subreddit
                setupChoices();
            }

            var handleDuplicatesData = function(data) {
                var item = data[0].data.children[0];

                var duplicates = [];
                var i;
                for(i = 0; i < data[1].data.children.length; ++i) {
                    var dupe = data[1].data.children[i];
                    if (dedupAdd(dupe.data.subreddit, dupe.data.id, '/r/'+item.data.subreddit+'/'+item.data.id) == "SELF") {
                        log.info('cannot display url [non-self dup]: '+item.data.url);
                        return;
                    }
                    duplicates.push({subreddit: dupe.data.subreddit,
                                     commentN: dupe.data.num_comments,
                                     title: dupe.data.title,
                                     date: dupe.data.created,
                                     id: dupe.data.id});
                }
                addImageSlideRedditT3(item.data, duplicates);

                // Place self in dedup list
                dedupAdd(item.data.subreddit, item.data.id);
            };

            data.data.children.forEach(function (item) {
                var func = null;
                var url = null;

                // Text entry, no actual media
                if (item.kind != "t3") {
                    log.info('cannont display url [not link]: '+item.kind);
                    return;
                }

                if (item.data.is_self) {
                    log.info('cannot display url [self-post]: '+item.data.url);
                    return;
                }

                var val = dedupVal(item.data.subreddit, item.data.id);
                if (val) {
                    log.info('cannot display url [duplicate:'+val+']: '+item.data.url);
                    return;
                }

                func = handleDuplicatesData;
                url = rp.redditBaseUrl + '/duplicates/' + item.data.id + '.json?show=all';

                // Don't use oauth'd API for this, if oauth has expired, lots of failures happen,
                // and oauth adds nothing here.
                $.ajax({
                    url: url,
                    dataType: 'json',
                    success: func,
                    error: failedAjax,
                    jsonp: false,
                    timeout: rp.settings.ajaxTimeout,
                    crossDomain: true
                });
            });
            rp.session.loadingNextImages = false;
        };

        log.debug('Ajax requesting ('+dataType+'): ' + jsonUrl);

        $.ajax({
            url: jsonUrl,
            headers: hdrData,
            dataType: dataType,
            jsonpCallback: 'redditcallback',
            success: handleData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var getImgurUser = function () {
        var a = rp.url.subreddit.split('/');
        var user = a[2]
        setupLoading(1, "No images for "+user);

        var jsonUrl = 'https://api.imgur.com/3/account/' + user + '/albums';

        var handleData = function (data) {
            if (data.status != 200 || !data.success)
                return doneLoading();

            data.data.forEach(function (item) {
                // @@ item_count == 1, image is item.cover
                var pic = {
                    url: item.link,
                    title: fixupTitle(item.title || item.description),
                    over18: item.nsfw,
                    date: item.datetime,
                    id: item.id,
                    extra: localLink('https://'+item.user+'.imgur.com', item.user, '/imgur/'+item.user),
                };
                if (item.section)
                    pic.subreddit = item.section;
                addImageSlide(pic);
            });
            // @@ MORE?
            doneLoading();
        };
        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout,
            headers: { Authorization: 'Client-ID ' + rp.api_key.imgur }
        });
    };

    var processHaystack = function(photo, html, docheck) {
        if (docheck === undefined)
            docheck = false;

        var processNeedle = function(pic, item) {
            var src;
            if (item.tagName == 'IMG') {
                // Fixup item.src
                src = item.getAttribute('src');
                if (src === null)
                    return false;
                src = unescapeHTML(src);
                if (src.startsWith('//'))
                    item.src = ((rp.insecure[hostnameOf(src)]) ?"http:" :"https:")+src;
                else if (src.startsWith('/'))
                    item.src = originOf(pic.url)+src;

                // Shortcut <A href="video/embed"><img src="url" /></a>
                if (item.parentElement.tagName == 'A') {
                    pic.url = item.parentElement.href;
                    if (processPhoto(pic) && pic.type != imageTypes.later) {
                        pic.thumb = item.src;
                        if (pic.type == imageTypes.video)
                            pic.video.thumb = item.src;
                        return true;
                    }
                }

                // Skip thumbnails
                if (item.className.includes('thumbnail'))
                    return false;
                if (item.getAttribute("itemprop") &&
                    item.getAttribute("itemprop").includes("thumbnail"))
                    return false;

                // Skip very small images (probably logos)
                if ((item.getAttribute("height") || 100) < 100 ||
                    (item.getAttribute("width") || 100) < 100)
                    return false;

                initPhotoImage(pic, item.src);

                if (item.alt)
                    pic.title = item.alt;

            } else if (item.tagName == 'VIDEO') {

                initPhotoVideo(pic, [], item.poster);

                $.each(item.children, function(index, source) {
                    var src = source.getAttribute('src');
                    if (src === null)
                        return;
                    src = unescapeHTML(src);
                    if (src.startsWith('//'))
                        source.src = ((rp.insecure[hostnameOf(src)]) ?"http:" :"https:")+src;
                    else if (src.startsWith('/'))
                        source.src = originOf(pic.url)+src;

                    if (rp.mime2ext[source.type])
                        addVideoUrl(pic, rp.mime2ext[source.type], source.src);
                    else
                        log.info("Unknown type: "+source.type+" at: "+source.src);
                });

            } else if (item.tagName == 'IFRAME') {
                // let processPhoto() do initPhotoEmbed() if it's processable
                src = item.getAttribute('src');
                if (src === null)
                    return false;
                pic.url = unescapeHTML(src);

            } else {
                return false;
            }
            return true;
        };

        var rc = false;

        photo = initPhotoAlbum(photo);
        // Create virtual document so that external references are not loaded
        var ownerDocument = document.implementation.createHTMLDocument('virtual');
        $('<div />', ownerDocument).html(html).find('img, video, iframe').each(function(index, item) {
            // init url for relative urls/srcs
            var pic = { url: item.src || item.currentSrc, title: item.alt || item.title };
            if (processNeedle(pic, item) && processPhoto(pic) &&
                !isAlbumDupe(photo, pic.url.replace(/-\d+x\d+\./, "."))) {
                addAlbumItem(photo, pic);
                rc = true;
            }
        });
        if (docheck)
            checkPhotoAlbum(photo);

        return rc;
    };

    // This is for processing /wp-json/wp/v2/posts aka
    // https://developer.wordpress.org/rest-api/reference/
    var getPostWPv2 = function(photo, post, errorcb) {
        if (post === undefined) {
            if (errorcb)
                errorcb();
            return;
        }
        var hn = hostnameOf(photo.url);
        photo.extra = localLink(originOf(photo.url), hn, "/wp2/"+hn, "", rp.favicons['wordpress']);
        initPhotoAlbum(photo, false);
        if (photo.o_url === undefined)
            photo.o_url = photo.url;
        var rc = false;

        if (post.content && processHaystack(photo, post.content.rendered, false))
            rc = true;

        if (post.description && processHaystack(photo, post.description.rendered, false))
            rc = true;

        // Pull down 100, but only videos and images
        var jsonUrl = post._links["wp:attachment"][0].href + '&per_page=100';
        var handleData = function(data) {
            if (data.length == 100)
                log.notice("Found Full Page, should ask for more: "+photo.url);
            var rc2 = false;
            if (data.length) {
                data.forEach(function(item) {
                    if (!item)
                        return;
                    var pic = { url: item.source_url,
                                title: unescapeHTML(item.caption.rendered) || item.alt_text || item.title.rendered };
                    if (processPhoto(pic)) {
                        addAlbumItem(photo, pic);
                        rc2 = true;
                    } else
                        log.info("cannot display item [unknown type: "
                                 + item.media_type +"]: "+item.source_url);
                });
            }
            checkPhotoAlbum(photo);
            if (rc || rc2)
                addImageSlide(photo);
            else if (errorcb)
                errorcb();
        };

        var handleError = function(xhr, ajaxOptions, thrownError) {
            checkPhotoAlbum(photo);
            if (rc)
                addImageSlide(photo);
            else if (errorcb)
                errorcb();
            failedAjax(xhr, ajaxOptions, thrownError);
        };

        //var jsonUrl = post._links[wp:featuredmedia][0].href
        $.ajax({
            url: jsonUrl+'&_jsonp=?',
            dataType: 'jsonp',
            success: handleData,
            error: handleError,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    // This is for public-api.wordpress.com which uses API v1.1
    // https://developer.wordpress.com/docs/api/
    // https://developer.wordpress.com/docs/api/1.1/get/sites/%24site/
    var processWordPressPost = function(pic, post) {
        var rc = false;

        // Setup some photo defaults
        if (post.author.URL) {
            pic.extra = localLink(post.author.URL, post.author.name,
                                  '/wp/'+hostnameOf(post.author.URL));
        } else {
            var hn = hostnameOf(post.URL);
            pic.extra = localLink(post.URL.substring(0, post.URL.indexOf(':'))+'://'+hn,
                                  post.author.name, '/wp/'+hn, post.author.nice_name,
                                  pic.favicon);
        }

        if (post.is_reblogged) {
            log.info("*@@* DUPLICATE: ", post);
            // @@ do duplicate processing
        }

        // Process Post
        var processAttachment = function(att, img) {
            img.id = att.ID;
            if (att.mime_type.startsWith('image/')) {
                initPhotoImage(img, att.URL);

            } else if (att.mime_type.startsWith('video/')) {
                initPhotoVideo(img, att.URL, (att.thumbnails) ?att.thumbnails.large :undefined);

            } else {
                log.info("cannot display url [unknown mimetype "+att.mime_type+"]: "+att.url);
                return false;
            }
            return true;
        };

        var k, att;

        var photo = initPhotoAlbum(pic, false);
        for(k in post.attachments) {
            att = post.attachments[k];
            var img = { title: att.caption || att.title };
            if (processAttachment(att, img) && processPhoto(img)) {
                addAlbumItem(photo, img);
                rc = true;
            }
        }
        if (processHaystack(pic, post.content))
            rc = true;

        checkPhotoAlbum(photo);

        if (rc) {
            pic.favicon = rp.favicons.wordpress;
        } else {
            log.info("cannot display wp [no content]: "+pic.url);
            laterPhotoFailed(pic);
        }

        return rc;
    };


    var getWordPressBlogV2 = function () {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        var a = rp.url.subreddit.split('/');

        var hostname = a[2];

        // desc: newest to oldest
        // asc: oldest to newest
        var urlorder = (a.length > 3 && a[3] == 'old') ?'asc' :'desc';

        if (rp.wpv2[hostname] === false) {
            rp.session.loadingNextImages = false;
            return;
        }

        $('#subredditLink').prop('href', 'https://'+hostname);
        $('#subredditUrl').val('/wp2/' + hostname + ((a.length > 3) ? "/"+a[3] :""));

        var scheme = (rp.insecure[hostname]) ?'http' :'https';

        var jsonUrl = scheme+'://'+hostname+'/wp-json/wp/v2/posts/?orderby=date&order='+urlorder;
        if (rp.url.vars)
            jsonUrl += '&'+rp.url.vars;

        if (rp.session.after !== "")
            jsonUrl = jsonUrl+'&offset='+rp.session.after;
        else
            rp.session.after = 0;

        var handleData = function (data) {
            rp.wpv2[hostname] = true;
            setConfig(configNames.wpv2, rp.wpv2);
            if (scheme == 'http') {
                rp.insecure[hostname] = true;
                setConfig(configNames.insecure, rp.insecure);
            }
            if (!Array.isArray(data)) {
                log.error("Something bad happened: "+data);
                failedAjaxDone();
                return;
            } else if (data.length == 0) {
                rp.session.loadAfter = null;
            }
            rp.session.loadAfter = getWordPressBlogV2;
            rp.session.after = rp.session.after + data.length;
            data.forEach(function(post) {
                var d = new Date(post.date_gmt+"Z");
                var photo = { title: fixupTitle(post.title.rendered),
                              id: post.id,
                              url: post.link,
                              over18: false,
                              date: d.valueOf()/1000
                            };
                getPostWPv2(photo, post, function() { log.info("cannot display WPv2 [no photos]: "+photo.url) });
            });
            rp.session.loadingNextImages = false;
        };
        var failedData = function (xhr, ajaxOptions, thrownError) {
            if (scheme == 'https') {
                log.info("Failed to load wp2:"+hostname+" via https trying http");
                rp.insecure[hostname] = true;
                scheme = "http";
                jsonUrl = jsonUrl.replace(/^https/, scheme);
                $.ajax({
                    url: jsonUrl+'&_jsonp=?',
                    dataType: 'jsonp',
                    success: handleData,
                    error: failedData,
                    timeout: rp.settings.ajaxTimeout,
                    crossDomain: true,
                });
                return;
            }
            rp.wpv2[hostname] = false;
            delete rp.insecure[hostname];
            setConfig(configNames.wpv2, rp.wpv2);
            setConfig(configNames.insecure, rp.insecure);
            failedAjaxDone(xhr, ajaxOptions, thrownError);
        };

        $.ajax({
            url: jsonUrl+'&_jsonp=?',
            dataType: 'jsonp',
            success: handleData,
            error: failedData,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    // https://developer.wordpress.com/docs/api/1.1/get/sites/%24site/posts/
    var getWordPressBlog = function () {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        var a = rp.url.subreddit.split('/');

        var hostname = a[2];

        // DESC: newest to oldest
        // ASC: oldest to newest
        var urlorder = (a.length > 3 && a[3] == 'old') ?'ASC' :'DESC';

        $('#subredditUrl').val('/wp/'+hostname+((a.length > 3) ? "/"+a[3] :""));

        if (hostname.indexOf('.') < 0)
            hostname += '.wordpress.com';

        $('#subredditLink').prop('href', 'https://'+hostname);

        // If we know this fails, bail
        if (rp.wpv2[hostname] !== undefined) {
            if (rp.wpv2[hostname] === true) {
                rp.session.loadingNextImages = false;
                getWordPressBlogV2();
            } else {
                failCleanup("No Wordpress Blog for "+hostname);
            }
            return;
        }

        var jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+hostname+'/posts?order_by=date&order='+urlorder;
        if (rp.url.vars)
            jsonUrl += '&'+rp.url.vars;

        if (rp.session.after !== "")
            jsonUrl = jsonUrl+'&offset='+rp.session.after;
        else
            rp.session.after = 0;

        var handleData = function (data) {
            if (rp.session.after < data.found) {
                rp.session.after = rp.session.after + data.posts.length;
                rp.session.loadAfter = getWordPressBlog;

            } else { // Found all posts
                rp.session.loadAfter = null;
            }

            data.posts.forEach(function(post) {
                var d = new Date(post.date);
                var photo = { title: post.title,
                              id: post.ID,
                              url: post.URL,
                              over18: false,
                              date: d.valueOf()/1000,
                              thumb: (post.post_thumbnail) ?post.post_thumbnail.URL :null
                            };

                if (processWordPressPost(photo, post))
                    addImageSlide(photo);
                else
                    log.info("cannot display WP [no photos]: "+photo.url);
            });
            rp.session.loadingNextImages = false;
        };

        var failedData = function () {
            rp.session.loadingNextImages = false;
            getWordPressBlogV2();
        };

        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedData,
            timeout: rp.settings.ajaxTimeout
        });
    };

    var processTumblrPost = function(opic, post) {
        var rc = false;
        var dupe = false;
        var pic;

        opic.tumblr = { blog: post.blog_name,
                        id: post.id };

        var photo = initPhotoAlbum(opic, false);

        var val = dedupVal(post.blog_name, post.id);
        if (val) {
            log.info("cannot display url [duplicate:"+val+"]: "+opic.url);
            dupe = true;

        } else if (opic == photo) {
            var name, off;
            if (photo.dupes === undefined)
                photo.dupes = [];
            if (post.reblogged_root_id && post.reblogged_root_name) {
                name = post.reblogged_root_name.replace(/-deactivated\d+$/, '')
                off = (name != post.reblogged_root_name);
                val = dedupVal(name, post.reblogged_root_id);
                if (val) {
                    log.info("cannot display url [cross-duplicate:"+val+"]: "+photo.url);
                    dupe = true;
                } else {
                    photo.dupes.push({tumblr: name,
                                      off: off,
                                      title: post.reblogged_root_title,
                                      url: post.reblogged_root_url,
                                      id: (post.reblogged_root_id) ?post.reblogged_root_id :post.reblogged_root_uuid.split('.')[0]});
                    dedupAdd(name, post.reblogged_root_id, '/tumblr/'+photo.tumblr.blog+'/'+photo.tumblr.id);
                    if (!photo.cross_id)
                        photo.cross_id = post.reblogged_root_id;
                }
            }
            if (rc && post.reblogged_from_name && post.reblogged_from_id &&
                post.reblogged_from_id !== post.reblogged_root_id) {
                name = post.reblogged_from_name.replace(/-deactivated\d+$/, '')
                off = (name != post.reblogged_from_name);
                val = dedupVal(name, post.reblogged_from_id);
                if (val) {
                    log.info("cannot display url [cross-duplicate:"+val+"]: "+photo.url);
                    dupe = true;
                } else {
                    photo.dupes.push({tumblr: name,
                                      off: off,
                                      title: post.reblogged_from_title,
                                      url: post.reblogged_from_url,
                                      id: (post.reblogged_from_id) ?post.reblogged_from_id :post.reblogged_from_uuid.split('.')[0]});
                    dedupAdd(name, post.reblogged_from_id, '/tumblr/'+photo.tumblr.blog+'/'+photo.tumblr.id);
                    if (!photo.cross_id)
                        photo.cross_id = post.reblogged_from_id;

                    dedupAdd(photo.tumblr.blog, photo.tumblr.id);
                }
            }
        }

        if (dupe) {
            // Duplicate
        } else if (post.type == "photo") {
            post.photos.forEach(function(item) {
                var pic =  { url: item.original_size.url,
                             type: imageTypes.image,
                             tumblr: opic.tumblr,
                             title: fixupTitle(item.caption || photo.title) }
                if (processPhoto(pic)) {
                    addAlbumItem(photo, pic);
                    rc = true;
                }
            });
            if (post.link_url) {
                pic = { url: post.link_url,
                        title: fixupTitle(post.title || post.caption || photo.title) };
                if (processPhoto(pic)) {
                    addAlbumItem(photo, pic);
                    rc = true;
                }
            }
            processHaystack(photo, (post.caption||post.title));

        } else if (post.type == 'video') {
            pic =  { url: opic.url,
                     thumb: post.thumbnail_url,
                     tumblr: opic.tumblr,
                     title: fixupTitle(post.summary || post.caption || opic.title) }
            rc = true;
            if (post.video_type == "youtube") {
                if (post.video === undefined) {
                    initPhotoFailed(pic);
                    rc = false;
                } else {
                    initPhotoYoutube(pic, post.video.youtube.video_id);
                    addAlbumItem(photo, pic);
                }

            } else if (post.video_url) {
                initPhotoVideo(pic, post.video_url, post.thumbnail_url);
                addAlbumItem(photo, pic);

            } else if (post.video_type == "unknown") {
                var width;
                var embed;

                log.info("processing unknown video_type: "+photo.o_url);
                log.debug(post);
                post.player.forEach(function (item) {
                    if (width === undefined ||
                        item.width > width) {
                        width = item.width;
                        embed = item.embed_code;
                    }
                });
                if (embed)
                    rc = processHaystack(photo, embed);

            } else {
                log.info("cannot process post [unknown type:"+post.video_type+
                         "]: "+photo.o_url);
                rc = false;
            }

        } else if (post.type == 'html') {
            rc = processHaystack(photo, post.description);

        } else if (post.type == 'text') {
            rc = processHaystack(photo, post.body);

        } else if (post.type == 'link') {
            pic = { o_url: opic.url,
                    url: post.url,
                    tumblr: opic.tumblr,
                    title: fixupTitle(post.summary || opic.title || photo.title) };
            rc = processPhoto(pic);
            if (rc)
                addAlbumItem(photo, pic);
        }
        checkPhotoAlbum(photo);

        if (!rc && !dupe) {
            log.info("cannot display url [bad Tumblr post type: "+post.type+"]: "+
                     photo.url);
            laterPhotoFailed(opic);
        }

        return rc;
    };

    var getTumblrBlog = function () {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        var a = rp.url.subreddit.split('/');

        var hostname = a[2];
        if (hostname.indexOf('.') < 0)
            hostname += '.tumblr.com';

        var jsonUrl = tumblrJsonURL(hostname);
        if (rp.session.after)
            jsonUrl = jsonUrl+'&offset='+rp.session.after;
        else
            rp.session.after = 0;

        var handleData = function (data) {
            $('#subredditLink').prop('href', data.response.blog.url);
            $('#subredditUrl').val('/tumblr/'+data.response.blog.name);

            if (rp.session.after < data.response.total_posts) {
                rp.session.after = rp.session.after + data.response.posts.length;
                rp.session.loadAfter = getTumblrBlog;

            } else { // Found all posts
                rp.session.loadAfter = null;
            }

            data.response.posts.forEach(function (post) {
                var image = { title: fixupTitle(post.summary || unescapeHTML(post.caption) || data.response.blog.title),
                              id: post.id,
                              over18: data.response.blog.is_nsfw || data.response.blog.is_adult,
                              date: post.timestamp,
                              url: post.post_url,
                              o_url: post.post_url
                            };
                if (processTumblrPost(image, post))
                    addImageSlide(image);

            });

            rp.session.loadingNextImages = false;
        };

        log.debug('getTumblrBlog requesting: '+jsonUrl);

        $.ajax({
            url: jsonUrl,
            dataType: 'jsonp',
            success: handleData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout
        });
    };

    var processBloggerPost = function(photo, post) {
        photo.extra = localLink(post.author.url, post.author.displayName,
                                '/blogger/'+hostnameOf(photo.url));
        initPhotoAlbum(photo, false);
        return processHaystack(photo, post.content, true);
    };

    var getBloggerBlog = function () {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        var a = rp.url.subreddit.split('/');

        var hostname = a[2];

        if (rp.blogger[hostname] === 0) {
            log.error("cannot log blogger [Already Failed]: "+hostname);
            return;
        }

        var jsonUrl = 'https://www.googleapis.com/blogger/v3/blogs/byurl?url=https://'+hostname+'&key='+rp.api_key.blogger;

        var handleData = function(data) {
            if (data.error) {
                log.error("cannot log blogger ["+data.error.message+"]: "+hostname);
                rp.blogger[hostname] = 0;
                setConfig(configNames.blogger, rp.blogger);
                return;
            }

            var jsonUrl = data.posts.selfLink+'?key='+rp.api_key.blogger;
            rp.blogger[hostname] = data.id;
            setConfig(configNames.blogger, rp.blogger);
            /*
              if (rp.session.after !== "")
              jsonUrl = jsonUrl+'&offset='+rp.session.after;
              else
              rp.session.after = 0;
            */
            $('#subredditLink').prop('href', data.url);
            $('#subredditUrl').val('/blogger/'+data.name);

            var handleData = function (data) {
                if (data.nextPageToken) {
                    rp.session.after = data.nextPageToken;
                    //rp.session.loadAfter = getBloggerBlog;
                } else { // Found all posts
                    rp.session.loadAfter = null;
                }
                data.items.forEach(function (post) {
                    var d = new Date(post.updated);
                    var image = { title: fixupTitle(post.title),
                                  id: post.id,
                                  over18: false,
                                  date: d.valueOf()/1000,
                                  url: post.url
                                };
                    if (processBloggerPost(image, post))
                        addImageSlide(image);
                });

                rp.session.loadingNextImages = false;
            };
            $.ajax({
                url: jsonUrl,
                success: handleData,
                error: failedAjaxDone,
                crossDomain: true,
                timeout: rp.settings.ajaxTimeout
            });
        };

        $.ajax({
            url: jsonUrl,
            success: handleData,
            error: failedAjaxDone,
            crossDomain: true,
            timeout: rp.settings.ajaxTimeout
        });
    };

    var flickrThumbnail = function(post) {
        if (post.id && post.secret && post.farm && post.server)
            return 'https://farm'+post.farm+'.staticflickr.com/'+post.server+'/'+post.id+'_'+post.secret+'_z.jpg';
        else
            return '';
    }
    // assumes extras included: url_o,url_h,url_k,url_b
    var flickrPhotoUrl = function(post) {
        if (post.url_o)
            return post.url_o;
        if (post.url_k)
            return post.url_k;
        if (post.url_h)
            return post.url_h
        if (post.url_b)
            return post.url_b;
        return flickrThumbnail(post);
    };
    var flickrUserPP = function(nsid) {
        if (rp.flickr.nsid2u[nsid])
            return rp.flickr.nsid2u[nsid];
        return nsid;
    };
    var flickrUserNSID = function(userid) {
        if (rp.flickr.u2nsid[userid])
            return rp.flickr.u2nsid[userid];
        return userid;
    };
    var flickrAddUserMap = function(userid, nsid) {
        if (rp.flickr.u2nsid[userid] == nsid)
            return;
        rp.flickr.u2nsid[userid] = nsid;
        rp.flickr.nsid2u[nsid] = userid;
        setConfig(configNames.nsid, rp.flickr.u2nsid);
    };

    var flickrUserLookup = function(user, callback, ReqFunc, ReqData, errFunc) {
        var jsonUrl = flickrJsonURL('flickr.urls.lookupUser', { url: 'https://flickr.com/photos/'+user });
        var handleData = function(data) {
            if (data.stat !== 'ok') {
                errFunc(data);
                return;
            }
            flickrAddUserMap(user, data.user.id);
            ReqData.user_id = flickrUserNSID(user);
            $.ajax({
                url: flickrJsonURL(ReqFunc, ReqData),
                dataType: 'json',
                success: callback,
                error: failedAjax,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true
            });
        };

        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedAjax,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    // URL: /flickr/USER[/albums]
    // Need user login for safe-search to be off
    // Sizes:
    // o - original
    // k - 2048 on longest - c. 2012
    // h - 1600 on longest - c. 2012
    // b - 1024 on longest - optional until May 2010
    // z - 640 on longest (gaurenteed to exist)
    var getFlickr = function() {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        var a = rp.url.subreddit.split('/');
        var user = a[2];

        if (rp.session.after == undefined)
            rp.session.after = 1;

        var reqFunc, reqData;
        if (a[3] == 'sets' || a[3] == 'albums') {
            reqFunc = 'flickr.photosets.getList';
            reqData = { user_id: flickrUserNSID(user),
                        primary_photo_extras: 'url_o,url_h,url_k,url_b',
                        per_page: 20,
                        page: rp.session.after};
        } else {
            reqFunc = 'flickr.people.getPhotos';
            reqData = { user_id: flickrUserNSID(user),
                        extras: 'url_o,url_h,url_k,url_b,date_upload',
                        page: rp.session.after};
        }

        var jsonUrl = flickrJsonURL(reqFunc, reqData);

        var handleData = function(data) {
            if (data.stat !== 'ok') {
                var errFunc = function(data) {
                    log.error("cannot load images: "+data.message);
                    rp.session.loadingNextImages = false;
                };
                if (data.code == 2)
                    flickrUserLookup(reqData.user_id, handleData, reqFunc, reqData, errFunc);
                else
                    errFunc(data);
                return;
            }
            var info, arrData, arrProcess;
            if (data.photos) {
                info = data.photos;
                arrData = data.photos.photo;
                arrProcess = function(post) {
                    if (post.owner != user)
                        flickrAddUserMap(user, post.owner);
                    return { title: post.title,
                             id: post.id,
                             flickr: { nsid: post.owner },
                             date: post.dateupload,
                             url: flickrPhotoUrl(post),
                             o_url: ['https://www.flickr.com/photos', post.owner, post.id].join("/"),
                             over18: false };
                };

            } else if (data.photosets) {
                info = data.photosets;
                arrData = data.photosets.photoset;
                arrProcess = function(post) {
                    return { title: post.title._content,
                             id: post.id,
                             flickr: { nsid: reqData.user_id },
                             date: post.date_create,
                             url: ['https://www.flickr.com/photos', reqData.user_id, 'sets', post.id].join("/"),
                             thumb: flickrPhotoUrl(post.primary_photo_extras),
                             over18: false };
                };
            }
            if (info.pages == 0) {
                failCleanup("Flickr user has no images");
                return;
            }
            if (info.page < info.pages) {
                rp.session.loadAfter = getFlickr;
                rp.session.after = info.page+1;
            } else
                rp.session.loadAfter = null;

            arrData.forEach(function(post) {
                var photo = arrProcess(post);
                addImageSlide(photo);
            });
            rp.session.loadingNextImages = false;
        };

        $.ajax({
            url: jsonUrl,
            dataType: 'jsonp',
            success: handleData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var getGfycatApiUser = function() {
        // URL: /(gfycat|redgifs)/USER
        var apiurl, baseurl;
        var a = rp.url.subreddit.split('/');
        var type = a[1];
        var user = a[2];

        if (type == "gfycat") {
            apiurl = "https://api.gfycat.com";
            baseurl = "https://gfycat.com/";
        } else if (type == "redgifs") {
            apiurl = "https://api.redgifs.com";
            baseurl = "https://www.redgifs.com/watch/";
        } else {
            throw("Bad Gfycat API User: "+type);
        }

        if (!setupLoading(2, "user "+user+" has no videos"))
            return;

        var gfycat2pic = function(post) {
            var image = { url: baseurl+post.gfyName,
                          over18: (post.nsfw != 0),
                          title: fixupTitle(post.title || post.description),
                          date: post.createDate,
                          type: imageTypes.video,
                          video: { thumb: post.posterUrl,
                                   webm: post.webmUrl,
                                   mp4: post.mp4Url
                                 }
                        };
            var user = gfyItemUser(post);
            if (user)
                image.gfycat = { user: user, type: type };
            return image;
        };

        // Get all Gfycats (currently gfycat.com doesn't seem to list nsfw item here)
        var jsonUrl = apiurl+'/v1/users/'+user+'/gfycats';

        var handleUserData = function (data) {
            if (data.gfycats.length) {
                data.gfycats.forEach(function (post) {
                    var image = gfycat2pic(post);
                    addImageSlide(image);
                });
                if (data.cursor) {
                    jsonUrl = apiurl+'/v1/users/'+user+'/gfycats?cursor='+data.cursor;
                    $.ajax({
                        url: jsonUrl,
                        dataType: 'json',
                        success: handleUserData,
                        error: failedAjaxDone,
                        timeout: rp.settings.ajaxTimeout,
                        crossDomain: true
                    });
                    return;
                }
            }
            doneLoading();
        };

        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleUserData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });

        // Get all Albums
        jsonUrl = apiurl+'/v1/users/'+user+'/albums';
        var handleData = function (data) {
            if (data.totalItemCount == 0) {
                doneLoading();
                return;
            }

            data.items.forEach(function (album) {
                var url = apiurl+'/v1/users/'+user+'/albums/'+album.id;
                var hd = function (data) {
                    if (data.pub == 0)
                        return;
                    data.publishedGfys.forEach(function (post) {
                        var photo = gfycat2pic(post);
                        photo.extra = localLink(post.userData.url+'/'+album.linkText,
                                                album.title, '/'+type+'/'+user);
                        addImageSlide(photo);
                    });
                    doneLoading();
                };
                addLoading();
                $.ajax({
                    url: url,
                    dataType: 'json',
                    success: hd,
                    error: failedAjaxDone,
                    timeout: rp.settings.ajaxTimeout,
                    crossDomain: true
                });
            });
            doneLoading();

        };
        var handleError = function (xhr, ajaxOptions, thrownError) {
            if (xhr.status == 404 || xhr.status == 403) {
                doneLoading();
                return;
            }
            failedAjax(xhr, ajaxOptions, thrownError);
        };
        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: handleError,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var processUrls = function(path, initial, data) {
        // Separate to before the question mark and after
        // Detect predefined reddit url paths. If you modify this be sure to fix
        // .htaccess
        // This is a good idea so we can give a quick 404 page when appropriate.
        var regexS = "(/(?:(?:imgur/)|(?:gfycat/)|(?:tumblr/)|(?:flickr/)|(?:blogger/)|(?:redgifs/)|(?:wp2?/)"+
            "|(?:auth)|"+
            "(?:r/)|(?:u/)|(?:user/)|(?:domain/)|(?:search)|(?:me)|(?:hot)|(?:top)|(?:new)|(?:rising)|(?:controversial))"+
            "[^&#?]*)[?]?(.*)";

        if (path === undefined)
            path = $('#subredditUrl').val();
        if (initial === undefined)
            initial = false;

        path = path.replace(/^\/+/, '/').replace(/^\?+/, '');

        var regex = new RegExp(regexS);
        var results = regex.exec(path);
        var subreddit;

        log.debug('url split results: '+results);
        if (data) {
            rp.url.subreddit = data.subreddit;
            if (results)
                rp.url.vars = decodeUrl(results[2]);

        } else if (results !== null) {
            rp.url.subreddit = results[1];
            subreddit = rp.url.subreddit;
            rp.url.vars = decodeUrl(results[2]);

            // Remove .compact as it interferes with .json (we got "/r/all/.compact.json" which doesn't work).
            rp.url.subreddit = rp.url.subreddit.replace(/.compact/, "");
            // Consolidate double slashes to avoid r/all/.compact/ -> r/all//
            rp.url.subreddit = rp.url.subreddit.replace(/\/{2,}/, "/");
            // replace /u/ with /user/
            rp.url.subreddit = rp.url.subreddit.replace(/\/u\//, "/user/");

        } else {
            rp.url.vars = '';
            rp.url.subreddit = '/';
        }

        if (!subreddit)
            subreddit = rp.url.subreddit;

        // Set prefix for self links, if in subdirectory
        if (initial)
            if (window.location.pathname != subreddit) {
                rp.url.base = window.location.pathname + '?';
                rp.url.root = window.location.pathname;
                rp.url.root = rp.url.root.replace(/index.html$/, "");
            } else {
                rp.url.root = '/';
            }

        if (!path.startsWith(pathnameOf(rp.url.base)))
            path = rp.url.base+path;

        log.info("LOADING: "+path);
        rp.url.path = path;

        var getVarsQuestionMark = "";

        if (rp.url.vars.length > 0)
            getVarsQuestionMark = "?" + rp.url.vars;

        if (rp.url.vars !== '')
            rp.url.vars = '&' + rp.url.vars;

        $('a.hardlink').each(function(index, item) {
            var href = pathnameOf(item.href);
            item.href = rp.url.base+href;
            item.classList.remove('hardlink');
        });

        // Auth Response - only ever uses window.location
        if (rp.url.subreddit == "/auth" ||
            rp.url.subreddit == "/" && rp.url.path.startsWith('/access_token')) {
            var matches = /[/#?&]access_token=([^&#=]*)/.exec(window.location.href);
            var url;
            if (matches) {
                var bearer = matches[1];
                setConfig(configNames.redditBearer, bearer);

                matches = /[#?&]expires_in=([^&#=]*)/.exec(window.location.href);
                // if failed to process, default to an hour
                var time = parseInt(decodeURIComponent(matches[1]), 10);
                var by = time+Math.ceil(Date.now()/1000);

                setConfig(configNames.redditRefreshBy, by);

                setupRedditLogin(bearer, by);

                matches = /[#?&]state=([^&#=]*)/.exec(window.location.href);
                url = decodeURIComponent(matches[1]);
                if (url.startsWith('/auth'))
                    url = '/';
            } else {
                log.error("Failed to load auth: "+window.location.href);
                url = "/";
            }
            processUrls(url);
            loadRedditMultiList();
            return;
        }

        if (initial)
            rp.history.replaceState({}, "", path);
        else if (data === undefined && path != "")
            rp.history.pushState({}, "", path);

        var subredditName = rp.url.subreddit + getVarsQuestionMark;

        var visitSubreddit = rp.redditBaseUrl + rp.url.subreddit + getVarsQuestionMark;

        $('#subredditLink').prop('href', visitSubreddit);
        $('#subredditUrl').val(subredditName);

        document.title = "redditP - " + subredditName;

        $('#choiceLi').hide();
        setupChoices();

        if (((rp.session.loginExpire || rp.session.loginNeeded) &&
             rp.url.subreddit.substr(0, rp.url.subreddit.length-rp.url.choice.length) == '/') ||
            rp.url.subreddit.startsWith('/me') ||
            rp.url.subreddit.startsWith('/r/friends'))
            rp.session.loginNeeded = true;
        else
            rp.session.loginNeeded = false;

        // if ever found even 1 image, don't show the error
        $('#recommend').hide();

        // Always nuke old data
        clearSlideTimeout();
        var vid = $('#gfyvid')[0];
        if (vid)
            vid.pause();
        rp.photos = [];
        rp.cache = {};
        rp.dedup = {};
        rp.session.after = '';
        rp.session.loadAfter = null;
        rp.session.activeIndex = -1;
        rp.session.activeAlbumIndex = -1;

        // destroy old Number Buttons
        $("#allNumberButtons").detach();
        $("#albumNumberButtons").detach();
        $('#allNumberButtonList').append($("<ul/>", { id: 'allNumberButtons' }));

        if (data && data.photos) {
            log.debug("RESTORING STATE: "+path);
            if (data.photos.length > 1)
                rp.session.after = data.after;
            rp.session.isAnimating = true;
            if (data.loadAfter)
                rp.session.loadAfter = eval(data.loadAfter);

            clearSlideTimeout();
            var orig_index = data.index;
            data.photos.forEach(function(photo) {
                var index = photo.index;
                // This allows the photo to be re-added
                delete photo.index;
                if (addImageSlide(photo)) {
                    // rebuild rp.dedup
                    if (photo.subreddit)
                        dedupAdd(photo.subreddit, photo.id);
                    else if (photo.tumblr)
                        dedupAdd(photo.tumblr.blog, photo.tumblr.id);
                    if (photo.dupes.length == 0)
                        return;
                    photo.dupes.forEach(function(dupe) {
                        if (dupe.subreddit)
                            dedupAdd(dupe.subreddit, dupe.id, '/r/'+photo.subreddit+'/'+photo.id);
                        else if (dupe.tumblr)
                            dedupAdd(dupe.tumblr, dupe.id, '/tumblr/'+photo.tumblr.blog+'/'+photo.tumblr.id);
                    });
                } else if (index < orig_index)
                    --data.index;
            });

            if (data.album < 0)
                data.album = -1;

            log.info("Restored "+path+" and "+rp.photos.length+" images of "+data.photos.length+" at index "+data.index+"."+data.album);
            rp.session.isAnimating = false;
            startAnimation(data.index, data.album);

        } else if (rp.url.subreddit.startsWith('/imgur/'))
            getImgurUser();

        else if (rp.url.subreddit.startsWith('/tumblr/'))
            getTumblrBlog();

        else if (rp.url.subreddit.startsWith('/wp/'))
            getWordPressBlog();

        else if (rp.url.subreddit.startsWith('/wp2/'))
            getWordPressBlogV2();

        else if (rp.url.subreddit.startsWith('/blogger/'))
            getBloggerBlog();

        else if (rp.url.subreddit.startsWith('/gfycat/'))
            getGfycatApiUser('gfycat');

        else if (rp.url.subreddit.startsWith('/redgifs/'))
            getGfycatApiUser('redgifs');

        else if (rp.url.subreddit.startsWith('/flickr/'))
            getFlickr();

        else
            getRedditImages();
    };

    rp.redditBaseUrl = "https://www.reddit.com";
    rp.redditLoginUrl =  rp.redditBaseUrl;
    rp.url.get = rp.redditBaseUrl;
    rp.url.api = rp.redditBaseUrl;

    initState();

    var path;
    if (window.location.origin !== "null")
        path = window.location.href.substr(window.location.origin.length);
    else
        // file://PATHAME?SUBREDDIT
        path = window.location.href.substr(window.location.pathname.length+7);

    processUrls(path, true);
});

/*
 * Editor modelines
 *
 * Local variables:
 * c-basic-offset: 4
 * tab-width: 8
 * indent-tabs-mode: nil
 * End:
 *
 * vi: set shiftwidth=4 tabstop=8 expandtab:
 * :indentSize=4:tabSize=8:noTabs=true:
 */
