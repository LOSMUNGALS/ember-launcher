# Update audit — October 25, 2026

Scope: the source update on `codex/initial-import`, including reliability improvements, daily-use tools, account library backup/restore, personalization, versioned/cloud saves, zoom/display sizing and the seven bundled catalogs. Tests use isolated data directories and fixture accounts. Existing installed applications, real save folders and published installers were not replaced.

## Bugs fixed

- **Idle refresh loop:** `displaySettings` was treated as a state-changing action. Its change event triggered another settings read indefinitely. A real login window generated 15,457 events in one second before the fix; the regression window now records only three normal startup events in that interval. Read-only display and diagnostic calls no longer broadcast changes.
- **Duplicate cloud identities:** a Steam entry and a local installation linked to the same Steam App ID could produce duplicate cloud keys and fail server validation. Backup now combines their saved/favorite/hidden flags and collections into one identity, and restore applies the preferences to all matching local entries while preserving each installation path. Conflicting statuses prefer Playing, then Finished, then Backlog. More than 20 combined collections produces an explicit error rather than silently dropping names.
- **Steam launch diagnosis:** Steam installation folders were passed through native executable validation and incorrectly reported as broken. Repair now checks the Steam folder and App ID, explains that Steam manages the executable, and reserves manual executable selection for local games.
- **Personalization settings:** controls now wait for initial settings, show changes immediately while saving, prevent overlapping saves, roll back failed changes, and follow current persisted settings. Invalid input is validated fully before any preference is changed. This prevents partial writes and stale checkbox updates.
- **Save-panel selection race:** delayed results for a previously selected game no longer replace the current game's version list. Newly created local backups remain visible after failed uploads, and a successful upload requires refreshed cloud status before another replacement.
- **Account-session races:** delayed HTTP responses are bound to their originating login/service. Cloud operations also verify their originating session after dialogs and before subsequent requests or queued library restores, preventing old operations from continuing under a replacement login.

Two older verification scripts were corrected to wait for infinite paging to finish and to expect the already-implemented automatic recovery of interrupted downloads. Those were outdated test expectations, not changes to launcher behavior.

## Passed verification

| Area | Evidence |
| --- | --- |
| Compilation and launcher logic | `npm run build`; 116 launcher tests |
| Accounts, approvals/revocation, Feedback, cloud data and migrations | 22 account-service tests, including local SQLite and libSQL adapter fixtures |
| Remembered devices, library tools and search | Real Electron login/restart/logout, encrypted token storage, favorites/collections/hidden state, custom art, typo search and remembered queries |
| Storage and saves | Verified fixture move, backup integrity/corruption checks, upload/download/restore, stale cloud revision rejection, previous-save preservation, rapid game-selection regression |
| Settings and diagnostics | Actual accessibility checkbox interaction, invalid settings rejection without partial mutation, diagnostic draft attachment and redaction |
| Mouse zoom and resolution | Ctrl-wheel, Ctrl-middle-click reset and persistence; 800/1280/1920/simulated-3840 login layouts |
| Downloads and installation reliability | Distinct stages, interrupted installation preservation, executable repair, source diagnostics, working local host transfer and generated local torrent hash verification |
| Background and shutdown | Tray hide/reopen, destroyed-window recreation, completed-install detection and automatic recovery after closing during peer discovery |
| Catalogs | Seven sources and 28,204 parsed options imported through IPC and preserved after restart |
| Steam integration | Live review summary and both live 100-entry chart feeds |
| Artwork | Seven previously affected Steam covers, custom covers and per-game theme/fallback behavior |
| Feedback | Posting, image upload/paste, author/admin-only replies, reader access, labels, deletion and shared images |
| Launcher updates | Controlled update UI/IPC lifecycle, preserved account/version state, release editing/publication and explicit installation request; no real installer executed |
| General app behavior | All-page smoke navigation, native fixture launch, duplicate-launch guard, playtime, editing, preferences and restart persistence |

Commands and scripts are in the existing test suite plus `scripts/verify-idle.mjs`. Detailed local run logs are under the ignored `artifacts/audit-*.txt` files.

## Practical limits

This is a source/Windows development audit. It does not certify every physical monitor or a native Mac package. Public Steam endpoints responded during verification; arbitrary download hosts and torrent swarms were not all downloaded. The controlled torrent fixture proves engine throughput and integrity, not available public-peer speed. Desktop notification display still depends on OS permissions/Do Not Disturb. Cloud service integration was tested with isolated local/hosted-adapter fixtures, not private production accounts. A real installed Windows upgrade still needs a separately built and verified release. These source changes do not silently patch installed launchers.
