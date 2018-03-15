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
 * In Browser Storage (window.storage)
 * redditp-nsfw                 - boolean - load NSFW content
 * redditp-redditBearer         - string  - auth bearer token from reddit.com
 * redditp-redditRefreshBy      - int     - time that bearer token expires
 * redditp-shouldAutoNextSlide  - boolean - on timeout, go to next image
 * redditp-showEmbed            - boolean - Show embeded content (iframes, no timeout)
 * redditp-timeToNextSlide      - int     - timeout in seconds
 * redditp-wpv2                 - hash of booleans
 * 
 * (window.history)
 * Set/push/replace state
 * 
 * Cookies - NONE
 */

var rp = {};
// This can be set to TRACE, DEBUG, INFO, WARN. ERROR, SLIENT (nothing printed)
log.setLevel(log.levels.INFO);
RegExp.quote = function(str) {
    return (str+'').replace(/[.?*+^$[\]\\(){}|-]/g, "\\$&");
};

rp.settings = {
    // JSON/JSONP timeout in milliseconds
    ajaxTimeout: 10000,
    // Speed of the animation
    animationSpeed: 1000,
    shouldAutoNextSlide: true,
    timeToNextSlide: 8,
    goodImageExtensions: ['jpg', 'jpeg', 'gif', 'bmp', 'png'],
    goodVideoExtensions: ['webm', 'mp4'],
    alwaysSecure: true,
    // Try to download possible wordpress sites, even if self-hosted.
    // only try if the form is like //hostname.tld/this-is-a-slug/
    speculativeWP: true,
    // show Embeded Items
    embed: false,
    // show NSFW Items
    nsfw: false
};

rp.session = {
    // 0-based index to set which picture to show first
    // init to -1 until the first image is loaded
    activeIndex: -1,
    activeAlbumIndex: -1,

    // Variable to store if the animation is playing or not
    isAnimating: false,

    // Id of timer
    nextSlideTimeoutId: null,

    // Reddit filter "After"
    after: "",

    foundOneImage: false,
    loadedMultiList: false,
    loadingNextImages: false,
    loadAfter: null,

    is_ios: false,
    is_pre10ios: false,
    fakeStorage: false,
    redditHdr: {}
};
// In case browser doesn't support localStorage
// This can happen in iOS Safari in Private Browsing mode
rp.storage = {};

// @@ Store this in localStorage
rp.wpv2 = {};

rp.history = window.history;

rp.api_key = {tumblr:  'sVRWGhAGTVlP042sOgkZ0oaznmUOzD8BRiRwAm5ELlzEaz4kwU',
              imgur:   'ae493e76de2e724'
             };

// CHANGE THESE FOR A DIFFERENT Reddit Application
rp.redirect = 'http://redditp.utopiabound.net/auth';
rp.api_key.reddit = '7yKYY2Z-tUioLA';

// Hosts will default to originOf(url)+'/favicon.ico'
// this list overrides based on second level domain (e.g. mywebsite.wordpress.com -> wordpress)
rp.favicons = { tumblr:  'https://assets.tumblr.com/images/favicons/favicon.ico',
	        wordpress: 'https://s1.wp.com/i/favicon.ico',
                // i.redd.it/v.redd.it - reddit hosted images
                redd: 'https://www.redditstatic.com/icon.png'
              };

// Variable to store the images we need to set as background
// which also includes some text and url's.
rp.photos = [];

// maybe checkout http://engineeredweb.com/blog/09/12/preloading-images-jquery-and-javascript/
// for implementing the old precache
rp.cache = {};
rp.dedup = {};
rp.url = {
    subreddit: "",
    base: '',
    get: '',
    path: '',
    vars: ""
};

