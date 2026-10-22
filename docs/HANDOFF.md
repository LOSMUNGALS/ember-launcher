# Source handoff — Ember 2.0 alpha

Open this folder as the project on the other device, or extract `handoff/Ember-2.0.0-alpha.1-source.zip` after it is generated. Run `npm ci`, `npm run build`, `npm start`. Do not copy Windows node_modules to macOS. Node.js 24 and npm are required.

The latest task is implemented in source as described in README and docs/PROGRESS.md. The previous Wine milestone is superseded by the user's explicit native-only 2.0 specification. Old 0.4 executables/archives may remain in release/handoff for recovery; they are not the new application.

Copy your library only deliberately and back it up first. Absolute install paths are device-specific and Steam will be rescanned. Reconnect Steam credentials on each device: encrypted secrets cannot be assumed portable. Custom public feeds can be registered again. No passwords or keys are bundled in the source handoff.

Windows build: `npm run package:win`. Mac build (on the Mac): `npm run package:mac`. See MAC-SETUP.md for the native workflow and hardware validation checklist.
