# Ember 2.0 alpha acceptance / progress — 2026-10-19

Implemented directly in the existing Electron/React project. Windows build and isolated desktop validation have run. This is an alpha; the rows below distinguish implemented behavior from tests still needing real accounts/hardware.

| Area | Implementation and evidence | Remaining validation / limits |
| --- | --- | --- |
| Navigation | All eight exact pages, Home startup, transitions, no store section; Electron smoke passed | Visual screenshots inspected on Windows |
| Steam Library | Owned API snapshot intersected with actual installed manifests/directories; 30-second multi-root scanning | Live account ownership sync needs the user's API key; no claim that a manifest is ownership |
| Combined library | Persistent owned/installed/saved/manual/managed records; known identities merged; editing, filters, grid/list | Manual entries without a shared ID cannot be reliably identified as the same commercial game |
| Playtime / achievements | Existing Steam cached statistics, icons, public descriptions/Deck retained; measured direct process runtime | Steam client sessions are not process-tracked by Ember; unavailable account data stays unavailable |
| Catalog | Live 2026-10-19 check: Dota 2 metadata/reviews/platforms, 19 eligible Portal-search entries, 24 genuinely upcoming entries | Store endpoints are not a guaranteed complete index. Tags/wishlist indicators unavailable; no fabricated substitutes |
| Quality / content | Configurable review threshold/sample floor; explicit descriptors and uncertain classifications excluded | No reliable asset-flip/spam classifier; review quality is a proxy, not a judgment about every title |
| Rankings | Live source returned 98 usable games; source positions preserved across omitted rows; hourly refresh/cache/countdown | Full 100-game coverage and reporting window unavailable from the current response; UI labels this |
| Downloads | Real local HTTP fixtures passed byte count, Range resume, restart recovery, ignored Range restart, invalid Range, checksum failure and cancel | Real third-party packages and external installers need publisher feeds and user consent |
| Install / uninstall | Staged ZIP fixture extraction, symlink/path bounds, executable preflight and ownership-marker uninstall | Mac signed bundles with symlinks require native installers; no claim of game compatibility from extraction |
| Native platforms | Windows harmless process launch, duplicate guard, persisted time; PE/Mach-O checking; Mac Windows-only blocking | Actual Mac packaging, Keychain, Steam launch and gameplay not run on Mac hardware |
| UI scale | Paged metadata fetch, image lazy loading, offscreen rendering containment | Full DOM virtualization, bandwidth caps and update/repair orchestration are not implemented |

Run `npm test`, `npm run build`, `npm run smoke`; live service check: `npx tsx scripts/verify-catalog.ts`. Tests use fixtures only; fixtures are never shipped as library games. Old Wine-specific tests were removed along with the obsolete runtime modules.

New production dependency: `yauzl` for streamed ZIP extraction. Dev dependencies: `yazl` for authored ZIP fixtures and their TypeScript definitions. Existing Electron/React/Vite stack retained. No compatibility runtimes or third-party game binaries bundled.

Changed areas: `desktop/main.ts`, `platform.ts`, `mac.ts`, `steam.ts`, `library.ts`, preload; `src/main.tsx`, types and styling; tests/smoke; documentation. New services: catalog, ownership, HTTPS, sources, state, downloads, installations; shared recommendations and v2 contracts. Native-only runtime removes the old graphics/policy/setup modules.

Release is unsigned. Do not claim Windows/macOS game compatibility, verified live user ownership, a complete Top 100, or publisher package success until those specific paths are tested.

## Final validation recorded

- TypeScript, Vite and Electron bundle build: passed.
- Automated suite: **35 passed, 0 failed** (obsolete Wine tests removed).
- Electron smoke: all eight pages, owned+installed filtering, saved-not-owned status, harmless native launch, duplicate guard, persisted playtime, editing, preferences and restart: passed.
- Read-only local Steam integration: **22 installed games**, **20 with cached playtime**, **17 with achievement icons**, **22 official descriptions**, **22 Deck fields**. Zero verified-owned entries without account credentials, as required. No Steam game was launched by these tests.
- Live catalog: 24 eligible upcoming games, 19 eligible Portal search results, actual Dota 2 reviews/platforms; top-seller feed returned 98 usable app entries. Captured in artifacts/catalog-live.json.
- Visual inspection: Home, Settings, Downloads and actual imported library screenshots; corrected legacy layout offsets and screenshot animation timing.
- Windows portable packaging: passed. Packaged `release/win-unpacked/Ember.exe` also passed the complete isolated desktop smoke and restart checks. Portable distribution: `release/Ember 2.0.0-alpha.1.exe`. Source transfer: `handoff/Ember-2.0.0-alpha.1-source.zip`.

