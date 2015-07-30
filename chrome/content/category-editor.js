/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchCategories.jsm");

const gPrompt = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);

var gSearchBundle;

var gAllEnginesList;
var gCategoriesMenulist;
var gEngineList;

function startup() {
  gSearchBundle = document.getElementById("searchBundle");
  gAllEnginesList = document.getElementById("allengines");
  gCategoriesMenulist = document.getElementById("categoryList");
  gEngineList = document.getElementById("engineList");

  loadEngines();
  refreshCategoryList();
}

function shutdown() {
  SearchCategories.writeToFile();
}

function loadEngines() {
  var engines = Services.search.getVisibleEngines();

  engines.forEach(engine => {
    let listitem = gAllEnginesList.appendItem(engine.name, engine.name);
    listitem.setAttribute("class", "listitem-iconic");
    if (engine.iconURI)
      listitem.setAttribute("image", engine.iconURI.spec);
  });

  document.getElementById("add-button").disabled = engines.length == 0;
}

function refreshCategoryList(aValue) {
  gCategoriesMenulist.removeAllItems();

  let categories = SearchCategories.getCategories();
  for (let id in categories) {
    let category = categories[id];
    let menuitem = gCategoriesMenulist.appendItem(category.name, id);
    menuitem.category = category;
  }

  if (aValue)
    gCategoriesMenulist.value = aValue;
  else
    gCategoriesMenulist.selectedIndex = 0;

  let empty = categories.length == 0;

  document.getElementById("rename-category-button").disabled = empty;
  document.getElementById("remove-category-button").disabled = empty;
  refreshEngineList();
}

function refreshEngineList(aIndex = 0) {
  //Clear category engine list
  while (gEngineList.itemCount > 0)
    gEngineList.removeItemAt(0);

  if (gCategoriesMenulist.itemCount == 0) {
    document.getElementById("remove-button").disabled = true;
    return;
  }

  let category = gCategoriesMenulist.selectedItem.category;

  let engines = category.engines;

  //and populate it with new engines
  for (let i = 0; i < engines.length; i++) {
    let engine = Services.search.getEngineByName(engines[i]);
    if (!engine) {
      engines.splice(i, 1);
      i--;
      continue;
    }

    let listitem = gEngineList.appendItem(engine.name, engine.name);
    listitem.setAttribute("class", "listitem-iconic");
    if (engine.iconURI)
      listitem.setAttribute("image", engine.iconURI.spec);
  }

//  gEngineList.value = engines[(aIndex >= gEngineList.itemCount) ? gEngineList.itemCount - 1 : aIndex];

  document.getElementById("remove-button").disabled = engines.length == 0;
}

function newCategory() {
  const prompt = gSearchBundle.getString("NewCategoryPrompt");
  const newTitle = gSearchBundle.getString("NewCategoryTitle");

  var result = {
    value: null
  };
  var confirmed = gPrompt.prompt(window, newTitle, prompt, result, null, { value: 0 });
  if (!confirmed || (!result.value) || result.value == "")
    return;

  var newCat = SearchCategories.addCategory(result.value);
  refreshCategoryList(newCat);
}

function renameCategory() {
  var current = gCategoriesMenulist.selectedItem.category;
  var currentId = gCategoriesMenulist.value;

  const prompt = gSearchBundle.getString("RenameCategoryPrompt");
  const renameTitle = gSearchBundle.getString("RenameCategoryTitle");

  var result = {
    value: current.name
  };
  var confirmed = gPrompt.prompt(window, renameTitle, prompt, result, null, { value:0 });
  if (!confirmed || (!result.value) || (result.value == "") || result.value == current.name)
    return;

  SearchCategories.renameCategory(currentId, result.value);
  refreshCategoryList(currentId);
}

function removeCategory() {
  var currentId = gCategoriesMenulist.value;

  const removeTitle = gSearchBundle.getString("RemoveCategoryTitle");
  const prompt = gSearchBundle.getString("RemoveCategoryPrompt");
  const yes = gSearchBundle.getString("RemoveCategoryYes");

  var flags = ((gPrompt.BUTTON_TITLE_IS_STRING * gPrompt.BUTTON_POS_0) +
               (gPrompt.BUTTON_TITLE_CANCEL * gPrompt.BUTTON_POS_1) +
                gPrompt.BUTTON_POS_1_DEFAULT);
  if (!gPrompt.confirmEx(window, removeTitle, prompt, flags, yes, null, null, null, { value: 0 }) == 0)
    return;

  SearchCategories.removeCategory(currentId);
  refreshCategoryList();
}

function addEngines() {
  let engines = gAllEnginesList.selectedItems.map(item => {
    return item.value;
  });

  let currentId = gCategoriesMenulist.value;

  let length = gEngineList.itemCount;

  SearchCategories.addEngines(currentId, engines);
  refreshEngineList();

  gEngineList.clearSelection();

  for (let i = length; i < gEngineList.itemCount; i++)
    gEngineList.addItemToSelection(gEngineList.getItemAtIndex(i));
}

function removeEngines() {
  let engines = gEngineList.selectedItems.map(item => {
    return item.value;
  });

  let currentId = gCategoriesMenulist.value;

  SearchCategories.removeEngines(currentId, engines);
  refreshEngineList(gEngineList.selectedIndex);
}

function checkMoveButtons() {
  let indexes = gEngineList.selectedItems.map(item => {
    return gEngineList.getIndexOfItem(item)
  });

  if (gEngineList.selectedCount == 0) {
    document.getElementById("up").disabled = true;
    document.getElementById("down").disabled = true;
    return;
  }

  document.getElementById("up").disabled = indexes.some(index => {
    return index <= 0
  });
  document.getElementById("down").disabled = indexes.some(index => {
    return index < 0 || index == gEngineList.itemCount - 1
  });
}

function moveEngines(aOffset) {
  let currentId = gCategoriesMenulist.value;

  let indexes = gEngineList.selectedItems.map(item => {
    return gEngineList.getIndexOfItem(item)
  });

  SearchCategories.moveEngines(currentId, indexes, aOffset);

  refreshEngineList();
  gEngineList.clearSelection();

  indexes.forEach(index => {
    gEngineList.addItemToSelection(gEngineList.getItemAtIndex(index + aOffset));
  });
}
