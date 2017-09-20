/* -*- mode: javascript; indent-tabs-mode: nil -*-
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
 */

var rp = {};

rp.settings = {
    debug: false,
    trace: false,
    // JSON/JSONP timeout in milliseconds
    ajaxTimeout: 10000,
    // Speed of the animation
    animationSpeed: 1000,
    shouldAutoNextSlide: true,
    timeToNextSlide: 8,
    cookieDays: 300,
    goodImageExtensions: ['.jpg', '.jpeg', '.gif', '.bmp', '.png'],
    goodVideoExtensions: ['.webm', '.mp4'],
    alwaysSecure: true,
    // show Embeded Items
    embed: false,
    // show NSFW Items
    nsfw: true
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

    loadingNextImages: false,
    loadAfter: null,
    // this will be enabled automatically
    needDedup: false,

    is_ios: false,
    is_pre10ios: false,
    redditHdr: {}
};

rp.api_key = {tumblr:  'sVRWGhAGTVlP042sOgkZ0oaznmUOzD8BRiRwAm5ELlzEaz4kwU',
              imgur:   'f2edd1ef8e66eaf'
             };

// CHANGE THESE FOR A DIFFERENT Reddit Application
rp.redirect = 'http://redditp.utopiabound.net/auth';
rp.api_key.reddit = '7yKYY2Z-tUioLA';

