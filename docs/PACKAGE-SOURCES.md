# Custom package sources

Register a public HTTPS feed under Settings → Authorized package sources. The runtime validates the contract in `package-source.schema.json` and additional filename/path/size/platform rules. Feed errors are shown in Settings; refresh failures retain the previous packages. Disabling/removing a feed prevents new selections, while already-created jobs retain their exact package metadata.

A complete feed has this structure (this is documentation, not a working source or a bundled download):

```json
{
  "version": 1,
  "id": "publisher-id",
  "name": "Publisher name",
  "description": "Publisher-authorized packages",
  "packages": []
}
```

Each package requires `id`, `gameId`, `title`, `version`, `type`, `platforms`, exact `bytes`, public HTTPS `url`, `sha256` (64 hexadecimal characters), `filename`, `install`, and `authorization`. `steamAppId` optionally associates it with a Steam catalog detail page; it does not confer Steam ownership.

- `type`: `archive`, `installer`, `drm-free`, or `multiplayer`.
- `platforms`: one or both of `windows`, `mac`.
- ZIP: `install: {"method":"zip","executable":"relative/path/game.exe"}` (or `Game.app` on Mac). Only forward-slash relative paths; no traversal, symlinks, device names, absolute paths or duplicate case-insensitive entries. Uncompressed extraction is bounded by free disk space and 100 GiB.
- Native installer: `install: {"method":"installer"}` with `.exe`/`.msi` on Windows or `.pkg`/`.dmg` on Mac. Explicit approval is required; after the installer finishes, choose the installed target. Ember does not infer installer success or own its installation folder.
- `authorization`: nonempty `license` and `distribution` explanation, plus public HTTPS `url` for the permission/license terms. This is publisher-provided metadata, not verification by Ember.

File size and checksum must describe the exact downloadable bytes. HTTP content encoding is rejected. HTTPS redirects are checked and local/private destination IPs blocked. Range resume requires matching Content-Range; if the server ignores Range, the transfer restarts from zero. A mismatch in SHA-256 removes the corrupt partial file and blocks install.

ZIP games are published into a unique `Ember-<uuid>` directory below the chosen parent only after extraction and native-target validation. Managed uninstall removes only the matching marked installation directory after confirmation. Canceling a partial download asks before deleting bytes. Partial jobs recover as paused after restart. External installer targets can be removed from the library but should be uninstalled through the OS.

No private credentials or signed access-token URLs should be placed in feeds. Feed URLs and public package metadata are stored locally. The current downloader does not implement OAuth, torrents, arbitrary scripts, password-protected archives or automatic updates.
