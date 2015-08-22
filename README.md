[This SeaMonkey extension restores old-style Search sidebar tab,
complete with search results and multi-engine search.

# Screenshot:
![Screenshot](/screenshot.png?raw=true)

# Features:
 * Replaces default bare-bones Search tab on SeaMonkey;
 * When a search is performed, search results will be gathered and displayed
   in the sidebar;
 * Basic mode provides a search field, search engine selection dropdown and
   results list. Advanced mode drops search engine selection in favor of a
   list containing all search engines which can be checked on or off
   individually;
 * In Advanced mode, categories are used to filter search engines. Additionally,
   checked engines are remembered for each category and for All Engines mode.
 * If a search is performed with more than one engine checked, a Search Results
   tab opens. It contains a large table of results and a dropdown to view each
   results page individually;
 * Search results can be blacklisted by page URL and domain;
 * Search queues can be bookmarked;
 * "Previous" and "Next" buttons at the bottom of the sidebar tab provide means
   to navigate results even with the actual results tab closed;
 * The original implementation only gathered results when a search was performed
   using the Search button, but not when just opening a page with results.
   Unlike the original implementation, this one detects _any_ performed search,
   be it opening a bookmarked page with results, re-opening a closed tab with
   results etc.

# Limitations:
 * "Search rules", the rules by which the extension determines how to retrieve
   results from a loaded web page, must be entered manually for each
   engine. Currently no default rules are provided;
 * Search query can only be remembered if the search was performed through
   sidebar. Otherwise the results will be there, but not the query, since there
   aren't any ways to retrieve the query from an arbitrary search as for now;
 * The results are only refreshed when an actual page is loading. If the engine
   retrieves its results through an AJAX request (without page refreshing),
   you'll have to refresh the page manually.

# Some examples of search rules:
### Google:

Option        | Value
------------- | ---
URL filter    | https?://www.google.com/search
Container     | .g .rc
Title         | .r
Link          | .r
Description   | .st
Preview       | img
Previous page | #pnprev
Next page     | #pnnext

### Yahoo:

Option        | Value
------------- | ---
URL filter    | https://(\w+.)?yahoo.com/search
Container     | .dd.algo
Title         | a
Link          | a
Description   | p
Preview       |
Previous page | .prev
Next page     | .next

### DuckDuckGo:

Option        | Value
------------- | ---
URL filter    | https?://duckduckgo.com/\?q=
Container     | .result__body
Title         | .result__a
Link          | .result__a
Description   | .result__snippet
Preview       |
Previous page |
Next page     |

### YouTube:

Option        | Value
------------- | ---
URL filter    | https?://www.youtube.com/results
Container     | .item-section > li div.yt-lockup
Title         | .yt-uix-tile-link
Link          | .yt-uix-tile-link
Description   | .yt-lockup-description
Preview       | .yt-thumb
Previous page | .yt-uix-button[data-link-type="prev"]
Next page     | .yt-uix-button[data-link-type="next"]

### Wikipedia

Option        | Value
------------- | ---
URL filter    | https?://en.wikipedia.org/w/index.php
Container     | .mw-search-results > li
Title         | .mw-search-result-heading
Link          | .mw-search-result-heading
Description   | .searchresult
Preview       |
Previous page | .mw-prevlink
Next page     | .mw-nextlink
Wikipedia engine is a bit special. When a search is performed and an article
exists of the same name as the search query, the article is loaded directly,
bypassing the search results. In this case search results will _not_ be shown.
In multi-engine search mode, a link to the resulting page will be added to the
table instead.
