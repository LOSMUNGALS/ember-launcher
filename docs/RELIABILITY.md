# Reliability improvements

## Installation stages

Downloads and game details distinguish download completion from installation. The Downloads page shows Download, Extract/install and Ready to play stages. Completed downloads without a registered game say **Downloaded · not installed** and offer **Locate installed game**. Only registered installations get a Play action. Verified packages retain their existing explicit install action.

Extraction/installation stages are persisted before work starts. If Ember closes during those stages, it retains the completed package and shows **Installation needs attention**. Users can retry installation or locate the installed executable. External installer completion is not inferred from merely opening an installer. Existing external/torrent downloads still require installation outside Ember where applicable.

## Fix this game

The game detail page and registered Downloads entries offer **Fix this game**. This panel checks whether the registered executable exists and passes the native platform checks, shows the last launch error, rescans known installation folders, allows choosing a different executable, and opens the containing folder. Choosing an executable validates it before changing the record. Rescanning a Steam game uses the existing Steam library scan. A running game's executable cannot be changed. Repair does not reinstall or delete game files, and it does not claim to verify game content against a manifest.

## Transfer recovery

Interrupted direct and torrent transfers are preserved at startup and resume after successful login by default. Users can disable this in Settings with **Resume interrupted direct and torrent downloads after login**, then Save preferences. Deliberately paused/canceled downloads stay paused/canceled. Host downloads require reopening their host page; they are never opened automatically.

Direct downloads use Range resume where supported, with existing checksum verification. If a crash occurred after the package rename but before completion was saved, the complete file returns to checksum verification without another download. A direct response that makes no progress for 90 seconds is interrupted, retaining partial data. Temporary connection failures retry with backoff, up to three attempts; authentication failures, unavailable links, invalid resume responses, corruption and disk-space failures do not retry in a loop. Torrent metadata/no-peer stalls still need user action, rather than repeatedly retrying unavailable swarms. The UI shows actionable advice, scheduled retry time, and the last time bytes arrived.

## Source diagnostics

Settings shows each source's status, release count, normalized title-group count, last successful load and latest refresh attempt. Title groups are heuristic, not a verified unique-game count. A failed refresh retains the loaded packages and successful timestamp. Local snapshots explicitly explain that they refresh by importing an updated JSON. An empty download picker shows the enabled-source/loaded-option counts and offers **Report missing game**, which opens Feedback.

## Run and verify

Use `npm run dev` to run these source changes. Existing installers need a new packaged release; no account-server deployment is required for the reliability changes.

- `npm test`: restart recovery, partial Range resume, completed-file re-verification, stalled connection recovery, source diagnostics, platform errors and existing regressions.
- `npm run build`
- `node scripts/verify-reliability.mjs`: isolated Electron UI checks; it does not install or launch a game and does not touch the real library.
- `npm run smoke`: existing launcher regression checks.