$(function () {
    $("#navboxTitle").text("Loading Reddit Slideshow");

    var LOAD_PREV_ALBUM = -2;

    // Value for each image Type is name of Google icon
    var imageTypes = {
        image: 'image',
        video: 'movie',
        embed: 'ondemand_video',
        album: 'cloud',
        later: 'file_download',
        fail: 'not_interested'
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

    var setupFadeoutOnIdle = function () {
        $('.fadeOnIdle').fadeTo('fast', 0);
        var navboxVisible = false;
        var fadeoutTimer = null;
        var fadeoutFunction = function () {
            navboxVisible = false;
            $('.fadeOnIdle').fadeTo('slow', 0);
        };
        $("body").mousemove(function () {
            if (navboxVisible) {
                window.clearTimeout(fadeoutTimer);
                fadeoutTimer = window.setTimeout(fadeoutFunction, 2000);
                return;
            }
            navboxVisible = true;
            $('.fadeOnIdle').fadeTo('fast', 1);
            fadeoutTimer = window.setTimeout(fadeoutFunction, 2000);
        });
    };
    // this fadeout was really inconvenient on mobile phones
    // and instead the minimize buttons should be used.
    //setupFadeoutOnIdle();

    var getNextPhotoOk = function(pic) {
        var photo = photoParent(pic);
        
        if (!rp.settings.nsfw && photo.over18)
            return false;

        if (!rp.settings.embed && pic.type == imageTypes.embed)
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
        for (var i = currentIndex - 1; i >= 0; i--) {
            if (!getNextPhotoOk(rp.photos[i]))
                continue;
             return i;
        }
        log.debug("["+currentIndex+"] Couldn't find previous index.");
        return currentIndex;
    };

    function nextAlbumSlide() {
        nextSlide(true);
    }

    function nextSlide(inalbum) {
        var index, albumIndex;

        if (inalbum === undefined || inalbum == false || rp.session.activeIndex < 0) {
            albumIndex = -1; // need to increment
            index = getNextSlideIndex(rp.session.activeIndex);
            if (index == rp.session.activeIndex) {
                if (rp.session.loadAfter !== null)
                    rp.session.loadAfter();
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
                if (rp.session.loadAfter !== null)
                    rp.session.loadAfter();
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
        var photo = rp.photos[index];
        if (photo.times == 1) {
            if (photo.duration < rp.settings.timeToNextSlide)
                photo.times = Math.ceil(rp.settings.timeToNextSlide/photo.duration);
            return false;
        }
        photo.times -= 1;
        return true;
    };

    var youtubeURL = function(id) {
        var ytExtra = '?autoplay=1&origin='+encodeURI(window.location.protocol +
                                                      "//" + window.location.host + "/");
        //var ytExtra = '?enablejsapi=1';
        return 'https://www.youtube.com/embed/'+id+ytExtra;
    };

    // info - foreign link
    // text - Text of foreign link
    // infop - always self-link (optional)
    // infoalt - alt text (optional)
    // favicon - specify favicon (optional)
    var infoLink = function(info, text, infop, infoalt, favicon) {
        if (infoalt === undefined)
            infoalt = "";
        if (favicon === undefined) {
            var sld = hostnameOf(info, true).match(/[^\.]*/)[0];
            favicon = rp.favicons[sld];
        }
        if (favicon !== undefined)
            text = '<img class="redditp favicon" src="'+favicon+'" />'+text;
        var data = '<a href="'+info+'" class="info infol" title="'+infoalt+'">'+text+'</a>';
        if (infop !== undefined)
            data += '<a href="'+rp.url.base+infop+'" class="info infop">'+
                '<img class="redditp" src="images/favicon.png" /></a>';
        return data;
    };

    var googleIcon = function(icon_name) {
        return $('<i>', { class: 'material-icons' }).text(icon_name);
    };

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

    // onlysld (optional)
    var hostnameOf = function(url, onlysld) {
        var hostname = $('<a>').attr('href', url).prop('hostname');
        if (onlysld === undefined)
            onlysld=false;
        if (onlysld) {
            var a = hostname.match(/[^\.]*\.[^\.]*$/);
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
        $.map(b.split('&'), function(val, i) {
            var arr = val.split('=');
            a[arr[0]] = arr[1];
        });
        return a;
    };
    
    var searchValueOf = function(url, key) {
        return searchOf(url)[key];
    };

    var extentionOf = function(url) {
        var path = pathnameOf(url);
        var dotLocation = path.lastIndexOf('.');
        if (dotLocation < 0)
            return '';
        return path.substring(dotLocation+1);
    };

    // Take a URL and strip it down to the "shortid"
    // url2shortid(url [, index])
    // Index actually starts at 1 since 0 is always empty
    // "/this/is/a/path/".split('/') == [ "", "this", "is", "a", "path", "" ]
    var url2shortid = function(url, index) {
        var shortid;
        var path = pathnameOf(url);

        var a = path.split('/');
        if (a[a.length-1] == "")
            a.pop();

        if (index === undefined || index == -1)
            index = a.length-1;

        shortid = a[index];

        // Trim off file extenstion
        if (shortid.indexOf('.') != -1)
            shortid = shortid.substr(0, shortid.lastIndexOf('.'));

        return shortid;
    };

    var isImageExtension = function (url) {
        var extension = extentionOf(url);
        if (extension === '')
            return false;

        if (rp.settings.goodImageExtensions.indexOf(extension) >= 0)
            return extension;

        else
            return false;
    };

    var isVideoExtension = function (url) { 
        var extension = extentionOf(url);
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

    $("#pictureSlider").touchwipe({
        // wipeLeft means the user moved his finger from right to left.
        wipeLeft: nextAlbumSlide,
        wipeRight: prevAlbumSlide,
        wipeUp: nextSlide,
        wipeDown: prevSlide,
        min_move_x: 20,
        min_move_y: 20,
        preventDefaultEvents: false
    });

    var OPENSTATE_ATTR = "data-openstate";
    $('.collapser').click(function () {
        var state = $(this).attr(OPENSTATE_ATTR);
        if (state == "open") {
            // close it
            $(this).html("&rarr;");
            // move to the left just enough so the collapser arrow is visible
            var arrowLeftPoint = $(this).position().left;
            $(this).parent().animate({
                left: "-" + arrowLeftPoint + "px"
            });
            $(this).attr(OPENSTATE_ATTR, "closed");
        } else {
            // open it
            $(this).html("&larr;");
            $(this).parent().animate({
                left: "0px"
            });
            $(this).attr(OPENSTATE_ATTR, "open");
        }
    });

    var CONTROLDIV_ATTR="data-controldiv";
    var OPENSYMBOL_ATTR="data-opensym";
    var CLOSESYMBOL_ATTR="data-closesym";
    $('.vcollapser').click(function () {
        var state = $(this).attr(OPENSTATE_ATTR);
        var divname = $(this).attr(CONTROLDIV_ATTR);
        var div = $('#'+divname);
        var sym;
        if (state == "open") {
            // close it
            sym = $(this).attr(CLOSESYMBOL_ATTR);
            if (sym)
                $(this).html(sym);
            else
                $(this).html("&darr;"); // down arrow
            $(div).hide();
            $(this).attr(OPENSTATE_ATTR, "closed");
        } else {
            // open it
            sym = $(this).attr(OPENSYMBOL_ATTR);
            if (sym)
                $(this).html(sym);
            else
                $(this).html("&uarr;"); // up arrow
            $(div).show();
            $(this).attr(OPENSTATE_ATTR, "open");
        }
    });

    var configNames = {
        nsfw: "nsfw",
        embed: "showEmbed",
        shouldAutoNextSlide: "shouldAutoNextSlide",
        timeToNextSlide: "timeToNextSlide",
        redditBearer: 'redditBearer',
        redditRefreshBy: 'redditRefreshBy',
        wpv2: 'wordpressv2'
    };

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

    var getConfig = function (c_name) {
        // undefined in case nothing found
        var value;
        var name = "redditp-"+c_name;
        if (rp.session.fakeStorage)
            value = rp.storage[c_name];
        else
            value = window.localStorage[name];
        if (value === "undefined")
            return undefined;
        if (value !== undefined)
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

    var clearSlideTimeout = function() {
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

    var updateAutoNext = function () {
        rp.settings.shouldAutoNextSlide = $("#autoNextSlide").is(':checked');
        if (rp.settings.shouldAutoNextSlide)
            $('#controlsDiv .collapser').css({color: 'red'});
        else
            $('#controlsDiv .collapser').css({color: ""});
        setConfig(configNames.shouldAutoNextSlide, rp.settings.shouldAutoNextSlide);
        // Check if active image is a video before reseting timer
        if (rp.session.activeIndex == -1 ||
            rp.photos[rp.session.activeIndex].times === undefined)
            resetNextSlideTimer();
    };

    var toggleFullScreen = function() {
        var elem = document.getElementById('page');
        if (document.fullscreenElement || // alternative standard method
            document.mozFullScreenElement || document.webkitFullscreenElement || document.msFullscreenElement) { // current working methods
            $('label[for="fullscreen"] i').text("fullscreen");
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
            $('label[for="fullscreen"] i').text("fullscreen_exit");
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
    };

    var isVideoMuted = function() {
        return $("#mute").is(':checked');
    };

    var updateVideoMute = function() {
        var vid = $('#gfyvid');
        var videoMuted = isVideoMuted();
        if (videoMuted) {
            $('label[for="mute"] i').text("volume_off");
            if (vid !== undefined)
                vid.prop('muted', true);
        } else {
            $('label[for="mute"] i').text("volume_up");
            if (vid !== undefined)
                vid.prop('muted', false);
        }
    };

    var updateNsfw = function () {
        rp.settings.nsfw = $("#nsfw").is(':checked');
        setConfig(configNames.nsfw, rp.settings.nsfw);
        if (rp.settings.nsfw) {
            $('label[for="nsfw"]').html(googleIcon("wc"));
        } else {
            $('label[for="nsfw"]').html(googleIcon("child_friendly"));
        }
    };

    var updateEmbed = function () {
        rp.settings.embed = !$("#embed").is(':checked');
        setConfig(configNames.embed, rp.settings.embed);
        if (rp.settings.embed) {
            $('label[for="embed"]').html(googleIcon("cloud"));
        } else {
            $('label[for="embed"]').html(googleIcon("cloud_off"));
        }
    };

    var initState = function () {
        rp.wpv2 = getConfig(configNames.wpv2);
        if (rp.wpv2 === undefined)
            rp.wpv2 = {};
        var nsfwByConfig = getConfig(configNames.nsfw);
        if (nsfwByConfig !== undefined) {
            rp.settings.nsfw = nsfwByConfig;
            $("#nsfw").prop("checked", rp.settings.nsfw);
        }
        $('#nsfw').change(updateNsfw);
        updateNsfw();

        var embedByConfig = getConfig(configNames.embed);
        if (embedByConfig !== undefined) {
            rp.settings.embed = embedByConfig;
            $("#embed").prop("checked", !rp.settings.embed);
        }
        $('#embed').change(updateEmbed);
        updateEmbed();

        updateVideoMute();
        $('#mute').change(updateVideoMute);

        var autoByConfig = getConfig(configNames.shouldAutoNextSlide);
        if (autoByConfig !== undefined) {
            rp.settings.shouldAutoNextSlide = autoByConfig;
            $("#autoNextSlide").prop("checked", rp.settings.shouldAutoNextSlide);
        }
        updateAutoNext();
        $('#autoNextSlide').change(updateAutoNext);

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

        var timeByConfig = getConfig(configNames.timeToNextSlide);
        updateTimeToNextSlide(timeByConfig);

        $('#fullscreen').change(toggleFullScreen);

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

        // OS/Browser Specific
        if (/iPad|iPhone|iPod/.test(navigator.platform)) {
            rp.session.is_ios = true;
            var v = (navigator.appVersion).match(/OS (\d+)/);
            if (parseInt(v[1], 10) < 10) {
                log.debug("User Agent is pre-10 iOS");
                rp.session.is_pre10ios = true;
            } else {
                log.debug("User Agent is 10+ iOS");
            }
            // Hide useless "fullscreen" button on iOS safari
            $('#fullscreen').parent().hide();
        }

    };

    var addNumberButton = function (numberButton) {
        var buttonUl = $("#allNumberButtons");
        var newListItem = $("<li />").appendTo(buttonUl);
        numberButton.appendTo(newListItem);
    };
    
    var initPhotoFailed = function(photo) {
        photo.type = imageTypes.fail;

        delete photo.album;

        fixPhotoButton(photo);
    };

    var initPhotoEmbed = function(photo, url) {
        photo.type = imageTypes.embed;
        if (url !== undefined)
            photo.url = url;
        fixPhotoButton(photo);
    };

    var initPhotoVideo = function (photo, url, thumbnail) {
        photo.type = imageTypes.video;
        photo.video = {};
        
        if (url === undefined)
            url = photo.url;

        var extension = isVideoExtension(url);
        if (extension)
            photo.video[extension] = url;
        
        if (thumbnail !== undefined)
            photo.video.thumbnail = fixupUrl(thumbnail);

        else if (photo.thumbnail)
            photo.video.thumbnail = photo.thumbnail;
    };

    // re-index Album elements starting from index
    var reindexPhotoAlbum = function(photo, index) {
        if (index === undefined)
            index = 0;

        // if photo.index isn't in rp.photos or photo isn't active, we don't care
        if (photo.index === undefined ||
            photo.index != rp.session.activeIndex)
            return;

        for (var i = index; i < photo.album.length; ++i) {
            var a = $('#albumNumberButtons ul').children(":nth-child("+(i+1)+")").children();
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
        if (photo.type != imageTypes.album ||
            photo.album.length > 1)
            return;

        // creating album failed
        if (photo.album.length == 0) {
            log.info("failed photo album [album length 0]: "+photo.url);
            initPhotoFailed(photo);
            return;
        }

        var pic = photo.album[0];
        if (pic.type == imageTypes.image ||
            pic.type == imageTypes.later ||
            pic.type == imageTypes.fail ||
            pic.type == imageTypes.embed) {
            photo.type = pic.type;
            photo.url = pic.url;

        } else if (pic.type == imageTypes.video) {
            photo.type = pic.type;
            photo.video = pic.video;

        } else {
            log.error("Delete of bad type:"+pic.type+" for photo: "+photo.url);
            return;
        }
        log.debug("moved first album to primary item: "+photo.url);
        fixPhotoButton(photo);
        delete photo.album;
    };

    var initPhotoAlbum = function (pic, keepfirst) {
        var photo = photoParent(pic);
        if (keepfirst === undefined)
            keepfirst = true;

        if (photo !== pic) {
            // remove old AlbumItem
            var index = photo.album.indexOf(pic);
            if (index >= 0) {
                photo.album.splice(index, 1);
                if (photo.index !== undefined &&
                    photo.index == rp.session.activeIndex) {
                    $('#allNumberButtons ul').children(":nth-child("+(index+1)+")").remove();
                    reindexPhotoAlbum(photo, index);
                }
            }
            // don't need to insertAt if image is last element
            if (index != photo.album.length)
                photo.insertAt = index;

        } else if (photo.album === undefined) {
            var img;
            if (photo.type == imageTypes.image ||
                photo.type == imageTypes.embed ||
                photo.type == imageTypes.later) {
                img = { url: photo.url,
                        type: photo.type };
            } else if (photo.type == imageTypes.video) {
                img = { url: photo.url,
                        thumbnail: photo.thumbnail,
                        video: photo.video,
                        type: imageTypes.image };
            }

            photo.type = imageTypes.album;
            photo.insertAt = -1;
            photo.album = [];

            if (keepfirst && processPhoto(img) && img.type !== imageTypes.later) {
                log.info("moved primary to first album item: "+img.url);
                addAlbumItem(photo, img);
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
        photo.insertAt = -1;
        if (imageIndex < 0)
            return 0;

        if (imageIndex >= 0)
            $('#numberButton'+(imageIndex+1)).addClass('album');

        // Set correct AlbumIndex
        if (imageIndex == rp.session.activeIndex) {
            if (rp.session.activeAlbumIndex == LOAD_PREV_ALBUM)
                rp.session.activeAlbumIndex = photo.album.length-1;
            if (rp.session.activeAlbumIndex == -1)
                rp.session.activeAlbumIndex = 0;
            if (albumIndex === undefined || albumIndex < 0)
                albumIndex = rp.session.activeAlbumIndex;

        } else if (albumIndex === undefined || albumIndex < 0) {
            return 0;
        }

        return albumIndex;
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

        if (photo.type == imageTypes.album) {
            var ul = $("<ul />");

            $.each(photo.album, function(index, pic) {
                ul.append(albumButtonLi(pic, index));
            });

            var div = $("<div>", { id: 'albumNumberButtons',
                                   class: 'numberButtonList'
                                 }).append(ul);
            $("#navboxContents").append(div);
            if ($('#albumCollapser').attr(OPENSTATE_ATTR) == "closed")
                $(div).hide();
        }
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

    var addAlbumItem = function (photo, pic) {
        var index;
        if (photo.insertAt < 0)
            index = photo.album.length;
        else
            index = photo.insertAt;
        // check for duplicates
        for(var i = 0; i < photo.album.length; ++i) {
            if (photo.album[i].url == pic.url) {
                log.info("cannot display url [sub-album dup]: ["+i+"] exists, skip ["+index+"]: "+pic.url);
                return;
            }
        }

        addPhotoParent(pic, photo);
        var sld = hostnameOf(pic.url, true).match(/[^\.]*/)[0];
        if (rp.favicons[sld])
            pic.favicon = rp.favicons[sld];

        else if (photo.favicon !== undefined &&
                 hostnameOf(photo.url, true) == hostnameOf(pic.url, true))
            pic.favicon = photo.favicon;

        if (photo.insertAt < 0) {
            photo.album.push(pic);
            if (photo.index !== undefined &&
                photo.index == rp.session.activeIndex)
                $('#allNumberButtons ul').append(albumButtonLi(pic));

        } else {
            ++photo.insertAt;
            photo.album.splice(index, 0, pic);
            if (photo.index !== undefined &&
                photo.index == rp.session.activeIndex) {
                $('#allNumberButtons ul').children(":nth-child("+(index+1)+")")
                .after(albumButtonLi(pic));
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

        } else if (parent.index != rp.session.activeIndex)
            return;

        else if (button == undefined)
                button = $('#allNumberButtons ul').children(":nth-child("+(index+1)+")");

        button.removeClass('embed album over18');

        addButtonClass(button, pic);
    };

    var processPhoto = function(pic) {
        if (pic === undefined)
            return false;

        if (pic.orig_url === undefined)
            pic.orig_url = pic.url;

        if (pic.type === undefined)
            pic.type = imageTypes.image;

        else if (pic.type == imageTypes.fail)
            return false;

        pic.url = fixupUrl(pic.url);
        // hostname only: second-level-domain.tld
        var hostname = hostnameOf(pic.url, true);
        var sld = hostname.match(/[^\.]*/)[0];

        if (rp.favicons[sld])
            pic.favicon = rp.favicons[sld];

        // If this already has an album attached
        if (pic.type == imageTypes.album &&
            pic.album !== undefined)
            return true;

        // return if already setup as video
        if (pic.type == imageTypes.video &&
            pic.video !== undefined)
            return true;

        // return if already setup as embeded
        if (pic.type == imageTypes.embed)
            return true;

        var shortid;
        var fqdn = hostnameOf(pic.url);

        if (hostname == 'imgur.com') {
            pic.url = fixImgurPicUrl(pic.url);
            if (pic.url.indexOf("/a/") > 0 ||
                pic.url.indexOf('/gallery/') > 0)
                pic.type = imageTypes.later;

            else if (isVideoExtension(pic.url))
                initPhotoVideo(pic);

            // otherwise simple image
        } else if (hostname == 'wordpress.com') {
            // strip out search portion
            if (isImageExtension(pic.url)) {
                var anc = $('<a>', { href: pic.url });
                pic.url = anc.prop('origin')+anc.prop('pathname');

            } else if (pic.thumbnail === "") {
                log.info('cannot display url [no thumbnail]: ' + pic.url);
                return false;

            } else if (url2shortid(pic.url) === "") {
                log.info('cannot display url [no shortid]: ' + pic.url);
                return false;

            } else {
                pic.type = imageTypes.later;
            }

        } else if (hostname == 'streamable.com' ||
                   hostname == 'vid.me' ||
                   hostname == 'pornbot.net' ||
                   hostname == 'deviantart.com') {
            // These domains should always be processed later
            pic.type = imageTypes.later;

        } else if (hostname == 'gifs.com') {
            shortid = url2shortid(pic.url);
            if (shortid.indexOf('-') != -1)
                shortid = shortid.substr(shortid.lastIndexOf('-')+1);

            pic.type = imageTypes.video;
            pic.video = { mp4s: [ 'https://j.gifs.com/'+shortid+'@large.mp4',
                                  'https://j.gifs.com/'+shortid+'.mp4' ],
                          thumbnail: 'https://j.gifs.com/'+shortid+'.jpg' };

        } else if (hostname == 'giphy.com') {
            //giphy.com/gifs/NAME-OF-VIDEO-SHORTID
            //media.giphy.com/media/SHORTID/giphy.TYPE
            //i.giphy.com/SHORTID.TYPE
            shortid = pathnameOf(pic.url).split('/')[2];
            if (shortid)
                shortid = shortid.substr(shortid.lastIndexOf('-')+1);
            else
                shortid = url2shortid(pic.url);

            if (shortid)
                initPhotoVideo(pic, 'https://i.giphy.com/media/'+shortid+'/giphy.mp4');
            else
                log.info("cannot display video [error parsing]: "+pic.url);                
                
        } else if (pic.url.indexOf('webm.land/w/') >= 0) {
            shortid = url2shortid(pic.url);
            initPhotoVideo(pic, 'http://webm.land/media/'+shortid+".webm");

        } else if (hostname == 'youtube.com') {
            // Types of URLS
            // https://www.youtube.com/embed/SHORTID
            // https://www.youtube.com/watch?v=SHORTID
            shortid = url2shortid(pic.url);
            if (shortid == 'watch')
                shortid = searchValueOf(pic.url, 'v');
            initPhotoEmbed(pic, youtubeURL(shortid));

        } else if (hostname == 'youtu.be') {
            initPhotoEmbed(pic, youtubeURL(url2shortid(pic.url)));

        } else if (hostname == 'openload.co') {
            // //openload.co/embed/SHORTID/Name_Of_original_file
            // //openload.co/f/SHORTID/Title_of_picture
            // final name/title is optional
            shortid = url2shortid(pic.url, 2);
            
            // no autostart
            initPhotoEmbed(pic, 'https://www.openload.co/embed/'+shortid);

        } else if (hostname == 'pornhub.com') {
            // JSON Info about video
            // 'https://www.pornhub.com/webmasters/video_by_id?id='+shortid
            var a = searchOf(pic.url);

            shortid = a.viewkey;
            
            if (a.pkey)
                pic.extra = infoLink('https://www.pornhub.com/playlist/'+a.pkey, 'Playlist');

            if (shortid)
                initPhotoEmbed(pic, 'https://www.pornhub.com/embed/'+shortid+'?autoplay=1');
            else {
                log.info("cannot parse url [bad search]: "+pic.url);
                return false;
            }

        } else if (hostname == 'redtube.com') {
            shortid = url2shortid(pic.url);
            initPhotoEmbed(pic, 'https://embed.redtube.com/?bgcolor=000000&autoplay=1&id='+shortid);

        } else if (hostname == 'xvideos.com') {
            // no autostart
            initPhotoEmbed(pic, 'https://www.xvideos.com/embedframe/'+url2shortid(pic.url));

        } else if (hostname == 'keezmovies.com') {
            // no autostart
            initPhotoEmbed(pic, 'https://www.keezemovies.com/embed/'+url2shortid(pic.url));

        } else if (hostname == 'spankbang.com') {
            // no autostart
            initPhotoEmbed(pic, 'https://spankbang.com/embed/'+url2shortid(pic.url, 1));

        } else if (hostname == 'youporn.com') {
            // https://www.youporn.com/watch/SHORTID/TEXT-NAME-IN-URL/
            shortid = url2shortid(pic.url, 2);
            initPhotoEmbed(pic, "https://www.youporn.com/embed/"+shortid+'?autoplay=1');

        } else if (hostname == 'xhamster.com') {
            // https://xhamster.com/videos/NAME-OF-VIDEO-SHORTID
            // https://xhamster.com/movies/SHORID/NAME_OF_VIDEO.html
            if (pic.url.indexOf('/videos/') > 0) {
                shortid = url2shortid(pic.url);
                shortid = shortid.substr(shortid.lastIndexOf('-')+1);

            } else if (pic.url.indexOf('/movies/') > 0) {
                shortid = url2shortid(pic.url, 2);

            } else {
                log.info("cannot parse url [unknown format]: "+pic.url);
                return false;
            }
            initPhotoEmbed(pic, "https://xhamster.com/xembed.php?video="+shortid+'&autoplay=1');

        } else if (hostname == 'tube8.com') {
            shortid = pathnameOf(pic.url);
            initPhotoEmbed(pic, 'https://www.tube8.com/embed'+shortid+'?autoplay=1');

        } else if (hostname == 'txxx.com') {
            shortid = url2shortid(pic.url, 2);
            // no autostart
            initPhotoEmbed(pic, 'https://m.txxx.com/embed/'+shortid);

        } else if (hostname == 'vimeo.com') {
            shortid = url2shortid(pic.url);
            initPhotoEmbed(pic, 'https://player.vimeo.com/video/'+shortid+'?autoplay=1');

        } else if (hostname == 'iloopit.net') {
            // VIDEO:
            // https://gifs.iloopit.net/resources/UUID/converted.gif
            // https://cdn.iloopit.net/resources/UUID/converted.{mp4,webm}
            // https://cdn.iloopit.net/resources/UUID/thumb.jpeg
            // GIFV: (no easy way to convert to VIDEO UUID - ID is uint32ish)
            // https://iloopit.net/ID/TITLE-NAME.gifv
            var ext = extentionOf(pic.url);
            if (ext == 'gif' || isVideoExtension(pic.url)) {
                shortid = url2shortid(pic.url, 2);
                initPhotoVideo(pic, 'https://cdn.iloopit.net/resources/'+shortid+'/converted.mp4',
                               'https://cdn.iloopit.net/resources/'+shortid+'/thumb.jpeg');
                pic.video.webm = 'https://cdn.iloopit.net/resources/'+shortid+'/converted.webm';

            } else if (ext == 'gifv') {
                initPhotoEmbed(pic);

            } else {
                log.info('cannot process url [unknown format]: '+pic.url);
                return false;
            }

        } else if (isVideoExtension(pic.url)) {
            initPhotoVideo(pic);
            
        } else if (hostname == 'gfycat.com') {
            // These domains should be processed later, unless direct link to video
            pic.type = imageTypes.later;

        } else if (isImageExtension(pic.url) ||
                   fqdn == 'i.reddituploads.com') {
            // simple image

        } else if (hostname == 'gyazo.com') {
            shortid = url2shortid(pic.url);
            pic.url = 'https://i.gyazo.com/'+shortid+'.png';

        } else if (hostname == 'sendvid.com') {
            shortid = url2shortid(pic.url);
            initPhotoVideo(pic, 'https://cache-1.sendvid.com/'+shortid+'.mp4',
                           'https://cache-1.sendvid.com/'+shortid+'.jpg');

        } else if (hostname == 'vidble.com') {
            if (pic.url.indexOf("/watch?v=") > 0) {
                shortid = /[#?&]v=([^&#=]*)/.exec(pic.url);
                if (shortid === undefined || shortid === null) {
                    log.error("Failed to parse vidble url: "+pic.url);
                    return false;
                }
                shortid = shortid[1];
                initPhotoVideo(pic, 'https://www.vidble.com/'+shortid+'.mp4',
                               'https://www.vidble.com/'+shortid+'.png');

            } else if (pic.url.indexOf("/album/") > 0) {
                // TODO : figure out /album/ on vidble.com/api
                log.info("cannot display url [no album processing]: "+pic.url);
                return false;
  
            } else { 
                shortid = url2shortid(pic.url);
                pic.url = 'https://www.vidble.com/'+shortid+'.jpg';
            }

        } else if (hostname == 'tumblr.com' && pic.url.indexOf('/post/') > 0) {
            // Don't process bare tumblr blogs, nor /day/YYYY/MM/DD/ format
            // only BLOGNAME.tumblr.com/post/SHORTID/...
            pic.type = imageTypes.later;

        } else {
            return false;
        }
        return true;
    };

    var addButtonClass = function(button, pic) {
        var photo = photoParent(pic);

        if (photo.over18)
            button.addClass("over18");

        if (pic.type == imageTypes.embed)
            button.addClass("embed");

        else if (pic.type == imageTypes.album)
            button.addClass("album");

        else if (pic.type == imageTypes.fail)
            button.addClass("failed");

    };

    // Re-entrant okay
    var addImageSlide = function (photo) {
        /* var pic = {
         *     title: title, (text)
         *     url: url, (URL)
         *     id: shortid, (text)
         *     "commentsLink": commentsLink, (URL)
         *     "over18": over18, (BOOLEAN)
         *     "type": image_or_video, (from imageTypes)
         *     subreddit: optional, (text - /r/$subreddit)
         *     author: optional, (text - /u/$author)
         *     extra: optional, (HTML)
         *     date: optional, (unixTime)
         *     duplicates: optional, [ array of { subreddit, id } ]
         *     thumbnail: optional, (URL)
         * }
         */
        // Check if this photo is already in rp.photos
        if (photo.index !== undefined)
            return true;

        if (photo.duplicates === undefined)
            photo.duplicates = [];

        if (!processPhoto(photo)) {
            log.info('cannot display url [no image]: ' + photo.url);
            return false;
        }

        var isFirst = !rp.session.foundOneImage;
        rp.session.foundOneImage = true;

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
        if (isFirst)
            startAnimation(getNextSlideIndex(-1));

        return true;
    };

    var getFavicon = function(pic, url) {
        if (url === undefined)
            url = pic.orig_url || pic.url;
        // #1 pic.favicon
        var fav = pic.favicon;
        // #2 rp.favicon[]
        if (fav === undefined) {
            var sld = hostnameOf(url, true).match(/[^\.]*/)[0];
            fav = rp.favicons[sld];
        }
        // #3 check if wordpress v2 site
        if (fav === undefined) {
            var hn = hostnameOf(url);
            if (rp.wpv2[hn] === true)
                fav = rp.favicons.wordpress;
        }
        if (fav)
            return $("<img />", {'class': 'redditp favicon', src: fav});

        // #4 try //site/favicon.ico
        var img = $("<img />", {'class': 'redditp favicon', src: originOf(url)+'/favicon.ico'});

        // #5 replace with link icon
        img.on('error', googleIcon("link"), fixFavicon);
        img.on('load',  googleIcon("link"), fixFavicon);
        return img;
    };

    var fixFavicon = function(e) {
        if (e.type == "error" ||
            $(this)[0].naturalHeight == 1 ||
            $(this)[0].naturalWidth == 1)
            $(this).parent().html(e.data);
    };

    var arrow = {
        left: 37,
        up: 38,
        right: 39,
        down: 40
    };
    var ZERO_KEY = 48;
    var ONE_KEY = 49;
    var TWO_KEY = 50;
    var THREE_KEY = 51;
    var FOUR_KEY = 52;
    var FIVE_KEY = 53;
    var SIX_KEY = 54;
    var SEVEN_KEY = 55;
    var EIGHT_KEY = 56;
    var NINE_KEY = 57;

    var SPACE = 32;
    var PAGEUP = 33;
    var PAGEDOWN = 34;
    var ENTER = 13;

    var A_KEY = 65;
    var C_KEY = 67;
    var D_KEY = 68;
    var F_KEY = 70;
    var I_KEY = 73;
    var M_KEY = 77;
    var O_KEY = 79;
    var P_KEY = 80;
    var R_KEY = 82;
    var S_KEY = 83;
    var T_KEY = 84;
    var U_KEY = 85;
    var W_KEY = 87;


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
        case C_KEY:
            $('#controlsDiv .collapser').click();
            break;
        case T_KEY:
            $('#titleDiv .collapser').click();
            break;
        case SPACE:
            $("#autoNextSlide").click();
            break;
        case I_KEY:
            open_in_background("#navboxLink");
            break;
        case O_KEY:
            open_in_background("#navboxCommentsLink");
            break;
        case D_KEY:
        case P_KEY:
            open_in_background("#navboxDuplicatesLink");
            break;
        case R_KEY:
            open_in_background("#navboxDuplicatesMulti");
            break;
        case M_KEY:
            $('#mute').click();
            break;
        case F_KEY:
            $('#fullscreen').click();
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
            if ($('#duplicateUl li .infol')[i])
                open_in_background_url($('#duplicateUl li .infol')[i]);
            break;
        case ZERO_KEY:
            open_in_background('#navboxSubreddit');
            break;
        }
    });

    // Capture all clicks on infop links (links that direct locally
    $(document).on('click', 'a.infop', function (event) {
        if (event) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }

        var path = $(this).prop('pathname')+$(this).prop('search');
        processUrls(path);
    });

    // Capture clicks on AlbumButtons
    $(document).on('click', 'a.albumButton', function (e) {
        startAnimation($('#allNumberButtons a.active').data("index"),
                       $(this).data("index"));
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
            if (rp.session.loadAfter !== null && imageIndex != 0)
                rp.session.loadAfter();
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

            // save next+1, but don't create it
            var newnext = getNextSlideIndex(next);
            if (newnext != next && oldCache[newnext])
                rp.cache[newnext] = oldCache[newnext];

            // save previous
            if (oldCache[prev])
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
        var needRefresh = false;
        resetNextSlideTimer();

        log.debug("startAnimation("+imageIndex+", "+albumIndex+")");

        // If the same number has been chosen, or the index is outside the
        // rp.photos range, or we're already animating, do nothing
        if (imageIndex < 0 || imageIndex >= rp.photos.length ||
            rp.session.isAnimating || rp.photos.length == 0) {

            log.debug("NOT ANIMATING photo.length=="+rp.photos.length+" isAnimating:"+rp.session.isAnimating);

            if (imageIndex >= rp.photos.length &&
                rp.session.loadAfter !== null)
                rp.session.loadAfter();
            return;
        }

        if (rp.session.activeIndex == imageIndex) {
            if (rp.photos[imageIndex].type != imageTypes.album || albumIndex < 0)
                return;

            if (albumIndex >= rp.photos[imageIndex].album.length) {
                log.error("["+imageIndex+"] album index ("+albumIndex+") past end of album length:"+
                      rp.photos[imageIndex].album.length);
                return;
            }
            if (rp.session.activeAlbumIndex == albumIndex)
                return;

        } else if (rp.photos[imageIndex].type == imageTypes.album && albumIndex < 0) {
            if (albumIndex == LOAD_PREV_ALBUM)
                albumIndex = rp.photos[imageIndex].album.length-1;
            else
                albumIndex = 0;
        }

        var oldIndex = rp.session.activeIndex;
        var oldAlbumIndex = rp.session.activeAlbumIndex;
        rp.session.activeIndex = imageIndex;
        rp.session.activeAlbumIndex = albumIndex;
        rp.session.isAnimating = true;

        animateNavigationBox(imageIndex, oldIndex, albumIndex, oldAlbumIndex);
        slideBackgroundPhoto();
        // rp.session.activeAlbumIndex may have changed in createDiv called by slideBackgroundPhoto
        preloadNextImage(imageIndex, rp.session.activeAlbumIndex);

        // Save current State
        var state = { photos: rp.photos,
                      dedup: rp.dedup,
                      index: rp.session.activeIndex,
                      album: rp.session.activeAlbumIndex,
                      after: rp.session.after,
                      loadAfter: (rp.session.loadAfter) ?rp.session.loadAfter.name :null,
                      filler: null};
        rp.history.replaceState(state, "", rp.url.path); 
    };

    var toggleNumberButton = function (imageIndex, turnOn) {
        if (imageIndex < 0)
            return;
        var numberButton = $('#numberButton' + (imageIndex + 1));
        if (turnOn) {
            numberButton.addClass('active');
            if (numberButton[0].scrollIntoView !== undefined)
                numberButton[0].scrollIntoView();
        } else {
            numberButton.removeClass('active');
        }
    };

    var toggleAlbumButton = function (imageIndex, turnOn) {
        if (imageIndex < 0)
            return;
        var numberButton = $('#albumButton' + (imageIndex + 1));
        if (turnOn) {
            numberButton.addClass('active');
            if (numberButton[0].scrollIntoView !== undefined)
                numberButton[0].scrollIntoView();
        } else {
            numberButton.removeClass('active');
        }
    };

    //
    // Animate the navigation box
    //
    var animateNavigationBox = function (imageIndex, oldIndex, albumIndex, oldAlbumIndex) {
        if (albumIndex === undefined)
            albumIndex = -1;
        if (oldAlbumIndex === undefined)
            oldAlbumIndex = -1;
        var photo = rp.photos[imageIndex];
        var image = photo;
        if (albumIndex >= 0)
            image = photo.album[albumIndex];
        var subreddit = '/r/' + photo.subreddit;
        var now = Date.now()/1000;

        var authName;
        if (image.author !== undefined)
            authName = image.author;

        else if (photo.author !== undefined)
            authName = photo.author;

        // COMMENTS/BUTTON LIST Box
        $('#navboxCommentsLink').attr('href', photo.commentsLink);
        var url = image.orig_url || photo.orig_url || photo.url;
        $('#navboxOrigLink').attr('href', url);
        $('#navboxOrigLink').html(getFavicon(image, url));

        if (url != photo.orig_url) {
            $('#navboxAlbumOrigLink').attr('href', photo.orig_url);
            $('#navboxAlbumOrigLink').html(getFavicon(photo));
            $('#navboxAlbumOrigLink').removeClass('hidden');
        } else {
            $('#navboxAlbumOrigLink').addClass('hidden');
        }            

        if (rp.session.loginExpire) {
            $('#loginUsername').parent().removeClass('hidden');
            if (now > rp.session.loginExpire-30)
                clearRedditLogin();
            // if user does a login in another window/tab, this will update with getRedditImages().
        } else {
            $('#loginUsername').parent().addClass('hidden');
        }

        // TITLE BOX
        $('#navboxTitle').html(picTitle(image));
        var flair = picFlair(image);
        if (flair)
            $('#navboxTitle').prepend($('<span>', { class: 'linkflair' }).text(flair));
        $('#navboxLink').attr('href', image.url).attr('title', picTitleText(image)+" (i)").html(googleIcon(image.type));
        $('#navboxExtra').html(picExtra(image));
        if (albumIndex >= 0)
            $('#navboxExtra').prepend($('<span>', { class: 'info' }).text((albumIndex+1)+"/"+rp.photos[imageIndex].album.length));
        
        if (photo.subreddit !== undefined && photo.subreddit !== null) {
            $('#navboxSubreddit').attr('href', rp.redditBaseUrl + subreddit).html(subreddit);
            $('#navboxSubredditP').attr('href', rp.url.base+subreddit)
                .html($('<img />', {'class': 'redditp', src: 'images/favicon.png'}));
            $('#navboxSubreddit').show();
            $('#navboxSubredditP').show();
        } else {
            $('#navboxSubreddit').hide();
            $('#navboxSubredditP').hide();
        }

        if (authName) {
            var authLink = '/u/' + authName;
            $('#navboxAuthor').attr('href', rp.redditBaseUrl + authLink).html(authLink);
            $('#navboxAuthorP').attr('href', rp.url.base+'/user/'+authName+'/submitted')
                .html($('<img />', {'class': 'redditp', src: 'images/favicon.png'}));
            $('#navboxAuthor').show();
            $('#navboxAuthorP').show();
        } else {
            $('#navboxAuthor').hide();
            $('#navboxAuthorP').hide();
        }
        if (photo.commentsCount) {
            $('#navboxSubredditC').show();
            $('#navboxSubredditC').attr('href', photo.commentsLink);
            $('#navboxSubredditC').text('('+photo.commentsCount+")");
        } else {
            $('#navboxSubredditC').hide();
        }
        if (photo.date)
            $('#navboxDate').attr("title", (new Date(photo.date*1000)).toString()).text(sec2dms(now - photo.date));
        else
            $('#navboxDate').attr("title", "").text("");

        $('#navboxDuplicatesLink').attr('href',  rp.redditBaseUrl + '/r/' +
                                        photo.subreddit + '/duplicates/' + photo.id);
        $('#duplicateUl').html("");
        if (photo.duplicates.length > 0) {
            if ($('#duplicateCollapser').attr(OPENSTATE_ATTR) == "open")
                $('#duplicateDiv').show();
            var multi = photo.subreddit;
            $.each(photo.duplicates, function(i, item) {
                var subr = '/r/' +item.subreddit;
                multi += '+'+item.subreddit;
                var li = $("<li>", { class: 'list'}).html(infoLink(rp.redditBaseUrl + subr,
                                                                   subr, subr,
                                                                   picTitleText(item)+" ("+(i+1)+")"));
                li.append($("<a>", { href: rp.redditBaseUrl + subr + "/comments/"+item.id,
                                     class: 'info infoc',
                                     title: 'Comments'
                                   }).text('('+item.commentCount+')'));
                if (photo.cross_id && photo.cross_id == item.id)
                    li.addClass('xorig');
                $('#duplicateUl').append(li);
            });
            $('#navboxDuplicatesMulti').attr('href', rp.redditBaseUrl+'/r/'+multi);
            $('#navboxDuplicatesMultiP').attr('href', rp.url.base+'/r/'+multi);
        } else {
            $('#duplicateDiv').hide();
        }

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

    var failCleanup = function(message) {
        if (message === undefined)
            message = '';
        if (rp.photos.length > 0) {
            // already loaded images, don't ruin the existing experience
            return;
        }

        // remove "loading" title
        $('#navboxTitle').html(message);

        // display alternate recommendations
        $('#recommend').css({'display':'block'});
    };

    var failedAjax = function (xhr, ajaxOptions, thrownError) {
        log.info("ActiveIndex:["+rp.session.activeIndex+"]["+rp.session.activeAlbumIndex+"]");
        log.info("xhr:", xhr);
        log.info("ajaxOptions:", ajaxOptions);
        log.error("error:", thrownError);
        log.info("this:", $(this));
    };
    var failedAjaxDone = function (xhr, ajaxOptions, thrownError) {
        failedAjax(xhr, ajaxOptions, thrownError);
        rp.session.loadingNextImages = false;
        var text;
        if (xhr.status == 0)
            text = "<br> Check tracking protection";
        else
            text = ": "+thrownError+" "+xhr.status;
        failCleanup($('<span>',
                      { class: 'error' }).html("Failed to get "+rp.url.subreddit+text));

    };

    //
    // Slides the background photos
    // Only called with rp.session.activeIndex, rp.session.activeAlbumIndex
    var slideBackgroundPhoto = function () {
        var divNode;
        var aIndex = rp.session.activeAlbumIndex;
        var type;

        if (rp.session.activeAlbumIndex < 0)
            aIndex = 0;

        // Look for div in Cache
        if (rp.cache[rp.session.activeIndex] === undefined ||
            rp.cache[rp.session.activeIndex][aIndex] === undefined) {

            divNode = createDiv(rp.session.activeIndex, rp.session.activeAlbumIndex);

            // may change from LOAD_PREV_ALBUM
            if (rp.session.activeAlbumIndex >= 0)
                aIndex = rp.session.activeAlbumIndex;

            if (rp.cache[rp.session.activeIndex] === undefined)
                rp.cache[rp.session.activeIndex] = {};
            rp.cache[rp.session.activeIndex][aIndex] = divNode;

        } else
            divNode = rp.cache[rp.session.activeIndex][aIndex];

        // Read type here, since it may change during createDiv()
        if (rp.session.activeAlbumIndex < 0) {
            type = rp.photos[rp.session.activeIndex].type;

            if (type == imageTypes.album) {
                rp.session.activeAlbumIndex = 0;
                type = rp.photos[rp.session.activeIndex].album[rp.session.activeAlbumIndex].type;
            }

        } else
            type = rp.photos[rp.session.activeIndex].album[rp.session.activeAlbumIndex].type;


        if (type == imageTypes.video ||
            type == imageTypes.embed ||
            type == imageTypes.later)
            clearSlideTimeout();

        divNode.prependTo("#pictureSlider");
        $("#pictureSlider div").fadeIn(rp.settings.animationSpeed);
        var oldDiv = $("#pictureSlider div:not(:first)");
        oldDiv.fadeOut(rp.settings.animationSpeed, function () {
            oldDiv.detach();

            var vid = $('#gfyvid');
            if (vid) {
                vid.prop('autoplay', true);
                if (vid[0])
                    vid[0].play();
            }

            rp.session.isAnimating = false;
        });
    };

    var createDiv = function(imageIndex, albumIndex) {
        if (albumIndex === undefined)
            albumIndex = -1;
        // Retrieve the accompanying photo based on the index
        var photo;
        if (albumIndex >= 0)
            photo = rp.photos[imageIndex].album[albumIndex];

        else if (rp.photos[imageIndex].type == imageTypes.album)
            photo = rp.photos[imageIndex].album[0];

        else
            photo = rp.photos[imageIndex];

        log.debug("createDiv("+imageIndex+", "+albumIndex+")");

        // Used by showVideo and showImage
        var divNode = $("<div />");

        if (photo === undefined)
            return divNode;

        // Create a new div and apply the CSS
        var showImage = function(url, needreset) {
            if (needreset === undefined)
                needreset = true;

            var img = $('<img />', { class: "fullscreen", src: url});

            img.on('error', function(e) {
                log.info("["+imageIndex+"] video failed to load");
            });
            if (hostnameOf(url, true) == 'imgur.com')
                img.on('load', function(e) {
                    // https://i.imgur.com/removed.png is 161x81
                    if ($(this)[0].naturalHeight == 81 &&
                        $(this)[0].naturalWidth == 161) {
                        log.info("["+photo.index+"] Image has been removed: "+photo.url);
                        initPhotoFailed(photo);
                    }
                });
            divNode.append(img);

            if (needreset && imageIndex == rp.session.activeIndex)
                resetNextSlideTimer();
        };

        // Called with showVideo({'thumbnail': jpgurl, 'mp4': mp4url, 'webm': webmurl})
        var showVideo = function(data) {
            var video = $('<video id="gfyvid" class="fullscreen" preload="auto" playsinline />');
            var lastsource;

            video.prop('playsinline', '');
            if (data.thumbnail !== undefined)
                video.attr('poster', fixupUrl(data.thumbnail));
            if (isVideoMuted())
                video.prop('muted', true);
            if (data.webm !== undefined) {
                lastsource = $('<source type="video/webm" />').attr('src', data.webm);
                video.append(lastsource);
            }
            if (data.mp4s !== undefined)
                $.each(data.mp4s, function (i, item) {
                    lastsource = $('<source type="video/mp4" />').attr('src', item);
                    video.append(lastsource);
                });
            if (data.mp4 !== undefined) {
                lastsource = $('<source type="video/mp4" />').attr('src', data.mp4);
                video.append(lastsource);
            }

            divNode.append(video);

            $(lastsource).on('error', function(e) {
                log.info("["+imageIndex+"] video failed to load last source: "+photo.url);
                initPhotoFailed(photo);
                resetNextSlideTimer();
            });

            $(video).on('error', function(e) {
                log.info("["+imageIndex+"] video failed to load: "+photo.url);
                initPhotoFailed(photo);
                resetNextSlideTimer();
            });

            $(video).on('ended', function(e) {
                log.debug("["+imageIndex+"] video ended");
                if ($.contains(document, $(video)[0]) && (shouldStillPlay(imageIndex) || !autoNextSlide()))
                    $(video)[0].play();
            });

            $(video).on("loadeddata", function(e) {
                photo.duration = e.target.duration;
                if (photo.duration < rp.settings.timeToNextSlide) {
                    photo.times = Math.ceil(rp.settings.timeToNextSlide/photo.duration);
                } else {
                    photo.times = 1;
                }
                log.debug("["+imageIndex+"] Video loadeddata video: "+photo.duration+" playing "+photo.times);
            });
            
            // Set Autoplay for iOS devices
            if (rp.session.is_ios) {
                // iOS version < 10 do not autoplay, so timeout
                if (rp.session.is_pre10ios && imageIndex == rp.session.activeIndex) {
                    log.debug('iOS pre-10 detected, setting timmer');
                    resetNextSlideTimer();
                } else {
                    log.debug('iOS device detected setting autoplay');
                    $(video).attr('autoplay', true);
                }

            } else {
                var onCanPlay = function() {
                    $(video).off('canplaythrough', onCanPlay);
                    if ($.contains(document, $(video)[0]))
                        $(video)[0].play();
                };
                $(video).on('canplaythrough', onCanPlay);
            }

            // iOS devices < 10 don't play automatically
            $(video).on("click", function(e) {
                // if we're pre-10, then the tiemr is active
                if (rp.session.is_pre10ios && imageIndex == rp.session.activeIndex)
                    clearSlideTimeout();
                $(video)[0].play();
            });
        };

        // Called with showEmbed(urlForIframe)
        var showEmbed = function(url) {
            var iframe = $('<iframe/>', { id: "gfyembed",
                                          class: "fullscreen",
                                          frameborder: 0,
                                          webkitallowfullscreen: true,
                                          mozallowfullscreen: true,
                                          allowfullscreen: true });
            // ensure updateAutoNext doesn't reset timer
            photo.times = 1;

            $(iframe).bind("load", function() {
                var iframe = $('#gfyembed');
                var c = $(iframe).contents();
                var video = $(c).find("video")[0];
                if (!video) {
                    log.info("["+imageIndex+"] X-Site Protection: Auto-next not triggered");
                    return;
                }
                $(video).attr("id", "gfyvid");
                updateVideoMute();

                log.info("["+imageIndex+"] embed video found: "+video.attr("src"));

                $(video).on("loadeddata", function(e) {
                    photo.duration = e.target.duration;
                    log.debug("["+imageIndex+"] embed video metadata.duration: "+e.target.duration );
                    // preload, don't mess with timeout
                    if (imageIndex !== rp.session.activeIndex)
                        return;
                    log.debug("["+imageIndex+"] embed video loadeddata running for active image");
                    video.prop('autoplay', true);
                    video[0].play();
                    if (rp.settings.shouldAutoNextSlide && photo.duration > rp.settings.timeToNextSlide)
                        resetNextSlideTimer(photo.duration);
                    else
                        resetNextSlideTimer();
                });
            });
            $(iframe).attr('src', url);

            divNode.append(iframe);
        };

        var showPic = function(pic) { 
            if (pic.type == imageTypes.album) {
                var index = indexPhotoAlbum(photo, imageIndex, albumIndex);
                if (index < 0) {
                    log.error("["+imageIndex+"]["+albumIndex+"] album is zero-length, failing to thumbnail: "+pic.url);
                    showImage(pic.thumbnail);
                    return;
                }
                pic = pic.album[index];
            }

            if (pic.type == imageTypes.video)
                showVideo(pic.video);
            
            else if (pic.type == imageTypes.embed)
                showEmbed(pic.url);

            else if (pic.type == imageTypes.fail)
                showImage(pic.thumbnail);

            else // Default to image type
                showImage(pic.url);
        };

        if (photo.type == imageTypes.image) {
            showImage(photo.url, false);
            return divNode;
        }

        if (photo.type == imageTypes.fail) {
            showImage(photo.thumbnail, false);
            return divNode;
        }

        // Preloading, don't mess with timeout
        if (imageIndex == rp.session.activeIndex &&
            albumIndex == rp.session.activeAlbumIndex)
            clearSlideTimeout();

        if (photo.type == imageTypes.video) {
            if (photo.video === undefined) {
                log.error("["+imageIndex+"]["+albumIndex+"] type is video but no video element");

            } else {
                showVideo(photo.video);
                return divNode;
            }

        } else if (photo.type == imageTypes.embed) {
            showEmbed(photo.url);
            return divNode;
        }

        var jsonUrl, a, b;
        var dataType = 'json';
        var handleData;
        var headerData;
        var handleError = function (xhr, ajaxOptions, thrownError) {
            initPhotoFailed(photo);
            showImage(photo.thumbnail);
            //failedAjax(xhr, ajaxOptions, thrownError);
            log.info('failed to load url [error '+xhr.status+']: ' + photo.url);
        };
        var url = photo.url;

        var hostname = hostnameOf(url, true);
        var fqdn = hostnameOf(url);
        var shortid = url2shortid(url);
        
        if (hostname == 'gfycat.com') {
            // Strip everything trailing '-'
            if (shortid.indexOf('-') != -1)
                shortid = shortid.substr(0, shortid.lastIndexOf('-'));

            jsonUrl = "https://gfycat.com/cajax/get/" + shortid;

            // set photo url to sane value (incase it's originally a thumb link)
            photo.url = 'https://gfycat.com/'+shortid;

            handleData = function (data) {
                if (data.gfyItem === undefined) {
                    if (data.error !== undefined) {
                        log.info("failed to display gfycat [error]: "+data.error);
                        initPhotoFailed(photo);
                    }
                    showImage(photo.thumbnail);
                    return;
                }

                /* -- infoLink() takes text for favicon
                if (data.gfyItem.userName != 'anonymous')
                    photo.extra = infoLink('https://gfycat.com/@'+data.gfyItem.userName,
                                           "", // data.gfyItem.userName
                                           '/gfycat/u/'+data.gfyItem.userName);
                 */
                
                photo.video = {'thumbnail': data.gfyItem.posterUrl,
                               'webm': data.gfyItem.webmUrl,
                               'mp4':  data.gfyItem.mp4Url};
                photo.type = imageTypes.video;
                showVideo(photo.video);
            };
            
        } else if (hostname == 'imgur.com') {
            headerData = { Authorization: "Client-ID "+ rp.api_key.imgur };
            
            var imgurHandleAlbum = function (data) {
                if (data.data.images.length > 1) {
                    var index;

                    photo = initPhotoAlbum(photo, false);
                    $.each(data.data.images, function(i, item) {
                        var pic = { title: item.title || item.description,
                                    url: fixImgurPicUrl(item.animated ?item.mp4 :item.link),
                                    orig_url: data.data.link,
                                    type: item.animated ?imageTypes.video :imageTypes.image
                                  };
                        if (item.animated)
                            pic.video = { mp4: pic.url };

                        addAlbumItem(photo, pic);
                    });
                    index = indexPhotoAlbum(photo, imageIndex, albumIndex);

                    showPic(photo.album[index]);

                } else if (data.data.images.length == 1) { // single image album
                    var item = data.data.images[0];
                    if (item.animated) {
                        photo.url = fixImgurPicUrl(item.mp4);
                        photo.type = imageTypes.video;
                        photo.video = { thumbnail: photo.thumbnail,
                                        mp4: photo.url };
                        showVideo(photo.video);

                    } else {
                        photo.url = item.link;
                        photo.type = imageTypes.image;
                        showImage(photo.url);
                    }

                } else { // An empty album
                    initPhotoFailed(photo);
                    showImage(photo.thumbnail);
                }
            };

            if (photo.url.indexOf('/a/') > 0) {
                jsonUrl = "https://api.imgur.com/3/album/" + shortid;

                handleData = imgurHandleAlbum;

            } else if (photo.url.indexOf('/gallery/') > 0) {
                jsonUrl = "https://api.imgur.com/3/album/" + shortid;

                handleError = function (xhr, ajaxOptions, thrownError) {
                    photo.url = "https://i.imgur.com/"+shortid+".jpg";
                    photo.type = imageTypes.image;

                    showImage(photo.url);
                    return;
                };

                handleData = function (data) {
                    if (data === undefined) {
                        photo.url = "https://i.imgur.com/"+shortid+".jpg";
                        photo.type = imageTypes.image;

                        showImage(photo.url);
                        return;
                    }
                    imgurHandleAlbum(data);
                };

            } else {
                jsonUrl = "https://api.imgur.com/3/image/" + shortid;

                handleData = function (data) {
                    if (data.data.animated == true) {
                        photo.type = imageTypes.video;
                        photo.video = { mp4: fixImgurPicUrl(data.data.mp4) };
                        if (data.data.webm !== undefined)
                            photo.video.webm = fixImgurPicUrl(data.data.webm);

                        showVideo(photo.video);

                    } else {
                        photo.url = fixImgurPicUrl(data.data.link);
                        photo.type = imageTypes.image;
                        showImage(photo.url);
                    }
                };
            }

        } else if (hostname == 'vid.me') {
            jsonUrl = 'https://api.vid.me/videoByUrl/' + shortid;
            handleData = function (data) {
                if (data.video.state == 'success') {
                    photo.video = { thumbnail: data.video.thumbnail_url,
                                    mp4:  data.video.complete_url };
                    photo.type = imageTypes.video;
                    showVideo(photo.video);

                } else {
                    log.info("failed to load video [error:"+shortid+"]: "+data.video.state);
                    initPhotoFailed(photo);
                    showImage(data.video.thumbnail_url);
                }
            };

        } else if (hostname == 'streamable.com') {
            jsonUrl = "https://api.streamable.com/videos/" + shortid;

            handleData = function(data) {
                photo.type = imageTypes.video;
                photo.video = {'thumbnail': data.thumbnail_url };
                if (data.files.mp4 !== undefined)
                    photo.video.mp4 = data.files.mp4.url;
                if (data.files.webm !== undefined)
                    photo.video.webm = data.files.webm.url;
                showVideo(photo.video);
            };

        } else if (hostname == 'pornbot.net') {
            // Strip everything trailing '_'
            if (shortid.indexOf('_') != -1)
                shortid = shortid.substr(0, shortid.lastIndexOf('_'));
            
            jsonUrl = "https://pornbot.net/ajax/info.php?v=" + shortid;

            handleData = function(data) {
                if (data.error !== undefined) {
                    log.info("failed to load video [error]: "+data.error);
                    initPhotoFailed(photo);
                    showImage(photo.thumbnail);
                    return;
                }

                photo.type = imageTypes.video;
                photo.video = {'thumbnail': data.poster };
                if (data.mp4Url !== undefined)
                    // weirdism, 720pb.mp4 always fail while 720p.mp4 work
                    photo.video.mp4 = data.mp4Url.replace(/pb.mp4$/, 'p.mp4');
                if (data.webmUrl !== undefined)
                    photo.video.webm = data.webmUrl;
                showVideo(photo.video);
            };

        } else if (hostname == 'deviantart.com') {
            jsonUrl = 'https://backend.deviantart.com/oembed?format=jsonp&url=' + encodeURIComponent(photo.url);
            dataType = 'jsonp';

            handleData = function(data) {
                photo.extra = infoLink(data.author_url, data.author_name);

                if (data.type == 'photo') {
                    photo.type = imageTypes.image;
                    photo.url = data.url;
                    showImage(data.url);

                } else if (data.type == 'video') {
                    var prevtype = photo.type;
                    var f = $.parseHTML(data.html);

                    initPhotoEmbed(photo, f[0].src);
                    showEmbed(photo.url);
                    
                } else {
                    log.info("cannot display url [unk type "+data.type+"]: "+photo.url);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();
                }
            };
            
        } else if (hostname == 'tumblr.com') {
            shortid = url2shortid(photo.url, 2);

            jsonUrl = 'https://api.tumblr.com/v2/blog/'+fqdn+'/posts?api_key='+rp.api_key.tumblr+'&id='+shortid;
            dataType = 'jsonp';

            handleData = function(data) {
                photo.extra = infoLink(data.response.blog.url,
                                       data.response.blog.name,
                                       '/tumblr/'+data.response.blog.name);

                processTumblrPost(photo, data.response.posts[0]);
                showPic(photo);
            };

        } else if (hostname == 'wordpress.com') {
            photo.url = photo.url.replace(/\/amp\/?$/, '');
            shortid = url2shortid(photo.url);

            jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+fqdn+'/posts/slug:'+shortid;

            handleData = function(data) {
                processWordPressPost(photo, data);
                showPic(photo);
            };

        } else {
            log.error("["+photo.index+"] Unknown video site ["+hostname+"]: "+photo.url);
            initPhotoFailed(photo);
            showImage(photo.thumbnail);
        }

        if (jsonUrl !== undefined) {
            var wrapHandleData = function(data) {
                handleData(data);
                // Refresh navbox
                if (rp.session.activeIndex == imageIndex)
                    animateNavigationBox(imageIndex, imageIndex, rp.session.activeAlbumIndex);
            };

            $.ajax({
                url: jsonUrl,
                headers: headerData,
                dataType: dataType,
                success: wrapHandleData,
                error: handleError,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true
            });

        } else if (rp.session.activeIndex == imageIndex) {
            // refresh navbox
            animateNavigationBox(imageIndex, imageIndex, rp.session.activeAlbumIndex);
        }

        return divNode;
    };

    var fixImgurPicUrl = function (url) {
        var hostname = hostnameOf(url);

        // regexp removes /r/<sub>/ prefix if it exists
	// E.g. http://imgur.com/r/aww/x9q6yW9 or http://imgur.com/t/mashup/YjBiWcL
        // replace with gallery because it might be an album or a picture
        url = url.replace(/[rt]\/[^ \/]+\//, 'gallery/');

        if (url.indexOf('?') > 0)
            url = url.replace(/\?[^\.]*/, '');

        if (rp.settings.alwaysSecure)
            url = url.replace(/^http:/, "https:");

        if (url.indexOf("/a/") > 0 ||
             url.indexOf('/gallery/') > 0) {
            url = url.replace(/\/new$/, '');
            return url;
        }
            
        // process individual file
        if (hostname.indexOf('i.') !== 0) {
            url = url.replace(/[\w\.]*imgur.com/i, 'i.imgur.com');
        }
        // convert gifs to videos
        url = url.replace(/gifv?$/, "mp4");

        if (isImageExtension(url)) {
            // remove _d.jpg which is thumbnail
            url = url.replace(/_d(.[^\.\/])/, "$1");

        // imgur is really nice and serves the image with whatever extension
        // you give it. '.jpg' is arbitrary
        } else if (!isImageExtension(url) &&
            !isVideoExtension(url))
            url += ".jpg";
        return url;
    };

    var fixupUrl = function (url) {
        // fix reddit bad quoting
        url = url.replace(/&amp;/gi, '&');
        if (!rp.settings.alwaysSecure)
            return url;

        if (url.startsWith('//'))
            return "https:"+url;

        var hostname = hostnameOf(url, true);
        if (hostname == 'gfycat.com' ||
            hostname == 'pornhub.com' ||
            hostname == 'xhamster.com' ||
            hostname == 'youporn.com' ||
            hostname == 'imgur.com' ||
            hostname == 'pornbot.net')
            url = url.replace(/^http:/, "https:");

        return url;
    };

    var decodeUrl = function (url) {
        return decodeURIComponent(url.replace(/\+/g, " "));
    };

    var clearRedditLogin = function () {
        if (rp.session.loginExpire === 1)
            return;

        rp.session.loginExpire = 1;
        rp.url.get = rp.redditBaseUrl;
        $('#loginUsername').html(googleIcon('account_box'));
        $('#loginUsername').attr('title', 'Expired');
        log.debug("Clearing bearer is obsolete EOL:"+rp.session.loginExpire+" < now:"+Date.now()/1000);
        clearConfig(configNames.redditBearer);
        clearConfig(configNames.redditRefreshBy);
    };

    var loadRedditMultiList = function () {
        if (rp.session.loadedMultiList == true)
            return;

        var jsonUrl = rp.url.get+'/api/multi/mine';
        var handleData = function(data) {
            rp.session.loadedMultiList = true;
            var list = $('#multiListDiv ul:last-of-type');
            list.empty();

            $.each(data, function(i, item) {
                var path;
                if (item.data.visibility == "public") 
                    path = item.data.path;
                else
                    path = "/me/m/"+item.data.name;

                var link = infoLink(rp.redditBaseUrl + path,
                                    item.data.display_name,
                                    path,
                                    item.data.description_md);
                
                list.append($('<li>').html(link));
            });
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
        if (bearer === undefined)
            bearer = getConfig(configNames.redditBearer);
        if (by === undefined)
            by = getConfig(configNames.redditRefreshBy);
        if (rp.session.loginExpire > (Date.now()/1000)-30)
            return;
        $('#loginUsername').attr('href', rp.redditBaseUrl + '/api/v1/authorize?' + 
                                 ['client_id=' + rp.api_key.reddit,
                                  'response_type=token',
                                  'state='+encodeURIComponent(rp.url.path),
                                  'redirect_uri='+encodeURIComponent(rp.redirect),
                                  // read - /r/ALL, /me/m/ALL
                                  // history - /user/USER/submitted
                                  'scope=read,history'].join('&'));
        if (bearer !== undefined && by !== undefined && by-30 > Date.now()/1000) {
            var d = new Date(by*1000);
            rp.session.loginExpire = by;
            rp.session.redditHdr = { Authorization: 'bearer '+bearer };
            $('#loginUsername').html(googleIcon('verified_user'));
            $('#loginUsername').attr('title', 'Expires at '+d);
            rp.url.get = 'https://oauth.reddit.com';
            loadRedditMultiList();
            
        } else {
            clearRedditLogin();
        }
    };

    //
    // Site Specific Loading / Processing
    //

    var getRedditImages = function () {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        // Only enable login where it will work
        if ($('<a>').attr('href', rp.redirect).prop('origin') == window.location.origin)
            setupRedditLogin();

        var jsonUrl = rp.url.get + rp.url.subreddit + ".json?";
        var dataType = 'json';

        if (rp.url.subreddit.startsWith('/r/random') ||
            rp.url.subreddit.startsWith('/r/randnsfw')) {
            jsonUrl = rp.redditBaseUrl + rp.url.subreddit + ".json?jsonp=redditcallback";
            dataType = 'jsonp';
        }

        jsonUrl += rp.url.vars + rp.session.after;

        var addImageSlideRedditT3 = function (idorig, duplicates) {
            if (rp.dedup[idorig.subreddit] !== undefined &&
                rp.dedup[idorig.subreddit][idorig.id] !== undefined) {
                log.info('cannot display url [simul-dup:'+
                      rp.dedup[idorig.subreddit][idorig.id]+']: '+
                      idorig.url);
                return;
            }

            if (duplicates === undefined)
                duplicates = [];

            // parse parent if crosspost
            var idx = idorig;
            while (idx.crosspost_parent_list !== undefined &&
                   idx.crosspost_parent_list.length > 0) {
                var i = 0;
                idx = idx.crosspost_parent_list[0];
            }

            var url = fixupUrl(idx.url);

            // Link to x-posted subreddits
            var title = idorig.title.replace(/\/?(r\/\w+)\s*/g,
                                                "<a class='infol' href='"+rp.redditBaseUrl+"/$1'>/$1</a>"+
                                                "<a class='infop' href='"+rp.url.base+"/$1'>"+
                                                "<img class='redditp' src='images/favicon.png' /></a>");
            // Link to reddit users
            title = title.replace(/\/?u\/(\w+)\s*/g, 
                                  "<a class='infol' href='"+rp.redditBaseUrl+"/user/$1'>/u/$1</a>"+
                                  "<a class='infop' href='"+rp.url.base+"/user/$1/submitted'>"+
                                  "<img class='redditp' src='images/favicon.png' /></a>");

            var flair = "";
            // Add flair (but remove if also in title)
            if (idorig.link_flair_text) {
                flair = idorig.link_flair_text.trim();
                if (flair) {
                    var re = new RegExp('[\\[\\{\\(]'+RegExp.quote(flair)+'[\\]\\}\\)]', "ig");
                    title = title.replace(re, "").trim();
                }
            }

            var photo = {
                url: url,
                orig_url: url,
                title: title,
                flair: flair,
                id: idorig.id,
                over18: idorig.over_18,
                subreddit: idorig.subreddit,
                author: idorig.author,
                date: idorig.created_utc,
                duplicates: duplicates,
                commentsCount: idorig.num_comments,
                commentsLink: rp.redditBaseUrl + idorig.permalink
            };
            if (idx.id != photo.id)
                photo.cross_id = idx.id;

            if (idorig.preview)
                photo.thumbnail = fixupUrl(idorig.preview.images[0].source.url);

            else if (idorig.thumbnail != 'default')
                photo.thumbnail = fixupUrl(idorig.thumbnail);

            // Reddit hosted videos
            if (idx.domain == 'v.redd.it') {
                initPhotoVideo(photo);
                var media = (idx.media !== undefined) ?idx.media.reddit_video
                        :(idx.secure_media !== undefined) ?idx.secure_media.reddit_video
                        :undefined;

                if (media !== undefined) {
                    // @@ move this to createDiv() and parse DASH .mpd (XML) file,
                    // also add support for seperate audio file
                    if (media.fallback_url.indexOf('/DASH_') > 0) {
                        photo.video.mp4 = media.fallback_url;

                    } else {
                        log.error(photo.id+": cannot display video [bad fallback_url]: "+
                                  media.fallback_url);
                        return;
                    }
                } else {
                    log.error(photo.id+": cannot display video [no reddit_video]: "+photo.url);
                    return;
                }
            }            

            var jsonUrl = rp.url.get + idorig.permalink + '.json?depth=1';

            var loadTypes = {
                OP:     "OP",
                ALL:    "ALL"
            };

            var type;

            var hdrData = rp.session.redditHdr;
            var failedData = failedAjax;
            var handleData = function (data) {
                var item = data[0].data.children[0];
                var comments = data[1].data.children;
                var img;
                var type = $(this).Type;

                processPhoto(photo);

                for (var i = 0; i < comments.length; ++i) {
                    if (type == loadTypes.OP &&
                        idorig.author != comments[i].data.author)
                        continue;

                    if (comments[i].data.body_html === undefined) {
                        log.info("cannot display comment["+i+"] [no body]: "+photo.url);
                        continue;
                    }

                    var haystack = $('<div />').html(unescapeHTML(comments[i].data.body_html));
                    
                    var links = haystack.find('a');

                    if (!links || links.length == 0)
                            continue;

                    log.debug(type+"-Found:["+photo.commentsLink+"]:"+photo.url);

                    // Add parent image as first child, to ensure it's shown
                    photo = initPhotoAlbum(photo, true);
                    for(var j = 0; j < links.length; ++j) {
                        img = { author: comments[i].data.author,
                                url: links[j].href
                              };

                        if (links[j].innerText !== "" &&
                            links[j].innerText !== img.url)
                            img.title = links[j].innerText;

                        log.debug(type+"-Try:["+photo.commentsLink+"]:"+img.url);
                        if (processPhoto(img))
                            addAlbumItem(photo, img);
                        else
                            log.info("cannot load comment link [no photos]: "+img.url);
                    }
                };
                checkPhotoAlbum(photo);
                addImageSlide(photo);
            };
            
            var tryPreview = function(photo, idorig, msg) {
                if (msg === undefined)
                    msg = 'url [no image]';
                if (idorig.preview !== undefined &&
                    idorig.preview.images.length > 0) {
                    photo.url = unescapeHTML(idorig.preview.images[0].source.url);
                    if (processPhoto(photo)) {
                        addImageSlide(photo);
                        return;
                    }
                }
                log.info('cannot display '+msg + ': ' + photo.orig_url);
                return;                
            };

            var hostname = hostnameOf(photo.url, true);

            if (photo.flair.toLowerCase() == 'request' ||
                photo.title.match(/[\[\(\{]request[\]\)\}]/i) ||
                photo.title.match(/^psbattle:/i)) {

                type = loadTypes.ALL;

            } else if (photo.flair.match(/(more|source|video|album).*in.*com/i) ||
                       idorig.title.match(/(source|more|video|album).*in.*com/i) ||
                       idorig.title.match(/in.*comment/i) ||
                       idorig.title.match(/[\[\(\{\d\s][asvm]ic([\]\)\}]|$)/i)) {

                type = loadTypes.OP;

            } else if (processPhoto(photo)) {
                addImageSlide(photo);
                return;

            } else if (hostname == 'reddit.com') {
                // these shouldn't be added via tryPreview nor speculativeWP
                log.info('will not display url [no image]: ' + photo.orig_url);
                return;

            } else if (rp.settings.speculativeWP) {
                // This check to see if bare url is actually a wordpress site
                var path = pathnameOf(photo.url);
                var a = path.match(/^\/(?:\d+\/)*([a-z0-9]+(?:-[a-z0-9]+)*)\/$/);
                var hn = hostnameOf(photo.url);
                if (a === null || rp.wpv2[hn] === false) {
                    tryPreview(photo, idata);
                    return;
                }
                var slug = a[1];
                hdrData = '';
                jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+hn+'/posts/slug:'+slug;
                log.debug("WP Trying: "+photo.url);
                handleData = function (data) {
                    if (data.error !== undefined)
                        log.info("Cannot display wordpress ["+data.error+"]: "+photo.url);
                    else if (processWordPressPost(photo, data))
                        addImageSlide(photo);
                    else
                        tryPreview(photo, idorig, "wordpress [no photos]");
                };
                failedData = function () {
                    //log.info("cannot display wordpress [not wp site]: "+photo.url);
                    var origin = originOf(photo.url);
                    jsonUrl = origin+'/wp-json/wp/v2/posts/?slug='+slug+'&_jsonp=?';
                    log.debug("WPv2 Trying: "+photo.url);
                    handleData = function (data) {
                        rp.wpv2[hn] = true;
                        setConfig(configNames.wpv2, rp.wpv2);
                        if (processWPv2(photo, data[0]))
                            addImageSlide(photo);
                        else
                            tryPreview(photo, idorig, "WPv2 [no photos]");
                    };
                    failedData = function () {
                        rp.wpv2[hn] = false;
                        setConfig(configNames.wpv2, rp.wpv2);
                        tryPreview(photo, idorig, "url [not WPv2 site]");
                    };
                    $.ajax({
                        url: jsonUrl,
                        headers: hdrData,
                        dataType: 'jsonp',
                        success: handleData,
                        error: failedData,
                        timeout: rp.settings.ajaxTimeout,
                        crossDomain: true
                    });
                };
                // We already know we need to talk directly to site:
                if (rp.wpv2[hn] === true) {
                    failedData();
                    return;
                }
                    
            } else {
                tryPreview(photo, idata);
                return;
            }

            $.ajax({
                url: jsonUrl,
                headers: hdrData,
                dataType: 'json',
                success: handleData,
                error: failedData,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true,
                // Local Variables
                Type: type
            });

        };

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
            }

            var handleDuplicatesData = function(data) {
                var item = data[0].data.children[0];

                var duplicates = [];
                var i;
                for(i = 0; i < data[1].data.children.length; ++i) {
                    var dupe = data[1].data.children[i];
                    if (rp.dedup[dupe.data.subreddit] == undefined)
                        rp.dedup[dupe.data.subreddit] = {};
                    if (rp.dedup[dupe.data.subreddit][dupe.data.id] === "SELF") {
                        log.info('cannot display url [non-self dup]: '+item.data.url);
                        return;
                    }
                    rp.dedup[dupe.data.subreddit][dupe.data.id] = '/r/'+item.data.subreddit+'/'+item.data.id;
                    duplicates.push({subreddit: dupe.data.subreddit,
                                     commentCount: dupe.data.num_comments,
                                     title: dupe.data.title,
                                     date: dupe.data.created,
                                     id: dupe.data.id});
                }
                addImageSlideRedditT3(item.data, duplicates);

                // Place self in dedup list
                if (rp.dedup[item.data.subreddit] === undefined)
                    rp.dedup[item.data.subreddit] = {};
                rp.dedup[item.data.subreddit][item.data.id] = "SELF";
            };

            $.each(data.data.children, function (i, item) {
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

                if (rp.dedup[item.data.subreddit] !== undefined &&
                    rp.dedup[item.data.subreddit][item.data.id] !== undefined) {
                    log.info('cannot display url [duplicate:'+
                          rp.dedup[item.data.subreddit][item.data.id]+']: '+
                          item.data.url);
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

        log.debug('Ajax requesting: ' + jsonUrl);

        $.ajax({
            url: jsonUrl,
            headers: rp.session.redditHdr,
            dataType: dataType,
            jsonpCallback: 'redditcallback',
            success: handleData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
    };

    var getImgurAlbum = function () {
        var albumID = rp.url.subreddit.match(/.*\/(.+?$)/)[1];
        var jsonUrl = 'https://api.imgur.com/3/album/' + albumID;

        var handleData = function (data) {

            if (data.data.images.length === 0) {
                alert("No data from this url :(");
                return;
            }

            $.each(data.data.images, function (i, item) {
                addImageSlide({
                    url: (item.animated) ?item.gifv :item.link,
                    title: item.title,
                    id: albumID,
                    over18: item.nsfw,
                    commentsLink: data.data.link,
                    subreddit: data.data.section,
                    /* author: data.data.account_url, */
                    date: item.datetime,
                    extra: (data.data.account_url !== null) 
                        ?infoLink("http://imgur.com/user/"+data.data.account_url,
                                  data.data.account_url)
                        :""
                });
            });

            if (!rp.session.foundOneImage) {
                log.debug(jsonUrl);
                alert("Sorry, no displayable images found in that url :(");
            }

            //log.info("No more pages to load from this subreddit, reloading the start");

            // Show the user we're starting from the top
            //var numberButton = $("<span />").addClass("numberButton").text("-");
            //addNumberButton(numberButton);
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

    var processHaystack = function(photo, html) {
        var haystack = $('<div />').html(html);
        var images = haystack.find('img, video, iframe');

        var processNeedle = function(pic, item) {
            var src;
            if (item.tagName == 'IMG') {
                // Skip thumbnails
                if (item.className.includes('thumbnail'))
                    return false;
                if (item.getAttribute("itemprop") &&
                    item.getAttribute("itemprop").includes("thumbnail"))
                    return false;

                pic.type = imageTypes.image;
                src = item.getAttribute('src');
                if (src === null)
                    return false;
                src = unescapeHTML(src);
                if (src.startsWith('/'))
                    item.src = originOf(pic.url)+src;
                pic.url = item.src;
                if (item.alt)
                    pic.title = item.alt;
                
            } else if (item.tagName == 'VIDEO') {
                pic.type = imageTypes.video;
                pic.video = {};
                if (item.poster)
                    pic.video.thumbnail = item.poster;
                $.each(item.children, function(i, source) {
                    var src = source.getAttribute('src');
                    if (src === null)
                        return;
                    src = unescapeHTML(src);
                    if (src.startsWith('/'))
                        source.src = originOf(pic.url)+src;
                    if (source.type == 'video/webm')
                        pic.video.webm = source.src;
                    else if (source.type == 'video/mp4')
                        pic.video.mp4 = source.src;
                    else
                        log.info("Unknown type: "+source.type+" at: "+source.src);
                });

            } else if (item.tagName == 'IFRAME') {
                // let processPhoto() do initPhotoEmbed()
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
        if (images.length > 1) {
            photo = initPhotoAlbum(photo);
            $.each(images, function(i, item) {
                // init url for relative urls/srcs
                var pic = { url: photo.url, title: item.alt };
                if (processNeedle(pic, item) && processPhoto(pic)) {
                    addAlbumItem(photo, pic);
                    rc = true;
                }
            });

        } else if (images.length == 1) {
            if (processNeedle(photo, images[0]) && processPhoto(photo))
                rc = true;
        }
        return rc;
    };

    // This is for processing /wp-json/wp/v2/posts aka
    // https://developer.wordpress.org/rest-api/reference/
    var processWPv2 = function(photo, post) {
        if (post === undefined)
            return false;
        var hn = hostnameOf(photo.url);
        photo.favicon = rp.favicons.wordpress;
        photo.extra = infoLink(originOf(photo.url), hn, "/wp2/"+hn, "", rp.favicons['wordpress']);
        if (photo.orig_url === undefined)
            photo.orig_url = photo.url;
        var rc = processHaystack(photo, post.content.rendered);

        // Pull down 100, but only videos and images
        var jsonUrl = post._links["wp:attachment"][0].href + '&per_page=100';
        var handleData = function(data) {
            if (data.length == 100)
                log.notice("Found Full Page, should ask for more: "+photo.url);
            if (data.length == 0)
                return;
            initPhotoAlbum(photo);
            $.each(data, function(i, item) {
                var pic = { url: item.source_url,
                            title: item.caption.rendered || item.alt_text || item.title.rendered };
                if (item.media_type == "image")
                    pic.type = imageTypes.image;
                else // @@ WAG
                    initPhotoVideo(pic, item.source_url);
                addAlbumItem(photo, pic);
            });
            checkPhotoAlbum(photo);
            addImageSlide(photo);
        };

        //var jsonUrl = post._links[wp:featuredmedia][0].href
        $.ajax({
            url: jsonUrl+'&_jsonp=?',
            dataType: 'jsonp',
            success: handleData,
            error: failedAjax,
            timeout: rp.settings.ajaxTimeout,
            crossDomain: true
        });
        return rc;
    };

    // This is for public-api.wordpress.com which uses API v1.1
    // https://developer.wordpress.com/docs/api/
    // https://developer.wordpress.com/docs/api/1.1/get/sites/%24site/
    var processWordPressPost = function(photo, post) {
        var rc = false;

        // Setup some photo defaults
        photo.favicon = rp.favicons.wordpress;
        if (post.author.URL) {
            photo.extra = infoLink(post.author.URL, post.author.name,
                            '/wp/'+hostnameOf(post.author.URL));
        } else {
            var hn = hostnameOf(post.URL);
            photo.extra = infoLink(post.URL.substring(0, post.URL.indexOf(':'))+'://'+hn,
                                    post.author.name, '/wp/'+hn);
        }

        // Process Post
        if (processHaystack(photo, post.content))
            rc = true;

        var processAttachment = function(att, pic) {
            pic.id = att.ID;
            if (att.mime_type.startsWith('image/')) {
                pic.type = imageTypes.image;
                pic.url = att.URL;
                
            } else if (att.mime_type.startsWith('video/')) {
                initPhotoVideo(pic, att.URL, (att.thumbnails) ?att.thumbnails.large :undefined);

            } else {
                log.info("cannot display url [unknown mimetype "+att.mime_type+"]: "+att.url);
                return false;
            }
            return true;
        };

        var k, att;
        if (post.attachment_count + (rc) ?1 :0 > 1) {
            photo = initPhotoAlbum(photo, false);
            for(k in post.attachments) {
                att = post.attachments[k];
                var pic = { title: att.caption || att.title };
                if (processAttachment(att, pic)) {
                    addAlbumItem(photo, pic);
                    rc = true;
                }
            }
            checkPhotoAlbum(photo);

        } else {
            // there will be only 1
            for(k in post.attachments) {
                att = post.attachments[k];
                if (processAttachment(att, photo))
                    rc = true;
            }
        }

        if (!rc) {
            log.info("cannot display wp [no content]: "+photo.url);
            laterPhotoFailed(photo);
        }

        return rc;
    };


    var getWordPressBlogV2 = function () {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        var a = rp.url.subreddit.split('/');
        if (a[a.length-1] == "")
            a.pop();

        // newest to oldest
        var urlorder = 'asc';

        var hostname = a.pop();
        if (hostname == "new") {
            hostname = a.pop();
            // newest to oldest
            urlorder = 'desc';
        }

        if (rp.wpv2[hostname] === false) {
            rp.session.loadingNextImages = false;
            return;
        }
        
        $('#subredditLink').prop('href', 'https://'+hostname);
        $('#subredditUrl').val('wp2/'+hostname);

        var jsonUrl = 'https://'+hostname+'/wp-json/wp/v2/posts/?orderby=date&order='+urlorder;
        if (rp.url.vars)
            jsonUrl += '&'+rp.url.vars;

       if (rp.session.after !== "")
            jsonUrl = jsonUrl+'&offset='+rp.session.after;
        else
            rp.session.after = 0;

        var handleData = function (data) {
            rp.wpv2[hostname] = true;
            if (!Array.isArray(data)) {
                log.error("Something bad happened: "+data);
                failedAjaxDone();
                return;
            } else if (data.length == 0) {
                rp.session.loadAfter = null;
            }
            rp.session.loadAfter = getWordPressBlogV2;
            rp.session.after = rp.session.after + data.length;
            $.each(data, function(index, post) {
                var d = new Date(post.date_gmt+"Z");
                var photo = { title: post.title.rendered,
                              id: post.id,
                              url: post.link,
                              over18: false,
                              date: d.valueOf()/1000
                            };
                if (processWPv2(photo, post))
                    addImageSlide(photo);
                else
                    log.info("cannot display WPv2 [no photos]: "+photo.url);
            });
            rp.session.loadingNextImages = false;
        };
        var failedData = function () {
            rp.wpv2[hostname] = false;
            failedAjaxDone();
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
        if (a[a.length-1] == "")
            a.pop();

        // newest to oldest
        var urlorder = 'ASC';

        var hostname = a.pop();
        if (hostname == "new") {
            hostname = a.pop();
            // newest to oldest
            urlorder = 'DESC';
        }

        if (hostname.indexOf('.') < 0)
            hostname += '.wordpress.com';

        $('#subredditLink').prop('href', 'https://'+hostname);
        $('#subredditUrl').val('wp/'+hostname);

        // If we know this fails, bail
        if (rp.wpv2[hostname] === true) {
            rp.session.loadingNextImages = false;
            getWordPressBlogV2();
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

            $.each(data.posts, function(i, post) {
                var d = new Date(post.date);
                var photo = { title: post.title,
                              id: post.ID,
                              url: post.URL,
                              over18: false,
                              date: d.valueOf()/1000,
                              commentsLink: post.URL,
                              thumbnail: post.post_thumbnail
                            };

                if (processWordPressPost(photo, post))
                    addImageSlide(photo);
                else
                    log.info("cannot display WP [no photos]: "+photo.url);
            });
            rp.session.loadingNextImages = false;
        };

        // @@ Add failedDone to try getWordPressBlog if error is unknown_host

        $.ajax({
            url: jsonUrl,
            dataType: 'json',
            success: handleData,
            error: failedAjaxDone,
            timeout: rp.settings.ajaxTimeout
        });
    };

    var processTumblrPost = function(photo, post) {
        var rc = false;
        if (post.type == "photo") {
            var index = 0;
            if (post.photos.length > 1) {
                photo = initPhotoAlbum(photo, false);
                $.each(post.photos, function(i, item) {
                    addAlbumItem(photo, { url: fixupUrl(item.original_size.url),
                                          type: imageTypes.image,
                                          title: item.caption || photo.title
                                        });
                });
                rc = true;

            } else {
                photo.url = fixupUrl(post.photos[index].original_size.url);
                photo.type = imageTypes.image;
                rc = true;
            }
            processHaystack(photo, post.caption);

        } else if (post.type == 'video') {
            photo.thumbnail = post.thumbnail_url;
            rc = true;
            if (post.video_type == "youtube") {
                if (post.video === undefined) {
                    initPhotoFailed(photo);
                    return false;
                }
                initPhotoEmbed(photo, youtubeURL(post.video.youtube.video_id));
                
            } else if (post.video_url !== undefined) {
                initPhotoVideo(photo, post.video_url, post.thumbnail_url);
            
            } else if (post.video_type == "unknown") {
                var width;
                var embed;
                $.each(post.player, function (i, item) {
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
                    "]: "+photo.orig_url);
                return false;
            }
            
        } else if (post.type == 'html') {
            rc = processHaystack(photo, post.description);
        }

        if (!rc) {
            log.info("cannot display url [bad Tumblr post type "+post.type+"]: "+
                photo.url);
            laterPhotoFailed(photo);
        }

        return rc;
    };

    var getTumblrBlog = function () {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        var a = rp.url.subreddit.split('/');
        if (a[a.length-1] == "")
            a.pop();

        var hostname = a.pop();
        if (hostname.indexOf('.') < 0)
            hostname += '.tumblr.com';

        var jsonUrl = 'https://api.tumblr.com/v2/blog/'+hostname+'/posts?api_key='+rp.api_key.tumblr;
        if (rp.session.after !== "")
            jsonUrl = jsonUrl+'&offset='+rp.session.after;
        else
            rp.session.after = 0;

        var handleData = function (data) {
            $('#subredditLink').prop('href', data.response.blog.url);
            $('#subredditUrl').val('tumblr/'+data.response.blog.name);

            if (rp.session.after < data.response.total_posts) {
                rp.session.after = rp.session.after + data.response.posts.length;
                rp.session.loadAfter = getTumblrBlog;

            } else { // Found all posts
                rp.session.loadAfter = null;
            }

            $.each(data.response.posts, function (i, post) {
                var image = { title: post.summary || unescapeHTML(post.caption) || data.response.blog.title,
                              id: post.id,
                              over18: data.response.blog.is_nsfw || data.response.blog.is_adult,
                              date: post.timestamp,
                              url: post.post_url,
                              extra: infoLink(data.response.blog.url, data.response.blog.name,
                                               '/tumblr/'+data.response.blog.name),
                              commentsLink: post.post_url
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

    var getGfycatUser = function() {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        var a = rp.url.subreddit.split('/');
        if (a[a.length-1] == "")
            a.pop();

        var user = a.pop();

        var jsonUrl = 'https://api.gfycat.com/v1/users/'+user+'/gfycats';

        var handleData = function (data) {            
            if (data.gfycats.length)
                $.each(data.gfycats, function (i, post) {
                    var image = { url: 'https://gfycat.com/'+post.gfyName,
                                  over18: (post.nsfw != 0),
                                  title: post.title || post.description || post.tags.pop(),
                                  type: imageTypes.video,
                                  video: { thumbnail: post.posterUrl,
                                           webm: post.webmUrl,
                                           mp4: post.mp4Url
                                         },
                                  date: post.createDate
                                };
                    if (post.userName != 'anonymous')
                        image.extra = infoLink('https://gfycat.com/@'+post.userName,
                                               post.userName,
                                               '/gfycat/u/'+post.userName);
                    addImageSlide(image);
                });
            else
                failCleanup('No public gfycats for user @'+user);

            rp.session.loadingNextImages = false;
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
        var regexS = "(/(?:(?:imgur/a/)|(?:gfycat/u/)|(?:tumblr/)|(?:wp2?/)|(?:auth)|"+
            "(?:r/)|(?:u/)|(?:user/)|(?:domain/)|(?:search)|(?:me)|(?:top)|(?:new)|(?:rising)|(?:controversial)"+
            ")[^&#?]*)[?]?(.*)";

        if (path === undefined)
            path = $('#subredditUrl').val();
        if (initial === undefined)
            initial = false;

        var regex = new RegExp(regexS);
        var results = regex.exec(path);

        log.debug('url split results: '+results);
        if (results !== null) {
            rp.url.subreddit = results[1];
            rp.url.vars = decodeUrl(results[2]);

        } else {
            rp.url.vars = '';
            rp.url.subreddit = '/';
        }

        // Set prefix for self links, if in subdirectory
        if (initial && window.location.pathname != rp.url.subreddit)
            rp.url.base = window.location.pathname + '?';

        if (!path.startsWith(pathnameOf(rp.url.base)))
            path = rp.url.base+path;

        log.info("LOADING: "+path);
        rp.url.path = path;

        var getVarsQuestionMark = "";

        if (rp.url.vars.length > 0)
            getVarsQuestionMark = "?" + rp.url.vars;

        if (rp.url.vars !== '')
            rp.url.vars = '&' + rp.url.vars;

        // Remove .compact as it interferes with .json (we got "/r/all/.compact.json" which doesn't work).
        rp.url.subreddit = rp.url.subreddit.replace(/.compact/, "");
        // Consolidate double slashes to avoid r/all/.compact/ -> r/all//
        rp.url.subreddit = rp.url.subreddit.replace(/\/{2,}/, "/");
        // replace /u/ with /user/
        rp.url.subreddit = rp.url.subreddit.replace(/\/u\//, "/user/");

        // Auth Response - only ever uses window.location
        if (rp.url.subreddit == "/auth" ||
            rp.url.subreddit == "/" && rp.url.path.startsWith('/access_token')) {
            var matches = /[\/#?&]access_token=([^&#=]*)/.exec(window.location.href);
            var bearer = matches[1];
            setConfig(configNames.redditBearer, bearer);

            matches = /[#?&]expires_in=([^&#=]*)/.exec(window.location.href);
            // if failed to process, default to an hour
            var time = parseInt(decodeURIComponent(matches[1]), 10);
            var by = time+Math.ceil(Date.now()/1000);

            setConfig(configNames.redditRefreshBy, by);

            setupRedditLogin(bearer, by);

            matches = /[#?&]state=([^&#=]*)/.exec(window.location.href);
            processUrls(decodeURIComponent(matches[1]));
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

        // if ever found even 1 image, don't show the error
        rp.session.foundOneImage = false;
        $('#recommend').hide();

        // Always nuke old data
        clearSlideTimeout();
        var vid = $('#gfyvid')[0];
        if (vid !== undefined)
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

        if (data !== undefined) {
            log.debug("RESTORING STATE: "+path);
            rp.session.dedup = data.dedup;
            rp.session.after = data.after;
            rp.session.foundOneImage = true;
            if (data.loadAfter)
                rp.session.loadAfter = eval(data.loadAfter);
            rp.session.activeIndex = -1;
            rp.session.activeAlbumIndex = -1;

            clearSlideTimeout();
            var orig_index = data.index;
            $.each(data.photos, function(i, photo) {
                var index = photo.index;
                // This allows the photo to be re-added
                delete photo.index;
                if (!addImageSlide(photo) &&
                    index < orig_index)
                    --data.index;
            });

            if (rp.photos.length == 0)
                rp.session.foundOneImage = false;
            if (data.album < 0)
                data.album = -1;

            log.info("Restored "+path+" and "+rp.photos.length+" images of "+data.photos.length+" at index "+data.index+"."+data.album);

            startAnimation(data.index, data.album);

        } else if (rp.url.subreddit.startsWith('/imgur/'))
            getImgurAlbum();

        else if (rp.url.subreddit.startsWith('/tumblr/'))
            getTumblrBlog();

        else if (rp.url.subreddit.startsWith('/wp/'))
            getWordPressBlog();

        else if (rp.url.subreddit.startsWith('/wp2/'))
            getWordPressBlogV2();

        else if (rp.url.subreddit.startsWith('/gfycat/user/'))
            getGfycatUser();

        else
            getRedditImages();
    };

    if (rp.settings.alwaysSecure)
        rp.redditBaseUrl = "https://www.reddit.com";

    else
        rp.redditBaseUrl = "//www.reddit.com";
    rp.url.get = rp.redditBaseUrl;

    initState();

    var path = window.location.href.substr(window.location.origin.length);

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
