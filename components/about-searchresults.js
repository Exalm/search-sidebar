/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");

/*
 * This service registers about:search URL
 */
function AboutSearchResults() {}

AboutSearchResults.prototype = {
  classID: Components.ID("{3ffae56a-4618-47b0-b77d-e2458a71c1e9}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIAboutModule])
}

AboutSearchResults.prototype.getURIFlags = function(aURI) {
  return Ci.nsIAboutModule.ALLOW_SCRIPT;
};

AboutSearchResults.prototype.newChannel = function(aURI) {
  let channel = Services.io.newChannel("chrome://searchSidebar/content/search-results.xul", null, null);
  channel.originalURI = aURI;
  return channel;
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([AboutSearchResults]);
