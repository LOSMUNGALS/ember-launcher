# Alpha 16 — Accounts, Updates and uninstall

- Added a login/request-account screen with the Ember logo and configurable account service origin.
- Added the local Node.js 24/SQLite account administration website, administrator bootstrap, pending approval, 24-hour rejected-account cooldown, revocation, session expiration, rate limiting and audit records.
- Added authenticated main-process launch checks. Revocation is checked immediately before launch; normal app access is checked at most every 30 seconds. Tokens are not stored in the renderer or persisted.
- Added Updates at the bottom of the sidebar: normal accounts read; administrators publish. Formatting supports bold, italic, underline, strike, code, heading, quote and list. HTTPS image/GIPHY/direct-video links are supported. Refresh occurs on tab open, manually and every 150 seconds.
- Added a game-detail Uninstall button for Ember downloads. Managed ZIPs use their ownership marker. Portable downloads are validated against their unique recorded download directory. External installs open the OS uninstaller. Confirmation describes save/download removal. Fixed the old managed-job reference being read after clearing it.
- Removed hardware products from both chart feeds, preserving original ranks. Top Sellers now has 96 entries (Steam Deck, Steam Machine and Steam Controller excluded); Coming Soon has 99. Existing production rankings are refreshed on startup so old hardware cards do not persist.

## Verified

Unit and HTTP integration checks cover access control, account state transitions, rejection timing, persistence, revocation, safe media links, endpoint validation, logout races and uninstall containment. Electron/browser end-to-end checks cover initial administrator setup, user request, approval, login, publishing, ordinary-user read-only access, safe text rendering, uninstall, restart and revocation blocking launch. The existing launcher smoke test runs against a real isolated account service.

## Setup and boundaries

Read [ACCOUNTS.md](ACCOUNTS.md) before running alpha.16. The account service must be running. The local website is http://127.0.0.1:4783; it is not a publicly hosted domain. A deployment-ready service/Dockerfile is included, but public hosting has not been provisioned. New computers need access to the same hosted HTTPS service for shared accounts/announcements.

This does not enforce DRM on third-party binaries. Running game executables outside Ember is not blocked, and revocation does not terminate already running games. Media attachments use hosted URLs, not file uploads. Email identity is not verified; rejection cooldown is per recorded identity. See the account documentation for release-readiness limitations.
