/* -*- mode: javascript; indent-tabs-mode: nil -*-
 * Hacks to fix older IE versions, generally prior to IE 9
 */

// IE Prior to 9
if (Array.prototype.indexOf === undefined) {
    Array.prototype.indexOf = function (obj) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == obj) {
                return i;
            }
        }
        return -1;
    };
}

// IE all, iOS prior to 9, Android prior to 5
if (Array.prototype.includes === undefined) {
    Array.prototype.includes = function (obj) {
        return (this.indexOf(obj) >= 0);
    };
}

// IE all, iOS prior to 9, Android prior to 5
if (String.prototype.includes === undefined) {
    String.prototype.includes = function (obj) {
        return (this.indexOf(obj) >= 0);
    };
}

// prior to ES5
if (Date.now === undefined) {
    Date.now = function() { return +new Date(); };
}

// IE prior to 11, iOS prior to 10, Android (all)
if (String.prototype.localeCompare === undefined) {
    String.prototype.localeCompare = function(str) {
        return ((this == str) ? 0 : ((this > str) ? 1 : -1));
    };
}

// IE all, iOS prior to 13.4, Android prior to 5
if (String.prototype.replaceAll === undefined) {
    String.prototype.replaceAll = function(str, replacement) {
        var re = RegExp(str, 'g');
        return str.replace(re, replacement);
    };
}
