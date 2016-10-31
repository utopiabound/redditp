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
    debug: true,
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
    needDedup: true
};

rp.api_key = {tumblr:  'sVRWGhAGTVlP042sOgkZ0oaznmUOzD8BRiRwAm5ELlzEaz4kwU',
              imgur:   'f2edd1ef8e66eaf'
             };

// Variable to store the images we need to set as background
// which also includes some text and url's.
rp.photos = [];

// maybe checkout http://engineeredweb.com/blog/09/12/preloading-images-jquery-and-javascript/ for implementing the old precache
rp.cache = {};
rp.dedup = {};
rp.url = {
    subreddit: "",
    vars: ""
};

$(function () {
    $("#subredditUrl").text("Loading Reddit Slideshow");
    $("#navboxTitle").text("Loading Reddit Slideshow");

    function debug(data) {
        if (rp.settings.debug)
            window.log(data);
    }

    function log(data) {
        window.log(data);
    }
    function error(data) {
        window.log(data);
        window.alert(data);
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

    var getNextSlideIndex = function(currentIndex) {
        for(var i = currentIndex + 1; i < rp.photos.length; i++) {
            if (!rp.settings.nsfw && rp.photos[i].over18)
                continue;
            if (!rp.settings.embed && rp.photos[i].type == imageTypes.embed)
                continue;
            return i;
        }
        // If no more "wanted" images, load more and stay here
        if (rp.session.loadAfter !== null && !rp.session.loadingNextImages) {
            debug("["+currentIndex+"] Couldn't find next index. loading more");
            rp.session.loadAfter();
        }
        return currentIndex;
    };

    var getPrevSlideIndex = function(currentIndex) {
        for (var i = currentIndex - 1; i >= 0; i--) {
            if (!rp.settings.nsfw && rp.photos[i].over18)
                continue;
            if (!rp.settings.embed && rp.photos[i].type == imageTypes.embed)
                continue;
            return i;
        }
        debug("["+currentIndex+"] Couldn't find previous index.");
        return currentIndex;
    };

    function nextSlide() {
        var next = getNextSlideIndex(rp.session.activeIndex);
        startAnimation(next);
    }

    function nextAlbumSlide() {
        var photo = rp.photos[rp.session.activeIndex];
        if (photo.type != imageTypes.album ||
            rp.session.activeAlbumIndex+1 >= photo.album.length) {
            nextSlide();
            return;
        }

        startAnimation(rp.session.activeIndex, rp.session.activeAlbumIndex + 1);
    }

    function prevSlide() {
        var index = getPrevSlideIndex(rp.session.activeIndex);
        startAnimation(index);
    }

    function prevAlbumSlide() {
        if (rp.session.activeAlbumIndex > 0) {
            startAnimation(rp.session.activeIndex, rp.session.activeAlbumIndex-1);
            return;
        }

        var index = getPrevSlideIndex(rp.session.activeIndex);
        if (index < 0)
            return;

        var photo = rp.photos[index];
        if (photo.type != imageTypes.album) {
            startAnimation(index);
            return;
        }

        startAnimation(index, photo.album.length-1);
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
        photo = rp.photos[index];
        if (photo.times == 1) {
            if (photo.duration < rp.settings.timeToNextSlide)
                photo.times = Math.ceil(rp.settings.timeToNextSlide/photo.duration);
            return false;
        }
        photo.times -= 1;
        return true;
    };

    var albumLink = function(url) {
        return '<a id="album" class="info" href="'+url+'">[ALBUM]</a>';
    };

    var youtubeURL = function(id) {
        var ytExtra = '?autoplay=1&origin='+encodeURI(window.location.protocol + "//" + window.location.host + "/");
        //var ytExtra = '?enablejsapi=1';
        return 'https://www.youtube.com/embed/'+id+ytExtra;
    };

    var infoLink = function(info, text, infop = null) {
        var data = '<a href="'+info+'" class="info">'+text+'</a>';
        if (infop)
            data += '<a href="'+infop+'" class="infop"><img class="redditp" src="/images/favicon.png" /></a>';
        return data;
    };

    function open_in_background(selector){
        // as per https://developer.mozilla.org/en-US/docs/Web/API/event.initMouseEvent
        // works on latest chrome, safari and opera
        var link = $(selector)[0];

        if (link === undefined)
            return;

        // Pause this windows autonext
        if (autoNextSlide()) {
            $("#autoNextSlide").prop("checked", !$("#autoNextSlide").is(':checked'));
            updateAutoNext();
        }

        // Simulating a ctrl key won't trigger a background tab on IE and Firefox ( https://bugzilla.mozilla.org/show_bug.cgi?id=812202 )
        // so we need to open a new window
        if ( navigator.userAgent.match(/msie/i) || navigator.userAgent.match(/trident/i)  || navigator.userAgent.match(/firefox/i) ){
            window.open(link.href,'_blank');
        } else {
            var mev = document.createEvent("MouseEvents");
            mev.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, true, false, false, true, 0, null);
            link.dispatchEvent(mev);
        }
    }

    var hostnameOf = function(url) {
        return $('<a>').attr('href', url).prop('hostname');
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
            $(this).text("+");
            // move to the left just enough so the collapser arrow is visible
            var arrowLeftPoint = $(this).position().left;
            $(this).parent().animate({
                left: "-" + arrowLeftPoint + "px"
            });
            $(this).attr(OPENSTATE_ATTR, "closed");
        } else {
            // open it
            $(this).text("-");
            $(this).parent().animate({
                left: "0px"
            });
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
        timeToNextSlideCookie: "timeToNextSlideCookie"
    };

    var setCookie = function (c_name, value) {
        window.Cookies.set(c_name, value, { expires: rp.settings.cookieDays });
    };

    var getCookie = function (c_name) {
        // undefined in case nothing found
        return window.Cookies.get(c_name);
    };

    var clearSlideTimeout = function() {
        debug('clear timout');
        window.clearTimeout(rp.session.nextSlideTimeoutId);
    };

    var resetNextSlideTimer = function (timeout) {
        if (timeout === undefined) {
            timeout = rp.settings.timeToNextSlide;
        }
        timeout *= 1000;
        debug('set timeout (ms): ' + timeout);
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
            //rp.photos[rp.session.activeIndex].type !== imageTypes.video)
            rp.photos[rp.session.activeIndex].times === undefined)
            resetNextSlideTimer();
    };

    var toggleFullScreen = function() {
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
    };

    var isVideoMuted = function() {
        return $("#mute").is(':checked');
    };

    var updateVideoMute = function() {
        var vid = $('#gfyvid');
        var videoMuted = isVideoMuted();
        if (vid !== undefined)
            if (videoMuted)
                vid.prop('muted', true);
        else
            vid.prop('muted', false);
    };

    var updateNsfw = function () {
        rp.settings.nsfw = $("#nsfw").is(':checked');
        setCookie(cookieNames.nsfwCookie, rp.settings.nsfw);
    };

    var updateEmbed = function () {
        rp.settings.embed = $("#embed").is(':checked');
        setCookie(cookieNames.embedCookie, rp.settings.embed);
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

        var embedByCookie = getCookie(cookieNames.embedCookie);
        if (embedByCookie === undefined) {
            updateEmbed();
        } else {
            rp.settings.embed = (embedByCookie === "true");
            $("#embed").prop("checked", rp.settings.embed);
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

        $('#fullScreenButton').click(toggleFullScreen);

        $('#timeToNextSlide').keyup(updateTimeToNextSlide);

        $('#prevButton').click(prevAlbumSlide);
        $('#nextButton').click(nextAlbumSlide);
    };

    var addNumberButton = function (numberButton) {
        var buttonUl = $("#allNumberButtons");
        var newListItem = $("<li />").appendTo(buttonUl);
        numberButton.appendTo(newListItem);
    };

    var initPhotoAlbum = function (photo, imageIndex = -1) {
        if (imageIndex >= 0) {
            $('#numberButton'+(imageIndex+1)).addClass('album');

            // Set correct AlbumIndex if needed
            if (imageIndex == rp.session.activeIndex)
                rp.session.activeAlbumIndex = 0;
        }
        photo.type = imageTypes.album;
        photo.album = [];
        photo.album_ul = $("<ul />");
    };

    var populateAlbumButtons = function (photo) {
        // clear old
        $("#albumNumberButtons").detach();

        if (photo.type == imageTypes.album)
            $("#navboxContents").append($("<div>", { id: 'albumNumberButtons',
                                                     class: 'numberButtonList'
                                                   }).append(photo.album_ul));
        
    };

    var addAlbumItem = function (photo, pic, index) {
        var button = $("<a />", { class: "numberButton",
                                  title: pic.title,
                                  id: "albumButton" + (index + 1)
                                }).data("index", index).html(index + 1);
        if (photo.over18)
            button.addClass("over18");
        button.click(function () {
            var index = $(this).data("index");
            var imageIndex = $('#allNumberButtons a.active').data("index");
            startAnimation(imageIndex, index);
        });
        photo.album_ul.append($('<li>').append(button));
        photo.album.push(pic);
    };

    var imageTypes = {
        image: 'image',
        video: 'video',
        embed: 'embed',
        album: 'album'
    };

    var addImageSlide = function (pic) {
        /* var pic = {
         *     "title": title, (text)
         *     "url": url, (URL)
         *     "commentsLink": commentsLink, (URL)
         *     "over18": over18, (BOOLEAN)
         *     "type": image_or_video, (from imageTypes)
         *     subreddit: optional, (text - /r/$subreddit)
         *     author: optional, (text - /u/$author)
         *     extra: optional, (HTML)
         *     thumbnail: optional, (URL)
         * }
         */

        if (pic.type === undefined)
            pic.type = imageTypes.image;
        // Fix URL "quoting" by reddit
        pic.url = secureUrl(pic.url.replace(/&amp;/gi, '&'));
        var hostname = hostnameOf(pic.url);

        // Replace HTTP with HTTPS on gfycat and imgur to avoid this:
        // Mixed Content: The page at 'https://redditp.com/r/gifs' was
        // loaded over HTTPS, but requested an insecure video
        // 'http://i.imgur.com/LzsnbNU.webm'. This content should also
        // be served over HTTPS.
        var http_prefix = 'http://';
        var https_prefix = 'https://';
        if (rp.settings.alwaysSecure &&
            hostname.indexOf('gfycat.com') >= 0 ||
            hostname.indexOf('pornbot.net') >= 0 ||
            hostname.indexOf('imgur.com') >= 0) {
            pic.url = pic.url.replace(http_prefix, https_prefix);
        }

        if (isImageExtension(pic.url)) {
            if (hostname.indexOf('imgur.com') >= 0) {
                pic.url = fixImgurPicUrl(pic.url);
                if (isVideoExtension(pic.url))
                    pic.type = imageTypes.video;
            }
            // simple image (or converted to video)

        } else if (hostname.indexOf('i.reddituploads.com') >= 0) {
            // simple image

        } else if (isVideoExtension(pic.url) ||
                   hostname.indexOf('gfycat.com') >= 0 ||
                   hostname.indexOf('streamable.com') >= 0 ||
                   hostname.indexOf('vid.me') >= 0 ||
                   hostname.indexOf('tumblr.com') >= 0 ||
                   hostname.indexOf('pornbot.net') >= 0 ||
                   hostname.indexOf('deviantart.com') >= 0 ||
                   hostname.indexOf('eroshare.com') >= 0 ||
                   pic.url.indexOf('webm.land/w/') >= 0) {
            pic.type = imageTypes.video;

        } else if (hostname.indexOf('youtube.com') >= 0 ||
                   hostname.indexOf('youtu.be') >= 0 ||
                   hostname.indexOf('vimeo.com') >= 0) {
            pic.type = imageTypes.embed;

        } else {
            var betterUrl = tryConvertPic(pic);
            if(betterUrl !== '') {
                pic.url = betterUrl;

                if (isVideoExtension(pic.url))
                    pic.type = imageTypes.video;

            } else {
                debug('cannot display url [no image]: ' + pic.url);
                return;
            }
        }

        var isFirst = !rp.session.foundOneImage;
        rp.session.foundOneImage = true;

        // Do not preload all images, this is just not performant.
        // Especially in gif or high-res subreddits where each image can be 50 MB.
        // My high-end desktop browser was unresponsive at times.
        //preLoadImages(pic.url);
        rp.photos.push(pic);

        var i = rp.photos.length - 1;
        var numberButton = $("<a />").html(i + 1)
                .data("index", i)
                .attr("title", rp.photos[i].title)
                .attr("id", "numberButton" + (i + 1));

        if (pic.over18)
            numberButton.addClass("over18");

        if (pic.type == imageTypes.embed)
            numberButton.addClass("embed");

        if (pic.type == imageTypes.album)
            numberButton.addClass("album");

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
        rp.session.loadingNextImages = false;
    };

    var arrow = {
        left: 37,
        up: 38,
        right: 39,
        down: 40
    };
    var ONE_KEY = 49;
    var NINE_KEY = 57;
    var SPACE = 32;
    var PAGEUP = 33;
    var PAGEDOWN = 34;
    var ENTER = 13;
    var A_KEY = 65;
    var C_KEY = 67;
    var F_KEY = 70;
    var I_KEY = 73;
    var M_KEY = 77;
    var R_KEY = 82;
    var T_KEY = 84;


    // Register keyboard events on the whole document
    $(document).keyup(function (e) {
        if (e.ctrlKey) {
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

        switch (code) {
        case C_KEY:
            $('#controlsDiv .collapser').click();
            break;
        case T_KEY:
            $('#titleDiv .collapser').click();
            break;
        case A_KEY:
            open_in_background("#album");
            break;
        case SPACE:
            $("#autoNextSlide").prop("checked", !$("#autoNextSlide").is(':checked'));
            updateAutoNext();
            break;
        case I_KEY:
            open_in_background("#navboxLink");
            break;
        case R_KEY:
            open_in_background("#navboxCommentsLink");
            break;
        case M_KEY:
            $('#mute').click();
            break;
        case F_KEY:
            toggleFullScreen();
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
        }
    });

    var isLastImage = function(imageIndex) {
        if(rp.settings.nsfw) {
            if(imageIndex == rp.photos.length - 1) {
                return true;
            } else {
                return false;
            }
        } else {
            // look for remaining sfw images
            for(var i = imageIndex + 1; i < rp.photos.length; i++) {
                if(!rp.photos[i].over18) {
                    return false;
                }
            }
            return true;
        }
    };

    var preloadNextImage = function(imageIndex, albumIndex = -1) {
        if (albumIndex == -1 || albumIndex+1 >= rp.photos[imageIndex].album.length) {
            var next = getNextSlideIndex(imageIndex);
            // Always clear cache - no need for memory bloat.
            // We only keep the next image preloaded.
            rp.cache = {};
            if(next < rp.photos.length)
                rp.cache[next] = createDiv(next);

        } else {
            // Store album index as -1, -2, -3
            var next = albumIndex+1;
            rp.cache[-next-1] = createDiv(imageIndex, next);
        }
    };

    //
    // Starts the animation, based on the image index
    //
    // Variable to store if the animation is playing or not
    var startAnimation = function (imageIndex, albumIndex = -1) {
        var needRefresh = false;
        resetNextSlideTimer();

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
            albumIndex = 0;
        }

        var oldIndex = rp.session.activeIndex;
        var oldAlbumIndex = rp.session.activeAlbumIndex;
        rp.session.activeIndex = imageIndex;
        rp.session.activeAlbumIndex = albumIndex;
        rp.session.isAnimating = true;

        animateNavigationBox(imageIndex, oldIndex, albumIndex, oldAlbumIndex);
        slideBackgroundPhoto(imageIndex, albumIndex);
        preloadNextImage(imageIndex, albumIndex);

        // Load if last image, but not if first image This is because
        // for dedup, we'll get called by image 0, before other images
        // have come in.
        if (isLastImage(rp.session.activeIndex) &&
            rp.session.loadAfter !== null &&
            imageIndex != 0)
            rp.session.loadAfter();
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
    var animateNavigationBox = function (imageIndex, oldIndex, albumIndex = -1, oldAlbumIndex = -1) {
        var photo = rp.photos[imageIndex];
        var subreddit = '/r/' + photo.subreddit;
        var author = '/u/' + photo.author;

        if (albumIndex < 0) {
            $('#navboxTitle').html(photo.title);
            $('#navboxExtra').html((photo.extra !== undefined) ?photo.extra :"");
            $('#navboxLink').attr('href', photo.url).attr('title', $("<div/>").html(photo.title).text());

        } else {
            var pic = rp.photos[imageIndex].album[albumIndex];
            $('#navboxTitle').html(pic.title);
            var extra = (pic.extra) ?pic.extra :"";
            $('#navboxExtra').html(extra+(albumIndex+1)+"/"+rp.photos[imageIndex].album.length);
            $('#navboxLink').attr('href', pic.url).attr('title', $("<div/>").html(pic.title).text());
        }

        if (photo.subreddit !== undefined && photo.subreddit !== null) {
            $('#navboxSubreddit').attr('href', rp.redditBaseUrl + subreddit).html(subreddit);
            $('#navboxSubredditP').attr('href', subreddit).html($('<img />', {'class': 'redditp', src: '/images/favicon.png'}));
        }

        if (photo.author !== undefined) {
            $('#navboxAuthor').attr('href', rp.redditBaseUrl + author).html(author);
            $('#navboxAuthorP').attr('href', '/user/'+photo.author+'/submitted').html($('<img />', {'class': 'redditp',
                                                                                                    src: '/images/favicon.png'}));
        }
        $('#navboxCommentsLink').attr('href', photo.commentsLink).attr('title', "Comments");

        if (oldIndex != imageIndex) {
            toggleNumberButton(oldIndex, false);            
            toggleNumberButton(imageIndex, true);
            populateAlbumButtons(photo);
        }
        if (albumIndex >= 0 && albumIndex != oldAlbumIndex) {
            toggleAlbumButton(oldAlbumIndex, false);
            toggleAlbumButton(albumIndex, true);
        }
    };

    var failCleanup = function(message = '') {
        if (rp.photos.length > 0) {
            // already loaded images, don't ruin the existing experience
            return;
        }

        // remove "loading" title
        $('#navboxTitle').text(message);

        // display alternate recommendations
        $('#recommend').css({'display':'block'});
    };

    var failedAjaxDone = function (xhr, ajaxOptions, thrownError) {
        window.console.log("xhr:", xhr);
        window.console.log("ajaxOptions:", ajaxOptions);
        window.console.log("error:", thrownError);
        //alert("Failed ajax, maybe a bad url? Sorry about that :(\n" + xhr.responseText + "\n");
        failCleanup();
    };

    var failedAjax = function (xhr, ajaxOptions, thrownError) {
        window.console.log("xhr:", xhr);
        window.console.log("ajaxOptions:", ajaxOptions);
        window.console.log("error:", thrownError);
    };
    //
    // Slides the background photos
    //
    var slideBackgroundPhoto = function (imageIndex, albumIndex = -1) {
        var divNode;
        var index;
        var type;
        if (albumIndex < 0) {
            index = imageIndex;
            type = rp.photos[imageIndex].type;

        } else {
            index = -albumIndex-1;
            type = rp.photos[imageIndex].album[albumIndex].type;
        }

        if (rp.cache[index] === undefined)
            divNode = createDiv(imageIndex, albumIndex);
        else
            divNode = rp.cache[index];

        if (type == imageTypes.video || type == imageTypes.embed)
            clearSlideTimeout();

        divNode.prependTo("#pictureSlider");
        $("#pictureSlider div").fadeIn(rp.settings.animationSpeed);
        var oldDiv = $("#pictureSlider div:not(:first)");
        oldDiv.fadeOut(rp.settings.animationSpeed, function () {
            oldDiv.remove();

            var vid = divNode.find('video');
            if (vid)
                vid.prop('autoplay', true);

            rp.session.isAnimating = false;
        });
    };

    var createDiv = function(imageIndex, albumIndex = -1) {
        // Retrieve the accompanying photo based on the index
        var photo;
        if (albumIndex < 0)
            photo = rp.photos[imageIndex];

        else
            photo = rp.photos[imageIndex].album[albumIndex];

        // Used by showVideo and showImage
        var divNode = $("<div />").addClass("clouds");

        if (photo === undefined)
            return divNode;

        var cssMap = Object();
        //cssMap['display'] = "none";

        // Create a new div and apply the CSS
        var showImage = function(url) {
            // `preLoadImages` because making a div with a background css does not cause chrome
            // to preload it :/
            preLoadImages(url);
            cssMap['background-image'] = "url(" + url + ")";
            cssMap['background-repeat'] = "no-repeat";
            cssMap['background-size'] = "contain";
            cssMap['background-position'] = "center";

            divNode.css(cssMap);
        };

        if (photo.type == imageTypes.image) {
            showImage(photo.url);
            return divNode;
        }

        // Preloading, don't mess with timeout
        if (imageIndex == rp.session.activeIndex &&
            albumIndex == rp.session.activeAlbumIndex)
            clearSlideTimeout();

        // Called with showVideo({'thumbnail': jpgurl, 'mp4': mp4url, 'webm': webmurl})
        var showVideo = function(data) {
            var video = $('<video id="gfyvid" class="fullscreen"/>');

            if (data.thumbnail !== undefined)
                video.attr('poster', secureUrl(data.thumbnail));
            if (isVideoMuted())
                video.prop('muted', true);
            if (data.webm !== undefined)
                video.append($('<source type="video/webm" />').attr('src', data.webm));
            if (data.mp4 !== undefined)
                video.append($('<source type="video/mp4" />').attr('src', data.mp4));

            divNode.append(video);

            // iOS hackary
            var onCanPlay = function() {
                var video = $('#gfyvid');
                video.off('canplaythrough', onCanPlay);
                video[0].play();
            };

            $(video).on("ended", function(e) {
                debug("["+imageIndex+"] video ended");
                if (shouldStillPlay(imageIndex) || !autoNextSlide())
                    $('#gfyvid')[0].play();
            });

            $(video).on("loadeddata", function(e) {
                photo.duration = e.target.duration;
                if (photo.duration < rp.settings.timeToNextSlide) {
                    photo.times = Math.ceil(rp.settings.timeToNextSlide/photo.duration);
                } else {
                    photo.times = 1;
                }
                debug("["+imageIndex+"] Video loadeddata video: "+photo.duration);
                // preload, don't mess with timeout
                if (imageIndex !== rp.session.activeIndex)
                    return;
                $('#gfyvid').prop('autoplay', true);
                if ($('#gfyvid')[0].readyState === 3) // HAVE_ENOUGH_DATA (needed for ios)
                    onCanPlay();
                else
                    $(video).on('canplaythrough', onCanPlay);

            });
            
            // iOS devices don't play automatically
            $(video).on("click", function(e) {
                var vid = $('#gfyvid')[0];
                vid.play();
                if (vid.readyState !== 4) { // HAVE_ENOUGH_DATA
                    $(video).on('canplaythrough', onCanPlay);
		    window.setTimeout(function() {
		        vid.pause(); //block play so it buffers before playing
		    }, 0.5);
                }
            });
        };

        // Show Video if it's that easy
        if (isVideoExtension(photo.url)) {
            var extention = photo.url.substr(1 + photo.url.lastIndexOf('.'));
            var vid = {};
            vid[extention] = photo.url;
            if (photo.thumbnail)
                vid.thumbnail = photo.thumbnail;
            showVideo(vid);
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

        var jsonUrl, a;
        var dataType = 'json';
        var handleData;
        var headerData;
        var hostname = hostnameOf(photo.url);
        var shortid;

        // chomp off last char if it ends in '/'
        if (photo.url.charAt(photo.url.length-1) == '/') {
            var surl = photo.url.substr(0, photo.url.length-1);
            shortid = surl.substr(1 + surl.lastIndexOf('/'));

        } else {
            shortid = photo.url.substr(1 + photo.url.lastIndexOf('/'));
        }

        if (shortid.indexOf('#') != -1)
            shortid = shortid.substr(0, shortid.indexOf('#'));

        if (shortid.indexOf('.') != -1)
            shortid = shortid.substr(0, shortid.lastIndexOf('.'));


        if (hostname.indexOf('gfycat.com') >= 0) {

            jsonUrl = "https://gfycat.com/cajax/get/" + shortid;

            handleData = function (data) {
                if (typeof data.gfyItem != "undefined")
                    showVideo({'thumbnail': 'http://thumbs.gfycat.com/'+shortid+'-poster.jpg',
                               'webm': data.gfyItem.webmUrl,
                               'mp4':  data.gfyItem.mp4Url});
                else {
                    showImage(photo.thumbnail);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();
                }
            };

        } else if (hostname.indexOf('imgur.com') >= 0) {
            jsonUrl = "https://api.imgur.com/3/image/" + shortid;
            headerData = { Authorization: "Client-ID "+ rp.api_key.imgur };

            handleData = function (data) {
                if (! data.success ) {
                    log("["+imageIndex+"] imgur.com failed to load "+shortid+". state:"+data.status);
                    showImage(photo.url);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();
                    return;
                }
                if (data.data.animated == true)
                    showVideo({'webm': data.data.webm,
                               'mp4': data.data.mp4});
                else {
                    showImage(data.data.link);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();
                }
            };

        } else if (hostname.indexOf('vid.me') >= 0) {
            jsonUrl = 'https://api.vid.me/videoByUrl/' + shortid;
            handleData = function (data) {
                if (data.video.state == 'success')
                    showVideo({'thumbnail': data.video.thumbnail_url,
                               'mp4':  data.video.complete_url });

                else {
                    log("["+imageIndex+"] vid.me failed to load "+shortid+". state:"+data.video.state);
                    showImage(data.video.thumbnail_url);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();
                }
            };

        } else if (hostname.indexOf('streamable.com') >= 0) {

            jsonUrl = "https://api.streamable.com/videos/" + shortid;

            handleData = function(data) {
                var viddata = {'thumbnail': data.thumnail_url };
                if (data.files.mp4 !== undefined)
                    viddata.mp4 = data.files.mp4.url;
                if (data.files.webm !== undefined)
                    viddata.webm = data.files.webm.url;
                showVideo(viddata);
            };

        } else if (photo.url.indexOf('webm.land/w/') >= 0) {
            showVideo({'webm': 'http://webm.land/media/'+shortid+".webm"});
            return divNode;

        } else if (hostname.indexOf('pornbot.net') >= 0) {
            jsonUrl = "https:///pornbot.net/ajax/info.php?v=" + shortid;

            handleData = function(data) {
                var viddata = {'thumbnail': data.poster };
                if (data.mp4Url !== undefined)
                    viddata.mp4 = data.mp4Url;
                if (data.webmUrl !== undefined)
                    viddata.webm = data.webmUrl;
                showVideo(viddata);
            };

        } else if (hostname.indexOf('eroshare.com') >= 0) {
            headerData = { 'Origin': document.location.origin };

            var handleEroshareItem = function(item) {
                if (item.type == 'Image') {
                    showImage(item.url_full_protocol);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();

                } else if (item.type == 'Video') {
                    showVideo({ thumbnail: item.url_full_protocol,
                                mp4: item.url_mp4 });

                } else {
                    log("display failed unknown type "+item.type+" for url: "+photo.url);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();
                }
            };

            // Single Item
            if (photo.url.indexOf('/i/'+shortid) >= 0) {
                jsonUrl = 'https://api.eroshare.com/api/v1/items/' + shortid;
                handleData = handleEroshareItem;
 

            } else { // Album
                jsonUrl = 'https://api.eroshare.com/api/v1/albums/' + shortid + '/items';
                handleData = function(data) {
                    if (data.length > 1) {
                        photo.extra = albumLink('/eroshare/'+shortid);

                        initPhotoAlbum(photo, imageIndex);
                        $.each(data, function(i, item) {
                            var pic = { title: (item.description) ?item.description :photo.title,
                                        thumbnail: item.url_thumb };
                            if (item.type == 'Video') {
                                pic.url = item.url_mp4;
                                pic.type = imageTypes.video;
                            } else {
                                pic.url = item.url_full_protocol;
                                pic.type = imageTypes.image;
                            }
                            addAlbumItem(photo, pic, i);
                        });
                    }
                    handleEroshareItem(data[0]);
                };
            }

        } else if (hostname.indexOf('deviantart.com') >= 0) {
            jsonUrl = 'https://backend.deviantart.com/oembed?format=jsonp&url=' + encodeURIComponent(photo.url);
            dataType = 'jsonp';

            handleData = function(data) {

                photo.extra = '<a href="'+data.author_url+'" class="info">'+data.author_name+'</a>';

                if (data.type == 'photo') {
                    showImage(data.url);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();

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
                        if (imageIndex == rp.session.activeIndex)
                            resetNextSlideTimer();
                    }

                } else {
                    log("cannot display url [unk type "+data.type+"]: "+photo.url);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();
                }
            };
            
        } else if (hostname.indexOf('tumblr.com') >= 0) {
            a = photo.url.split('/');
            shortid = a[4];

            jsonUrl = 'https://api.tumblr.com/v2/blog/'+hostname+'/posts?api_key='+rp.api_key.tumblr+'&id='+shortid;
            dataType = 'jsonp';

            handleData = function(data) {
                var post = data.response.posts[0];

                photo.extra = infoLink(data.response.blog.url, 'tumblr/'+data.response.blog.name, '/tumblr/'+data.response.blog.name);
                if (post.type == "photo") {
                    if (post.photos.length > 1) {
                        photo.extra += albumLink('/tumblr/'+data.response.blog.name+'/'+shortid);
                        
                        initPhotoAlbum(photo, imageIndex);
                        $.each(post.photos, function(i, item) {
                            addAlbumItem(photo, { url: item.original_size.url,
                                                  type: imageTypes.image,
                                                  extra: infoLink(data.response.blog.url,
                                                                  'tumblr/'+data.response.blog.name,
                                                                  '/tumblr/'+data.response.blog.name),
                                                  title: (item.caption) ?item.caption :photo.title
                                                }, i);
                        });
                    }

                    showImage(post.photos[0].original_size.url);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();

                } else if (post.type == 'video') {
                    photo.thumbnail = post.thumbnail_url;
                    if (post.video_type == "youtube") {
                        photo.type = imageTypes.embed;
                        $('#numberButton'+(imageIndex+1)).addClass('embed');
                        photo.url = youtubeURL(post.video.youtube.video_id);
                        // TODO: suprise load vs. intentional load
                        if (rp.settings.embed)
                            showEmbed(photo.url);

                        else {
                            log("cannot display url [no embed]: "+photo.url);
                            showImage(secureUrl(post.thumbnail_url));
                            if (imageIndex == rp.session.activeIndex)
                                resetNextSlideTimer();
                        }
                        return;
                    }

                    photo.type = imageTypes.video;
                    var vid = { thumbnail: post.thumbnail_url };
                    if (post.video_url.indexOf('.mp4') > 0)
                        vid.mp4 = post.video_url;
                    else if (post.video_url.indexOf('.webm') > 0)
                        vid.webm = post.video_url;
                    photo.url = vid;
                    showVideo(vid);

                } else {
                    log("Tumblr post not photo or video: "+post.type+" using thumbnail");
                    showImage(photo.thumbnail);
                    if (imageIndex == rp.session.activeIndex)
                        resetNextSlideTimer();
                }
            };

        } else if (hostname.indexOf('youtube.com') >= 0) {
            var b;
            a = photo.url.split('/').pop();
            b = a.match(/.*v=([^&]*)/);
            if (b)
                shortid = b[1];

            showEmbed(youtubeURL(shortid));
            return divNode;

        } else if (hostname.indexOf('youtu.be') >= 0) {
            a = photo.url.split('/');
            if (a[a.length-1] == "")
                a.pop();

            showEmbed(youtubeURL(shortid));
            return divNode;

        } else if (hostname.indexOf('vimeo.com') >= 0) {
            showEmbed('https://player.vimeo.com/video/'+shortid+'?autoplay=1');
            return divNode;

        } else {
            log("["+imageIndex+"]","Unknown video site", hostname);
            return divNode;
        }

        divNode.css(cssMap);

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
            error: failedAjax,
            404: failedAjax,
            timeout: 5000,
            crossDomain: true
        });

        return divNode;
    };


    var verifyNsfwMakesSense = function() {
        // Cases when you forgot NSFW off but went to /r/nsfw
        // can cause strange bugs, let's help the user when over 80% of the
        // content is NSFW.
        var nsfwImages = 0;
        for(var i = 0; i < rp.photos.length; i++) {
            if(rp.photos[i].over18) {
                nsfwImages += 1;
            }
        }

        if(0.8 < nsfwImages * 1.0 / rp.photos.length) {
            rp.settings.nsfw = true;
            $("#nsfw").prop("checked", nsfw);
        }
    };

    var fixImgurPicUrl = function (url) {
        var hostname = hostnameOf(url);
        if (hostname.indexOf('i.') !== 0) {
            url = url.replace(/[\w\.]*imgur.com/i, 'i.imgur.com');
        }
        if (url.indexOf('?') > 0) {
            log("Found ? in url: "+url);
            url = url.replace(/\?[^\.]*/, '');
        }
        if (url.indexOf("/r/") >= 0)
                url = url.replace(/r\/[^ \/]+\//, '');
        // convert gifs to videos
        url = url.replace(/gifv?$/, "mp4");
        return url;
    };

    var secureUrl = function (url) {
        if (rp.settings.alwaysSecure && url.startsWith('//'))
            return "https"+url;
        return url;
    };

    var tryConvertPic = function (photo) {
        var url = photo.url;
        var hostname = hostnameOf(url);
        var shortid;
        var jsonUrl;
        var result;

        /** IMGUR **/
        if (hostname.indexOf('imgur.com') >= 0) {
            /*
             * Gallery URLs can be either albums or individual pictures
             */
            if (url.indexOf('/a/') > 0 ||
                url.indexOf('/gallery/') > 0) {

                if (! rp.api_key.imgur) {
                    return '';
                }

                if (url.indexOf('/a/') > 0) {
                    shortid = pathnameOf(url).split("/")[2];
                    jsonUrl = "https://api.imgur.com/3/album/" + shortid;

                } else if (url.indexOf('/gallery/') > 0) {
                    shortid = pathnameOf(url).split("/")[2];
                    jsonUrl = "https://api.imgur.com/3/album/" + shortid;
                }

                $.ajax({
                    url: jsonUrl,
                    headers: { Authorization: "Client-ID "+ rp.api_key.imgur },
                    dataType: 'json',
                    success: function (data) { result = data; },
                    error: failedAjax,
                    404: failedAjax,
                    jsonp: false,
                    timeout: 5000,
                    crossDomain: true,
                    async: false
                });

                if (result === undefined) {
                    if (url.indexOf('/gallery/') > 0)
                        return "http://i.imgur.com/"+shortid+".jpg";
                    else
                        return "";
                }


                if (result.data.images_count > 1) {
                    photo.extra = albumLink('/imgur/a/'+shortid);

                    initPhotoAlbum(photo);
                    $.each(result.data.images, function(i, item) {
                        var pic = { title: (item.title) ?item.title :(item.description) ?item.description :photo.title,
                                    url: item.animated ?item.mp4 :item.link,
                                    type: item.animated ?imageTypes.video :imageTypes.image
                                  };
                        addAlbumItem(photo, pic, i);
                    });
                }

                // If this is animated it will return the animated gif
                if (result.data.cover !== null)
                    return "http://i.imgur.com/"+result.data.cover+".jpg";
                else
                    return result.data.images[0].link;
            }

            url = fixImgurPicUrl(url);

            // imgur is really nice and serves the image with whatever extension
            // you give it. '.jpg' is arbitrary
            // regexp removes /r/<sub>/ prefix if it exists
            // E.g. http://imgur.com/r/aww/x9q6yW9

            if (isImageExtension(url))
                return url;
            if (isVideoExtension(url))
                return url;
            return url+".jpg";

        }
        if (hostname.indexOf('giphy.com') >= 0) {
            var ar = url.split(/[\/-]/);
            shortid = ar.pop();
            if (shortid == "")
                shortid = ar.pop();
            
            return 'https://media.giphy.com/media/'+shortid+'/giphy.mp4';
        }
        //log("Not understood url: "+url);
        return '';
    };

    var isImageExtension = function (url) {
        var dotLocation = url.lastIndexOf('.');
        if (dotLocation < 0) {
            log("skipped no dot: " + url);
            return false;
        }
        var extension = url.substring(dotLocation);

        if (rp.settings.goodImageExtensions.indexOf(extension) >= 0) {
            return true;
        } else {
            //log("skipped bad extension: " + url);
            return false;
        }
    };

    var isVideoExtension = function (url) {
        var dotLocation = url.lastIndexOf('.');
        if (dotLocation < 0) {
            log("skipped no dot: " + url);
            return false;
        }
        var extension = url.substring(dotLocation);

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
        //if (noMoreToLoad){
        //    log("No more images to load, will rotate to start.");
        //    return;
        //}

        rp.session.loadingNextImages = true;

        var jsonUrl = rp.redditBaseUrl + rp.url.subreddit + ".json?jsonp=redditcallback" + rp.url.vars + rp.session.after;

        var addImageSlideRedditT3 = function (item) {
            if (rp.dedup[item.data.subreddit] !== undefined &&
                rp.dedup[item.data.subreddit][item.data.id] !== undefined) {
                log('cannot display url [simul-dup:'+
                      rp.dedup[item.data.subreddit][item.data.id]+']: '+
                      item.data.url);
                return;
            }

            // Link to x-posted subreddits
            var title = item.data.title.replace(/\/?(r\/\w+)\s*/g,
                                                "<a href='"+rp.redditBaseUrl+"/$1'>/$1</a>"+
                                                "<a href='/$1'><img class='redditp' src='/images/favicon.png' /></a>");
            // Link to reddit users
            title = title.replace(/\/?u\/(\w+)\s*/g, 
                                  "<a href='"+rp.redditBaseUrl+"/user/$1'>/u/$1</a>"+
                                  "<a href='/user/$1/submitted'><img class='redditp' src='/images/favicon.png' /></a>");
            // Add flair (but remove if also in title)
            if (item.data.link_flair_text) {
                var needle = item.data.link_flair_text.trim();
                var re = new RegExp('[\\[\\{\\(]'+needle+'[\\]\\}\\)]', "ig");
                title = '<span class="linkflair">'+needle+'</span>'+title.replace(re, "").trim();
            }
            addImageSlide({
                url: item.data.url,
                title: title,
                over18: item.data.over_18,
                subreddit: item.data.subreddit,
                author: item.data.author,
                thumbnail: item.data.thumbnail,
                commentsLink: rp.redditBaseUrl + item.data.permalink
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
                alert("No data from this url :(");
                return;
            }

            // Watch out for "fake" subreddits
            if (rp.url.subreddit.startsWith('/r/random') ||
                rp.url.subreddit.startsWith('/r/randnsfw')) {
                rp.url.origsubreddit = rp.url.subreddit;
                // TODO: add rest of URL to subreddit e.g. /r/random/top
                rp.url.subreddit = '/r/' + data.data.children[0].data.subreddit;
                $('#subredditUrl').html("<a href='" + rp.redditBaseUrl + rp.url.subreddit + "'>" + rp.url.subreddit + "</a>");
            }

            var handleEntryData = function(data) {
                var item = data[0].data.children[0];
                if (rp.session.needDedup) {
                    $.each(data[1].data.children, function(i, dupe) {
                        if (rp.dedup[dupe.data.subreddit] == undefined)
                            rp.dedup[dupe.data.subreddit] = {};
                        rp.dedup[dupe.data.subreddit][dupe.data.id] = '/r/'+item.data.subreddit+'/'+item.data.id;
                    });
                }
                addImageSlideRedditT3(item);
            };

            $.each(data.data.children, function (i, item) {
                // Text entry, no actual media
                if (item.kind != "t3") {
                    log('cannont display url [not link]: '+item.kind);
                    return;
                }

                if (item.data.thumbnail == "self") {
                    log('cannot display url [self]: ' + item.data.url);
                    return;
                }

                if (rp.dedup[item.data.subreddit] !== undefined &&
                    rp.dedup[item.data.subreddit][item.data.id] !== undefined) {
                    log('cannot display url [duplicate:'+
                          rp.dedup[item.data.subreddit][item.data.id]+']: '+
                          item.data.url);
                    return;
                }

                if (rp.session.needDedup) {
                    var url = rp.redditBaseUrl + '/r/' + item.data.subreddit + '/duplicates/' + item.data.id + '.json';
                    $.ajax({
                        url: url,
                        dataType: 'json',
                        success: handleEntryData,
                        error: failedAjax,
                        404: failedAjax,
                        jsonp: false,
                        timeout: 5000,
                        crossDomain: true
                    });

                } else {
                    addImageSlideRedditT3(item);
                }
            });

            verifyNsfwMakesSense();
        };

        debug('Ajax requesting: ' + jsonUrl);

        $.ajax({
            url: jsonUrl,
            dataType: 'jsonp',
            jsonpCallback: 'redditcallback',
            success: handleData,
            error: failedAjax,
            404: failedAjax,
            timeout: 5000,
            crossDomain: true
        });
    };

    var getEroshareAlbum = function () {
        var albumID = rp.url.subreddit.match(/.*\/(.+?$)/)[1];
        var jsonUrl = 'https://api.eroshare.com/api/v1/albums/' + albumID;

        var handleData = function (data) {

            if (data.items.length === 0) {
                alert("No data from this url :(");
                return;
            }

            $.each(data.items, function (i, item) {
                var isVid = (item.type == 'Video');
                addImageSlide({
                    url: (isVid) ?item.url_mp4 :item.url_full_protocol,
                    title: (item.description !== undefined) ?item.description :"",
                    over18: true,
                    commentsLink: data.reddit_submission.permalink,
                    subreddit: data.reddit_submission.subreddit,
                    author: data.reddit_submission.author
                });
            });

            verifyNsfwMakesSense();

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
            headers: { 'Origin': document.location.origin },
            success: handleData,
            error: failedAjaxDone,
            404: failedAjaxDone,
            timeout: 5000
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
                    over18: item.nsfw,
                    commentsLink: data.data.link,
                    subreddit: data.data.section,
                    /* author: data.data.account_url, */
                    extra: (data.data.account_url !== null) 
                        ?'<a href="http://imgur.com/user/'+data.data.account_url+
                        '">/user/'+data.data.account_url+'</a>'
                    :""
                });
            });

            verifyNsfwMakesSense();

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
            404: failedAjaxDone,
            timeout: 5000,
            headers: { Authorization: 'Client-ID ' + rp.api_key.imgur }
        });
    };

    var getTumblrBlog = function () {
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
            $('#subredditUrl').html("<a href='" + data.response.blog.url + "'>" + data.response.blog.name + ".tumblr.com</a>");

            if (rp.session.after < data.response.total_posts) {
                rp.session.after = rp.session.after + data.response.posts.length;
                rp.session.loadAfter = getTumblrBlog;

            } else { // Found all posts
                rp.session.loadAfter = null;
            }

            $.each(data.response.posts, function (i, post) {
                var image = { title: post.summary,
                              over18: data.response.blog.is_nsfw,
                              commentsLink: post.post_url
                            };

                if (post.type == "photo") {
                    image.url = post.photos[0].original_size.url;
                    if (post.photos.length > 1) {
                        image.extra = albumLink('/tumblr/'+data.response.blog.name+'/'+post.id);

                        initPhotoAlbum(image);
                        $.each(post.photos, function(i, item) {
                            addAlbumItem(image, { url: item.original_size.url,
                                                  type: imageTypes.image,
                                                  extra: infoLink(data.response.blog.url,
                                                                  'tumblr/'+data.response.blog.name,
                                                                  '/tumblr/'+data.response.blog.name),
                                                  title: (item.caption) ?item.caption :image.title
                                                }, i);
                        });
                    }

                } else if (post.type == "video") {
                    if (post.video_type == "youtube") {
                        image.type = imageTypes.embed;
                        image.url = youtubeURL(post.video.youtube.video_id);
                            
                    } else {
                        image.type = imageTypes.video;
                        image.url = post.video_url;
                    }
                    image.thumbnail = post.thumbnail_url;

                } else {
                    log('cannot display url [unk type '+post.type+']: '+post.post_url);
                    return;
                }

                addImageSlide(image);
            });

            verifyNsfwMakesSense();

            rp.session.loadingNextImages = false;
        };

        debug('getTumblrBlog requesting: '+jsonUrl);

        $.ajax({
            url: jsonUrl,
            dataType: 'jsonp',
            success: handleData,
            error: failedAjaxDone,
            404: failedAjaxDone,
            timeout: 5000
        });
    };

    var getTumblrAlbum = function (url) {
        var a = rp.url.subreddit.split('/');
        if (a[a.length-1] == "")
            a.pop();

        var shortid = a.pop();
        var hostname = a.pop();

        var jsonUrl = 'https://api.tumblr.com/v2/blog/'+hostname+'/posts?api_key='+rp.api_key.tumblr+'&id='+shortid;

        var handleData = function (data) {
            $('#subredditUrl').html("<a href='" + data.response.blog.url + "'>" + data.response.blog.name + ".tumblr.com</a>");

            $.each(data.response.posts, function (i, post) {
                $.each(post.photos, function (j, item) {
                    addImageSlide({
                        url: item.original_size.url,
                        title: post.summary,
                        over18: false,
                        commentsLink: post.post_url
                        /* subreddit: undefined, */
                        /* author: data.data.account_url, */
                        /* extra: userextra, */
                    });
                });
            });

            verifyNsfwMakesSense();

            if (!rp.session.foundOneImage) {
                log(jsonUrl);
                alert("Sorry, no displayable images found in that url :(");
            }

            // show the first image
            if (rp.session.activeIndex == -1)
                startAnimation(0);

            rp.session.loadingNextImages = false;
        };

        debug('getTumblrAlbum requesting: ' + jsonUrl);

        $.ajax({
            url: jsonUrl,
            dataType: 'jsonp',
            success: handleData,
            error: failedAjaxDone,
            404: failedAjaxDone,
            timeout: 5000
        });
    };

    var setupUrls = function() {
        // Separate to before the question mark and after
        // Detect predefined reddit url paths. If you modify this be sure to fix
        // .htaccess
        // This is a good idea so we can give a quick 404 page when appropriate.
        var regexS = "(/(?:(?:r/)|(?:v/)|(?:imgur/a/)|(?:tumblr/)|(?:eroshare/)|(?:user/)|(?:domain/)|(?:search)|(?:me))[^&#?]*)[?]?(.*)";
        var regex = new RegExp(regexS);
        var results = regex.exec(window.location.href);
        //log(results);
        if (results !== null) {
            rp.url.subreddit = results[1];
            rp.url.vars = decodeUrl(results[2]);
        }

        var getVarsQuestionMark = "";

        if (rp.url.vars.length > 0)
            getVarsQuestionMark = "?" + rp.url.vars;
        rp.url.vars = '&' + rp.url.vars;

        // Remove .compact as it interferes with .json (we got "/r/all/.compact.json" which doesn't work).
        rp.url.subreddit = rp.url.subreddit.replace(/.compact/, "");
        // Consolidate double slashes to avoid r/all/.compact/ -> r/all//
        rp.url.subreddit = rp.url.subreddit.replace(/\/{2,}/, "/");

        var subredditName;
        if (rp.url.subreddit === "") {
            rp.url.subreddit = "/";
            subredditName = "reddit.com" + getVarsQuestionMark;
            //var options = ["/r/aww/", "/r/earthporn/", "/r/foodporn", "/r/pics"];
            //rp.url.subreddit = options[Math.floor(Math.random() * options.length)];
        } else {
            subredditName = rp.url.subreddit + getVarsQuestionMark;
        }

        if (rp.url.subreddit.indexOf('/user/') >= 0 ||
            rp.url.subreddit.indexOf('/domain/') >= 0 ||
            rp.url.subreddit.indexOf('/search/') >= 0 ||
            rp.url.subreddit.indexOf('/r/all') >= 0 ||
            rp.url.subreddit.indexOf('+') >= 0)
            rp.session.needDedup = true;
        else
            rp.session.needDedup = false;

        var visitSubredditUrl = rp.redditBaseUrl + rp.url.subreddit + getVarsQuestionMark;

        // truncate and display subreddit name in the control box
        var displayedSubredditName = subredditName;
        // empirically tested capsize, TODO: make css rules to verify this is enough.
        // it would make the "nsfw" checkbox be on its own line :(
        var capsize = 19;
        if(displayedSubredditName.length > capsize) {
            displayedSubredditName = displayedSubredditName.substr(0,capsize) + "&hellip;";
        }
        $('#subredditUrl').html("<a href='" + visitSubredditUrl + "'>" + displayedSubredditName + "</a>");

        document.title = "redditP - " + subredditName;
    };

    if (rp.settings.alwaysSecure)
        rp.redditBaseUrl = "https://www.reddit.com";

    else
        rp.redditBaseUrl = "//www.reddit.com";

    initState();
    setupUrls();

    // if ever found even 1 image, don't show the error
    rp.session.foundOneImage = false;

    if (rp.url.subreddit.indexOf('/imgur') == 0)
        getImgurAlbum();

    else if (rp.url.subreddit.indexOf('/tumblr') == 0) {
        if (rp.url.subreddit.split('/').length > 3)
            getTumblrAlbum();
        else
            getTumblrBlog();

    } else if (rp.url.subreddit.indexOf('/eroshare') == 0) {
        getEroshareAlbum();

    } else {
        getRedditImages();
    }
});
