/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

this.EXPORTED_SYMBOLS = ["SearchBlacklist"];

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

Cu.import("resource://gre/modules/FileUtils.jsm");
Cu.import("resource://gre/modules/NetUtil.jsm");
Cu.import("resource://gre/modules/Services.jsm");

const gJson = Cc["@mozilla.org/dom/json;1"].createInstance(Ci.nsIJSON);

const BLACKLIST_TOPIC = "searchSidebar:blacklist-changed";

var gUrlBlacklist = [], gDomainBlacklist = [];

var SearchBlacklist = {};

SearchBlacklist.init = function() {
  var file = getFile();
  if (!file.exists())
    return;

  NetUtil.asyncFetch(file, function (istream, status) {
    if (!Components.isSuccessCode(status))
      return;

    let lists = gJson.decodeFromStream(istream, istream.available());
    gUrlBlacklist = lists.urlBlacklist;
    gDomainBlacklist = lists.domainBlacklist;
  });
};

SearchBlacklist.writeToFile = function() {
  var file = getFile();
  var stream = FileUtils.openFileOutputStream(file);

  gJson.encodeToStream(stream, "UTF-8", false, {
    urlBlacklist: gUrlBlacklist,
    domainBlacklist: gDomainBlacklist
  });
  stream.close();
};

SearchBlacklist.excludeUrl = function(aResult) {
  if (gUrlBlacklist.indexOf(aResult.href) < 0)
    gUrlBlacklist.push(aResult.href);

  SearchBlacklist.writeToFile();
  Services.obs.notifyObservers(null, BLACKLIST_TOPIC, "");
};

SearchBlacklist.excludeDomain = function(aResult) {
  if (gDomainBlacklist.indexOf(aResult.site) < 0)
    gDomainBlacklist.push(aResult.site);

  SearchBlacklist.writeToFile();
  Services.obs.notifyObservers(null, BLACKLIST_TOPIC, "");
};

SearchBlacklist.clear = function() {
  gUrlBlacklist = [];
  gDomainBlacklist = [];

  SearchBlacklist.writeToFile();
  Services.obs.notifyObservers(null, BLACKLIST_TOPIC, "");
};

SearchBlacklist.isEmpty = function() {
  return gUrlBlacklist.length == 0 && gDomainBlacklist.length == 0;
};

SearchBlacklist.filterResults = function(aResults) {
  return aResults.filter(result => {
    return gUrlBlacklist.indexOf(result.href) < 0 &&
           gDomainBlacklist.indexOf(result.site) < 0;
  });
};

function getFile() {
  return FileUtils.getFile("ProfD", ["searchSidebar", "blacklist.json"]);
}