## Home fixes — 2.0.0-alpha.2

- Permit validated Steam CDN image subdomains in the image CSP; use existing local game artwork in recommendations and render a clean fallback after an image failure.
- Reset legacy absolute positioning for card Play actions so no card button floats over the header.
- Filter recommendations by all available Steam/Ember play-history evidence, independent of ownership. Never label a played game as a new discovery. Record Steam launch requests separately from measured playtime so requesting a launch excludes it from new discoveries without inventing a session duration.
- Alternate desktop startups between the latest played installed game and rotating unplayed library games (catalog fallback when needed). If no unplayed candidate exists, keep the recent-game label; do not rebrand it as discovery.
- Validation: 38 tests passed, desktop smoke passed, live Steam CDN image loaded, forced image failure produced a fallback, card actions remained inside their cards, and actual restart alternation passed (`node scripts/verify-home.mjs`).

## Steam Library correction — 2.0.0-alpha.3

The latest user request supersedes the earlier installed-only Steam Library specification. Steam Library now lists every verified-owned Steam game returned by account synchronization, including uninstalled games. Installed and Not Installed filters remain available. Uninstalled owned cards offer Install in Steam; saved/unowned games remain excluded. Steam still performs platform validation, authentication and installation.

Validation: build passed; Electron regression checks passed for installed and uninstalled owned entries, both status filters, exclusion of unowned installations/bookmarks, and Install-versus-Play actions. The full desktop launch/edit/persistence smoke also passed. No real game installation was initiated by these tests.

## Steam portrait artwork — 2.0.0-alpha.4

All Steam game cards now resolve portrait library capsules directly from App IDs, whether installed or uninstalled and even before catalog metadata is available. Local cached portraits remain first choice; Steam portrait JPG/PNG and legacy CDN locations provide fallbacks. Store header banners are no longer stretched/cropped into cover cards. Landscape images are rejected, and card proportions match Steam's 2:3 portrait format.

Validation: 40 tests passed. A live Electron test loaded Steam portraits for ARC Raiders, Another Crab's Treasure and Batman - The Telltale Series with empty catalog metadata and no installed files; each returned a genuine 300×450 portrait. Screenshot inspected. The normal desktop smoke also passed.

## Remaining cached Steam covers — 2.0.0-alpha.5

Steam artwork synchronization now imports cover/banner/logo assets for every library game, not just installed manifests. This includes modern hashed Steam cache directories containing library_capsule.jpg and hashed library_600x900.jpg. Cached portraits take precedence over generic web assets. Added modern library_capsule JPG/PNG web fallbacks as well.

Verified in Electron against read-only local Steam cache: 007 First Light, Battlefield 6, CONTROL Resonant and Call of Duty Modern Warfare 4 Beta all loaded genuine 300×450 portraits while marked uninstalled, with no catalog metadata. All 41 tests and desktop smoke passed. Artwork refresh runs automatically at startup and through Refresh Steam. Steam's source files are not modified.

## Game details and dashboard cleanup — 2.0.0-alpha.6

Steam refresh now checks installed and uninstalled library entries. Explicit unavailable/non-game store responses hide entries from the dashboard/library without deleting records or game files; later successful refreshes restore them. Transport errors and malformed responses do not hide entries. Regional unavailability can also produce an unavailable store response.

Opening a Steam game requests achievement definitions/icons and player progress through Valve's GetSchemaForGame and GetPlayerAchievements APIs using the already encrypted connected key. Results are cached for one hour; Refresh achievements retries immediately. Private/unavailable progress remains unknown, not locked. Failed requests retain cached details. Switching connected accounts clears prior account statistics.

Screenshots open an animated full-window dialog with side arrows, left/right keyboard navigation, wraparound, Escape/close, focus trapping, reduced-motion support and image-error feedback.

Validation: 45 tests passed (including online schema/progress joining, private progress, offline retention and unavailable response classification); Electron smoke covers gallery open/navigation/wraparound/Escape and all existing launcher flows. Online achievements were validated using controlled API fixtures, not a successful live account response. Mac hardware remains untested.

Run: npm ci, npm run build, npm test, npm run smoke, npm start. Packaged Windows build: release/Ember 2.0.0-alpha.6.exe. Open the new executable, use Refresh Steam to rescan listings, then open a game's details. If achievements remain unavailable, check the Steam account connection and profile privacy; use Refresh achievements.

## Unsaved discoveries — 2.0.0-alpha.7

