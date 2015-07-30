/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

//Cu.import("resource://gre/modules/Services.jsm");

function OpenSearchEngineManager() {
/*  var window = Services.wm.getMostRecentWindow("Browser:SearchManager");
  if (window)
    window.focus();
  else {
    var arg = { value: false };
    openDialog("chrome://browser/content/search/engineManager.xul",
               "_blank", "chrome,dialog,modal,centerscreen,resizable", arg);
    if (arg.value)
      loadAddSearchEngines();
  }*/
  openPreferences('paneSearch');
}
