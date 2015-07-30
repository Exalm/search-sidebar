/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

this.EXPORTED_SYMBOLS = ["SearchRules"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Services.jsm");

const gJson = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);

const RULES_TOPIC = "searchSidebar:rules-changed";

var gRules = {};

var SearchRules = {};

SearchRules.init = function() {
  let file = getFile();
  if (!file.exists())
    return;

  NetUtil.asyncFetch(file, function (istream, status) {
    if (!Components.isSuccessCode(status))
      return;

    gRules = gJson.decodeFromStream(istream, istream.available());

    // Trim them
    Services.search.init(() => {
      let engines = Services.search.getVisibleEngines().map(engine => {
        return engine.name;
      });

      for (let engine in gRules)
        if (engines.indexOf(engine) < 0)
          delete gRules[engine];
    });
  });
};

SearchRules.getRules = function() {
  return gRules;
}

SearchRules.getRulesForEngine = function(aEngine) {
  if (aEngine && !gRules[aEngine.name])
    gRules[aEngine.name] = {
      urlFilter: "",
      enabled: false,
      selectors: {
        container: "",
        title: "",
        url: "",
        description: "",
        previewUrl: "",
        prevPageUrl: "",
        nextPageUrl: ""
      }
    };

  // Clone the data to avoid in-place editing
  let data = gRules[aEngine.name];
  return {
    urlFilter: data.urlFilter,
    enabled: data.enabled,
    selectors: {
      container: data.selectors.container,
      title: data.selectors.title,
      url: data.selectors.url,
      description: data.selectors.description,
      previewUrl: data.selectors.previewUrl,
      prevPageUrl: data.selectors.prevPageUrl,
      nextPageUrl: data.selectors.nextPageUrl
    }
  };
}

SearchRules.setRulesForEngine = function(aEngine, aData) {
  gRules[aEngine.name] = aData;

  Services.obs.notifyObservers(null, RULES_TOPIC, aEngine);
}

SearchRules.writeToFile = function() {
  var file = getFile();
  var stream = FileUtils.openFileOutputStream(file);

  gJson.encodeToStream(stream, "UTF-8", false, gRules);
  stream.close();
};

function getFile() {
  return FileUtils.getFile("ProfD", ["searchSidebar", "rules.json"]);
}
