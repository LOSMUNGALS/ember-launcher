# Alpha 14 — supplied charts and shared artwork recovery

Coming Soon now uses `data/wishlist-snapshot.json`; Top Sellers uses `data/top-sellers-snapshot.json`. These are copies of the two user-supplied October 21, 2026 files. Each contains 99 products from a top-100 chart, with one omitted rank. Original ordering and rank gaps are preserved. These are fixed snapshots, not live rankings. Top Sellers includes hardware, applications and DLC; those retain store links instead of game downloads.

The enriched `*-resolved.json` files add verified Steam identities and official Steam artwork URLs. All 99 entries in each chart have identities and an image candidate. Portraits are preferred; products without one use the official store header. The input follower values are not represented as wishlist totals.

Artwork recovery applies to the common card component used by Home, All Games, Coming Soon, Top Sellers, Library and Steam Library. Failed community matches no longer remain cached for 24 hours. A later metadata failure retains the already verified Steam ID and its image candidates. Exact title matching takes precedence over edition normalization, preventing Deluxe DLC from making the base title ambiguous. Refreshed card metadata resets failed image candidates.

## Verification

- 65 unit tests pass, including stale negative-cache recovery, retained identity on metadata failure, chart pagination, original ranks, and title ambiguity.
- `verify-live-artwork.mjs` verifies loaded image dimensions in Electron on all six game-list pages. Both complete 99-product charts loaded all images, not just URLs or placeholders. A Bird Story, A Building Full of Cats and A Hat in Time are among the affected titles checked live.
- Existing smoke and background checks cover navigation, saved state, screenshots, installation detection, launch controls, tray behavior and scrolling.

This does not establish artwork coverage for every title in all six download catalogs. Titles without a verifiable Steam match can still require another official source. Remote image availability can change.

Identity references for ambiguous chart names were checked against the SteamDB product links at https://steamdb.info/stats/mostwished/ and https://steamdb.info/stats/globaltopsellers/; artwork came from Steam's StoreBrowse asset response. Dressmaker's store identity is https://store.steampowered.com/app/4019220/Dressmaker/.

Download thumbnails now use the shared image-fallback component, and hero banners have a store-art fallback. Chart actions pass the resolved Steam ID to the source picker and download handler, while preserving the chart's own row identity and rank.
