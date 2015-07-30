/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource://gre/modules/FormHistory.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchBlacklist.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchCategories.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchEngineSelection.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchResultTreeView.jsm");

const BLACKLIST_TOPIC = "searchSidebar:blacklist-changed";
const CATEGORIES_TOPIC = "searchSidebar:categories-changed";
const SEARCH_ENGINE_TOPIC = "browser-search-engine-modified";
const SEARCH_TOPIC = "searchSidebar:search-state-changed";

const PREF_BRANCH = "extensions.searchSidebar.";
const PREF_ADVANCED_MODE = "advanced_mode";
const PREF_DONT_ASK_AGAIN = "set_default.dont_ask_again";

const SORT_DIRECTIONS = [ "descending", "natural", "ascending" ];

const gSearchPanelService = Cc["@searchSidebar/search-panel-service;1"].getService().wrappedJSObject;
const gPrefs = Services.prefs.getBranch(PREF_BRANCH);
const gPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);

var gAdvancedMode, isPB;

var gSearchBundle, gCurrentCategory;
var engineMenulist, categoryMenulist, gTextbox, gSearchButton;
var gTreeDeck, gResultTree, gPrevButton, gNextButton, gEngineList;
var gResultView, gQueryUrl, gQueryTitle;

function Startup() {
  gSearchBundle = document.getElementById("searchBundle");

  engineMenulist = document.getElementById("sidebar-search-engines");
  categoryMenulist = document.getElementById("sidebar-search-categories");
  gTextbox = document.getElementById("sidebar-search-text");
  gSearchButton = document.getElementById("sidebar-search-button");
  gResultTree = document.getElementById("sidebar-search-results-tree");
  gEngineList = document.getElementById("sidebar-search-engines-list");
  gTreeDeck = document.getElementById("sidebar-search-tree-deck");
  gPrevButton = document.getElementById("search-prev-button");
  gNextButton = document.getElementById("search-next-button");

  gResultTree.view = gResultView = new SearchResultTreeView("title", "natural");

  gTextbox.value = gSearchPanelService.getLastQuery();
  gTextbox.select();

  gCurrentCategory = "all-engines";

  isPB = top.gPrivate;
  if (isPB)
    gTextbox.searchParam += "|private";

  gSearchButton.disabled = !gTextbox.value;
  setMode(gPrefs.getBoolPref(PREF_ADVANCED_MODE));
  updateResults();

  Services.obs.addObserver(engineObserver, SEARCH_ENGINE_TOPIC, true);
  Services.obs.addObserver(resultsObserver, SEARCH_TOPIC, false);
  Services.obs.addObserver(categoryObserver, CATEGORIES_TOPIC, false);
  Services.obs.addObserver(blacklistObserver, BLACKLIST_TOPIC, false);
  gPrefs.addObserver("", prefObserver, false);
}

function Shutdown() {
  Services.obs.removeObserver(engineObserver, SEARCH_ENGINE_TOPIC);
  Services.obs.removeObserver(resultsObserver, SEARCH_TOPIC);
  Services.obs.removeObserver(categoryObserver, CATEGORIES_TOPIC);
  Services.obs.removeObserver(blacklistObserver, BLACKLIST_TOPIC);
  gPrefs.removeObserver("", prefObserver);
}

function setMode(aMode) {
  gAdvancedMode = aMode;

  document.getElementById("engines-menulist-container").hidden = gAdvancedMode;
  document.getElementById("categories-menulist-container").hidden = !gAdvancedMode;
  gTreeDeck.selectedIndex = gAdvancedMode ? 1 : 0;

  if (gAdvancedMode) {
    loadCategories();
  } else
    LoadEngineList();
}

function LoadEngineList() {
  if (gAdvancedMode)
    return;

  // Make sure the popup is empty.
  while (engineMenulist.getItemAtIndex(0).id != "sidebar-search-engines-separator")
    engineMenulist.removeItemAt(0);

  var engines = Services.search.getVisibleEngines();
  engines.forEach((engine, i) => {
    let name = engine.name;
    let menuitem = engineMenulist.insertItemAt(i, name, name);
    menuitem.setAttribute("class", "menuitem-iconic");
    if (engine.iconURI)
      menuitem.setAttribute("image", engine.iconURI.spec);
    menuitem.engine = engine;
  });
  engineMenulist.value = Services.search.currentEngine.name;
}

