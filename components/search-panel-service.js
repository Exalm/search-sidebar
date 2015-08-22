/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */


const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchBlacklist.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchCategories.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchEngineSelection.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchParser.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchRules.jsm");

const SEARCH_TOPIC = "searchSidebar:search-state-changed";
const NAVIGATOR_WINDOW_TYPE = "navigator:browser";

var gResults = {
  results: [],
  prevUrl: null,
  nextUrl: null,
  queryUrl: null,
  queryTitle: null
};

var gLastQuery = "";

/*
 * This service intercepts search requests and
 * sends them to the search sidebars in all windows
 */
function SearchPanelService() {
  this.wrappedJSObject = this;
}

SearchPanelService.prototype = {
  classID: Components.ID("{5ad4b3b9-5fb4-4065-ae42-7071097985cf}"),
  QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports, Ci.nsIObserver])
};

SearchPanelService.prototype.observe = function(aSubject, aTopic, aData) {
  SearchBlacklist.init();
  SearchCategories.init();
  SearchEngineSelection.init();
  SearchRules.init();

  Services.ww.registerNotification(gWindowObserver);
};

SearchPanelService.prototype.getCurrentResults = function() {
  return gResults;
};

SearchPanelService.prototype.setCurrentResults = function(aResults) {
  if (!aResults || !aResults.results || aResults.results.length == 0)
    return;

  gResults = aResults;
  Services.obs.notifyObservers(null, SEARCH_TOPIC, "finished");
};

SearchPanelService.prototype.getLastQuery = function() {
  return gLastQuery;
};

SearchPanelService.prototype.setLastQuery = function(aQuery) {
  gLastQuery = aQuery;
};

var gWindowObserver = {
  observe: function(aSubject, aTopic, aData) {
    let win = aSubject.QueryInterface(Ci.nsIDOMWindow);

    if (aTopic == "domwindowclosed") {
      onWindowUnload(win);
      return;
    }

    win.addEventListener("load", () => {
      win.removeEventListener("load", arguments.callee);
      onWindowLoad(win);
    });
  }
};

function onWindowLoad(aWindow) {
  // Skip non-browser windows
  if (aWindow.document.documentElement.getAttribute("windowtype") != NAVIGATOR_WINDOW_TYPE)
    return;

  // gBrowser is not yet available by this point
  let browser = aWindow.getBrowser();
  browser.addTabsProgressListener(progressListener);
}

function onWindowUnload(aWindow) {
  // Skip non-browser windows
  if (aWindow.document.documentElement.getAttribute("windowtype") != NAVIGATOR_WINDOW_TYPE)
    return;

  // And here gBrowser is available
  aWindow.gBrowser.removeTabsProgressListener(progressListener);
}

function onPageStartLoading(aBrowser, aUrl) {
  if (PrivateBrowsingUtils.isWindowPrivate(aBrowser.ownerGlobal))
    return;

  let engine = SearchParser.findEngineForUrl(aUrl);
  if (!engine)
    return;

  // The engine is found, this is a page with results
  // We should check the pref and open the search sidebar in the current window

  // But first let's notify the panels, so that advanced mode panels can switch to results
  Services.obs.notifyObservers(null, SEARCH_TOPIC, "started");

  if (!Services.prefs.getBoolPref("browser.search.opensidebarsearchpanel"))
    return

  aBrowser.ownerGlobal.BrowserSearch.revealSidebar();
}

function onPageLoad(aBrowser) {
  // Private search should be private. If its results are displayed in
  // sidebars of all windows, it's no longer private, so we skip it
  if (PrivateBrowsingUtils.isWindowPrivate(aBrowser.ownerGlobal))
    return;

  let engine = SearchParser.findEngineForUrl(aBrowser.contentDocument.URL);
  if (!engine)
    return;

  // We found it. Grab the results and throw them at the panels
  let res = SearchParser.parseDocument(aBrowser.contentDocument, engine);
  Cc["@searchSidebar/search-panel-service;1"].getService().wrappedJSObject.setCurrentResults(res);
}

var progressListener = {
  QueryInterface: XPCOMUtils.generateQI([
    Ci.nsIWebProgressListener,
    Ci.nsISupportsWeakReference,
    Ci.nsISupports
  ]),

  onStateChange: function(aBrowser, aWebProgress, aRequest, aStateFlags, aStatus) {
    // An arcane condition that is same as the one that is used for
    // "Document xxx loaded successfully" messages

//    if (!(aStateFlags & Ci.nsIWebProgressListener.STATE_START) &&
//        aStateFlags & Ci.nsIWebProgressListener.STATE_STOP &&
//        aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK &&
//        aRequest &&
//        aWebProgress.isTopLevel &&
//        Components.isSuccessCode(aStatus)) {
//      onPageLoad(aBrowser);
//    }

    // We should catch two moments:
    // 1. When the page has just started loading
    //     If it's a search page, it's time to open search panel according to the option
    // 2. When the page has just finished loading
    //     It's time to parse results so they can be shown by panels
    if (aWebProgress.isTopLevel && Components.isSuccessCode(aStatus) &&
        aStateFlags & Ci.nsIWebProgressListener.STATE_IS_NETWORK) {

      if (aStateFlags & Ci.nsIWebProgressListener.STATE_START)
        onPageStartLoading(aBrowser, aRequest.QueryInterface(Ci.nsIChannel).originalURI.spec)

      else if (aStateFlags & Ci.nsIWebProgressListener.STATE_STOP)
        onPageLoad(aBrowser);
    }
  },

  onProgressChange: function() { return 0; },
  onLocationChange: function() {},
  onStatusChange: function() { return 0; },
  onSecurityChange: function() {},
  onRefreshAttempted: function() { return true; },
  onLinkIconAvailable: function() {}
};

var NSGetFactory = XPCOMUtils.generateNSGetFactory([SearchPanelService]);
