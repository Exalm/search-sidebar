/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

this.EXPORTED_SYMBOLS = ["SearchEngineSelection"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchCategories.jsm");

const gJson = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);

var gSelection = {};

var SearchEngineSelection = {};

SearchEngineSelection.init = function () {
  var file = getFile();
  if (!file.exists())
    return;

  NetUtil.asyncFetch(file, function (istream, status) {
    if (!Components.isSuccessCode(status))
      return;

    gSelection = gJson.decodeFromStream(istream, istream.available());
  });
};

SearchEngineSelection.writeToFile = function() {
  var file = getFile();
  var stream = FileUtils.openFileOutputStream(file);


  let categories = SearchCategories.getCategories();
  // Before we can save the data, we should trim it
  // Some engines and categories may have been deleted, we should
  // delete the data as well
  for (let id in gSelection)
    if (id != "all-engines" && !categories[id])
      delete gSelection[id];

  let engines = Services.search.getVisibleEngines().map(engine => {
    return engine.name;
  });
  for (let id in gSelection)
    gSelection[id].filter(engine => {
      return engines.indexOf(engine) >= 0;
    });

  gJson.encodeToStream(stream, "UTF-8", false, gSelection);
  stream.close();
};

SearchEngineSelection.selectEngine = function(aCategoryId, aEngine) {
  if (!gSelection[aCategoryId])
    gSelection[aCategoryId] = [ aEngine.name ];

  if (gSelection[aCategoryId].indexOf(aEngine.name) < 0)
    gSelection[aCategoryId].push(aEngine.name);

  SearchEngineSelection.writeToFile();
};

SearchEngineSelection.deselectEngine = function(aCategoryId, aEngine) {
  if (!gSelection[aCategoryId])
    return;

  let index = gSelection[aCategoryId].indexOf(aEngine.name);
  if (index >= 0)
    gSelection[aCategoryId].splice(index, 1);

  // If the category selection is empty, we'll just delete it
  if (gSelection[aCategoryId].length == 0)
    delete gSelection[aCategoryId];

  SearchEngineSelection.writeToFile();
};

SearchEngineSelection.getSelectedEngines = function(aCategoryId) {
  if (!gSelection[aCategoryId])
    return [];

  return gSelection[aCategoryId];
};

function getFile() {
  return FileUtils.getFile("ProfD", ["searchSidebar", "selected-engines.json"]);
}
