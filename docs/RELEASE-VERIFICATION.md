# Release verification — 22 October 2026

Status: verification has found and fixed concrete bugs; universal artwork coverage, external release installation and native Mac execution are still open release gates. No final Windows or Mac export was created.

## Verified behavior

Production TypeScript/Vite/Electron build passed. All 85 launcher tests and 10 account-service tests passed. Isolated Electron/browser checks passed all eight main pages, Updates and unread notifications, admin release editing, registration/approval/revocation/password recovery, settings persistence, installed/owned/saved states, native launch and duplicate-launch prevention, measured/persisted playtime, Recently Played, Home discovery rotation, filters/pagination, tray/reopening, managed uninstall, completed-install detection, and restart recovery. Fixtures use harmless OS programs and generated payloads.

All 99 Coming Soon and 96 Top Sellers card images decoded in the running app. Additional live checks covered Home, All Games, Steam Library and Library. Tests now accept valid cached Steam portraits as well as CDN portraits; the Home fixture follows the ranked recommendation rule.

Download tests transferred exact bytes through direct HTTPS fixtures, direct torrent peers, a UDP tracker and an Electron file-host fixture. Pause/resume/Range/restart, checksums, cancellation, queue priority/concurrency, safe ZIP extraction and marker-checked uninstall passed. Six bundled catalogs and 26,115 options import through IPC and persist after restart. The Bloodborne and God of War III source choices reach backend validation without downloading a game.

## Fixed during this audit

Game pages now sample their own cover color instead of inheriting Home's theme. The shared dominant-color algorithm retains the cover hue and darkens it for readable text. Results are cached, async results cannot color a different game, image sampling times out, and missing/unreadable images use a neutral fallback. Tests cover red/blue artwork, switching back, cached artwork and bundled covers. A strict bundled-artwork allowlist and CORS-enabled local image response permit safe canvas sampling without exposing arbitrary files.

Metadata matching now removes trademark symbols before Unicode normalization, ignores accent differences, strips specific DLC/fix suffixes and trailing punctuation, and recognizes verified exact aliases. Sequel/ambiguity checks remain. Saved community metadata stays readable after its source is removed. Added official artwork for 13 Sentinels and 1nsane; unsupported console compatibility is still not claimed.

## Artwork coverage and remaining work

The read-only laptop audit checked every existing cached catalog/chart entry and all 240 local library records: 1217 entries, including duplicate identities across views. Initially 1147 decoded and 70 did not. Retrying metadata with the fixes and checking the recovered images decoded another 37, giving **1184/1217**. These are entries, not a unique-game count. Audit copies were isolated; live user data was not rewritten. New metadata is resolved as games are opened/browsed.

The enabled source catalogs also contain 12123 title groups not present in the visited metadata cache. Their artwork has not been verified. This count uses source title normalization and is not an authoritative count of distinct games. The remaining 33 audited entries are:

- 100% Orange Juice: All Stars Collection
- 112 Operator.2nd Year Anniversary MULTi10
- 1917: The Prologue
- 1998: The Toll Keeper Story – Inflation Edition,
- Glitch Buster Stuck On You MULTi6
- IL-2 Sturmovik: Cliffs of Dover – Blitz Edition
- iRacing Studios NASCAR 26 – Build September 10, 2026 + 2 DLCs
- The Blood of Dawnwalker: Eclipse Edition
- 63 Days 11237
- 7 Skies to Paradise
- 7 Girls War +Unrated
- 7.62 High Calibre Hard Life
- 8-Bit Adventures 1: Bundle
- 9-Bit Armies A Bit Too Far 840817
- 99Vidas: The Definitive Edition
- A Bavarian Tale - Totgeschwiegen
- A D. 2044
- A Game’s Tale
- A Game of Thrones The Board Game MULTi5
- A Game of Thrones: The Board Game
- A Kiss For The Petals – Maidens of Michael
- A Kiss For The Petals – Remembering How We Met
- A Knight’s Quest
- A Little to the Left: Extra Tidy Bundle
- A Rat’s Quest – The Way Back Home | Season 1
- A-GIRL MULTi5
- AaaaaAAaaaAAAaaAAAAaAAAAA!!! Remastered
- Aaero2: Black Razor Edition
- Abaddon: Princess of the Decay
- Above the Snow: The Alpine Bundle
- ABRISS
- God of War All In One Update
- Starbound - Unstable

