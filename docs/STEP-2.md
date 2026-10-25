# Daily-use improvements, remembered devices, reviews and transfers

## Library tools

- Right-click a game card for details, favorites, collection/cover management, Play, Open folder and Uninstall as applicable. Unsaved discoveries offer Save to library.
- Game details also include **Manage game**. Assign up to 20 collections, mark Backlog/Playing/Finished, favorite a game, or hide it. Use the Library status and Collection filters to find these entries again. Hidden entries are excluded from the default library and Home recommendations.
- Search matches accents, alternative local/store names, prefixes, a single typo and adjacent letter transpositions. Ctrl+K (Command+K on Mac) focuses search. Press Enter to remember a query; the last 12 appear as suggestions. These preferences are local until library synchronization is implemented.
- Choose a PNG/JPEG/WebP cover through Manage game, or Reset cover to return to the original artwork. Ember decodes and stores a PNG in its own artwork directory. Custom covers take priority in game cards and contribute to page colors.

## Storage manager

Open Settings → Storage manager → Scan installed games. The scan reports folder sizes and drive free space; linked/unreadable installations report their limitation rather than guessing a size.

**Move to another drive** is available for Ember-owned ZIP/archive installations with valid ownership markers. Close the game, choose a different destination folder and confirm the source/destination. Ember copies to a new folder, verifies each copied file, updates the executable and ownership marker, saves the library, and only then removes the original owned folder. Other games can be managed using their original installer. Do not treat this as Steam library migration.

**Back up save folder** asks you to select the actual save-data folder and makes a verified copy under Ember's separate `save-backups` directory. **Back up saves, then uninstall** stops if folder selection is canceled and starts uninstall only after the backup succeeds. **Uninstall** retains the existing confirmation flow. Ember cannot automatically identify every game's saves: data inside an installation folder can be removed by its uninstaller. Choose the save folder before uninstalling when preserving that data matters.

## Remember this device

Check **Remember this device** on the login page before signing in. Ember stores an OS-encrypted session token bound to the selected account service, never the password. On restart it verifies that token with the account server before opening the launcher. No automatic offline authorization is granted. Sign out deletes the saved token; server revocation, password reset and session expiry still apply. If OS credential encryption is unavailable, sign in with the checkbox unchecked.

The updated account service gives remembered logins a 30-day session instead of the ordinary seven-day session. Existing deployed server versions still use their previous expiry until redeployed. In Render, open **ember-accounts → Manual Deploy → Deploy latest commit** after pushing these changes. Keep the existing Turso configuration and credentials.

## Reviews

Ember now uses Valve's public `IUserReviewsService/GetAppReviews` endpoint. Its response has a `response.query_summary` envelope rather than the legacy `success` field. Requests use `input_json`, numeric enums, all languages, all purchase types and first-page summary fields. The old `/appreviews` route was returning HTML during verification.

Existing metadata caches backfill missing review summaries. Successful review fetches cache for six hours, with five-minute retry spacing after failures. Previously saved reviews remain during outages. Local installations linked to a Steam App ID now load the same detail metadata as Steam entries, fixing missing summaries there. The detail page displays the positive percentage, count, summary and source. Games without an accessible verified review source show **Reviews unavailable**; no scores are invented or copied from unrelated games. A valid zero-review response shows **No reviews yet**.

Valve reference: https://partner.steamgames.com/doc/webapi/IUserReviewsService

## Download throughput

The engine already had unlimited upload/download rates. It now requests rarest-first pieces instead of WebTorrent's default sequential strategy, explicitly enables peer exchange, displays connected/sending/choking peer counts and tracker count, and smooths rate/ETA. Direct transfer progress checkpoints write every five seconds rather than every second to reduce persistence overhead while preserving resumable partial files.

Settings offers optional router port mapping (UPnP/NAT-PMP) for incoming torrent peers. It is off by default and applies to new/resumed transfers. No firewall rules are changed automatically. The Downloads page offers Find another release when a swarm is slow.

A controlled localhost transfer of a generated 16 MB fixture verified payload integrity and exceeded the reported internet transfer speed (about 90 MB/s on the test machine). This proves the engine can move data faster under those test conditions; it is not a public-swarm benchmark or a promise of internet throughput. A 154.37 Mbps connection has a theoretical download ceiling of about 19.3 MB/s before overhead. Actual torrents remain limited by the sending peers, paths and disk activity.

## Run and verification

Use `npm run dev` to run these source changes. No published installer has been replaced, and installed versions require a new packaged release. Only the remembered-session expiry change requires the account-server deployment described above.

- `npm test`
- `npm --prefix server test`
- `npm run build`
- `node scripts/verify-step2.mjs`: isolated UI/OS-encryption test, temporary installation move and separate save backup. No game is launched and production account data is not modified.
- `node --import tsx scripts/verify-steam-reviews.mjs`: live public review summary check.
- `node --import tsx scripts/verify-torrent-throughput.mjs`: generated local torrent fixture, with no public peers or game payloads.
- `npm run smoke`
