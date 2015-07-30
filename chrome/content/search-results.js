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
Cu.import("chrome://searchSidebar/content/modules/SearchParser.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchResultTreeView.jsm");

const gSearchPanelService = Cc["@searchSidebar/search-panel-service;1"].getService().wrappedJSObject;

const BLACKLIST_TOPIC = "searchSidebar:blacklist-changed";

var gSearchBundle;
var gTree, gMenulist, gDeck, gDetails, gBrowserTemplate;
var gQuery, gTitle, gEngines;
var gView;

function init() {
  gSearchBundle = document.getElementById("searchBundle");

  gMenulist = document.getElementById("search-engine-list");

  gTree = document.getElementById("search-tree");
  gDeck = document.getElementById("search-deck");
  gDetails = document.getElementById("search-details-area");
  gBrowserTemplate = document.getElementById("search-browser-template");

  gTree.view = gView = new SearchResultTreeView("ranking", "ascending");

  let args = getArgs();
  gQuery = args.query;
  gEngines = args.engines;
  if (!gEngines)
    return;

  gTitle = gSearchBundle.stringBundle.formatStringFromName(
                     "searchTitle", [ gQuery, gEngines ], 2);

  gEngines.forEach((name, i) => {
    let engine = Services.search.getEngineByName(name);

    // Add the engine to the list of engines
    let item = gMenulist.appendItem(engine.name, i + 1);
    item.setAttribute("class", "menuitem-iconic");
    if (engine.iconURI)
      item.setAttribute("image", engine.iconURI.spec);

    // Create a browser
    let browser = gBrowserTemplate.cloneNode(true);
    browser.removeAttribute("id");
    gDeck.insertBefore(browser, gBrowserTemplate);
    browser.docShell.allowAuth = false;
    browser.docShell.allowDNSPrefetch = false;

    // And open the engine page in it
    let submission = engine.getSubmission(gQuery);
    browser.loadURI(submission.uri.spec, null, null);

    // After it has loaded, gather results and throw them into our tree
    browser.addEventListener("load", event => {
      pushResults(event.target.contentDocument, engine);
    }, false);
  });

  Services.obs.addObserver(blacklistObserver, BLACKLIST_TOPIC, false);
}

function shutdown() {
  Services.obs.removeObserver(blacklistObserver, BLACKLIST_TOPIC);
}

function onResultSelected() {
  let result = gView.getResult(gTree.currentIndex);
  if (!result) {
    document.getElementById("search-result-details-deck").selectedIndex = 1;
    return;
  }

  document.getElementById("search-result-details-deck").selectedIndex = 0;
  document.getElementById("search-result-details-title").textContent = result.title;
  document.getElementById("search-result-details-link").value = result.href;
  document.getElementById("search-result-details-description").textContent = result.description;
  document.getElementById("search-result-details-preview").src = result.preview;
}

function onTreeClicked(aEvent, aCount) {
  let result = getResultAt(gTree, gView, aEvent);
  if (!result)
    return;

  // Skip right click
  if (aEvent.button == 2)
    return;

  // Skip single left click without modifiers
  if (aEvent.button == 0 && aCount == 1 && !aEvent.shiftKey && !aEvent.ctrlKey)
    return;

  openUILink(result.href, aEvent);
}

function onTreeKeyDown(aEvent) {
  if (aEvent.keyCode != KeyEvent.DOM_VK_ENTER && aEvent.keyCode != KeyEvent.DOM_VK_RETURN)
    return;

  let result = gView.getResult(gTree.currentIndex);
  if (result)
    openUILink(result.href, aEvent);
}

function onLinkClicked(aEvent) {
  openUILink(aEvent.target.value, aEvent);
}

function onLinkDragged(aEvent) {
  let title = document.getElementById("search-result-details-title").textContent;
  aEvent.dataTransfer.setData("text/plain", aEvent.target.value);
  aEvent.dataTransfer.setData("text/x-moz-url", aEvent.target.value+"\n"+title);
}

