# Ember 1.0

For shared accounts on both computers, follow the [free Render + Turso setup](docs/TURSO-SETUP.md). Hosted credentials belong only on the account server. The published 1.0.1 release assets are unchanged.

**Ember 1.0 requires the account service.** Run `npm run accounts`, use the one-time setup link to create the administrator password, then open the launcher. The approval website is local at http://127.0.0.1:4783. Existing administrators display as **LOSMUNGALS**, including on previous posts; existing login credentials still work. See [account setup and hosting](docs/ACCOUNTS.md) and [release/update instructions](docs/LAUNCHER-UPDATES.md). Historical alpha documents record the earlier development milestones.

A real Electron + React + TypeScript desktop launcher for Windows 10/11 and native macOS games. This updates the existing Ember project; it does not use MaPC's proprietary interface or redistribute compatibility engines.

**The native-only specification supersedes the earlier Wine milestone: Windows games do not run on Mac through Ember.** Wine, DXVK setup, Epic and GOG navigation/integration have been removed. Existing manually registered games remain local entries.

## Open the launcher

Windows: install `release/Ember-Setup-1.0.0.exe` after `npm run package:installer`, or run the source:

```sh
npm ci
npm run build
npm start
```

Use Node.js 24 LTS. In PowerShell, use `npm.cmd` if local policy blocks `npm.ps1`. `npm run dev` builds and launches Electron; it is not a browser preview. Closing the window keeps Ember in the system tray so downloads, install detection, and directly launched game tracking continue. Use the tray menu → Quit Ember to exit.

Before connecting Steam on a new computer, follow the synchronization workflow below. Source code sync does not transfer accounts, installed games, or device credentials.

## Synchronize laptop and desktop

Use Node.js **24 LTS** on both computers (`.nvmrc` and `package.json` record this requirement). Install Git and Node with npm available on PATH; reopen the terminal after installation. Check `node --version` and `npm --version`. If PowerShell blocks npm, use `npm.cmd`; if it cannot find npm, check the Node installation/PATH (the standard Windows location is `C:\Program Files\nodejs\npm.cmd`).

Before starting work on either computer, commit or stash any local changes, then:

```sh
git fetch origin
git switch codex/initial-import
git pull --ff-only origin codex/initial-import
npm ci
npm run build
npm test
npm run test:accounts
```

