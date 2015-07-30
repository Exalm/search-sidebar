/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

this.EXPORTED_SYMBOLS = ["SearchCategories"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Services.jsm");

const gJson = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);
const gUuidGen = Cc["@mozilla.org/uuid-generator;1"].getService(Ci.nsIUUIDGenerator);

const CATEGORIES_TOPIC = "searchSidebar:categories-changed";

var gCategories;

var SearchCategories = {};

SearchCategories.init = function () {
  var file = getFile();
  if (!file.exists()) {
    loadDefaultCategories();
    return;
  }

  NetUtil.asyncFetch(file, function (istream, status) {
    if (!Components.isSuccessCode(status))
      return;

    gCategories = gJson.decodeFromStream(istream, istream.available());
  });
};

SearchCategories.writeToFile = function() {
  var file = getFile();
  var stream = FileUtils.openFileOutputStream(file);

  gJson.encodeToStream(stream, "UTF-8", false, gCategories);
  stream.close();
};

SearchCategories.getCategories = function() {
  return gCategories;
}

SearchCategories.addCategory = function (aName) {
  let category = {
    name: aName,
    engines: []
  };
  let id = gUuidGen.generateUUID().toString();

  gCategories[id] = category;

  Services.obs.notifyObservers(null, CATEGORIES_TOPIC, "");

  return id;
};

SearchCategories.renameCategory = function (aId, aName) {
  gCategories[aId].name = aName;

  Services.obs.notifyObservers(null, CATEGORIES_TOPIC, "");
};

SearchCategories.removeCategory = function (aId) {
  delete gCategories[aId];

  Services.obs.notifyObservers(null, CATEGORIES_TOPIC, "");
};

SearchCategories.addEngines = function (aId, aEngines) {
  aEngines.forEach(engine => {
    if (gCategories[aId].engines.indexOf(engine) < 0)
      gCategories[aId].engines.push(engine);
  });

  Services.obs.notifyObservers(null, CATEGORIES_TOPIC, "");
};

SearchCategories.removeEngines = function (aId, aEngines) {
  aEngines.forEach(engine => {
    let i = gCategories[aId].engines.indexOf(engine);
    gCategories[aId].engines.splice(i, 1);
  });

  Services.obs.notifyObservers(null, CATEGORIES_TOPIC, "");
};

SearchCategories.moveEngines = function (aId, aIndexes, aOffset) {
  aIndexes.sort((i1, i2) => {
    return (aOffset < 0) ? (i1 > i2) : (i1 < i2)
  });

  aIndexes.forEach(i => {
    let tmp = gCategories[aId].engines[i];
    gCategories[aId].engines[i] = gCategories[aId].engines[i + aOffset];
    gCategories[aId].engines[i + aOffset] = tmp;
  });

  Services.obs.notifyObservers(null, CATEGORIES_TOPIC, "");
};

function getFile() {
  return FileUtils.getFile("ProfD", ["searchSidebar", "categories.json"]);
}

function loadDefaultCategories() {
  // SearchSidebar provides some categories by default
  // They are different per locale and per app
  // They are declared as an array of anonymous categories
  let url = "chrome://searchSidebar/locale/default-categories.json";

  NetUtil.asyncFetch(url, function (istream, status) {
    if (!Components.isSuccessCode(status)) {
      return;
    }

    gCategories = {};

    // Load default categories
    let categories = gJson.decodeFromStream(istream, istream.available());

    // Generate ID for each category and add it
    for (let i = 0; i < categories.length; i++) {
      let id = gUuidGen.generateUUID().toString();

      gCategories[id] = categories[i];
    }

    // Some default engines may be hidden, we should not include them
    // Initialize search service and check filter them out
    Services.search.init(() => {
      let engines = Services.search.getVisibleEngines().map(engine => {
        return engine.name;
      });

      for (let id in gCategories)
        gCategories[id].engines = gCategories[id].engines.filter(engine => {
          return engines.indexOf(engine) >= 0;
        });

      // And save them so they don't load each time until the user edits the categories
      SearchCategories.writeToFile();
    });
  });
}