function loadCategories() {
  if (!gAdvancedMode)
    return;

  // Make sure the popup is empty.
  while (categoryMenulist.getItemAtIndex(categoryMenulist.itemCount - 1).id != "sidebar-search-categories-separator")
    categoryMenulist.removeItemAt(categoryMenulist.itemCount - 1);

  let categories = SearchCategories.getCategories();
  for (let id in categories) {
    let category = categories[id];
    let name = category.name;
    let menuitem = categoryMenulist.appendItem(name, id);
    menuitem.category = category;
  }

  categoryMenulist.value = categories[gCurrentCategory] ? gCurrentCategory : "all-engines";
  SelectCategory();
}

function SelectEngine() {
  if (engineMenulist.selectedItem.getAttribute("class") == "sidebar-search-menuitem-special") {
    let item = engineMenulist.selectedItem;
    // Quickly revert the selection, so that the special items don't switch anything
    engineMenulist.value = Services.search.currentEngine.name;
    selectSpecialMenuItem(item);
    return;
  }

  function shouldChangeDefaultEngine(aEngine) {
    if (gPrefs.getBoolPref(PREF_DONT_ASK_AGAIN)) {
      return true;
    }

    let title = gSearchBundle.getString("changeEngineTitle");
    let dontAskAgainMsg = gSearchBundle.getString("dontAskAgainMsg");
    let engineName = engineMenulist.selectedItem.engine.name;
    let changeEngineMsg = gSearchBundle.stringBundle.formatStringFromName(
                          "changeEngineMsg", [engineName], 1);

    let checkbox = { value: 0 };
    let choice = gPrompt.confirmEx(window, title, changeEngineMsg,
                   gPrompt.STD_YES_NO_BUTTONS,
                   null, null, null, dontAskAgainMsg, checkbox);

    if (checkbox.value)
      gPrefs.setBoolPref(PREF_DONT_ASK_AGAIN, "true");

    return choice == 0;
  }

  if (engineMenulist.selectedItem) {
    let engine = engineMenulist.selectedItem.engine;
    if (shouldChangeDefaultEngine(engine)) {
      Services.search.currentEngine = engine;
      Services.search.defaultEngine = engine;
    } else
      engineMenulist.value = Services.search.currentEngine.name;
  }
}

function SelectCategory() {
  if (!gAdvancedMode)
    return;


  if (categoryMenulist.selectedItem.getAttribute("class") == "sidebar-search-menuitem-special") {
    let item = categoryMenulist.selectedItem;
    // Revert selection back to previous state
    categoryMenulist.value = gCurrentCategory;
//    reloadCategory();

    selectSpecialMenuItem(item);
    return;
  }

  gCurrentCategory = categoryMenulist.value;

  // Show engines tree
  gTreeDeck.selectedIndex = 1;
  reloadCategory();
}

function reloadCategory() {
  if (!gAdvancedMode)
    return;

  while (gEngineList.itemCount > 0)
    gEngineList.removeItemAt(0);

  let category = categoryMenulist.selectedItem.category;
  let engines;
  if (category)
    engines = category.engines.map(name => {
      return Services.search.getEngineByName(name);
    });
  else
    engines = Services.search.getVisibleEngines();

  let selectedEngines = SearchEngineSelection.getSelectedEngines(gCurrentCategory);

  engines.forEach(engine => {
    let listitem = gEngineList.appendItem(engine.name, engine.name);
    listitem.setAttribute("type", "checkbox");
    listitem.setAttribute("label", engine.name);
    listitem.setAttribute("class", "listitem-iconic");
    if (engine.iconURI)
      listitem.setAttribute("image", engine.iconURI.spec);
    listitem.value = engine.name;
    listitem.engine = engine;

    if (selectedEngines.indexOf(engine.name) >= 0)
      listitem.setAttribute("checked", "true");

    if (engine == Services.search.defaultEngine)
      listitem.setAttribute("default-engine", "true");
  });
}

function selectSpecialMenuItem(aItem) {
  if (aItem.id == "sidebar-search-menuitem-engines")
    OpenSearchEngineManager();

  else if (aItem.id == "sidebar-search-menuitem-categories")
    window.openDialog("chrome://searchSidebar/content/category-editor.xul",
                      "searchSidebar:category-editor", "centerscreen,chrome,resizable");

  else if (aItem.id == "sidebar-search-menuitem-rules")
    window.openDialog("chrome://searchSidebar/content/search-rule-editor.xul",
                      "searchSidebar:search-rule-editor",
                      "centerscreen,all,resizable,dialog=no", Services.search.currentEngine.name);
}

