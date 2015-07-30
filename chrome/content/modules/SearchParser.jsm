/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

this.EXPORTED_SYMBOLS = ["SearchParser"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchRules.jsm");

const XMLHttpRequest = Components.Constructor("@mozilla.org/xmlextras/xmlhttprequest;1", "nsIXMLHttpRequest");

var SearchParser = {};

SearchParser.findEngineForUrl = function(aUrl) {
  var result = "";

  let rules = SearchRules.getRules();
  for (let engine in rules) {
    let filter = rules[engine].urlFilter;

    // Match using regex
    if (filter && aUrl.search(filter) >= 0)
      return Services.search.getEngineByName(engine);
  }
};

SearchParser.parseDocument = function(aDocument, aEngine) {
  var data = SearchRules.getRulesForEngine(aEngine);
  var containers = data.selectors.container ? aDocument.querySelectorAll(data.selectors.container) : [];

  var results = [];
  for (var i = 0; i < containers.length; i++) {
    let container = containers[i];
    let titleElement =       data.selectors.title ?       container.querySelector(data.selectors.title) :       null;
    let linkElement =        data.selectors.url ?         container.querySelector(data.selectors.url) :         null;
    let descriptionElement = data.selectors.description ? container.querySelector(data.selectors.description) : null;
    let previewElement =     data.selectors.previewUrl ?  container.querySelector(data.selectors.previewUrl) :  null;

    let absURL = linkElement ? makeURLAbsolute(aDocument.URL, findLink(linkElement), null) : "";
    let absPreview = previewElement ? makeURLAbsolute(aDocument.URL, findImage(previewElement), null) : "";
    let iconURL = aEngine.iconURI ? aEngine.iconURI.spec : null;

    let result = {
      href : decodeURI(absURL),
      title : titleElement ? gatherTextUnder(titleElement) : "",
      description : descriptionElement ? gatherTextUnder(descriptionElement) : "",
      icon : iconURL,
      site : Services.eTLD.getBaseDomain(Services.io.newURI(absURL, null, null)),
      preview : decodeURI(absPreview),
      ranking : i + 1,
      engine : aEngine.name
    };

    results.push(result);
  }

  let prevUrl = null;
  let nextUrl = null;

  if (data.selectors.prevPageUrl) {
    let element = aDocument.querySelector(data.selectors.prevPageUrl);
    if (element)
      prevUrl = makeURLAbsolute(aDocument.URL, findLink(element));
  }
  if (data.selectors.nextPageUrl) {
    let element = aDocument.querySelector(data.selectors.nextPageUrl);
    if (element)
      nextUrl = makeURLAbsolute(aDocument.URL, findLink(element));
  }

  return {
    results: results,
    prevUrl: prevUrl,
    nextUrl: nextUrl,
    queryUrl: aDocument.URL,
    queryTitle: aDocument.title
  };
};

// Helper functions

function gatherTextUnder(root) {
  var text = "";
  var node = root.firstChild;
  var depth = 1;
  while (node && depth > 0) {
    if (node.nodeType == 3)
      text += " " + node.data;
    else if (typeof node == "HTMLImageElement") {
      var altText = node.getAttribute( "alt" );
      if (altText && altText != "")
        text += " " + altText;
    }
    if (node.hasChildNodes()) {
      node = node.firstChild;
      depth++;
    } else {
      if (node.nextSibling) {
        node = node.nextSibling;
      } else {
        while (node && depth > 0) {
          node = node.parentNode;
          depth--;
          if (node.nextSibling) {
            node = node.nextSibling;
            break;
          }
        }
      }
    }
  }
  return text.trim().replace(/\s+/g, " ");
}

function findLink(aNode) {
  if (aNode.localName == "a")
    return aNode.href;
  return aNode.getElementsByTagName("a")[0].href;
}

function findImage(aNode) {
  if (aNode.localName == "img")
    return aNode.src;
  return aNode.getElementsByTagName("img")[0].src;
}

function makeURLAbsolute(aBaseUrl, aUrl) {
  let base = Services.io.newURI(aBaseUrl, null, null);
  return Services.io.newURI(aUrl, null, base).spec;
}
