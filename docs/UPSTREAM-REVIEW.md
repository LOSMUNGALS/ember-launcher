# Upstream review — 2026-10-18

Reviewed the live repository README, root LICENSE, NOTICE and Package.swift before choosing an integration approach:

- https://github.com/abduzeedo/mapc-engine
- https://raw.githubusercontent.com/abduzeedo/mapc-engine/main/LICENSE
- https://raw.githubusercontent.com/abduzeedo/mapc-engine/main/NOTICE
- https://raw.githubusercontent.com/abduzeedo/mapc-engine/main/Package.swift

MacadeKit is a Swift 6 package targeting macOS 15+, with a library and `mapc` executable. The README describes engines, bottles, WineRunner, graphics probing and store integrations. Its CLI currently expects engines/environments already prepared by MaPC. It is therefore not a ready-made cross-platform backend, nor an independently bootstrapped engine installer for this application.

The root uses Apache-2.0. NOTICE identifies Steale LLC and a separately MIT-licensed Witcher 3 fix. If source is incorporated later, retain applicable license and attribution notices and mark modifications as required. The MaPC interface/licensing implementation is outside the open repository; trademarks are not licensed by Apache-2.0. Ember does not copy source, names, logos, screenshots, or game assets.

**Decision:** independent interface/backend now; external Wine executable adapter for macOS experimentation. Evaluate a pinned MacadeKit sidecar on actual Apple Silicon hardware later, after auditing the relevant source, runtime bootstrap, CLI contract and all engine license files. No upstream commit has been vendored or pinned because no upstream code is being integrated yet.

Upstream describes Wine, DXVK, WineD3D, D3DMetal and third-party engine licenses. A fetch of the engine license directory did not succeed in this environment; a complete binary redistribution review is therefore pending. Do not infer that Apache-2.0 covers every runtime component. Wine is LGPL, DXVK has its own license, and external store clients have separate obligations. Apple Game Porting Toolkit/D3DMetal is not bundled or downloaded by Ember; any future use requires review of Apple's current terms.

Legendary's primary repository describes an Epic CLI with authentication, downloads and Wine support under GPL-3.0: https://github.com/legendary-gl/legendary . GOG downloader candidate: https://github.com/Heroic-Games-Launcher/heroic-gogdl . Neither is bundled or called in this milestone. Review their exact pinned licenses and distribution requirements before shipping. Calling a separate executable does not replace a licensing review.

Electron hardening reference consulted: https://www.electronjs.org/docs/latest/tutorial/security . Npm lockfile records the exact dependency graph. Electron distributions retain their own license notices. This project has not yet selected a public distribution license (`UNLICENSED` in package.json).