function doSearch() {
  var textValue = gTextbox.value;

  // The last query has to persist when closing and reopening sidebar, but not on startup
  // So we can't use persist mechanism, but have to remember the value in our singletone service
  if (!isPB)
    gSearchPanelService.setLastQuery(textValue);

  if (!textValue) {
    alert(gSearchBundle.getString("enterstring"));
    return;
  }

  // Save the current value in the form history (shared with the search bar)
  // except when in Private Browsing mode.
  if (textValue && !isPB) {
    FormHistory.update({
      op: "bump",
      fieldname: "searchbar-history",
      value: textValue
    }, {
      handleError: function(aError) {
        Cu.reportError("Saving search to form history failed: " + aError.message);
      }
    });
  }

  let engine = Services.search.currentEngine;
  if (gAdvancedMode) {
    let engines = [];
    for (let i = 0; i < gEngineList.itemCount; i++) {
      let item = gEngineList.getItemAtIndex(i);
      if (item.checked)
        engines.push(item.engine);
    }

    if (engines.length == 1)
      // Only one engine checked
      // Proceed as in basic mode, but use the checked engine as current
      engine = engines[0];
    else if (engines.length > 1) {
      // Multiple engines selected. Open multi-search UI
      openMultiSearch(textValue, engines);
      return;
    }
  }

//  var where = Services.prefs.getBoolPref("browser.search.openintab") ? "tab" : "current";
  var submission = engine.getSubmission(textValue);
  openUILinkIn(submission.uri.spec, "current", null, submission.postData);

  if (!isPB)
    gTreeDeck.selectedIndex = 0;
}

function openMultiSearch(aQuery, aEngines) {
//  var where = Services.prefs.getBoolPref("browser.search.openintab") ? "tab" : "current";

  // Just open the multi-search page with some arguments. The actual search will be done from there
  let url = "about:search";
  url += "?q=" + aQuery;
  url += "&e=";
  aEngines.forEach(engine => {
    url += engine.name + ";";
  });
  url = url.substring(0, url.length - 1);
  openUILinkIn(url, "current");
  //The URL will look like:
  // about:search?q=<query>&e=<engine;engine;engine>

  if (!isPB)
    gTreeDeck.selectedIndex = 0;
}

function updateResults() {
  let res = gSearchPanelService.getCurrentResults();

  if (!res.results || res.results.length == 0)
    return;

  // Search results tree even in advanced mode
  gTreeDeck.selectedIndex = 0;

  gResultView.setResults(res.results);
  gResultView.selection.clearSelection();
  gPrevButton.href = res.prevUrl;
  gNextButton.href = res.nextUrl;
  gPrevButton.disabled = !gPrevButton.href;
  gNextButton.disabled = !gNextButton.href;
  gQueryUrl = res.queryUrl;
  gQueryTitle = res.queryTitle;
}

function onTextboxInput() {
  gSearchButton.disabled = !gTextbox.value;
}

function onResultTreeClick(aEvent) {
  let result = getResultAt(gResultTree, gResultView, aEvent);
  if (!result)
    return;

  // Skip right click
  if (aEvent.button == 2)
    return;

  openUILink(result.href, aEvent);
}

function onResultTooltipShowing(aEvent) {
  let result = getResultAt(gResultTree, gResultView, aEvent);
  document.getElementById("sidebar-search-result-tooltip").hidden = !result;
  if (!result)
    return;

  document.getElementById("search-tooltip-title").value = result.title;
  document.getElementById("search-tooltip-link").value = result.href;
  document.getElementById("search-tooltip-description").textContent = result.description;
}

function sortTree(aCol) {
  res = aCol.id;
  dir = SORT_DIRECTIONS.indexOf(aCol.getAttribute("sortDirection")) - 1;
  dir = (dir == 1) ? -1 : ((dir == -1) ? 0 : 1);

  gResultTree.setAttribute("sortResource", res);
  gResultTree.setAttribute("sortDirection", SORT_DIRECTIONS[dir + 1]);

  let cols = gResultTree.getElementsByTagName("treecol");
  for (let i = 0; i < cols.length; i++)
    cols[i].removeAttribute("sortDirection");

  gResultView.sort(res, dir);

  aCol.setAttribute("sortDirection", SORT_DIRECTIONS[dir + 1])
}