Local machine reports: artifacts/release-artwork-audit.json (full results, outstanding title inventory and source health), artifacts/missing-artwork-resolution.json (metadata retries). These contain local library information and are intentionally ignored by Git.

## Source health

| Configured source | Loaded options | Automatic refresh | Individual release installs |
|---|---:|---|---|
| SteamRip | 1800 | HTTP 403; loaded catalog retained | Not certified |
| fitgirl | 7189 | HTTP 403; loaded catalog retained | Not certified |
| onlinefix | 2806 | HTTP 403; loaded catalog retained | Not certified |
| DODI | 3071 | HTTP 403; loaded catalog retained | Not certified |
| KaOsKrew | 3561 | HTTP 403; loaded catalog retained | Not certified |
| Kazumi | 2047 | Passed | Not certified |

A refresh challenge is not proof of broken files or installation failure. No source was removed: no repeated source-specific installation failure was established. Removing all five blocked-refresh sources would remove loaded options without evidence that their releases are unusable. For a removed host file, no-seeder torrent, or failed installer, record the source and release; remove/disable the source only after repeat failures across distinct releases are confirmed. Community packages do not implement automatic installation. Host prompts and third-party installers were not bypassed or automatically executed.

## Before final export

1. Resolve the remaining artwork/title ambiguities and set an explicit supported catalog; finish coverage for the currently unvisited source groups.
2. Playtest representative authorized releases from each retained source through actual installation and launch. Validate the chosen common hosted account-service address; the current localhost default requires a service on each machine and is not a public shared backend.
3. Perform an installed Windows two-version update/relaunch/resume test. The local refresh rehearsal passes but does not execute an installer.
4. On a Mac, verify native launch, game compatibility, tray/reopening, paths, credentials and packaging. Architecture/platform checks pass on Windows fixtures; they do not replace Mac hardware testing. macOS automatic launcher replacement is not implemented; Windows-only automatic updating remains explicit.
5. Obtain the user's export signal, then build and verify the Windows/Mac distributables and signing requirements. Existing installer files predate these changes.

## Reproduce

Run npm run build, npm test, npm run test:accounts, node scripts/smoke.mjs, node scripts/verify-artwork-theme.mjs, node scripts/verify-live-artwork.mjs, node scripts/verify-home.mjs, node scripts/verify-covers.mjs, node scripts/verify-cached-covers.mjs, node scripts/verify-filters.mjs, node scripts/verify-background.mjs, node scripts/verify-catalog-import.mjs, node scripts/verify-host-transfer.mjs, node scripts/verify-shutdown.mjs, node scripts/verify-launcher-updates.mjs, node scripts/verify-community-downloads.mjs and node scripts/verify-accounts.mjs. Live-provider checks can fail independently of deterministic tests.

Read-only coverage audit: node scripts/audit-release-artwork.mjs [userData-directory], then node scripts/resolve-missing-artwork.mjs [userData-directory], then node scripts/verify-resolved-artwork.mjs. The default audit directory is this Windows laptop's APPDATA/ember-launcher.

## Artwork provenance

13 Sentinels artwork: https://www.playstation.com/en-us/games/13-sentinels-aegis-rim/ (official social image; bundled JPEG). 1nsane artwork and Windows metadata: https://api.gog.com/products/1207658658 and https://www.gog.com/en/game/1nsane. Existing Bloodborne/God of War artwork was retained. Verified aliases were checked against official Steam/community and publisher pages. Artwork belongs to its respective owner.
