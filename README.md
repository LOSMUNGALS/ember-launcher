# Ember 2.0 alpha

A real Electron + React + TypeScript desktop launcher for Windows 10/11 and native macOS games. This updates the existing Ember project; it does not use MaPC's proprietary interface or redistribute compatibility engines.

**The 2.0 specification supersedes the earlier Wine milestone: Windows games do not run on Mac through Ember.** Wine, DXVK setup, Epic and GOG navigation/integration have been removed. Existing manually registered games remain local entries.

## Open the launcher

Windows: open `release/Ember 2.0.0-alpha.15.exe` after packaging, or run the source:

```sh
npm ci
npm run build
npm start
```

Use Node.js 24 LTS. In PowerShell, use `npm.cmd` if local policy blocks `npm.ps1`. `npm run dev` builds and launches Electron; it is not a browser preview. Closing the window keeps Ember in the system tray so downloads, install detection, and directly launched game tracking continue. Use the tray menu → Quit Ember to exit.

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

No feed is bundled. Supply packages you have permission to distribute. Feed license metadata is a publisher declaration, not an independent legal verification. Supported transports are public HTTPS, supported archives are ZIP; macOS app archives containing symlinks are deliberately rejected. Use a native signed installer for such apps.

This is an alpha, not a claim of universal game compatibility or a complete Steam index. The live public top-seller response returned 98 usable game entries on 2026-10-19, not a guaranteed Top 100, and publishes no reporting window. User tags/wishlist counts and a reliable asset-flip classifier are not available in the current adapter. Rating thresholds are not presented as proof of game quality. Cached recommendations improve as you browse. Huge-library DOM virtualization and advanced bandwidth/update management remain future work; current views use pagination, lazy images and offscreen rendering containment.

Persistent data lives in Electron's userData directory, shown in Settings. `library.json` and `ember2.json` have previous-save `.bak` copies. Encrypted credentials are device-specific: reconnect Steam on another computer instead of copying `steam-key.bin`. Existing 0.4 libraries migrate in place; back up the data folder before trying an alpha.






Download sources: see [Download source setup](docs/DOWNLOAD-SOURCES.md). The game page now offers Download → Save to library → View on Steam.




