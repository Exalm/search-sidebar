/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("resource://gre/modules/XPCOMUtils.jsm");
Cu.import("resource:///modules/PlacesUIUtils.jsm");

function removeItemsFromPopup(aPopup, aClass) {
  let items = aPopup.childNodes;
  for (let i = items.length - 1; i >= 0; i--)
    if (items[i].classList.contains(aClass))
      items[i].remove();
}

function insertAfter(aParent, aNewItem, aRefItem) {
  if (aRefItem == aParent.lastItem)
    return aParent.appendChild(aNewItem);

  return aParent.insertBefore(aNewItem, aRefItem.nextSibling);
}

function getResultAt(aTree, aView, aEvent) {
  if (!aEvent)
    return;

  return aView.getResult(aTree.treeBoxObject.getRowAt(aEvent.clientX, aEvent.clientY));
}

function addBookmark(aUrl, aTitle) {
  let uri = Services.io.newURI(aUrl, null, null);

  PlacesUIUtils.showMinimalAddBookmarkUI(uri, aTitle);
}

function onResultDrag(aTree, aView, aEvent) {
  let result = getResultAt(aTree, aView, aEvent);
  if (!result)
    return;

  aEvent.dataTransfer.setData("text/plain", result.href);
  aEvent.dataTransfer.setData("text/x-moz-url", result.href+"\n"+result.title);
}
