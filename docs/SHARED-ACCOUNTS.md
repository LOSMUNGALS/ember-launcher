# Shared account hosting

**Current free setup:** see [Render Free + Turso](TURSO-SETUP.md). The Blueprint now uses the free service with remote database credentials and no paid disk. The paid local-disk walkthrough below is historical; use the Turso guide for the current configuration.

The repository includes a Render Blueprint (`render.yaml`) for the existing Docker service with one persistent disk. This is a paid service; review Render's current service and disk charges before deploying. No service has been purchased or deployed by adding this file.

1. Sign in at https://dashboard.render.com and connect GitHub with access to LOSMUNGALS/ember-launcher.
2. Create a Blueprint from this repository on `codex/initial-import`. Review the Starter service and 1 GB persistent disk. Keep one instance.
3. Set PUBLIC_URL to the service's assigned HTTPS origin (no path). If the assigned name differs, correct this value before accepting account requests. The reverse proxy must preserve that public Host header.
4. Before creating new accounts, migrate the authoritative database from the laptop that has your existing account. Do not commit or paste the database into GitHub or chat. Do not overwrite an existing hosted database without backing it up. This migration must preserve users, approvals, posts and password hashes together; copying a different laptop's database does not merge accounts.
5. To make a consistent export, stop that laptop's account service, then copy its `.account-service/accounts.sqlite` together with any `accounts.sqlite-wal` file to a private backup. Keep the originals. Transfer privately to the persistent `/app/.account-service` directory while the hosted service is stopped, preserving matching SQLite filenames. Do not copy just the main database while its service is running. Arrange the migration before public onboarding; ask for help if the hosting platform cannot stop the process while transferring files.
6. If starting with an empty database instead, administrator bootstrap must run on the server's loopback interface. The public setup endpoint deliberately rejects external connections. Use a private server shell/SSH tunnel; never weaken this restriction or publish the setup token. Migrating the existing administrator database avoids new bootstrap entirely.
7. After deployment, verify the admin website, existing account login, approval/revocation, and persistence through a service restart. Do not switch clients until these checks pass.
8. In BOTH launchers, open Account service connection on the login screen and save the exact same HTTPS origin. Reopen Ember and log in with the existing account. No launcher reinstall is required.

Local library and download records remain on each computer. Shared account hosting does not synchronize game installations. Leave local service databases intact until migration is verified. Email password recovery additionally needs server-only RESEND_API_KEY and EMBER_EMAIL_FROM configuration; never include these values in the Blueprint or desktop app.

The published 1.0.1 release remains unchanged. Hosting configuration is a separate source change and does not require replacing published installer assets or moving the release tag.
