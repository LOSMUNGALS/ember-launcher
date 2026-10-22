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
2. Add password recovery, verified email and administrator MFA before broader account rollout. Cooldowns currently track recorded identities only.
3. Validate real Steam ownership/achievements with the user's own credentials and game installations on each machine. Fixture success does not prove every provider, torrent or external installer works; availability depends on hosts and peers.
4. Add continuous integration for the launcher tests, account tests and build, followed by Windows Electron smoke coverage. Split optional live-provider checks from deterministic fixture checks.
5. Consider loading media/player code on demand to reduce the current bundle warning, then download bandwidth controls and update/repair orchestration. Updates currently means team announcements, not an automatic launcher/game updater.

Actual desktop hardware, macOS packaging/game execution, signing and production deployment remain unverified here. There is no automatic cross-device library/save synchronization. The existing account UI test requires Microsoft Edge. Historical milestone documents describe earlier alphas; README and alpha.16 account documentation describe current setup.
