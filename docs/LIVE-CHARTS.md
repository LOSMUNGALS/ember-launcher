# Automatic discovery charts

Top Sellers and Coming Soon now use Steam's public store search lists, using `topsellers` and `popularwishlist`, respectively. Requests specify the Games category, up to 100 rows, English titles and the user's configured Steam region. These are Steam lists, not a live SteamDB global chart; the UI identifies the actual source and region. Console/hardware products are excluded. Existing filters can reduce the number displayed.

The launcher opens using its last saved chart, then checks both lists in the background at startup. While running it checks the refresh schedule every minute, refreshes successful data hourly, and retries unavailable/malformed lists after five minutes. Opening a tab checks whether its list is due. The Refresh list button requests both lists immediately. Duplicate requests share their in-flight fetches.

Successful lists and their timestamp persist in `ember2.json`. Network errors, empty responses and unexpectedly small lists retain the previous chart. A new installation without a saved live list falls back to the supplied SteamDB JSON snapshots. Failed requests do not change the timestamp to falsely suggest that cached data is fresh. Changing region prevents an old request from replacing the new region's data.

Chart membership does not require every game's metadata to load. Titles, initial artwork, original order and stable Steam identities come from the live list; Steam metadata/artwork enrichment continues when viewing each page. A full metadata lookup that confirms a game is already released removes it from Coming Soon results. Old chart entries can remain in the user's library without being reintroduced into filtered Coming Soon results.

Run `npm run dev` for these source changes. Existing installed builds need a new packaged release. No account-server deployment is needed for this feature.

Verification:

- `npm test`: parsing, ordering, cache persistence, offline fallback, refresh/retry timing, concurrent fetches, region changes and catalog integration.
- `node --import tsx scripts/verify-live-charts.mjs`: real Steam requests using an isolated temporary launcher state, with results written to `artifacts/live-chart-verification.json`.
