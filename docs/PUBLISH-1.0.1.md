# Publish the 1.0.1 cover update

The application and lockfile are already version **1.0.1**. The two supplied JPEG files are bundled unchanged. Existing cached metadata refreshes on startup; saved community cards and the Home feature now resolve artwork by catalog identity. Do not bump the version again for this prepared release.

## Upload through GitHub

1. Open https://github.com/LOSMUNGALS/ember-launcher/releases/new.
2. Choose the tag **v1.0.1**, creating it if it does not exist. Set **Target** to **codex/initial-import**. Do not target an older default branch.
3. Enter **Ember 1.0.1 — Cover art update** as the release title. Copy the Markdown from [the release notes](releases/1.0.1.md) into the description.
4. Attach these three files from the **same** `release/1.0.1/` directory: `Ember-Setup-1.0.1.exe`, `Ember-Setup-1.0.1.exe.blockmap`, and `latest.yml`. Keep the filenames unchanged. The source-code ZIPs that GitHub creates are not substitutes for these files. Wait for every upload to finish.
5. Leave **This is a pre-release** unchecked. Select **Set as latest release**. Choose **Publish release**. Saving a draft does not notify clients. This publication step makes the Windows update available.

Official GitHub instructions: https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository?tool=webui.

The Apple Silicon 1.0.1 ZIP can be attached as an additional asset after the native Mac export finishes. Mac clients still require a manual update.

## Verify an existing 1.0.0 installation

Keep the installed Windows 1.0.0 app for this test; launching the source or manually installing 1.0.1 first skips the real update test. Start the account service and log in normally. Open **Settings → Launcher updates → Check for launcher updates**. The **Update available** button beside Search should appear. Check the displayed version is 1.0.1, then select **Update Ember**. Ember pauses and saves downloads, installs the newer version, and reopens. Check both covers and confirm the button disappears. Resume paused downloads as appropriate.

Other installed Windows clients check at startup and every 15 minutes, or through the same manual check. A client must be online and able to reach the public GitHub release. Source, portable and Mac builds do not replace themselves through this Windows updater. Older 2.0 alpha installations require the documented manual move to 1.0 first.

Publishing release notes in the administrator website is optional for this test: GitHub release notes are the fallback. If using the admin editor, enter version **1.0.1** and publish the same title/body. Posting only on the Updates tab does not publish an installer. A shared hosted account service is needed to share admin posts across computers; each localhost service has its own posts.

## Subsequent updates

Change the application, increase both package versions with `npm version patch --no-git-tag-version`, test, build the installer, and repeat with the new tag and newly generated assets. Never overwrite an already-published version with different binaries.