Library membership now requires ownership, installation, a local entry, or an active saved flag. Previously unsaved discoveries are filtered immediately on opening this version, without requiring another unsave. Unsaved, unowned and uninstalled Steam discoveries are also excluded from Home hero selection and recommendations, while remaining searchable in the public catalog. Their retained record preserves the dismissal across restarts. Saving again restores membership; owned/installed games remain in the library when unsaved. Unsaving no longer requires a successful online metadata lookup.

Validation: 46 unit/integration tests passed. Electron smoke verifies unsaving a discovery removes its card immediately and remains removed after restarting, alongside existing launch, gallery and persistence checks. Run npm run build, npm test, npm run smoke. Windows executable: release/Ember 2.0.0-alpha.7.exe.

## Download source picker and real transfer integration — 2.0.0-alpha.8

Added Download → Save to library → View on Steam ordering, searchable animated source dialog, game-page progress link, editable JSON feed settings and one-time default registration. Distinct SteamRIP/OnlineFix endpoints replace the duplicate FitGirl URLs with user authorization. Source fallbacks and actual loaded URLs are visible. Feed formats, archived-data limits and transport behavior are documented in DOWNLOAD-SOURCES.md.

WebTorrent handles magnets with guarded storage, actual byte counters, restart rechecking and cancellation; Electron handles host-page file transfers in an isolated browser session. Existing verified-package downloads remain available. Community files are not automatically installed. 51 automated tests and desktop smoke passed; real harmless torrent and host fixture transfers verified file bytes. Live feed indexes validated. Individual game downloads and Mac hardware remain untested.

### 2.0.0-alpha.9 — Torrent discovery
- Added app-controlled public UDP tracker alongside DHT, peer counts and metadata/stall timeouts.
- 53 tests passed, including tracker-discovered exact-byte transfer and no-peer failure.
- Archived release availability remains dependent on seeders; pictured game not downloaded.


### 2.0.0-alpha.10 — Supplied catalogs and download fixes
- Bundled six full user-supplied catalogs with data-driven names, first-upgrade replacement and local JSON import.
- Removed fallback mirrors; blocked refresh preserves valid loaded data. Added bounded concurrent sync and HTML/403 diagnostics.
- Preserved validated UDP trackers and repaired magnet encoding, host retry and completion state handling.
- 55 tests passed; real host transfer and six-catalog import/restart verified. Counts and limitations documented in DOWNLOAD-SOURCES.md.


### 2.0.0-alpha.11 — Download overhead and picker
- Explicit unlimited torrent bandwidth, 100 peer connections; no guaranteed upstream speed.
- Routine source payload reduced from 24,261,347 to 15,327 bytes in six-catalog test; checkpoints every 15 seconds and immediate terminal save.
- Source refresh errors removed from picker and collapsed in Settings; loaded sources remain selectable.
- Patch/hotfix/update suffix matching repaired; 56 tests pass.


### 2.0.0-alpha.12 — Close/reopen recovery
- Guard second-instance focus against destroyed windows and recreate when appropriate.
- Await host cleanup before exit; defer native cancellation out of Electron callbacks and preserve retryable state.
- Destroyed DownloadItem callbacks retain last counters instead of throwing; shutdown errors handled.
- Regression checks: destroyed-window relaunch, close during torrent discovery/reopen, active host cancellation, normal exact-byte host transfer.


### 2.0.0-alpha.13 — Dashboard, metadata and background installs
- Combined deduplicated source catalog, Ember-only recency, and ranked-list recommendations.
- Exact hashed Steam portraits, legacy/header fallbacks, Steam streaming trailers, genre navigation, and official PlayStation links for the two requested console games.
- Infinite loading across discovery pages, free-game action changes, tray persistence, and conservative completed-install executable detection.
- 61 unit tests pass. Source and packaged Electron smoke/background checks pass; import/restart retains all six catalogs and 26,115 release options.
- Direct SteamDB requests returned HTTP 403; labeled Steam fallback is active. Unmatched catalog identities/artwork remain a coverage limitation. Details: ALPHA13.md.

### 2.0.0-alpha.14 — Supplied ranking snapshots and artwork recovery
- Both user JSON charts bundled with original ordering, 99 products each and retained missing ranks.
- Verified Steam IDs and portrait/header URLs enrich both charts. Non-game products use store actions.
- Removed day-long negative artwork caching; retain verified identities on metadata failure; exact titles outrank edition-normalized DLC matches.
- 65 tests passed. Live Electron image checks passed on six list pages, including all 198 chart images. Details in ALPHA14.md.
