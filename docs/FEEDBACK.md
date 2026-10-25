# Feedback board

Feedback appears in the launcher's Manage sidebar. Approved, signed-in users can search and browse all posts, create posts, and read discussions and attached images. Selecting a post opens its discussion beside the board.

Only a post's creator and approved Ember admins can reply. The account server enforces these permissions on every write; hiding the composer is not the access control. Admins can delete a post and its messages/images, or set its status to Open, In the Works, Not Happening, or Done/Fixed. Administrative actions are audited.

Users can upload images or paste them into the post/reply composer. Up to three PNG, JPEG, WebP or GIF images can accompany a message. Larger static images (up to 10 MB input) resize automatically; each stored image is limited to 512 KB. GIFs must already fit that limit. SVG and other file types are rejected by the server. Images are stored in the account database, not on Render's temporary filesystem. Reading images requires an approved account.

Posts refresh every 30 seconds, and the open discussion every 15 seconds. Refresh also reloads immediately. Search, status filters, older posts and older replies are supported. Requests and replies have bounded lengths and basic per-user posting limits.

## Deploy on the existing account service

1. Push this source revision to `codex/initial-import`.
2. In the Render dashboard, open the existing **ember-accounts** service.
3. Choose **Manual Deploy → Deploy latest commit**. Keep the existing Turso environment values and start/build commands. No new database or credentials are needed.
4. Wait for the deployment to become Live. The new tables/indexes are created automatically without changing existing accounts or announcements.
5. Run the updated launcher from this project with `npm run dev`, then open **Feedback**. Installed older clients require a new launcher build before the button appears.

The existing local-account export/import command also includes feedback threads, messages and images. Old account exports without feedback tables are still accepted when importing into an empty database.

## Verification

- `npm --prefix server test`: local and hosted-adapter HTTP permissions, shared images, moderation, validation, deletion, account revocation, and account/feedback migration.
- `npm run build`
- `node scripts/verify-feedback.mjs`: isolated Electron UI test covering post creation, file uploads, pasted images, creator replies, reader access, admin replies/statuses, and deletion. It does not contact production accounts.
- `npm run smoke`: existing launcher regression smoke test.

The hosted-adapter tests use a separate local libSQL database, not the production Turso database.
