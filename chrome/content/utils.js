/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/PlacesUIUtils.jsm");

function getResultAt(aTree, aView, aEvent) {
  if (!aEvent)
    return;

  return aView.getResult(aTree.treeBoxObject.getRowAt(aEvent.clientX, aEvent.clientY));
}

function addBookmark(aUrl, aTitle) {
  let uri = Services.io.newURI(aUrl, null, null);

  // SeaMonkey
  if (PlacesUIUtils.showMinimalAddBookmarkUI) {
    PlacesUIUtils.showMinimalAddBookmarkUI(uri, aTitle);
    return;
  }

  // Firefox
  PlacesUIUtils.showBookmarkDialog({
    action: "add",
    type: "bookmark",
    hiddenRows: [ "description", "location", "keyword", "loadInSidebar" ],
    uri: uri,
    title: aTitle
  }, window.top);
}

function onResultDrag(aTree, aView, aEvent) {
  let result = getResultAt(aTree, aView, aEvent);
  if (!result)
    return;

  aEvent.dataTransfer.setData("text/plain", result.href);
  aEvent.dataTransfer.setData("text/x-moz-url", result.href+"\n"+result.title);
}
