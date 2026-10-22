# Laptop verification — 2026-10-22

Baseline: `29db457` on `codex/initial-import`, verified against freshly fetched GitHub refs. This includes account approval, Updates, uninstall and hardware filtering. Existing Electron/React design and features are retained.

## Results

- Node 24.19.0; every declared top-level dependency installed (`npm ls --depth=0`). npm was absent from the agent terminal's PATH but available at `C:\Program Files\nodejs\npm.cmd`.
- All 71 existing launcher tests passed, including direct-peer and UDP tracker transfers, download pause/resume/recovery, extraction/uninstall containment, storage, native launch plans, Steam parsing and hardware chart exclusion.
- All four account service tests passed after adding a regression test. Registration previously allowed `ember-admin` before setup, occupying the unique username and blocking bootstrap. Registration now reserves it case-insensitively.
- TypeScript checking, Vite production build and Electron bundling passed. Vite reports a nonblocking large JavaScript chunk warning (about 853 kB before gzip).
- Account browser/Electron integration passed: local admin website setup, registration, approval, login, admin publishing, safe text rendering, user read-only Updates, managed uninstall, restart persistence and revocation blocking launch.
- Launcher smoke passed: navigation, installed/uninstalled ownership filtering, native harmless process launch, duplicate launch guard, playtime, editing, screenshots, preferences and restart persistence.
- Isolated Electron host transfer passed with exact fixture bytes and real progress.
- Background and shutdown regressions passed: tray close/reopen, destroyed-window recreation, detected install registration, discovery pagination and paused-job restart recovery. Catalog IPC import/restart retained all six catalogs and 26,115 options, with unchanged catalogs omitted from routine snapshots.

Sandboxed runs initially failed on temporary-file access and local network connections. The same tests passed outside those restrictions; these were not launcher regressions. Tests used separate fixture profiles/services and did not create or approve real user accounts.

## Remaining work and recommended order

1. Host one persistent HTTPS account service for shared laptop/desktop accounts and Updates. Local service operation is verified; public deployment is not provisioned by this change.
2. Password recovery is now implemented with Resend configuration required for live delivery; add verified email and administrator MFA before broader account rollout. Cooldowns currently track recorded identities only.
3. Validate real Steam ownership/achievements with the user's own credentials and game installations on each machine. Fixture success does not prove every provider, torrent or external installer works; availability depends on hosts and peers.
4. Add continuous integration for the launcher tests, account tests and build, followed by Windows Electron smoke coverage. Split optional live-provider checks from deterministic fixture checks.
5. Consider loading media/player code on demand to reduce the current bundle warning, then download bandwidth controls and update/repair orchestration. Updates currently means team announcements, not an automatic launcher/game updater.

Actual desktop hardware, macOS packaging/game execution, signing and production deployment remain unverified here. There is no automatic cross-device library/save synchronization. The existing account UI test requires Microsoft Edge. Historical milestone documents describe earlier alphas; README and alpha.16 account documentation describe current setup.

## Password recovery follow-up

Added Resend-backed password recovery on the launcher and admin website, single-use hashed reset tokens with 30-minute expiry, session invalidation and password confirmation. Added eye buttons to launcher and website password fields. Existing-admin setup links now lead to login, including same-tab link navigation, and setup includes an explicit login route. Both account startup commands load private `.env` configuration; no new package is required.

Validation: all 71 launcher tests and seven account/email/HTTP tests passed, production build passed, and expanded browser/Electron coverage verified reset-link emails through an isolated capture adapter, new-password login on both surfaces, password eyes and existing-account login from old setup links. Live Resend delivery still requires the user's API key and verified sender; see ACCOUNTS.md.

## Discovery filter performance

Filtering could hide most cards and leave the infinite-scroll sentinel visible, causing repeated remote catalog pages to load automatically. Active discovery filters now immediately include eligible cached metadata from other pages, deduplicate Steam/feed/chart identities, and show an explicit Load more games button. Unfiltered browsing retains automatic paging. Content/review preferences still apply; uncached metadata needs a network lookup and is not inferred from a title.

Community pages batch persistence into one save, skip unchanged saves, share overlapping metadata lookups, and reuse failed/unmatched lookup results for five minutes before retrying. A source revision clears that short cache. Home selection, genre options and catalog/library indexing no longer recompute on each clock tick.

Validation: 74 launcher tests and seven account tests passed; production build, launcher smoke, background/navigation regression and `node scripts/verify-filters.mjs` passed. The filter fixture proves an off-page cached game appears when selected, genre/platform/review/year filters issue zero extra catalog calls, no automatic page scan occurs while filtered, and explicit pagination still adds games. Backend tests prove a 24-game page saves once and a repeat cached search performs zero network requests or disk writes. This does not guarantee the latency or availability of Steam when loading previously uncached games.

## Launcher updates, release editor and unread announcements

Added the installed-Windows updater, update button/dialog, pause-and-persist handoff, NSIS packaging target, admin release title/version/rich-description editing with draft/publication and safe preview, and per-service/account unread announcement markers. Existing portable builds remain supported. See LAUNCHER-UPDATES.md for publishing and the required two-version installed-upgrade playtest.

Validation: 80 launcher tests and nine account tests passed; TypeScript/Vite/Electron build passed; source browser/Electron update/editor/notification fixture, account UI regression, full launcher smoke and shutdown recovery passed. An unpublished Windows NSIS candidate and its blockmap/update metadata were built successfully. Installer execution/replacement was not performed by the UI fixture and is still a release playtest gate. Production updater dependencies are patched; the existing torrent dependency advisory remains documented separately.
