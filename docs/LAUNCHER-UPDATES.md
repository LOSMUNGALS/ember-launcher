# Launcher releases and announcement notifications

## Move to Ember 1.0 and publish its next update

The current app version is **1.0.1**, displayed as **Ember 1.0**. The first cover-art update is prepared: follow [the exact 1.0.1 upload and installed-client test](PUBLISH-1.0.1.md). It continues the same project; application identity, library storage, account database and login credentials are retained. The administrator and all earlier administrator post bylines display **LOSMUNGALS**.

To use the current source, quit Ember from its tray menu, then run `npm run dev`. Alternatively, after building, run `release/Ember-Setup-1.0.0.exe` to install the Windows candidate manually. The older 2.0 alpha cannot automatically install 1.0.0 because that would be a version downgrade. Do this one-time manual transition without enabling downgrade updates.

For the next real update, **1.0.0 → 1.0.1**:

1. The source is already version 1.0.1; build with `npm run package:installer`. Do not increment again for this prepared release. For later releases, increment both package versions before building.
2. In the admin website's Launcher release editor, enter version **1.0.1**, the release title and formatted description; select Publish these release notes and save.
3. Review/commit the tested source and package version changes. On GitHub create a normal release tagged **v1.0.1** and upload the same build's `Ember-Setup-1.0.1.exe`, `.exe.blockmap`, and `latest.yml` from `release/`. Publish it after all three assets are uploaded. Do not upload an older candidate's manifest or blockmap.
4. An installed 1.0.0 client will offer Update available at its next update check, or immediately after Settings → Check for launcher updates. Confirm the dialog shows 1.0.1 and your notes, then choose Update Ember.

The local refresh-only test does not install these code changes or change a version. It is just a way to rehearse the button/dialog/refresh flow. Public publication and the final installer still follow playtest; building 1.0.0 here does not create a public GitHub release.

## Edit the release dialog as administrator

Start the account service, open its website and log in as administrator. Under **Launcher release editor**:

1. Enter the release title, version and description. The version must match the application version inside the installer, such as `1.0.1`. Editing a label cannot change the executable's version.
2. Select text and use Heading, Subheading, Bold, Italic, Underline, Strike, Code, Quote, List or Numbered list. Review the live preview. Formatting is parsed into safe elements; HTML is displayed as text.
3. Save as a draft, or select **Publish these release notes** and save. Only approved users can read published notes; only administrators can list drafts, create or edit releases. Use **Edit release [version]** to change saved fields, including the version. Duplicate versions are rejected.
4. Optionally export the Markdown notes for the GitHub release. Publishing notes on this website does not build or publish the installer.

Installed clients use published notes only for the exact installer version offered by GitHub. They refresh edited descriptions on startup, focus and at most every minute while open. If the account service is unavailable or no matching published notes exist, GitHub release notes provide the fallback. Unpublishing notes restores that fallback; it does not withdraw an installer already published on GitHub.

## Publish a Windows launcher update

Automatic replacement uses the installed Windows **NSIS** build. Existing portable builds and `npm start` remain supported for manual development, but cannot replace themselves. macOS automatic installation is not enabled by this change.

1. Playtest and commit the intended code on the development branch. Set the application version in `package.json` and update `package-lock.json` together. Stable versions must increase; prerelease and downgrade updates are not automatically offered.
2. Run the tests and build. Use `npm run package:installer` to build an unpublished Windows installer. Keep `appId` and the per-user installation scope unchanged so the installer replaces the previous installation.
3. In the admin website, publish the matching release title/version/description.
4. Create a GitHub release in `LOSMUNGALS/ember-launcher` with the corresponding version tag. Upload the generated `Ember-Setup-[version].exe`, its `.blockmap` and **latest.yml** from the same build. Upload the assets before publishing the release. Preserve the generated names and SHA-512 values. A source commit or an announcement alone does not create a launcher update.
5. Publish the release as a normal release, not a draft or prerelease. Clients check at startup, every 15 minutes and using Settings → Launcher updates → Check for launcher updates. No GitHub credential is bundled into clients; distributed update assets must be publicly downloadable.