In one terminal, run `npm run accounts` and keep it open. On a fresh local database, use the setup link printed in that terminal to create the administrator. In another terminal run `npm start` (or `npm run dev` after code changes). The admin website runs at [http://127.0.0.1:4783](http://127.0.0.1:4783).

Before moving to the other computer:

```sh
npm run build
npm test
npm run test:accounts
npm run smoke
npm run smoke:accounts
git diff
git status
git add <specific-files-you-changed>
git commit -m "Describe the verified change"
git fetch origin
git push origin codex/initial-import
```

If pull or push reports diverging/newer work, integrate and review those commits, resolve conflicts, and rerun checks before pushing. Never force-push or use a hard reset to replace the other computer's work. This is the existing development branch; do not restart the project or copy an old source archive over it.

Git synchronizes source, documentation and the dependency lockfile. Run `npm ci` independently on each device; do not copy `node_modules`, `dist`, `release`, `.account-service`, `.env`, or Electron userData through Git. Steam credentials are encrypted for each device; reconnect them. Game folders, absolute paths, downloads and saves remain device-specific; back up userData before deliberate migration.

Two local account services have **separate accounts and Updates**. To share approvals and announcements between laptop and desktop, configure both launchers to use the same hosted HTTPS account service. GitHub does not host that service. See [account deployment and backups](docs/ACCOUNTS.md); do not sync a running SQLite database through a shared folder.

The account browser smoke test currently uses Microsoft Edge, which must be installed on the Windows test machine. See [laptop verification](docs/LAPTOP-VERIFICATION.md) for current evidence and remaining work.

## Connect Steam

1. Install Steam and sign in normally. In Ember, select **Library → Import Steam** and choose the Steam folder containing `steamapps`. Additional library drives are read from Steam's `libraryfolders.vdf`; registered roots are scanned every 30 seconds.
2. To verify ownership, obtain your own [Steam Web API key](https://steamcommunity.com/dev/apikey), and your 17-digit SteamID64. Enter both under **Settings → Steam account**. Ember never asks for your Steam password. The API key is encrypted using Windows DPAPI/macOS Keychain through Electron safeStorage and stays out of renderer snapshots.
3. Steam's API must be able to read the account's Game details. If verification fails, check privacy, credentials and connectivity. Local installation records alone do not establish ownership.
4. **Steam Library** shows all verified-owned Steam games, installed or uninstalled. Use the status filter to narrow the list. **Library** also includes owned uninstalled games, manual/managed games and bookmarks. Saved does not mean owned. Ownership is a last-successful-sync snapshot; use Refresh Steam after account changes.
5. Play/Install/Uninstall for Steam games opens Steam. Steam handles authentication, licensing and its download progress. Steam playtime is read from available account/local data and is never added again as Ember playtime.

## Implemented in this alpha

- Exact eight-page navigation, collapsible animated sidebar, artwork-driven theme, native launcher icon, responsive rounded interface and reduced-motion support.
- Home feature selection, real playtime/library statistics, cached genre/playtime/review recommendations and recently played cards.
- Persistent installed/owned/saved state, Steam multi-drive scanning, cached artwork, official descriptions, achievements/icons and Valve Deck ratings. Direct process launching and measured session time; editable descriptions and arguments.
- Steam public discovery/search, upcoming releases, cached per-game metadata, review/content filters, platform/genre/year/status filters, quality/review-count/release/name sorting. Missing values are shown rather than invented.
- Top-seller source order, original positions including gaps, region and unspecified reporting-window disclosure, hourly background refresh, timestamp, countdown, cached failure indication and manual refresh.
- Validated HTTPS JSON feeds, native package matching, actual streamed downloads with concurrency/priority/pause/resume/cancel/retry, measured speed/ETA, restart recovery, size/SHA-256 checks and disk-space checks.
- ZIP extraction with path/symlink/duplicate/size guards, staged publishing and native executable validation. Confirmed external installer handoff, manual target registration, and marker-checked managed ZIP uninstall. No installer is silently executed.

## Tests and builds

Windows and Apple Silicon Mac 1.0.0 exports: see [export files and native build evidence](docs/EXPORTS.md).

The latest [release verification report](docs/RELEASE-VERIFICATION.md) records tested features, artwork coverage, source health and outstanding release gates. A successful build does not certify every external release or Mac execution.

Launcher self-updates and the administrator release editor: see [release publishing and update verification](docs/LAUNCHER-UPDATES.md). `npm run package:installer` builds an unpublished Windows installer candidate with automatic-update support. Portable/source builds remain available for development. The Updates tab has a persistent unread indicator for new announcements.

```sh
npm test
npm run smoke
npm run package:win
# On an Apple Silicon Mac:
npm run package:mac
```

`npm run smoke` uses isolated test data and a harmless OS process. It never launches one of your games. `npx tsx scripts/verify-catalog.ts` checks public Steam responses and writes `artifacts/catalog-live.json`.

The Windows release is unsigned. Mac packaging and actual Mac game execution require validation on a Mac; do not bypass operating-system security warnings. See [native Mac setup](docs/MAC-SETUP.md).

## Package feeds and limits

See [feed format](docs/PACKAGE-SOURCES.md), [JSON Schema](docs/package-source.schema.json), [architecture](docs/ARCHITECTURE.md) and [progress / acceptance matrix](docs/PROGRESS.md).

Six community catalog snapshots are bundled; custom JSON sources can also be imported. Their torrent/file-host downloads are separate from automatic installation: community files require manual installation. Verified direct package feeds support managed ZIP installation and explicit native installer handoff. Supply packages you have permission to distribute. Feed license metadata is a publisher declaration, not an independent legal verification. macOS app archives containing symlinks are deliberately rejected. Use a native signed installer for such apps.

This is an alpha, not a claim of universal game compatibility or a complete Steam index. The live public top-seller response returned 98 usable game entries on 2026-10-19, not a guaranteed Top 100, and publishes no reporting window. User tags/wishlist counts and a reliable asset-flip classifier are not available in the current adapter. Rating thresholds are not presented as proof of game quality. Cached recommendations improve as you browse. Huge-library DOM virtualization and advanced bandwidth/update management remain future work; current views use pagination, lazy images and offscreen rendering containment.

Persistent data lives in Electron's userData directory, shown in Settings. `library.json` and `ember2.json` have previous-save `.bak` copies. Encrypted credentials are device-specific: reconnect Steam on another computer instead of copying `steam-key.bin`. Existing 0.4 libraries migrate in place; back up the data folder before trying an alpha.






Download sources: see [Download source setup](docs/DOWNLOAD-SOURCES.md). The game page now offers Download → Save to library → View on Steam.




