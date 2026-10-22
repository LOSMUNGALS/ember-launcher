# Ember 1.0 exports

Exported on 22 October 2026 following the user's export signal. Application version: **1.0.0**. Application code is the verified `9186d84` revision; `813d26a` adds the native Mac export workflow without changing application code.

| Platform | File in `release/` | Validation |
|---|---|---|
| Windows 10/11 x64 | `Ember-Setup-1.0.0.exe` | NSIS build, packaged-app smoke, installer size and SHA-512 against `latest.yml` |
| Mac Apple Silicon | `Ember-1.0.0-arm64-mac.zip` | Native macOS build, 85 launcher tests, 10 account tests, source launch smoke, archive integrity and executable architecture |

Mac build evidence and downloadable artifact: [successful native export](https://github.com/LOSMUNGALS/ember-launcher/actions/runs/39820158854). The GitHub Actions artifact is retained for 30 days, until 21 November 2026. Save the ZIP locally for longer retention. The workflow can be rerun from Actions or triggered by changing its workflow file on the development branch.

Windows: run the installer. Mac: unzip and move `Ember.app` to Applications. This Mac package targets M1/M2/M3 and later Apple Silicon; it is not an Intel package. Windows and Mac exports are unsigned; the Mac export is not notarized. Native CI checks do not certify every Mac game or real-device gameplay.

`SHA256-windows.txt` and `SHA256-mac.txt` accompany the files. Keep the Windows `.exe`, `.exe.blockmap` and `latest.yml` from the same build together for future updater publication. No GitHub release or update was automatically published by exporting these files.

## Account service

These exports retain the existing default account-service address: `http://127.0.0.1:4783`. Start the account service on the same machine, or configure the launcher for your hosted HTTPS account service. Packaging does not host the backend or transfer accounts. A public shared deployment still needs that hosted service. See [account setup](ACCOUNTS.md).

The [verification report](RELEASE-VERIFICATION.md) records remaining artwork and external game-installation coverage. The native Mac CI result above now adds successful Mac tests/build/smoke evidence to that earlier report.

## Rebuild

On Windows, use Node.js 24 and run `npm ci`, then `npm run package:installer`. On macOS, run `npm ci`, then `npm run package:mac -- --publish never`. The Mac packager requires macOS; use the native workflow from a Windows development computer. Do not copy Windows `node_modules` onto a Mac.
