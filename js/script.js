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
 * redditp-redditRefresh        - string  - auth refresh token from reddit.com
 * redditp-redditRefreshBy      - int     - time that bearer token expires
 * redditp-shouldAutoNextSlide  - boolean - on timeout, go to next image
 * redditp-showEmbed            - boolean - Show embeded content (iframes, no timeout)
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
 *      url:            URL link of "photo"    (addImageSlide() will call fixupUrl())
 *      over18:         BOOLEAN is nsfw (or any item in album is nsfw)
 *      title:          HTML Title of image     (creator of object needs to call fixupTitle())
 *      -- Optional --
 *      id:             TEXT Unique ID based on site+subreddit or blog
 *      date:           INT  Date in seconds
 *      author:         TEXT reddit username
 *      comments:       URL  link to photo comments
 *      commentN:       INT  Number of comments (if this is set, comments needs to be set too)
 *      eL:             BOOL Have loaded comment images or duplicate listings
 *      cross_id:       TEXT ID in duplictes of original link
 *      extra:          HTML Extra information for links concerning photo
 *      thumb:          URL  thumbnail of image (e.g. cached version from reddit)       [set by addPhotoThumb()]
 *      fb_thumb:       ARRAY of URLs Fallback thumbnail urls (must be images)          [set by addPhotoThumb()]
 *      flair:          TEXT text flair put next to title                       [read by picFlair()]
 *      score:          INT  Score (upvotes - downvotes)
 *      fallback:       ARRAY of URLs Fallback urls (if processed pic.url fails, try pic.fallback) [read by find_fallback()]
 *
 *      -- Other, NOT creator setable --
 *      type:           ENUM of imageTypes                              [set by processPhoto()]
 *      o_url:          URL original URL                                [set by processPhoto()]
 *      insertAt:       INT where to insert pictures in album           [set by addAlbumItem()]
 *      index:          INT index in rp.photos, used by album functions [set by addImageSlide()]
 *      dupes:          ARRAY of HASH                                   [set by addPhotoDupe()]
 *              id:             TEXT Unique ID (subreddit article id, tumblr post id, etc.)
 *              -- Optional --
 *              eL:             BOOL True if comments already loaded (same as above)
 *              title:          TEXT (same as above)
 *              date:           INT  (same as above)
 *              -- Site Dependent: Reddit --
 *              subreddit:      TEXT subreddit name (same as above)
 *              commentN:       INT  (same as above)
 *              -- Site Dependent: Tumblr --
 *              tumblr:         TEXT Tumblr site
 *              url:            URL  link to duplicate post
 *
 *      -- Depending on host site --
 *      subreddit:      TEXT of subreddit name
 *      tumblr:         HASH (e.g. 'https://'+tumblr.blog+'.tumblr.com'+/post/+tumblr.id )
 *              blog:   TEXT blog name
 *              id:     TEXT tumblr post id
 *      flickr:         HASH
 *              nsid:   TEXT of flickr user NSID
 *      gfycat:         HASH
 *              type:   TEXT (gfycat|redgifs)
 *              -- Optional --
 *              user:   TEXT username
 *              tags:   ARRAY of TEXT Gfycat Tags for photo
 *      imgur:          HASH
 *              -- Optional --
 *              user:   TEXT username
 *              tags:   ARRAY of TEXT
 *      iloopit:        HASH
 *              user:   TEXT username
 *              -- Optional --
 *              tags:   ARRAY of TEXT
 *
 *      -- Depending on image Type [see initPhotoTYPE()] --
 *      video:          HASH for video ext to url + thumbnail (see showVideo() / rp.mime2ext)   [set by initPhotoVideo() / addVideoUrl()]
 *              TYPE:           ARRAY of URLs (type is ext c.f. rp.ext2mime video/*)
 *              audio:          HASH of TYPE to URL (type is ext c.f. rp.ext2mime audio/*)
 *              -- set by showVideo() --
 *              duration:       INT length of video in seconds
 *              times:          INT number of times to play video
 *      album:          ARRAY of HASH
 *              (hash items are very similar to photo structure, but are not allowed to be albums)
 *              -- Specific to Album Items --
 *              parentIndex:    INT  Index of parent in rp.photos
 *              parent:         POINTER pointer to parent photo (prior to being added to rp.photos)
 *      html:           TEXT html to insert
 *      embed:          HASH
 *              aplay:          BOOL Embeded video will autoplay
 *
 * TODO:
 * * Cleanup photo.dupes - should be related to local url
 * * Fix dupes on album items (currently album dupes get assigned to parent dupes list), should behave more like tags
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
    dupeCacheTimeout: 360, // 6 minutes
    goodImageExtensions: ['jpg', 'jpeg', 'gif', 'bmp', 'png', 'svg'],
    goodVideoExtensions: ['webm', 'mp4', 'mov', 'm4v'], // Matched entry required in rp.mime2ext
    alwaysSecure: true,
    minScore: 1,
    decivolume: 5,
    // show All Embedded Items
    // Tri-state:
    //   -1 (NEVER)     - embedded items are never loaded
    //   0  (SOMETIMES) - embedded items are autoloaded if they won't autoplay
    //   1  (ALWAYS)    - embedded items are always loaded
    embed: 0,
    // show NSFW Items
    nsfw: false,
    mute: true,
};

rp.ALWAYS = 1;
rp.SOMETIMES = 0;
rp.NEVER = -1;

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
    redditRefreshToken: '',
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

rp.defaults = {
    wpv2: {
        'businessinsider.com': false,
        'npr.org': false,
        'onlyfans.com': false,
        'rpclip.com': true,
        'thotsbay.com': false,
        'tmz.com': false,
        'newyorker.com': false,
        'washingtonpost.com': false,
    },
    favicon: {
        'sta.sh': 'https://www.deviantart.com/favicon.ico',
    }
};

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
                wp: 'https://s1.wp.com/i/favicon.ico',
                dropbox: 'https://cfl.dropboxstatic.com/static/images/favicon.ico',
                redgifs: 'https://www.redgifs.com/assets/favicon-16x16.png',
                xhamster: 'https://static-lvlt.xhcdn.com/xh-mobile/images/favicon/favicon.ico',
                // i.redd.it/v.redd.it - reddit hosted images
                redd: 'https://www.redditstatic.com/icon.png'
              };

// Variable to store the images we need to set as background
// which also includes some text and url's.
rp.photos = [];

// cache of recently loaded duplicates
rp.loaded = {};

// per-site local cache
rp.sitecache = {};

// maybe checkout http://engineeredweb.com/blog/09/12/preloading-images-jquery-and-javascript/
// for implementing the old precache
rp.cache = {};
// use dedupAdd() and dedupVal()
rp.dedup = {};

rp.url = {
    // Set in processUrls()
    root:   '', // root of redditp app
    subreddit: "",
    base: '',
    get:  '',
    api:  '',
    path: '',
    vars: "",
    auth: "/api/v1/authorize",
    // Set in setupChoices()
    choice: "",
    sub: "" // actual name of singular sub-reddit, iff it's in URL
};

rp.fn = {};

$(function () {
    $("#navboxTitle").text("Loading Reddit Slideshow");

    const LOAD_PREV_ALBUM = -2;

    // Each must be different, since we compair on value, not on name
    // these map to the below enum for styles.
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

    const imageTypeStyle = {
        i: 'image',
        v: 'video',
        e: 'embed',
        a: 'album',
        l: 'later',
        t: 'thumb',
        h: 'html',
        X: 'failed'
    };

    const configNames = {
        nsfw: "nsfw",
        embed: "showEmbed",
        mute: "videoMute",
        shouldAutoNextSlide: "shouldAutoNextSlide",
        timeToNextSlide: "timeToNextSlide",
        minScore: "minScore",
        redditBearer: 'redditBearer',
        redditRefresh: 'redditRefresh',
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

    // Compare subreddit elements
    var subredditCompare = function(a, b) {
        var as = a.subreddit || a.tumblr;
        var bs = b.subreddit || b.tumblr;
        return as.toLowerCase().localeCompare(bs.toLowerCase());
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

    var getCurrentPic = function() {
        if (rp.session.activeIndex < 0)
            return undefined;
        var photo = rp.photos[rp.session.activeIndex];
        if (rp.session.activeAlbumIndex >= 0)
            photo = photo.album[rp.session.activeAlbumIndex];
        return photo;
    };
    rp.fn.getCurrentPic = getCurrentPic;

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
        // @@ album item?
        if (!photo || !photo.video)
            return false;
        if (photo.video.times == 1) {
            if (photo.video.duration < rp.settings.timeToNextSlide)
                photo.video.times = Math.ceil(rp.settings.timeToNextSlide/photo.video.duration);
            return false;
        }
        photo.video.times -= 1;
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
        setFavicon(link, url, favicon);
        data.append(link);
        return data.html();
    };

    var redditLink = function(path, pathalt, pathname, selected) {
        var classes;
        if (selected === true)
            classes = "info selected";
        return _localLink(rp.redditBaseUrl+path, path, pathname, pathalt, "reddit", classes);
    };

    var tumblrLink = function(blog) {
        return _localLink('https://'+blog+'.tumblr.com', '/tumblr/'+blog, blog, blog, rp.favicons.tumblr);
    };

    var flickrUserLink = function(nsid) {
        return localLink('https://flickr.com/'+nsid, flickrUserPP(nsid), '/flickr/'+nsid);
    };

    var iloopitUserLink = function(user) {
        return localLink('https://iloopit.net/'+user, user, '/iloopit/u/'+user);
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

    var remoteLink = function(url, text) {
        var data = $('<div/>');
        data.append(_infoAnchor(url, text));
        var link = _infoAnchor(url, '', '', "info infor remote");
        setFavicon(link, url);
        data.append(link);
        return data.html();
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

    function open_in_background(selector) {
        var link = $(selector);
        open_in_background_url(link[0]);
    }

    function open_in_background_url(link) {
        // as per https://developer.mozilla.org/en-US/docs/Web/API/event.initMouseEvent
        // works on latest chrome, safari and opera
        if (link === undefined)
            return;
        if (link.attributes.href.value == "#")
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
            onlysld = false;
        if (onlysld) {
            var a = hostname.match(/[^.]+\.([^.]{2,3}\.\w{2}|\w{2,})$/);
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
    rp.fn.extensionOf = extensionOf;

    // Take a URL and strip it down to the "shortid"
    // url2shortid(url [, index=-1 [, seperator[, after=true]]])
    // Index actually starts at 1 since 0 is always empty
    // "/this/is/a/path/".split('/') == [ "", "this", "is", "a", "path", "" ]
    // seperator (usually '-') seperates chafe from shortid
    // hostname.tld/media/this-is-a-title-SHORTID/widget.extention
    // url2shortid(url, 2, '-') yields SHORTID
    var url2shortid = function(url, index, sep, after) {
        var shortid;
        var path = pathnameOf(url);

        var a = path.split('/');
        if (a[a.length-1] == "")
            a.pop();

        if (index === undefined || index == -1 || index >= a.length)
            index = a.length-1;

        if (after === undefined)
            after = true;

        shortid = a[index];

        // Trim off file extenstion
        if (shortid.indexOf('.') != -1)
                shortid = shortid.substr(0, shortid.lastIndexOf('.'));

        if (sep !== undefined && shortid.indexOf(sep) != -1) {
            if (after)
                // Trim down chafe-chafe-chafe<SEP><SHORTID>
                shortid = shortid.substr(shortid.lastIndexOf(sep)+sep.length);
            else
                // Trim <SHORTID><SEP>chafe
                shortid = shortid.substr(0, shortid.lastIndexOf(sep));
        }

        if (!shortid)
            throw("No shortid for url");

        return shortid;
    };

    rp.fn.url2shortid = url2shortid;

    var isGoodExtension = function (url, arr) {
        var extension = extensionOf(url);
        if (extension === '')
            return false;
        if (arr.indexOf(extension) >= 0)
            return extension;
        return false;
    };

    var isImageExtension = function(url) {
        return isGoodExtension(url, rp.settings.goodImageExtensions);
    };

    var isVideoExtension = function(url) {
        return isGoodExtension(url, rp.settings.goodVideoExtensions);
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
        return unescapeHTML(picTitle(pic));
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

    var dedupArrAdd = function(arr, sub, id, link)  {
        if (!link)
            link = "SELF";
        if (!arr[sub])
            arr[sub] = {};
        if (!arr[sub][id])
            arr[sub][id] = link;
        return arr[sub][id];
    };

    var dedupArrVal = function(arr, sub, id) {
        return (arr[sub]) ?arr[sub][id] :undefined;
    };

    // orig_sub and orig_id are optional for SELF links
    var dedupAdd = function(sub, id, link) {
        return dedupArrAdd(rp.dedup, sub, id, link);
    };

    var dedupVal = function(sub, id) {
        return dedupArrVal(rp.dedup, sub, id);
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
        if (state == "open") {
            // close it
            $(this).html($(this).attr('symbol-close') || "&rarr;");
            // move to the left just enough so the collapser arrow is visible
            var arrowLeftPoint = $(this).position().left;
            $(this).parent().animate({
                left: "-" + arrowLeftPoint + "px",
                height: ($(this).height() * 2) + "px",
            });
            $(this).data(STATE, "closed");
        } else {
            // open it
            $(this).html($(this).attr('symbol-open') || "&larr;");
            $(this).parent().animate({
                left: "0px"
            });
            // No jquery way to unset height value in animate
            $(this).parent().height("");
            $(this).data(STATE, "open");
        }
    });

    var setVcollapseHtml = function(collapser) {
        var state = collapser.data(STATE);
        if (state == "closed") {
            var count = collapser.data('count');
            if (count)
                collapser.html('<span class="count">('+count+')</span>');
            else
                collapser.html(collapser.attr('symbol-close') || "&darr;");
        } else { // state == open
            collapser.html(collapser.attr('symbol-open') || "&uarr;");
        }
    };

    $('.vcollapser').click(function () {
        var state = $(this).data(STATE);
        var divname = $(this).data('controldiv');
        var div = $('#'+divname);
        if (state == "open") {
            // close it
            $(div).animate({ height: "0px"}, function() { $(div).hide(); $(div).css("height", ""); });
            $(this).data(STATE, "closed");
        } else { // closed
            // open it
            var h = $(div).height();
            $(div).css("height", "0px");
            $(div).show();
            $(div).animate({ height: h+"px"}, function() { $(div).css("height", ""); });
            $(this).data(STATE, "open");
        }
        setVcollapseHtml($(this));
    });

    // Called to fixup input.icontoggle
    // can be invoked: fixIconToggle.call($('#NAME'))
    var fixIconToggle = function() {
        var attrname = $(this).is(':checked') ?"icon-on" :"icon-off";
        $('label[for="'+$(this).attr('id')+'"] i').text($(this).attr(attrname));
    };

    var getTristate = function(item) {
        var state;
        switch (item.val()) {
        case item.attr("icon-always"):
            state = rp.ALWAYS;
            break;
        case item.attr("icon-sometimes"):
            state = rp.SOMETIMES;
            break;
        case item.attr("icon-never"):
            state = rp.NEVER;
            break;
        default:
            throw "Unknown state for "+item.attr('id')+": "+item.val();
        }
        return state;
    };

    var nextTristate = function(state) {
        switch (state) {
        case rp.ALWAYS:
            state = rp.NEVER;
            break;
        case rp.SOMETIMES:
            state = rp.ALWAYS;
            break;
        case rp.NEVER:
            state = rp.SOMETIMES;
            break;
        }
        return state;
    };

    var setTristate = function(item, state) {
        var attr;
        switch (state) {
        case rp.ALWAYS:
            attr = "icon-always";
            break;
        case rp.SOMETIMES:
            attr = "icon-sometimes";
            break;
        case rp.NEVER:
            attr = "icon-never";
            break;
        }
        item.val(item.attr(attr));
    };

    var cycleTristate = function() {
        var name = $(this).attr("name");
        var state = nextTristate(getTristate($(this)));

        rp.settings[name] = state;
        setConfig(configNames[name], state);
        setTristate($(this), state);
    };

    $(document).on('click', 'input.icontoggle', fixIconToggle);

    $(document).on('click', 'input.icontristate', cycleTristate);

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
    rp.fn.setConfig = setConfig;

    var getConfig = function (c_name, defaultValue) {
        // undefined in case nothing found
        var name = "redditp-"+c_name;
        var value = (rp.session.fakeStorage) ?rp.storage[c_name] :window.localStorage[name];
        if (value === "undefined" || value == undefined)
            return defaultValue;
        value = JSON.parse(value);
        if (typeof(defaultValue) == "object") {
            for (var k of Object.keys(defaultValue)) {
                if (!value[k])
                    value[k] = defaultValue[k];
            }
        }
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
              (type == imageTypes.embed && rp.settings.embed < rp.ALWAYS)))
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
        setConfig(configNames.shouldAutoNextSlide, rp.settings.shouldAutoNextSlide);
        // Check if active image is a video before reseting timer
        var pic = getCurrentPic();
        if (!pic || pic.type != imageTypes.video)
            resetNextSlideTimer();
    };

    var updateExtraLoad = function () {
        var photo = rp.photos[rp.session.activeIndex];
        if (photo.eL)
            $('#navboxExtraLoad').html(googleIcon("check_box")).attr('title', "Extras Already Loaded");
        else if (!photo.comments || !photo.commentN)
            $('#navboxExtraLoad').html(googleIcon("speaker_notes_off")).attr('title', 'No Comments Available');
        else
            $('#navboxExtraLoad').html(googleIcon("mms")).attr('title', "Load Extras from Comments (e)");
    };

    var initState = function () {
        rp.wpv2 = getConfig(configNames.wpv2, rp.defaults.wpv2);
        rp.insecure = getConfig(configNames.insecure, {});
        rp.blogger = getConfig(configNames.blogger, {});
        rp.flickr.u2nsid = getConfig(configNames.nsid, {});
        // Build reverse map
        if (rp.flickr.u2nsid)
            rp.flickr.nsid2u = Object.keys(rp.flickr.u2nsid).reduce(function(obj,key) {
                obj[ rp.flickr.u2nsid[key] ] = key;
                return obj;
            }, {});
        rp.faviconcache = getConfig(configNames.favicon, rp.defaults.favicon);

        rp.session.redditRefreshToken = getConfig(configNames.redditRefresh, "");
        var bearer = getConfig(configNames.redditBearer, "");
        var by = getConfig(configNames.redditRefreshBy, 0);
        setupRedditLogin(bearer, by);

        ["nsfw", "mute"].forEach(function (item) {
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

        // Convert binary state to tristate button
        var tristateConvert = function(name) {
            var config = getConfig(configNames[name]);
            if (config === undefined)
                config = rp.settings[name];
            else if (config === true)
                config = rp.ALWAYS;
            else if (config === false)
                config = rp.NEVER;
            if (typeof(config) != "number")
                config = rp.NEVER;
            rp.settings[name] = config;
            setConfig(configNames[name], config);
            setTristate($('#'+name), config);
        };
        tristateConvert("embed");

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

        volume_set(getConfig(configNames.decivolume));
        $("a.volume").click(volume_adjust);

        $('#fullscreen').change(function() {
            var elem = document.getElementById('page');
            if (document.fullscreenElement || // alternative standard method
                document.webkitFullscreenElement ||
                document.msFullscreenElement) { // current working methods
                if (document.exitFullscreen) {
                    document.exitFullscreen();
                } else if (document.webkitExitFullscreen) {
                    document.webkitExitFullscreen();
                } else if (document.msExitFullscreen) { // IE11
                    document.msExitFullscreen();
                }
            } else {
                if (elem.requestFullscreen) {
                    elem.requestFullscreen();
                } else if (elem.webkitRequestFullscreen) {
                    elem.webkitRequestFullscreen();
                } else if (elem.msRequestFullscreen) { // IE11
                    elem.msRequestFullscreen();
                }
            }
        });

        $('#timeToNextSlide').keyup(updateTimeToNextSlide);

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
        var ua = navigator.userAgent;
        if (/(iPad|iPhone|iPod|Mobile)/.test(ua)) {
            var v = ua.match(/OS (\d+)/);
            if (v.length < 2)
                v[1] = 9;

            if (parseInt(v[1], 10) < 10) {
                rp.session.needsPlayButton = true;
                // no volume or mute/unmute support
                $('.volume-mute').hide();
                $('.volume').hide();
            } else {
                rp.session.volumeIsMute = true;
                // volume can be used as a mute button
                // 0 - muted
                // 1 - user controlled volume
                $('.volume').hide();
            }
            // caues fatfinger presses
            rp.session.showRedditLink = false;

            // collapse duplicates by default
            var dups = $('#duplicatesCollapser');
            if (dups.data(STATE) != "closed") {
                $('#duplicatesCollapser').click();
            }

            // Hide useless "fullscreen" button on iOS safari
            $('.fullscreen-ctrl').remove();

            // New mobile site doesn't work for auth if not logged in
            rp.redditLoginUrl = 'https://old.reddit.com';
            rp.url.auth = '/api/v1/authorize.compact';

            // Remove :hover on #loginLi, so it only responds to clicks
            $('#loginLi').removeClass('use-hover');

            $(document).on('click', 'a.remote', function (event) {
                if (event) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                }
                open_in_background($(this));
            });
            // Some embedded sites don't display correctly, so disable by default
            setConfig(configNames.embed, rp.NEVER);
            setTristate($('#embed'), rp.NEVER);
        }
    };

    var addNumberButton = function (numberButton) {
        var buttonUl = $("#allNumberButtons");
        var newListItem = $("<li />").appendTo(buttonUl);
        numberButton.appendTo(newListItem);
    };

    // push new thumb to top of list
    var addPhotoThumb = function(photo, url) {
        if (!url || url == photo.thumb)
            return;
        var oldthumb = photo.thumb;
        photo.thumb = fixupUrl(url);
        if (oldthumb) {
            if (!photo.fb_thumb)
                photo.fb_thumb = [];
            photo.fb_thumb.unshift(oldthumb);
        }
    };

    var initPhotoImage = function(photo, url) {
        photo.type = imageTypes.image;
        if (url)
            photo.url = url;
        fixPhotoButton(photo);
    };

    var initPhotoThumb = function(photo, url) {
        if (!url)
            url = photo.thumb;
        if (url) {
            photo.url = url;
            photo.type = imageTypes.thumb;
            fixPhotoButton(photo);
        } else
            initPhotoFailed(photo);
    };

    var initPhotoFailed = function(photo) {
        photo.type = imageTypes.fail;
        delete photo.album;
        fixPhotoButton(photo);
    };

    var initPhotoEmbed = function(photo, url, autoplay, thumb) {
        if (autoplay === undefined)
            autoplay = true;
        photo.type = imageTypes.embed;
        if (url)
            photo.url = url;
        addPhotoThumb(photo, thumb);
        photo.embed = { aplay: autoplay };
        fixPhotoButton(photo);
    };

    var initPhotoYoutube = function(photo, shortid, startat) {
        addPhotoThumb(photo, 'https://i.ytimg.com/vi/'+shortid+'/hqdefault.jpg');
        initPhotoEmbed(
            photo,
            youtubeURL(shortid, startat),
            true,
            'https://i.ytimg.com/vi/'+shortid+'/maxresdefault.jpg'
        );
    };

    var initPhotoiLoopit = function(photo, shortid) {
        initPhotoVideo(photo, ['https://cdn.iloopit.net/resources/'+shortid+'/converted.mp4',
                               'https://cdn.iloopit.net/resources/'+shortid+'/converted.webm'],
                       'https://cdn.iloopit.net/resources/'+shortid+'/thumb.jpeg');
    };

    // Return index of inserted duplicate, or -1 if not
    var addPhotoDupe = function(photo, dupe) {
        if (photo.id == dupe.id &&
            photo.subreddit == dupe.subreddit &&
            ((photo.tumblr) ?photo.tumblr.blog :undefined) == dupe.tumblr)
            return -1;
        if (!photo.dupes)
            photo.dupes = [];
        var i = 0;
        while (i < photo.dupes.length) {
            if (photo.dupes[i].id == dupe.id &&
                photo.dupes[i].subreddit == dupe.subreddit &&
                photo.dupes[i].tumblr == dupe.tumblr)
                return -1;
            if (subredditCompare(photo.dupes[i], dupe) > 0)
                break;
            ++i;
        }

        photo.dupes.splice(i, 0, dupe);
        return i;
    };

    var addVideoUrl = function(photo, type, url) {
        if (!photo.video[type])
            photo.video[type] = [ url ];
        else
            photo.video[type].push(url);
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

        addPhotoThumb(photo, thumbnail);

        fixPhotoButton(photo);
    };

    var initPhotoHtml = function(photo, html) {
        photo.type = imageTypes.html;
        photo.html = html;
        fixPhotoButton(photo);
    };

    // is the pic active
    //   photo.album[x] : is parent activeIndex
    //   rp.photo[x] : is activeIndex
    var isActive = function (pic) {
        var photo = photoParent(pic);
        return (photo.index !== undefined &&
                photo.index == rp.session.activeIndex);
    };

    // is the pic the currently selected image
    //   photo.album[x] : is parent activeIndex && is item activeAlbumIndex
    //   rp.photo[x] : is activeIndex && activeAlbumIndex == NONE
    var isActiveCurrent = function (pic) {
        if (!isActive(pic))
            return false;
        var photo = photoParent(pic);
        if (pic == photo)
            return (rp.session.activeAlbumIndex == -1);
        return (rp.session.activeAlbumIndex == photo.album.indexOf(pic));
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
            if (pic.embed)
                photo.embed = pic.embed;

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
        delete pic.parentIndex;
        delete pic.parent;

        // Copy all entries not in photo from pic
        var keys = Object.keys(pic);
        for (var i in keys) {
            var key = keys[i];
            if (!photo[key])
                photo[key] = pic[key];
        }
        log.debug("moved first album to primary item: "+photo.url);
        fixPhotoButton(photo);
        delete photo.album;
    };

    var initPhotoAlbum = function(pic, keepfirst) {
        var photo = photoParent(pic);
        if (keepfirst === undefined)
            keepfirst = true;

        if (photo.type != imageTypes.album) {
            var img;
            if (keepfirst) {
                img = {
                    url: photo.url,
                    thumb: photo.thumb,
                    type: photo.type,
                    o_url: photo.o_url,
                };

                for (var key of ["embed", "video", "html", "extra", "gfycat", "imgur", "flickr", "tumblr", "iloopit"]) {
                    if (photo[key]) {
                        img[key] = photo[key];
                        delete photo[key];
                    }
                }
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

        // if initPhotoAlbum(photo, true) was called but we need to
        // kill it, if it's re-called with false.
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
        initPhotoThumb(photo);
    };


    // Call after all addAlbumItem calls
    // setup number button and session.activeAlbumIndex
    // returns index of image to display
    var indexPhotoAlbum = function (photo, imageIndex, albumIndex) {
        if (photo.type != imageTypes.album)
            return -1;

        if (photo.album.length == 0)
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
        $("#albumNumberButtons").remove();

        var div = $("<div>", { id: 'albumNumberButtons',
                               class: 'numberButtonList'
                             });
        var ul = $("<ul />");
        div.append(ul);

        var total = 0;
        if (photo.type == imageTypes.album) {
            for (var [index, pic] of photo.album.entries()) {
                ul.append(albumButtonLi(pic, index));
                ++ total;
            }

            if ($('#albumCollapser').data(STATE) == "closed")
                $(div).hide();
        } else {
            $(div).hide();
        }
        $('#albumCollapser').data("count", total);
        setVcollapseHtml($('#albumCollapser'));
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

        if (photo.insertAt < 0) {
            photo.album.push(pic);
            if (isActive(photo))
                $('#albumNumberButtons ul').append(albumButtonLi(pic, photo.album.length-1));

        } else {
            var index = photo.insertAt++;
            photo.album.splice(index, 0, pic);
            if (isActive(photo)) {
                $('#albumNumberButtons ul').children(":nth-child("+(index)+")").after(albumButtonLi(pic, photo.insertAt));
                reindexPhotoAlbum(photo, index);
            }
        }
    };

    var updateNavboxTypes = function(image) {
        $('#navboxLink').attr('href', image.url).attr('title', picTitleText(image)+" (i)");
        updateButtonClass($('#navboxLink'), image);

        switch (image.type) {
        case imageTypes.image:
        case imageTypes.thumb:
        case imageTypes.fail:
            $('#navboxImageSearch').attr('href', 'https://www.google.com/searchbyimage?encoded_image=&image_content=&filename=&hl=en&image_url='+image.url).show();
            break;
        default:
            $('#navboxImageSearch').attr('href', '#').hide();
            break;
        }
    };

    var fixPhotoButton = function(pic, button) {
        var parent = photoParent(pic);

        // no buttons exist
        if (parent.index === undefined)
            return;

        if (isActiveCurrent(pic))
            updateNavboxTypes(pic);

        if (pic == parent) {
            if (button == undefined)
                button = $('#numberButton'+(pic.index+1));

        } else if (!isActive(parent))
            return;

        else if (button == undefined)
            button = $('#albumNumberButtons ul').children(":nth-child("+(parent.album.indexOf(pic)+1)+")").children("a");

        if (isActive(parent))
            $("#albumNumberButtons").hide();

        updateButtonClass(button, pic);
    };

    var updateButtonClass = function(button, pic) {
        button.removeClass('image video embed album later thumb html failed over18');
        addButtonClass(button, pic);
    };

    var processPhoto = function(pic) {
        if (pic === undefined || pic.url === undefined)
            return false;

        if (pic.o_url === undefined)
            pic.o_url = pic.url;

        pic.url = fixupUrl(pic.url);

        // Return if already setup
        if (pic.type == imageTypes.fail)
            return false;

        if (pic.type == imageTypes.album)
            return (pic.album !== undefined);

        if (pic.type == imageTypes.video)
            return (pic.video !== undefined)

        if (pic.type == imageTypes.html)
            return (pic.html !== undefined)

        if (pic.type == imageTypes.embed ||
            pic.type == imageTypes.image)
            return true;

        if (pic.type === undefined)
            pic.type = imageTypes.image;

        var shortid, a, o, host;
        var fqdn = hostnameOf(pic.url);
        // hostname only: second-level-domain.tld
        var hostname = hostnameOf(pic.url, true);
        var orig_hn = hostnameOf(pic.o_url, true);

        try {
            if (!pic.url.startsWith('http'))
                throw "bad schema in URL";

            if (pic.type == imageTypes.thumb &&
                (orig_hn == 'dropbox.com' ||
                 orig_hn == 'tumblr.com'))
                // capture items we want to skip from tryPreview()
                throw "REJECTED";

            if (hostname == 'imgur.com') {
                pic.url = fixImgurPicUrl(pic.url);
                a = extensionOf(pic.url);
                if (pic.url.indexOf("/a/") > 0 ||
                    pic.url.indexOf('/gallery/') > 0)
                    pic.type = imageTypes.later;

                else if (isVideoExtension(pic.url)) {
                    initPhotoVideo(pic);
                    pic.url = 'https://imgur.com/'+url2shortid(pic.url);

                } else if (!a) {
                    pic.url = 'https://imgur.com/'+url2shortid(pic.url);
                    pic.type = imageTypes.later;

                } else if (a == 'gif') {
                    // catch imgur.com/SHORTID.mp4.gif
                    a = pic.url.substr(0, pic.url.lastIndexOf('.'));
                    if (isVideoExtension(a)) {
                        initPhotoVideo(pic, a);
                        pic.url = 'https://imgur.com/'+url2shortid(pic.url);
                    } else {
                        pic.url = 'https://imgur.com/'+url2shortid(pic.url);
                        pic.type = imageTypes.later;
                    }
                }

                // otherwise simple image

            } else if (hostname == 'gifs.com') {
                shortid = url2shortid(pic.url, -1, '-');
                pic.url = 'https://gifs.com/gif/'+shortid;
                initPhotoVideo(pic, [ 'https://j.gifs.com/'+shortid+'@large.mp4',
                                      'https://j.gifs.com/'+shortid+'.mp4' ],
                               'https://j.gifs.com/'+shortid+'.jpg');

            } else if (hostname == 'giphy.com') {
                // giphy.com/gifs/NAME-OF-VIDEO-SHORTID
                // media.giphy.com/media/SHORTID/giphy.TYPE
                // i.giphy.com/SHORTID.TYPE
                shortid = url2shortid(pic.url, 2, '-');
                pic.url = 'https://giphy.com/gifs/'+shortid;
                initPhotoVideo(pic, 'https://i.giphy.com/media/'+shortid+'/giphy.mp4');

            } else if (hostname == 'makeagif.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'media') {
                    o = pic.url.substring(0, pic.url.lastIndexOf('.'));
                    initPhotoVideo(pic, o+".mp4", o+".jpg");
                } else {
                    if (a[1] == 'i')
                        shortid = url2shortid(pic.url);
                    else
                        shortid = url2shortid(pic.url, -1, '-');
                    initPhotoEmbed(pic, 'https://makeagif.com/i/'+shortid);
                }

            } else if (hostname == 'gfycat.com' ||
                       hostname == 'redgifs.com' ||
                       hostname == 'gifdeliverynetwork.com') {
                shortid = url2shortid(pic.url, -1, '-', false);
                if (shortid == 'about')
                    throw "bad url";
                pic.url = gfycatPhotoUrl(shortid, (hostname == 'gfycat.com') ?'gfycat' :'redgifs');
                pic.type = imageTypes.later;

            } else if (hostname == 'iloopit.net') {
                // VIDEO:
                // https://gifs.iloopit.net/resources/UUID/converted.gif
                // https://cdn.iloopit.net/resources/UUID/converted.{mp4,webm}
                // https://cdn.iloopit.net/resources/UUID/thumb.jpeg
                // GIFV: (no easy way to convert ID (uint32-ish) to VIDEO UUID)
                // https://iloopit.net/ID/TITLE-NAME.gifv
                // https://iloopit.net/ID/TITLE/ - though text in title doesn't matter
                if (extensionOf(pic.url) == 'gif' || isVideoExtension(pic.url)) {
                    shortid = url2shortid(pic.url, 2);
                    initPhotoiLoopit(pic, shortid);

                } else {
                    shortid = searchValueOf(pic.url, "loopid");
                    if (shortid) {
                        loadiLoopitTags();
                        pic.url = 'https://iloopit.net/porngifs/all/?type=looplayer&loopid='+shortid;
                        pic.type = imageTypes.later;
                    } else
                        throw "unknown iloopit format";
                }

            } else if (hostname == 'clippituser.tv' ||
                       hostname == 'clippit.tv') {
                if (fqdn == 'clips.clippit.tv')
                    shortid = url2shortid(pic.url, 1);
                else
                    shortid = url2shortid(pic.url);
                initPhotoVideo(pic, ['https://clips.clippit.tv/'+shortid+'/720.mp4',
                                     'https://clips.clippit.tv/'+shortid+'/360.mp4'],
                               'https://clips.clippit.tv/'+shortid+'/thumbnail.jpg');

            } else if (fqdn == 'commons.wikimedia.org') {
                if (isImageExtension(pic.url) ||
                    isVideoExtension(pic.url))
                    pic.type = imageTypes.later;
                else
                    throw "unknown wikimedia url"

            } else if (isVideoExtension(pic.url)) { // #### VIDEO ####
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
                    throw("NYI: vidble album processing");

                else {
                    shortid = shortid.replace(/_.+/, '');
                    pic.url = 'https://www.vidble.com/'+shortid+'.jpg';
                }

            } else if (isImageExtension(pic.url) || // #### IMAGE ####
                       fqdn == 'i.reddituploads.com') {
                // simple image

            } else if (hostname == 'apnews.com' ||
                       hostname == 'livestream.com' ||
                       hostname == 'streamable.com' ||
                       hostname == 'wordpress.com' ||
                       hostname == 'wp.com') {
                if (url2shortid(pic.url))
                    // These domains should always be processed later
                    pic.type = imageTypes.later;

            } else if (hostname == 'cbsnews.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'video')
                    initPhotoEmbed(pic, pic.url, false);
                else
                    throw "non-video url";

            } else if (hostname == 'd.tube') {
                a = pathnameOf(pic.url).split('/');
                initPhotoEmbed(pic, 'https://emb.d.tube/#!/'+a.slice(2,4).join('/'), false);

            } else if (hostname == 'deviantart.com') {
                a = pathnameOf(pic.url).split('/');
                if (a.length > 0 && (a[1] == "art" || a[2] == "art"))
                    pic.type = imageTypes.later;
                else
                    throw "bad deviantart oembed";

            } else if (hostname == 'facebook.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'watch' ||
                    a[2] == 'videos')
                    // @@ mute doesn't change with toggle
                    initPhotoEmbed(pic, 'https://www.facebook.com/plugins/video.php?autoplay=1&mute='+
                                   ((isVideoMuted()) ?"1" :"0")
                                   +'&show_text=0&href='+encodeURIComponent(pic.url))
                else
                    throw "non-media url";

            } else if (hostname == 'fav.me' ||
                       hostname == 'sta.sh') {
                shortid = url2shortid(pic.url);
                pic.url = originOf(pic.url)+'/'+shortid;
                pic.type = imageTypes.later;

            } else if (hostname == 'flickr.com') {
                // flickr.com/photos/USERID/ID[/*]
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'photos' && a.length > 3)
                    pic.type = imageTypes.later;
                else
                    throw "unknown flickr url";

            } else if (hostname == 'gyazo.com') {
                shortid = url2shortid(pic.url);
                pic.url = 'https://i.gyazo.com/'+shortid+'.png';
                pic.fallback = [ 'https://i.gyazo.com/'+shortid+'.jpg',
                                 'https://i.gyazo.com/'+shortid+'.mp4' ];

            } else if (hostname == 'hugetits.win') {
                shortid = url2shortid(pic.url, -1, '-', false);
                a = pathnameOf(pic.url).split('/');
                if (a[1] != "video")
                    throw "non-video url";
                pic.url = gfycatPhotoUrl(shortid, 'gfycat'); // will fallback to redgifs
                pic.type = imageTypes.later;

            } else if (hostname == 'msnbc.com') {
                // https://www.msnbc.com/SHOW/watch/TITLE-OF-VIDEO-ID
                a = pathnameOf(pic.url).split('/');
                if (a[2] != "watch")
                    throw "non-video url";
                shortid = url2shortid(pic.url, -1, '-');
                initPhotoEmbed(pic, "https://www.msnbc.com/msnbc/embedded-video/mmvo"+shortid, false);

            } else if (hostname == 'hentai-foundry.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'pictures' && a[2] == "user" && a.length >= 5) {
                    shortid = ['https://pictures.hentai-foundry.com',
                               a[3][0].toLowerCase(),
                               a[3],
                               a[4],
                               [ a[3], a[4], a[5] ].join("-")
                              ].join("/");
                    pic.url = shortid + ".jpg";
                    pic.fallback = [ shortid + ".png" ];

                } else
                    throw "non-picture";

            } else if (hostname == 'nbcnews.com') {
                // https://www.nbcnews.com/widget/video-embed/ID
                // https://www.nbcnews.com/video/title-of-video-ID
                // https://www.nbcnews.com/SHOW/video/title-of-video-ID
                a = pathnameOf(pic.url).split('/');
                if (a[1] != 'video' &&
                    a[2] != 'video' &&
                    a[2] != 'video-embed')
                    throw "non-video url";
                shortid = url2shortid(pic.url, -1, '-');
                initPhotoEmbed(pic, "https://www.nbcnews.com/widget/video-embed/"+shortid, false);

            } else if (hostname == 'peekvids.com' ||
                       hostname == 'pornoeggs.com') {
                shortid = url2shortid(pic.url, 1);
                if (shortid == "v") {
                    shortid = url2shortid(pic.url);
                } else if (shortid == "watch") {
                    a = searchOf(pic.url);
                    shortid = a.v;
                } else if (shortid == 'sq')
                    throw "bad url";
                if (shortid)
                    initPhotoEmbed(pic, originOf(pic.url)+"/embed?v="+shortid, false);
                else
                    throw "unknown url";

            } else if (hostname == 'pixeldrain.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'u')
                    shortid = a[2];
                else if (a[1] == "api" && a[2] == "file")
                    shortid = a[3];
                else
                    throw "unknown pixeldrain url";

                if (a[4] === 'image')
                    initPhotoImage(pic, 'https://pixeldrain.com/api/file/'+shortid);

                else {
                    initPhotoVideo(pic, 'https://pixeldrain.com/api/file/'+shortid,
                                   'https://pixeldrain.com/api/file/'+shortid+'/thumbnail');
                    pic.fallback = [ 'https://pixeldrain.com/api/file/'+shortid+'/image' ];
                }

            } else if (hostname == 'pornhub.com') {
                // JSON Info about video
                // 'https://www.pornhub.com/webmasters/video_by_id?id='+shortid
                a = searchOf(pic.url);
                shortid = a.viewkey;
                if (a.pkey)
                    pic.extra = remoteLink('https://www.pornhub.com/playlist/'+a.pkey, 'Playlist');
                if (shortid)
                    initPhotoEmbed(pic, 'https://www.pornhub.com/embed/'+shortid+'?autoplay=1');
                else
                    throw "search not supported";

            } else if (hostname == 'reddit.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'gallery')
                    pic.type = imageTypes.later;
                else
                    throw "non-media url";

            } else if (hostname == 'redtube.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, 'https://embed.redtube.com/?bgcolor=000000&id='+shortid, false);

            } else if (hostname == 'sendvid.com' ||
                       hostname == 'pornflip.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == "v")
                    shortid = a[2];
                else
                    shortid = a[1];
                initPhotoEmbed(pic, originOf(pic.url)+'/embed/'+shortid, false);

            } else if (hostname == 'spankbang.com') {
                shortid = url2shortid(pic.url, 1);
                if (shortid == "s")
                    throw "search url";
                initPhotoEmbed(pic, 'https://spankbang.com/embed/'+shortid, false);

            } else if (hostname == "streamtape.com") {
                shortid = url2shortid(pic.url, 2);
                initPhotoEmbed(pic, originOf(pic.url)+"/e/"+shortid+"/", false)

            } else if (hostname == 'streamvi.com') {
                shortid = url2shortid(pic.url);
                initPhotoVideo(pic, 'https://cdnvistreamviz.r.worldssl.net/uploads/'+shortid+'.mp4',
                               'https://cdn.streamvi.com/uploads/'+shortid+'.jpg');

            } else if (hostname == 'tnaflix.com') {
                shortid = url2shortid(pic.url, -1, 'video');
                initPhotoEmbed(pic, 'https://player.tnaflix.com/video/'+shortid, false);

            } else if (hostname == 'triller.fail') {
                shortid = searchValueOf(pic.url, 'v');
                if (!shortid)
                    shortid = url2shortid(pic.url);

                initPhotoVideo(pic, 'https://v.triller.fail/'+shortid+'.mp4');

            } else if (hostname == 'tube8.com') {
                shortid = pathnameOf(pic.url);
                initPhotoEmbed(pic, 'https://www.tube8.com/embed'+shortid, false);

            } else if (hostname == 'tumblr.com') {
                if (pic.url.indexOf('/post/') > 0)
                    // Don't process bare tumblr blogs, nor /day/YYYY/MM/DD/ format
                    // only BLOGNAME.tumblr.com/post/SHORTID/...
                    pic.type = imageTypes.later;

                else if (pic.url.endsWith('gifv'))
                    initPhotoVideo(pic, pic.url.replace(/gifv$/, "mp4"));

                else
                    throw "unknown url";

            } else if (hostname == 'twitch.tv') {
                try {
                    shortid = url2shortid(pic.url);
                } catch (e) {
                    shortid = 'embed';
                }
                a = searchOf(pic.url);
                host = window.location.host;

                if (!host)
                    throw "twitch needs an embedding fqdn";
                if (window.location.protocol != 'https:')
                    throw "witch needs embedding url to be https://";

                if (fqdn == 'clips.twitch.tv' && shortid != 'embed')
                    a.clip = shortid;
                else if (fqdn == 'www.twitch.tv' && shortid != 'embed')
                    a.clip = shortid;

                if (a.clip)
                    initPhotoEmbed(pic, 'https://clips.twitch.tv/embed?autoplay=true&parent='+host+'&clip='+a.clip);
                else if (a.video)
                    initPhotoEmbed(pic, 'https://player.twitch.tv/?autoplay=true&parent='+host+'&video='+a.video);
                else
                    throw "unknown twitch url";

            } else if (hostname == 'twitter.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[2] == "status") {
                    pic.url = 'https://twitter.com/'+a.slice(1,4).join("/");
                    pic.type = imageTypes.later;
                } else
                    throw "unknown twitter url";

            } else if (hostname == 'vimeo.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, 'https://player.vimeo.com/video/'+shortid+'?autoplay=1');

            } else if (hostname == 'worldsex.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, originOf(pic.url)+'/videos/embed/'+shortid, false);

            } else if (hostname == 'xtube.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, 'https://www.xtube.com/video-watch/embedded/'+shortid+'?embedsize=big', false);

            } else if (hostname == 'xvideos.com') {
                shortid = url2shortid(pic.url, 1, 'video');
                initPhotoEmbed(pic, 'https://www.xvideos.com/embedframe/'+shortid, false);

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

            } else if (hostname == 'youjizz.com') {
                shortid = url2shortid(pic.url, 2, '-');
                initPhotoEmbed(pic, originOf(pic.url)+'/videos/embed/'+shortid, false);

            } else if (rp.wpv2[hostname]) {
                shortid = url2shortid(pic.url);
                pic.type = imageTypes.later;

            } else if (pic.type == imageTypes.thumb)
                throw("bad thumb");

            else {
                a = pathnameOf(pic.url).split('/');
                if (a.length > 2 &&
                    (a[1] == 'video' ||
                     a[1] == 'videos' ||
                     a[1] == 'watch' ||
                     a[1] == 'v')) {
                    // Sites that definitely don't work with above
                    if (hostname == 'bing.com' ||
                        hostname == 'gifscroll.com' ||
                        hostname == 'gothdporn.com' ||
                        hostname == 'javtiful.com' ||
                        hostname == 'madnsfw.com' ||
                        hostname == 'mulemax.com' ||
                        hostname == 'pornloupe.com' || // embed is SAMEORIGIN
                        hostname == 'pornzog.com' ||
                        hostname == 'watchmygf.me' ||
                        hostname == 'xfantasy.com' ||
                        hostname == 'xfantazy.com' ||
                        hostname == 'xfantasy.tv')
                        throw "no embed";
                    shortid = url2shortid(pic.url, 2, '-');
                    var href = $('<a>').attr('href', pic.url);
                    if (href.prop('hostname').startsWith('m.'))
                        href.prop('hostname', href.prop('hostname').replace('m.', 'www.'));

                    if (hostname == 'nonktube.com' ||
                        hostname == 'theporngod.com' ||
                        hostname == 'xhamster.com' ||
                        hostname == 'youporn.com')
                        initPhotoEmbed(pic, href.prop('origin')+'/embed/'+shortid, false);

                    else if (shortid.match(/^\d+$/)) {
                        initPhotoEmbed(pic, href.prop('origin')+'/embed/'+shortid+'?autoplay=1');
                        log.info("AUTOGENERATE embed ["+pic.o_url+"]: "+pic.url);

                    } else {
                        shortid = url2shortid(pic.url, 2);
                        initPhotoEmbed(pic, href.prop('origin')+'/embed/'+shortid+'?autoplay=1');
                        log.info("AUTOGENERATE embed ["+pic.o_url+"]: "+pic.url);
                    }
                    return true;

                } else if (rp.wpv2[hostname] === undefined) {
                    // TRY WPv2
                    shortid = url2shortid(pic.url);
                    if (shortid.match(/^[a-z0-9]+(?:-[a-z0-9]+)+$/) && !extensionOf(pic.url)) {
                        log.info("ATTEMPT wpv2: "+pic.url);
                        pic.type = imageTypes.later;
                        return true;
                    }
                }
                throw "unknown url";
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

        button.addClass(imageTypeStyle[pic.type]);
    };

    // Re-entrant okay
    var addImageSlide = function (photo) {
        // Check if this photo is already in rp.photos
        if (photo.index !== undefined)
            return true;

        if (!processPhoto(photo))
            return false;

        var index = rp.photos.push(photo)-1;
        photo.index = index;
        if (photo.album && photo.album.length) {
            for(var i = 0; i < photo.album.length; ++i) {
                photo.album[i].parentIndex = index;
                delete photo.album[i].parent;
            }
        }

        var title = picTitleText(rp.photos[index]);
        if (rp.photos[index].subreddit && rp.photos[index].subreddit != rp.url.sub)
            title += "\nr/"+rp.photos[index].subreddit;

        var numberButton = $("<a />", { title: title,
                                        id: "numberButton" + (index + 1),
                                        "class": "numberButton",
                                        click: function () {startAnimation($(this).data("index"));},
                                      })
            .data("index", index)
            .html(index + 1)

        addButtonClass(numberButton, photo);

        addNumberButton(numberButton);

        // show the first valid image
        if (rp.session.activeIndex < 0)
            startAnimation(getNextSlideIndex(-1));

        // Preload images if we've missed it initially
        else if (index < rp.session.activeIndex+2)
            preloadNextImage(rp.session.activeIndex);

        return true;
    };

    var setFavicon = function(elem, url, special) {
        var fixFavicon = function(e) {
            if (e.type == "error" ||
                this.naturalHeight <= 1 ||
                this.naturalWidth <= 1) {
                var b;
                if (e.data.backup.length > 0) {
                    var origin = e.data.backup.shift();
                    b = $("<img />", { 'class': 'favicon', src: origin })
                        .on('error', e.data, fixFavicon)
                        .on('load',  e.data, fixFavicon);
                } else {
                    rp.faviconcache[e.data.hn] = "";
                    setConfig(configNames.favicon, rp.faviconcache);
                    b = googleIcon("link");
                }

                e.data.elem.html(b);
            } else {
                rp.faviconcache[e.data.hn] = $(this).attr('src');
                setConfig(configNames.favicon, rp.faviconcache);
            }
        };

        if (url === undefined)
            throw "setFavicon() called with empty url";

        var fav = special;

        // #1 "reddit" is special
        if (fav === "reddit") {
            elem.html($("<img />", {'class': 'reddit', src: rp.url.root+'images/reddit.svg'}));
            return;
        }
        fav = rp.favicons[special];

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

    var setSubredditLink = function(url, type) {
        var link = $('#subredditLink');
        link.prop('href', url).show();
        setFavicon(link, url, type);
    };

    // Register keyboard events on the whole document
    $(document).keyup(function (e) {
        if (e.ctrlKey || e.altKey || e.metaKey) {
            // ctrl key is pressed so we're most likely switching tabs or doing something
            // unrelated to redditp UI
            return;
        }

        //log.info(e.keyCode, e.which, e.charCode);

        var i = 0;
        var key = e.key;

        switch (key.toLowerCase()) {
        case "a":
            open_in_background("#navboxAlbumOrigLink");
            break;
        case "c":
            $('#controlsCollapser').click();
            break;
        case "t":
            $('#titleCollapser').click();
            break;
        case "d":
            open_in_background("#navboxDuplicatesLink");
            break;
        case "e":
            $('#navboxExtraLoad').click();
            break;
        case "f":
            $('#fullscreen').click();
            break;
        case "g":
            open_in_background('#navboxImageSearch');
            break;
        case "i":
            open_in_background("#navboxLink");
            break;
        case "l":
            open_in_background("#navboxOrigLink");
            break;
        case "m":
            $('#mute').click();
            break;
        case "n":
            $('#nsfw').click();
            break;
            // O_KEY is with ZERO_KEY below
        case "r":
            open_in_background("#navboxDuplicatesMulti");
            break;
        case "u":
            $("#duplicatesCollapser").click();
            break;
        case " ": // SPACE
            $("#autoNextSlide").click();
            break;
        case "?":
            $('#help').toggle();
            break;
        case "+":
            volume_adjust(+1);
            break;
        case "-":
            volume_adjust(-1);
            break;
        case "enter":
            $('#playbutton a').click();
            break;
        case "pageup":
        case "arrowup":
            prevSlide();
            break;
        case "arrowleft":
            prevAlbumSlide();
            break;
        case "pagedown":
        case "arrowdown":
            nextSlide();
            break;
        case "arrowright":
            nextAlbumSlide();
            break;
        case "9":
            ++i;
            // fall through
        case "8":
            ++i;
            // fall through
        case "7":
            ++i;
            // fall through
        case "6":
            ++i;
            // fall through
        case "5":
            ++i;
            // fall through
        case "4":
            ++i;
            // fall through
        case "3":
            ++i;
            // fall through
        case "2":
            ++i;
            // fall through
        case "1":
            if ($('#duplicateUl li .infor')[i])
                open_in_background_url($('#duplicateUl li .infor')[i]);
            break;
        case "o": // open comment - fall through
        case "0":
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
        if (rp.session.activeAlbumIndex >= 0)
            getRedditDupe(photo.album[rp.session.activeAlbumIndex]);

        if (photo.dupes)
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
        }

        var oldCache = rp.cache;
        rp.cache = {};

        // Save current
        if (oldCache[rp.session.activeIndex])
            rp.cache[rp.session.activeIndex] = oldCache[rp.session.activeIndex];

        // Save or Create next
        if (oldCache[next])
            rp.cache[next] = oldCache[next];
        else {
            rp.cache[next] = {};
            rp.cache[next][0] = createDiv(next);
        }

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

        // Create or save previous
        if (prev >= 0) {
            if (oldCache[prev])
                rp.cache[prev] = oldCache[prev];
            else {
                rp.cache[prev] = {};
                rp.cache[prev][0] = createDiv(prev);
            }
        }
        // Preload previous image
        if (rp.photos[prev].type == imageTypes.album) {
            var ind = rp.photos[prev].album.length-1;
            if (rp.cache[prev][ind] === undefined)
                rp.cache[prev][ind] = createDiv(prev, ind);
        }

        // save prev-1, but don't create it
        next = getPrevSlideIndex(prev);
        if (oldCache[next])
            rp.cache[next] = oldCache[next];

        oldCache = undefined;

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

    var updateDuplicates = function(pic) {
        var photo = photoParent(pic);
        if (!isActive(photo))
            return;
        $('#duplicateUl').html("");
        var total = 0;

        // Gfycat "duplicates" aka Tags
        if (pic.gfycat) {
            if (pic.gfycat.tags && pic.gfycat.tags.length > 0)
                pic.gfycat.tags.forEach(function(tag) {
                    var li = $("<li>", { class: 'list'});
                    li.html(gfycatTagLink(tag, pic.gfycat.type));
                    ++ total;
                    $('#duplicateUl').append(li);
                });
        } else if (photo.gfycat && photo.gfycat.tags && photo.gfycat.tags.length > 0) {
            log.info("Duplicates gfycat from parent");
            photo.gfycat.tags.forEach(function(tag) {
                var li = $("<li>", { class: 'list'});
                li.html(gfycatTagLink(tag, photo.gfycat.type));
                ++ total;
                $('#duplicateUl').append(li);
            });
        }

        // Imgur "duplicates" aka Tags
        if (pic.imgur) {
            if (pic.imgur.tags && pic.imgur.tags.length > 0)
                pic.imgur.tags.forEach(function(tag) {
                    var li = $("<li>", { class: 'list'});
                    li.html(imgurTagLink(tag));
                    ++ total;
                    $('#duplicateUl').append(li);
                });
        } else if (photo.imgur && photo.imgur.tags && photo.imgur.tags.length > 0) {
            log.info("Duplicates imgur from parent");
            photo.imgur.tags.forEach(function(tag) {
                var li = $("<li>", { class: 'list'});
                li.html(imgurTagLink(tag));
                ++ total;
                $('#duplicateUl').append(li);
            });
        }

        if (pic.iloopit && pic.iloopit.tags && rp.sitecache.iloopit) {
            pic.iloopit.tags.forEach(function(id) {
                var tag = rp.sitecache.iloopit[id] || id;
                var li = $("<li>", { class: 'list'});
                li.html(iloopitTagLink(tag));
                ++ total;
                $('#duplicateUl').append(li);
            });
        }

        // Reddit Duplicates
        if (photo.dupes && photo.dupes.length > 0) {
            var multi = [];
            if (photo.subreddit)
                multi.push(photo.subreddit);
            photo.dupes.forEach(function(item) {
                var li = $("<li>", { class: 'list'});

                if (item.subreddit) {
                    try {
                        var nli = $('#duplicateUl').find('[subreddit='+item.subreddit+']');
                    } catch(e) {
                        log.error("Failed to find duplicateLi subreddit = "+item.subreddit);
                        return;
                    }
                    if (nli.length) {
                        li = $(nli);
                    } else {
                        var subr = '/r/' +item.subreddit;
                        li.attr('subreddit', item.subreddit);

                        ++ total;
                        multi.push(item.subreddit);

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
            if (multi) {
                $('#navboxDuplicatesMulti').attr('href', rp.redditBaseUrl+'/r/'+multi.join('+'));
                $('#navboxDuplicatesMultiP').attr('href', rp.url.base+'/r/'+multi.join('+'));
                $('#duplicatesLink').show();
            } else {
                $('#navboxDuplicatesMulti').attr('href', "#");
                $('#navboxDuplicatesMultiP').attr('href', "#");
                $('#duplicatesLink').hide();
            }
        } else {
            if (photo.subreddit) {
                $('#navboxDuplicatesMulti').attr('href', rp.redditBaseUrl+'/r/'+photo.subreddit);
                $('#navboxDuplicatesMultiP').attr('href', rp.url.base+'/r/'+photo.subreddit);
            } else {
                $('#navboxDuplicatesMulti').attr('href', "#");
                $('#navboxDuplicatesMultiP').attr('href', "#");
            }
            $('#duplicatesLink').hide();
        }
        $('#duplicatesCollapser').data('count', total);
        setVcollapseHtml($('#duplicatesCollapser'));
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
        $('#navboxOrigLink').attr('href', url).parent().show();
        setFavicon($('#navboxOrigLink'), url);

        // Setup navboxLink and navboxImageSearch
        updateNavboxTypes(image);

        if (albumIndex >= 0) {
            $('#navboxAlbumOrigLink').attr('href', photo.o_url).attr('title', photo.title+" (a)").parent().show();
            setFavicon($('#navboxAlbumOrigLink'), photo.o_url);
            if (url == photo.o_url)
                $('#navboxOrigLink').parent().hide();
        } else
            $('#navboxAlbumOrigLink').attr('href', "#").parent().hide();
        $('#navboxOrigDomain').attr('href', '/domain/'+hostnameOf(image.o_url));

        if (rp.session.loginExpire && now > rp.session.loginExpire-30)
            expiredRedditLogin();

        // TITLE BOX
        $('#navboxTitle').html(picTitle(image));
        var flair = picFlair(image);
        if (flair)
            $('#navboxTitle').prepend($('<span>', { class: 'linkflair' }).text(flair));
        if (photo.score !== undefined) {
            $('#navboxScore span').attr('title', 'Score: '+photo.score).text(humanReadInt(photo.score)).parent().show();
        } else
            $('#navboxScore').hide();

        $('#navboxExtra').html(picExtra(image));

        if (photo.subreddit) {
            $('#navboxSubreddit').html(redditLink(subreddit)).show();

            if (image.gfycat && image.gfycat.user)
                $('#navboxExtra').append(gfycatApiUserLink(image.gfycat.user, image.gfycat.type));
            else if (image.imgur && image.imgur.user)
                $('#navboxExtra').append(imgurUserLink(image.imgur.user));
            else if (image.tumblr)
                $('#navboxExtra').append(tumblrLink(image.tumblr.blog));
            else if (image.flickr && authName)
                $('#navboxExtra').append(flickrUserLink(image.flickr.nsid));
            else if (image.iloopit && authName)
                $('#navboxExtra').append(iloopitUserLink(image.iloopit.user));

        } else if (image.gfycat && image.gfycat.user)
            $('#navboxSubreddit').html(gfycatApiUserLink(image.gfycat.user, image.gfycat.type)).show();

        else if (photo.gfycat && photo.gfycat.user) {
            log.warn("["+imageIndex+"]["+albumIndex+"] GFYCAT on photo, not image");
            $('#navboxSubreddit').html(gfycatApiUserLink(photo.gfycat.user, photo.gfycat.type)).show();

        } else if (image.tumblr)
            $('#navboxSubreddit').html(tumblrLink(image.tumblr.blog)).show();

        else if (photo.tumblr) {
            log.warn("["+imageIndex+"]["+albumIndex+"] Tumblr on photo, not image");
            $('#navboxSubreddit').html(tumblrLink(photo.tumblr.blog)).show();

        } else if (image.imgur && image.imgur.user)
            $('#navboxSubreddit').html(imgurUserLink(photo.imgur.user)).show();

        else if (photo.imgur && photo.imgur.user) {
            log.warn("["+imageIndex+"]["+albumIndex+"] Tumblr on photo, not image");
            $('#navboxSubreddit').html(imgurUserLink(photo.imgur.user)).show();

        } else
            $('#navboxSubreddit').hide();

        if (albumIndex >= 0)
            $('#navboxExtra').append($('<span>', { class: 'info infol' }).text((albumIndex+1)+"/"+rp.photos[imageIndex].album.length));

        if (authName)
            $('#navboxAuthor').html(redditLink('/user/'+authName+'/submitted',  authName, '/u/'+authName)).show();
        else if (image.flickr)
            $('#navboxAuthor').html(flickrUserLink(image.flickr.nsid)).show();
        else if (image.iloopit)
            $('#navboxAuthor').html(iloopitUserLink(image.iloopit.user)).show();
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

        if (photo.subreddit) {
            $('#navboxDuplicatesLink').attr('href',  rp.redditBaseUrl + '/r/' +
                                            photo.subreddit + '/duplicates/' + photo.id).show();
        } else {
            $('#navboxDuplicatesLink').attr('href', '#').hide();
        }

        updateDuplicates(image);

        if (oldIndex != imageIndex) {
            toggleNumberButton(oldIndex, false);
            toggleAlbumButton(oldAlbumIndex, false);
            toggleNumberButton(imageIndex, true);
        }
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
            expiredRedditLogin();
        log.info("ActiveIndex:["+rp.session.activeIndex+"]["+rp.session.activeAlbumIndex+"]");
        log.info("xhr:", xhr);
        log.info("ajaxOptions:", ajaxOptions);
        log.error("error:", thrownError);
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

        // Called with showVideo(pic)
        var showVideo = function(pic) {
            var video = $('<video id="gfyvid" class="fullscreen" preload="metadata" playsinline />');
            var lastsource;

            video.prop('playsinline', '');
            if (pic.thumb)
                video.attr('poster', pic.thumb);
            if (isVideoMuted()) {
                video.prop('muted', true);
                if (rp.session.volumeIsMute)
                    video.prop('volume', 0);
            }

            rp.settings.goodVideoExtensions.forEach(function(type) {
                if (!pic.video[type])
                    return;

                pic.video[type].forEach(function(url) {
                    if (!url) return;
                    lastsource = $('<source />', { type: rp.ext2mime[type], src: url});
                    video.append(lastsource);
                });
            });
            divNode.html(video);

            if (pic.video.audio) {
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
                for (type in pic.video.audio) {
                    ls = $('<source />', { src: pic.video.audio[type],
                                           type: rp.ext2mime[type] });
                    audio.append(ls);
                }
                $(ls).on('error', function() {
                    delete pic.video.audio;
                    $(audio).remove();
                    log.info("Failed to load src for audio: "+pic.url);
                });
                $(audio).on('error', function() {
                    log.info("Failed to load audio: "+pic.url);
                });
                video.on('playing', function() { audio[0].currentTime = video[0].currentTime; audio[0].play() });
                video.on('pause', function() { audio[0].pause() });
                divNode.append(audio);
            }

            $(lastsource).on('error', function() {
                log.info("["+imageIndex+"] video failed to load last source: "+pic.url);
                if (find_fallback(pic))
                    return;

                initPhotoFailed(pic);
                resetNextSlideTimer();
            });

            $(video).on('error', function() {
                log.info("["+imageIndex+"] video failed to load: "+pic.url);
                initPhotoFailed(pic);
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
                    log.info("cannot display video [copyright claim]: "+pic.url);
                    initPhotoFailed(pic);
                    resetNextSlideTimer();
                    showThumb(pic);
               }
                pic.video.duration = e.target.duration;
                if (pic.video.duration < rp.settings.timeToNextSlide) {
                    pic.video.times = Math.ceil(rp.settings.timeToNextSlide/photo.video.duration);
                } else {
                    pic.video.times = 1;
                }
                log.debug("["+imageIndex+"] Video loadeddata video: "+pic.video.duration+" playing "+pic.video.times);
            });

            // Progress Bar
            divNode.bind("rpdisplay", rpdisplayVideo);
            if (divNode.parent()[0] == $('#pictureSlider')[0])
                divNode.trigger("rpdisplay");

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
                else if ($(video)[0].paused)
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
            $(iframe).on("error", function() {
                log.info("["+imageIndex+"] FAILED TO LOAD: "+pic.url);
                throw("Failed to load iframe"+pic.url);
            });
            $(iframe).attr('src', pic.url);
            return iframe;
        };

        var showEmbed = function(div, pic) {
            if (rp.settings.embed == rp.ALWAYS || (rp.settings.embed == rp.SOMETIMES && !pic.embed.aplay)) {
                div.append(iFrame(pic));
                return;
            }
            showThumb(pic);
            // Add play button
            var lem = playButton(function() {
                replaceBackgroundDiv($('<div>', { class: "fullscreen" }).html(iFrame(pic)));
            });

            var title = $('<span>', { class: "title" }).html(hostnameOf(pic.url, true));
            div.prepend($(lem).append(title));
        }

        var showHtml = function(div, html, needreset) {
            if (needreset === undefined)
                needreset = true;
            // can't be <div> because of replaceBackgroundDiv()
            var iframe = $('<blockquote/>', { id: "gfyhtml",
                                              class: "fullscreen",
                                              frameborder: 0,
                                              webkitallowfullscreen: true,
                                              allowfullscreen: true });
            iframe.html(html);
            div.html(iframe);

            if (needreset && imageIndex == rp.session.activeIndex)
                resetNextSlideTimer();
        }

        var rpdisplayHtml = function() {
            var div = $(this);
            div.empty();
            var pic = getCurrentPic();
            showHtml(div, pic.html);
            return true;
        };
        var rpdisplayEmbed = function() {
            var div = $(this);
            div.empty();
            showEmbed(div, getCurrentPic());
            return true;
        };
        var rpdisplayVideo = function() {
            var div = $(this);
            var video = $(this).children('#gfyvid');

            if (video.length == 0)
                return;

            var percent = (video[0].buffered.length) ?Math.ceil(video[0].buffered.end(0) / video[0].duration * 100) :0;

            var progressBar = $('<div />', { class: "progressbar" })
                .html($('<div />',
                        { class: "progress",
                          style: "width: "+percent+"%"
                        }));
            div.append(progressBar);

            if (percent < 100) {
                var updateProgress = function(e) {
                    var vid = e.target;
                    if (!vid.buffered.length)
                        return;
                    var progressBar = e.data.find('div.progress');
                    progressBar.css('width', (vid.buffered.end(0) / vid.duration * 100)+"%");
                };

                $(video).on("progress loadedmetadata loadeddata timeupdate", progressBar, updateProgress);
            }

            // Play-through circle
            var circ = $('<div />', { id: "circle" });
            progressBar.append(circ);

            $(video).on("timeupdate", function(e) {
                var vid = e.target;
                circ.css('left', (100 * vid.currentTime/vid.duration)+"%");
            });
            return true;
        };

        var showPic = function(pic) {
            if (pic.type == imageTypes.album) {
                var index = 0;
                // find correct index based on divNode. albumIndex may be incorrect due to previous item expansion
                while (index < pic.album.length && rp.cache[imageIndex][index] != divNode)
                    ++index;
                if (index >= pic.album.length) {
                    log.error("Failed to fill divNode [divNode no longer in cache]: "+pic.url);
                    showThumb(pic);
                    return;
                }
                pic = pic.album[index];
            }

            if (pic.type == imageTypes.video)
                showVideo(pic);

            else if (pic.type == imageTypes.html) {
                // triggered in replaceBackgroundDiv
                divNode.bind("rpdisplay", rpdisplayHtml);
                if (divNode.parent()[0] == $('#pictureSlider')[0])
                    divNode.trigger("rpdisplay");

            } else if (pic.type == imageTypes.embed) {
                // triggered in replaceBackgroundDiv
                divNode.bind("rpdisplay", rpdisplayEmbed);
                if (divNode.parent()[0] == $('#pictureSlider')[0])
                    divNode.trigger("rpdisplay");

            } else if (pic.type == imageTypes.fail)
                showThumb(pic);

            else if (pic.type == imageTypes.later) {
                throw("called showPic() on later type: "+pic.url);

            } else // Default to image type
                showImage(pic.url);

            return divNode;
        };

        if (photo.type == imageTypes.image ||
            photo.type == imageTypes.thumb) {
            showImage(photo.url, false);
            return divNode;

        } else if (photo.type == imageTypes.fail) {
            showThumb(photo, false);
            return divNode;

        } else if (photo.type == imageTypes.html) {
            showHtml(divNode, photo.html, false);
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
    };

    var gfyItemTitle = function(item) {
        return fixupTitle(item.title || item.description);
    };

    var gfyItemUrl = function(item, type) {
        var shortid = item.gfyName || item.gifName || item.id;
        return gfycatPhotoUrl(shortid, type);
    };

    var gfycatPhotoUrl = function(shortid, type) {
        if (type == 'gfycat') {
            return 'https://gfycat.com/'+shortid;
        } else if (type == 'redgifs') {
            return 'https://www.redgifs.com/watch/'+shortid;
        }
        throw "Unknown Gfycat type: "+type;
    };

    var gfycatUserUrl = function(user, type) {
        if (type == 'gfycat') {
            return 'https://gfycat.com/@'+user;
        } else if (type == 'redgifs') {
            return 'https://www.redgifs.com/users/'+user;
        }
        throw "Unknown Gfycat type: "+type;
    };

    var gfycatApiUserLink = function(user, type) {
        return localLink(gfycatUserUrl(user, type), user, '/'+type+'/u/'+user);
    };

    var gfycatTagUrl = function(tag, type) {
        if (type == 'gfycat') {
            return 'https://gfycat.com/gifs/search/'+tag.toLowerCase().replaceAll(" ", "+");
        } else if (type == 'redgifs') {
            return 'https://www.redgifs.com/categories/'+tag.toLowerCase().replaceAll(" ", "-");
        }
        throw "Unknown Gfycat type: "+type;
    };

    var gfycatTagLink = function(tag, type) {
        return localLink(gfycatTagUrl(tag, type), tag, '/'+type+'/t/'+tag);
    };

    var handleGfycatApiItem = function(photo, data, showCB, type) {
        if (data.gfyItem === undefined) {
            if (data.error !== undefined) {
                log.info("failed to display gfycat [error]: "+data.error);
            }
            initPhotoFailed(photo);
            showCB(photo);
            return;
        }

        photo.gfycat = { type: type };

        var user = gfyItemUser(data.gfyItem);
        if (user)
            photo.gfycat.user = user;
        if (data.gfyItem.gfyName)
            photo.url = gfyItemUrl(data.gfyItem, type);
        if (!photo.title)
            photo.title = gfyItemTitle(data.gfyItem);
        if (data.gfyItem.tags.length > 0)
            photo.gfycat.tags = data.gfyItem.tags;

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

            if (data.safety)
                photo.over18 = (data.safety == "adult");

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

        var a;
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
                    data.photoset.photo.forEach( function(item) {
                        var pic = { url: flickrPhotoUrl(item),
                                    flickr: { nsid: userid },
                                    o_url: ['https://flickr.com/photos', userid, item.id].join('/'),
                                    thumb: flickrThumbnail(item) };
                        if (processPhoto(pic))
                            addAlbumItem(photo, pic);
                    });
                    checkPhotoAlbum(photo);
                    showCB(photo);
                };

            } else {
                photo.flickr = { nsid: userid };

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
                jsonUrl = "https://api.redgifs.com/v1/gifs/" + shortid.toLowerCase();
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
            jsonUrl = "https://api.redgifs.com/v1/gifs/" + shortid.toLowerCase();

            handleData = function (data) {
                handleGfycatApiItem(photo, data, showCB, 'redgifs')
            };

        } else if (hostname == 'iloopit.net') {
            shortid = searchValueOf(photo.url, "loopid");
            jsonUrl = "https://api.iloopit.net/videos/single/"+shortid;

            handleData = function (item) {
                photo.iloopit = { user: item.username, loop: item.old_id };
                initPhotoiLoopit(photo, item.data_id);
                photo = handleiLoopitAlbum(photo, item);
                showCB(photo);
            };

        } else if (hostname == 'imgur.com') {
            headerData = { Authorization: "Client-ID "+ rp.api_key.imgur };
            a = pathnameOf(photo.url).split('/');

            if (a[1] == 'a') {
                jsonUrl = "https://api.imgur.com/3/album/" + a[2];
                handleData = function(data) {
                    handleImgurItemMeta(photo, data.data);

                    photo = handleImgurItemAlbum(photo, data.data);
                    showCB(photo);
                }

            } else if (a[1] == 'gallery') {
                jsonUrl = "https://api.imgur.com/3/gallery/" + a[2];

                handleError = function () {
                    jsonUrl = "https://api.imgur.com/3/album/" + a[2];
                    var hdata = function (data) {
                        handleImgurItemMeta(photo, data.data);

                        photo = handleImgurItemAlbum(photo, data.data);
                        showCB(photo);

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
                    if (Array.isArray(data.data)) {
                        photo = handleImgurItemAlbum(photo, {
                            images: data.data,
                            link: "https://imgur.com/gallery/"+shortid,
                        });

                    } else {
                        handleImgurItemMeta(photo, data.data);

                        photo = handleImgurItemAlbum(photo, data.data);
                    }
                    showCB(photo);
                };

            } else {
                jsonUrl = "https://api.imgur.com/3/image/" + shortid;

                handleData = function (data) {
                    handleImgurItemMeta(photo, data.data);

                    processImgurItemType(photo, data.data);

                    showCB(photo);
                };
            }

        } else if (hostname == 'reddit.com') {
            a = pathnameOf(photo.url).split('/');

            jsonUrl = rp.url.get + '/comments/' + shortid + '.json';

            handleData = function(data) {
                if (data[0].data.children.length != 1) {
                    log.error("Comment Listing had multiple primary children: "+photo.url);
                }
                if (processRedditT3(photo, data[0].data.children[0]) !== true)
                    initPhotoThumb(photo)
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

        } else if (hostname == 'tumblr.com') {
            shortid = url2shortid(photo.url, 2);

            jsonUrl = tumblrJsonURL(fqdn, shortid);
            dataType = 'jsonp';

            handleData = function(data) {
                processTumblrPost(photo, data.response.posts[0]);
                showCB(photoParent(photo));
            };

        } else if (hostname == 'twitter.com') {
            jsonUrl = 'https://publish.twitter.com/oembed?dnt=true&align=center&url='+photo.url;
            photo.type = imageTypes.html;
            dataType = 'jsonp';

            handleData = function(data) {
                initPhotoHtml(photo, data.html);
                showCB(photo);
            };

        } else if (hostname == 'wikimedia.org') {
            // categories: https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&format=json&cmtitle=SHORTID
            a = photo.url.split('/');
            jsonUrl = 'https://api.wikimedia.org/core/v1/commons/file/'+a[a.length-1];
            headerData = { "Api-User-Agent": 'redditp ('+window.location.hostname+')' };

            handleData = function(data) {
                if (isImageExtension(data.file_description_url)) {
                    initPhotoImage(photo, data.original.url);
                    addPhotoThumb(photo, data.thumbnail.url);
                } else if (isVideoExtension(data.file_description_url)) {
                    initPhotoVideo(photo, [data.original.url, data.preferred.url], data.thumbnail.url);
                } else {
                    log.error("Non-Photo Extension: "+data.file_description_url);
                    initPhotoThumb(photo);
                }
                showCB(photo);
            };

        } else if (hostname == 'wordpress.com') {
            photo.url = photo.url.replace(/\/amp\/?$/, '');
            shortid = url2shortid(photo.url);

            jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+fqdn+'/posts/slug:'+shortid;

            handleData = function(data) {
                processWordPressPost(photo, data);
                showCB(photoParent(photo));
            };

        } else if (rp.wpv2[hostname] !== false) {
            shortid = url2shortid(photo.url);
            var o = originOf(photo.url);
            jsonUrl = o+'/wp-json/wp/v2/posts/?slug='+shortid+'&_jsonp=?';

            handleData = function(data) {
                if (rp.wpv2[hostname] !== true) {
                    rp.wpv2[hostname] = true;
                    setConfig(configNames.wpv2, rp.wpv2);
                }
                getPostWPv2(
                    photo,
                    data[0],
                    function(photo) {
                        log.info("Failed to load wpv2: "+photo.url);
                        initPhotoThumb(photo);
                        showCB(photo);
                    },
                    function(photo) {
                        showCB(photoParent(photo));
                    }
                );
            };
            handleError = function() {
                log.info("cannot display url [not wpv2]: "+photo.url);
                rp.wpv2[hostname] = false;
                setConfig(configNames.wpv2, rp.wpv2);
                initPhotoThumb(photo);
                showCB(photo);
            };

        } else if (rp.wpv2[hostname] === false) {
            initPhotoThumb(photo);
            showCB(photo);

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

    var imgurUserLink = function(user) {
        return localLink('https://'+user+'.imgur.com', user, '/imgur/u/'+user);
    };

    var imgurTagLink = function(tag) {
        return localLink('https://imgur.com/t/'+tag, tag, '/imgur/t/'+tag);
    };

    var iloopitTagLink = function(tag) {
        return localLink('https://iloopit.net/porngifs/'+tag+'/trending/',
                         tag, '/iloopit/t/'+tag);
    };

    var processImgurItemType = function(photo, item) {
        if (item.animated) {
            var arr = []
            if (item.mp4)
                arr.push(fixImgurPicUrl(item.mp4));
            if (item.webm)
                arr.push(fixImgurPicUrl(item.webm));
            initPhotoVideo(photo, arr);
        } else
            initPhotoImage(photo, fixImgurPicUrl(item.link));
    }

    var handleImgurItemAlbum = function(photo, item) {
        if (!item.is_album) {
            processImgurItemType(photo, item);
            return photo;
        }
        photo = initPhotoAlbum(photo, false);
        item.images.forEach(function(img) {
            if (img.is_ad) {
                log.info("not displaying image [is ad]: "+img.link);
                return;
            }
            var pic = {
                title: fixupTitle(img.title || img.description),
                url: img.link,
                o_url: item.link,
            };
            handleImgurItemMeta(pic, img);

            processImgurItemType(pic, img);

            addAlbumItem(photo, pic);
        });
        checkPhotoAlbum(photo);
        return photo;
    };

    var handleImgurItemMeta = function(photo, item) {
        if (!photo.imgur)
            photo.imgur = {};
        if (item.account_url)
            photo.imgur.user = item.account_url;
        if (item.section && !photo.subreddit)
            photo.subreddit = item.section;
        if (item.datetime && !photo.date)
            photo.date = item.datetime;
        if (item.nsfw && !photo.over18)
            photo.over18 = item.nsfw;
        if (item.tags && item.tags.length > 0) {
            var i;
            if (!photo.imgur.tags)
                photo.imgur.tags = [];
            for (i in item.tags) {
                photo.imgur.tags.push(item.tags[i].name);
            }
        }
    };

    var fixImgurPicUrl = function(url) {
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
        }
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
            hostname == 'hentai-foundry.com' ||
            hostname == 'imgur.com' ||
            hostname == 'juicygif.com' ||
            hostname == 'pornhub.com' ||
            hostname == 'sendvid.com' ||
            hostname == 'xhamster.com' ||
            hostname == 'xvideos.com' ||
            hostname == 'youporn.com')
            url = url.replace(/^http:/, "https:");

        if (hostname == 'dropbox.com')
            url = originOf(url)+pathnameOf(url)+'?dl=1';

        if ((hostname == 'wordpress.com' ||
             hostname == 'wp.com') &&
            isImageExtension(url))
            url = originOf(url)+pathnameOf(url);

        if (hostname == 'hotnessrater.com') {
            var a = pathnameOf(url).split('/');
            url = ["https://img1.hotnessrater.com", a[2], a[3]].join("/")+".jpg";
        }

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

    var redditMultiAppend = function(data, list, multi) {
        data.forEach(function(item) {
            var path;
            var cl = "multi";
            var selected = false;
            if (item.data.visibility == "public")
                path = item.data.path;
            else if (item.data.visibility == "private") {
                path = "/me/m/"+item.data.name;
                cl += " needlogin";
            } else // hidden == ignore
                return;
            if (item.data.over_18)
                cl += " show-nsfw";
            if (item.data.name == multi)
                selected = true;

            var link = redditLink(path, item.data.description_md, item.data.display_name, selected);

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

    var redditExpiresToTime = function(expires_in) {
        var time = parseInt(expires_in, 10);
        return time+Math.ceil(Date.now()/1000);
    };

    var expiredRedditLogin = function() {
        if (rp.session.redditRefreshToken)
            redditCodeFlow({ refresh_token: rp.session.redditRefreshToken });
        else
            clearRedditLogin();
    };

    // data is either:
    // { code: CODE } or { refresh_token: REFRESH_TOKEN }
    var redditCodeFlow = function(data, url) {
        if ('code' in data) {
            data.grant_type = 'authorization_code';
            data.redirect_uri = rp.redirect;
        } else if ('refresh_token' in data) {
            data.grant_type = 'refresh_token';
        } else
            throw "Unknown Code Flow: "+data;

        var jsonUrl = 'https://www.reddit.com/api/v1/access_token';
        var handleData = function(data) {
            var by = redditExpiresToTime(data.expires_in);
            setupRedditLogin(data.access_token, by);
            // @@ verify scope
            rp.session.redditRefreshToken = data.refresh_token;
            setConfig(configNames.redditRefresh, data.refresh_token);
            if (url)
                processUrls(url);
            loadRedditMultiList();
        };
        var handleError = function(xhr, _ajaxOptiosn, thrownError) {
            log.error("Failed to get auth token: "+thrownError);
            clearRedditLogin();
            processUrls(url);
        };

        $.ajax({
            url: jsonUrl,
            method: 'POST',
            data: data,
            dataType: 'json',
            headers: {
                "Authorization": "Basic " + btoa(rp.api_key.reddit + ":")
            },
            username: rp.api_key.reddit,
            password: '',
            success: handleData,
            error: handleError,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var setupRedditLogin = function (bearer, by) {
        if (hostnameOf(rp.redirect) != window.location.hostname)
            return;
        if (bearer === undefined) {
            bearer = getConfig(configNames.redditBearer, '');
            by = getConfig(configNames.redditRefreshBy, 0);
        }
        if (rp.session.loginExpire &&
            rp.session.loginExpire > (Date.now()/1000)-60)
            return;
        $('#loginUsername').attr('href', rp.redditLoginUrl + rp.url.auth + '?' +
                                 ['client_id=' + rp.api_key.reddit,
                                  'response_type=code',
                                  'state='+encodeURIComponent(rp.url.path),
                                  'redirect_uri='+encodeURIComponent(rp.redirect),
                                  'duration=permanent',
                                  // read - /r/ALL, /me/m/ALL
                                  // history - /user/USER/submitted
                                  'scope=read,history'].join('&'));
        if (by-60 > Date.now()/1000) {
            var d = new Date(by*1000);
            log.info("Reddit Token Expire: "+d);
            rp.session.loginExpire = by;
            rp.session.redditHdr = { Authorization: 'bearer '+bearer };
            $('.needlogin').show();
            $('#loginUsername').html(googleIcon('verified_user'));
            $('#loginUsername').attr('title', 'Expires at '+d);
            $('label[for=login]').html(googleIcon('verified_user'));
            rp.url.api = 'https://oauth.reddit.com';
            setConfig(configNames.redditBearer, bearer);
            setConfig(configNames.redditRefreshBy, by);
            loadRedditMultiList();

        } else
            clearRedditLogin();
    };
    rp.fn.setupRedditLogin = setupRedditLogin;

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
        var multi;
        var is_submitted = false;
        rp.url.choice = "";
        rp.url.sub = (s[1] == 'r' && s[2]) ?s[2] :"";

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
            if (s.length == 3 || s[3] == 'submitted') {
                base = s.slice(0,3).join('/')+'/submitted';
                arr = [ "hot", "new", "top", "controversial" ];
                mod = (s.length > 4) ?arr.indexOf(s[4]) :0;
                is_submitted = true;

            } else if (s[3] == 'm') {
                base = s.slice(0,5).join('/');
                arr = [ "hot", "new", "top", "rising", "controversial", 'gilded' ];
                mod = (s.length > 5) ?arr.indexOf(s[5]) :0;
                multi = s[4];

            } else {
                log.error("Unknown URL format for Choice: "+rp.url.subreddit);
                return;
            }

        } else if (s[1] == 'me') {
            base = s.slice(0,4).join('/');
            arr = [ "hot", "new", "top", "rising", "controversial", 'gilded' ];
            mod = (s.length > 4) ?arr.indexOf(s[4]) :0;
            multi = s[3];

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
            list.append($('<li>').append($('<hr>', { class: "split" })));
            list.append($('<li>').append(redditLink('/user/'+user+'/submitted', "submitted", "submitted", is_submitted)));

            var jsonUrl = rp.url.api + '/api/multi/user/' + user;
            var handleData = function (data) {
                if (data.length) {
                    var list = $('#subredditPopup ul');
                    list.append($('<li>').append($('<hr>', { class: "split" })));
                    redditMultiAppend(data, list, multi);
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

            if (photo.eL)
                return;

            photo.eL = true;

        } else if (photo.flickr) {
            site = 'flickr.com';
            shortid = photo.id;

        }

        if (site === undefined) {
            site = hn;
            if (hn == 'imgur.com' ||
                hn == 'gfycat.com' ||
                hn == 'redgifs.com')
                shortid = url2shortid(photo.url);

            else if (hn == 'iloopit.net') {
                shortid = searchValueOf(photo.url, "loopid");
                if (!shortid)
                    return;

            } else
                return;
        }

        var now = Date.now()/1000;
        if (!rp.loaded[site])
            rp.loaded[site] = {};
        if (rp.loaded[site][shortid] > (now-rp.settings.dupeCacheTimeout))
            return;
        rp.loaded[site][shortid] = now;

        // This allow loading duplicates of found subreddits w/o loops
        var dupes = { };
        if (photo.subreddit)
            dedupArrAdd(dupes, photo.subreddit, photo.id);

        var handleT3Dupe = function(item) {
            // get cross-posts
            var v = dedupArrVal(dupes, item.data.subreddit, item.data.id);
            if (v !== undefined)
                log.debug(" not loading duplicate: /r/"+item.data.subreddit+" "+item.data.id);
            else if (item.data.num_crossposts > 0) {
                var jurl = rp.redditBaseUrl + '/duplicates/' + item.data.id + '.json?show=all';
                var hdata = function (data) {
                    var item = data[0].data.children[0];
                    for(var i = 0; i < data[1].data.children.length; ++i) {
                        var dupe = data[1].data.children[i];
                        if (dedupArrAdd(dupes, dupe.data.subreddit, dupe.data.id, '/r/'+item.data.subreddit+'/'+item.data.id) == "SELF")
                            continue;
                        var v = dedupVal(dupe.data.subreddit, dupe.data.id);
                        if (v !== undefined) {
                            log.debug(" ignoring duplicate [main dedup]: "+v);
                            continue;
                        }
                        handleT3Dupe(dupe);
                    }
                };
                log.info("loading duplicates: /r/"+item.data.subreddit+" "+item.data.id);
                $.ajax({
                    url: jurl,
                    dataType: 'json',
                    success: hdata,
                    error: failedAjax,
                    timeout: rp.settings.ajaxTimeout,
                    crossDomain: true,
                });
            }
            // Ignore user-subs
            if (item.data.subreddit.startsWith('u_')) {
                dedupArrAdd(dupes, item.data.subreddit, item.data.id);
                log.debug("Ignoring duplicate [user sub]: "+item.data.subreddit);
                return;
            }
            if (item.data.score < rp.settings.minScore) {
                dedupArrAdd(dupes, item.data.subreddit, item.data.id);
                log.info("Ignoring duplicate [score too low: "+item.data.score+"]: "+item.data.subreddit);
                return;
            }
            var pic = photoParent(photo);
            var index = addPhotoDupe(pic, { subreddit: item.data.subreddit,
                                            commentN: item.data.num_comments,
                                            title: item.data.title,
                                            date: item.data.created,
                                            id: item.data.id });
            dedupArrAdd(dupes, item.data.subreddit, item.data.id);
            if (index >= 0)
                getRedditComments(pic, pic.dupes[index]);
        };

        // https://www.reddit.com/search.json?q=url:SHORTID+site:HOSTNAME
        var jsonUrl = rp.url.get + '/search.json?include_over_18=on&q=url:'+shortid+'+site:'+site;
        var handleData = function (data) {
            if (isActive(photo))
                updateExtraLoad();
            if (data.data.dist == 0)
                return;
            data.data.children.forEach(handleT3Dupe);
            if (isActive(photo)) {
                var pic = photo;
                if (rp.session.activeAlbumIndex >= 0)
                    pic = photoParent(photo).album[rp.session.activeAlbumIndex];
                updateDuplicates(pic);
            }
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
            log.info("MORE COMMENTS: "+comment.data.parent_id+" : "+photo.url);
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

            photo = initPhotoAlbum(photo);
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
            }
            checkPhotoAlbum(photo);
        }

        if (comment.data.replies)
            for (j = 0; j < comment.data.replies.data.children.length; ++j)
                processRedditComment(photo, comment.data.replies.data.children[j]);
    };

    // Assume: photo has been run through processPhoto() at least once
    var getRedditComments = function (photo, dupe) {
        var comments;
        if (dupe) {
            // This could be:
            // comments = [rp.rp.redditBaseUrl, "comments", id].join('/');
            if (!dupe.commentN || dupe.eL)
                return;
            dupe.eL = true;
            comments = [rp.redditBaseUrl, 'r', dupe.subreddit, "comments", dupe.id].join("/");

        } else {
            // Only load comments once per photo
            if (photo.eL)
                return;

            photo.eL = true;

            if (!photo.commentN || !photo.comments)
                return;
            comments = photo.comments;
        }

        var jsonUrl = rp.url.get + pathnameOf(comments) + '.json';
        var failedData = function (xhr, ajaxOptions, thrownError) {
            photo.eL = false;
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

        log.debug("loading comments: "+comments);
        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedData,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true,
        });
    };

    // T3 is reddit post
    var processRedditT3 = function(photo, t3) {
        // Reddit Gallery Function
        if (t3.gallery_data) {
            photo = initPhotoAlbum(photo, false);

            t3.gallery_data.items.forEach(function(item) {
                var media = t3.media_metadata[item.media_id];
                if (media.status == "failed" || media.status == "unprocessed")
                    return false;
                var pic = { title: fixupTitle(item.caption || t3.title) };
                if (item.outbound_url)
                    pic.extra = infoLink(item.outbound_url, 'link');

                if (media.e == "Image") {
                    pic.url = media.s.u;

                } else if (media.e == "AnimatedImage") {
                    pic.url = media.s.gif;

                } else {
                    log.error("Reddit Gallery element not 'Image': "+media.e);
                    throw "NYI: Reddit Gallery Element";
                }
                if (processPhoto(pic))
                    addAlbumItem(photo, pic)
            });
            checkPhotoAlbum(photo);
        }
        // Reddit hosted videos
        else if (t3.domain == 'v.redd.it') {
            // intentionally load with empty video, load mp4 below
            initPhotoVideo(photo, []);
            var media = (t3.media) ?t3.media.reddit_video
                :(t3.secure_media) ?t3.secure_media.reddit_video
                :undefined;

            if (media) {
                var ind = media.fallback_url.indexOf('/DASH_');
                if (ind > 0) {
                    addVideoUrl(photo, 'mp4', media.fallback_url);
                    photo.video.audio = { mp3: media.fallback_url.substr(0,ind)+"/DASH_audio.mp4" };

                } else {
                    log.error(photo.id+": cannot display video [bad fallback_url]: "+
                              media.fallback_url);
                    return false;
                }
            } else {
                log.error(photo.id+": cannot display video [no reddit_video]: "+photo.url);
                return false;
            }

        } else
            return undefined;

        return true;
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

        var duplicateInList = function(duplicates, item) {
            for (var dup of duplicates) {
                if (dup.id == item.id && dup.subreddit == item.subreddit)
                    return true;
            }
            return false;
        };

        var duplicateAddCross = function(orig_id, duplicates, search_item) {
            if (search_item.crosspost_parent_list === undefined)
                return duplicates;
            for (var i = 0; i < search_item.crosspost_parent_list.length; ++i) {
                var item = search_item.crosspost_parent_list[i];
                if (!item.subreddit.startsWith("u_") && !duplicateInList(duplicates, item)) {
                    dedupAdd(item.subreddit, item.id, '/r/'+orig_id.subreddit+'/'+orig_id.id);
                    duplicates.push({subreddit: item.subreddit,
                                     commentN: item.num_comments,
                                     title: item.title,
                                     date: item.created,
                                     id: item.id});
                }
                duplicates = duplicateAddCross(orig_id, duplicates, item);
            }
            return duplicates;
        };

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

            duplicates = duplicateAddCross(idorig, duplicates, idorig);

            var title = fixupTitle(idorig.title)

            var flair = "";
            // Add flair (but remove if also in title)
            if (idorig.link_flair_text) {
                flair = idorig.link_flair_text.replace(/:[^:]+:/g, "").trim();
                if (flair) {
                    var re = new RegExp('[\\[\\{\\(]'+RegExp.quote(flair)+'[\\]\\}\\)]', "ig");
                    title = title.replace(re, "").trim();
                }
            }

            duplicates.sort(subredditCompare);

            var url = idx.url || idx.url_overridden_by_dest;

            var photo = {
                url: url,
                title: title,
                id: idorig.id,
                over18: idorig.over_18,
                subreddit: idorig.subreddit,
                date: idorig.created_utc,
                dupes: duplicates,
                score: idorig.score,
                commentN: idorig.num_comments,
                comments: rp.redditBaseUrl + idorig.permalink
            };
            if (flair)
                photo.flair = flair;

            if (idorig.author != "[deleted]")
                photo.author = idorig.author;

            else if (idx.author != "[deleted]")
                photo.author = idx.author;

            if (idx.id != photo.id)
                photo.cross_id = idx.id;

            if (idorig.preview)
                addPhotoThumb(photo, idorig.preview.images[0].source.url);

            else if (idorig.thumbnail != 'default' && idorig.thumbnail != 'nsfw')
                addPhotoThumb(photo, idorig.thumbnail);

            var rc = processRedditT3(photo, idx);
            if (rc === false)
                return;

            else if (!rc && idorig.domain == 'reddit.com') {
                // these shouldn't be added via tryPreview nor speculative lookups
                log.info('will not display url [no image]: ' + photo.o_url);
                return;
            }

            rc = processPhoto(photo);

            flair = photo.flair || "";

            if ((photo.type != imageTypes.fail) &&
                (flair.toLowerCase() == 'request' ||
                 photo.title.match(/[[({]request[\])}]/i) ||
                 photo.title.match(/^psbattle:/i) ||
                 flair.match(/(more|source|video|album).*in.*com/i) ||
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

            var tryPreview = function(photo, idorig, msg) {
                if (msg === undefined)
                    msg = 'no image';
                if (idorig.preview && idorig.preview.images.length > 0) {
                    initPhotoThumb(photo, unescapeHTML(idorig.preview.images[0].source.url));
                    log.info('using thumbnail ['+msg+']: '+photo.o_url);
                    if (addImageSlide(photo))
                        return;
                }
                log.info('cannot display '+msg + ': ' + photo.o_url);
                return;
            };

            // @@ able to remove because of processPhoto wpv2?
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

                setSubredditLink(rp.redditBaseUrl + rp.url.subreddit, "reddit");
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
                    if (dupe.data.subreddit.startsWith("u_")) {
                        log.debug(" ignoring duplicate [user sub]: "+dupe.data.subreddit);
                        continue;
                    }
                    if (dedupAdd(dupe.data.subreddit, dupe.data.id, '/r/'+item.data.subreddit+'/'+item.data.id) == "SELF") {
                        log.info('cannot display url [non-self dup]: '+item.data.url);
                        continue;
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

    var getImgur = function () {
        // POPULAR:     /imgur/
        // USER:        /imgur/u/USER
        // TAG:         /imgur/t/TAG
        var a = rp.url.subreddit.split('/');
        var user;
        var tag;
        var errmsg;
        var jsonUrl;
        var handleData;

        if (!rp.session.after) {
            rp.session.after = 0;
            rp.session.loadAfter = getImgur;
        }

        var processPostItem = function(item) {
            var pic = {
                url: item.url,
                title: fixupTitle(item.title || item.description),
                over18: item.is_mature,
                id: item.id,
                score: item.point_count,
            };
            handleImgurItemMeta(pic, item);
            addImageSlide(pic);
        };

        switch(a[2]) {
        case 'u':
            user = a[3];
            errmsg = "User "+user+" has no items";
            jsonUrl = 'https://api.imgur.com/3/account/' + user + '/submissions/'+rp.session.after+'/newest';

            handleData = function (data) {
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
                        score: item.points,
                    };
                    handleImgurItemMeta(pic, item);
                    pic = handleImgurItemAlbum(pic, item);
                    addImageSlide(pic)
                });
                ++rp.session.after;

                doneLoading();
            };
            break;
        case 't':
            tag = a[3];
            errmsg = "Tag "+tag+" has no items";
            jsonUrl = 'https://api.imgur.com/post/v1/posts/t/'+tag+"?page="+rp.session.after;
            handleData = function (data) {
                data.posts.forEach(processPostItem);
                ++rp.session.after;

                doneLoading();
            };
            break;
        default:
            errmsg = "No popular items";
            jsonUrl = 'https://api.imgur.com/post/v1/posts?filter[section]=eq:hot&page='+rp.session.after;
            handleData = function (data) {
                data.forEach(processPostItem);
                ++rp.session.after;

                doneLoading();
            };
            break;
        }

        if (!setupLoading(1, errmsg))
            return;

        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout,
            headers: { Authorization: 'Client-ID ' + rp.api_key.imgur }
        });
    };

    var processHaystack = function(photo, html, docheck, extra, o_link) {
        if (docheck === undefined)
            docheck = false;

        var processNeedle = function(pic, item) {
            var src;
            if (item.tagName == 'IMG') {
                // Fixup item.src
                var attrs = ["src", "data-src"];
                for (var i in attrs) {
                    src = item.getAttribute(attrs[i]);
                    if (src === null)
                        continue;
                    src = unescapeHTML(src);
                    if (src.startsWith('//'))
                        src = ((rp.insecure[hostnameOf(src)]) ?"http:" :"https:")+src;
                    else if (src.startsWith('/'))
                        src = originOf(pic.url)+src;
                    if (!src.startsWith("http"))
                        continue;
                }
                // Shortcut <A href="video/embed"><img src="url" /></a>
                if (item.parentElement.tagName == 'A') {
                    pic.url = item.parentElement.href;
                    if (processPhoto(pic) && pic.type != imageTypes.later) {
                        addPhotoThumb(pic, item.src);
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

                if (!src)
                    return false;
                pic.url = src;

                if (item.alt)
                    pic.title = item.alt;

            } else if (item.tagName == 'VIDEO') {

                initPhotoVideo(pic, [], item.poster);

                item.childNodes.forEach(function(source) {
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
        $('<div />', ownerDocument).html(html).find('img, video, iframe').each(function(_i, item) {
            // init url for relative urls/srcs
            var pic = { url: item.src || item.currentSrc, title: item.alt || item.title, o_url: o_link || photo.url, };
            if (extra)
                pic.extra = extra;
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
    // errorcb(photo)
    // successcb(photo) : default == addImageSlide
    var getPostWPv2 = function(photo, post, errorcb, successcb) {
        if (post === undefined) {
            if (errorcb)
                errorcb(photo);
            return;
        }
        if (successcb === undefined)
            successcb = addImageSlide;
        var hn = hostnameOf(photo.url);
        var extra = localLink(originOf(photo.url), hn, "/wp2/"+hn, "", rp.favicons.wordpress);
        var o_link = photo.url;
        photo.extra = extra;

        photo = initPhotoAlbum(photo, false);
        if (photo.o_url === undefined)
            photo.o_url = photo.url;
        var rc = false;

        if (post.content && processHaystack(photo, post.content.rendered, false, extra, o_link))
            rc = true;

        if (post.description && processHaystack(photo, post.description.rendered, false, extra, o_link))
            rc = true;

        // Pull down 100, but only videos and images
        var jsonUrl = post._links["wp:attachment"][0].href + '&per_page=100';
        var page = 1;
        var handleData = function(data) {
            if (data.length == 100) {
                ++page;
                $.ajax({
                    url: jsonUrl+'&page='+page+'&_jsonp=?',
                    dataType: 'jsonp',
                    success: handleData,
                    error: handleError,
                    timeout: rp.settings.ajaxTimeout,
                    crossDomain: true
                });
            }
            var rc2 = false;
            if (data.length) {
                data.forEach(function(item) {
                    if (!item)
                        return;
                    var pic = { url: item.source_url, extra: extra, o_url: o_link,
                                title: item.title.rendered || unescapeHTML(item.caption.rendered) || item.alt_text };
                    if (processPhoto(pic)) {
                        addAlbumItem(photo, pic);
                        rc2 = true;
                        rc = true;
                    }
                });
            }
            checkPhotoAlbum(photo);
            if (rc || rc2)
                successcb(photo);
            else if (errorcb)
                errorcb(photo);
        };

        var handleError = function(xhr, ajaxOptions, thrownError) {
            checkPhotoAlbum(photo);
            if (rc)
                successcb(photo);
            else if (errorcb)
                errorcb(photo);
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
                                  post.author.name, '/wp/'+hn, post.author.nice_name);
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
            var img = { title: att.caption || att.title, o_url: pic.url };
            if (processAttachment(att, img) && processPhoto(img)) {
                addAlbumItem(photo, img);
                rc = true;
            }
        }
        if (processHaystack(pic, post.content))
            rc = true;

        checkPhotoAlbum(photo);

        if (!rc) {
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

        setSubredditLink('https://'+hostname);
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

        setSubredditLink('https://'+hostname);

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
                            };
                if (post.post_thumbnail)
                    addPhotoThumb(photo, post.post_thumbnail.URL);

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
        } else if (post.type == "photo" || post.type == "link") {
            if (post.photos)
                post.photos.forEach(function(item) {
                    var pic =  { url: item.original_size.url,
                                 type: imageTypes.image,
                                 tumblr: opic.tumblr,
                                 title: fixupTitle(item.caption || post.title || post.caption_abstract) }
                    if (processPhoto(pic)) {
                        addAlbumItem(photo, pic);
                        rc = true;
                    }
                });
            // "photo" type
            if (post.link_url) {
                pic = { url: post.link_url,
                        title: fixupTitle(post.title || post.caption || post.summary) };
                if (processPhoto(pic)) {
                    addAlbumItem(photo, pic);
                    rc = true;
                }
            }
            // "link" type
            if (post.url) {
                pic = { url: post.url,
                        tumblr: opic.tumblr,
                        title: fixupTitle(post.title || post.summary || post.description) };
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

        }
        checkPhotoAlbum(photo);

        if (!rc && !dupe) {
            log.info("cannot display url [Tumblr post type: "+post.type+"]: "+
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
            setSubredditLink(data.response.blog.url);
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
            setSubredditLink(data.url);
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
                        safe_search: 3,
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

    var getGfycatApi = function() {
        // URLs:
        // TRENDING:    /(gfycat|redgifs)/
        // USER:        /(gfycat|redgifs)/u/USER
        // TAG:         /(gfycat|redgifs)/t/TAG
        var apiurl;
        var user;
        var tag;
        var jsonUrl;
        var errmsg;
        var a = rp.url.subreddit.split('/');
        var type = a[1];
        var gifs;
        var first = false;

        if (type == "gfycat") {
            apiurl = "https://api.gfycat.com";
            gifs = 'gyfcats';
        } else if (type == "redgifs") {
            apiurl = "https://api.redgifs.com";
            gifs = 'gifs';
        } else {
            throw("Bad Gfycat API User: "+type);
        }

        var url;
        switch (a[2]) {
        case "u":
            user = a[3];
            errmsg = "User "+user+" has no videos";
            jsonUrl = apiurl+'/v1/users/'+user+'/'+gifs+'?count=20';
            url = gfycatUserUrl(user, type);
            break;
        case "t":
            tag = a[3];
            errmsg = "Tag "+tag+" has no videos";
            jsonUrl = apiurl+"/v1/"+gifs+"/search?count=20&search_text="+tag.toLowerCase();
            url = gfycatTagUrl(tag, type);
            break;
        default:
            jsonUrl = apiurl+'/v1/'+gifs+'/trending?count=20';
            errmsg = "No trending videos";
            if (type == "gfycat")
                url = "https://gfycat.com/discover/popular-gifs";
            else
                url = "https://www.redgifs.com/popular-gifs";
            break;
        }
        setSubredditLink(url);

        if (!setupLoading(1, errmsg))
            return;

        // Get all Gfycats (currently gfycat.com doesn't seem to list nsfw item here)
        if (rp.session.after)
            jsonUrl += "&cursor="+rp.session.after;
        else
            first = true;

        var gfycat2pic = function(post) {
            var image = { url: gfyItemUrl(post, type),
                          over18: (post.nsfw != 0),
                          title: gfyItemTitle(post),
                          date: post.createDate,
                          type: imageTypes.video,
                          thumb: post.posterUrl,
                          // ensure score will show by default
                          score: rp.settings.minScore + post.likes - post.dislikes,
                          gfycat: { type: type },
                          video: { webm: [ post.webmUrl ],
                                   mp4: [ post.mp4Url ]
                                 }
                        };
            if (post.tags)
                image.gfycat.tags = post.tags;
            var user = gfyItemUser(post);
            if (user)
                image.gfycat.user = user;
            return image;
        };

        var handleGfycatData = function (data) {
            var gifs = data.gfycats || data.gifs;
            if (gifs.length) {
                gifs.forEach(function (post) {
                    var image = gfycat2pic(post);
                    addImageSlide(image);
                });
                if (data.cursor) {
                    rp.session.after = data.cursor;
                    rp.session.loadAfter = getGfycatApi;
                } else {
                    rp.session.loadAfter = null;
                }
            }
            doneLoading();
        };

        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleGfycatData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });

        // Get Albums if loading for User
        if (user && first) {
            addLoading();
            var jsonAlbumUrl = apiurl+'/v1/users/'+user+'/collections';
            var handleAlbumData = function (data) {
                if (data.count === 0) {
                    doneLoading();
                    return;
                }
                var collections = data.gfyCollections || data.gifCollections;

                collections.forEach(function (album) {
                    var url = apiurl+'/v1/users/'+user+'/collections/'+album.folderId+"/gifs";
                    // @ process as album?
                    if (album.folderSubType != "Album") {
                        log.error("Unknown type ["+album.folderSubType+"]: "+url);
                        return;
                    }
                    var photo = {
                        url: gfycatUserUrl(user, type)+'/collections/'+album.folderId+"/"+album.linkText,
                        gfycat: { type: type, user: user },
                        title: fixupTitle(album.folderName || album.description),
                        date: album.date,
                        over18: Boolean(album.nsfw),
                    };
                    var hd = function(data) {
                        initPhotoAlbum(photo, false);
                        var gifs = data.gfycats || data.gifs;
                        if (!gifs.length) {
                            doneLoading();
                            return;
                        }
                        gifs.forEach(function(data) {
                            var pic = gfycat2pic(data);
                            addAlbumItem(photo, pic);
                        });
                        addImageSlide(photo);
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
            var handleAlbumError = function (xhr, ajaxOptions, thrownError) {
                if (xhr.status == 404 || xhr.status == 403) {
                    doneLoading();
                    return;
                }
                failedAjax(xhr, ajaxOptions, thrownError);
            };
            $.ajax({
                url: jsonAlbumUrl,
                dataType: 'json',
                success: handleAlbumData,
                error: handleAlbumError,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true
            });
        }
    };

    // Build a pic form an iloopit item suitable for adding to an album
    var iloopit2pic = function(item) {
        var pic = {
            title: item.title,
            url: "https://iloopit.net/porngifs/all/?type=looplayer&loopid="+item.old_id,
            date: (Date.parse(item.date)/1000).toFixed(),
            over18: true,
            id: item._id,
            score: item.likes - item.dislikes,
            iloopit: { user: item.username, loop: item.old_id },
        };
        if (item.tags)
            pic.iloopit.tags = item.tags;
        initPhotoiLoopit(pic, item.data_id);
        return pic;
    };

    // If item.group has a list, load those and build album
    var handleiLoopitAlbum = function(photo, item) {
        if (!item.group || item.group.length == 0)
            return photo;

        addLoading();
        photo = initPhotoAlbum(photo, true);

        var jurl = "https://api.iloopit.net/videos/group/"+item._id+"/";
        var hdata = function(data) {
            data.forEach(function(item) {
                var pic = iloopit2pic(item);
                addAlbumItem(photo, pic);
            });
            checkPhotoAlbum(photo);
            doneLoading();
        };
        $.ajax({
            url: jurl,
            dataType: 'json',
            success: hdata,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
        return photo;
    };

    var loadiLoopitTags = function() {
        if (rp.sitecache.iloopit !== undefined)
            return;
        rp.sitecache.iloopit = {};
        var jsonUrl = "https://api.iloopit.net/tags/all/";
        var handleData = function(data) {
            data.forEach(function(item) {
                rp.sitecache.iloopit[item._id] = item.name;
            });
        };
        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var getiLoopit = function() {
        // URLs:
        // /iloopit/            TRENDING        /likelog/user/americ/PAGE/
        // /iloopit/t/TAG       TRENDING TAG    /videos/tag/TAG/PAGE/
        // /iloopit/u/USER      User Videos     /videos/user/USER/PAGE/
        var jsonUrl;
        var a = rp.url.subreddit.split('/');
        var errmsg;

        switch(a[2]) {
        case "u":
            jsonUrl = "https://api.iloopit.net/videos/user/"+a[3];
            setSubredditLink("https://iloopit.net/porngifs/user/"+a[3]);
            errmsg = "No more user "+a[3];
            break;
        case "t":
            jsonUrl = "https://api.iloopit.net/videos/tag/"+a[3];
            setSubredditLink("https://iloopit.net/porngifs/"+a[3]+"/trending/");
            errmsg = "No more "+a[3]+" tagged";
            break;
        default:
            jsonUrl = "https://api.iloopit.net/likelog/user/americ";
            setSubredditLink("https://iloopit.net/");
            errmsg = "No more trending";
            break;
        }

        loadiLoopitTags();

        if (!setupLoading(1, errmsg))
            return;

        if (!rp.session.after)
            rp.session.after = 1;

        jsonUrl += "/"+rp.session.after+"/";

        var handleData = function(data) {
            if (!data || data.length == 0) {
                rp.session.loadAfter = null;
                log.info("LOADING Done");
                return;
            }
            rp.session.loadAfter = getiLoopit;
            rp.session.after++;

            data.forEach(function(item) {
                var photo = iloopit2pic(item);

                handleiLoopitAlbum(photo, item);

                photo.extra = remoteLink(item.source_url, "Original");

                addImageSlide(photo);
            });
            doneLoading();
        };

        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var processUrls = function(path, initial, data) {
        // Separate to before the question mark and after
        // Detect predefined reddit url paths. If you modify this be sure to fix
        // .htaccess
        // This is a good idea so we can give a quick 404 page when appropriate.
        var regexS = "(/(?:(?:imgur/)|(?:gfycat/)|(?:tumblr/)|(?:flickr/)|(?:blogger/)|(?:iloopit/)|(?:redgifs/)|(?:wp2?/)"+
            "|(?:auth)|"+
            "(?:r/)|(?:u/)|(?:user/)|(?:domain/)|(?:search)|(?:me)|(?:hot)|(?:top)|(?:new)|(?:rising)|(?:controversial))"+
            "[^&#?]*)[?]?(.*)";

        if (path === undefined)
            path = $('#subredditUrl').val();
        if (initial === undefined)
            initial = false;

        path = path.replace(/ +/g, '/').replace(/^\/+/, '/').replace(/^\?+/, '');

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
            rp.url.subreddit = rp.url.subreddit.replace(/^\/u\//, "/user/");

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

        $('a.hardlink').each(function(_i, item) {
            var href = pathnameOf(item.href);
            item.href = rp.url.base+href;
            item.classList.remove('hardlink');
        });

        // Auth Response - only ever uses window.location
        if (rp.url.subreddit == "/auth") {
            var args = searchOf(window.location.href);

            var url = decodeURIComponent(args.state);
            if (url.startsWith('/auth'))
                url = '/';

            if (args.access_token) {
                // Implicit Flow
                var by = redditExpiresToTime(decodeURIComponent(args.expires_in));

                setupRedditLogin(args.access_token, by);

            } else if (args.code) {
                // Code Flow
                redditCodeFlow({code: args.code}, url);
                return;

            } else {
                log.error("Failed to load auth: "+window.location.href);
                url = "/";
            }
            processUrls(url);
            loadRedditMultiList();
            return;

        } else if (initial && rp.session.redditRefreshToken && !rp.session.loginExpire) {
            redditCodeFlow({ refresh_token: rp.session.redditRefreshToken }, path);
            return;
        }

        if (initial)
            rp.history.replaceState({}, "", path);
        else if (data === undefined && path != "")
            rp.history.pushState({}, "", path);

        var subredditName = rp.url.subreddit + getVarsQuestionMark;

        var visitSubreddit = rp.redditBaseUrl + rp.url.subreddit + getVarsQuestionMark;

        setSubredditLink(visitSubreddit, "reddit");
        $('#subredditUrl').val(subredditName);

        document.title = "redditP - " + subredditName;

        $('#choiceLi').hide();
        setupChoices();

        if (((rp.session.loginExpire || rp.session.loginNeeded) &&
             rp.url.subreddit.substr(0, rp.url.subreddit.length - rp.url.choice.length) == '/') ||
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
        rp.loaded = {};
        rp.session.after = '';
        rp.session.loadAfter = null;
        rp.session.activeIndex = -1;
        rp.session.activeAlbumIndex = -1;

        // destroy old Number Buttons
        $("#allNumberButtons").remove();
        $("#albumNumberButtons").remove();
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
                    if (!photo.dupes)
                        return;
                    photo.dupes.forEach(function(dupe) {
                        // Don't need to check if subreddit is u_ because it was added to a photo already
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
            getImgur();

        else if (rp.url.subreddit.startsWith('/tumblr/'))
            getTumblrBlog();

        else if (rp.url.subreddit.startsWith('/wp/'))
            getWordPressBlog();

        else if (rp.url.subreddit.startsWith('/wp2/'))
            getWordPressBlogV2();

        else if (rp.url.subreddit.startsWith('/blogger/'))
            getBloggerBlog();

        else if (rp.url.subreddit.startsWith('/gfycat/') ||
                 rp.url.subreddit.startsWith('/redgifs/'))
            getGfycatApi();

        else if (rp.url.subreddit.startsWith('/flickr/'))
            getFlickr();

        else if (rp.url.subreddit.startsWith('/iloopit/'))
            getiLoopit();

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
