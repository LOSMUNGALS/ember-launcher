# Free shared accounts: Render + Turso

This runs the existing account website on Render Free and stores accounts remotely in Turso. Local SQLite remains supported for development. On Render, missing database credentials now stop startup instead of silently creating an account database on temporary disk. One service instance is supported. The adapter uses Turso's libSQL client and interactive write transactions; verify the database connection with the deployment health test before accepting real accounts.

## 1. Keep existing accounts safe

Decide which laptop has the account database you want to keep. Do not create a new administrator on the hosted service first. Keep that laptop's `.account-service` directory intact. Do not send database files, passwords or tokens through chat or commit them to GitHub.

## 2. Turso website

Open database **ember-accounts**. Copy its database URL from the connection details. Generate a database-scoped read/write token using Turso's token control; enter it directly in Render's secret environment field. The token is server-only. Keep a private copy only if needed for the migration; never put it in the launcher, release assets or GitHub. If Turso asks to choose a database engine, this adapter targets a libSQL-compatible endpoint.

## 3. Render website

Open **ember-accounts → Settings**. For the existing Node service, set:

| Field | Value |
|---|---|
| Branch | `codex/initial-import` |
| Root directory | blank |
| Build command | `npm ci --prefix server --omit=dev --ignore-scripts` |
| Start command | `node server/index.mjs` |
| Compute | Free |

Under **Environment**, add these values together before saving:

| Key | Value |
|---|---|
| NODE_VERSION | `24.14.1` |
| HOST | `0.0.0.0` |
| PUBLIC_URL | `https://ember-accounts.onrender.com` |
| TURSO_DATABASE_URL | URL copied from the Turso database |
| TURSO_AUTH_TOKEN | database token, entered privately |

Render supplies PORT. Do not add a paid disk; the database is remote. Saving settings may immediately deploy. Missing/incorrect credentials should fail with an initialization error, never fall back to temporary storage. Do not run the desktop `dist/main.cjs` on the server.

## 4. Migrate before using hosted accounts

The migration tool has been tested against isolated SQLite/libSQL databases. It preserves account IDs, scrypt password hashes, approval/rejection state, announcements, release notes and audit records. Login sessions/reset links do not migrate. Import refuses any nonempty destination; it does not merge or overwrite accounts.

On the laptop containing the original account database, update the source checkout and install the server tools:

```sh
npm ci --prefix server
node server/migrate.mjs export .account-service/accounts.sqlite .account-service/accounts-export.json
```

The export uses a consistent read transaction and exclusive file creation. Keep its private file outside Git and retain the source database. To import, create an ignored local `.env` containing TURSO_DATABASE_URL and TURSO_AUTH_TOKEN using a local editor. Never paste their values into chat. Then run:

```sh
node --env-file=.env server/migrate.mjs import .account-service/accounts-export.json
```

Run import before onboarding users, ideally while the hosted service is stopped. Do not recreate an account merely because it is absent on this computer. If the database is on the other laptop, run the export/import there or privately transfer the export to your own computer; do not make the source database public. Do not use a different laptop's empty/new account database as the authoritative copy.

## 5. Verify and connect both launchers

Open https://ember-accounts.onrender.com and wait for the service to wake. If it asks to create an administrator, the migration has not populated the selected database: stop and check it. Log in with the original administrator password yourself. Check that existing accounts, approval status and announcements appear. Restart the hosted service and confirm they remain.

In BOTH launchers, at the login screen open **Account service connection** and save `https://ember-accounts.onrender.com`. Log in normally. The published 1.0.1 installer already allows a custom account service address; no manual 1.0.1 install is needed for this configuration.

Render Free can take about a minute to wake after inactivity. Existing launchers have a shorter connection timeout: wake the website first, then retry login. Hosting does not synchronize local game files, library records or downloads. Password-reset emails still require separate Resend configuration.

## Maintainer checks

`service.mjs` is the single source for local account rules. `scripts/generate-async-accounts.mjs` derives `async-service.mjs` for the remote adapter; CI verifies it stays current. Regenerate after changing account rules. Remote operations are serialized per instance to prevent concurrent requests sharing an interactive transaction. Do not scale horizontally without a separate per-request transaction design.

Run `npm ci --prefix server`, `node scripts/generate-async-accounts.mjs`, and `npm --prefix server test`. Tests use isolated local libSQL files, not live Turso credentials. A live Render/Turso persistence check is still required after secrets are configured. Existing published release assets/tags are not modified by these server changes.
