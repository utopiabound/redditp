/* -*- mode: javascript; indent-tabs-mode: nil -*-
 * Hacks to fix older IE versions, generally prior to IE 9
 */

if (Array.indexOf == undefined) {
    Array.prototype.indexOf = function (obj) {
        for (var i = 0; i < this.length; i++) {
            if (this[i] == obj) {
                return i;
            }
        }
        return -1;
    };
}

if (Date.now == undefined) {
    Date.now = function() { return +new Date; };
}