rp.favicons = {imgur: 'https://s.imgur.com/images/favicon-16x16.png',
               gfycat: 'https://gfycat.com/favicon-16x16.png',
               giphy:  'https://giphy.com/static/img/favicon.png',
               tumblr: 'https://assets.tumblr.com/images/favicons/favicon.ico',
               pornhub: 'https://ci.phncdn.com/www-static/favicon.ico',
	       wordpress: 'https://s1.wp.com/i/favicon.ico',
               deviantart: 'https://i.deviantart.net/icons/da_favicon.ico',
               // i.redd.it - reddit hosted images
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

    // try/catch statements in logging functions are to support older IE
    function debug(data) {
        if (rp.settings.debug)
            try {
                window.console.log(data);
            } catch (e) {
                // IE prior to 10 have iffy console.log implemenations
                log.history = log.history || []; // store logs to an array for reference
                log.history.push(arguments);
            }
    }

    function trace(data) {
        if (rp.settings.trace)
            try {
                window.console.log(data);
            } catch (e) {
                // IE prior to 10 have iffy console.log implemenations
                log.history = log.history || []; // store logs to an array for reference
                log.history.push(arguments);
            }
    }

    function log(data) {
        try {
            window.console.log(data);
        } catch (e) {
            // IE prior to 10 have iffy console.log implemenations
            log.history = log.history || []; // store logs to an array for reference
            log.history.push(arguments);
        }
    }
    function error(data) {
        var err = new Error();
        try {
            window.console.log(data, err.stack);
        } catch (e) {
            // IE prior to 10 have iffy console.log implemenations
            log.history = log.history || []; // store logs to an array for reference
            log.history.push(arguments);
        }
        alert(data);
    }

    // Take a URL and strip it down to the "shortid"
    var url2shortid = function(url) {
        var shortid;
        var path = $('<a>', {href: url}).prop('pathname');

        // chomp off last char if it ends in '/'
        if (path.charAt(path.length-1) == '/') {
            var spath = path.substr(0, path.length-1);
            shortid = spath.substr(1 + spath.lastIndexOf('/'));

        } else {
            shortid = path.substr(1 + path.lastIndexOf('/'));
        }

        if (shortid.indexOf('.') != -1)
            shortid = shortid.substr(0, shortid.lastIndexOf('.'));

        return shortid;
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
        var photo = pic;
        if (pic.parent !== undefined)
            photo = pic.parent;
        
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
        debug("["+currentIndex+"] Couldn't find previous index.");
        return currentIndex;
    };

    function nextAlbumSlide() {
        nextSlide(true);
    }

    function nextSlide(inalbum) {
        var index, albumIndex;

        if (inalbum === undefined || inalbum == false) {
            albumIndex = -1; // need to increment
            index = getNextSlideIndex(rp.session.activeIndex);
            if (index == rp.session.activeIndex) {
                if (rp.session.loadAfter !== null)
                    rp.session.loadAfter();
                return;
            }
            
        } else {
            albumIndex = rp.session.activeAlbumIndex;
            index = rp.session.activeIndex;
        }

        while(index < rp.photos.length) {
            var photo = rp.photos[index];
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
            albumIndex = 1; // need to decrement
            index = getPrevSlideIndex(rp.session.activeIndex);

        } else {
            albumIndex = rp.session.activeAlbumIndex;
            index = rp.session.activeIndex;
        }

        while (index >= 0) {
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
            albumIndex = LOAD_PREV_ALBUM;
        }
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

    // For self links only
    var albumLink = function(url) {
        return '<a id="album" class="info infol" href="'+rp.url.base+url+'">[ALBUM]</a>';
    };

    // info - foreign link
    // text - Text of foreign link
    // infop - always self-link (optional)
    // infoalt - alt text (optional)
    var infoLink = function(info, text, infop, infoalt) {
        if (infoalt === undefined)
            infoalt = "";
        var sld = hostnameOf(info, true).match(/[^\.]*/);
        if (rp.favicons[sld])
            text = '<img class="redditp favicon" src="'+rp.favicons[sld]+'" />'+text;
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

        // Pause this windows autonext
        if (autoNextSlide()) {
            $("#autoNextSlide").prop("checked", !$("#autoNextSlide").is(':checked'));
            updateAutoNext();
        }

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

    // Arguments are image paths relative to the current page.
    var preLoadImages = function () {
        var args_len = arguments.length;
        for (var i = args_len; i--;) {
            var cacheImage = document.createElement('img');
            cacheImage.src = arguments[i];
            // Chrome makes the web request without keeping a copy of the image.
            //rp.cache.push(cacheImage);
        }
    };

    var cookieNames = {
        nsfwCookie: "nsfwCookie",
        embedCookie: "showEmbedCookie",
        shouldAutoNextSlideCookie: "shouldAutoNextSlideCookie",
        timeToNextSlideCookie: "timeToNextSlideCookie",
        redditBearer: 'redditBearer',
        redditRefreshBy: 'redditRefreshBy'
    };

    var setCookie = function (c_name, value) {
        debug("Setting Cookie "+c_name+" = "+value);
        window.Cookies.set(c_name, value, { expires: rp.settings.cookieDays });
    };

    var getCookie = function (c_name) {
        // undefined in case nothing found
        var value = window.Cookies.get(c_name);
        debug("Getting Cookie "+c_name+" = "+value);
        return value;
    };

    var clearCookie = function(c_name) {
        window.Cookies.remove(c_name);
    };

    var clearSlideTimeout = function() {
        trace('clear timout');
        window.clearTimeout(rp.session.nextSlideTimeoutId);
    };

    var resetNextSlideTimer = function (timeout) {
        if (timeout === undefined) {
            timeout = rp.settings.timeToNextSlide;
        }
        timeout *= 1000;
        trace('set timeout (ms): ' + timeout);
        window.clearTimeout(rp.session.nextSlideTimeoutId);
        rp.session.nextSlideTimeoutId = window.setTimeout(autoNextSlide, timeout);
    };

    var updateAutoNext = function () {
        rp.settings.shouldAutoNextSlide = $("#autoNextSlide").is(':checked');
        if (rp.settings.shouldAutoNextSlide)
            $('#controlsDiv .collapser').css({color: 'red'});
        else
            $('#controlsDiv .collapser').css({color: ""});
        setCookie(cookieNames.shouldAutoNextSlideCookie, rp.settings.shouldAutoNextSlide);
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
        setCookie(cookieNames.nsfwCookie, rp.settings.nsfw);
    };

    var updateEmbed = function () {
        rp.settings.embed = !$("#embed").is(':checked');
        setCookie(cookieNames.embedCookie, rp.settings.embed);
        if (rp.settings.embed) {
            $('label[for="embed"]').html(googleIcon("cloud"));
        } else {
            $('label[for="embed"]').html(googleIcon("cloud_off"));
        }
    };

    var initState = function () {
        var nsfwByCookie = getCookie(cookieNames.nsfwCookie);
        if (nsfwByCookie === undefined) {
            rp.settings.nsfw = true;
        } else {
            rp.settings.nsfw = (nsfwByCookie === "true");
            $("#nsfw").prop("checked", rp.settings.nsfw);
        }
        $('#nsfw').change(updateNsfw);

        var embedByCookie = !getCookie(cookieNames.embedCookie);
        if (embedByCookie === undefined) {
            updateEmbed();
        } else {
            rp.settings.embed = (embedByCookie === "true");
            $("#embed").prop("checked", !rp.settings.embed);
        }
        $('#embed').change(updateEmbed);

        updateVideoMute();
        $('#mute').change(updateVideoMute);

        var autoByCookie = getCookie(cookieNames.shouldAutoNextSlideCookie);
        if (autoByCookie !== undefined) {
            rp.settings.shouldAutoNextSlide = (autoByCookie === "true");
            $("#autoNextSlide").prop("checked", rp.settings.shouldAutoNextSlide);
        }
        updateAutoNext();
        $('#autoNextSlide').change(updateAutoNext);

        var updateTimeToNextSlide = function () {
            var val = $('#timeToNextSlide').val();
            rp.settings.timeToNextSlide = parseFloat(val);
            setCookie(cookieNames.timeToNextSlideCookie, val);
        };

        var timeByCookie = getCookie(cookieNames.timeToNextSlideCookie);
        if (timeByCookie === undefined) {
            updateTimeToNextSlide();
        } else {
            rp.settings.timeToNextSlide = parseFloat(timeByCookie);
            $('#timeToNextSlide').val(timeByCookie);
        }

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
                debug("User Agent is pre-10 iOS");
                rp.session.is_pre10ios = true;
            } else {
                debug("User Agent is 10+ iOS");
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

    var initPhotoVideo = function (photo, url, thumbnail) {
        photo.type = imageTypes.video;
        photo.video = {};
        
        if (url === undefined)
            url = photo.url;

        if (isVideoExtension(url)) {
            var extention = url.substr(1 + url.lastIndexOf('.'));
            photo.video[extention] = url;
        }
        
        if (thumbnail !== undefined)
            photo.video.thumbnail = fixupUrl(thumbnail);

        else if (photo.thumbnail)
            photo.video.thumbnail = photo.thumbnail;
    };

    // re-index Album elements starting from index
    var reindexAlbum = function(photo, index) {
        if (index === undefined)
            index = 0;
        var photoindex = rp.photos.indexOf(photo);
        for (var i = index; i < photo.album.length; ++i) {
            var a = photo.album_ul.children(":nth-child("+(i+1)+")").children();
            var oldindex = a.data('index');

            a.attr('id', "albumButton" + (i+1)).data('index', i).text(i+1);

            // Update rp.cache when re-indexing if required
            if (rp.cache[photoindex] !== undefined &&
                rp.cache[photoindex][oldindex] !== undefined) {
                rp.cache[photoindex][i] = rp.cache[photoindex][oldindex];
                rp.cache[photoindex][oldindex] = undefined;
            }
        }
    };

    var checkPhotoAlbum = function(photo) {
        if (photo.album.length != 1)
            return;

        var pic = photo.album[0];
        if (pic.type == imageTypes.image ||
            pic.type == imageTypes.embed) {
            photo.type = pic.type;
            photo.url = pic.url;

        } else if (pic.type == imageTypes.video) {
            photo.type = pic.type;
            photo.video = pic.video;

        } else {
            error("Delete of bad type:"+pic.type+" for photo: "+photo.url);
            return;
        }
        log("moved primary to first album item: "+photo.url);
        
        delete photo.album;
        delete photo.album_ul; // @@ should this do a .detech()/.remove() first?        
    };

    var initPhotoAlbum = function (photo, keepfirst) {
        var pic = photo;
        if (keepfirst === undefined)
            keepfirst = true;

        if (photo.parent) {
            photo = photo.parent;
            // remove old AlbumItem
            var index = photo.album.indexOf(pic);
            if (index >= 0) {
                photo.album.splice(index, 1);
                photo.album_ul.children(":nth-child("+(index+1)+")").remove();
                reindexAlbum(photo, index);
            }
            // don't need to insertAt if image is last element
            if (index != photo.album.length)
                photo.insertAt = index;

        } else if (photo.album_ul === undefined) {
            var img;
            if (photo.type == imageTypes.image ||
                photo.type == imageTypes.embed ||
                photo.type == imageTypes.later) {
                img = { title: photo.title,
                        flair: photo.flair,
                        url: photo.url,
                        type: photo.type };
            } else if (photo.type == imageTypes.video) {
                img = { title: photo.title,
                        flair: photo.flair,
                        url: photo.url,
                        thumbnail: photo.thumbnail,
                        video: photo.video,
                        type: imageTypes.image };
            }

            photo.type = imageTypes.album;
            photo.insertAt = -1;
            photo.album = [];
            photo.album_ul = $("<ul />");

            if (keepfirst && processPhoto(img)) {
                log("moved primary to first album item: "+img.url);
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
            error("laterPhotoFailed called on valid album: "+photo.url);
            return;
        }
        
        delete photo.album;
        delete photo.album_ul; // @@ should this do a .detech()/.remove() first?
        if (processPhoto(photo) &&
            photo.type == imageTypes.later)
            photo.type = imageTypes.fail;
        // Update classes of number button
        if (photo.index !== undefined)
            $('#numberButton'+(photo.index+1)).removeClass('album embed').addClass('failed');
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
            if (albumIndex < 0)
                albumIndex = rp.session.activeAlbumIndex;

        } else if (albumIndex < 0) {
            return 0;
        }

        return albumIndex;
    };

    var populateAlbumButtons = function (photo) {
        // clear old
        $("#albumNumberButtons").detach();

        if (photo.type == imageTypes.album) {
            var div = $("<div>", { id: 'albumNumberButtons',
                                   class: 'numberButtonList'
                                 }).append(photo.album_ul);
            $("#navboxContents").append(div);
            if ($('#albumCollapser').attr(OPENSTATE_ATTR) == "closed")
                $(div).hide();
        }
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
                log("cannot display url [sub-album dup]: ["+i+"] exists, skip ["+index+"]: "+pic.url);
                return;
            }
        }

        var button = $("<a />", { class: "numberButton",
                                  title: pic.title,
                                  id: "albumButton" + (index + 1)
                                }).data("index", index).html(index + 1);
        pic.parent = photo;
        var sld = hostnameOf(pic.url, true).match(/[^\.]*/);
        if (rp.favicons[sld])
            pic.favicon = rp.favicons[sld];

        addButtonClass(button, pic);

        button.click(function () {
            startAnimation($('#allNumberButtons a.active').data("index"),
                           $(this).data("index"));
        });
        if (photo.insertAt < 0) {
            photo.album_ul.append($('<li>').append(button));
            photo.album.push(pic);

        } else {
            ++photo.insertAt;
            photo.album.splice(index, 0, pic);
            photo.album_ul.children(":nth-child("+(index+1)+")")
                .after($('<li>').append(button));
            reindexAlbum(photo, index);
        }
    };

    var processPhoto = function(pic) {
        if (pic === undefined)
            return false;

        if (pic.type === undefined)
            pic.type = imageTypes.image;

        pic.url = fixupUrl(pic.url);
        // hostname only: second-level-domain.tld
        var hostname = hostnameOf(pic.url, true);
        var sld = hostname.match(/[^\.]*/);

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
                log('cannot display url [no thumbnail]: ' + pic.url);
                return false;

            } else if (url2shortid(pic.url) === "") {
                log('cannot display url [no shortid]: ' + pic.url);
                return false;

            } else {
                pic.type = imageTypes.later;
            }

        } else if (hostname == 'gfycat.com' ||
                   hostname == 'streamable.com' ||
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
            // This can be quick processed now
            var url = pic.url.replace(/\/giphy.[^\/]*/, '');
            shortid = url2shortid(url);
            initPhotoVideo(pic, 'https://i.giphy.com/'+shortid+'.mp4');
                
        } else if (pic.url.indexOf('webm.land/w/') >= 0) {
            // This can be quick processed now
            shortid = url2shortid(pic.url);
            initPhotoVideo(pic, 'http://webm.land/media/'+shortid+".webm");

        } else if (isImageExtension(pic.url) ||
                   fqdn == 'i.reddituploads.com') {
            // simple image

        } else if (isVideoExtension(pic.url)) {
            initPhotoVideo(pic);

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
                    error("Failed to parse vidble url: "+pic.url);
                    return false;
                }
                shortid = shortid[1];
                initPhotoVideo(pic, 'https://www.vidble.com/'+shortid+'.mp4',
                               'https://www.vidble.com/'+shortid+'.png');

            } else if (pic.url.indexOf("/album/") > 0) {
                // TODO : figure out /album/ on vidble.com/api
                log("cannot display url [no album processing]: "+pic.url);
                return false;
  
            } else { 
                shortid = url2shortid(pic.url);
                pic.url = 'https://www.vidble.com/'+shortid+'.jpg';
            }

        } else if (hostname == 'tumblr.com' &&
                   pic.url.indexOf('/post/') > 0) {
            // Don't process bare tumblr blogs, nor /day/YYYY/MM/DD/ format
            // only BLOGNAME.tumblr.com/post/SHORTID/...
            pic.type = imageTypes.later;

        } else if (hostname == 'youtube.com' ||
                   hostname == 'youtu.be' ||
                   hostname == 'pornhub.com' ||
                   hostname == 'redtube.com' ||
                   hostname == 'xhamster.com' ||
                   hostname == 'youporn.com' ||
                   hostname == 'spankbang.com' ||
                   hostname == 'keezmovies.com' ||
                   hostname == 'vimeo.com') {
            pic.type = imageTypes.embed;

        } else {
            log('cannot display url [no image]: ' + pic.url);
            return false;
        }
        return true;
    };

    var addButtonClass = function(button, pic) {
        var photo = pic;
        if (pic.parent)
            photo = pic.parent;

        if (photo.over18)
            button.addClass("over18");

        if (pic.type == imageTypes.embed)
            button.addClass("embed");

        else if (pic.type == imageTypes.album)
            button.addClass("album");

    };

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
        if (photo.duplicates === undefined)
            photo.duplicates = [];

        if (photo.orig_url === undefined)
            photo.orig_url = photo.url;

        if (!processPhoto(photo))
            return;

        var isFirst = !rp.session.foundOneImage;
        rp.session.foundOneImage = true;

        // Do not preload all images, this is just not performant.
        // Especially in gif or high-res subreddits where each image can be 50 MB.
        // My high-end desktop browser was unresponsive at times.
        //preLoadImages(pic.url);
        var index = rp.photos.push(photo)-1;
        photo.index = index;

        var numberButton = $("<a />").html(index + 1)
                .data("index", index)
                .attr("title", $('<span />').html(rp.photos[index].title).text())
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
        if (rp.session.activeIndex == -1) {
            startAnimation(getNextSlideIndex(-1));
        }
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

        //log(e.keyCode, e.which, e.charCode);

        // 37 - left
        // 38 - up
        // 39 - right
        // 40 - down
        // More info: http://stackoverflow.com/questions/302122/jquery-event-keypress-which-key-was-pressed
        // http://stackoverflow.com/questions/1402698/binding-arrow-keys-in-js-jquery
        var code = (e.keyCode ? e.keyCode : e.which);
        var i = 0;

        switch (code) {
        case C_KEY:
            $('#controlsDiv .collapser').click();
            break;
        case T_KEY:
            $('#titleDiv .collapser').click();
            break;
        case SPACE:
            $("#autoNextSlide").prop("checked", !$("#autoNextSlide").is(':checked'));
            updateAutoNext();
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

        trace("startAnimation("+imageIndex+", "+albumIndex+")");

        // If the same number has been chosen, or the index is outside the
        // rp.photos range, or we're already animating, do nothing
        if (imageIndex < 0 || imageIndex >= rp.photos.length ||
            rp.session.isAnimating || rp.photos.length == 0) {

            if (imageIndex >= rp.photos.length &&
                rp.session.loadAfter !== null)
                rp.session.loadAfter();
            return;
        }

        if (rp.session.activeIndex == imageIndex) {
            if (rp.photos[imageIndex].type != imageTypes.album || albumIndex < 0)
                return;

            if (albumIndex >= rp.photos[imageIndex].album.length) {
                error("["+imageIndex+"] album index ("+albumIndex+") past end of album length:"+
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

    };

    var toggleNumberButton = function (imageIndex, turnOn) {
        if (imageIndex < 0)
            return;
        var numberButton = $('#numberButton' + (imageIndex + 1));
        if (turnOn) {
            numberButton.addClass('active');
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

        var authName;
        if (image.author !== undefined)
            authName = image.author;

        else if (photo.author != undefined)
            authName = photo.author;

        if (albumIndex < 0) {
            $('#navboxTitle').html(photo.title);
            if (photo.flair)
                $('#navboxTitle').prepend($('<span>', { class: 'linkflair' }).text(photo.flair));
            $('#navboxExtra').html((photo.extra !== undefined) ?photo.extra :"");
            $('#navboxLink').attr('href', photo.url).attr('title', photo.title+" (i)").html(googleIcon(photo.type));

        } else {
            $('#navboxTitle').html(image.title);
            if (image.flair)
                $('#navboxTitle').prepend($('<span>', { class: 'linkflair' }).text(image.flair));
            var extra = (image.extra) ?'&nbsp;'+image.extra :(photo.extra) ?'&nbsp;'+photo.extra :"";
            $('#navboxExtra').html($('<span>', { class: 'info' }).text((albumIndex+1)+"/"+rp.photos[imageIndex].album.length)).append(extra);
            $('#navboxLink').attr('href', image.url).attr('title', $("<div/>").html(image.title).text()+" (i)").html(googleIcon(image.type));
        }
        
        $('#navboxOrigLink').attr('href', photo.orig_url);
        if (image.favicon)
            $('#navboxOrigLink').html($("<img />", {'class': 'redditp favicon', src: image.favicon}));
        else
            $('#navboxOrigLink').html(googleIcon("link"));

        if (photo.subreddit !== undefined && photo.subreddit !== null) {
            $('#navboxSubreddit').attr('href', rp.redditBaseUrl + subreddit).html(subreddit);
            $('#navboxSubredditP').attr('href', rp.url.base+subreddit)
                .html($('<img />', {'class': 'redditp', src: 'images/favicon.png'}));
        }

        if (authName !== undefined) {
            var authLink = '/u/' + authName;
            $('#navboxAuthor').attr('href', rp.redditBaseUrl + authLink).html(authLink);
            $('#navboxAuthorP').attr('href', rp.url.base+'/user/'+authName+'/submitted')
                .html($('<img />', {'class': 'redditp', src: 'images/favicon.png'}));
        }
        $('#navboxCommentsLink').attr('href', photo.commentsLink);
        $('#navboxSubredditC').attr('href', photo.commentsLink);
        $('#navboxSubredditC').text('('+photo.commentsCount+")");
        if (photo.date)
            $('#navboxDate').attr("title", (new Date(photo.date*1000)).toString()).text(sec2dms((Date.now()/1000) - photo.date));
        else
            $('#navboxDate').attr("title", "").text("");

        if (rp.session.needDedup) {
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
                                                                       item.title+" ("+(i+1)+")"));
                    li.append($("<a>", { href: rp.redditBaseUrl + subr + "/comments/"+item.id,
                                         class: 'info infoc',
                                         title: 'Comments'
                                       }).text('('+item.commentCount+')'));
                    $('#duplicateUl').append(li);
                });
                $('#navboxDuplicatesMulti').attr('href', rp.redditBaseUrl+'/r/'+multi);
                $('#navboxDuplicatesMultiP').attr('href', rp.url.base+'/r/'+multi);
            } else {
                $('#duplicateDiv').hide();
            }
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
        log("ActiveIndex:["+rp.session.activeIndex+"]["+rp.session.activeAlbumIndex+"]");
        log("xhr:", xhr);
        log("ajaxOptions:", ajaxOptions);
        log("error:", thrownError);
        log("this:", $(this));
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

        trace("createDiv("+imageIndex+", "+albumIndex+")");

        // Used by showVideo and showImage
        var divNode = $("<div />").addClass("clouds");

        if (photo === undefined)
            return divNode;

        // Create a new div and apply the CSS
        var showImage = function(url, needreset) {
            if (needreset === undefined)
                needreset = true;
            // `preLoadImages` because making a div with a background css does not cause chrome
            // to preload it :/
            trace('showImage:['+imageIndex+"]["+albumIndex+"]:"+url);
            preLoadImages(url);
            var cssMap = Object();

            cssMap['background-image'] = "url(" + url + ")";
            cssMap['background-repeat'] = "no-repeat";
            cssMap['background-size'] = "contain";
            cssMap['background-position'] = "center";

            divNode.css(cssMap);
            if (needreset && imageIndex == rp.session.activeIndex)
                resetNextSlideTimer();
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

        // Called with showVideo({'thumbnail': jpgurl, 'mp4': mp4url, 'webm': webmurl})
        var showVideo = function(data) {
            var video = $('<video id="gfyvid" class="fullscreen" preload="auto" playsinline />');
            var lastsource;

            video.prop('playsinline', '');
            if (data.thumbnail !== undefined)
                video.attr('poster', fixupUrl(data.thumbnail));
            if (isVideoMuted())
                video.prop('muted', true);
            if (data.webm !== undefined)
                lastsource = video.append($('<source type="video/webm" />').attr('src', data.webm));
            if (data.mp4s !== undefined)
                $.each(data.mp4s, function (i, item) {
                    lastsource = video.append($('<source type="video/mp4" />').attr('src', item));
                });
            if (data.mp4 !== undefined)
                lastsource = video.append($('<source type="video/mp4" />').attr('src', data.mp4));

            divNode.append(video);

            $(lastsource).on("error", function(e) {
                log("["+imageIndex+"] video failed to load source");
                resetNextSlideTimer();
            });

            $(video).on("error", function(e) {
                log("["+imageIndex+"] video failed to load");
                resetNextSlideTimer();
            });

            $(video).on("ended", function(e) {
                debug("["+imageIndex+"] video ended");
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
                debug("["+imageIndex+"] Video loadeddata video: "+photo.duration+" playing "+photo.times);
            });
            
            // Set Autoplay for iOS devices
            if (rp.session.is_ios) {
                // iOS version < 10 do not autoplay, so timeout
                if (rp.session.is_pre10ios && imageIndex == rp.session.activeIndex) {
                    debug('iOS pre-10 detected, setting timmer');
                    resetNextSlideTimer();
                } else {
                    debug('iOS device detected setting autoplay');
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

        var showPic = function(pic) { 
            if (pic.type == imageTypes.album) {
                var index = indexPhotoAlbum(photo, imageIndex, albumIndex);
                if (index < 0) {
                    error("["+imageIndex+"]["+albumIndex+"] album is zero-length, failing to thumbnail: "+pic.url);
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

        if (photo.type == imageTypes.video) {
            if (photo.video === undefined) {
                error("["+imageIndex+"]["+albumIndex+"] type is video but no video element");

            } else {
                showVideo(photo.video);
                return divNode;
            }
        }

        // Show Video if it's that easy
        if (isVideoExtension(photo.url)) {
            initPhotoVideo(photo);
            showVideo(photo.video);
            return divNode;
        }

        // Called with showEmbed(urlForIframe)
        var showEmbed = function(url) {
            var iframe = $('<iframe id="gfyembed" class="fullscreen" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen />');
            // ensure updateAutoNext doesn't reset timer
            photo.times = 1;

            $(iframe).bind("load", function() {
                var iframe = $('#gfyembed');
                var c = $(iframe).contents();
                var video = $(c).find("video")[0];
                if (!video) {
                    log("["+imageIndex+"] X-Site Protection: Auto-next not triggered");
                    return;
                }
                $(video).attr("id", "gfyvid");
                updateVideoMute();

                log("["+imageIndex+"] embed video found: "+video.attr("src"));

                $(video).on("loadeddata", function(e) {
                    photo.duration = e.target.duration;
                    debug("["+imageIndex+"] embed video metadata.duration: "+e.target.duration );
                    // preload, don't mess with timeout
                    if (imageIndex !== rp.session.activeIndex)
                        return;
                    debug("["+imageIndex+"] embed video loadeddata running for active image");
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

        var jsonUrl, a, b;
        var dataType = 'json';
        var handleData;
        var headerData;
        var handleError = failedAjax;
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
                    showImage(photo.thumbnail);
                    return;
                }

                if (data.gfyItem.userName != 'anonymous')
                    photo.extra = infoLink('https://gfycat.com/@'+data.gfyItem.userName,
                                           data.gfyItem.userName,
                                           '/gfycat/u/'+data.gfyItem.userName);
                
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
                    var author = photo.author;

                    photo = initPhotoAlbum(photo, false);
                    $.each(data.data.images, function(i, item) {
                        var pic = { title: (item.title) ?item.title :(item.description) ?item.description :photo.title,
                                    url: fixImgurPicUrl(item.animated ?item.mp4 :item.link),
                                    author: author,
                                    extra: albumLink('/imgur/a/'+shortid),
                                    type: item.animated ?imageTypes.video :imageTypes.image
                                  };
                        if (item.animated)
                            pic.video = { mp4: pic.url };

                        addAlbumItem(photo, pic);
                    });
                    index = indexPhotoAlbum(photo, imageIndex, albumIndex);

                    showPic(photo.album[index]);

                } else { // single image album
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
                    if (! data.success ) {
                        log("["+imageIndex+"] imgur.com failed to load "+shortid+". state:"+data.status);
                        showImage(photo.url);
                        return;
                    }
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
                    log("["+imageIndex+"] vid.me failed to load "+shortid+". state:"+data.video.state);
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
                    photo.type = imageTypes.embed;
                    $('#numberButton'+(imageIndex+1)).addClass('embed');
                    // TODO: suprise load vs. intentional load
                    if (rp.settings.embed) {
                        var f = $.parseHTML(data.html);
                        showEmbed(f[0].src);

                    } else {
                        log("cannot display url [no embed]: "+photo.url);
                        showImage(data.thumbnail_url);
                    }

                } else {
                    log("cannot display url [unk type "+data.type+"]: "+photo.url);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();
                }
            };
            
        } else if (hostname == 'tumblr.com') {
            a = photo.url.split('/');
            shortid = a[4];

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
            var first = fqdn.split('.')[0];
            photo.extra = infoLink('https://'+fqdn, first, '/wp/'+fqdn);

            jsonUrl = 'https://public-api.wordpress.com/rest/v1.1/sites/'+fqdn+'/posts/slug:'+shortid;

            handleData = function(data) {
                processWordPressPost(photo, data);
                showPic(photo);
            };

        } else if (hostname == 'youtube.com') {
            a = photo.url.split('/').pop();
            b = a.match(/.*v=([^&]*)/);
            if (b)
                shortid = b[1];

            showEmbed(youtubeURL(shortid));

        } else if (hostname == 'youtu.be') {
            a = photo.url.split('/');
            if (a[a.length-1] == "")
                a.pop();

            showEmbed(youtubeURL(shortid));

        } else if (hostname == 'pornhub.com') {
            // JSON Info about video
            // 'https://www.pornhub.com/webmasters/video_by_id?id='+shortid
            a = {};
            b = $('<a>').attr('href', photo.url).prop('search').substring(1);
            $.map(b.split('&'), function(val, i) {
                var arr = val.split('=');
                a[arr[0]] = arr[1];
            });

            shortid = a.viewkey;
            
            if (a.pkey)
                photo.extra = infoLink('https://www.pornhub.com/playlist/'+a.pkey, 'Playlist');

            showEmbed('https://www.pornhub.com/embed/'+shortid+'?autoplay=1');

        } else if (hostname == 'redtube.com') {
            shortid = url2shortid(photo.url);

            showEmbed('https://embed.redtube.com/?bgcolor=000000&autoplay=1&id='+shortid);

        } else if (hostname == 'keezmovies.com') {
            shortid = url2shortid(photo.url);

            // no autostart
            showEmbed('https://www.keezemovies.com/embed/'+shortid);

        } else if (hostname == 'spankbang.com') {
            a = photo.url.split('/');
            shortid = a[3];

            // no autostart
            showEmbed('https://spankbang.com/embed/'+shortid);


        } else if (hostname == 'youporn.com') {
            // https://www.youporn.com/watch/SHORTID/TEXT-NAME-IN-URL/
            shortid = /\/watch\/(.*)/.exec(photo.url);
            
            showEmbed("https://www.youporn.com/embed/"+shortid[1]+'?autoplay=1');

        } else if (hostname == 'xhamster.com') {
            // https://xhamster.com/videos/NAME-OF-VIDEO-SHORTID
            // https://xhamster.com/movies/SHORID/NAME_OF_VIDEO.html
            if (photo.url.indexOf('/videos/') > 0) {
                shortid = url2shortid(photo.url);
                shortid = shortid.substr(shortid.lastIndexOf('-')+1);

            } else if (photo.url.indexOf('/movies/') > 0) {
                shortid = /\/movies\/([^\/]*)/.exec(photo.url)[1];
            } 

            if (shortid)
                showEmbed("https://xhamster.com/xembed.php?video="+shortid+'&autoplay=1');

            else
                log ("cannot parse url [unknown format]: "+photo.url);

        } else if (hostname == 'vimeo.com') {
            showEmbed('https://player.vimeo.com/video/'+shortid+'?autoplay=1');

        } else {
            log("["+imageIndex+"] Unknown video site: "+hostname);
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
            hostname == 'pornbot.net')
            url = url.replace('http://', 'https://');

        return url;
    };

    var isImageExtension = function (url) {
        var path = $('<a>', { href: url }).prop('pathname');
        var dotLocation = path.lastIndexOf('.');
        if (dotLocation < 0) {
            debug("skipped no dot: " + url);
            return false;
        }
        var extension = path.substring(dotLocation);

        if (rp.settings.goodImageExtensions.indexOf(extension) >= 0) {
            return true;
        } else {
            //log("skipped bad extension: " + url);
            return false;
        }
    };

    var isVideoExtension = function (url) { 
        var path = $('<a>', { href: url }).prop('pathname');
        var dotLocation = path.lastIndexOf('.');
        if (dotLocation < 0) {
            debug("skipped no dot: " + url);
            return false;
        }
        var extension = path.substring(dotLocation);

        if (rp.settings.goodVideoExtensions.indexOf(extension) >= 0) {
            return true;
        } else {
            //log("skipped bad extension: " + url);
            return false;
        }
    };

    var decodeUrl = function (url) {
        return decodeURIComponent(url.replace(/\+/g, " "));
    };

    var getRedditImages = function () {
        if (rp.session.loadingNextImages)
            return;
        rp.session.loadingNextImages = true;

        // Only enable login where it will work
        if ($('<a>').attr('href', rp.redirect).prop('origin') == window.location.origin) {
            var bearer = getCookie(cookieNames.redditBearer);
            var by = parseInt(getCookie(cookieNames.redditRefreshBy), 10);
            $('#loginUsername').attr('href', rp.redditBaseUrl + '/api/v1/authorize?' + 
                                     ['client_id=' + rp.api_key.reddit,
                                      'response_type=token',
                                      'state='+encodeURIComponent(window.location.href),
                                      'redirect_uri='+encodeURIComponent(rp.redirect),
                                      // read - /r/ALL, /me/m/ALL
                                      // history - /user/USER/submitted
                                      'scope=read,history'].join('&'));
            if (bearer !== undefined && by-30 > Date.now()/1000) {
                var d = new Date(by*1000);
                rp.session.redditHdr = { Authorization: 'bearer '+bearer };
                $('#loginUsername').html(googleIcon('verified_user'));
                $('#loginUsername').attr('title', 'Expires at '+d);
                rp.url.get = 'https://oauth.reddit.com';
                
            } else {
                rp.url.get = rp.redditBaseUrl;
                $('#loginUsername').html(googleIcon('account_box'));
                debug("Clearing bearer:"+bearer+" is obsolete EOL:"+by+" < now:"+Date.now()/1000);
                clearCookie(cookieNames.redditBearer);
                clearCookie(cookieNames.redditRefreshBy);
            }

            $('#loginUsername').parent().show();
        }

        var jsonUrl = rp.url.get + rp.url.subreddit + ".json?";
        var dataType = 'json';

        if (rp.url.subreddit.startsWith('/r/random') ||
            rp.url.subreddit.startsWith('/r/randnsfw')) {
            jsonUrl = rp.redditBaseUrl + rp.url.subreddit + ".json?jsonp=redditcallback";
            dataType = 'jsonp';
        }

        jsonUrl += rp.url.vars + rp.session.after;

        var addImageSlideRedditT3 = function (item, url) {
            if (rp.dedup[item.data.subreddit] !== undefined &&
                rp.dedup[item.data.subreddit][item.data.id] !== undefined) {
                log('cannot display url [simul-dup:'+
                      rp.dedup[item.data.subreddit][item.data.id]+']: '+
                      item.data.url);
                return;
            }

            if (url === undefined) {
                url = item.data.url;
            }
            if (item.duplicates === null) {
                item.duplicates = [];
            }

            // Link to x-posted subreddits
            var title = item.data.title.replace(/\/?(r\/\w+)\s*/g,
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
            if (item.data.link_flair_text) {
                flair = item.data.link_flair_text.trim();
                var re = new RegExp('[\\[\\{\\(]'+flair+'[\\]\\}\\)]', "ig");
                title = title.replace(re, "").trim();
            }

            var photo = {
                url: url,
                title: title,
                flair: flair,
                id: item.data.id,
                over18: item.data.over_18,
                subreddit: item.data.subreddit,
                author: item.data.author,
                date: item.data.created_utc,
                duplicates: item.duplicates,
                commentsCount: item.data.num_comments,
                commentsLink: rp.redditBaseUrl + item.data.permalink
            };

            if (item.data.preview)
                photo.thumbnail = fixupUrl(item.data.preview.images[0].source.url);

            else if (item.data.thumbnail != 'default')
                photo.thumbnail = fixupUrl(item.data.thumbnail);

            // Reddit hosted videos
            if (item.data.domain == 'v.redd.it') {
                initPhotoVideo(photo);
                if (item.data.media.reddit_video !== undefined) {
                    if (item.data.media.reddit_video.fallback_url.indexOf('/DASH_') > 0)
                        photo.video.mp4 = item.data.media.reddit_video.fallback_url;
                    else {
                        error(photo.id+": cannot display video [bad fallback_url]: "+item.data.media.reddit_video.fallback_url);
                        return;
                    }
                } else {
                    error(photo.id+": cannot display video [no reddit_video]: "+photo.url);
                }
            }            

            var p = photo.commentsLink.split("/").slice(3).join("/");
            var jsonUrl = rp.url.get + '/' + p + '.json?depth=1';

            var loadTypes = {
                OP:     "OP",
                ALL:    "ALL"
            };

            var type;

            if (photo.flair.toLowerCase() == 'request' ||
                photo.title.match(/[\[\(\{]request[\]\)\}]/i) ||
                photo.title.match(/^psbattle:/i)) {

                type = loadTypes.ALL;

            } else if (photo.title.match(/[\[\(\{\d\s]mic([\]\)\}]|$)/i) ||
                       photo.title.match(/[\s\[\(\{]vic([\s\]\)\}]|$)/i) ||
                       photo.title.match(/more.*in.*com/i) ||
                       photo.flair.match(/more.*in.*com/i) ||
                       item.data.title.match(/source.*in.*com/i) ||
                       item.data.title.match(/[\[\(\{\d\s]aic([\]\)\}]|$)/i) ||
                       item.data.title.match(/album.*in.*com/i) ) {

                type = loadTypes.OP;

            } else {
                addImageSlide(photo);
                return;
            }

            processPhoto(photo);

            var handleCommentData = function (data) {
                var item = data[0].data.children[0];
                var comments = data[1].data.children;
                var img;

                for (var i = 0; i < comments.length; ++i) {
                    if (type == loadTypes.OP &&
                        item.data.author != comments[i].data.author)
                        continue;

                    if (comments[i].data.body_html === undefined) {
                        log("cannot display comment["+i+"] [no body]: "+photo.url);
                        continue;
                    }

                    var haystack = $('<div />').html(unescapeHTML(comments[i].data.body_html));
                    
                    var links = haystack.find('a');

                    if (!links || links.length == 0)
                            continue;

                    debug(type+"-Found:["+photo.commentsLink+"]:"+photo.url);

                    // Add parent image as first child, to ensure it's shown
                    photo = initPhotoAlbum(photo, true);
                    for(var j = 0; j < links.length; ++j) {
                        img = { author: comments[i].data.author,
                                url: links[j].href
                              };

                        if (links[j].innerText !== "" &&
                            links[j].innerText !== img.url)
                            img.title = links[j].innerText;
                        else
                            img.title = photo.title;

                        debug(type+"-Try:["+photo.commentsLink+"]:"+img.url);
                        if (processPhoto(img))
                            addAlbumItem(photo, img);
                    }
                };
                addImageSlide(photo);
            };
            
            $.ajax({
                url: jsonUrl,
                headers: rp.session.redditHdr,
                dataType: 'json',
                success: handleCommentData,
                error: failedAjax,
                timeout: rp.settings.ajaxTimeout,
                crossDomain: true
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
                log("No more data");
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
                if (rp.session.needDedup) {
                    item.duplicates = [];
                    $.each(data[1].data.children, function(i, dupe) {
                        if (rp.dedup[dupe.data.subreddit] == undefined)
                            rp.dedup[dupe.data.subreddit] = {};
                        rp.dedup[dupe.data.subreddit][dupe.data.id] = '/r/'+item.data.subreddit+'/'+item.data.id;
                        item.duplicates.push({subreddit: dupe.data.subreddit,
                                              commentCount: dupe.data.num_comments,
                                              title: dupe.data.title,
                                              date: dupe.data.created,
                                              id: dupe.data.id});
                    });
                }
                addImageSlideRedditT3(item);

                // Place self in dedup list
                if (rp.session.needDedup) {
                    if (rp.dedup[item.data.subreddit] === undefined)
                        rp.dedup[item.data.subreddit] = {};
                    rp.dedup[item.data.subreddit][item.data.id] = "SELF";
                }
            };

            $.each(data.data.children, function (i, item) {
                var func = null;
                var url = null;

                // Text entry, no actual media
                if (item.kind != "t3") {
                    log('cannont display url [not link]: '+item.kind);
                    return;
                }

                if (item.data.is_self) {
                    log('cannot display url [self-post]: '+item.data.url);
                    return;
                }

                if (rp.dedup[item.data.subreddit] !== undefined &&
                    rp.dedup[item.data.subreddit][item.data.id] !== undefined) {
                    log('cannot display url [duplicate:'+
                          rp.dedup[item.data.subreddit][item.data.id]+']: '+
                          item.data.url);
                    return;
                }

                if (!rp.session.needDedup) {
                    addImageSlideRedditT3(item);
                    return;
                }

                func = handleDuplicatesData;
                url = rp.redditBaseUrl + '/r/' + item.data.subreddit + '/duplicates/' +
                    item.data.id + '.json';

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

        debug('Ajax requesting: ' + jsonUrl);

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
                    title: (item.title !== undefined) ?item.title :"",
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
                log(jsonUrl);
                alert("Sorry, no displayable images found in that url :(");
            }

            //log("No more pages to load from this subreddit, reloading the start");

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
        var images = haystack.find('img, video');

        var processNeedle = function(pic, item) {
            if (item.tagName == 'IMG') {
                pic.url = fixupUrl(item.src);
                pic.type = imageTypes.image;
                
            } else if (item.tagName == 'VIDEO') {
                pic.type = imageTypes.video;
                pic.video = {};
                if (item.poster)
                    pic.video.thumbnail = item.poster;
                $.each(item.children, function(i, source) {
                    if (source.type == 'video/webm')
                        pic.video.webm = source.src;
                    else if (source.type == 'video/mp4')
                        pic.video.mp4 = source.src;
                    else
                        log("Unknown type: "+source.type+" at: "+source.src);
                });
            }
        };

        var rc = false;
        if (images.length > 1) {
            photo = initPhotoAlbum(photo, false);
            $.each(images, function(i, item) {
                var pic = { title: (item.alt) ?item.alt :photo.title };
                if (processNeedle(pic, item) &&
                    processPhoto(pic)) {
                    addAlbumItem(photo, pic);
                    rc = true;
                }
            });

        } else if (images.length == 1) {
            if (processNeedle(photo, images[0]) &&
                processPhoto(photo))
                rc = true;
        }
        return rc;
    };

    var processWordPressPost = function(photo, post) {
        var rc = false;
        if (processHaystack(photo, post.content))
            rc = true;

        var processAttachment = function(att, pic) {
            pic.id = att.ID;
            if (att.mime_type.startsWith('image/')) {
                pic.type = imageTypes.image;
                pic.url = att.URL;
                
            } else if (att.mime_type.startsWith('video/')) {
                initPhotoVideo(pic, att.URL, att.thumbnails.large);

            } else {
                log("cannot display url [unknown mimetype "+att.mime_type+"]: "+att.url);
                return false;
            }
            return true;
        };

        var k, att;
        if (post.attachment_count + (rc) ?1 :0 > 1) {
            photo = initPhotoAlbum(photo, false);
            for(k in post.attachments) {
                att = post.attachments[k];
                var pic = { title: (att.caption !== "") ?att.caption :att.title };
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

        if (!rc)
            laterPhotoFailed(photo);

        return rc;
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
                              date: d.valueOf(),
                              commentsLink: post.URL,
                              extra: infoLink(post.author.URL, post.author.name,
                                              '/wp/'+hostnameOf(post.author.URL)),
                              thumbnail: post.post_thumbnail
                            };

                if (processWordPressPost(photo, post))
                    addImageSlide(photo);

            });
            rp.session.loadingNextImages = false;
        };

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
                                          title: (item.caption) ?item.caption :photo.title
                                        });
                });
                rc = true;

            } else {
                photo.url = fixupUrl(post.photos[index].original_size.url);
                photo.type = imageTypes.image;
                rc = true;
            }

        } else if (post.type == 'video') {
            photo.thumbnail = post.thumbnail_url;
            if (post.video_type == "youtube") {
                if (post.video === undefined) {
                    photo.type = imageTypes.fail;
                    return false;
                }
                photo.type = imageTypes.embed;
                if (photo.index !== undefined)
                    $('#numberButton'+(photo.index+1)).addClass('embed');
                photo.url = youtubeURL(post.video.youtube.video_id);

            } else {
                initPhotoVideo(photo, post.video_url, post.thumbnail_url);
            }
            rc = true;

        } else if (post.type == 'html') {
            rc = processHaystack(photo, post.description);

        }

        if (!rc) {
            log("cannot display url [bad Tumblr post type "+post.type+"]: "+photo.url);
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
                var image = { title: post.summary,
                              id: post.id,
                              over18: data.response.blog.is_nsfw,
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

        debug('getTumblrBlog requesting: '+jsonUrl);

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

    var processUrls = function(path, setbase) {
        // Separate to before the question mark and after
        // Detect predefined reddit url paths. If you modify this be sure to fix
        // .htaccess
        // This is a good idea so we can give a quick 404 page when appropriate.
        var regexS = "(/(?:(?:imgur/a/)|(?:gfycat/u/)|(?:tumblr/)|(?:wp/)|(?:auth)|"+
            "(?:r/)|(?:u/)|(?:user/)|(?:domain/)|(?:search)|(?:me)|(?:top)|(?:new)|(?:rising)|(?:controversial)"+
            ")[^&#?]*)[?]?(.*)";

        if (path === undefined)
            path = $('#subredditUrl').val();
        if (setbase === undefined)
            setbase = false;

        var regex = new RegExp(regexS);
        var results = regex.exec(path);

        debug('url split results: '+results);
        if (results !== null) {
            rp.url.subreddit = results[1];
            rp.url.vars = decodeUrl(results[2]);

        } else {
            rp.url.vars = '';
            rp.url.subreddit = '/';
        }

        // Set prefix for self links, if in subdirectory
        if (setbase &&
            window.location.pathname != rp.url.subreddit)
            rp.url.base = window.location.pathname + '?';

        debug("path: "+path+" base: "+rp.url.base);

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
        if (rp.url.subreddit == "/auth") {
            var matches = /[#?&]access_token=([^&#=]*)/.exec(window.location.href);
            setCookie(cookieNames.redditBearer, matches[1]);

            matches = /[#?&]expires_in=([^&#=]*)/.exec(window.location.href);
            // if failed to process, default to an hour
            var time = parseInt(decodeURIComponent(matches[1]), 10);

            setCookie(cookieNames.redditRefreshBy, (time+Math.ceil(Date.now()/1000)));

            matches = /[#?&]state=([^&#=]*)/.exec(window.location.href);
            window.location.href = decodeURIComponent(matches[1]);
            return;
        }

        var subredditName = rp.url.subreddit + getVarsQuestionMark;

        var dupe = $('#duplicateCollapser');
        if (rp.url.subreddit.indexOf('/user/') >= 0 ||
            rp.url.subreddit.indexOf('/domain/') >= 0 ||
            rp.url.subreddit.indexOf('/search/') >= 0 ||
            rp.url.subreddit.indexOf('/me/') >= 0 ||
            rp.url.subreddit.indexOf('/r/all') >= 0 ||
            rp.url.subreddit.indexOf('/r/popular') >= 0 ||
            rp.url.subreddit.indexOf('/r/friends') >= 0 ||
            rp.url.subreddit == "/" ||
            rp.url.subreddit.indexOf('+') >= 0) {
            rp.session.needDedup = true;
            if ($(dupe).attr(OPENSTATE_ATTR) == "closed")
                $(dupe).click();
            // Cleanup trailing '+' from subreddit
            rp.url.subreddit = rp.url.subreddit.replace(/\+($|\/)/, "$1");
            $(dupe).show();

        } else {
            rp.session.needDedup = false;
            // close and don't show if we're not loading the info
            if ($(dupe).attr(OPENSTATE_ATTR) == "open")
                $(dupe).click();
            $(dupe).hide();
        }

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

        if (rp.url.subreddit.startsWith('/imgur/'))
            getImgurAlbum();

        else if (rp.url.subreddit.startsWith('/tumblr/'))
            getTumblrBlog();

        else if (rp.url.subreddit.startsWith('/wp/'))
            getWordPressBlog();

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