The current source is version **1.0.1**; building does not publish it. An existing source or portable user first installs the NSIS version manually to enter the automatic update path. Older **2.0.0-alpha** builds also need a one-time manual move to 1.0: the updater correctly treats it as a downgrade and must not be forced to install it. Keep the same app ID, product name and user-data location. Installed 1.0.0 users can receive 1.0.1 as a normal upgrade after publication.

## User update flow

### Local refresh-only test

Administrators can choose **Settings → Launcher updates → Test update (refresh only)**. This creates an explicitly labeled test update only in that running launcher. Open **Update available** beside search, inspect the sample formatted notes, then choose **Update Ember**. Active transfers are paused and saved, the window refreshes, and the update button disappears. The version, account, library and application files remain unchanged. Resume downloads when ready. No release or announcement is published, no installer is downloaded/executed, and an available real update cannot be overwritten by this test.

For source development, quit an already running Ember using its tray menu, then run `npm run start:test-update` to build and open directly with that local test available. The startup flag works only on unpackaged development builds. The test can be repeated from Settings and does not replace the real two-version installer playtest below.

A newer published installer shows **Update available** beside Search games. The dialog contains the administrator's title, version, formatted notes and Close / Update Ember controls. Closing the dialog leaves the update available.

**Update Ember** checks for tracked running games/installation, pauses active and queued game transfers, persists recovery state, downloads and verifies the installer, then hands off to NSIS. Only after those steps does Ember exit. NSIS replaces the installed program and reopens it. The new version no longer offers that same release. The application data directory, accounts-service address, library, saves outside the program directory and download records are retained; the updater does not recursively delete game folders or manually delete the old executable before a verified replacement exists.

Resume paused torrent/package jobs after reopening. Torrents recheck partial pieces; supported package servers use byte ranges. External file-host transfers may need Retry from their host page; byte-resume across restart is not guaranteed by every host. Do not describe those transfers as universally resumable.

Failed download, checksum, pause or persistence checks leave the existing program installed, with an error and retry path. No background download or install-on-normal-quit is enabled. The updater retains the framework's integrity and configured publisher-signature checks. Use the same signing identity for production versions. Source builds show the current version and manual-update explanation under Settings.

## Announcement red dot

The Updates sidebar button shows a red dot when the account service has a post newer than this account's read marker on this device. Lightweight checks run at login, on window focus and every 30 seconds. Opening Updates fetches the posts and marks only the displayed newest ID as read. Newer posts arriving during that request remain unread. Clicking an already active Updates tab refreshes it. Read markers survive restart and are separate for each service/account; they do not synchronize across devices.

## Verification and release gates

- Unit tests cover explicit install consent, pause/flush/install ordering, duplicate install requests, checksum failure/retry, no-update clearing, source-build restrictions and persistent unread markers.
- Real local HTTP fixtures verify that an active and queued package are paused before update, persisted, and resumable with correct bytes after restart.
- Browser/Electron fixtures verify administrator release editing, version changes, drafts/publication, safe rich formatting, dialog controls, notification clearing/reappearance and read persistence. The UI fixture substitutes the installer handoff and does not claim a real in-place upgrade.
- Run `npm test`, `npm run test:accounts`, `npm run build`, `npm run smoke`, `npm run smoke:accounts`, `node scripts/verify-launcher-updates.mjs` and `node scripts/verify-shutdown.mjs`.

Before the public final installer: playtest two successive installed versions in an isolated Windows VM, including real replacement/relaunch, interrupted update, corrupted asset, paused torrent/package and host retry. Build success and a fake-driver test do not prove that end-to-end installer handoff. Verify production signing, shared HTTPS account hosting and real email delivery. The current npm production audit still flags the existing WebTorrent/tracker `ip` dependency chain; review that separately rather than downgrading to an obsolete torrent engine with `npm audit fix --force`. The added updater uses patched 6.8.9 / builder-util-runtime 9.7.0.
