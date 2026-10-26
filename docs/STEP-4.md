# Step 4: save protection, personalization and mouse zoom

## Use the new source

These changes are on the existing development branch; they do not replace an installed EXE or any published installer. Run `npm run dev` from the checkout. Cloud saves require the updated account service: Render → ember-accounts → Manual Deploy → Deploy latest commit. Keep the current Turso configuration and secrets. A new packaged release is needed for installed clients on other computers.

## Mouse zoom

Hold Ctrl and scroll up/down to zoom in/out anywhere, including login. Hold Ctrl and click the mouse wheel (middle button) to reset. Reset restores the normal automatic size for the current monitor. Manual magnification is remembered on this device and composes with the Step 3 monitor scaling; moving or resizing the window does not discard it. The manual range is 60–180%, with a combined display limit of 250%.

## Personalization

Settings → Notifications & accessibility offers desktop notifications for completed or failed downloads, the unread announcement badge, Reduce motion and High contrast. Desktop notifications are opt-in and remain subject to OS notification permissions/Do Not Disturb. They report a download result, not a successful installation. Accessibility settings apply to login as well as the signed-in app. Visible keyboard focus is stronger.

Feedback post/reply composers include Attach diagnostics. It adds a readable, removable diagnostic block to your draft for review before sending. Only version/platform/architecture and bounded download/source status summaries are included. It omits local paths, credentials, game/source names, URLs, account identifiers and raw error messages. Posting is still your explicit Send action.

Library backup/restore remains explicit in Settings → Cloud library. This update also preserves non-Steam identities across repeated backup/restore, avoiding duplicates on a second computer. Automatic account library merging is not implemented.

## Versioned local saves

Settings → Save protection lets you choose a game, then its actual save-data folder. Close the game first. Each backup is a separate dated version with a SHA-256 manifest. Storage manager's Back up save folder and Back up saves, then uninstall use the same versioned system.

Restore this version asks for the current save folder and confirmation. It first backs up that folder, verifies a staged restore, checks that current files have not changed, and swaps folders. The original folder remains at the reported `.ember-previous-…` sibling path in addition to its backup version. A failed integrity check leaves current saves intact. Symlinked folders, drive roots, nested backup destinations and unsafe cloud filenames are rejected. Permissions or open files can block the folder swap; close the game and retry. Backups and rollback folders are retained; no automatic pruning deletes them.

Local version metadata and payloads live under Ember's user-data `save-backups/<version-UUID>/manifest.json` and `files/`. Earlier unversioned `.ember-backup.json` folders remain untouched on disk but are not shown as versioned entries. Save-folder selection is manual; Ember does not discover every game's saves or back them up automatically on exit.

## Cloud saves and conflicts

Cloud transfers are manual and use the same approved account service on both computers. After selecting a game:

1. Refresh cloud status.
2. Upload local saves to create or explicitly replace the displayed cloud revision. Select only this game's save-data folder; it is uploaded to your hosted account database.
3. On the other computer, refresh status and Download cloud as a new backup.
4. Choose Restore this version for the downloaded backup, select that computer's actual save folder, and confirm.

Each upload supplies the last inspected revision. A newer upload from another device blocks a stale one with a conflict; it does not silently overwrite it. Refresh and deliberately choose to keep local saves by uploading them or keep cloud saves by downloading/restoring them. Replacing a cloud snapshot preserves its previous payload as a local backup first. A local snapshot also remains if an upload fails. Only the latest cloud revision is stored remotely; local backup history is retained.

Limits: 2 MiB decoded data, 1,000 files per snapshot, 20 game snapshots per account. Larger folders stay supported as local backups within storage scan limits; they cannot upload. Transport uses the configured HTTPS account service, with session approval/revocation enforced. Save contents are stored in that service's database; this is not end-to-end encryption. Passwords, sessions, local save paths and installation records are not part of the upload. SQLite and the libSQL/Turso adapter are covered by tests; production cloud deployment requires your Render redeploy before testing.

## Verification and manual test

- `npm run build`
- `npm test`
- `npm --prefix server test`
- `node scripts/verify-step2.mjs`: isolated real Electron/account HTTP test including save versioning, upload, stale-revision conflict, download and restore, plus accessibility and diagnostics.
- `node scripts/verify-zoom.mjs`: actual Ctrl-wheel and Ctrl-middle-click gestures, including zoom persistence across restart.

For your first restore test, create a disposable folder with `slot.txt` containing `version one`. Back it up using a test game entry. Edit the file to `version two`, back it up again, and restore the first version into that disposable folder. Confirm that `slot.txt` returns to `version one`, while the newer contents remain in the previous version and reported rollback folder. Use disposable files before trying real saves.
