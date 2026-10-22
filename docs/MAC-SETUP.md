# Native macOS setup — Ember 1.0

The Apple Silicon ZIP has now been built and tested on a native GitHub macOS runner. See [exports and validation](EXPORTS.md). Real-device game compatibility and Apple signing/notarization remain separate checks.

The latest specification replaces the old Wine workflow. Ember 2 does not run Windows-only games on macOS and does not install Wine, CrossOver, Proton or DXVK. Old compatibility setup instructions no longer apply.

For your M3 / 16 GB Mac:

1. Transfer the source project (or the source handoff ZIP), excluding Windows `node_modules`, `dist`, and `release`. Install Node.js 24 for Apple Silicon.
2. In Terminal, change to the project folder, then run `npm ci`, `npm run build`, and `npm start`.
3. Install the native Mac Steam client and log in. Install a game that Steam lists with macOS support. Steam Deck verification is NOT evidence of Mac support.
4. In Ember, choose Library → Import Steam and select `~/Library/Application Support/Steam`. For verified Steam Library ownership, connect your SteamID64/API key in Settings as described in README.
5. Play a native Mac Steam game through Steam. Ember checks native platform metadata and looks for a native Mach-O target in its installed directory before handing off. Metadata alone cannot establish whether an old Mac game works on your exact macOS release. Some Intel Mac games require Apple's Rosetta; install it only through Apple's normal system prompt. 32-bit-only games do not pass Ember's native binary check.
6. For a manual game, Add game → select its `.app` or native Mach-O executable. For a developer package, register its authorized feed, choose a Mac package, download, verify, then confirm installation. Native `.dmg`/`.pkg` installers remain under operating-system control; after installation, select the actual game target.
7. Run `npm test` and `npm run smoke`. Then build `npm run package:mac`. For distribution beyond your own testing, configure Apple signing/notarization; no Apple credentials are bundled.

No graphics-demand guess is used to promise performance or hide a native title. Ember does not rewrite game graphics files or claim that all M3-compatible titles perform well. Use each game's own settings.

**Validation limit:** Native Mac binary parsing and Windows-only blocking are unit-tested on Windows. Actual Mac packaging, native Steam launch, installer prompts, Keychain behavior and gameplay remain to be tested on your Mac. Your reported macOS version has not been independently verified.
