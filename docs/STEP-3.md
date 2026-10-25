# Part 3: cloud library backups and display sizing

Settings → Cloud library provides Back up library and Restore library. Both require a verified approved account and confirmation. Back up replaces that account's previous snapshot; restore merges saved games, favorites, hidden flags, collections and play status, with cloud values winning for matching entries. Other local entries remain. Up to 2,000 entries are supported. This is explicit backup/restore, not automatic background synchronization or conflict resolution.

Paths, credentials, installation state, downloads, save files, playtime and custom cover files do not travel. New entries appear uninstalled. Existing matching installation records retain their paths. Steam IDs and catalog IDs identify games; unrelated local games retain their local identity. Back up from the computer containing your preferred library, then restore on the other computer using the same account and account service.

The account service stores each user's snapshot separately in Turso (SQLite during local development); only that authenticated user can retrieve or replace it. Revoked sessions retain existing access checks. Server migrations include this optional table for new exports while accepting older exports without it.

Deploy the latest branch on Render → ember-accounts → Manual Deploy → Deploy latest commit before testing cloud backup. Existing accounts/database credentials stay in place. Run updated source with npm run dev on each computer; these changes do not alter an already installed launcher or published installer.

Display sizing now increases Electron UI zoom gradually for windows wider than 1920 logical pixels, capped at 160%. Electron's native operating-system DPI scaling still applies; the calculation uses logical display work area and window size to avoid doubling Windows scaling. Resizing or moving monitors recalculates the zoom. Login content centers vertically, allows scrolling on short windows, and uses smaller spacing where needed. Sidebar scrolling, wrapped actions and responsive card/stat layouts improve smaller windows. Minimum window size is now 720×540.

Verification: build; launcher tests; account tests including local ownership/validation and hosted-adapter persistence across restart; existing Step 2 Electron tests; scripts/verify-display.mjs checks login layout at 800, 1280, 1920 and simulated 3840 pixel sizes. A simulated viewport does not certify every physical monitor/DPI combination: manually test maximized and restored windows and moving between monitors with different Windows scaling.
