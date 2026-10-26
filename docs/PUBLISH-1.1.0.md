# Publish Ember 1.1.0

Version: **1.1.0**  
Tag: **v1.1.0**  
Release title: **Ember 1.1 — Your Library, Protected and Personalized**  
Development branch: **codex/initial-import**

Use the exact source commit in the verified release folder's `BUILD-INFO.json` as the GitHub tag target. The build script embeds its source revision inside the application; the verifier rejects a dirty source build. No release or tag is published automatically by preparing these files.

## Before publishing

1. Open the existing Render **ember-accounts** service and choose **Manual Deploy → Deploy latest commit**. Wait until Live. Keep the existing Turso URL/token and other secrets unchanged; do not send credentials in chat or put them in a release. New service tables are created automatically. Existing accounts and posts remain in the database.
2. Open `release/1.1.0/` in the local project. Keep the generated filenames unchanged. Do not mix files from different builds or edit `latest.yml`.
3. Check `BUILD-INFO.json` and `SHA256SUMS.txt`. The Windows verifier checks installer size and SHA-512 against `latest.yml`, checks the embedded application version/source, and compares all bundled source files byte-for-byte.

## Required Windows update assets

Upload these three files together:

- `Ember-Setup-1.1.0.exe`
- `Ember-Setup-1.1.0.exe.blockmap`
- `latest.yml`

The installer is the NSIS installed Windows build. It is not the older portable EXE. There is no new portable artifact in this release set. GitHub's automatic source archives do not replace the installer/update metadata.

## Additional release attachments

- `Ember-1.1.0-arm64-mac.zip`: Apple Silicon M1 and newer; exported and tested on native GitHub macOS. Do not rename a Windows file or attach the old 1.0.4 Mac ZIP. Manual update only; no Intel build or notarization is provided.
- `SHA256SUMS.txt`: checksums for the release assets and companion files.
- `BUILD-INFO.json`: version, exact source commit, installer size/hash and verification details.
- `MAC-BUILD-INFO.json`: matching Mac workflow run/source and artifact verification details, once the export completes.
- `1.1.0-catalog-changes.json`: all 2,169 added or changed release rows (2,096 added including Kazumi, 73 updated), with source/title/date/size. Counts are release listings, not unique games.
- `RELEASE-NOTES.md`: full feature, quality-of-life, bug-fix, catalog and limitation details.
- `PUBLISHING.md`: this checklist, useful for your local release folder.

The release-folder ZIP is a convenience download containing the prepared files. Extract it before uploading individual GitHub assets; uploading only that convenience ZIP will not enable Ember's updater.

## GitHub release form

1. Open https://github.com/LOSMUNGALS/ember-launcher/releases/new.
2. Confirm `v1.1.0` does not already exist as a release/draft. If it does, edit that existing release; do not create a duplicate.
3. Choose/create **v1.1.0**, targeting the exact verified source commit from `BUILD-INFO.json`. Use the development branch only if it still points to that same commit; do not accidentally tag an older default branch or newer unbuilt work.
4. Enter the release title above.
5. Copy the entire `RELEASE-NOTES.md` into the description.
6. Attach the three required Windows assets and the additional Mac/checksum/inventory files. Wait for every upload to complete.
7. Leave **This is a pre-release** unchecked. Select **Set as latest release**, then **Publish release**. Saving a draft or publishing only notes does not offer clients an installer.
8. Optional: publish the exact same **1.1.0** title/version/notes in the Ember admin website's release editor. GitHub notes remain the fallback. This step alone does not publish an application update.

## Test the real installed upgrade

Use an existing installed Windows 1.0.4 (or supported earlier stable 1.0.x) build. Do not manually install 1.1.0 before testing its updater.

1. Start Ember, log in, and record a few saved games, collection choices and download records.
2. Open Settings → Launcher updates → Check for launcher updates.
3. Confirm Update available appears beside Search and offers **1.1.0**.
4. Select Update Ember. Let it pause/save transfers, verify the installer and reopen.
5. Confirm installed version **1.1.0**, the same library/download records, and no repeated update offer for 1.1.0.
6. Test remembered login, Ctrl-wheel zoom/reset, Settings → Save protection and the new Kazumi source. Use disposable saves for the first restore test.

Clients normally check at startup and every 15 minutes. Source, portable and Mac builds update manually. Old 2.0 alpha builds require a manual transition to stable 1.0.x because automatic downgrades are not forced. The controlled test suite does not substitute for this actual installer upgrade.
