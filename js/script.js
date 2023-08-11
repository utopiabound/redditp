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
 * redditp-showEmbed            - int     - Show embeded content (see rp.NEVER,SOMETIMES,ALWAYS)
 * redditp-timeToNextSlide      - int     - timeout in seconds
 * redditp-favicons             - hash of strings       - cached result of hostname to favicon url
 * redditp-wordpress            - hash to int           - cached result of speculative wordpress lookup
 * redditp-insecure             - hash to booleans      - cached result of https:// failed, where http:// worked
 * redditp-bloginfo             - hash to hash          - cached result of cacheBlogInfo
 * redditp-usermap              - hash of strings       - cached rp.user.id2name
 * 
 * (window.history)
 * Set/push/replace state
 * 
 * Cookies - NONE
 *
 * Locations for per-Site processing:
 *   rp.favicons - limited number of favicons based on second level domain (for major sites that don't support http://fqdn/favicon.ico)
 *   processPhoto() - initial processing of photo.url, if it can be determined to be photo/video/later
 *   fillLaterDiv() - where photo's tagged as later, are processed via ajax callout
 *   fixupUrl()     - known https: sites / url munging
 *   fixupPhotoTitle() - any urls that can be added/processed from a photo.title (only affects photo.title)
 *   initPhotoYoutube() - wrapper around initPhotoEmbed()
 *   remoteLink()   - Common image url to full site artwork url
 *
 *   site{User,Photo,Tag,Search}{Link,Url} - social media links
 *
 * per-Site Duplicate handling:
 *   getRedditDupe()
 *   updateDuplicates()
 *   animateNavigationBox()
 *   processUrl() - RESTORE
 */
/* Data Structures:
 * rp.photos = ARRAY of HASH
 *      url:            URL link of "photo"    (addImageSlide() will call fixupUrl())
 *      over18:         BOOLEAN image is nsfw
 *      -- Optional --
 *      title:          HTML Title of image     (creator of object needs to call fixupPhotoTitle())
 *      flair:          HTML flair put next to title                                    [read by picFlair()]
 *      id:             TEXT Unique ID based on site+subreddit or blog
 *      date:           INT  Date in seconds
 *      author:         TEXT reddit username
 *      aflair:         HTML flair to put next to author
 *      comments:       URL  link to photo comments
 *      commentN:       INT  Number of comments (if this is set, comments needs to be set too)
 *      eL:             BOOL Have loaded comment images or duplicate listings
 *      cross_id:       TEXT ID in duplictes of original link
 *      elinks:         ARRAY of [NAME, URL]    Extra Links                             [addPhotoExtraLink(), picExtraLinks()]
 *      thumb:          URL  thumbnail of image (e.g. cached version from reddit)       [set by addPhotoThumb()]
 *      fb_thumb:       ARRAY of URLs Fallback thumbnail urls (must be images)          [set/use by addPhotoThumb()/nextPhotoThumb()]
 *      score:          INT  Score (upvotes - downvotes)
 *      fallback:       ARRAY of URLs Fallback urls (if pic.url fails)  [set/use by addPhotoFallback()/nextPhotoFallback()]
 *
 *      -- Other, NOT creator setable --
 *      type:           ENUM of imageTypes                              [set by processPhoto()/initPhoto*()]
 *      o_url:          URL original URL                                [set by processPhoto()]
 * P    insertAt:       INT where to insert pictures in album           [set by addAlbumItem()]
 * P    index:          INT index in rp.photos, used by album functions [set by addImageSlide()]
 *      dupes:          ARRAY of HASH                                   [set by addPhotoDupe(), redditT3ToDupe]
 *              id:             TEXT Unique ID (subreddit article id, tumblr post id, etc.)
 *              -- Optional --
 *              eL:             BOOL True if comments already loaded (same as above)
 *              title:          TEXT (same as above)
 *              date:           INT  (same as above)
 *              off:            BOOL blog is inactive
 *              -- Site Dependent: Reddit --
 *              subreddit:      TEXT subreddit name (same as above)
 *              commentN:       INT  (same as above)
 *              a:              TEXT reddit author
 *              -- Site Dependent: Tumblr --
 *              tumblr:         TEXT Tumblr site
 *              url:            URL  link to duplicate post
 *
 *      -- Depending on host site --
 *      subreddit:      TEXT of subreddit name
 *      site:           HASH                                            [addPhotoSite()]
 *              t:      imgur|gfycat|flickr|danbooru|e621
 *              -- Optional --
 *              users:  ARRAY of TEXT usernames                         [addPhotoSiteUser(), siteUserLink(), hasPhotoSiteUser()]
 *              tags:   ARRAY of TEXT Tags for photo                    [picHasSiteTags(), addPhotoSiteTags()]
 * P    blog:           HASH
 *              t:      blogger|tumblr|wp|wp2
 *              b:      TEXT blog name
 *              -- Optional --
 *              id:     TEXT post id
 *              user:   TEXT of username                                [hasPhotoBlogUser, blogUser*, cacheBlogUser]
 *              tags:   ARRAY of TEXT/INT tags (may require lookup)     [addPhotoBlogTags, hasPhotoBlogTags, blogTag*, cacheBlogTag]
 *
 *      -- Depending on image Type [see initPhotoTYPE()] --
 *      video:          HASH for video ext to url + thumbnail (see showVideo() / rp.mime2ext)   [initPhotoVideo() / addVideoUrl()]
 *              TYPE:           ARRAY of URLs (type is ext c.f. rp.ext2mime video/*)
 *              audio:          HASH of TYPE to URL (type is ext c.f. rp.ext2mime audio/*)
 *              -- set by showVideo() --
 *              duration:       INT length of video in seconds
 *              times:          INT number of times to play video
 * P    album:          ARRAY of HASH
 *              (hash items are very similar to photo structure, but are not allowed to be albums)
 *              -- Specific to Album Items --
 *              parentIndex:    INT  Index of parent in rp.photos
 *              parent:         POINTER pointer to parent photo (prior to being added to rp.photos)
 *      html:           TEXT html to insert
 *      embed:          HASH
 *              aplay:          BOOL Embeded video will autoplay (with sound)
 *
 * TODO:
 * * Make #navboxExtraLoad.click() better about loading crossposts then comments from photo.dupes
 * * Grey out volume appropriately
 * * use https://oembed.com/providers.json or a processed version for oembed reference?
 * * on rotation/fullscreen event, check icon toggle
 * * Use /api/v1/me/prefs for defaults?
 * * Make title social link alterable (change from twitter to instagram...)
 * * Better Blogger&Blogspot urls
 * * Handle Categories for blogs in addition to Tags
 * * Finish removing tumblr from dupes
 * * Allow Differentiated tag types (wp2: Tags vs. Categories, e621: General, Meta, Species, Artists, danbooru: general, character, artist, meta)
 * * Integrate rp.blogcache.hn2site and wp2 alternate hostnames
 * ABANDONED Ideas
 * * Flickr Login - OAuth 1.0a doesn't work with CORS
 */

var rp = {};
// This can be set to TRACE, DEBUG, INFO, WARN. ERROR, SLIENT (nothing printed)
log.setLevel(log.levels.INFO);
RegExp.quote = function(str) {
    var re = /[.*+?^${}()\\|[\]]/g;
    return (str+'').replace(re, "\\$&");
};

// CHANGE THESE FOR A DIFFERENT Reddit Application/Website
rp.api_key = {
    tumblr:  'sVRWGhAGTVlP042sOgkZ0oaznmUOzD8BRiRwAm5ELlzEaz4kwU',
    imgchest: '102|KP09I84yWOVAGnprWXYqNYlI5Kfj9h7PLcw62Efg',
    blogger: 'AIzaSyDbkU7e2ewiPeBtPwr1cfExV0XxMAQKhTg',
    flickr:  '24ee6b81f406711f8c7d3a9070fe47a7',
    reddit:  '7yKYY2Z-tUioLA',
    imgur:   'ae493e76de2e724'
};
rp.redirect = 'http://redditp.utopiabound.net/auth';

rp.settings = {
    // JSON/JSONP timeout in milliseconds
    ajaxTimeout: 10000,
    // Speed of the animation
    animationSpeed: 1000,
    shouldAutoNextSlide: false,
    timeToNextSlide: 8,
    dupeCacheTimeout: 360, // 6 minutes
    goodImageExtensions: ['jpg', 'jpeg', 'gif', 'bmp', 'png', 'svg', 'webp'],
    goodVideoExtensions: ['webm', 'mp4', 'mov', 'm4v'], // Matched entry required in rp.mime2ext
    minScore: 1,
    decivolume: 5,
    // cache Multi-reddit per-user lifetime (1H)
    multiExpire: 3600,
    // cache per-subreddit lifetime (4H)
    subExpire: 14400,
    // default number of Photos to load
    count: 25,
    // show All Embedded Items
    // Tri-state:
    //   -1 (NEVER)     - embedded items are never loaded
    //   0  (SOMETIMES) - embedded items are autoloaded if they won't autoplay
    //   1  (ALWAYS)    - embedded items are always loaded
    embed: 0,
    // show NSFW Items
    nsfw: false,
    mute: true,
    // image display actual size (max fullscreen)
    realsize: false
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

    // Per site data for "next traunch" of data
    after: "",
    // Function called to load more data
    loadAfter: null,

    // Login dependent values
    loginNeeded: false, // true if current subreddit needs a login to work correctly

    // Loading status - set via setupLoading() / doneLoading()
    loadingNextImages: false,
    loadingMessage: "",
    loading: 0,

    needsPlayButton: false,
    volumeIsMute: false,  // Volume 0/1 should be used as mute/unmount - no volume control
    fakeStorage: false,
    regexUnicode: true,
    showRedditLink: true,
    redditRefreshToken: '',
    redditHdr: {}
};

rp.login = {
    reddit: {
        expire: 0,
        user: '',
        hdr: {},
        refreshToken: '',
    },
};


// In case browser doesn't support localStorage
// This can happen in iOS Safari in Private Browsing mode
rp.storage = {};

// Wordpress Site Version
// SITE -> INT (0: unsupported, 1: WPv1, 2: WPv2)
rp.wp = {};
// If site is insecure
// SITE -> bool
rp.insecure = {};

// siteUserName(), siteUserId(), cacheSiteUser()
rp.user = {
    // [SITE][ID] = name
    id2name: {},
    // [SITE][NAME] = id
    name2id: {},
};

rp.blogcache = {
    // [blogger|tumblr|wp][USERID] = { name: "Display Name", url: URL }
    user: {},                   // cacheBlogUser, blogUserLink, blogUserInfo
    // [type][site] == { n: "Blog Title", [h: hostname ] }
    info: {},                   // cacheBlogInfo, blogTitle, blogHostname
    // [type][site][tag] == "Tag Name"
    tags: {},                   // cacheBlogTag, blogTag
    // [site][slug] = TagID
    wp2tag: {},                 // slug -> tagID: cacheBlogTag
    // [type][fqdn] = site // blogger hn to site
    hn2site: { blogger: {} }
}

// FQDN -> URL of favicon
rp.faviconcache = {};

// used to populate local storage values
rp.defaults = {
    wp: {
        'apnews.com': 0,
        'en.ersties.com': 0,
        'npr.org': 0,
        'onlyfans.com': 0,
        'rpclip.com': 2,
        'www.bbc.com': 0,
        'www.bbc.co.uk': 0,
        'www.businessinsider.com': 0,
        'www.nfl.com': 0,
        'www.reuters.com': 0,
        'www.tmz.com': 0,
    },
    favicon: {
        'art.ngfiles.com': 'https://www.newgrounds.com/favicon.ico',
        'i.pximg.net': 'https://www.pixiv.net/favicon.ico',
        'imgbox.com': 'https://imgbox.com/images/favicon.ico',
        'itaku.ee': 'https://itaku.ee/assets/favicon-yellow.ico',
        'sta.sh': 'https://www.deviantart.com/favicon.ico',
        'snapchat.com': 'https://static.snapchat.com/favicon.ico',
    }
};

rp.history = window.history;

// Hosts will default to originOf(url)+'/favicon.ico' (c.f. setFavicon())
// this list overrides based on second level domain (e.g. mywebsite.wordpress.com -> wordpress)
rp.favicons = {
    tumblr:  'https://assets.tumblr.com/images/favicons/favicon.ico',
    wordpress: 'https://s1.wp.com/i/favicon.ico',
    wp: 'https://s1.wp.com/i/favicon.ico',
    discord: 'images/discord.svg',
    discordapp: 'images/discord.svg',
    dropbox: 'https://cfl.dropboxstatic.com/static/images/favicon.ico',
    imgchest: 'https://api.imgchest.com/assets/img/favicons/favicon-16x16.png',
    patreon: 'https://c5.patreon.com/external/favicon/favicon.ico',
    xhamster: 'https://static-lvlt.xhcdn.com/xh-mobile/images/favicon/favicon.ico',
    tiktok: 'https://lf16-tiktok-common.ibytedtos.com/obj/tiktok-web-common-sg/mtact/static/pwa/icon_128x128.png',
    // i.redd.it/v.redd.it - reddit hosted images
    redd: 'https://www.redditstatic.com/icon.png',
    // Full favicon.ico doesn't scale well
    redgifs: 'https://www.redgifs.com/favicon-16x16.png'
};

// See above
rp.photos = [];

// cache of recently loaded duplicates
// [site][shortid] = DATE
rp.loaded = {};

// local reddit cache
rp.redditcache = {
    multi: {}, // username: { date: DATE, data: [] }
    sub: {} // subreddit.toLowerCase(): { date: DATE, data: {T5} }
};

// maybe checkout http://engineeredweb.com/blog/09/12/preloading-images-jquery-and-javascript/
// for implementing the old precache
rp.cache = {};

// use dedupAdd() and dedupVal()
// KEY => { ID => LINK }
// KEY - subreddit, hostname
// * subreddit: T3.ID => "SELF" | "/r/"+sub+"/"+sub_id
// * hostname: shortid => "/r/"+sub+"/"+sub_id | "SELF" | parent.post
rp.dedup = {};

// rp.choices[rp.url.site][rp.url.type].includes(rp.url.choice) == true
// SITE -> { TYPE => [ "DEFAULT", "OTHER", "CHOICES" ] }
rp.choices = {
    'blogger': { 't': [] },
    'danbooru': {
        '': [ 'new', 'hot', 'popular', 'popular:day', 'popular:week', 'popular:month', 'viewed'],
    },
    'e621': {
        '': [ 'new', 'hot', 'popular', 'popular:day', 'popular:week', 'popular:month'],
    },
    'gfycat': {},
    'flickr': {
        '':  [ 'hot', 'new' ],
        'u': [ "photos", "albums" ],
        't': [ 'hot', 'new' ],
        's': [ 'hot', 'new' ],
    },
    'imgur': {
        '': [ "hot", "new", "top", "top:day", "top:week", "top:month", "top:year", "top:all" ],
        'u': [ "new", "old", "best" ],
        't' : [ "hot", "new", "top", "top:day", "top:week", "top:month", "top:year", "top:all" ],
    },
    'reddit': { // top D W M Y A
        '':          [ "best", "hot", "new", "top", "top:day", "top:week", "top:month",  "top:year", "top:all",
                         "rising", "controversial", "gilded" ],
        'r':         [ "hot", "new", "top", "top:day", "top:week", "top:month",  "top:year", "top:all",
                       "rising", "controversial", "gilded" ],
        'domain':    [ "hot", "new", "top", "top:day", "top:week", "top:month",  "top:year", "top:all",
                       "rising", "controversial", 'gilded' ],
        'friends':   [ "new", "gilded" ],
        'search':    [ "relevence", "relevence:day", "relevence:week", "relevence:month",  "relevence:year", "relevence:all",
                       "top", "top:day", "top:week", "top:month",  "top:year", "new" ],
        'submitted': [ "hot", "new", "top", "top:day", "top:week", "top:month",  "top:year", "top:all", "controversial" ],
        'm':         [ "hot", "new", "top", "top:day", "top:week", "top:month",  "top:year", "top:all",
                       "rising", "controversial", 'gilded' ],
    },
    'tumblr': { 't': [] },
    'wp':  { '': [ "new", "old" ], 't': [ "new", "old" ] },
    'wp2': { '': [ "new", "old" ], 't': [ "new", "old" ] },
};

rp.reddit = {
    base: "https://www.reddit.com",     // const
    oauth: "https://oauth.reddit.com",  // const
    loginUrl: "https://www.reddit.com/api/v1/authorize", // setable for mobile in processUrl()
    api: "https://www.reddit.com", // start as base
    // Users to skip comments from
    skipped_bots: [ 'AutoModerator', 'sneakpeekbot' ],
};

rp.url = {
    // Set in processUrl()
    root: '', // root of redditp app - image base path
    base: '', // path for redditp links

    // reset based in rpurlReset
    site: '', // reddit | gfycat | ... ( rp.choices[rp.url.site] !== undefined )
    type: '', // r | t | u | user | ... (site dependent - c.f. rp.choices)
    sub: '', // SUBREDDIT | TAG | USERNAME
    multi: '', // MULTI
    choice: '', // <NONE> | new | hot | ... (c.f. rp.choices)

    // Called path
    path: '',
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

    // This maps from above imageTypes to CSS style names.
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
        bloginfo: 'bloginfo',
        wp: 'wordpress',
        user: 'usermap',
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
            return Math.floor(secs)+'s';
    }

    /// Return current time in seconds
    function currentTime() {
        return Date.now()/1000;
    }

    // Takes a date in any form Date() can recognize and returns seconds
    var processDate = function(date, tz) {
        var d = new Date(date+((tz) ?tz :""));
        return d.valueOf()/1000;
    };
    rp.fn.date = processDate;

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
        var as = a.subreddit || a.tumblr; // @@
        var bs = b.subreddit || b.tumblr;
        return as.toLowerCase().localeCompare(bs.toLowerCase());
    };

    var stopEvent = function(event) {
        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    };

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
        return currentIndex;
    };

    var getPic = function(index, album) {
        if (index < 0)
            return undefined;
        var photo = rp.photos[index];
        if (album == undefined || album < 0 || photo.type != imageTypes.album)
            return photo;
        return photo.album[album];
    };

    var getCurrentPic = function() {
        return getPic(rp.session.activeIndex, rp.session.activeAlbumIndex);
    };
    rp.fn.getCurrentPic = getCurrentPic;

    function loadMoreSlides() {
        if (rp.session.loadAfter !== null &&
            (!rp.session.loginNeeded || rp.login.reddit.expire))
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

    var shouldStillPlay = function(index, album) {
        if (index != rp.session.activeIndex)
            return false;
        var photo = getPic(index, album);
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
        //var ytExtra = '?enablejsapi=1';
        var ytExtra = '?';
        if (start !== undefined)
            ytExtra += 'start='+start+'&';

        ytExtra += 'autoplay=1&origin='+encodeURIComponent(window.location.origin);
        return 'https://www.youtube.com/embed/'+id+ytExtra;
    };

    var flickrJsonURL = function(method, args) {
        if (!args)
            args = {};
        return 'https://www.flickr.com/services/rest/?method='+method+'&api_key='+rp.api_key.flickr+
            Object.keys(args).map(function(k){ return '&'+k+'='+args[k]}).join("")+
            '&format=json&jsoncallback=?';
    }

    var _infoAnchor = function(url, text, urlalt, classes) {
        if (classes === undefined)
            classes = "info infol";
        var a = $('<a>', {href: url, class: classes}).html(text);
        if (urlalt)
            a[0].title = urlalt;
        return a;
    }

    // url - foreign URL
    // local - local URL
    // -- optional --
    // text - text of local Url (default: local URL)
    // urlalt - alt text of foreign and local URLs
    // favicon - url of favicon
    // classes - alternate class of links (default: "info infol")
    var _localLink = function(url, local, text, urlalt, favicon, classes) {
        if (text === undefined)
            text = local;
        // favicon set in setFavicon
        if (classes === undefined)
            classes = "info infol";

        var data = $('<span/>');
        data.append(_infoAnchor(rp.url.base+local, text, urlalt, classes+" local"));
        var link = _infoAnchor(url, '', urlalt, classes+" infor remote");
        setFavicon(link, url, favicon);
        data.append(link);
        return data;
    };

    var redditLink = function(path, pathalt, pathname, select) {
        var classes;
        if (select)
            classes = "info infol selectable";
        return _localLink(rp.reddit.base+path, path, pathname, pathalt, "reddit", classes);
    };

    // Same as redditLink, but no info class
    var titleRLink = function(path, pathname, alt) {
        var div = $('<div/>');
        var span = $('<span>', { class: "social infor" });
        span.append(_localLink(rp.reddit.base+path, path, pathname, alt, "reddit", ""));
        div.append(span);
        return div.html();
    };

    var titleTagLink = function(type, otag) {
        var tag = encodeURIComponent(otag);
        var d = siteTagDisplay(type, otag);
        var div = $('<div/>');
        var span = $('<span>', { class: "social infor" });
        span.append(_localLink(siteTagUrl(type, tag), '/'+type+'/t/'+tag, d, "", "", "selectable"));
        div.append(span);
        return div.html();
    };

    var localLink = function(url, text, local, urlalt, favicon) {
        return _localLink(url, local, text, urlalt, favicon);
    };

    // Selectable (highlightable) local Link
    var localLinkS = function(url, text, local, urlalt, favicon) {
        return _localLink(url, local, text, urlalt, favicon, "info infol selectable");
    };

    var localLinkFailed = function(url, text, local, urlalt, favicon) {
        return _localLink(url, local, text, urlalt, favicon, "info failed");
    };

    var titleFLink = function(url, text) {
        var data = $('<div/>');
        data.append($('<a>', { href: url, class: "remote infor" }).html(text));
        return data.html();
    };

    var localUserIcon = function(type, user) {
        return _infoAnchor(rp.url.base+localUserUrl(type, user), googleIcon("attribution"), user, "info infoa local");
    };

    var choiceLink = function(path, name, alt) {
        return _infoAnchor(rp.url.base+path, name, alt, "info infol local");
    };

    var titleFaviconLink = function(url, text, site, alt) {
        var data = $('<div/>');
        var span = $('<span>', { class: "remote infor" }).html(" at "+site);
        setFavicon(span, url);
        var a = $('<a>', { href: url, class: "remote infor social" }).html(text).append(span);
        if (alt)
            a[0].title = alt;
        data.append(a);
        return data.html();
    };

    var remoteLink = function(url, text) {
        var data = $('<span/>');
        var fqdn = hostnameOf(url);
        try {
            var shortid;
            if (fqdn == 'i.pximg.net') {
                shortid = url2shortid(url, -1, '_', false);
                url = 'https://www.pixiv.net/en/artworks/'+shortid;
            }
        } catch (e) {
            // ignore
        }
        data.append(_infoAnchor(url, text));
        var link = _infoAnchor(url, '', '', "info infor remote social");
        setFavicon(link, url);
        data.append(link);
        return data;
    };

    // Process url to social link
    var socialUrlLink = function(url) {
        var a = pathnameOf(url).split('/');
        a.shift();
        var domains = hostnameOf(url).split('.').reverse();
        var hn = domains[1]+'.'+domains[0];
        if (hn == 'tumblr.com')
            return socialUserLink(domains[2], "tumblr", url);
        var user, status;
        if (a.length && ['user', 'gallery'].includes(a[0].toLowerCase()))
            a.shift();
        if (a.length && !['watch', 'posts', 'view'].includes(a[0].toLowerCase()))
            user = a.shift();
        if (a.length && ['post', 'status'].includes(a[0].toLowerCase()))
            a.shift();
        if (a.length)
            status = a.shift();
        if (user) {
            if (hn == 't.me')
                domains[1] = 'telegram';
            else if (hn == 'reddit.com' && path[0] == 'r')
                return path; // special case
            try {
                return socialUserLink(user, domains[1], url, status);
            } catch (e) {
                // ignore and fall through
            }
        }
        return titleFLink(url, domains.reverse().join('.')+pathnameOf(url));
    };

    // return HTML
    var socialUserLink = function(user, type, alt, status) {
        if (type === undefined)
            throw "Bad Social Type";
        try {
            return siteUserLink({user: user, t: type}, alt);
        } catch (e) {
            switch(type) {
            case "facebook":    return titleFaviconLink('https://facebook.com/'+user, user, "FB", alt);
            case "furaffinity": return titleFaviconLink('https://www.furaffinity.net/user/'+user, user, type, alt);
            case "fansly":      return titleFaviconLink('https://fans.ly/'+user, user, "Fansly", alt);
            case "hentai-foundry": return titleFaviconLink(siteUserUrl(type, user), user, "HentaiFoundry", alt);
            case "instagram":   return titleFaviconLink('https://instagram.com/'+user, user, "IG", alt);
            case "onlyfans":    return titleFaviconLink('https://onlyfans.com/'+user, user, "OnlyFans", alt);
            case "patreon":     return titleFaviconLink('https://patreon.com/'+user, user, "Patreon", alt);
            case "reddit":      return titleRLink(localUserUrl(type, user), 'u/'+user, alt);
            case "snapchat":    return titleFaviconLink('https://snapchat.com/add/'+user, user, "Snap", alt);
            case "telegram":    return titleFaviconLink('https://t.me/'+user, user, "Telegram", alt);
            case "tiktok":      return titleFaviconLink('https://tiktok.com/@'+user, user, "TikTok", alt);
            case "tumblr":      return $('<span />').html(tumblrLink(user, type, alt)).html(); // @@
            case "twitch":      return titleFaviconLink('https://twitch.tv/'+user, user, "Twitch", alt);
            case "twitter":     return titleFaviconLink('https://twitter.com/'+user+((status) ?"/status/"+status :""), user+((status) ?"/"+status :""), "Twitter", alt);
            case "vsco":        return titleFaviconLink('https://vsco.co/'+user, user, "VSCO", alt);
            }
            throw "Unknown Social Type: "+type;
        }
    };

    var sitePhotoUrl = function(type, shortid) {
        switch (type) {
        case 'gfycat':  return 'https://gfycat.com/'+shortid;
        case 'redgifs': return 'https://www.redgifs.com/watch/'+shortid.toLowerCase();
        case 'imgur':   return 'https://imgur.com/'+shortid;
        }
        throw "Unknown Site type: "+type;
    };

    var siteUserId = function(type, user) {
        if (rp.user.name2id[type] && rp.user.name2id[type][user])
            return rp.user.name2id[type][user];
        return user;
    };

    var siteUserName = function(type, id) {
        if (rp.user.id2name[type] && rp.user.id2name[type][id])
            return rp.user.id2name[type][id];
        return id;
    };

    var cacheSiteUser = function(type, name, id) {
        if (!type || !name || !id || name == id)
            return;
        if (!rp.user.id2name[type])
            rp.user.id2name[type] = {};
        rp.user.id2name[type][id] = name;
        if (!rp.user.name2id[type])
            rp.user.name2id[type] = {};
        rp.user.name2id[type][name] = id;
        setConfig(configNames.user, rp.user.id2name);
    };

    var siteUserUrl = function(type, user) {
        switch(type) {
        case 'danbooru':
        case 'e621':    return siteTagUrl(type, user);
        case 'flickr':  return 'https://flickr.com/photos/'+siteUserId(type, user);
        case 'gfycat':  return 'https://gfycat.com/@'+user;
        case 'imgur':   return 'https://imgur.com/user/'+user;
        case 'redgifs': return 'https://www.redgifs.com/users/'+user;
        case 'hentai-foundry': return 'https://www.hentai-foundry.com/user/'+user;
        }
        throw "Unknown Site type: "+type;
    };

    var siteSearchUrl = function(type, text, sort) {
        switch (type) {
        case 'danbooru': return siteTagUrl(type, text);
        case 'flickr': return 'https://flickr.com/search?safe_search=3&view_all=1&text='+text+((sort) ?'&sort='+sort :'');
        case 'gfycat': return 'https://gfycat.com/gifs/search/'+text.toLowerCase().replaceAll(" ", "+");
        case 'reddit': return rp.reddit.base+'/search/?q='+text+((sort) ?'&sort='+sort :'');
        }
        throw "Unknown Site type: "+type;
    }

    var localUserUrl = function(type, user) {
        if (type == "reddit")
            return "/user/"+user+"/submitted";
        return "/"+type+"/u/"+user;
    };

    // Sites that are locally browseable (c.f. localUserUrl, siteUserUrl)
    // site == rp.photo[x].site
    var siteUserLink = function(site, alt) {
        var users = (site.users) ?site.users :[ site.user ];
        var ret = $("<span />");
        for (var name of users) {
            var username = siteUserName(site.t, name);
            if (!username)
                continue;
            var userlink = siteUserUrl(site.t, name);
            if (site.t == 'redgifs')
                // CORS
                ret.append(titleFaviconLink(userlink, username, site.t, alt));
            else
                ret.append(localLink(userlink, username, localUserUrl(site.t, username), alt));
        }
        return ret;
    };

    var siteTagUrl = function(type, tag) {
        switch(type) {
        case 'danbooru': return 'https://danbooru.donmai.us/posts?tags='+tag.replace(/ /g, '_');
        case 'e621':     return 'https://e621.net/posts?tags='+tag.replace(/ /g, '_');
        case 'gfycat':   return siteSearchUrl(type, tag);
        case 'redgifs':  return 'https://www.redgifs.com/browse?tags='+tag;
        case 'imgur':    return 'https://imgur.com/t/'+tag;
        case 'flickr':   return 'https://www.flickr.com/photos/tags/'+tag.toLowerCase().replaceAll(" ", "");
        }
        throw "Unknown Site type: "+type;
    };

    var siteTagLink = function(type, otag) {
        var tag = encodeURIComponent(otag);
        // @@ add [+]/[-]
        return localLinkS(siteTagUrl(type, tag), siteTagDisplay(type, otag), '/'+type+'/t/'+tag);
    };

    var siteTagDisplay = function(type, otag) {
        return otag.replace(/_/g, ' ');
    }

    var tumblrLink = function(blog, alt) {
        return _localLink('https://'+blog+'.tumblr.com', '/tumblr/'+blog, blog, (alt || blog), rp.favicons.tumblr).html();
    };

    var googleIcon = function(icon_name) {
        return $('<i>', { class: 'material-symbols-rounded' }).text(icon_name);
    };

    var playButton = function(cb) {
        var lem = $('<a>', { title: 'Play Video (Enter)', href: '#' }).html(googleIcon('play_circle'));
        lem.click(function (event) {
            stopEvent(event);
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
        if (link === undefined || link.attributes.href.value == "#")
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
        return hostname.toLowerCase();
    };
    rp.fn.hostnameOf = hostnameOf;

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
    rp.fn.searchOf = searchOf;

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
        if (shortid.includes('.'))
            shortid = shortid.substr(0, shortid.lastIndexOf('.'));

        if (sep !== undefined && shortid.includes(sep)) {
            if (after)
                // Trim down chafe-chafe-chafe<SEP><SHORTID>
                shortid = shortid.substr(shortid.lastIndexOf(sep)+sep.length);
            else
                // Trim <SHORTID><SEP>chafe-chafe<sep>chafe
                shortid = shortid.substr(0, shortid.indexOf(sep));
        }

        if (!shortid)
            throw("No shortid for url");

        return shortid;
    };
    rp.fn.url2shortid = url2shortid;

    var isGoodExtension = function (url, arr) {
        var extension;
        if (url.includes('.'))
            extension = extensionOf(url).toLowerCase();
        else
            extension = url.toLowerCase();
        if (extension && arr.includes(extension))
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

    var picExtraLinks = function(pic) {
        var ret = $("<span />");
        for (var src of pic.elinks) {
            ret.append(remoteLink(src[1], src[0]));
        }
        return ret;
    };

    // **************************************************************
    // rp.dedup Helper functions
    //

    /// Add link (defaults to SELF), returns previous value
    var dedupArrAdd = function(arr, sub, id, link)  {
        if (!link)
            link = "SELF";
        if (!arr[sub])
            arr[sub] = {};
        var old = arr[sub][id];
        if (!old)
            arr[sub][id] = link;
        return old;
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
    var closeCollapser = function(item) {
        if (item.data(STATE) != "closed")
            item.click();
    };

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

    $('.parentCloser').click(function () {
        $(this).parent().hide();
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
        var attr, title;
        var verb = item.data('verb');
        switch (state) {
        case rp.ALWAYS:
            attr = "icon-always";
            title = "Always "+verb;
            break;
        case rp.SOMETIMES:
            attr = "icon-sometimes";
            title = "Sometimes "+verb;
            break;
        case rp.NEVER:
            attr = "icon-never";
            title = "Never "+verb;
            break;
        }
        item.val(item.attr(attr));
        item.prop("title", title);
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
        var photo = getCurrentPic();
        if (photo.eL)
            $('#navboxExtraLoad').html(googleIcon("check_box")).attr('title', "Extras Already Loaded");
        else if (!photo.commentN &&
                 !(photo.dupes && photo.dupes.reduce(function(a, dupe) { return a + ((dupe.commentN) ?dupe.commentN :0)}, 0)))
            $('#navboxExtraLoad').html(googleIcon("comments_disabled")).attr('title', 'No Comments Available (e)');
        else
            $('#navboxExtraLoad').html(googleIcon("more")).attr('title', "Load Extras (e)");
    };

    var updateSelected = function() {
        var i, a, p;
        $('a.selectable').removeClass("selected");
        var arr = [ rpurlbase() ]
        switch (rp.url.site) {
        case "danbooru":
        case "e621": // @@ could do selected on rp.url.type 's'
        case "flickr":
            a = rp.url.sub.split(/[+,]/);
            if (rp.url.type == 't' && a.length > 1) {
                p = ['', rp.url.site, rp.url.type, ''].join("/");
                for (i of a) {
                    arr.push(p+encodeURIComponent(i));
                }
            }
            break;
        case "wp2":
            a = rp.url.multi.split(/[+,]/);
            if (rp.url.type == 't' && a.length > 1) {
                p = ['', rp.url.site, rp.url.sub, rp.url.type, ''].join("/");
                for (i of a) {
                    arr.push(p+encodeURIComponent(i));
                }
            }
        }
        for (i of arr) {
            $('a.selectable[href="'+rp.url.base+i+'"]').addClass("selected");
        }
    };

    var initState = function () {
        rp.wp = getConfig(configNames.wp, rp.defaults.wp);
        rp.insecure = getConfig(configNames.insecure, {});
        rp.blogcache.info = getConfig(configNames.bloginfo, {});
        // build reverse map
        if (rp.blogcache.info && rp.blogcache.info.blogger) {
            var o = Object.entries(rp.blogcache.info.blogger);
            for (var i of o) {
                rp.blogcache.hn2site.blogger[i[1].h] = i[0];
            }
        }
        rp.user.id2name = getConfig(configNames.user, {});
        // Build reverse map
        if (rp.user.id2name)
            for (var site of Object.keys(rp.user.id2name)) {
                rp.user.name2id[site] = {};
                for (var key of Object.keys(rp.user.id2name[site])) {
                    rp.user.name2id[site][ rp.user.id2name[site][key] ] = key;
                }
            }
        rp.faviconcache = getConfig(configNames.favicon, rp.defaults.favicon);
        rp.session.redditRefreshToken = getConfig(configNames.redditRefresh, "");
        var bearer = getConfig(configNames.redditBearer, "");
        var by = getConfig(configNames.redditRefreshBy, 0);
        // old
        clearConfig("blogger");
        setupRedditLogin(bearer, by);

        ["nsfw", "mute"].forEach(function (item) {
            var config = getConfig(configNames[item]);
            var ref = $('#'+item);
            ref.change(function () {
                var id = $(this).attr('id');
                rp.settings[id] = $(this).is(':checked');
                var cl = $(this).data('toggleclass');
                if (cl)
                    $('.'+cl).toggleClass('hidden', !rp.settings[id]);
                setConfig(configNames[id], rp.settings[id]);
            });
            if (config !== undefined)
                rp.settings[item] = config;
            var c = rp.settings[item];

            ref.click();
            if (ref.is(':checked') != c)
                ref.click();
            else
                fixIconToggle.call(ref)
        });
        $('#nsfw').change(function() {
            if ($(this).is(':checked') && rp.session.activeIndex < 0)
                nextAlbumSlide();
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
        $('#timeToNextSlide').keyup(updateTimeToNextSlide);
        $('.prevArrow').click(prevAlbumSlide);
        $('.nextArrow').click(nextAlbumSlide);
        $('#imageSizeToggle').click(function(event) {
            stopEvent(event);
            $('.fullsize,.realsize').toggleClass("fullsize realsize");
        });

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

        $('#subredditForm').on('submit', function (event) {
            stopEvent(event);
            processUrl($('#subredditUrl').val());
            $('#subredditUrl').blur();
        });

        $('form.site-search').on('submit', function (event) {
            stopEvent(event);
            var value = $(event.target).find("input")[0].value;
            if (event.target.dataset.site == "reddit")
                processUrl("/search/"+value);
            else
                processUrl("/"+event.target.dataset.site+"/s/"+value)
        });

        $('.noInput').keyup(stopEvent);

        // Remove elements that require ability to login
        if (hostnameOf(rp.redirect) != window.location.hostname)
            $('.canlogin').remove();

        // OS/Browser Specific
        var ua = navigator.userAgent;
        // iOS
        if (/(iPad|iPhone|iPod)/.test(ua)) {
            var v = ua.match(/OS (\d+)/);
            if (v.length < 2)
                v[1] = 9;

            if (parseInt(v[1], 10) < 10) {
                rp.session.needsPlayButton = true;
                rp.session.regexUnicode = false;
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

            // Hide useless "fullscreen" button on iOS safari
            $('.fullscreen-ctrl').remove();

            // collapse duplicates by default
            closeCollapser($('#duplicatesCollapser'));
            closeCollapser($('#albumCollapser'));

            // New mobile site doesn't work for auth if not logged in
            rp.reddit.loginUrl = 'https://old.reddit.com/api/v1/authorize.compact';

            // Remove :hover on #loginLi, so it only responds to clicks
            $('#loginLi').removeClass('use-hover');

            $(document).on('click', 'a.remote', function (event) {
                stopEvent(event);
                open_in_background($(this));
            });
            // Some embedded sites don't display correctly, so disable by default
            setConfig(configNames.embed, rp.NEVER);
            setTristate($('#embed'), rp.NEVER);

        } else if (/(Android)/.test(ua)) {
            // collapse duplicates by default
            closeCollapser($('#duplicatesCollapser'));
            closeCollapser($('#albumCollapser'));

            // New mobile site doesn't work for auth if not logged in
            rp.reddit.loginUrl = 'https://old.reddit.com/api/v1/authorize.compact';

            // Remove :hover on #loginLi, so it only responds to clicks
            $('#loginLi').removeClass('use-hover');

            $(document).on('click', 'a.remote', function (event) {
                stopEvent(event);
                open_in_background($(this));
            });
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

    var nextPhotoThumb = function(photo) {
        delete photo.thumb;
        if (photo.fb_thumb && photo.fb_thumb.length)
            photo.thumb = photo.fb_thumb.shift();
        if (!photo.thumb && photo.type == imageTypes.thumb) {
            initPhotoFailed(photo);
            return false;
        }
        return !!photo.thumb;
    };

    // push fallback to back of list
    var addPhotoFallback = function(photo, url) {
        if (!url)
            return;
        var urls;
        if (Array.isArray(url))
            urls = url;
        else
            urls = [ url ];
        urls.forEach(function (url) {
            url = fixupUrl(url);
            if (url == photo.url || url == photo.o_url)
                return;
            if (!photo.fallback)
                photo.fallback = [];
            photo.fallback.push(url);
        });
    };

    var nextPhotoFallback = function(photo) {
        if (photo.fallback && photo.fallback.length) {
            photo.url = photo.fallback.shift();
            delete photo.type;
            return true;
        }
        if (photo.type == imageTypes.thumb)
            return nextPhotoThumb(photo);
        initPhotoThumb(photo);
        return (photo.type == imageTypes.thumb);
    }

    var addPhotoExtraLink = function(photo, name, url) {
        if (!name || !url || !url.startsWith('http'))
            return;
        if (!photo.elinks)
            photo.elinks = [];
        photo.elinks.push([ name, url ]);
    };

    var hasPhotoExtraLinks = function(photo) {
        return photo.elinks && photo.elinks.length > 0;
    };

    var addPhotoBlogTags = function(photo, tags) {
        if (tags && tags.length > 0)
            photo.blog.tags = ((photo.blog.tags) ?photo.blog.tags :[]).concat(tags);
    }

    var blogBlogUrl = function(blog) {
        switch (blog.t) {
        case 'tumblr':  return 'https://'+blog.b+'.tumblr.com';
        case 'blogger': return 'https://'+blogHostname(blog);
        case 'wp2':
        case 'wp':
            return 'https://'+blog.b;
        }
        throw "Unknown blog type: "+blog.t;
    };

    var blogTagUrl = function(blog, tag) {
        switch (blog.t) {
        case 'blogger': return blogBlogUrl(blog)+'/search/label/'+tag;
        case 'tumblr': return 'https://www.tumblr.com/tagged/'+tag;
        case 'wp2':
        case 'wp':
            return blogBlogUrl(blog)+'/tag/'+tag;
        }
        throw "Unknown Blog Type: "+blog.t;
    };

    var blogUserInfo = function(blog) {
        if (!rp.blogcache.user[blog.t])
            return undefined;
        return rp.blogcache.user[blog.t][blog.user];
    };

    var blogUserLink = function(blog) {
        var info = blogUserInfo(blog);
        if (!info)
            return "";
        switch (blog.t) {
        case 'blogger':
        case 'tumblr':
        case 'wp':
            return localLink(info.url, info.name, '/'+blog.t+'/'+hostnameOf(info.url));
        }
        throw "Unhandled blog type: "+blog.t;
    };

    var blogTagLink = function(blog, tag) {
        var llink = '/'+blog.t;
        if (['wp', 'wp2', 'blogger'].includes(blog.t))
            llink += '/'+blogHostname(blog);
        var display = blogTag(blog, tag);
        var slug = (blog.t == 'wp2') ?toWPslug(display) :tag;
        return localLinkS(blogTagUrl(blog, tag), blogTag(blog, tag), llink+'/t/'+slug);
    };

    var hasPhotoBlogTags = function(pic) {
        return pic.blog && pic.blog.tags && pic.blog.tags.length > 0;
    };

    var hasPhotoBlogUser = function(pic) {
        return pic.blog && pic.blog.user && false; // @@
    };

    var cacheBlogInfo = function(blog, title, hostname) {
        if (!blog || !blog.b || !blog.t || !(title || hostname))
            return;
        if (!rp.blogcache.info[blog.t])
            rp.blogcache.info[blog.t] = { };
        if (!rp.blogcache.info[blog.t][blog.b])
            rp.blogcache.info[blog.t][blog.b] = { };
        if (title)
            rp.blogcache.info[blog.t][blog.b].n = title;
        if (hostname && hostname != blog.b) {
            if (!rp.blogcache.hn2site[blog.t])
                rp.blogcache.hn2site[blog.t] = {};
            rp.blogcache.info[blog.t][blog.b].h = hostname;
            rp.blogcache.hn2site[blog.t][hostname] = blog.b;
        }
        setConfig(configNames.bloginfo, rp.blogcache.info);
    };

    var cacheBlogUser = function(blog, name, url) {
        if (!blog || !blog.b || !blog.user || !name || !url)
            return;
        if (!rp.blogcache.user[blog.t])
            rp.blogcache.user[blog.t] = { };
        switch (blog.t) {
        case 'blogger':
        case 'tumblr':
        case 'wp':
            rp.blogcache.user[blog.t][blog.user] = { name: name, url: url };
            break;
        default:
            throw "Unhandled blog type: "+blog.t;
        }
    };

    var cacheBlogTag = function(blog, tag, name) {
        if (!blog || !blog.b || !blog.t || !tag || !name || tag == name)
            return;
        if (!rp.blogcache.tags[blog.t])
            rp.blogcache.tags[blog.t] = { };
        if (!rp.blogcache.tags[blog.t][blog.b])
            rp.blogcache.tags[blog.t][blog.b] = { };
        rp.blogcache.tags[blog.t][blog.b][tag] = name;
        if (blog.t == 'wp2') {
            if (!rp.blogcache.wp2tag[blog.b])
                rp.blogcache.wp2tag[blog.b] = {};
            rp.blogcache.wp2tag[blog.b][toWPslug(name)] = tag;
        }
    };

    var hasBlogTitle = function(blog) {
        if (rp.blogcache.info[blog.t] && rp.blogcache.info[blog.t][blog.b])
            return !!rp.blogcache.info[blog.t][blog.b].n;
        return false;
    };

    var blogTitle = function(blog) {
        if (rp.blogcache.info[blog.t] && rp.blogcache.info[blog.t][blog.b])
            return rp.blogcache.info[blog.t][blog.b].n || rp.blogcache.info[blog.t][blog.b].h;
        return blog.b;
    };

    var blogHostname = function(blog) {
        if (rp.blogcache.info[blog.t] && rp.blogcache.info[blog.t][blog.b])
            return rp.blogcache.info[blog.t][blog.b].h || blog.b;
        return blog.b; // @@ ensure .wordpress or whatever?
    };

    var blogTag = function(blog, tag) {
        if (rp.blogcache.tags[blog.t] && rp.blogcache.tags[blog.t][blog.b])
            return rp.blogcache.tags[blog.t][blog.b][tag] || tag;
        return tag;
    };

    var blogTagCount = function(blog) {
        if (rp.blogcache.tags[blog.t] && rp.blogcache.tags[blog.t][blog.b])
            return Object.keys(rp.blogcache.tags[blog.t][blog.b]).length;
        return 0;
    };

    // Return list of tags missing from cache
    var blogTagMissing = function(blog, tags) {
        if (rp.blogcache.tags[blog.t] && rp.blogcache.tags[blog.t][blog.b])
            return tags.filter(function (x) { return (rp.blogcache.tags[blog.t][blog.b][x] == undefined); });
        return tags;
    };

    var blogBlogLink = function(blog, alt) {
        // name do lookup?
        return localLink(blogBlogUrl(blog), blogTitle(blog), '/'+blog.t+'/'+blogHostname(blog), (alt || blog.b));
    };

    // Return tag ID or undefined
    var wp2RevTag = function(hostname, slug) {
        if (!isNaN(parseInt(slug, 10)))
            return slug;
        return (rp.blogcache.wp2tag[hostname]) ?rp.blogcache.wp2tag[hostname][slug] :undefined;
    };

    var refreshBlogTitle = function(blog) {
        if (rp.blogcache.info[blog.t] && rp.blogcache.info[blog.t][blog.b])
            return;
        var jsonUrl;
        var dataType = 'json';
        var handleData;
        var handleError = failedAjaxDone;
        var handleWPdata = function(data) {
            if (data.id && data.id != blog.b)
                log.error("Wordpress ("+blog.t+") id:"+data.id+" does not agree with blog:"+blog.b);
            cacheBlogInfo(blog, data.name || data.description, hostnameOf(data.url || data.home));
            var icon = data.site_icon_url;
            if (!icon)
                icon = (data.icon) ?data.icon.img :undefined;
            if (icon && !rp.faviconcache[blog.b])
                rp.faviconcache[blog.b] = icon;
        };
        switch (blog.t) {
        case 'wp2':
            jsonUrl = 'https://'+blog.b+'/wp-json/';
            handleData = handleWPdata;
            handleError = function() {
                $.ajax({
                    url: jsonUrl+'?_jsonp=?',
                    dataType: 'jsonp',
                    success: handleWPdata,
                    error: failedAjaxDone,
                    timeout: rp.settings.ajaxTimeout,
                    crossDomain: true
                });
            };
            break;
        case 'wp':
            jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+blog.b;
            handleData = handleWPdata;
            break;
        default:
            return;
        }
        $.ajax({
            url: jsonUrl,
            dataType: dataType,
            success: handleData,
            error: handleError,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var hasPhotoSiteUser = function(photo) {
        return photo.site && photo.site.users && photo.site.users.length > 0;
    };

    var addPhotoSite = function(photo, type, user) {
        if (!photo.site)
            photo.site = {t: type};
        else if (photo.site.t != type)
            return log.error("Tried to reset site type old:"+photo.site.t+" new:"+type+": "+photo.url);
        addPhotoSiteUser(photo, user);
    }

    var addPhotoSiteTags = function(photo, tags) {
        if (tags && tags.length > 0)
            photo.site.tags = ((photo.site.tags) ?photo.site.tags :[]).concat(tags.filter(Boolean));
    };

    var addPhotoSiteUser = function(photo, user) {
        if (!user || (photo.site.t == 'gfycat' && user == 'anonymous'))
            return;
        photo.site.users = ((photo.site.users) ?photo.site.users :[]).concat((Array.isArray(user)) ?user :[user]);
    };

    var hasPhotoSiteTags = function(pic) {
        return pic.site && pic.site.tags && pic.site.tags.length > 0;
    }

    var initPhotoImage = function(photo, url) {
        photo.type = imageTypes.image;
        if (url)
            photo.url = url;
        fixPhotoButton(photo);
    };

    var initPhotoThumb = function(photo) {
        if (photo.thumb) {
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

    var initPhotoEmbed = function(photo, url, autoplay) {
        if (autoplay === undefined)
            autoplay = true;
        photo.type = imageTypes.embed;
        if (url)
            photo.url = url;
        photo.embed = { aplay: autoplay };
        fixPhotoButton(photo);
    };

    var initPhotoYoutube = function(photo, shortid, startat) {
        addPhotoThumb(photo, 'https://i.ytimg.com/vi/'+shortid+'/hqdefault.jpg');
        addPhotoThumb(photo, 'https://i.ytimg.com/vi/'+shortid+'/maxresdefault.jpg');
        initPhotoEmbed(photo, youtubeURL(shortid, startat), true);
    };

    // Return index of inserted duplicate, or -1 if not
    var addPhotoDupe = function(photo, dupe) {
        if (photo.id == dupe.id &&
            photo.subreddit == dupe.subreddit &&
            // @@
            ((photo.blog) ?photo.blog.b :undefined) == dupe.tumblr)
            return -1;
        if (!photo.dupes)
            photo.dupes = [];
        var i;
        for (i = 0; i < photo.dupes.length; ++i) {
            if (photo.dupes[i].id == dupe.id &&
                photo.dupes[i].subreddit == dupe.subreddit &&
                photo.dupes[i].tumblr == dupe.tumblr)
                return -1;
            if (subredditCompare(photo.dupes[i], dupe) > 0)
                break;
        }

        photo.dupes.splice(i, 0, dupe);
        return i;
    };

    var addVideoUrl = function(photo, type, url) {
        if (!photo.url)
            photo.url = url;
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
            if (!extension)
                extension = isVideoExtension(searchValueOf(url, 'format'));
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
        else if (photo.type == imageTypes.album)
            return (rp.session.activeAlbumIndex == photo.album.indexOf(pic));
        else
            return isActive(photo);
    };

    // re-index Album elements starting from index
    var reindexPhotoAlbum = function(photo, index) {
        if (index === undefined)
            index = 0;

        if (!isActive(photo))
            return;

        for (var i = index; i < photo.album.length; ++i) {
            var a = $('#albumNumberButtons ul').children(":nth-child("+(i+1)+")").children("a");
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
        for (var key of keys) {
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

                for (var key of ["embed", "video", "html", "extra", "site"]) {
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
                    initPhotoThumb(img);
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
            $('#navboxImageSearch').attr('href', 'https://lens.google.com/uploadbyurl?url='+image.url).show();
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

        } else if (!isActive(parent) || (parent.type != imageTypes.album))
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

        var shortid, a, i, o, host;
        var fqdn = hostnameOf(pic.url);
        // hostname only: second-level-domain.tld
        var hostname = hostnameOf(pic.url, true);
        var orig_hn = hostnameOf(pic.o_url, true);

        try {
            // Return if already setup
            switch (pic.type) {
            case imageTypes.fail:
                return false;
            case imageTypes.album:
                return (pic.album !== undefined);
            case imageTypes.video:
                return (pic.video !== undefined);
            case imageTypes.html:
                return (pic.html !== undefined);
            case imageTypes.thumb:
                if (orig_hn == 'dropbox.com' ||
                    orig_hn == 'onlyfans.com' ||
                    orig_hn == 'tumblr.com')
                    throw "REJECTED";
                return (pic.thumb !== undefined);
            case imageTypes.later:
            case imageTypes.embed:
            case imageTypes.image:
                return true;
            }

            if (!pic.url.startsWith('http'))
                throw "bad schema in URL";

            if (hostname == 'imgur.com') {
                pic.url = fixImgurPicUrl(pic.url);
                a = extensionOf(pic.url);
                shortid = url2shortid(pic.url);
                if (pic.url.includes("/a/") ||
                    pic.url.includes('/gallery/') > 0)
                    pic.type = imageTypes.later;

                else if (isVideoExtension(pic.url)) {
                    initPhotoVideo(pic);
                    pic.url = sitePhotoUrl('imgur', shortid);

                } else if (!a) {
                    pic.url = sitePhotoUrl('imgur', shortid);
                    pic.type = imageTypes.later;

                } else if (a == 'gif') {
                    // catch imgur.com/SHORTID.mp4.gif
                    a = pic.url.substr(0, pic.url.lastIndexOf('.'));
                    if (isVideoExtension(a)) {
                        initPhotoVideo(pic, a);
                        pic.url = sitePhotoUrl('imgur', shortid);
                    } else {
                        pic.url = sitePhotoUrl('imgur', shortid);
                        pic.type = imageTypes.later;
                    }

                } else
                    initPhotoImage(pic)

            } else if (hostname == 'gifs.com') {
                shortid = url2shortid(pic.url, -1, '-');
                pic.url = 'https://gifs.com/gif/'+shortid;
                initPhotoVideo(pic, [ 'https://j.gifs.com/'+shortid+'@large.mp4',
                                      'https://j.gifs.com/'+shortid+'.mp4' ],
                               'https://j.gifs.com/'+shortid+'.jpg');

            } else if (hostname == 'giphy.com' && fqdn != 'ephmedia.giphy.com') {
                // giphy.com/gifs/NAME-OF-VIDEO-SHORTID
                // media.giphy.com/media/SHORTID/giphy.TYPE
                // i.giphy.com/SHORTID.TYPE
                // ephmedia.giphy.com/UUID.gif - ephemeral image url
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

            } else if (hostname == 'redgifs.com') {
                // redgifs enabled CORS - 2022-04-25
                a = pathnameOf(pic.url).split('/');
                if (['ifr', 'watch'].includes(a[1])) {
                    // this DOES autoplay, but it's muted
                    shortid = a[2];
                    initPhotoEmbed(pic, 'https://redgifs.com/ifr/'+shortid, false);
                } else if (a[1] == 'i') {
                    // Use OEmbed
                    shortid = url2shortid(pic.url);
                    pic.url = sitePhotoUrl("redgifs", shortid);
                    pic.type = imageTypes.later;
                } else
                    throw "bad path";

            } else if (hostname == 'gfycat.com' ||
                       hostname == 'gifdeliverynetwork.com') {
                //if (a[2] != 'collections') {
                // @@ needs bearer token
                shortid = url2shortid(pic.url, -1, '-', false);
                hostname = 'gfycat.com';
                if (shortid == 'about')
                    throw "bad url";
                pic.url = sitePhotoUrl('gfycat', shortid);
                pic.type = imageTypes.later;

            } else if (hostname == 'clippituser.tv' ||
                       hostname == 'clippit.tv') {
                hostname = 'clippit.tv';
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

            } else if (hostname == "streamtape.com") {
                // url may end in video extension
                shortid = url2shortid(pic.url, 2);
                initPhotoEmbed(pic, originOf(pic.url)+"/e/"+shortid+"/", false)

            } else if (isVideoExtension(pic.url)) { // #### VIDEO ####
                initPhotoVideo(pic);

            } else if (fqdn == 'preview.redd.it') {
                initPhotoImage(pic, 'https://i.redd.it'+pathnameOf(pic.url));

            } else if (hostname == 'vidble.com') {
                shortid = url2shortid(pic.url);
                if (shortid == 'watch') {
                    shortid = searchValueOf(pic.url, 'v');
                    if (!shortid)
                        throw("Failed to parse vidble url");
                    initPhotoVideo(pic, 'https://www.vidble.com/'+shortid+'.mp4',
                                   'https://www.vidble.com/'+shortid+'.png');

                } else if (pic.url.includes("/album/"))
                    // @@TODO : figure out /album/ on vidble.com/api
                    throw("NYI: vidble album processing");

                else {
                    shortid = shortid.replace(/_.+/, '');
                    initPhotoImage(pic, 'https://www.vidble.com/'+shortid+'.jpg');
                }

            } else if (isImageExtension(pic.url) || // #### IMAGE ####
                       fqdn == 'blogger.googleusercontent.com' ||
                       fqdn == 'i.reddituploads.com') {
                // Remove query string from certain domains
                if (hostname == 'wordpress.com' ||
                    hostname == 'wp.com' ||
                    hostname == 'hotnessrater.com')
                    pic.url = originOf(pic.url)+pathnameOf(pic.url);
                // Bad domains
                else if (fqdn == "imagehaha.com")
                    throw "bad host"
                if (hostname == 'redd.it')
                    shortid = url2shortid(pic.url);
                initPhotoImage(pic);

                // ###################### //

            } else if (hostname == 'apnews.com' ||
                       hostname == 'livestream.com' ||
                       hostname == 'streamable.com' ||
                       hostname == 'wordpress.com') {
                if (url2shortid(pic.url))
                    // These domains should always be processed later
                    pic.type = imageTypes.later;

            } else if (hostname == 'asianpornmovies.com' ||
                       hostname == 'yespornplease.sexy') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] != "embed" && a[1] != "video")
                    throw "unknown url"
                shortid = url2shortid(pic.url, -1, '-');
                initPhotoEmbed(pic, originOf(pic.url)+"/embed/"+shortid, false);

            } else if (hostname == 'biguz.net') {
                shortid = searchValueOf(pic.url, 'id');
                if (shortid)
                    initPhotoEmbed(pic, originOf(pic.url)+"/embed.php?id="+shortid, false);
                else
                    throw "unknown url";

            } else if (hostname == 'blogspot.com' ||
                       fqdn.match(/\bblogspot\.[\w.]+/)) {
                if (pathnameOf(pic.url).endsWith('.html')) {
                    pic.url = pic.url.replace(/blogspot\.[.\w]+/, "blogspot.com");
                    pic.type = imageTypes.later;
                    shortid = url2shortid(pic.url);
                    hostname = hostnameOf(pic.url);
                } else
                    throw "bad blogspot url";

            } else if (hostname == 'blogger.com') {
                a = pathnameOf(pic.url);
                if (a.startsWith('/video.g'))
                    initPhotoEmbed(pic, pic.url, false);
                else if (a.includes('/blog/post/')) {
                    a = a.split('/');
                    if (isNaN(parseInt(a.pop(), 10)))
                        throw "Blogger bad postid";
                    if (isNaN(parseInt(a.pop(), 10)))
                        throw "Blogger bad blogid";
                    pic.type = imageTypes.later;
                    shortid = url2shortid(pic.url);
                    hostname = fqdn;
                } else if (a.endsWith('post-interstitial.g') ||
                         a.endsWith('blogin.g')) {
                    a = decodeURIComponent(searchValueOf(pic.url, "blogspotURL"));
                    if (a && a.endsWith(".html")) {
                        pic.url = a;
                        pic.type = imageTypes.later;
                        shortid = url2shortid(pic.url);
                        hostname = hostnameOf(pic.url);
                    } else
                        throw "unknown blogger interstitial";
                } else
                    throw "unknown blogger url";

            } else if (hostname == 'cbsnews.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'video')
                    initPhotoEmbed(pic, pic.url, false);
                else
                    throw "non-video url";

            } else if (hostname == 'clipchamp.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] != 'watch' || a.length < 3)
                    throw "bad url";
                shortid = a[2];
                initPhotoEmbed(pic, originOf(pic.url)+'/watch/'+shortid+'/embed', false);

            } else if (hostname == 'cnn.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'videos')
                    initPhotoEmbed(pic, 'https://fave.api.cnn.io/v1/fav/?video='+a.slice(2).join("/")+
                                   "&customer=cnn&edition=domestic&env=prod");
                else
                    throw "unknown url";

            } else if (hostname == 'd.tube') {
                a = pathnameOf(pic.url).split('/');
                initPhotoEmbed(pic, 'https://emb.d.tube/#!/'+a.slice(2,4).join('/'), false);

            } else if (hostname == 'donmai.us' ||
                       hostname == 'e621.net') {
                a = pathnameOf(pic.url).split('/');
                shortid = url2shortid(pic.url);
                if (a[1].startsWith('post') && a.length > 2)
                    pic.type = imageTypes.later;
                else
                    throw "unknown url";

            } else if (hostname == 'deviantart.com') {
                a = pathnameOf(pic.url).split('/');
                if (a.length > 0 && (a[1] == "art" || a[2] == "art"))
                    pic.type = imageTypes.later;
                else
                    throw "bad deviantart oembed";

            } else if (hostname == 'dailymotion.com') {
                shortid = url2shortid(pic.url, -1, "_", false);
                o = originOf(pic.url)+'/embed/video/'+shortid+'?autoplay=1';
                a = searchValueOf(pic.url, "start");
                if (a)
                    o += "&start="+a;
                initPhotoEmbed(pic, o);

            } else if (hostname == 'eporner.com') {
                a = pathnameOf(pic.url).replaceAll('//', '/').split('/');
                if (a[1] == "gallery")
                    throw "cannot process gallery";
                if (a[1].startsWith("video-"))
                    shortid = url2shortid(pic.url, 1, '-');
                else
                    shortid = a[2];
                initPhotoEmbed(pic, 'https://www.eporner.com/embed/'+shortid, false);

            } else if (hostname == 'facebook.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'watch' ||
                    a[2] == 'videos')
                    initPhotoEmbed(pic, 'https://www.facebook.com/plugins/video.php?show_text=0&href='+encodeURIComponent(pic.url), false);
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

            } else if (hostname == 'flourish.studio') {
                a = pathnameOf(pic.url).split('/');
                initPhotoEmbed(pic, "https://flo.uri.sh/"+a[1]+"/"+a[2]+"/embed", false);

            } else if (hostname == 'freeuseporn.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'video') {
                    o = originOf(pic.url);
                    shortid = a[2];
                    initPhotoVideo(pic, [
                        o+'/media/videos/h264/'+shortid+'_1080p.mp4',
                        o+'/media/videos/h264/'+shortid+'_720p.mp4',
                        o+'/media/videos/hd/'+shortid+'.mp4',
                        o+'/media/videos/h264/'+shortid+'_480p.mp4',
                        o+'/media/videos/iphone/'+shortid+'.mp4',
                    ], o+'/media/videos/tmb/'+shortid+'/default.jpg');
                } else
                    throw "unknown url";

            } else if (hostname == 'fw.tv') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'videos' ||
                    a[2] == 'videos')
                    initPhotoEmbed(pic);
                else
                    throw "unknown fw.tv url";

            } else if (hostname == 'gettyimages.com') {
                o = pathnameOf(pic.url);
                a = o.split('/');
                if (fqdn == 'media.gettyimages.com') {
                    if (a[1] == 'videos')
                        initPhotoImage(pic, 'https://media.gettyimages.com'+o);
                    else // assume everything else is photo
                        initPhotoImage(pic, 'https://media.gettyimages.com'+o+'?s=2048x2048');

                } else if (a[1] == 'detail') {
                    if (a[a.length-1] == "")
                        a.pop();
                    shortid = a.pop();
                    if (a[2] == 'video')
                        initPhotoVideo(pic, 'https://media.gettyimages.com/videos/'+a.pop()+'-id'+shortid);
                    else // photo
                        initPhotoImage(pic, 'https://media.gettyimages.com/photos/'+a.pop()+'-id'+shortid+'?s=2048x2048');
                } else
                    throw "unknown url";

            } else if (hostname == 'gyazo.com') {
                shortid = url2shortid(pic.url);
                initPhotoImage(pic, 'https://i.gyazo.com/'+shortid+'.png');
                addPhotoFallback(pic, [ 'https://i.gyazo.com/'+shortid+'.jpg',
                                        'https://i.gyazo.com/'+shortid+'.mp4' ]);

            } else if (hostname == 'hotnessrater.com') {
                a = pathnameOf(pic.url).split('/');
                initPhotoImage(pic, "https://img1.hotnessrater.com/"+a[2]+"/"+a[3]+".jpg");

            } else if (hostname == 'hugetits.win') {
                shortid = url2shortid(pic.url, -1, '-', false);
                hostname = 'gfycat.com';
                a = pathnameOf(pic.url).split('/');
                if (a[1] != "video")
                    throw "non-video url";
                pic.url = sitePhotoUrl('gfycat', shortid); // will fallback to redgifs
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
                    initPhotoImage(pic, shortid + ".jpg");
                    addPhotoFallback(pic, shortid + ".png");
                    addPhotoExtraLink(pic, a[3], siteUserUrl('hentai-foundry', a[3]));
                    shortid = a[4];
                } else
                    throw "non-picture";

            } else if (hostname == 'imgchest.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] != 'p')
                    throw "unknown url"
                shortid = a[2];
                pic.type = imageTypes.later;

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
                    addPhotoFallback(pic, 'https://pixeldrain.com/api/file/'+shortid+'/image');
                }

            } else if (hostname == 'playvids.com' ||
                       hostname == 'daftsex.com' ||
                       hostname == 'sendvid.com' ||
                       hostname == 'streamja.com' ||
                       hostname == 'pornflip.com') {
                a = pathnameOf(pic.url).split('/');
                i = 1;
                while (a[i].length == 2 || // language
                       a[i] == "v" ||
                       a[i] == "video")
                    ++i;
                if (i < a.length)
                    shortid = a[i];
                else
                    throw "bad url"
                initPhotoEmbed(pic, originOf(pic.url)+"/embed/"+shortid, false);

            } else if (hostname == 'pornhits.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] != 'video')
                    throw "Unknown url";
                initPhotoEmbed(pic, originOf(pic.url)+"/embed.php?autoplay=1&id="+a[2]);

            } else if (hostname == 'pornhub.com') {
                // JSON Info about video
                // 'https://www.pornhub.com/webmasters/video_by_id?id='+shortid
                a = searchOf(pic.url);
                shortid = a.viewkey;
                if (a.pkey)
                    addPhotoExtraLink(pic, "Playlist", 'https://www.pornhub.com/playlist/'+a.pkey);
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

            } else if (hostname == 'spankbang.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'embed')
                    shortid = a[2];
                else if (a[2] == 'video')
                    shortid = a[1];
                else
                    throw "unknown url";

                initPhotoEmbed(pic, 'https://spankbang.com/embed/'+shortid, false);

            } else if (hostname == 'streamff.com') {
                shortid = url2shortid(pic.url);
                initPhotoVideo(pic, 'https://streamff.com/uploads/'+shortid+'.mp4?autoplay=true&loop=true');

            } else if (hostname == 'streamvi.com') {
                shortid = url2shortid(pic.url);
                initPhotoVideo(pic, 'https://cdnvistreamviz.r.worldssl.net/uploads/'+shortid+'.mp4',
                               'https://cdn.streamvi.com/uploads/'+shortid+'.jpg');

            } else if (hostname == 'sunporno.com' ||
                       hostname == 'sunporno2.com') {
                shortid = url2shortid(pic.url, 2);
                initPhotoEmbed(pic, 'https://embeds.sunporno.com/embed/'+shortid, false);

            } else if (hostname == "theasteris.com") {
                shortid = searchValueOf(pic.url, "vid");
                if (!shortid)
                    throw "bad url";
                initPhotoEmbed(pic, "https://theasteris.com/embed.php?vid="+shortid, false);

            } else if (hostname == "tiktok.com") {
                a = pathnameOf(pic.url).split('/');
                if (a[2] == "video" && a[3] !== undefined) {
                    pic.type = imageTypes.later;
                    var data = $("<div />");
                    data.append($("<blockquote >",
                                  { "class": "tiktok-embed",
                                    cite: pic.url,
                                    "data-video-id": a[3] })
                                .append($("<section>")));
                    data.append('<script async src="https://www.tiktok.com/embed.js"></script>');
                    initPhotoHtml(pic, data.html())
                } else if (a[1] == 'v' && a[2] !== undefined)
                    pic.type = imageTypes.later;
                else
                    return false;

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
                a = pathnameOf(pic.url).split('/');
                if (pic.url.endsWith('.gifv'))
                    initPhotoVideo(pic, pic.url.replace(/gifv$/, "mp4"));
                else if (pic.url.endsWith('.pnj'))
                    initPhotoImage(pic, pic.url.replace(/pnj$/, "jpg"));
                else if (a.length > 2 &&
                         (!isNaN(parseInt(a[2], 10)) ||
                          (a[1] == 'blog' && a.length > 4 && !isNaN(parseInt(a[4], 10)))))
                    // BLOGNAME.tumblr.com/post/POSTID/...
                    // www.tumblr.com/BLOGNAME/POSTID[...]
                    // www.tumblr.com/blog/view/BLOGNAME/POSTID
                    pic.type = imageTypes.later;
                else
                    throw "unknown url";

            } else if (hostname == 'twitch.tv') {
                try {
                    shortid = url2shortid(pic.url);
                } catch (e) {}

                a = searchOf(pic.url);
                host = window.location.host;

                if (!host)
                    throw "twitch needs an embedding fqdn";
                if (window.location.protocol != 'https:')
                    throw "twitch needs embedding url to be https://";

                if (fqdn == 'clips.twitch.tv' && shortid)
                    a.clip = shortid;
                else if (fqdn == 'www.twitch.tv' && shortid)
                    a.clip = shortid;

                if (a.clip) {
                    shortid = a.clip;
                    initPhotoEmbed(pic, 'https://clips.twitch.tv/embed?autoplay=true&parent='+host+'&clip='+a.clip);
                } else if (a.video) {
                    shortid = a.video;
                    initPhotoEmbed(pic, 'https://player.twitch.tv/?autoplay=true&parent='+host+'&video='+a.video);
                } else
                    throw "unknown twitch url";

            } else if (hostname == 'twitter.com' ||
                       hostname == 'x.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[2] == "status") {
                    pic.url = 'https://twitter.com/'+a.slice(1,4).join("/");
                    pic.type = imageTypes.later;
                } else
                    throw "unknown twitter url";

            } else if (hostname == 'videobin.co' ||
                       hostname == 'vidoza.net' ||
                       hostname == 'yodbox.com') {
                shortid = url2shortid(pic.url, 1, '-');
                initPhotoEmbed(pic, originOf(pic.url)+"/embed-"+shortid+".html", false);

            } else if (hostname == 'vimeo.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, 'https://player.vimeo.com/video/'+shortid+'?autoplay=1');

            } else if (hostname == 'wp.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == "latex.php")
                    initPhotoImage(pic);
                else
                    pic.type = imageTypes.later;

            } else if (hostname == 'worldsex.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, originOf(pic.url)+'/videos/embed/'+shortid, false);

            } else if (hostname == 'worldstarhiphop.com') {
                a = pathnameOf(pic.url).split('/');
                if (a[1] == 'embed')
                    initPhotoEmbed(pic, pic.url, false);
                else
                    throw "bad url";

            } else if (hostname == 'xtube.com') {
                shortid = url2shortid(pic.url);
                initPhotoEmbed(pic, 'https://www.xtube.com/video-watch/embedded/'+shortid+'?embedsize=big', false);

            } else if (hostname == 'xvideos.com') {
                shortid = url2shortid(pic.url, 1, 'video');
                if (isNaN(parseInt(shortid, 10)))
                    throw "bad video link";
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
                else if (shortid == 'redirect')
                    throw "bad video link";
                initPhotoYoutube(pic, shortid, a.t || a.start);

            } else if (hostname == 'youjizz.com') {
                shortid = url2shortid(pic.url, 2, '-');
                initPhotoEmbed(pic, originOf(pic.url)+'/videos/embed/'+shortid, false);

            } else if (rp.wp[fqdn]) {
                shortid = url2shortid(pic.url);
                if (extensionOf(shortid))
                    throw("bad wpv2 url - extension");
                pic.type = imageTypes.later;

            } else if (pic.type == imageTypes.thumb)
                throw("bad thumb");

            else {
                var path = pathnameOf(pic.url);
                a = path.split('/');
                if (a.length > 2 &&
                    (a[1] == 'video' ||
                     a[1] == 'videos' ||
                     a[1] == 'watch' ||
                     a[1] == 'view' ||
                     a[1] == 'v')) {
                    // Sites that definitely don't work with above
                    if (['bing.com',
                         'analhorny.com',
                         'camwhores.film',
                         'camwhores.tube',
                         'cc.com',
                         'fodder.gg',
                         'fite.tv',
                         'furaffinity.net',
                         'gifscroll.com',
                         'gothdporn.com',
                         'hdpornz.biz',
                         'hog.mobi',
                         'hog.tv',
                         'iceporn.tv',
                         'javtiful.com',
                         'madnsfw.com',
                         'mulemax.com',
                         'noodlemagazine.com',
                         'pixabay.com',
                         'pornloupe.com', // embed is SAMEORIGIN
                         'pornzog.com',
                         'tiktits.com',
                         'watchmygf.me',
                         'xfantasy.com',
                         'xfantazy.com',
                         'xfantasy.tv',
                         'xhamster.com' // only paid embeds
                        ].includes(hostname))
                        throw "no embed";
                    shortid = url2shortid(pic.url, 2, '-');
                    var href = $('<a>').attr('href', pic.url);
                    if (href.prop('hostname').startsWith('m.'))
                        href.prop('hostname', href.prop('hostname').replace('m.', 'www.'));

                    // Sistes that do work w/o autoplay
                    if (hostname == 'bigfuck.tv' ||
                        hostname == 'nonktube.com' ||
                        hostname == 'theporngod.com' ||
                        hostname == 'vrbangers.com' ||
                        hostname == 'youporn.com' ||
                        hostname == 'xxxbox.me')
                        initPhotoEmbed(pic, href.prop('origin')+'/embed/'+shortid, false);

                    else if (shortid.match(/^\d+$/)) {
                        initPhotoEmbed(pic, href.prop('origin')+'/embed/'+shortid+'?autoplay=1');
                        log.info("AUTOGENERATE embed ["+pic.o_url+"]: "+pic.url);

                    } else {
                        shortid = url2shortid(pic.url, 2);
                        initPhotoEmbed(pic, href.prop('origin')+'/embed/'+shortid+'?autoplay=1&muted=true&originalSize=true&startWithHD=true');
                        log.info("AUTOGENERATE embed ["+pic.o_url+"]: "+pic.url);
                    }
                    return true;

                } else if (a[1] == 'embed') {
                    log.info("AUTO embed: "+pic.url);
                    initPhotoEmbed(pic);

                } else if (rp.wp[fqdn] === undefined) {
                    shortid = url2shortid(pic.url);
                    var re1, re2;
                    if (rp.session.regexUnicode) {
                        re1 = /^(?:\/index.php)?\/(?:\d+\/){3}([\w\p{N}\p{L}]+(?:-[\w\p{N}\p{L}]+)*)\/$/u;
                        re2 = /^\/(?:\w+\/)?[\w\p{N}\p{L}]+(?:-[\w\p{N}\p{L}]+)+\/?$/u;
                    } else {
                        re1 = /^(?:\/index.php)?\/(?:\d+\/){3}([\w]+(?:-[\w]+)*)\/$/;
                        re2 = /^\/(?:\w+\/)?[\w]+(?:-[\w]+)+\/?$/;
                    }
                    if (path.match(re1))
                        rp.wp[fqdn] = 1;
                    if (path.match(re2) && !extensionOf(pic.url))
                        rp.wp[fqdn] = 2;
                    if (rp.wp[fqdn]) {
                        log.info("ATTEMPT wordpress v"+rp.wp[fqdn]+": "+pic.url);
                        pic.type = imageTypes.later;
                        return true;
                    }
                }
                throw "unknown host";
            }
            if (shortid && hostname && pic.subreddit && pic.id) {
                var link = ['', 'r', pic.subreddit, pic.id].join('/');
                var val = dedupAdd(hostname, shortid, link);
                if (val) {
                    log.info("cannot display url [duplicate: "+val+"]: "+pic.url);
                    return false;
                }
            }
        } catch (e) {
            var url = pic.url;
            if (nextPhotoFallback(pic))
                return processPhoto(pic);

            if (pic.type == imageTypes.fail) {
                log.info("cannot display url ["+e+"]: "+url);
                return false;
            }
            log.info("Fallback to thumbnail: "+pic.o_url);
        }
        if (pic.type === undefined)
            throw "Failed to set pic type: "+pic.url;
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
                                        "click": function () {startAnimation($(this).data("index"));},
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

    var fixFavicon = function(e) {
        if (e.type == "error" ||
            this.naturalHeight <= 1 ||
            this.naturalWidth <= 1) {

            var backup = $(this).prop("backup") || [];
            if (backup.length > 0) {
                var origin = backup.shift();
                $(this).prop("backup", backup);
                $(this).prop("src", origin);

            } else {
                if ($(this).prop("hn")) {
                    rp.faviconcache[$(this).prop("hn")] = "";
                    setConfig(configNames.favicon, rp.faviconcache);
                }
                $(this).parent().html(googleIcon("link"));
            }

        } else if ($(this).prop("hn")) {
            rp.faviconcache[$(this).prop("hn")] = $(this).attr('src');
            setConfig(configNames.favicon, rp.faviconcache);
        }
    };

    var setFavicon = function(elem, url, special) {
        if (url === undefined)
            throw "setFavicon() called with empty url";

        // ## "reddit" is special
        if (special === "reddit") {
            elem.html($("<img />", {'class': 'favicon reddit', src: rp.url.root+'images/reddit.svg'}));
            return;
        }

        var fav = rp.favicons[special];

        // ## rp.favicons[]
        if (fav === undefined) {
            var sld = hostnameOf(url, true).match(/[^.]*/)[0];
            fav = rp.favicons[sld];
            if (fav && fav.startsWith('images/'))
                fav = rp.url.root+fav;
        }

        // ## rp.faviconcache
        var hostname = hostnameOf(url);
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

        // ## try //site/favicon.ico
        var origin = originOf(url);
        var img = $("<img />", {'class': 'favicon', src: fixupUrl(origin+'/favicon.ico')});

        // ##a try originOf(pic.url)/favicon.ico (if different from pic.o_url)
        // ##b try sld-only hostname of url
        // #FINAL fallback to just link icon
        var backup = [fixupUrl(origin+'/favicon.png'),
                      fixupUrl(origin+'/images/favicon.png'),
                      fixupUrl(origin+'/favicon-16x16.png'),
                      fixupUrl(origin+'/assets/img/favicon.ico')
                     ];
        var a = hostname.split('.');
        while (a.length > 2) {
            a.shift();
            var hn = a.join('.');
            if (rp.faviconcache[hn]) {
                backup.push(rp.faviconcache[hn]);
                break;
            }
            backup.push(fixupUrl(origin.replace(hostname, hn)+'/favicon.ico'));
            backup.push(fixupUrl(origin.replace(hostname, hn)+'/favicon.png'));
            backup.push(fixupUrl(origin.replace(hostname, hn)+'/favicon-16x16.png'));
        }
        // #4c check if wordpress v2 site
        if (rp.wp[hostname])
            backup.push(rp.favicons.wordpress);

        img.prop('hn', hostname);
        img.prop('backup', backup);
        // these don't bubble so must be set here
        img.on('error', fixFavicon);
        img.on('load',  fixFavicon);

        elem.html(img);
    };

    var setSubredditLink = function(url, type) {
        var link = $('#subredditLink');
        link.prop('href', url).show();
        setFavicon(link, url, type);
    };

    // Check if data is present and current
    var checkRedditMultiCache = function(user) {
        return (user &&
                rp.redditcache.multi[user] &&
                rp.redditcache.multi[user].date+rp.settings.multiExpire > currentTime());
    };

    // Check if data is present and current
    var checkRedditSubCache = function(name) {
        var sub = name.toLowerCase();
        return (sub &&
                rp.redditcache.sub[sub] &&
                rp.redditcache.sub[sub].date+rp.settings.multiExpire > currentTime());
    };

    var _updateRedditCache = function(key, data, type) {
        var now = currentTime();
        if (rp.redditcache[type][key] &&
            rp.redditcache[type][key].date + rp.settings.multiExpire > now)
            return;
        rp.redditcache[type][key] = { date: now, data: data };
    };

    var updateRedditMultiCache = function(user, data) {
        if (!user)
            return;
        _updateRedditCache(user, data, "multi");
    };

    var updateRedditSubCache = function(t5) {
        _updateRedditCache(t5.display_name.toLowerCase(), t5, "sub");
    };

    // Register keyboard events on the whole document
    $(document).keyup(function (e) {
        if (e.ctrlKey || e.altKey || e.metaKey) {
            // ctrl key is pressed so we're most likely switching tabs
            // or doing something unrelated to redditp UI
            return;
        }

        var i = 0;

        switch (e.key.toLowerCase()) {
        case "a":
            open_in_background("#navboxAlbumOrigLink");
            break;
        case "c":
            $('#controlsCollapser').click();
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
        case "h":
            $('#choice').click();
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
        case "p":
            $('#imageSizeToggle').click();
            break;
        case "r":
            open_in_background("#navboxDuplicatesMulti");
            break;
        case "t":
            $('#titleCollapser').click();
            break;
        case "s":
            open_in_background("#subredditLink");
            break;
        case "u":
            $("#duplicatesCollapser").click();
            break;
        case "v":
            showInfo();
            break;
        case " ": // SPACE
            $("#autoNextSlide").click();
            break;
        case "?":
            showHelp();
            break;
        case "=":
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

    var showHelp = function() {
        if ($('#help').is(':visible') || $('#recommend').is(':visible')) {
            $('#help').hide();
            $('#recommend').hide();
        } else {
            $('#help').show();
            $('#recommend').show();
        }
    };

    var showInfo = function() {
        if ($('#info').is(':visible'))
            return $('#info').hide();
        var pic = getCurrentPic();
        if (!pic)
            return;
        var t = $('#imageInfoTable');
        t.find('tr').hide();

        var hasAudio = function(obj, trueValue) {
            if (obj.webkitAudioDecodedByteCount != undefined)
                return (obj.webkitAudioDecodedByteCount > 0) ?trueValue :0;
            if (obj.mozHasAudio != undefined)
                return (obj.mozHasAudio) ?trueValue :0;
            if (obj.audioTracks != undefined)
                return (obj.audioTracks.length > 0) ?trueValue :0;
            return undefined;
        };

        var i, size = '', length = '', audio;
        switch (pic.type) {
        case imageTypes.thumb:
        case imageTypes.image:
            t.find('tr.forImage').show();
            i = $('#pictureSlider').find('img')[0];
            size = i.naturalWidth + "x" + i.naturalHeight;
            break;
        case imageTypes.video:
            t.find('tr.forVideo').show();
            i = $('#gfyvid')[0];
            size = i.videoWidth + "x" + i.videoHeight;
            length = sec2dms(pic.video.duration);
            if ($('#gfyaudio').length > 0)
                audio = ($('#gfyaudio').children().length > 0) ?2 :0;
            else
                audio = hasAudio(i, 1);
            break;
        }
        $('#imageInfoType').text(imageTypeStyle[pic.type]);
        $('#imageInfoSize').text(size);
        $('#imageInfoLength').text(length);
        switch (audio) {
        case 0:
            $('#imageInfoAudio').html(googleIcon("close"));
            break;
        case 1:
            $('#imageInfoAudio').html(googleIcon("check"));
            break;
        case 2:
            $('#imageInfoAudio').html(googleIcon("add"));
            break;
        default:
            $('#imageInfoAudio').text("?");
            break;
        }
        var subs = {};
        var allsubs = {};
        rp.photos.forEach(function(photo) {
            if (photo.type == imageTypes.fail)
                return;
            if (photo.subreddit) {
                subs[photo.subreddit] = 1;
                delete allsubs[photo.subreddit];
            }
            if (photo.dupes) {
                photo.dupes.forEach(function(dupe) {
                    if (dupe.subreddit && !subs[dupe.subreddit])
                        allsubs[dupe.subreddit] = (allsubs[dupe.subreddit]) ?allsubs[dupe.subreddit]+1 :1;
                });
            }
        });
        delete subs[rp.url.sub];
        i = Object.keys(subs).join("+");
        if (i && !(rp.url.type == 'm' && rp.url.multi)) {
            length = Object.keys(subs).length;
            $('#imageInfoSubMulti').attr('href', rp.reddit.base+'/r/'+i).attr('title', length);
            $('#imageInfoSubMultiP').attr('href', rp.url.base+'/r/'+i).attr('title', length);
            $('tr.forSubs').show();
        }
        delete allsubs[rp.url.sub];
        length = Object.keys(allsubs).length;
        if (length > 100) {
            var newsubs = {};
            var keys = Object.keys(allsubs);
            for (var key in keys) {
                if (allsubs[key] > 1)
                    newsubs[key] = allsubs[key];
            }
            allsubs = newsubs;
            // Sub list is capped at 250 (for non-gold accounts)
            length = Object.keys(allsubs).length;
        }
        // @@ fitler based on number? (> once?)
        if (length <= 250)
            i = Object.keys(allsubs).join("+");
        else
            i = Object.keys(allsubs).sort(function(a, b) { return allsubs[b]-allsubs[a] }).slice(0, 250).join("+");
        if (i) {
            $('#imageInfoAllSubMulti').attr('href', rp.reddit.base+'/r/'+i).attr('title', length);
            $('#imageInfoAllSubMultiP').attr('href', rp.url.base+'/r/'+i).attr('title', length);
            $('tr.forAllSubs').show();
        }
        t.find('tr.forAll').show();

        $('#info').show();
    };

    // Capture all clicks on infop links (links that direct locally
    $(document).on('click', 'a.local', function (event) {
        stopEvent(event);
        var path = $(this).prop('pathname')+$(this).prop('search');
        processUrl(path);
    });

    // Capture clicks on AlbumButtons
    $(document).on('click', 'a.albumButton', function (event) {
        stopEvent(event);
        startAnimation($('#allNumberButtons a.active').data("index"),
                       $(this).data("index"));
    });

    $(document).on('click', '#navboxExtraLoad', function (event) {
        stopEvent(event);
        if (rp.session.activeIndex < 0)
            return false;
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

        getRedditCrossposts(photo);
    });

    $(document).on('click', '#navboxShowInfo', showInfo);
    $(document).on('click', '#navboxShowHelp', showHelp);

    // Bind to PopState Event
    //rp.history.Adapter.bind(window, 'popstate', function(e) {
    window.onpopstate = function(e) {
        var state = e.state;
        var newurl = window.location.pathname+window.location.search;

        if (rp.url.path !== newurl)
            processUrl(newurl, false, state);
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
        else
            rp.cache[next] = { 0: createDiv(next) };

        // Also create next+1
        var next1 = getNextSlideIndex(next);
        if (next1 == next)
            loadMoreSlides();
        else if (oldCache[next1])
            rp.cache[next1] = oldCache[next1];
        else
            rp.cache[next1] = { 0: createDiv(next1) };

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
            else
                rp.cache[prev] = { 0: createDiv(prev) };
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

            log.debug("NOT ANIMATING photo.length=="+rp.photos.length+
                      " isAnimating: "+rp.session.isAnimating);
            if (imageIndex >= rp.photos.length)
                loadMoreSlides();
            if (rp.session.isAnimating)
                rp.session.needReanimation = true;
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
        setCurrentState();
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
        } else
            numberButton.removeClass('active');
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
        } else
            numberButton.removeClass('active');
    };

    // Update subreddit, author, and Extras
    var updateAuthor = function(pic) {
        var photo = photoParent(pic);

        $('#navboxExtra').html("");
        if (hasPhotoExtraLinks(pic))
            $('#navboxExtra').append(picExtraLinks(pic))

        if (photo.subreddit) {
            $('#navboxSubreddit').html(redditLink('/r/'+photo.subreddit)).show();
            if (photo.blog)
                $('#navboxExtra').append(blogBlogLink(photo.blog));

        } else if (photo.blog)
            $('#navboxSubreddit').html(blogBlogLink(photo.blog)).show();
        else
            $('#navboxSubreddit').hide();

        if (photo != pic)
            $('#navboxExtra').append($('<span>', { class: 'info infol' }).text((photo.album.indexOf(pic)+1)+"/"+photo.album.length));

        $('#navboxAuthor').html("").hide();
        var authName = pic.author || photo.author;
        if (authName) {
            $('#navboxAuthor').append(redditLink(localUserUrl("reddit", authName),  authName, '/u/'+authName)).show();
            if (pic.aflair)
                $('#navboxAuthor').append($('<span>', { class: 'linkflair' }).html(pic.aflair));
        }
        if (hasPhotoSiteUser(pic))
            $('#navboxAuthor').append(siteUserLink(pic.site)).show();
        if (hasPhotoBlogUser(photo))
            $('#navboxAuthor').append(blogUserLink(photo.blog)).show();

        if (photo.comments)
            $('#navboxSubreddit').append($('<a>', { href: photo.comments,
                                                    class: "info infoc",
                                                    title: "Comments (o)" }
                                          ).text('('+photo.commentN+")"));
    };

    var updateDuplicates = function(pic) {
        var photo = photoParent(pic);
        if (!isActive(photo))
            return;
        $('#duplicateUl').html("");
        var total = 0;

        if (photo.subreddit)
            $('#navboxDuplicatesLink').attr('href',  rp.reddit.base + '/r/' +
                                            photo.subreddit + '/duplicates/' + photo.id).show();
        else
            $('#navboxDuplicatesLink').attr('href', '#').hide();

        // Add Blog Tags
        if (hasPhotoBlogTags(photo))
            photo.blog.tags.forEach(function(tag) {
                var li = $("<li>", { class: 'list'});
                li.html(blogTagLink(photo.blog, tag));
                ++ total;
                $('#duplicateUl').append(li);
            });

        // Add Site Tags
        if (hasPhotoSiteTags(pic))
            pic.site.tags.forEach(function(tag) {
                var li = $("<li>", { class: 'list'});
                li.html(siteTagLink(pic.site.t, tag));
                ++ total;
                $('#duplicateUl').append(li);
            });

        // Add Site Tags (album)
        if (photo != pic && hasPhotoSiteTags(photo))
            photo.site.tags.forEach(function(tag) {
                var li = $("<li>", { class: 'list'});
                li.html(siteTagLink(photo.site.t, tag));
                ++ total;
                $('#duplicateUl').append(li);
            });

        var dupes = ((photo.dupes) ?photo.dupes :[]);
        if (pic != photo && pic.dupes)
            dupes = dupes.concat(pic.dupes);

        // Reddit Duplicates
        var multi = [];
        if (photo.subreddit)
            multi.push(photo.subreddit);
        dupes.forEach(function(item) {
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
                if (item.a && item.a != photo.author)
                    li.append(localUserIcon("reddit", item.a));
                li.append($("<a>", { href: rp.reddit.base + subr + "/comments/"+item.id,
                                     class: 'info infoc',
                                     title: (new Date(item.date*1000)).toString(),
                                   }).text('('+item.commentN+')'));
                // @@ item.blog
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
        $('#duplicatesLink').hide();
        if (multi) {
            $('#navboxDuplicatesMulti').attr('href', rp.reddit.base+'/r/'+multi.join('+'));
            $('#navboxDuplicatesMultiP').attr('href', rp.url.base+'/r/'+multi.join('+'));
            if (multi.length > 1 || (multi.length == 1 && multi[0] != photo.subreddit))
                $('#duplicatesLink').show();
        } else {
            $('#navboxDuplicatesMulti').attr('href', "#");
            $('#navboxDuplicatesMultiP').attr('href', "#");
        }
        $('#duplicatesCollapser').data('count', total);
        setVcollapseHtml($('#duplicatesCollapser'));
        updateSelected();
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
        var image = getCurrentPic();
        var now = currentTime();

        // COMMENTS/BUTTON LIST Box
        updateExtraLoad();

        var url = image.o_url || image.url;
        $('#navboxOrigLink').attr('href', url).parent().show();
        setFavicon($('#navboxOrigLink'), url);

        // Setup navboxLink and navboxImageSearch
        updateNavboxTypes(image);
        $('.popup').hide();
        if ($('#login').is(':checked'))
            $('#login').click();
        if ($('#choice').is(':checked'))
            $('#choice').click();

        if (albumIndex >= 0) {
            $('#navboxAlbumOrigLink').attr('href', photo.o_url).attr('title', photo.title+" (a)").parent().show();
            setFavicon($('#navboxAlbumOrigLink'), photo.o_url);
            if (url == photo.o_url)
                $('#navboxOrigLink').parent().hide();
        } else
            $('#navboxAlbumOrigLink').attr('href', "#").parent().hide();
        $('#navboxOrigDomain').attr('href', '/domain/'+hostnameOf(image.o_url));

        if (now > rp.login.reddit.expire-30)
            expiredRedditLogin();

        // TITLE BOX
        $('#navboxTitle').html(picTitle(image));
        var flair = picFlair(image);
        if (flair)
            $('#navboxTitle').prepend($('<span>', { class: 'linkflair' }).html(flair));
        if (photo.score !== undefined)
            $('#navboxScore span').attr('title', 'Score: '+photo.score).text(humanReadInt(photo.score)).parent().show();
        else
            $('#navboxScore').hide();

        var date = image.date || photo.date;
        if (date)
            $('#navboxDate').attr("title", (new Date(date*1000)).toString()).text(sec2dms(now - date));
        else
            $('#navboxDate').attr("title", "").text("");

        updateAuthor(image);
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

    var setCurrentState = function() {
        var state = { photos: rp.photos,
                      index: rp.session.activeIndex,
                      album: rp.session.activeAlbumIndex,
                      after: rp.session.after,
                      url: rp.url,
                      subredditLink: $('#subredditLink').prop('href'),
                      loadAfter: (rp.session.loadAfter) ?rp.session.loadAfter.name :null,
                      filler: null};
        rp.history.replaceState(state, "", rp.url.path);
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
        rp.session.loadingMessage = (msg) ?msg :"";
        return true;
    };

    var addLoading = function(val) {
        rp.session.loading += (isFinite(val)) ?val :1;
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
            setCurrentState();
            // already loaded images, don't ruin the existing experience
            return;
        }

        // remove "loading" title
        $('#navboxTitle').html($('<span>', { class: 'error' }).html(message));

        // display alternate recommendations
        $('#recommend').show();
    };

    var failedAjax = function (xhr, ajaxOptions, thrownError) {
        if (xhr.status == 401 && rp.login.reddit.expire)
            expiredRedditLogin();
        log.info("ActiveIndex:["+rp.session.activeIndex+"]["+rp.session.activeAlbumIndex+"]");
        log.info("xhr:", xhr);
        log.info("ajaxOptions:", ajaxOptions);
        log.error("error:", thrownError);
    };

    var ignoreError = function(xhr, ajaxOptions, thrownError) {
        log.info("ActiveIndex:["+rp.session.activeIndex+"]["+rp.session.activeAlbumIndex+"]: "+thrownError);
    };

    var failedAjaxDone = function (xhr, ajaxOptions, thrownError) {
        failedAjax(xhr, ajaxOptions, thrownError);
        var text = (xhr.status == 0)
            ?"<br> Check tracking protection"
            :(xhr.responseJSON && xhr.responseJSON.message) ?'<br>'+xhr.responseJSON.message
            :(": "+thrownError+" "+xhr.status);
        doneLoading("Failed to get "+rp.url.sub+text);
    };

    // Set Autoplay for iOS devices
    var addPlayButton = function (div, vid) {
        div.prepend(playButton(function() {
            vid[0].play();
            $('#playbutton').remove();
        }));
        // if video starts playing, nuke play button
        $(vid).on('play', function () {
            $('#playbutton').remove();
        });
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
            if (vid && vid.length) {
                vid.prop('autoplay', true);
                if (vid[0])
                    try {
                        vid[0].play();
                    } catch (e) {
                        addPlayButton(newDiv, vid);
                    }
            }
            updateVideoMute();

            rp.session.isAnimating = false;
            if (rp.session.needReanimation) {
                rp.session.needReanimation = false;
                startAnimation(rp.session.activeIndex, rp.session.activeAlbumIndex);
            }
        });
    }

    //
    // Slides the background photos
    // Only called with rp.session.activeIndex, rp.session.activeAlbumIndex
    function getBackgroundDiv(index, albumIndex) {
        var divNode;
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
        var type = getPic(index, aIndex).type;

        clearSlideTimeout(type);

        return divNode;
    }

    var createDiv = function(imageIndex, albumIndex) {
        if (albumIndex === undefined)
            albumIndex = -1;

        log.debug("createDiv("+imageIndex+", "+albumIndex+")");
        // Retrieve the accompanying photo based on the index
        var photo = getPic(imageIndex, albumIndex);
        if (photo.type == imageTypes.album)
            photo = rp.photos[imageIndex].album[0];

        // Used by showPic, showVideo, and showImage
        var divNode = $("<div />", { class: "fullscreen"});

        if (photo === undefined)
            return divNode;

        // Called on failed pic load
        var find_fallback = function(pic, thumb) {
            if (thumb) {
                if (nextPhotoThumb(pic))
                    showPic(pic);

            } else if (nextPhotoFallback(pic))
                if (processPhoto(pic))
                    showPic(pic);
        }

        // Create a new div and apply the CSS
        var showImage = function(photo, needreset, thumb) {
            if (needreset === undefined)
                needreset = true;
            if (thumb === undefined)
                thumb = (photo.type == imageTypes.thumb || photo.type == imageTypes.fail);

            var url = (thumb) ?photo.thumb :photo.url;
            var img = $('<img />', { class: rp.settings.realsize ?"realsize" :"fullsize", src: url});

            img.on('error', function() {
                log.info("cannot display photo [load error]: "+url);
                find_fallback(photo);
            });

            var hn = hostnameOf(photo.url, true);
            // https://i.redd.it/removed.png is 130x60
            if (hn == 'redd.it')
                img.on('load', function() {
                    if ($(this)[0].naturalHeight == 60 &&
                        $(this)[0].naturalWidth == 130) {
                        log.info("["+photo.index+"] Image has been removed: "+url);
                        find_fallback(photo, thumb);
                    }
                });
            // https://i.imgur.com/removed.png is 161x81
            else if (hn == 'imgur.com')
                img.on('load', function() {
                    if ($(this)[0].naturalHeight == 81 &&
                        $(this)[0].naturalWidth == 161) {
                        log.info("["+photo.index+"] Image has been removed: "+url);
                        find_fallback(photo, thumb);
                    }
                });
            // YouTube 404 thumbnail is 120x90
            else if (hn == 'youtube.com' ||
                     hn == 'youtu.be' ||
                     hn == 'ytimg.com')
                img.on('load', function() {
                    if ($(this)[0].naturalHeight == 90 &&
                        $(this)[0].naturalWidth == 120) {
                        log.info("["+photo.index+"] Image has been removed: "+url);
                        find_fallback(photo, thumb);
                    }
                });
            // 404 221x80
            else if (hn == 'ezgif.com')
                img.on('load', function() {
                    if ($(this)[0].naturalHeight == 80 &&
                        $(this)[0].naturalWidth == 221) {
                        log.info("["+photo.index+"] Image has been removed: "+url);
                        find_fallback(photo, thumb);
                    }
                });
            divNode.html(img);

            if (needreset && isActive(photo))
                resetNextSlideTimer();
        };

        var showThumb = function(pic, needreset) {
            var thumb = pic.thumb || photoParent(pic).thumb;
            if (thumb)
                showImage(pic, needreset, true);
        }

        // Called with showVideo(pic)
        var showVideo = function(pic) {
            var video = $('<video />', {
                class: rp.settings.realsize ?"realsize" :"fullsize",
                id: "gfyvid",
                preload: "metadata",
                playsinline: ''});
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
                video.on('playing', function() {
                    audio[0].currentTime = video[0].currentTime;
                    try {
                        audio[0].play()
                    } catch (e) {
                        log.info("Failed to play audio: "+e);
                    }
                });
                video.on('pause', function() { audio[0].pause() });
                divNode.append(audio);
            }

            $(lastsource).on('error', function() {
                log.info("["+imageIndex+"] video failed to load last source: "+pic.url);
                resetNextSlideTimer();
                find_fallback(pic, false);
            });

            $(video).on('error', function() {
                if (pic.type == imageTypes.album)
                    pic = pic.album[0];
                log.info("["+imageIndex+"] video failed to load: "+pic.url);
                resetNextSlideTimer();
                find_fallback(pic, false);
            });

            $(video).on('ended', function() {
                log.debug("["+imageIndex+"] video ended");
                if ($.contains(document, $(video)[0]) && (shouldStillPlay(imageIndex, albumIndex) || !autoNextSlide())) {
                    var audio = $('#gfyaudio')[0];
                    if (audio) {
                        audio.pause();
                        audio.currentTime = 0;
                    }
                    $(video)[0].play();
                }
            });

            $(video).on("loadeddata", function(e) {
                if (pic.type == imageTypes.album)
                    pic = pic.album[0];
                if (e.target.duration == 2 &&
                    e.target.videoWidth == 640 &&
                    e.target.videoHeight == 480 &&
                    hostnameOf(e.target.currentSrc, true) == 'gfycat.com') {
                    log.info("cannot display video [copyright claim]: "+pic.url);
                    resetNextSlideTimer();
                    find_fallback(pic, false);
               }
                pic.video.duration = e.target.duration;
                if (pic.video.duration < rp.settings.timeToNextSlide) {
                    pic.video.times = Math.ceil(rp.settings.timeToNextSlide/pic.video.duration);
                } else {
                    pic.video.times = 1;
                }
                log.debug("["+imageIndex+"] Video loadeddata video: "+pic.video.duration+" playing "+pic.video.times);
            });

            // Progress Bar
            divNode.bind("rpdisplay", rpdisplayVideo);
            if (divNode.parent()[0] == $('#pictureSlider')[0])
                divNode.trigger("rpdisplay");

            if (rp.session.needsPlayButton) {
                // Always add play button
                if ($(video)[0].paused)
                    addPlayButton(divNode, video);

            } else {
                var onCanPlay = function() {
                    $(video).off('canplaythrough', onCanPlay);
                    if ($.contains(document, $(video)[0]))
                        try {
                            $(video)[0].play();
                        } catch (e) {
                            addPlayButton(divNode, video);
                        }
                };
                $(video).on('canplaythrough', onCanPlay);

                if (rp.session.volumeIsMute && !isVideoMuted())
                    addPlayButton(divNode, video);
                else if ($(video)[0].paused)
                    addPlayButton(divNode, video);
            }
        };

        // Called with showEmbed(urlForIframe)
        var iFrame = function(pic) {
            var iframe = $('<iframe/>', { id: "parent",
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
                throw("Failed to load iframe: "+pic.url);
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

        var rpdisplayFunc = function(event) {
            var div = $(this);
            div.empty();
            var pic = event.data;
            if (pic.type == imageTypes.album)
                pic = event.data = pic.album[0];
            switch (pic.type) {
            case imageTypes.html:
                showHtml(div, pic.html);
                break;
            case imageTypes.embed:
                showEmbed(div, pic);
                break;
            case imageTypes.image:
            case imageTypes.thumb:
            case imageTypes.fail:
                log.error("rpdislay: Bad image type "+imageTypeStyle[pic.type]+": "+pic.url);
                div.unbind("rpdisplay");
                showImage(pic, false);
                break;
            default:
                throw "Bad image type "+imageTypeStyle[pic.type]+": "+pic.url;
            }
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

        var showPic = function(opic) {
            var pic = photoParent(opic);
            if (pic.type == imageTypes.album)
                pic = pic.album[(albumIndex < 0) ?0 :albumIndex];

            switch (pic.type) {
            case imageTypes.image:
                showImage(pic);
                break;
            case imageTypes.video:
                showVideo(pic);
                break;
            case imageTypes.html:
            case imageTypes.embed:
                // triggered in replaceBackgroundDiv
                divNode.bind("rpdisplay", pic, rpdisplayFunc);
                if (divNode.parent()[0] == $('#pictureSlider')[0])
                    divNode.trigger("rpdisplay");
                break;
            case imageTypes.thumb:
            case imageTypes.fail:
                showThumb(pic);
                break;
            default:
                throw("called showPic() on "+imageTypeStyle[pic.type]+" type: "+pic.url);
            }

            if (isActive(pic)) {
                var p = photoParent(pic);
                animateNavigationBox(p.index, p.index, rp.session.activeAlbumIndex);
            }
            return divNode;
        };

        switch (photo.type) {
        case imageTypes.image:
        case imageTypes.thumb:
        case imageTypes.fail:
            showImage(photo, false);
            return divNode;
        case imageTypes.html:
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

    var gfyItemTitle = function(item) {
        return item.title || item.description;
    };

    var fillLaterDiv = function(photo, showCB) {
        var jsonUrl;
        var dataType = 'json';
        var postType = 'GET';
        var postData;
        var handleData;
        var headerData;
        var url = photo.url;
        var hostname = hostnameOf(url, true);
        var fqdn = hostnameOf(url);
        var shortid = url2shortid(url);

        var handleErrorOrig = function (xhr) {
            log.info('failed to load url [error '+xhr.status+']: ' + photo.url);
            initPhotoThumb(photo);
            showCB(photo);
        };
        var handleWPError = function(xhr) {
            // timeout: xhr.status == 0 && xhr.statusText == "timeout"
            if (xhr.status != 0) {
                rp.wp[fqdn] = 0;
                setConfig(configNames.wp, rp.wp);
            }
            handleErrorOrig(xhr);
        };
        var handleWPv1Data = function(data) {
            if (rp.wp[fqdn] !== 1)
                rp.wp[fqdn] = 1;
            setConfig(configNames.wp, rp.wp);
            refreshBlogTitle({t:'wp', b: fqdn});
            processWordPressPost(photo, data);
            showCB(photo);
        };
        var handleWPv2Data = function(data) {
            if (rp.wp[hostname] !== 2) {
                rp.wp[hostname] = 2;
                setConfig(configNames.wp, rp.wp);
            }
            refreshBlogTitle({t:'wp2', b: fqdn});
            if (Array.isArray(data))
                data = data[0];
            getPostWPv2(
                photo,
                data,
                function(photo) {
                    log.info("Failed to load wpv2: "+photo.url);
                    initPhotoThumb(photo);
                    showCB(photo);
                },
                showCB,
            );
        };
        var handleError = handleErrorOrig;

        var handleOembed = function(data) {
            if (data.author_name && data.author_url)
                addPhotoExtraLink(data.author_name, data.author_url);

            if (data.safety)
                photo.over18 = (data.safety == "adult");

            addPhotoThumb(photo, data.thumbnail_url);

            if (data.error) {
                log.info("cannot display url ["+(data.message || data.error)+"]: "+photo.url);
                initPhotoThumb(photo);

            } else if (data.type == 'photo') {
                initPhotoImage(photo, data.url);

            } else if (data.type == 'video') {
                var f = $.parseHTML(data.html);

                initPhotoEmbed(photo, f[0].src);

            } else if (data.fullsize_url && (data.type == 'rich' || data.type == 'link')) {
                // non-standard deviantart extention
                initPhotoImage(photo, data.fullsize_url);

            } else if (data.type == 'rich' && data.html) {
                initPhotoHtml(photo, data.html);

            } else {
                log.info("cannot display url [unhandled type "+data.type+"]: "+photo.url);
                initPhotoThumb(photo);
            }
            showCB(photo);
        };

        var a, hn;
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
                    var pic = fixupPhotoTitle({ url: item.gcsBaseUrl+item.imageRenderedSizes[0]+item.imageFileExtension},
                                         item.flattenedCaption || item.altText);
                    if (item.videoFileExtension)
                        initPhotoVideo(pic, item.gcsBaseUrl+item.videoRenderedSizes[0]+item.videoFileExtension,
                                       pic.url);

                    if (processPhoto(pic))
                        addAlbumItem(photo, pic);
                    });
                checkPhotoAlbum(photo);
                showCB(photo);
            };

        } else if (hostname == 'blogspot.com' ||
                   hostname == 'blogger.com') {
            var blogid, postid;
            if (hostname == 'blogger.com') {
                a = pathnameOf(photo.url).split('/');
                postid = a.pop();
                blogid = a.pop();
                if (isNaN(parseInt(postid, 10)) || isNaN(parseInt(blogid, 10))) {
                    log.error("Blogger returned bad value postid:"+postid+" blogid:"+blogid);
                    initPhotoThumb(photo);
                    showCB(photo);
                    return;
                }
            } else
                blogid = rp.blogcache.hn2site.blogger[fqdn];

            var handleBloggerPost = function(data) {
                if (!processBloggerPost(photo, data))
                    initPhotoThumb(photo);
                showCB(photo);
            };

            if (blogid === undefined || !hasBlogTitle({t:'blogger', b:blogid})) {
                if (blogid === undefined)
                    jsonUrl = bloggerBlogLookupUrl(fqdn);
                else
                    jsonUrl = 'https://www.googleapis.com/blogger/v3/blogs/'+blogid+'?key='+rp.api_key.blogger;
                handleData = function(data) {
                    recallBlogger(data, function() {
                        $.ajax({
                            url: (postid) ?bloggerPost(blogid, postid) :bloggerPostLookupUrl(fqdn, pathnameOf(photo.url)),
                            success: handleBloggerPost,
                            error: handleError,
                            crossDomain: true,
                            timeout: rp.settings.ajaxTimeout
                        });
                    }, handleErrorOrig);
                };
            } else {
                if (postid === undefined)
                    jsonUrl = bloggerPostLookupUrl(blogid, pathnameOf(photo.url));
                else
                    jsonUrl = bloggerPost(blogid, postid);
                handleData = handleBloggerPost;
            }

        } else if (hostname == 'livestream.com') {
            jsonUrl = originOf(photo.url)+'/oembed?url=' + encodeURIComponent(photo.url);
            handleData = handleOembed;

        } else if (fqdn == 'danbooru.donmai.us') {
            jsonUrl = 'https://danbooru.donmai.us/posts/'+shortid+'.json';
            handleData = function(post) {
                processDanbooruPost(photo, post);
                showCB(photo);
            };

        } else if (hostname == 'deviantart.com' ||
                   hostname == 'sta.sh' ||
                   hostname == 'fav.me') {
            jsonUrl = 'https://backend.deviantart.com/oembed?format=jsonp&url=' + encodeURIComponent(photo.url);
            dataType = 'jsonp';

            handleData = handleOembed;

        } else if (hostname == 'e621.net') {
            jsonUrl = 'https://e621.net/posts/'+shortid+'.json';
            handleData = function(data) {
                processE621Post(photo, data.post);
                showCB(photo);
            };

        } else if (hostname == 'flickr.com') {
            dataType = 'jsonp';

            // /photos/USERID/PHOTOID
            shortid = url2shortid(photo.url, 3);
            var userid = url2shortid(photo.url, 2);

            if (shortid == 'albums' || shortid == 'sets') {
                var ReqData = { photoset_id: url2shortid(photo.url, 4),
                                user_id: siteUserId("flickr", userid),
                                extras: 'media,url_o,url_h,url_k,url_b,tags'};
                jsonUrl = flickrJsonURL('flickr.photosets.getPhotos', ReqData)
                handleData = function(data) {
                    if (data.stat !== 'ok') {
                        var errFunc = function(data) {
                            log.info("failed to load flickr [error: "+data.message+"]: "+photo.url)
                            initPhotoThumb(photo);
                            showCB(photo);
                        };
                        if (data.code == 2)
                            flickrUserLookup(userid, handleData, 'flickr.photosets.getPhotos', ReqData, errFunc);
                        else
                            errFunc(data);
                        return;
                    }
                    cacheSiteUser("flickr", data.photoset.ownername, data.photoset.owner);
                    photo = initPhotoAlbum(photo, false);
                    if (data.photoset.total > data.photoset.perpage)
                        log.error("@@ More photos ("+data.photoset.total+") in set than on page ("+data.photoset.perpage+"): "+photo.url);
                    data.photoset.photo.forEach( function(item) {
                        var pic = processFlickrPost(item);
                        addPhotoSiteUser(pic, data.photoset.owner);
                        if (processPhoto(pic))
                            addAlbumItem(photo, pic);
                    });
                    checkPhotoAlbum(photo);
                    showCB(photo);
                };

            } else {
                addPhotoSite(photo, 'flickr', userid);

                jsonUrl = flickrJsonURL('flickr.photos.getSizes', { photo_id: shortid })

                handleData = function(data) {
                    var i;
                    if (data.stat !== 'ok') {
                        log.info("failed to load flickr [error: "+data.message+"]: "+photo.url)
                        initPhotoThumb(photo);
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
                            if (!isVideoExtension(data.sizes.size[i].source))
                                continue;
                            sv = s;
                            v = data.sizes.size[i];
                        }
                    }
                    if (v) {
                        initPhotoVideo(photo, [], p.source);
                        if (v.label.toLowerCase().includes('mp4'))
                            addVideoUrl(photo, 'mp4', v.source);
                        if (v.label.toLowerCase().includes('webm'))
                            addVideoUrl(photo, 'webm', v.source);
                        photo.url = v.url;
                    } else if (p)
                        initPhotoImage(photo, p.source);
                    else
                        initPhotoThumb(photo);

                    showCB(photo);
                };
            }

        } else if (hostname == 'gfycat.com') {
            a = pathnameOf(photo.url).split('/');
            if (a[2] == "collections") {
                var u = a[1].slice(1, -1);
                addPhotoSite(photo, 'gfycat', u);
                jsonUrl = "https://api.gfycat.com/v1/users/"+u+"/collections/"+a[3]+"/gfycats";
                handleData = function (data) {
                    var gifs = data.gfycats || data.gifs;
                    if (!gifs.length) {
                        initPhotoFailed(photo);
                        showCB(photo);
                        return;
                    }
                    var p = initPhotoAlbum(photo, false);
                    gifs.forEach(function(data) {
                        addAlbumItem(p, gfycat2pic(data));
                    });
                    checkPhotoAlbum(p);
                    showCB(photo);
                };
            } else {
                jsonUrl = "https://api.gfycat.com/v1/gfycats/" + shortid;
                handleData = function (data) {
                    processGfycatItem(photo, data.gfyItem);
                    showCB(photo);
                };
                handleError = function() {
                    initPhotoEmbed(photo, 'https://redgifs.com/ifr/'+shortid.toLowerCase(), false);
                    showCB(photo);
                };
            }

        } else if (hostname == 'imgchest.com') {
            headerData = { Authorization: "Bearer "+rp.api_key.imgchest };
            jsonUrl = 'https://api.imgchest.com/v1/post/'+url2shortid(photo.url);
            handleData = function(data) {
                photo = initPhotoAlbum(photo, false);
                data.data.images.forEach(function(item) {
                    var pic = fixupPhotoTitle({
                        url: item.link,
                        type: imageTypes.image,
                        date: processDate(item.crated, "Z")},
                                              item.description || data.data.title);
                    addAlbumItem(photo, pic);
                });
                checkPhotoAlbum(photo);
                showCB(photo);
            };

        } else if (hostname == 'imgur.com') {
            headerData = { Authorization: "Client-ID "+ rp.api_key.imgur };
            a = pathnameOf(photo.url).split('/');

            var handleImgurAlbum = function(data) {
                handleImgurItemMeta(photo, data.data);
                showCB(handleImgurItemAlbum(photo, data.data));
            };

            if (a[1] == 'a') {
                jsonUrl = "https://api.imgur.com/3/album/" + a[2];
                handleData = handleImgurAlbum;

            } else if (a[1] == 'gallery') {
                jsonUrl = "https://api.imgur.com/3/gallery/" + a[2];

                handleError = function () {
                    jsonUrl = "https://api.imgur.com/3/album/" + a[2];
                    var hdata = handleImgurAlbum;
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
                    } else if (Array.isArray(data.data)) {
                        photo = handleImgurItemAlbum(photo, {
                            is_album: true,
                            images: data.data,
                            link: "https://imgur.com/gallery/"+shortid,
                        });
                        showCB(photo);
                    } else
                        handleImgurAlbum(data);
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

            jsonUrl = rp.reddit.api + '/comments/' + shortid + '.json';
            headerData = rp.session.redditHdr;

            handleData = function(data) {
                if (data[0].data.children.length != 1) {
                    log.error("Comment Listing had multiple primary children: "+photo.url);
                }
                if (processRedditT3(photo, data[0].data.children[0]) !== true &&
                    processPhoto(photo))
                    initPhotoThumb(photo)
                showCB(photo);
            };

        } else if (hostname == 'redgifs.com') {
            jsonUrl = 'https://api.redgifs.com/v1/oembed?url='+encodeURIComponent(photo.url);
            handleData = handleOembed;

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
                    initPhotoThumb(photo);
                }
                showCB(photo);
            };

        } else if (hostname == 'tiktok.com') {
            // currently only www.tiktok.com gets latered
            jsonUrl = 'https://www.tiktok.com/oembed?url='+photo.url;
            photo.type = imageTypes.html;

            handleData = function(data) {
                // this should work and resolve to:
                // iframe of https://www.tiktok.com/embed/v2/$SHORTID?lang=en-US
                // but it always comes back with 0 bytes
                log.debug("ignoring html using thumbnail [tiktok]: "+photo.o_url);
                initPhotoHtml(photo, data.html);
                addPhotoThumb(photo, data.thumbnail_url);
                //initPhotoImage(photo, data.thumbnail_url);
                showCB(photo);
            };

        } else if (hostname == 'tumblr.com') {
            a = pathnameOf(photo.url).split('/');
            shortid = a[2];
            switch (a[1]) {
            case 'post': // BLOGNAME.tumblr.com/post/POSTID
                hn = fqdn;
                break;
            case 'blog': // tumblr.com/blog/view/BLOGNAME/POSTID
                hn = a[3];
                shortid = a[4];
                break;
            default: // tumblr.com/BLOGNAME/POSTID
                hn = a[1];
                break;
            }
            jsonUrl = tumblrJsonURL(hn, shortid);
            dataType = 'jsonp';

            handleData = function(data) {
                processTumblrPost(photo, data.response.posts[0]);
                showCB(photo);
            };

        } else if (hostname == 'twitter.com' ||
                   hostname == 'x.com') {
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

        } else if (hostname == 'wordpress.com' || hostname == 'wp.com') {
            photo.url = photo.url.replace(/\/amp\/?$/, '');
            shortid = url2shortid(photo.url);

            jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+fqdn+'/posts/slug:'+shortid;

            handleData = handleWPv1Data;

        } else if (rp.wp[fqdn]) {
            shortid = url2shortid(photo.url);

            switch (rp.wp[fqdn]) {
            case 1:
                jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+fqdn+'/posts/slug:'+shortid;
                handleData = handleWPv1Data;
                handleError = function() {
                    log.info("ATTEMPTING wordpress v2: "+photo.url);
                    $.ajax({
                        url: wp2BaseJsonUrl(fqdn)+'?slug='+shortid+'&_jsonp=?',
                        type: postType,
                        data: postData,
                        headers: headerData,
                        dataType: dataType,
                        success: handleWPv2Data,
                        error: handleWPError,
                        timeout: rp.settings.ajaxTimeout,
                        crossDomain: true
                    });
                };
                break;
            case 2:
                jsonUrl = wp2BaseJsonUrl(fqdn);
                if (/^\d+$/.test(shortid))
                    jsonUrl += shortid+'?_jsonp=?';
                else
                    jsonUrl += '?slug='+shortid+'&_jsonp=?';
                dataType = 'jsonp';
                handleData = handleWPv2Data;
                handleError = handleWPError;
                break;
            }

        } else if (rp.wp[fqdn] === 0) {
            initPhotoThumb(photo);
            showCB(photo);

        } else {
            log.error("["+photo.index+"] Unknown site ["+fqdn+"]: "+photo.url);
            initPhotoThumb(photo);
            showCB(photo);
        }

        if (jsonUrl !== undefined)
            $.ajax({
                url: jsonUrl,
                type: postType,
                data: postData,
                headers: headerData,
                dataType: dataType,
                success: handleData,
                error: handleError,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true
            });
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
            var pic = { url: img.link, o_url: item.link };
            handleImgurItemMeta(pic, img);
            fixupPhotoTitle(pic, img.title || img.description, photo.subreddit);
            processImgurItemType(pic, img);

            addAlbumItem(photo, pic);
        });
        checkPhotoAlbum(photo);
        return photo;
    };

    var handleImgurItemMeta = function(photo, item) {
        addPhotoSite(photo, "imgur", item.account_url);
        if (item.section) {
            if (photo.subreddit)
                addPhotoSiteTags(photo, [ item.section ]);
            else
                photo.subreddit = item.section;
        }
        if (item.datetime && !photo.date)
            photo.date = item.datetime;
        if (item.nsfw && !photo.over18)
            photo.over18 = item.nsfw;
        addPhotoSiteTags(photo, (item.tags) ?item.tags.map(function(x) { return x.name }) :[]);
    };

    var fixImgurPicUrl = function(url) {
        var hostname = hostnameOf(url);

        // regexp removes /r/<sub>/ prefix if it exists
        // E.g. http://imgur.com/r/aww/x9q6yW9 or http://imgur.com/t/mashup/YjBiWcL
        // replace with gallery because it might be an album or a picture
        url = url.replace(/[rt]\/[^ /]+\//, 'gallery/');

        if (url.includes('?'))
            url = url.replace(/\?[^.]*/, '');

        url = url.replace(/^http:/, "https:");

        if (url.includes("/a/") ||
            url.includes('/gallery/')) {
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

    // output: html to wrap in <span class="linkflair">RETURNED FLAIR</span>
    var redditFlair = function(type, text, richtexts) {
        if (type == "text" || type === undefined)
            return text;
        else { // "richtext"
            var rc = "";
            richtexts.forEach(function(elem) {
                if (elem.e == "text") {
                    rc += elem.t;
                } else if (elem.e == "emoji") {
                    rc += $('<div/>').html($("<img>", { 'class': "emoji", src: elem.u, alt: elem.a, title: elem.a })).html();
                } else {
                    log.error("Bad RichText Flair type ["+elem.e+"]: "+elem);
                }
            });
            return rc;
        }
    }

    var fixupUrl = function (url) {
        // fix reddit bad quoting
        url = url.replace(/&amp;/gi, '&');

        var hostname = hostnameOf(url, true);

        var path = pathnameOf(url).split('/');

        if (hostname == 'href.li')
            url = url.replace(/.*href.li\/\?/,"");

        if (hostname == 'google.com' && path[1] == 'amp') {
            var n = 2;
            var scheme = 'http';
            if (path[n] == 's') {
                ++n;
                scheme = 'https';
            }
            url = scheme + '://'+path.slice(n).join('/');

        } else if (url.startsWith('//'))
            url = ((rp.insecure[hostname]) ?"http:" :"https:")+url;

        if (hostname == 'gfycat.com' ||
            hostname == 'hentai-foundry.com' ||
            hostname == 'imgur.com' ||
            hostname == 'juicygif.com' ||
            hostname == 'pornhub.com' ||
            hostname == 'sendvid.com' ||
            hostname == 'smutty.com' ||
            hostname == 'wordpress.com' ||
            hostname == 'xhamster.com' ||
            hostname == 'xvideos.com' ||
            hostname == 'youporn.com')
            url = url.replace(/^http:/, "https:");

        else if (hostname == 'dropbox.com')
            url = originOf(url)+pathnameOf(url)+'?dl=1';

        else if (hostname == 'fapdungeon.com' && isVideoExtension(url))
            url = 'https://media.'+hostname+pathnameOf(url);

        return url;
    };

    // This is RFC3986 compliantish
    // TLDs are currently 2 to 6 alphabetic characters
    // "path" match is complient
    // Missing, query (?stuff), and fragment (#stuff)
    var urlregexp = new RegExp('https?://[\\w\\._-]{1,256}\\.[a-z]{2,6}(/([\\w\\-\\.~]|%[0-9a-f]{2}|[?#!$&\'*+,;=@])+)*/?', 'gi');

    // Returns pic with updated title
    var fixupPhotoTitle = function(pic, origtitle, parent_sub) {
        var title = unescapeHTML(origtitle) || pic.title;
        if (!title)
            return pic;
        var subreddit = (pic.subreddit || parent_sub || "").toLowerCase();
        var hn = hostnameOf(pic.url, true);

        // Do URLs first, so we don't pickup those added later
        var t1 = title.replace(urlregexp, socialUrlLink);

        var metaSocial = function(hn, subreddit, flair, def) {
            if (hn == "tiktok.com" || subreddit.match(/tiktok/i) || flair.match(/tiktok/i))
                return "tiktok";
            if (["facereveals"].includes(subreddit))
                return "reddit";
            if (subreddit.match(/onlyfan/i) || flair.match(/onlyfan/i))
                return "onlyfans";
            if (subreddit.match(/fansly/i) || flair.match(/fansly/i))
                return "fansly";
            if (subreddit.match(/snap/i) || flair.match(/snap/i))
                return "snapchat";
            if (subreddit.match(/face/i))
                return "facebook";
            if (subreddit.match(/(insta|gram)/i) || flair.match(/insta/i))
                return "instagram";
            if (subreddit.match(/twitch/i) || flair.match(/twitch/i))
                return "twitch";
            if (hn == "twitter.com" || subreddit.match(/twit/i) || flair.match(/twit/i))
                return "twitter";
            if (subreddit.match(/vsco/i) || flair.match(/vsco/i))
                return "vsco";
            return def;
        };

        // "{SITE}{connector}{NAME}"/"@NAME"/"[SITE][NAME]"
        // 0x1f47b - Ghost
        // 0x25b6 - play button
        // 0x27a1 - right arrow
        var re;
        if (rp.session.regexUnicode)
            re = /(?:[[{(]\s*|my\s+|on\s+|\b|^)?([\p{L}.$]+\p{L}|\s*|\u{1f47b})\s*((?:&\w+;)?[-:@][-:@\s]*|(?:&gt;|=|-)+|\]\[|\)\s*\(|(?:\u{25b6}|\u{27a1})\u{fe0f}?)[[\s]*(\w[\w.-]+\w)(?:\s*[)\]}])?/gui;
        else
            re = /(?:[[{(]\s*|\b|my\s+|on\s+|^)?([A-Za-z.$]+[A-Za-z]|\s*)\s*((?:&\w+;)?[-:@][-:@\s]*|(?:&gt;|=|-)+|\]\[|\)\s*\()[[\s]*([\w.-]+\w)(?:\s*[)\]}])?/gi;
        t1 = t1.replace(re, function(match, osite, connector, name) {
            var site = osite.toLowerCase().replaceAll(".", "");
            var prefix = "";
            try {
                if (osite == "" && connector == "")
                    return match;
                if (osite && name.match(new RegExp('(?:\b|.|^)'+osite+'(:?\b|.|$)', 'i')))
                    throw "site in name";
                if (site == "fb")
                    site = "facebook";
                else if (site == "tk")
                    site = "tiktok";
                else if (site.match(/^(onlyfans?|of)$/) && !(site == "of" && ["", "@"].includes(connector)))
                    site = "onlyfans";
                else if (site.match(/^[sś$](na?pcha?t|np|nap?|c)$/) || site == "\u{1f47b}") // Ghost
                    site = "snapchat";
                else if (connector == "\u{1f47b}") {
                    prefix = osite+" ";
                    site = "snapchat";
                } else if (site.match(/^i?(nsta)?g(ram)?$/) && !["rated", "string", "cups", "spot"].includes(name.toLowerCase()))
                    site = "instagram";
                else if (site == "tw")
                    site = "twitter";
                else if (site == "telegran")
                    site = "telegram";
                else if (site == "@")
                    site = metaSocial(hn, subreddit, picFlair(pic), (pic.over18) ?"instagram" :"twitter");
                else if (site.match(/^k[li]?k$/))
                    return "kik : "+name; // ensure it doesn't get picked up below
                else if (site == "reddit")
                    return "u/"+name; // this will be picked up below for u/USER
                else if (site == "vlive" || // dead site
                         site == "youtube")
                    return match;
                else if (connector == "@") {
                    prefix = osite+" ";
                    site = metaSocial(hn, subreddit, picFlair(pic), (pic.over18) ?"instagram" :"twitter");
                }
                try {
                    return prefix+socialUserLink(name, site, match);
                } catch (e) {
                    // fall through and attempt to match just name + subreddit/flair
                    prefix = site+" ";
                }
                throw "unknown";
            } catch (e) {
                return match;
            }
        });

        if (t1 != title)
            log.debug("TITLE 1: `"+title+"'\n      -> `"+t1);

        // r/Subreddit
        t1 = t1.replace(/(?:^|\s)(?:[[{(]\s*)?\/?(r\/[\w-]+)((?:\/[\w-]+)*)\/?\s*(?:\s*[)\]}])?/gi, function(match, p1, p2) {
            var t = titleRLink('/'+p1, p1, match.trim());
            if (p2)
                t += titleFLink("https://reddit.com"+match.trim(), url2shortid(p2));
            return " "+t;
        });

        // u/RedditUser - https://github.com/reddit-archive/reddit/blob/master/r2/r2/lib/validator/validator.py#L1567
        t1 = t1.replace(/(?:^|\s)(?:[[{(]\s*)?\/?(?:u|user)\/([\w-]{3,20})\s*(?:\s*[)\]}])?/gi, function(match, p1) {
            return socialUserLink(p1, "reddit", match.trim());
        });

        // Single Word title (might be username)
        t1 = t1.replace(/^@?([\w.-]{6,})$/, function(match, p1) {
            var social = metaSocial(hn, subreddit, picFlair(pic));
            var socialuser;
            var a = pathnameOf(pic.url).split('/');
            if (hn == 'twitter.com')
                socialuser = ['twitter', a[1]];
            else if (hn == 'tiktok.com' && a[1].startsWith('@'))
                socialuser = ['tiktok', [1].slice(1, -1)];
            var p = p1.toLowerCase();
            if (p == social ||
                (socialuser && socialuser[0] == social && socialuser[1].toLowerCase() != p))
                return match;
            try {
                return socialUserLink(p1, social, match);
            } catch (e) {
                return match;
            }
        });

        if (t1 != title)
            log.debug("TITLE F: `"+title+"'\n      -> `"+t1);

        pic.title = t1;
        return pic;
    };
    rp.fn.fixupPhotoTitle = fixupPhotoTitle;

    var decodeUrl = function (url) {
        return decodeURIComponent(url.replace(/\+/g, " "));
    };

    var clearRedditLogin = function () {
        $('.needlogin').hide();
        if (!rp.login.reddit.expire)
            return;

        rp.login.reddit.expire = 0;
        rp.session.redditHdr = {};
        rp.reddit.api = rp.reddit.base;
        $('#redditLogin').html(googleIcon('account_box'));
        $('#redditLogin').attr('title', 'Expired');
        $('label[for=login]').html(googleIcon('menu'));
        log.info("Clearing bearer is obsolete EOL:"+rp.login.reddit.expire+" < now:"+currentTime());
        clearConfig(configNames.redditBearer);
        clearConfig(configNames.redditRefreshBy);
    };

    var setRedditInfoHtml = function(blob) {
        var div = $('<div />').html(unescapeHTML(blob));
        // fixup links
        div.find("a").each(function(_i, item) {
            if (originOf(item.href) == window.location.origin) {
                $(item).addClass("local");
                var a = pathnameOf(item.href).split("/");
                if ((a[1] == "user" || a[1] == "u") && a[3] == "m" && rp.redditcache.multi[a[2]]) {
                    for (var i = 0; i < rp.redditcache.multi[a[2]].data.length; ++i) {
                        if (a[4] == rp.redditcache.multi[a[2]].data[i].data.name) {
                            if (rp.redditcache.multi[a[2]].data[i].data.visibility == "private")
                                item.href = "/me/m/"+a[4];
                            break;
                        }
                    }
                }
            }
        });
        $('#subRedditInfo').html(div.html());
    };

    var redditMultiAppend = function(data, list) {
        var base = rpurlbase();
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
            if (path.endsWith('/'))
                path = path.slice(0,-1);
            if (item.data.over_18)
                cl += " show-nsfw";
            if (path == base)
                setRedditInfoHtml(item.data.description_html);

            var link = redditLink(path, item.data.description_md, item.data.display_name, true);

            list.append($('<li>', {class: cl}).html(link));
        });
        updateSelected();
    };

    var loadRedditMultiList = function () {
        var jsonUrl = rp.reddit.api+'/api/multi/mine';
        var handleData = function(data, status) {
            var list = $('#multiListDiv ul:first-of-type');
            list.empty();
            if (data.length)
                rp.login.reddit.user = data[0].data.owner
            if (status)
                updateRedditMultiCache(rp.login.reddit.user, data);
            redditMultiAppend(data, list);
        };

        if (checkRedditMultiCache(rp.login.reddit.user))
            handleData(rp.redditcache.multi[rp.login.reddit.user].data)

        else
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
        return time+Math.ceil(currentTime());
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
        } else if ('refresh_token' in data)
            data.grant_type = 'refresh_token';
        else
            throw "Unknown Code Flow: "+data;

        var jsonUrl = 'https://www.reddit.com/api/v1/access_token';
        var handleData = function(data) {
            var by = redditExpiresToTime(data.expires_in);
            setupRedditLogin(data.access_token, by);
            // @@ verify scope
            rp.session.redditRefreshToken = data.refresh_token;
            setConfig(configNames.redditRefresh, data.refresh_token);
            if (url)
                processUrl(url);
            loadRedditMultiList();
        };
        var handleError = function(xhr, _ajaxOptiosn, thrownError) {
            log.error("Failed to get auth token: "+thrownError);
            clearRedditLogin();
            processUrl(url);
        };

        $.ajax({
            url: jsonUrl,
            method: 'POST',
            data: data,
            dataType: 'json',
            headers: {
                "Authorization": "Basic " + btoa(rp.api_key.reddit + ":")
            },
            success: handleData,
            error: handleError,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var setupRedditLogin = function (bearer, by) {
        if ((hostnameOf(rp.redirect) != window.location.hostname) ||
            rp.login.reddit.expire > (currentTime())-60)
            return;
        if (bearer === undefined) {
            bearer = getConfig(configNames.redditBearer, '');
            by = getConfig(configNames.redditRefreshBy, 0);
        }
        $('#redditLogin').attr('href', rp.reddit.loginUrl + '?' +
                                 ['client_id=' + rp.api_key.reddit,
                                  'response_type=code',
                                  'state='+encodeURIComponent(rp.url.path),
                                  'redirect_uri='+encodeURIComponent(rp.redirect),
                                  'duration=permanent',
                                  // read - /r/ALL, /me/m/ALL
                                  // history - /user/USER/submitted
                                  'scope=read,history'].join('&'));
        if (by-60 > currentTime()) {
            var d = new Date(by*1000);
            log.info("Reddit Token Expire: "+d);
            rp.login.reddit.expire = by;
            rp.session.redditHdr = { Authorization: 'bearer '+bearer };
            $('.needlogin').show();
            $('#redditLogin').html(googleIcon('verified_user'));
            $('#redditLogin').attr('title', 'Expires at '+d);
            $('label[for=login]').html(googleIcon('menu_open'));
            rp.reddit.api = rp.reddit.oauth;
            setConfig(configNames.redditBearer, bearer);
            setConfig(configNames.redditRefreshBy, by);
            loadRedditMultiList();

        } else
            clearRedditLogin();
    };
    rp.fn.setupRedditLogin = setupRedditLogin;

    var setupChoices = function () {
        var arr = rp.choices[rp.url.site][rp.url.type];
        var base = rpurlbase();
        var list = $('#subredditPopup ul');
        var i, a, li;
        list.empty();
        if (arr && arr.length) {
            var prefix = (base == '/') ?'' :'/';
            var choice = rp.url.choice.split(':')[0] || arr[0];

            i = 0;
            while (i < arr.length) {
                var name = arr[i].split(':');
                a = choiceLink(base+((i) ?prefix+arr[i] :""), name[0], arr[i]);
                if (name[0] == choice)
                    a.addClass('selected');
                li = $('<li>').append(a);

                ++i;
                var next = (i < arr.length) ?arr[i].split(':') :[];
                while (next[0] == name[0]) {
                    a = choiceLink(base+prefix+arr[i], next[1][0].toUpperCase(), arr[i]);
                    if (rp.url.choice == arr[i])
                        a.addClass('selected');
                    li.append(a);
                    ++i;
                    next = (i < arr.length) ?arr[i].split(':') :[];
                }
                list.append(li);
            }
        }

        $('#choiceTitle').text(base).show();
        $('#subRedditInfo').html("&nbsp;");
        var user;
        if (rp.url.site == 'reddit')
            user = (rp.url.type == 'm' || rp.url.type == 'submitted')
            ? (rp.url.sub) ?rp.url.sub :rp.login.reddit.user :rp.login.reddit.user;
        if (user) {
            list.append($('<li>').append($('<hr>', { class: "split" })));
            list.append($('<li>').append(redditLink(localUserUrl("reddit", user), "submitted", "submitted", true)));
            if (user == rp.login.reddit.user)
                list.append($('<li>').append(redditLink("/r/friends", "friends", "friends", true)));

            var jsonUrl = rp.reddit.api + '/api/multi/user/' + user;
            var handleData = function (data, status) {
                if (status)
                    updateRedditMultiCache(user, data);
                if (data.length) {
                    var list = $('#subredditPopup ul');
                    list.append($('<li>').append($('<hr>', { class: "split" })));
                    redditMultiAppend(data, list);
                }
            };

            if (checkRedditMultiCache(user))
                handleData(rp.redditcache.multi[user].data)

            else
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

        if (rp.url.type) {
            switch (rp.url.site) {
            case 'e621':
            case 'danbooru':
            case 'flickr':
            case 'gfycat':
            case 'imgur':
                if (list[0].firstChild)
                    list.append($('<li>').append($('<hr>', { class: "split" })));
                list.append($('<li>').append(choiceLink('/'+rp.url.site, '/'+rp.url.site, rp.url.site)));
                arr = rp.url.sub.split(/[+,]/);
                if (arr.length > 1) {
                    for (i in arr) {
                        var d = siteTagDisplay(rp.url.site, arr[i]);
                        a = arr.slice();
                        a.splice(i, 1);
                        list.append(
                            $('<li>').append(choiceLink('/'+rp.url.site+'/t/'+a.join('+'), '[-]', "Remove `"+d+"' tag"))
                                .append(choiceLink('/'+rp.url.site+'/t/'+arr[i], d, "Only `"+d+"' tag"))
                        );
                    }
                }
                break;
            case 'blogger':
            case 'wp':
            case 'wp2':
                if (list[0].firstChild)
                    list.append($('<li>').append($('<hr>', { class: "split" })));
                // @@ name blogTitle() / blogBlogLink()
                list.append($('<li>').append(choiceLink('/'+rp.url.site+'/'+rp.url.sub, '/'+rp.url.site+'/'+rp.url.sub, rp.url.sub)));
                break;
            }
        }
        if (list[0].firstChild)
            $('#choiceLi').show();
        else
            $('#choiceLi').hide();

        // Load Sub Info
        if (rp.url.site != "reddit" ||
            rp.url.type != "r" ||
            rp.url.sub.includes('+') ||
            ["all", "popular", "random", "randnsfw"].includes(rp.url.sub))
            return;

        var jsonUrl2 = rp.reddit.api + base + '/about.json';
        var handleT5Data = function (data, status) {
            if (status)
                updateRedditSubCache(data.data);
            setRedditInfoHtml((data.data.public_description) ?data.data.public_description_html :data.data.description_html);
        };

        if (checkRedditSubCache(rp.url.sub))
            handleT5Data(rp.redditcache.sub[rp.url.sub.toLowerCase()])

        else
            $.ajax({
                url: jsonUrl2,
                headers: rp.session.redditHdr,
                dataType: 'json',
                success: handleT5Data,
                error: failedAjax,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true,
            });
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
        var fqdn = hostnameOf(photo.o_url, false);

        if (dupe) {
            shortid = dupe.id;
            // @@ blog
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

        } else if (photo.site && photo.site.t == 'flickr') {
            site = 'flickr.com';
            shortid = url2shortid(photo.o_url, 3);
        }

        if (site === undefined) {
            site = hn;
            if (hn == 'fav.me' ||
                hn == 'imgur.com' ||
                hn == 'gifs.com' ||
                hn == 'gfycat.com' ||
                hn == 'makeagif.com' ||
                hn == 'redd.it' ||
                hn == 'redgifs.com' ||
                hn == 'sta.sh')
                shortid = url2shortid(photo.url);

            else if (fqdn == 'danbooru.donmai.us') {
                shortid = url2shortid(photo.o_url);
                site = fqdn;

            } else
                return;
        }

        var now = currentTime();
        if (!rp.loaded[site])
            rp.loaded[site] = {};
        if (rp.loaded[site][shortid] > (now-rp.settings.dupeCacheTimeout))
            return;
        rp.loaded[site][shortid] = now;

        // Load Tags for site
        if (!hasPhotoSiteTags(photo)) {
            var jurl, tagData;
            var dtype = 'json';
            var hdata = {};

            if (site == "flickr.com" && !isNaN(parseInt(shortid, 10))) {
                log.info("getting flickr tags: "+shortid);
                jurl = flickrJsonURL("flickr.photos.getInfo", { photo_id: shortid });
                tagData = function(post) {
                    if (post.stat == "fail") {
                        log.info("Failed to getInfo("+shortid+"): "+post.message);
                        return;
                    }
                    addPhotoSite(photo, 'flickr', post.photo.owner.nsid);
                    cacheSiteUser("flickr", post.photo.owner.username, post.photo.owner.nsid);
                    if (post.photo.tags.tag)
                        addPhotoSiteTags(photo, post.photo.tags.tag.map(function(x) { return x.raw }));
                    if (isActiveCurrent(photo)) {
                        updateAuthor(photo);
                        updateDuplicates(photo);
                    }
                };
                dtype = 'jsonp';

            } else if (site == "imgur.com") {
                log.info("getting imgur tags: "+shortid);
                jurl = 'https://api.imgur.com/3/image/'+shortid;
                tagData = function(data) {
                    handleImgurItemMeta(photo, data.data);
                    if (isActiveCurrent(photo))
                        updateDuplicates(photo);
                };
                hdata = { Authorization: "Client-ID "+ rp.api_key.imgur };
            }

            if (jurl)
                $.ajax({
                    url: jurl,
                    dataType: dtype,
                    headers: hdata,
                    success: tagData,
                    error: ignoreError,
                    timeout: rp.settings.ajaxTimeout,
                    crossDomain: true,
                });
        }

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
                var jurl = rp.reddit.api + '/duplicates/' + item.data.id + '.json?show=all';
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
                    headers: rp.session.redditHdr,
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
            var index = addPhotoDupe(photo, redditT3ToDupe(item.data));
            dedupArrAdd(dupes, item.data.subreddit, item.data.id);
            if (index >= 0)
                getRedditComments(photo, photo.dupes[index]);
        };

        // https://www.reddit.com/search.json?q=url:SHORTID+site:HOSTNAME
        var jsonUrl = rp.reddit.api + '/search.json?include_over_18=on&q=url:'+shortid+'%20site:'+site;
        var headerData = rp.session.redditHdr;
        var handleData = function (data) {
            if (isActive(photo))
                updateExtraLoad();
            if (data.data.dist == 0)
                return;
            data.data.children.forEach(handleT3Dupe);
            if (isActive(photo)) {
                var pic = getCurrentPic();
                updateDuplicates(pic);
            }
        };

        log.info("loading alternate submissions: "+site+":"+shortid);
        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            headers: headerData,
            success: handleData,
            error: failedAjax,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true,
        });
    };

    // Photo is already marked as album
    var processRedditComment = function(photo, comment) {
        var j;
        if (photo.type != imageTypes.album)
            throw "Photo must be album"
        if (comment.kind == "more") {
            // @@ API hits CORS issue
            // var jsonUrl = rp.reddit.base+'/api/morechildren';
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
        if (rp.reddit.skipped_bots.includes(comment.data.author)) {
            log.debug("skipped comment from ["+comment.data.author+"]: "+comment.data.permalink);
            return;
        }

        if (comment.data.score >= rp.settings.minScore) {
            var links = [];
            if (comment.data.body_html) {
                var ownerDocument = document.implementation.createHTMLDocument('virtual');
                links = $('<div />', ownerDocument).html(unescapeHTML(comment.data.body_html)).find('a');

            } else
                log.info("cannot display comment [no body]: "+comment.data.permalink);

            for (j = 0; j < links.length; ++j) {
                var img = { author: comment.data.author,
                            url: links[j].href
                          };

                if (links[j].innerText !== "" &&
                    links[j].innerText !== img.url)
                    fixupPhotoTitle(img, links[j].innerText, photo.subreddit);

                log.debug("RC-Try:["+photo.comments+"]:"+img.url);
                if (processPhoto(img))
                    addAlbumItem(photo, img);
            }
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
            // comments = [rp.rp.reddit.base, "comments", id].join('/');
            if (!dupe.commentN || dupe.eL)
                return;
            dupe.eL = true;
            comments = [rp.reddit.base, 'r', dupe.subreddit, "comments", dupe.id].join("/");

        } else {
            // Only load comments once per photo
            if (photo.eL)
                return;

            photo.eL = true;

            if (!photo.commentN || !photo.comments)
                return;
            comments = photo.comments;
        }

        var jsonUrl = rp.reddit.base + pathnameOf(comments) + '.json';
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

    // Reddit T3 to duplicate (photo.dupes[N])
    var redditT3ToDupe = function(item) {
        var dupe = { subreddit: item.subreddit,
                     commentN: item.num_comments,
                     title: item.title,
                     date: item.created,
                     id: item.id };
        if (item.author != "[deleted]")
            dupe.a = item.author;
        return dupe
    };

    // T3 is reddit post
    var processRedditT3 = function(photo, t3) {
        var val;
        var link = '/r/'+photo.subreddit+'/'+photo.id;

        if (t3.preview)
            addPhotoThumb(photo, t3.preview.images[0].source.url);
        else if (t3.thumbnail != 'default' && t3.thumbnail != 'nsfw')
            addPhotoThumb(photo, t3.thumbnail);

        // Reddit Gallery Function
        if (t3.gallery_data ||
            (t3.crosspost_parent_list && t3.crosspost_parent_list.length &&
             t3.crosspost_parent_list[0].gallery_data)) {

            val = dedupAdd(t3.domain, pathnameOf(t3.url_overridden_by_dest), link);
            if (val) {
                log.info("cannot display url [duplicate:"+val+"]: "+photo.url);
                return false;
            }
            photo = initPhotoAlbum(photo, false);
            var t3g = (t3.gallery_data) ?t3 :t3.crosspost_parent_list[0]

            t3g.gallery_data.items.forEach(function(item) {
                var media = t3g.media_metadata[item.media_id];
                if (media.status == "failed" || media.status == "unprocessed")
                    return false;
                var pic = fixupPhotoTitle({}, item.caption, photo.subreddit);
                addPhotoExtraLink('link', item.outbound_url);

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
        else if (t3.domain == 'v.redd.it' && (t3.media || t3.secure_media)) {
            val = dedupAdd(t3.domain, url2shortid(photo.url), link);
            if (val) {
                log.info("cannot display url [duplicate:"+val+"]: "+photo.url);
                return false;
            }
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

        } else if (t3.domain == 'i.redd.it' &&
                   extensionOf(photo.url) == 'gif' &&
                   t3.preview && t3.preview.images[0].variants && t3.preview.images[0].variants.mp4) {
            val = dedupAdd(t3.domain, url2shortid(photo.url), link);
            if (val) {
                log.info("cannot display url [duplicate:"+val+"]: "+photo.url);
                return false;
            }
            photo.o_url = photo.url;
            initPhotoVideo(photo, unescapeHTML(t3.preview.images[0].variants.mp4.source.url));

        } else if (!photo.url && (Object.keys(t3.secure_media_embed).length != 0 || Object.keys(t3.media_embed).length != 0)) {
            // @@ use .(secure_)media.oembed?
            var html = (t3.secure_media_embed.content) ?t3.secure_media_embed.content :t3.media_embed.content;
            var ownerDocument = document.implementation.createHTMLDocument('virtual');
            var iframe = $('<div />', ownerDocument).html(unescapeHTML(html)).find('iframe')[0];
            if (iframe) {
                photo.url = iframe.src;

            } else {
                log.error(photo.id+": cannot display embed [bad media_embed]");
                return false;
            }

        } else if (t3.domain == 'reddit.com') {
            // these shouldn't be added via tryPreview nor speculative lookups
            log.info('will not display url [no image '+photo.id+']: ' + (photo.o_url || photo.url));
            return false;
        }

        return true;
    };

    var getRedditCrossposts = function(photo) {
        var handleDuplicatesData = function(data) {
            var item = data[0].data.children[0];

            var i;
            for(i = 0; i < data[1].data.children.length; ++i) {
                var dupe = data[1].data.children[i];
                if (dupe.data.subreddit.startsWith("u_")) {
                    log.debug(" ignoring duplicate [user sub]: "+dupe.data.subreddit);
                    continue;
                }
                var link = '/r/'+item.data.subreddit+'/'+item.data.id;
                var cross_link = dedupAdd(dupe.data.subreddit, dupe.data.id, link);
                if (cross_link)
                    log.info('existing dupe url [cross-dup: '+cross_link+']: '+item.data.url);
                if (cross_link == "SELF")
                    log.info('existing dupe url [non-self dup]: '+item.data.url);
                for (var d of processT3Parents(link, [ redditT3ToDupe(dupe.data) ], dupe, true)) {
                    if (addPhotoDupe(photo, d) >= 0)
                        getRedditComments(photo, d);
                }
            }
            updateDuplicates(photo);
        };

        if (rp.url.site != 'reddit')
            return;

        // @@ find way to reduce duplication of this call

        var jsonUrl = rp.reddit.api + '/duplicates/' + photo.id + '.json?show=all';

        // Don't use oauth'd API for this, if oauth has expired,
        // lots of failures happen, and oauth adds nothing here.
        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            headers: rp.session.redditHdr,
            success: handleDuplicatesData,
            error: failedAjaxDone,
            jsonp: false,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var duplicateInList = function(duplicates, item) {
        for (var dup of duplicates) {
            if (dup.id == item.id && dup.subreddit == item.subreddit)
                return true;
        }
        return false;
    };

    /// og_link - link to original item
    /// duplicates - accumulator array
    /// search_item - t3 of item to check
    var processT3Parents = function(og_link, duplicates, search_item, ignore_cross) {
        if (ignore_cross === undefined)
            ignore_cross = false;
        if (search_item.crosspost_parent_list === undefined)
            return duplicates;
        for (var item of search_item.crosspost_parent_list) {
            var cross_link = dedupAdd(item.subreddit, item.id, og_link);
            if (item.score < rp.settings.minScore) {
                log.info("skipping [score too low]: /r/"+item.subreddit+"/"+item.id);
            } else if (!item.subreddit.startsWith("u_") && !duplicateInList(duplicates, item)) {
                if (cross_link && !ignore_cross)
                    throw "cross-dup: "+cross_link;
                duplicates.push(redditT3ToDupe(item));
            }
            duplicates = processT3Parents(og_link, duplicates, item);
        }
        return duplicates;
    };

    var getRedditImages = function () {
        if (!setupLoading(1, "No Reddit Pics"))
            return;

        setupRedditLogin();

        var order = rp.url.choice.split(':');
        // limit set to 100 because of API query rate limiting
        var jsonUrl = rp.reddit.api + rpurlbase() + ((order[0]) ? "/"+order[0] :"") + ".json?";
        var dataType = 'json';
        var hdrData = rp.session.redditHdr;
        var urlargs = [ 'limit=100' ];

        if (order.length > 0 && order[0])
            urlargs.push('sort='+order[0]);
        if (order.length > 1)
            urlargs.push('t='+order[1]);
        if (rp.session.after)
            urlargs.push('after='+rp.session.after);

        if (rp.url.type == 'search') {
            jsonUrl = rp.reddit.api + '/search.json?';
            urlargs.push('q='+encodeURIComponent(rp.url.sub));

        } else if (rp.url.sub == 'random' || rp.url.sub == 'randnsfw') {
            jsonUrl = rp.reddit.base + rpurlbase() + '.json?jsonp=redditcallback';
            dataType = 'jsonp';
            urlargs = [];
        }

        jsonUrl += urlargs.join('&');

        var handleData = function (data) {
            //redditData = data //global for debugging data
            // NOTE: if data.data.after is null then this causes us to start
            // from the top on the next getRedditImages which is fine.
            if (data.data.after !== null && data.data.after != rp.session.after) {
                rp.session.after = data.data.after;
                rp.session.loadAfter = getRedditImages;

            } else
                rp.session.loadAfter = null;

            if (data.data.children.length === 0) {
                log.info("No more data");
                doneLoading();
                return;
            }

            // Watch out for "fake" subreddits
            if (rp.url.site == 'reddit' && rp.url.type == 'r' && (rp.url.sub == 'random' || rp.url.sub == 'randnsfw')) {
                // add rest of URL to subreddit e.g. /r/random/top
                rp.url.sub = data.data.children[0].data.subreddit;
                var base = rpurlbase();
                log.info("ACTUAL: "+base);

                setSubredditLink(rp.reddit.base + base + (rp.url.choice) ?'/'+rp.url.choice :'', "reddit");
                $('#subredditUrl').val(base);
                // fix choices after determining correct subreddit
                setupChoices();
            }

            data.data.children.forEach(function (item) {
                // Text entry, no actual media
                if (item.kind != "t3") {
                    log.info('cannont display url [not link]: '+item.kind);
                    return;
                }

                var t3 = item.data;

                if (t3.is_self) {
                    log.info('cannot display url [self-post]: '+t3.url);
                    return;
                }
                if (t3.score < rp.settings.minScore) {
                    log.info('cannot display url [score too low: '+t3.score+']: '+t3.url);
                    return;
                }

                var val = dedupVal(t3.subreddit, t3.id);
                if (val) {
                    log.info('cannot display url [duplicate:'+val+']: '+t3.url);
                    return;
                }
                var duplicates = [];
                var link = "/r/"+t3.subreddit+"/"+t3.id;
                try {
                    duplicates = processT3Parents(link, duplicates, t3);
                } catch (e) {
                    return log.info('cannot display url [duplicate:'+e+']: '+t3.url);
                }
                duplicates.sort(subredditCompare);

                // parse parent if crosspost
                var t3x = t3;
                while (t3x.crosspost_parent_list !== undefined &&
                       t3x.crosspost_parent_list.length > 0)
                    t3x = t3x.crosspost_parent_list[0];

                var photo = {
                    url: t3x.url || t3x.url_overridden_by_des || t3.url || t3.url_overridden_by_dest,
                    title: t3.title,
                    id: t3.id,
                    over18: t3.over_18,
                    subreddit: t3.subreddit,
                    date: t3.created_utc,
                    score: t3.score,
                    commentN: t3.num_comments,
                    comments: rp.reddit.base + t3.permalink
                };
                if (duplicates.length)
                    photo.dupes = duplicates;
                if (t3x.id != photo.id)
                    photo.cross_id = t3x.id;

                // Add flair (but remove if also in title)
                var flair = redditFlair(t3.link_flair_type, t3.link_flair_text, t3.link_flair_richtext);
                if (flair) {
                    photo.flair = flair;
                    var toremove = [];
                    flair = t3.link_flair_text.replace(/:[^:]+:/g, "").trim();
                    if (flair)
                        toremove.push(flair);
                    if (flair.match(/instagram/i))
                        toremove.push("ig");
                    var f = photo.flair.match(/\b(\w)/g);
                    if (f)
                        toremove.push(f.join(''));
                    for(var lem of toremove) {
                        var re = new RegExp('[\\[\\{\\(]'+RegExp.quote(lem)+'[\\]\\}\\)]', "ig");
                        photo.title = photo.title.replace(re, "").trim();
                    }
                }
                flair = redditFlair(t3.author_flair_type, t3.author_flair_text, t3.author_flair_richtext);
                if (flair)
                    photo.aflair = flair;

                if (t3.author != "[deleted]")
                    photo.author = t3.author;

                photo = fixupPhotoTitle(photo);

                if (processRedditT3(photo, t3) &&
                    processPhoto(photo))
                {
                    flair = picFlair(photo).toLowerCase();

                    if ((photo.type != imageTypes.fail) &&
                        (flair == 'request' ||
                         photo.title.match(/[[({]request[\])}]/i) ||
                         photo.title.match(/^psbattle:/i) ||
                         // Album/Video/Source/More in comments
                         flair.match(/(more|source|video|album).*in.*com/) ||
                         t3.title.match(/(source|more|video|album).*in.*com/i) ||
                         t3.title.match(/in.*comment/i) ||
                         t3.title.match(/[[({\d\s][asvm]ic([\])}]|$)/i)))
                        getRedditComments(photo);

                    addImageSlide(photo);
                    dedupAdd(photo.subreddit, photo.id);
                }
            });
            doneLoading();
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
        // POPULAR:     /imgur/[/CHOICES]
        // USER:        /imgur/u/USER[/CHOICES]
        // TAG:         /imgur/t/TAG[/CHOICES]
        var errmsg;
        var jsonUrl;
        var handleData;
        var order = rp.url.choice.split(':');
        rp.url.sub = rp.url.sub.replaceAll(" ", "_");

        if (!rp.session.after) {
            rp.session.after = 1;
            rp.session.loadAfter = getImgur;
        }

        var processPostItem = function(item) {
            var pic = {
                url: item.url,
                title: item.title || item.description,
                over18: item.is_mature,
                id: item.id,
                score: item.point_count,
            };
            handleImgurItemMeta(pic, item);
            fixupPhotoTitle(pic);
            addImageSlide(pic);
        };

        switch(rp.url.type) {
        case 'u':
            errmsg = "User "+rp.url.sub+" has no items";
            setSubredditLink(siteUserUrl('imgur', rp.url.sub));
            jsonUrl = 'https://api.imgur.com/3/account/' + rp.url.sub + '/submissions/'+rp.session.after+'/';
            switch(rp.url.choice) {
            case 'best': jsonUrl += "best"; break;
            case 'old': jsonUrl += "oldest"; break;
            default: jsonUrl += "newest"; break; // new | ''
            }
            handleData = function (data) {
                if (data.status != 200 || !data.success)
                    return doneLoading();

                data.data.forEach(function (item) {
                    // @@ item_count == 1, image is item.cover
                    var pic = {
                        url: item.link,
                        title: item.title || item.description,
                        over18: item.nsfw,
                        date: item.datetime,
                        id: item.id,
                        score: item.points,
                    };
                    handleImgurItemMeta(pic, item);
                    fixupPhotoTitle(pic);
                    pic = handleImgurItemAlbum(pic, item);
                    addImageSlide(pic)
                });
                ++rp.session.after;

                doneLoading();
            };
            break;
        case 't':
            errmsg = "Tag "+rp.url.sub+" has no items";
            setSubredditLink(siteTagUrl('imgur', rp.url.sub, order));
            jsonUrl = 'https://api.imgur.com/post/v1/posts/t/'+rp.url.sub+"?mature=true&page="+rp.session.after;
            switch(order[0]) {
            case 'top': jsonUrl += "&sort=-top"+((order[1]) ?"&filter[window]="+order[1] :""); break;
            case 'new': jsonUrl += "&sort=-time"; break;
            default: jsonUrl += "&sort=-viral"; break; // hot | ""
            }
            handleData = function (data) {
                data.posts.forEach(processPostItem);
                ++rp.session.after;

                doneLoading();
            };
            break;
        default:
            errmsg = "No popular items";
            setSubredditLink('https://imgur.com');
            jsonUrl = 'https://api.imgur.com/post/v1/posts?mature=true&filter[section]=eq:'+
                order[0]+((order[1]) ?'&filter[window]='+order[1] :'')+'&page='+rp.session.after;
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

    var processHaystack = function(photo, html, o_link) {
        var processNeedle = function(pic, item) {
            var src;
            if (item.tagName == 'IMG') {
                // Fixup item.src
                for (var attr of ["src", "data-src"]) {
                    var val = item.getAttribute(attr);
                    if (val === null)
                        continue;
                    val = unescapeHTML(val);
                    if (val.startsWith('//'))
                        val = ((rp.insecure[hostnameOf(val)]) ?"http:" :"https:")+val;
                    else if (val.startsWith('/'))
                        val = originOf(pic.url)+val;
                    if (!val.startsWith("http"))
                        continue;
                    src = val;
                    break;
                }
                // Shortcut <A href="video/embed"><img src="url" /></a>
                if (item.parentElement.tagName == 'A') {
                    pic.url = item.parentElement.href;
                    if (processPhoto(pic) && pic.type != imageTypes.later) {
                        addPhotoThumb(pic, src);
                        return true;
                    }
                    delete pic.type;
                }

                if (!src)
                    return false;

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

                var orig_src = src;
                // Attempt to get largest res available
                pic.url = src.replace(/-(scaled|\d+x\d+).jpg$/, '.jpg');
                addPhotoFallback(pic, orig_src);

                if (item.alt)
                    pic.title = item.alt;

            } else if (item.tagName == 'VIDEO') {

                initPhotoVideo(pic, [], item.poster);

                item.childNodes.forEach(function(source) {
                    if (source.nodeName != "SOURCE")
                        return;
                    var src = source.getAttribute('src');
                    if (src === null)
                        return;
                    // unescape and remove chaff
                    src = unescapeHTML(src).replace(/\?_=\d+$/, '');
                    if (src.startsWith('//'))
                        src = ((rp.insecure[hostnameOf(src)]) ?"http:" :"https:")+src;
                    else if (src.startsWith('/'))
                        src = originOf(pic.url)+src;

                    if (rp.mime2ext[source.type])
                        addVideoUrl(pic, rp.mime2ext[source.type], fixupUrl(src));
                    else
                        log.info("Unknown type: "+source.type+" at: "+src);
                });

            } else if (item.tagName == 'IFRAME') {
                // let processPhoto() do initPhotoEmbed() if it's processable
                src = item.getAttribute('src');
                if (src === null)
                    return false;
                pic.url = unescapeHTML(src);

            } else if (item.tagName == 'A') {
                // let processPhoto() do initPhotoEmbed() if it's processable
                src = item.getAttribute('href');
                if (src === null)
                    return false;
                pic.url = unescapeHTML(src);
                return (processPhoto(pic) && pic.type != imageTypes.later);

            } else {
                return false;
            }
            return true;
        };

        var rc = false;

        photo = initPhotoAlbum(photo);
        // Create virtual document so that external references are not loaded
        var ownerDocument = document.implementation.createHTMLDocument('virtual');
        $('<div />', ownerDocument).html(html).find('img, video, iframe, a').each(function(_i, item) {
            // init url for relative urls/srcs
            var pic = {
                url: item.src || item.currentSrc || item.href,
                title: item.alt || item.title,
            };
            if (o_link)
                pic.o_url = o_link;
            if (processNeedle(pic, item) &&
                processPhoto(pic) &&
                !isAlbumDupe(photo, pic.url.replace(/-\d+x\d+\./, ".")))
            {
                addAlbumItem(photo, pic);
                rc = true;
            }
        });
        return rc;
    };

    /////////////////////////////////////////////////////////////////
    // WordPress (v2)
    //
    // https://developer.wordpress.org/rest-api/reference/

    // This is for processing /wp-json/wp/v2/posts
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
        // lookup missing tags, then go around again
        var missing_tags = blogTagMissing({t: 'wp2', b: hn}, post.tags);
        if (missing_tags.length)
            return refreshWP2Tags(hn, missing_tags, function() {
                getPostWPv2(photo, post, errorcb, successcb);
            }, function() { if (errorcb) errorcb(photo);});

        var o_link = post.link;

        photo = initPhotoAlbum(photo, false);
        if (!photo.blog) {
            photo.blog = { t: 'wp2', b: hn, id: post.id };
            addPhotoBlogTags(photo, post.tags);
        }
        if (photo.o_url === undefined)
            photo.o_url = photo.url;
        var rc = false;

        if (post.content && processHaystack(photo, post.content.rendered, o_link))
            rc = true;

        if (post.description && processHaystack(photo, post.description.rendered, o_link))
            rc = true;

        if (post.yoast_head_json) {
            if (post.yoast_head_json.og_image) {
                post.yoast_head_json.og_image.forEach(function(item) {
                    if (item.url == photo.url)
                        return;
                    var pic = { url: item.url, title: post.yoast_head_json.og_title, o_url: o_link };
                    fixupPhotoTitle(pic);
                    if (processPhoto(pic)) {
                        addAlbumItem(photo, pic);
                        rc = true;
                    }
                });
            }
        }

        if (!post._links) {
            checkPhotoAlbum(photo);
            if (rc)
                successcb(photo);
            else if (errorcb)
                errorcb(photo);
            return;
        }

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
                    var pic = { url: fixupUrl(item.guid.rendered),
                                o_url: o_link,
                                title: item.title.rendered || unescapeHTML(item.caption.rendered) || item.alt_text };
                    addPhotoFallback(pic, item.source_url);
                    fixupPhotoTitle(pic);
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

    var wp2BaseJsonUrl = function(hostname) {
        var scheme = (rp.insecure[hostname]) ?'http' :'https';
        return scheme+'://'+hostname+'/wp-json/wp/v2/posts/';
    };

    var toWPslug = function(name) {
        return name.toLowerCase().replaceAll(' ', '-');
    };

    // tags can be either [ id, id, id] or "slug"
    var refreshWP2Tags = function(hostname, tags, doneLoading, errorcb) {
        var scheme = (rp.insecure[hostname]) ?'http' :'https';
        var jsonUrl = scheme+'://'+hostname+'/wp-json/wp/v2/tags?orderby=count&order=desc&per_page=100';
        if (Array.isArray(tags)) {
            if (tags.length)
                jsonUrl += '&include='+tags.join(",");
        } else if (tags)
            jsonUrl += '&slug='+toWPslug(tags);
        var handleData = function(tags) {
            // @@ check for err
            tags.forEach(function(item) {
                cacheBlogTag({t: 'wp2', b: hostname}, item.id, item.name);
            });
            if (doneLoading)
                doneLoading();
        };
        var failCB = function (xhr, ajaxOptions, thrownError) {
            if (errorcb)
                errorcb();
            else
                failedAjax(xhr, ajaxOptions, thrownError);
        };
        $.ajax({
            url: jsonUrl+'&_jsonp=?',
            dataType: 'jsonp',
            success: handleData,
            error: failCB,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var getWordPressBlogV2 = function () {
        // Path Schema:
        // /wp2/HOSTNAME[/CHOICES]
        // /wp2/HOSTNAME/t/TAG[/CHOICES]
        var hostname = rp.url.sub;

        if (rp.wp[hostname] === 0) {
            doneLoading("not WP site: "+hostname);
            return;
        }

        var blog = {t: 'wp2', b: hostname};
        refreshBlogTitle(blog);

        if (blogTagCount(blog) == 0) {
            // @@ UI add loading message
            log.info("Loading tags for "+hostname);
            return refreshWP2Tags(hostname, undefined, getWordPressBlogV2);
        }

        var jsonUrl = wp2BaseJsonUrl(hostname)+'?orderby=date&order='+((rp.url.choice == 'old') ?'asc' :'desc');

        // Multiple tags results in an OR relationship
        if (rp.url.type == 't') {
            var tags = [];
            var tn = [];
            for (var tag of decodeURIComponent(rp.url.multi).split(/[,+&]\s*/)) {
                tag = toWPslug(tag);
                var xs = wp2RevTag(hostname, tag);
                if (xs)
                    tags.push(xs);
                tn.push(tag);
            }
            if (tags.length == 0 || tags.length != tn.length)
                return refreshWP2Tags(hostname, tn, getWordPressBlogV2, function() { doneLoading("Bad Tag")});
            jsonUrl += '&tags='+tags.join("+");
            setSubredditLink('https://'+hostname+'/tag/'+tn.join("+"));

        } else
            setSubredditLink('https://'+hostname);

        if (rp.session.after !== "")
            jsonUrl += '&offset='+rp.session.after;
        else
            rp.session.after = 0;

        if (!setupLoading(1, "No blog entries"))
            return;

        var handleData = function (data) {
            if (rp.wp[hostname] != 2) {
                rp.wp[hostname] = 2;
                setConfig(configNames.wp, rp.wp);
            }
            if (!Array.isArray(data)) {
                log.error("Something bad happened: "+data);
                failedAjaxDone();
                return;

            } else
                rp.session.loadAfter = (data.length) ?getWordPressBlogV2 :null;
            rp.session.after = rp.session.after + data.length;
            var missing = blogTagMissing({t:'wp2', b:hostname}, [].concat.apply([], data.map(function(x) { return x.tags; })));
            if (missing.length)
                return refreshWP2Tags(hostname, missing, function() { handleData(data) }, failedAjaxDone);

            data.forEach(function(post) {
                var photo = fixupPhotoTitle(
                    {
                        id: post.id,
                        url: post.link,
                        over18: false,
                        date: processDate(post.date_gmt, "Z"),
                    },
                    post.title.rendered
                );
                getPostWPv2(photo, post, function() { log.info("cannot display WPv2 [no photos]: "+photo.url) });
            });
            doneLoading();
        };
        var failedData = function (xhr, ajaxOptions, thrownError) {
            if (jsonUrl.startsWith('https:')) {
                log.info("Failed to load wp2:"+hostname+" via https trying http");
                rp.insecure[hostname] = true;
                setConfig(configNames.insecure, rp.insecure);
                jsonUrl = jsonUrl.replace(/^https/, 'http');
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
            rp.wp[hostname] = 0;
            delete rp.insecure[hostname];
            setConfig(configNames.wp, rp.wp);
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

    /////////////////////////////////////////////////////////////////
    // WordPress (v1)
    //
    // https://developer.wordpress.com/docs/api/
    // https://developer.wordpress.com/docs/api/1.1/get/sites/%24site/posts/
    var processWordPressPost = function(pic, post) {
        var rc = false;

        var hn = hostnameOf(post.URL);
        pic.blog = { t: 'wp', b: hn, id: post.ID }
        if (post.author) {
            pic.blog.user = post.author.login;
            cacheBlogUser(pic.blog, post.author.name, post.author.URL);
        }
        addPhotoBlogTags(pic, Object.keys(post.tags).map(function(k) {
            var x = post.tags[k];
            cacheBlogTag(pic.blog, x.slug, x.name);
            return x.slug;
        }));

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

        var photo = initPhotoAlbum(pic, false);
        for(var k in post.attachments) {
            var att = post.attachments[k];
            var img = { title: att.caption || att.title,
                        o_url: pic.url };
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

    var getWordPressBlog = function () {
        // Path Schema:
        // /wp/HOSTNAME[/CHOICES]
        // /wp/HOSTNAME/t/TAG
        var hostname = rp.url.sub;

        if (!hostname.includes('.'))
            hostname += '.wordpress.com';

        // If we know this fails, bail
        if (rp.wp[hostname]) {
            if (rp.wp[hostname] == 2) {
                getWordPressBlogV2();
                return;
            }
        } else if (rp.wp[hostname] === 0)
            return failCleanup("No Wordpress Blog for "+hostname);

        if (!setupLoading(1, "No wordpress entries"))
            return;

        refreshBlogTitle({t:'wp', b: hostname});

        var jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+hostname+'/posts?order_by=date';

        if (rp.url.type == 't') {
            setSubredditLink(blogTagUrl({t: 'wp', b: hostname}, rp.url.multi));
            jsonUrl += "&tag="+rp.url.multi;

        } else
            setSubredditLink('https://'+hostname);

        if (rp.url.choice == 'old')
            jsonUrl += '&order=ASC';
        else
            jsonUrl += '&order=DESC';

        if (rp.session.after !== "")
            jsonUrl = jsonUrl+'&offset='+rp.session.after;
        else
            rp.session.after = 0;

        var handleData = function (data) {
            if (rp.session.after < data.found) {
                rp.session.after = rp.session.after + data.posts.length;
                rp.session.loadAfter = getWordPressBlog;

            } else // Found all posts
                rp.session.loadAfter = null;

            data.posts.forEach(function(post) {
                var photo = { title: post.title,
                              id: post.ID,
                              url: post.URL,
                              over18: false,
                              date: processDate(post.date),
                              blog: { t: 'wp', b: hostname, id: post.ID },
                            };
                if (post.post_thumbnail)
                    addPhotoThumb(photo, post.post_thumbnail.URL);

                if (processWordPressPost(photo, post))
                    addImageSlide(photo);
                else
                    log.info("cannot display WP [no photos]: "+photo.url);
            });
            doneLoading();
        };

        var failedData = function () {
            doneLoading();
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

    /////////////////////////////////////////////////////////////////
    // Tumblr
    //
    // https://www.tumblr.com/docs/en/api/v2

    var tumblrJsonURL = function(hn, id) {
        var sid = "";
        if (id)
            sid = '&id='+id;
        // reblog_info=true to get "duplicate" information for reblogged_from_* and reblogged_root_*
        return 'https://api.tumblr.com/v2/blog/'+hn+'/posts?reblog_info=true&api_key='+rp.api_key.tumblr+sid;
    }

    var tumblrTagJsonURL = function(tag) {
        return 'https://api.tumblr.com/v2/tagged?tag='+tag+'&reblog_info=true&api_key='+rp.api_key.tumblr;
    };

    var tumblrPostToDupe = function(root_name, title, url, id, uuid) {
        var name = root_name.replace(/-deactivated\d+$/, '');
        return { tumblr: name,
                 off: (name != root_name),
                 title: title,
                 url: url,
                 id: (id) ?id :uuid.split('.')[0] };
    };

    var processTumblrPost = function(opic, post) {
        var rc = false;
        var isdupe = false;
        var pic;

        opic.blog = { t: 'tumblr',
                      b: post.blog_name,
                      id: post.id };
        addPhotoBlogTags(opic, post.tags);

        cacheBlogInfo(opic.blog, post.blog.title);

        var photo = initPhotoAlbum(opic, false);

        var val = dedupVal(post.blog_name, post.id);
        if (val) {
            log.info("cannot display url [duplicate:"+val+"]: "+opic.url);
            isdupe = true;

        } else if (opic == photo) {
            var d;
            if (post.reblogged_root_id && post.reblogged_root_name) {
                d = tumblrPostToDupe(post.reblogged_root_name, post.reblogged_root_title,
                    post.reblogged_root_url, post.reblogged_root_id, post.reblogged_root_uuid);
                val = dedupVal(d.name, d.id);
                if (val) {
                    isdupe = true;
                } else {
                    addPhotoDupe(photo, d);
                    dedupAdd(name, d.id, '/tumblr/'+photo.blog.b+'/'+photo.blog.id);
                    if (!photo.cross_id)
                        photo.cross_id = d.id;
                }
            }
            if (rc && post.reblogged_from_name && post.reblogged_from_id &&
                post.reblogged_from_id !== post.reblogged_root_id) {
                d = tumblrPostToDupe(post.reblogged_from_name, post.reblogged_from_title,
                    post.reblogged_from_url, post.reblogged_from_id, post.reblogged_from_uuid);
                val = dedupVal(name, d.id);
                if (val) {
                    isdupe = true;
                } else {
                    addPhotoDupe(photo, d);
                    dedupAdd(name, d.id, '/tumblr/'+photo.blog.b+'/'+photo.blog.id);
                    if (!photo.cross_id)
                        photo.cross_id = d.id;
                }
            }
            if (!isdupe)
                dedupAdd(photo.blog.b, photo.blog.id);
        }

        if (isdupe) {
            log.info("cannot display url [cross-duplicate:"+val+"]: "+photo.url);

        } else if (post.type == "photo" || post.type == "link") {
            if (post.photos)
                post.photos.forEach(function(item) {
                    var pic =  fixupPhotoTitle(
                        {
                            url: item.original_size.url,
                            type: imageTypes.image,
                            blog: opic.blog
                        },
                        item.caption || post.title || post.caption_abstract, opic.subreddit);
                    if (processPhoto(pic)) {
                        addAlbumItem(photo, pic);
                        rc = true;
                    }
                });
            // "photo" type
            if (post.link_url) {
                pic = fixupPhotoTitle({ url: post.link_url}, post.title || post.caption || post.summary, opic.subreddit);
                if (processPhoto(pic)) {
                    addAlbumItem(photo, pic);
                    rc = true;
                }
            }
            // "link" type
            if (post.url) {
                pic = fixupPhotoTitle({ url: post.url, blog: opic.blog },
                                      post.title || post.summary || post.description, opic.subreddit);
                if (processPhoto(pic)) {
                    addAlbumItem(photo, pic);
                    rc = true;
                }
            }
            processHaystack(photo, (post.caption||post.title));

        } else if (post.type == 'video') {
            pic =  fixupPhotoTitle({ url: opic.url,
                                     thumb: post.thumbnail_url,
                                     blog: opic.blog},
                                   post.summary || post.caption || opic.title, opic.subreddit);
            rc = true;
            if (post.video_type == "youtube") {
                if (post.video === undefined) {
                    initPhotoThumb(pic);
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

        } else if (post.type == 'html')
            rc = processHaystack(photo, post.description);

        else if (post.type == 'text')
            rc = processHaystack(photo, post.body);

        checkPhotoAlbum(photo);

        if (!rc && !isdupe) {
            log.info("cannot display url [Tumblr post type: "+post.type+"]: "+photo.url);
            laterPhotoFailed(opic);
        }
        return rc;
    };

    var getTumblrBlog = function () {
        // Path Schema:
        // /tumblr/HOSTNAME
        // /tumblr/t/TAG
        var jsonUrl;

        if (rp.url.type == 't') {
            jsonUrl = tumblrTagJsonURL(rp.url.sub);
            if (rp.session.after)
                jsonUrl = jsonUrl+'&before='+rp.session.after;
            else
                rp.session.after = currentTime();
            $('#subredditUrl').val('/tumblr/t/'+rp.url.sub);
            setSubredditLink('https://www.tumblr.com/tagged/'+rp.url.sub);

        } else {
            var hostname = rp.url.sub;
            if (!hostname)
                return failCleanup("No tumblr blog provided");

            if (!hostname.includes('.'))
                hostname += '.tumblr.com';

            jsonUrl = tumblrJsonURL(hostname);
            if (rp.session.after)
                jsonUrl = jsonUrl+'&offset='+rp.session.after;
            else
                rp.session.after = 0;
        }

        if (!setupLoading(1, "no Tumblr entries"))
            return;

        var handleData = function (data) {
            var posts, nsfw = false;
            if (rp.url.type == '') {
                setSubredditLink(data.response.blog.url);
                $('#subredditUrl').val('/tumblr/'+data.response.blog.name);

                if (rp.session.after < data.response.total_posts) {
                    rp.session.after = rp.session.after + data.response.posts.length;
                    rp.session.loadAfter = getTumblrBlog;
                } else // Found all posts
                    rp.session.loadAfter = null;
                posts = data.response.posts;
                nsfw = data.response.blog.is_nsfw || data.response.blog.is_adult;
            } else { // t
                posts = data.response;
                if (data.response.length == 0)
                    rp.session.loadAfter = null;
                else {
                    rp.session.loadAfter = getTumblrBlog;
                    rp.session.after = posts[posts.length-1].timestamp;
                }
            }

            posts.forEach(function (post) {
                var image = { title: post.summary,
                              id: post.id,
                              over18: nsfw,
                              date: post.timestamp,
                              url: post.post_url,
                              o_url: post.post_url
                            };
                fixupPhotoTitle(image);
                if (processTumblrPost(image, post))
                    addImageSlide(image);

            });
            doneLoading();
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

    /////////////////////////////////////////////////////////////////
    // Blogger
    //
    // https://developers.google.com/blogger/docs/3.0/using

    var processBloggerPost = function(photo, post) {
        if (photo.url != post.url) {
            if (!photo.o_url)
                photo.o_url = photo.url;
            photo.url = post.url;
        }
        photo.blog = { t: 'blogger', b: post.blog.id, id: post.id };
        cacheBlogInfo(photo.blog, "", hostnameOf(photo.url));
        if (post.author) {
            photo.blog.user = post.author.id;
            cacheBlogUser(photo.blog, post.author.displayName, post.author.url);
        }
        addPhotoBlogTags(photo, post.labels);
        photo = initPhotoAlbum(photo, false);
        var rc = processHaystack(photo, post.content, post.url);
        checkPhotoAlbum(photo);
        return rc;
    };

    var getBloggerPosts = function(hostname) {
        var jsonUrl = "https://www.googleapis.com/blogger/v3/blogs/"+rp.blogcache.hn2site.blogger[hostname]+"/posts?key="+rp.api_key.blogger;
        var blog = { t: 'blogger', b: rp.blogcache.hn2site.blogger[hostname] };
        switch (rp.url.type) {
        case 't':
            jsonUrl = bloggerSearchUrl(hostname, rp.url.multi.split(/[+,]/).map(function(x) { return "label:"+x; }).join("+"));
            setSubredditLink(blogTagUrl(blog, rp.url.multi));
            break;
        case 's':
            jsonUrl = bloggerSearchUrl(hostname, rp.url.sub);
            setSubredditLink(blogTagUrl(blog, rp.url.multi));
            break;
        default:
            setSubredditLink("http://"+hostname);
        }
        if (rp.session.after)
            jsonUrl = jsonUrl+'&pageToken='+rp.session.after;

        var handleData = function (data) {
            if (data.nextPageToken) {
                rp.session.after = data.nextPageToken;
                rp.session.loadAfter = getBloggerBlog;
            } else
                rp.session.loadAfter = null;

            if (data.items)
                data.items.forEach(function (post) {
                    var image = { title: post.title,
                                  id: post.id,
                                  over18: false,
                                  date: processDate(post.updated),
                                  url: post.url
                                };
                    fixupPhotoTitle(image);
                    if (processBloggerPost(image, post))
                        addImageSlide(image);
                });

            doneLoading("No Blogger Items");
        };
        $.ajax({
            url: jsonUrl,
            success: handleData,
            error: failedAjaxDone,
            crossDomain: true,
            timeout: rp.settings.ajaxTimeout
        });
    };

    // Called with
    var bloggerBlogLookupUrl = function(hostname) {
        return 'https://www.googleapis.com/blogger/v3/blogs/byurl?url=https://'+hostname+'&key='+rp.api_key.blogger;
    };

    var bloggerPostLookupUrl = function(hostname, path) {
        var blogid = (isNaN(parseInt(hostname, 10))) ?rp.blogcache.hn2site.blogger[hostname] :hostname;
        if (!blogid)
            throw "Unknown Blogger hostname: "+hostname;
        return 'https://www.googleapis.com/blogger/v3/blogs/'+blogid+'/posts/bypath?path='+encodeURI(path)+'&key='+rp.api_key.blogger;
    };

    var bloggerPost = function(blogid, postid) {
        return 'https://www.googleapis.com/blogger/v3/blogs/'+blogid+'/posts/'+postid+'?key='+rp.api_key.blogger;
    };

    var bloggerSearchUrl = function(hostname, search) {
        if (!rp.blogcache.hn2site.blogger[hostname])
            throw "Unknown Blogger hostname: "+hostname;
        return 'https://www.googleapis.com/blogger/v3/blogs/'+rp.blogcache.hn2site.blogger[hostname]+
            '/posts/search?q='+encodeURI(search.replaceAll(" ", "+"))+'&key='+rp.api_key.blogger;
    }

    var recallBlogger = function(data, handleData, doneError) {
        var hostname = hostnameOf(data.url);
        if (data.error) {
            log.error("cannot log blogger ["+data.error.message+"]: "+hostname);
            rp.blogcache.hn2site.blogger[hostname] = 0;
            if (doneError)
                doneError();
            return;
        }
        cacheBlogInfo({t: 'blogger', b: data.id}, data.name || data.description, hostname);
        handleData();
    };

    var getBloggerBlog = function () {
        // Path Schema:
        // /blogger/HOSTNAME
        // /blogger/HOSTNAME[/t/TAG[+tag2]]
        // /blogger/HOSTNAME[/s/search string]
        var hostname = rp.url.sub;

        if (rp.blogcache.hn2site.blogger[hostname] === 0) {
            failCleanup("cannot load blogger [Already Failed]: "+hostname);
            return;
        }

        if (!setupLoading(1, "No photos loaded"))
            return;

        var id = rp.blogcache.hn2site.blogger[hostname];
        if (id && hasBlogTitle({t:'blogger', b:id})) {
            getBloggerPosts(hostname);
            return;
        } // else lookup blogger ID

        var jsonUrl = bloggerBlogLookupUrl(hostname);

        var handleData = function(data) {
            recallBlogger(data, function() { getBloggerPosts(hostname) }, doneLoading);
        };

        var failedData = function(xhr) {
            var err = JSON.parse(xhr.responseText);
            if (xhr.status == 404)
                rp.blogcache.hn2site.blogger[hostname] = 0;
            else
                log.error("cannot load blogger ["+xhr.status+" "+err.error.message+"]: "+hostname);

            doneLoading("cannot load blogger");
        };

        $.ajax({
            url: jsonUrl,
            success: handleData,
            error: failedData,
            crossDomain: true,
            timeout: rp.settings.ajaxTimeout
        });
    };

    /////////////////////////////////////////////////////////////////
    // DANBOORU
    //
    // https://danbooru.donmai.us/wiki_pages/api:posts
    var processDanbooruPost = function(photo, post) {
        addPhotoSite(photo, "danbooru");
        addPhotoSiteUser(photo, post.tag_string_artist.split(" ").filter(Boolean));
        addPhotoSiteTags(photo, post.tag_string_general.split(" "))
        addPhotoSiteTags(photo, post.tag_string_copyright.split(" "))
        if (post.tag_string_character) {
            if (photo.title)
                addPhotoSiteTags(photo, post.tag_string_character.split(" "));
            else
                photo.title = post.tag_string_character.split(" ")
                .map(function(x) { return titleTagLink("danbooru", x); }).join(" and ");
        }
        addPhotoExtraLink(photo, "Source", post.source);

        if (!post.file_url)
            initPhotoFailed(photo);
        else if (rp.settings.goodImageExtensions.includes(post.file_ext))
            initPhotoImage(photo, post.file_url);
        else if (rp.settings.goodVideoExtensions.includes(post.file_ext))
            initPhotoVideo(photo, post.file_url, post.preview_file_url);
        else {
            log.error("Unknown Extension: "+post.file_ext);
            addPhotoThumb(photo, post.preview_file_url);
            initPhotoFailed(photo);
        }
        if (post.has_children) {
            var jsonUrl = 'https://danbooru.donmai.us/posts.json?tags=parent:'+post.id;
            var handleData = function(items) {
                var p = initPhotoAlbum(photo, true);
                items.forEach(function(subpost) {
                    if (subpost.id == post.id)
                        return;
                    var pic = danbooru2pic(subpost);
                    if (pic.type == imageTypes.fail) {
                        log.info("cannot display child [no valid url]: "+post.id);
                        return;
                    }
                    var val = dedupAdd('donmai.us', subpost.id, post.id);
                    if (val) {
                        log.info("cannot display child [duplicate "+val+"]: "+subpost.id);
                        return;
                    }
                    addAlbumItem(p, pic);
                });
                checkPhotoAlbum(p);
            };
            $.ajax({
                url: jsonUrl,
                dataType: 'json',
                success: handleData,
                error: failedAjaxDone,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true
            });
        }
    };

    var danbooru2pic = function(post) {
        var photo = {
            id: post.id,
            o_url: 'https://danbooru.donmai.us/posts/'+post.id,
            date: processDate(post.created_at),
            over18: post.rating != 'g',
            score: post.up_score - post.down_score,
        };
        processDanbooruPost(photo, post);
        return photo;
    };

    var getDanbooru = function() {
        // URLs:
        // TRENDING:    /danbooru/[CHOICE]
        // USER:        /danbooru/u/USER
        // TAG:         /danboorut/t/TAG[+tag2]
        // SEARCH:      /danboorut/s/TAG[+tag2]
        var jsonUrl;
        var errmsg;
        var order = rp.url.choice.split(':');
        var url;

        switch (rp.url.type) {
        case "s":
            errmsg = "Search `"+rp.url.sub+"' has no posts";
            rp.url.sub = rp.url.sub.split(/[,+&\s]+/).slice(0, 2).join("+");
            // fall through
        case "u":
            if (!errmsg)
                errmsg = "User `"+rp.url.sub+"' has no posts";
            // fall through
        case "t":
            if (!errmsg)
                errmsg = "Tag `"+rp.url.sub+"' has no posts";
            // Max 2 tags/users in search
            rp.url.sub = rp.url.sub.replace(/([,+&])\s*/g, '$1').replace(/ /g, '_').split(/[,+&]/).slice(0, 2).join("+");
            jsonUrl = 'https://danbooru.donmai.us/posts.json?tags='+rp.url.sub.split(/\+/).map(encodeURIComponent).join("+");
            url = siteTagUrl("danbooru", rp.url.sub);
            break;
        default:
            var extra = '';
            switch (order[0]) {
            case 'viewed':
            case 'popular':
                if (order[1])
                    extra = 'scale='+order[1];
                url = 'https://danbooru.donmai.us/explore/posts/'+order[0];
                break;
            case 'hot':
                extra = 'tags=order:rank';
                // fall through
            default: // new
                url = "https://danbooru.donmai.us/posts";
                break;
            }
            jsonUrl = url+'.json'+((extra) ?'?'+extra :'');
            if (extra)
                url += '?'+extra;
            errmsg = "No top posts";
            break;
        }
        if (!setupLoading(1, errmsg))
            return;
        setSubredditLink(url);

        if (rp.session.after) {
            ++rp.session.after;
            var after = "page="+rp.session.after;
            if (order[0] == 'viewed') {
                var d = new Date();
                d.setDate(d.getDate() - (rp.session.after - 1));
                after = "date="+d.toISOString().split('T')[0];
            }
            jsonUrl += ((jsonUrl.includes('?')) ?'&' :'?')+after;
        } else
            rp.session.after = 1;

        var handleData = function(data) {
            if (data.length) {
                data.forEach(function (post) {
                    if (post.parent_id) {
                        log.info("cannot display url [parent "+post.parent_id+"]: "+post.id);
                        return;
                    }
                    var photo = danbooru2pic(post);
                    if (photo.type == imageTypes.fail) {
                        log.info("cannot display url [no valid url]: "+post.id);
                        return;
                    }
                    var val = dedupAdd('donmai.us', post.id);
                    if (val) {
                        log.info("cannot display url [duplicate "+val+"]: "+photo.o_url);
                        return;
                    }
                    addImageSlide(photo);
                });
                rp.session.loadAfter = getDanbooru;
            } else
                rp.session.loadAfter = null;
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
    }

    /////////////////////////////////////////////////////////////////
    // E621
    //

    var processE621Post = function(photo, post) {
        addPhotoSite(photo, "e621", post.tags.artist);
        if (!photo.title && post.description)
            // @@ fixup post.description (may have [section=Story]...[/section]
            fixupPhotoTitle(photo, post.description);
        addPhotoSiteTags(photo, post.tags.general);
        addPhotoSiteTags(photo, post.tags.species);
        addPhotoSiteTags(photo, post.tags.character);
        addPhotoSiteTags(photo, post.tags.lore);
        // also available: copyright, invalid, meta
        for (var src of post.sources) {
            addPhotoExtraLink(photo, "Source", src);
        }
        addPhotoThumb(photo, post.preview.url);
        if (post.flags.deleted) {
            log.info("cannot display url [deleted]: "+photo.o_url);
            initPhotoThumb(photo);
        } else if (isImageExtension(post.file.ext) && post.file.url)
            initPhotoImage(photo, post.file.url)
        else if (isVideoExtension(post.file.ext) && post.file.url)
            initPhotoVideo(photo, post.file.url)
        else {
            log.info("cannot display url [bad "+post.file.url+"]: "+photo.o_url);
            initPhotoThumb(photo);
        }
        post.relationships.children.forEach(function(child) {
            var jsonUrl = 'https://e621.net/posts/'+child+'.json';
            var handleData = function(data) {
                var subpost = data.post;
                var p = initPhotoAlbum(photo, true);
                if (subpost.id == post.id)
                    return;
                var val = dedupAdd('e621.net', subpost.id, post.id);
                if (val) {
                    log.info("cannot display child [duplicate "+val+"]: "+subpost.id);
                    return;
                }
                // @@ check for duplicate?
                var pic = post2picE621(subpost);
                addAlbumItem(p, pic);
                checkPhotoAlbum(p);
            };
            $.ajax({
                url: jsonUrl,
                dataType: 'json',
                success: handleData,
                error: failedAjaxDone,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true
            });
        });
    };

    var post2picE621 = function(post) {
        var photo = {
            id: post.id,
            score: post.score.total,
            o_url: 'https://e621.net/posts/'+post.id,
            date: processDate(post.created_at),
            over18: post.rating != 's',
        };
        processE621Post(photo, post);
        return photo
    };

    var getE621 = function() {
        // URLs:
        // TRENDING:    /e621/[CHOICE]
        // USER:        /e621/u/USER
        // TAG:         /e621/t/TAG[+tag[+...]]
        // SEARCH:      /e621/s/TAG TAG TAG
        var jsonUrl;
        var errmsg = "Tag "+rp.url.sub+" has no posts";
        var order = rp.url.choice.split(':');
        var url = 'https://e621.net/posts';
        var extra = '';

        switch (rp.url.type) {
        case "u":
            errmsg = "User "+rp.url.sub+" has no posts";
            // fall through
        case "s":
        case "t":
            rp.url.sub = decodeURIComponent(rp.url.sub).split(/[,+&]\s*/).join("+").replace(/ /g, '_');
            extra = 'tags='+rp.url.sub+'&limit='+rp.settings.count;
            break;
        default:
            switch (order[0]) {
                // 'new' already handled
            case 'popular':
                if (order[1])
                    extra = 'scale='+order[1];
                url = 'https://e621.net/popular';
                break;
            case 'hot':
                extra = 'tags=order:rank&limit='+rp.settings.count;
                break;
            default:
                extra = 'limit='+rp.settings.count;
                break;
            }
            errmsg = "No posts";
            break;
        }
        jsonUrl = url+'.json'+((extra) ?'?'+extra :'');
        if (extra)
            url += '?'+extra;
        if (!setupLoading(1, errmsg))
            return;
        setSubredditLink(url);

        // page=b<LOWEST_ID> is most efficient
        if (rp.session.after) {
            var after = "page=b"+rp.session.after;
            jsonUrl += ((jsonUrl.includes('?')) ?'&' :'?')+after;
        }

        var handleData = function(data) {
            if (data.posts && data.posts.length) {
                data.posts.forEach(function(post) {
                    if (post.relationships.parent_id) {
                        log.info("cannot display url [parent "+post.relationships.parent_id+"]: "+post.id);
                        return;
                    }
                    // @@ post.pool - alternate album?
                    var photo = post2picE621(post);
                    var val = dedupAdd('e621.net', post.id);
                    if (val) {
                        log.info("cannot display url [duplicate "+val+"]: "+photo.o_url);
                        return;
                    }
                    addImageSlide(photo);
                });
                rp.session.after = data.posts[data.posts.length-1].id;
                rp.session.loadAfter = getE621;
            } else
                rp.session.loadAfter = null;
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

    /////////////////////////////////////////////////////////////////
    // Flicker
    //

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

    var flickrUserLookup = function(user, callback, ReqFunc, ReqData, errFunc) {
        var jsonUrl = flickrJsonURL('flickr.urls.lookupUser', { url: 'https://flickr.com/photos/'+user });
        var handleData = function(data) {
            if (data.stat !== 'ok')
                return errFunc(data);
            cacheSiteUser("flickr", user, data.user.id);
            ReqData.user_id = siteUserId("flickr", user);
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

    var processFlickrPost = function(post, url) {
        if (post.ownername)
            cacheSiteUser("flickr", post.ownername, post.owner);
        var pic = { title: (post.title._content) ?post.title._content :post.title,
                    id: post.id,
                    site: { t: 'flickr', users: [ post.owner ] },
                    date: processDate(post.datetaken || post.dateupload || post.date_create),
                    url: url || flickrPhotoUrl(post),
                    o_url: url || ['https://www.flickr.com/photos', post.owner, post.id].join("/"),
                    over18: false };
        addPhotoSiteTags(pic, (post.tags) ?post.tags.split(" ") :[]);
        return pic;
    };

    // Need user login for safe-search to be off
    // Sizes:
    // o - original
    // k - 2048 on longest - c. 2012
    // h - 1600 on longest - c. 2012
    // b - 1024 on longest - optional until May 2010
    // z - 640 on longest (gaurenteed to exist)
    var getFlickr = function() {
        // Path Schema:
        // /flickr[/CHOICES]
        // /flickr/s/SEARCHSTRING[/CHOICES]
        // /flickr/t/TAG[,tag2][/CHOICES]
        // /flickr/u/USER[/albums][/CHOICES]
        var url = "https://flickr.com/explore";
        if (rp.session.after == undefined)
            rp.session.after = 1;

        var reqFunc = 'flickr.photos.search';
        var reqData = { primary_photo_extras: 'url_o,url_h,url_k,url_b,date_uploaded',
                        extras: 'url_o,url_h,url_k,url_b,date_taken,date_uploaded,owner_name,tags',
                        view_all: 1,
                        per_page: rp.settings.count,
                        safe_search: 3,
                        page: rp.session.after };

        switch (rp.url.type) {
        case 'u':
            reqData.user_id = siteUserId("flickr", rp.url.sub);
            url = siteUserUrl("flickr", reqData.user_id);
            if (rp.url.choice == 'albums') {
                reqFunc = 'flickr.photosets.getList';
                url += '/albums';
            } else
                reqFunc = 'flickr.people.getPhotos';
            break;
        case 's':
            reqData.text = rp.url.sub;
            if (rp.url.choice == 'new')
                reqData.sort = 'date-posted-desc';
            else
                //reqData.sort = 'interestingness-desc';
                reqData.sort = 'relevance';
            url = siteSearchUrl('flickr', rp.url.sub, reqData.sort);
            break;
        case 't':
            reqData.tags = rp.url.sub.toLowerCase().replaceAll(" ", "").replace(/[+&]/g, ",");
            reqData.tag_mode = "all";
            url = siteTagUrl('flickr', reqData.tags);
            if (rp.url.choice == 'new')
                reqData.sort = 'date-posted-desc';
            else
                reqData.sort = 'interestingness-desc';
            break;
        default:
            if (rp.url.choice == 'new')
                reqFunc = 'flickr.photos.getRecent';
            else // hot
                reqFunc = 'flickr.interestingness.getList';
        }
        setSubredditLink(url);

        if (!setupLoading(1, "No photos loaded"))
            return;

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
                arrProcess = processFlickrPost;

            } else if (data.photosets) {
                info = data.photosets;
                arrData = data.photosets.photoset;
                arrProcess = function(post) {
                    cacheSiteUser("flickr", post.username, post.owner);
                    var pic = processFlickrPost(post, ['https://www.flickr.com/photos', post.owner, 'sets', post.id].join("/"));
                    addPhotoThumb(pic, flickrPhotoUrl(post.primary_photo_extras));
                    return pic;
                };
            }
            if (info.pages == 0)
                return failCleanup("Flickr user has no images");

            if (info.page < info.pages) {
                rp.session.loadAfter = getFlickr;
                rp.session.after = info.page+1;
            } else
                rp.session.loadAfter = null;

            arrData.forEach(function(post) {
                var photo = arrProcess(post);
                addImageSlide(photo);
            });
            doneLoading();
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

    /////////////////////////////////////////////////////////////////
    // Gfycat
    //

    var processGfycatItem = function(photo, item) {
        addPhotoSite(photo, 'gfycat', item.username);
        if (!photo.title) {
            photo.title = gfyItemTitle(item);
            fixupPhotoTitle(photo);
        }
        addPhotoSiteTags(photo, item.tags);
        initPhotoVideo(photo, [ item.webmUrl, item.mp4Url ], item.posterUrl);
        return photo;
    };

    var gfycat2pic = function(post) {
        var image = { url: sitePhotoUrl('gfycat', post.gfyName),
                      over18: (post.nsfw != 0),
                      title: gfyItemTitle(post),
                      date: post.createDate,
                      score: rp.settings.minScore + post.likes - post.dislikes,
                    };
        fixupPhotoTitle(image);
        return processGfycatItem(image, post);
    };

    var getGfycat = function() {
        // URLs:
        // TRENDING:    /gfycat/
        // USER:        /gfycat/u/USER
        // TAG:         /gfycat/t/TAG
        var user;
        var jsonUrl;
        var errmsg;
        var first = false;
        var url = "https://gfycat.com/discover/popular-gifs";

        switch (rp.url.type) {
        case "u":
            user = rp.url.sub;
            errmsg = "User "+user+" has no videos";
            jsonUrl = 'https://api.gfycat.com/v1/users/'+user+'/gfycats?count='+rp.settings.count;
            url = siteUserUrl("gfycat", rp.url.sub);
            break;
        case "t":
            errmsg = "Tag "+rp.url.sub+" has no videos";
            jsonUrl = "https://api.gfycat.com/v1/gfycats/search?start=0&count="+rp.settings.count+"&search_text="+rp.url.sub.toLowerCase();
            url = siteTagUrl('gfycat', rp.url.sub);
            break;
        default:
            jsonUrl = "https://api.gfycat.com/v1/gfycats/search?start=0&count="+rp.settings.count+"&search_text=trending";
            //jsonUrl = 'https://api.gfycat.com/v1/gfycats/trending?tagName=_gfycat_all_trending&count='+rp.settings.count;
            errmsg = "No trending videos";
            break;
        }
        setSubredditLink(url);

        if (!setupLoading(1, errmsg))
            return;

        if (rp.session.after)
            jsonUrl += "&cursor="+rp.session.after;
        else
            first = true;

        var handleGfycatData = function (data) {
            if (data.gfycats.length) {
                data.gfycats.forEach(function (post) {
                    var image = gfycat2pic(post);
                    addImageSlide(image);
                });
                if (data.cursor) {
                    rp.session.after = data.cursor;
                    rp.session.loadAfter = getGfycat;
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
            var jsonAlbumUrl = 'https://api.gfycat.com/v1/users/'+user+'/collections';
            var handleAlbumData = function (data) {
                if (data.count === 0)
                    return doneLoading();
                var collections = data.gfyCollections || data.gifCollections;

                collections.forEach(function (album) {
                    var url = 'https://api.gfycat.com/v1/users/'+user+'/collections/'+album.folderId+"/gfycats";
                    if (album.folderSubType != "Album") {
                        log.error("Unknown type ["+album.folderSubType+"]: "+url);
                        return;
                    }
                    var photo = fixupPhotoTitle({
                        url: siteUserUrl("gfycat", user)+'/collections/'+album.folderId+"/"+album.linkText,
                        site: { t: 'gfycat', users: [ user ] },
                        title: album.folderName || album.description,
                        date: album.date,
                        over18: Boolean(album.nsfw),
                    });
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
                if (xhr.status == 404 || xhr.status == 403)
                    return doneLoading();
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

    var rpurlReset = function() {
        rp.url.site = 'reddit';
        rp.url.sub = '';
        rp.url.type = '';
        rp.url.multi = '';
        rp.url.choice = '';
    };

    var rpurlbase = function() {
        var arr;
        switch (rp.url.site) {
        case "reddit":
            switch (rp.url.type) {
            case 'friends':
                arr = [ '/r/friends' ];
                break;
            case 'm':
                if (rp.url.sub == '') {
                    arr = [ '/me/m', rp.url.multi ];
                    break;
                }
                // fall through
            case 'submitted':
                arr = [ '/user', rp.url.sub, rp.url.type, rp.url.multi ];
                break;
            default:
                arr = [ '', rp.url.type, rp.url.sub ];
                break;
            }
            break;
        case "blogger":
        case "wp2":
        case "wp":
            arr = ['', rp.url.site, rp.url.sub, rp.url.type, rp.url.multi ];
            break;
        default:
            arr = ['', rp.url.site, rp.url.type, rp.url.sub ];
            break;
        }
        return arr.join("/").replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
    };
    rp.fn.rpurlbase = rpurlbase;

    var rpurlpath = function() {
        return [rpurlbase(), rp.url.choice].join("/").replace(/\/+/g, '/').replace(/(.)\/$/, '$1');
    }
    rp.fn.urlpath = rpurlpath;

    var processUrl = function(path, initial, data) {
        if (path === undefined)
            path = $('#subredditUrl').val();
        if (initial === undefined)
            initial = false;

        var pathIsLocation = true;

        path = path.replace(/%20/g, ' ').replace(/ +/g, ' ').replace(/^\/*/, '/').replace(/^\?+/, '');

        var okay = false;
        var arr = path.split('?').reverse();

        var inUrlChoice = function(type, arr) {
            return (arr.length > 0 &&
                    rp.choices[rp.url.site][type] &&
                    rp.choices[rp.url.site][type].includes(arr[arr.length-1]));
        };

        var re, tmp;
        for (var i in arr) {
            var a = arr[i].split(/[/ ]/);
            if (a.length == 1)
                continue;
            a.shift(); // drop empty

            rpurlReset();

            var t = a.shift().toLowerCase();

            switch (t) {
            case 'auth':
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
                processUrl(url, true);
                loadRedditMultiList();
                return;
            case 'blogger':
            case 'wp':
            case 'wp2':
            case 'tumblr':
                rp.url.site = t;
                if (rp.choices[t] && rp.choices[t][a[0]])
                    rp.url.type = a.shift();
                rp.url.sub = a.shift();
                if (rp.choices[t] && rp.choices[t][a[0]]) {
                    rp.url.type = a.shift();
                    if (a.length)
                        rp.url.multi = a.shift();
                }
                break;
            case 'domain':
            case 'r':
                rp.url.type = t;
                rp.url.sub = decodeURIComponent(a.shift());
                if (rp.url.sub == 'friends')
                    rp.url.type = 'friends';
                else if (rp.url.sub == 'random' || rp.url.sub == 'randnsfw')
                    if (inUrlChoice(t, a))
                        a.pop(); // this can't be used, so drop it
                break;
            case 'danbooru':
            case 'e621':
            case 'flickr':
            case 'gfycat':
            case 'imgur':
                rp.url.site = t;
                var c = (a.length > 1) ?a[0] :'';
                if (inUrlChoice(c, a))
                    rp.url.choice = a.pop();
                rp.url.type = a.shift() || '';
                if (a.length > 0) {
                    tmp = arr[i];
                    re = RegExp("^[/ ]"+t+"[/ ]"+rp.url.type+"[/ ]", "i");
                    tmp = tmp.replace(re, '');
                    if (rp.url.choice) {
                        re = RegExp("[/ ]"+rp.url.choice+"[/ ]?$", "i");
                        tmp = tmp.replace(re, '');
                    }
                    rp.url.sub = decodeURIComponent(tmp);
                    a = [];
                }
                break;
            case 'me':
                rp.url.type = a.shift();
                rp.url.multi = a.shift();
                rp.session.loginNeeded = true;
                break;
            case 'u':
            case 'user':
                // /(user|u)/USERNAME/(m/MULTI|submitted)
                rp.url.sub = a.shift();
                rp.url.type = a.shift() || "submitted";
                if (rp.url.type == 'm')
                    rp.url.multi = a.shift();
                break;
            case 'search':
                if (a.length == 0) {
                    log.error("Empty search string");
                    continue;
                }
                rp.url.type = t;
                if (inUrlChoice(t, a))
                    rp.url.choice = a.pop();
                re = RegExp("^[/ ]"+t+"[/ ]", "i");
                tmp = arr[i];
                tmp = tmp.replace(re, '');
                if (rp.url.choice) {
                    re = RegExp("[/ ]"+rp.url.choice+"[/ ]?$", "i");
                    tmp = tmp.replace(re, '');
                }
                rp.url.sub = decodeURIComponent(tmp);
                a = [];
                break;
            case '': break;
            default:
                if (rp.choices[rp.url.site][rp.url.type].includes(t))
                    rp.url.choice = t;
                else {
                    log.info("Bad PATH: "+arr[i]);
                    continue;
                }
            }
            if (a.length > 0) {
                c = a.shift();
                if (c && !rp.choices[rp.url.site][rp.url.type].includes(c)) {
                    log.error("Bad choice ["+rp.url.site+"]["+rp.url.type+"]: "+c);
                    continue;
                }
                rp.url.choice = c;
            }

            okay = true;
            pathIsLocation = (i == arr.length-1);
            break;
        }

        if (!okay) {
            pathIsLocation = false;
            rpurlReset();
        }

        // Set prefix for self links, if in subdirectory
        if (initial)
            if (pathIsLocation) {
                rp.url.root = '/';
            } else {
                rp.url.base = window.location.pathname + '?';
                rp.url.root = window.location.pathname.replace(/index.html$/, "");
            }

        if (!path.startsWith(pathnameOf(rp.url.base)))
            path = rp.url.base+path;

        log.info("LOADING: "+path);
        rp.url.path = path;

        if (initial && rp.session.redditRefreshToken && !rp.login.reddit.expire) {
            redditCodeFlow({ refresh_token: rp.session.redditRefreshToken }, path);
            return;
        }

        $('a.hardlink').each(function(_i, item) {
            var href = pathnameOf(item.href);
            item.href = rp.url.base+href;
            item.classList.remove('hardlink');
        });

        if (initial)
            rp.history.replaceState({}, "", path);

        else if (data === undefined && path != "")
            rp.history.pushState({}, "", path);

        var subredditName = rpurlpath();
        var visitSubreddit = rp.reddit.base + rpurlpath();

        setSubredditLink(visitSubreddit, "reddit");

        document.title = "redditP - " + subredditName;
        $('#subredditUrl').val(subredditName);
        setupChoices();

        if ((rp.login.reddit.expire || rp.session.loginNeeded) &&
             rp.url.site == 'reddit' &&
             (rp.url.type == 'friends' ||
              rp.url.type == 'm' && rp.url.sub == ''))
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
                // @@ filter on dedup?
                if (addImageSlide(photo)) {
                    // rebuild rp.dedup
                    if (photo.subreddit)
                        dedupAdd(photo.subreddit, photo.id);
                    else if (photo.blog)
                        dedupAdd(photo.blog.b, photo.blog.id);
                    else if (rp.url.site == 'danbooru')
                        dedupAdd('donmai.us', photo.id);
                    else if (rp.url.site == 'e621')
                        dedupAdd('e621.net', photo.id);
                    if (!photo.dupes)
                        return;
                    photo.dupes.forEach(function(dupe) {
                        // Don't need to check if subreddit is u_ because it was added to a photo already
                        if (dupe.subreddit)
                            dedupAdd(dupe.subreddit, dupe.id, '/r/'+photo.subreddit+'/'+photo.id);
                        else if (dupe.tumblr)
                            dedupAdd(dupe.tumblr, dupe.id, '/'+photo.blog.t+'/'+photo.blog.b+'/'+photo.blog.id);
                    });
                } else if (index < orig_index)
                    --data.index;
            });

            if (data.album < 0)
                data.album = -1;

            setSubredditLink(data.subredditLink);

            log.info("Restored "+path+" and "+rp.photos.length+" images of "+data.photos.length+" at index "+data.index+"."+data.album);
            rp.session.isAnimating = false;
            startAnimation(data.index, data.album);

        } else {
            switch (rp.url.site) {
            case 'blogger': getBloggerBlog(); break;
            case 'danbooru': getDanbooru(); break;
            case 'e621': getE621(); break;
            case 'flickr': getFlickr(); break;
            case 'gfycat': getGfycat(); break;
            case 'imgur': getImgur(); break;
            case 'reddit': getRedditImages(); break;
            case 'tumblr': getTumblrBlog(); break;
            case 'wp': getWordPressBlog(); break;
            case 'wp2': getWordPressBlogV2(); break;
            default:
                throw("Bad site: "+rp.url.site);
            }
        }
    };

    initState();

    var path;
    if (window.location.origin !== "null")
        path = window.location.href.substr(window.location.origin.length);
    else
        // file://PATHAME?SUBREDDIT
        path = window.location.href.substr(window.location.pathname.length+7);

    processUrl(path, true);
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
