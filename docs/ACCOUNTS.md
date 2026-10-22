# Ember accounts and Updates

## Start the account website on this computer

Use Node.js 24. From the repository folder run `npm run accounts`, or double-click `scripts/start-account-service.cmd` on Windows. Keep this terminal open while using Ember. The account website is **http://127.0.0.1:4783**; this is a local address, not a public domain.

On the first run, the terminal prints a one-time setup link. Open that link **on the server computer** and choose an administrator password of at least 12 characters. The initial administrator email is `nicolas2mv@gmail.com`; its username is `ember-admin`. No password is bundled or stored in Git. Subsequent starts do not print a setup link once the administrator exists. Never share a setup link.

Open the website and log in with that administrator account to approve/reject/revoke users. New users request accounts from the Ember login screen, with a username, email and password. Pending accounts cannot log in. Approval permits login immediately, including after restarting the launcher. A rejection requires the same account to wait a full 24 hours before submitting another request using its original password. A revoked account cannot reapply; the administrator may approve it again.

This cooldown applies to the recorded email/username, not a verified real-world person. It does not prevent someone creating a different identity. There is no email verification, password recovery, or MFA in this version. Keep backups and use this as a controlled beta service; add those capabilities before a wider public launch.

## Start the launcher

Use `npm run dev` or the alpha.16 executable. Its default service address is `http://127.0.0.1:4783`. If the service isn't running, login will explain that it cannot connect. **Account service connection** on the login screen allows a different HTTPS service origin. Login is required on each app restart; session tokens stay in the main process's memory and never reach the renderer or disk. Closing to tray keeps Ember running; tray → Quit ends the session locally.

Normal accounts can read Updates. Administrators can publish formatted text, attach HTTPS image/GIF/direct-video links, and use GIPHY page/media links. Supported formatting: bold, italic, underline, strike, code, headings, quotes and lists. Formatting is rendered as React elements, never HTML. Media must already be hosted at a reachable HTTPS URL; binary uploads and GIPHY search are not implemented. MP4/WebM compatibility depends on the browser codec. A missing remote media file displays a fallback.

Updates refresh when the tab opens, on Refresh tab, every 150 seconds while open, and after app restart when the tab is opened. Older posts can be loaded in pages of 50. Access checks apply server-side on every account and announcement endpoint; launcher access is revalidated at most every 30 seconds and immediately before game launch. Losing access or connectivity requires logging in again. Revocation blocks future launches through Ember; it does not terminate an already running game.

## Deployment for other computers

Localhost always refers to the current computer. A second computer cannot use this PC's localhost address. To distribute an account-enabled launcher, deploy the account service to a server with a persistent disk, an HTTPS domain, and a reverse proxy. GitHub stores the source; GitHub Pages cannot run this Node/SQLite service.

Environment configuration:

- `EMBER_ADMIN_EMAIL`: initial administrator email (read only when bootstrapping the database).
- `HOST`: bind address (default `127.0.0.1`; `0.0.0.0` only behind a trusted HTTPS reverse proxy).
- `PORT`: listener port (default `4783`).
- `PUBLIC_URL`: exact public origin, for example `https://accounts.example.com`. The proxy must preserve this Host header. No cross-origin browser requests are accepted.
- `EMBER_ACCOUNT_URL`: launcher runtime/build override. Set to the public HTTPS origin when packaging a distributable launcher, or configure it on the login screen.

`server/Dockerfile` builds from the repository root. Mount a persistent volume at `/app/.account-service`. Keep the backend port private behind the reverse proxy. Bootstrap on the server before exposing the proxy: the one-time setup handler accepts only loopback socket connections with the setup token. Do not put the token or passwords in images, command-line flags, or source. SQLite supports one service instance with a durable local disk; do not run multiple instances against network storage. Back up the database using SQLite's backup facility or stop the service before copying its database and WAL files.

The database contains scrypt password hashes, SHA-256 hashes of random session tokens, account decisions/audit entries, and announcements. Keep `.account-service/` private and excluded from Git. Sessions expire after seven days server-side and are invalidated by account decisions. Registration/login/setup endpoints are rate-limited per network address and submitted identity. The service performs no remote media fetches. Administrative actions use authenticated bearer requests and same-origin checks, not cookies.

## Limits on controlling games

Ember blocks its own launch API when logged out, revoked, or unable to verify access. It does **not** prevent a user from executing an ordinary game binary directly, nor does it add DRM to third-party games. Reliable enforcement outside Ember needs cooperation from the game or a separate platform enforcement design. The launcher does not modify downloaded executables, inject code, restore quarantined files, disable antivirus, or kill games on revocation.

## Uninstall

Installed games associated with Ember downloads show Uninstall. Managed ZIPs use their ownership marker. Detected portable installs can be removed only inside the exact `Ember-download-<job-id>` directory, after realpath containment validation and confirmation. Removing that folder includes downloads and any saves inside it. Installations outside Ember's owned folders open the operating system's uninstaller; Ember does not recursively delete arbitrary installed-game folders.