function getArgs() {
  let url = decodeURI(document.location);

  let parts = url.substr(url.indexOf("?") + 1).split("&");
  let q, e;

  parts.forEach(part => {
    let parts2 = part.split("=");
    if (parts2.length != 2)
      return;
    if (parts2[0] == "q")
      q = parts2[1];
    if (parts2[0] == "e")
      e = parts2[1].split(";");
  });

  return {
    query: q,
    engines: e
  };
}

function pushResults(aDocument, aEngine) {
  let results;

  // This is a hacky attempt to support engines
  // that sometimes redirect to the "best matching" page instead
  // of consistently showing the list of results.
  // Notable examples are Wikipedia and Google Browse By Name
  // Let's try to detect that and just show a single
  // link to the found page instead
  if (!SearchParser.findEngineForUrl(aDocument.URL)) {
    // Engine not found! So this is not a result page.
    // Let's just pretend it was THE result. It is even
    // true to some extents
    let result = {
      href : decodeURI(aDocument.URL),
      title : aDocument.title,
      description : "",
      icon : aEngine.iconURI ? aEngine.iconURI.spec : null,
      site : Services.eTLD.getBaseDomain(Services.io.newURI(aDocument.URL, null, null)),
      preview : "",
      ranking : 1,
      engine : aEngine.name
    };

    results = [ result ];
  } else
    results = SearchParser.parseDocument(aDocument, aEngine).results;

  gView.addResults(results);

  sortTree();
}

function sortTree(aCol) {
  let res = gTree.getAttribute("sortResource");
  let dir = gTree.getAttribute("sortDirection") == "descending" ? -1 : 1;
  if (aCol) {
    res = aCol.id;
    dir = aCol.getAttribute("sortDirection") == "descending" ? -1 : 1;
    if (gTree.getAttribute("sortResource") == aCol.id)
      dir *= -1;
  } else
    aCol = document.getElementById(res);

  gTree.setAttribute("sortResource", res);
  gTree.setAttribute("sortDirection", dir == 1 ? "ascending" : "descending");

  let cols = gTree.getElementsByTagName("treecol");
  for (let i = 0; i < cols.length; i++)
    cols[i].removeAttribute("sortDirection");

  gView.sort(res, dir);

  aCol.setAttribute("sortDirection", dir == 1 ? "ascending" : "descending");

  if (PrivateBrowsingUtils.isContentWindowPrivate(window))
    return;

  gSearchPanelService.setCurrentResults({
    results: gView.getResults(),
    prevUrl: null,
    nextUrl: null,
    queryUrl: document.URL,
    queryTitle: gTitle
  });
}

function switchTab() {
  gDeck.selectedIndex = gMenulist.value;
}

function onContextMenuShowing(aEvent) {
  let result = getResultAt(gTree, gView, aEvent);
  let empty = SearchBlacklist.isEmpty();

  document.getElementById("search-result-context").result = result;

  document.getElementById("search-context-excludeUrl-sep").hidden = !result;
  document.getElementById("search-context-excludeUrl").hidden = !result;
  document.getElementById("search-context-excludeDomain").hidden = !result;

  document.getElementById("search-context-clearFilters-sep").hidden = empty;
  document.getElementById("search-context-clearFilters").hidden = empty;
}

function onContextMenuCommand(aEvent) {
  let result = document.getElementById("search-result-context").result;
  switch(aEvent.target.id) {
    case "search-context-bookmarkQuery":
      addBookmark(document.URL, gTitle);
      break;
    case "search-context-excludeUrl":
      SearchBlacklist.excludeUrl(result);
      break;
    case "search-context-excludeDomain":
      SearchBlacklist.excludeDomain(result);
      break;
    case "search-context-clearFilters":
      SearchBlacklist.clear();
      break;
  }
}

var blacklistObserver = {
  observe: function(aSubject, aTopic, aData) {
    gView.refreshFilter();
  }
};
