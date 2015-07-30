/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

this.EXPORTED_SYMBOLS = ["SearchResultTreeView"];

const Cu = Components.utils;

Cu.import("resource://gre/modules/Services.jsm");
Cu.import("chrome://searchSidebar/content/modules/SearchBlacklist.jsm");

function SearchResultTreeView(aRes, aDir) {
  this.filteredResults = [];
  this.results = [];
  this.unsortedResults = [];
  this.rowCount = 0;
  this.sortResource = aRes;
  this.sortDirection = aDir;
  this.treebox = null;
};

SearchResultTreeView.prototype.getResult = function(aIndex) {
  return this.filteredResults[aIndex];
}

SearchResultTreeView.prototype.getResults = function() {
  return this.results;
}

SearchResultTreeView.prototype.sort = function(aRes, aDir) {
  this.sortResource = aRes;
  this.sortDirection = aDir;
  if (aDir == 0) {
    // Natural scrolling just resets everything;
    this.results = this.unsortedResults.slice();
    this.refreshFilter();
    return;
  }

  function prepare(aValue) {
    if (typeof aValue == "string") {
      return aValue.toLowerCase().trim();
    }

    return aValue;
  }

  this.results.sort((r1, r2) => {
    let f1 = prepare(r1[aRes]);
    let f2 = prepare(r2[aRes]);

    if (f1 < f2)
      return -1 * aDir;
    if (f1 > f2)
      return aDir;

    return 0;
  });

  this.refreshFilter();
}

SearchResultTreeView.prototype.setResults = function(aResults) {
  this.results = aResults.slice();

  // Save a duplicate for natural sorting
  this.unsortedResults = this.results.slice();

  if (this.sortResource && this.sortDirection != 0)
    this.sort(this.sortResource, this.sortDirection);

  this.refreshFilter();
}

SearchResultTreeView.prototype.refreshFilter = function() {
  let origLength = this.filteredResults.length;
  this.filteredResults = SearchBlacklist.filterResults(this.results.slice());
  this.rowCount = this.filteredResults.length;
  this.treebox.rowCountChanged(0, this.filteredResults.length - origLength);
  this.treebox.invalidate();
}

SearchResultTreeView.prototype.addResults = function(aResults) {
  this.setResults(this.results.slice().concat(aResults));
}

SearchResultTreeView.prototype.getCellText = function(aRow, aColumn) {
  return this.filteredResults[aRow][aColumn.id];
};

SearchResultTreeView.prototype.getImageSrc = function(aRow, aColumn) {
  if (aColumn.id == "title")
    return this.filteredResults[aRow].icon;
  return null;
};

SearchResultTreeView.prototype.setTree = function(aTreebox) {
  this.treebox = aTreebox;
};

SearchResultTreeView.prototype.getCellProperties = function(aRow, aColumn) {
  if (aColumn.id == "title")
    return [ "favicon" ];
  return [];
};

SearchResultTreeView.prototype.isEditable = function(aRow, aColumn) { return false; };
SearchResultTreeView.prototype.isContainer = function(aRow) { return false; };
SearchResultTreeView.prototype.isSeparator = function(aRow) { return false; };
SearchResultTreeView.prototype.isSorted = function() { return true; };
SearchResultTreeView.prototype.getLevel = function(aRow) { return 0; };
SearchResultTreeView.prototype.getRowProperties = function(aRow) {};
SearchResultTreeView.prototype.getColumnProperties = function(aColumn) {};
SearchResultTreeView.prototype.cycleHeader = function(aColumn) {};