function onResultTreeMouseMove(aEvent) {
  let result = getResultAt(gResultTree, gResultView, aEvent);

  if (!window.top.XULBrowserWindow)
    return;

  window.top.XULBrowserWindow.setOverLink(result ? result.href : "", null);
}

function onEngineChecked(aEvent) {
  if (aEvent.target.checked)
    SearchEngineSelection.selectEngine(gCurrentCategory, aEvent.target.engine);
  else
    SearchEngineSelection.deselectEngine(gCurrentCategory, aEvent.target.engine);
}

function onResultContextMenuShowing(aEvent) {
  let result = getResultAt(gResultTree, gResultView, aEvent);
  let empty = SearchBlacklist.isEmpty();

  document.getElementById("sidebar-search-result-context").result = result;

  document.getElementById("search-context-bookmarkQuery").disabled = !gQueryUrl;

  document.getElementById("search-context-excludeUrl-sep").hidden = !result;
  document.getElementById("search-context-excludeUrl").hidden = !result;
  document.getElementById("search-context-excludeDomain").hidden = !result;

  document.getElementById("search-context-clearFilters-sep").hidden = empty;
  document.getElementById("search-context-clearFilters").hidden = empty;

  document.getElementById("search-context-enableAdvanced").hidden = gAdvancedMode;
  document.getElementById("search-context-disableAdvanced").hidden = !gAdvancedMode;
}

function onResultContextMenuCommand(aEvent) {
  let result = document.getElementById("sidebar-search-result-context").result;
  switch(aEvent.target.id) {
    case "search-context-bookmarkQuery":
      addBookmark(gQueryUrl, gQueryTitle);
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
    case "search-context-enableAdvanced":
      gPrefs.setBoolPref(PREF_ADVANCED_MODE, true);
      setMode(true);
      gTreeDeck.selectedIndex = 0;
      break;
    case "search-context-disableAdvanced":
      gPrefs.setBoolPref(PREF_ADVANCED_MODE, false);
      setMode(false);
      break;
  }
}

function onEngineContextMenuShowing(aEvent) {
  let name = aEvent.target.triggerNode.localName;
  if (name != "listitem" && name != "listbox")
    return aEvent.preventDefault();

  document.getElementById("search-engine-context-setAsDefault").hidden = name != "listitem";
  document.getElementById("search-engine-context-setAsDefault-sep").hidden = name != "listitem";

  document.getElementById("search-engine-context-enableAdvanced").hidden = gAdvancedMode;
  document.getElementById("search-engine-context-disableAdvanced").hidden = !gAdvancedMode;
}

function onEngineContextMenuCommand(aEvent) {
  let engine = document.getElementById("sidebar-search-engine-context").triggerNode.engine;

  switch(aEvent.target.id) {
    case "search-engine-context-setAsDefault":
      Services.search.currentEngine = engine;
      Services.search.defaultEngine = engine;
      break;
    case "search-engine-context-enableAdvanced":
      gPrefs.setBoolPref(PREF_ADVANCED_MODE, true);
      setMode(true);
      gTreeDeck.selectedIndex = 0;
      break;
    case "search-engine-context-disableAdvanced":
      gPrefs.setBoolPref(PREF_ADVANCED_MODE, false);
      setMode(false);
      break;
  }
}

var engineObserver = {
  QueryInterface: XPCOMUtils.generateQI([Ci.nsIObserver, Ci.nsISupportsWeakReference]),

  observe: function(aEngine, aTopic, aVerb) {
    if (aTopic == SEARCH_ENGINE_TOPIC) {
      if (aVerb == "engine-current")
        return;
      // Right now, always just rebuild the list after any modification.
      LoadEngineList();

      // Also rebuild engine list in advanced mode
      reloadCategory();
    }
  }
};

var resultsObserver = {
  observe: function(aSubject, aTopic, aData) {
    if (aData == "started")
      gTreeDeck.selectedIndex = 0;
    else
      updateResults();
  }
};

var categoryObserver = {
  observe: function(aSubject, aTopic, aData) {
    loadCategories();
  }
};

var blacklistObserver = {
  observe: function(aSubject, aTopic, aData) {
    gResultView.refreshFilter();
  }
};

var prefObserver = {
  observe: function(aSubject, aTopic, aData) {
    if (aData == PREF_ADVANCED_MODE)
      setMode(gPrefs.getBoolPref(PREF_ADVANCED_MODE));
  }
};
