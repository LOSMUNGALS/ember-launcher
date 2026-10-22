# Download sources — alpha.10

The six supplied full catalogs are bundled with the app. On the first normal launch after upgrading, the former built-in archive/mirror sources are replaced. Custom sources and download records are retained. Subsequent launches preserve source removals. Names come directly from each catalog's name field, not hardcoded UI labels.

Settings > Download sources > Import JSON files accepts one or more full catalogs. A descriptor configures a URL but contains no releases. Full catalogs are stored in Ember's persistent state and survive restart. Reimport replaces the same named source rather than duplicating it. Imported standalone catalogs are local snapshots; existing known sources retain their online refresh URL. Online refresh failures preserve loaded data and display an error. There are no mirror substitutions.

The six hydralinks.cloud URLs returned HTTP 403 challenge pages during direct validation. Bundled/local catalogs work independently of that restriction. Updating a URL does not bypass the site's challenge. To update blocked feeds, download the actual JSON through your browser and import it.

## Download steps and troubleshooting

1. Close the old app and open Ember 2.0.0-alpha.10.exe.
2. Open Settings > Download sources. All six catalogs should have nonzero option counts.
3. Cancel old stuck archive jobs. They retain their original release and cannot be automatically replaced by a different version.
4. Open a game > Download and choose a release from the new catalog. Choose a folder.
5. Torrent options download in Ember. The engine now retains up to 12 UDP trackers from the magnet, resolves each to a public IPv4 address before use, and adds OpenTrackr plus DHT discovery. Arbitrary web seeds and HTTP trackers are not followed. No seeding continues after completion.
6. File-host options open an isolated download window. Complete host prompts and click its actual download link. Selecting a listing alone does not skip host login, queues, CAPTCHA, subscription requirements or download buttons.
7. If a torrent has zero peers or times out, try a different release. If all torrents fail, check firewall permission for Ember and whether the current network blocks peer traffic; do not disable the firewall. A release without seeders cannot be repaired by the launcher.
8. If the host reports a removed file or cannot load, choose another host/release. Interrupted host transfers can be retried from a fresh window. Partial torrent files remain for rechecking/resume. Community files are not auto-installed: use Open download folder when finished.

## Validation

55 tests passed, including real exact-byte transfers via a local UDP tracker, direct peers, and verified HTTPS fixtures, plus an unavailable-peer failure. The separate Electron host fixture saved its exact payload to the selected directory. The desktop import test loaded all six catalogs (26,115 options) through IPC and verified persistence across restart. Individual commercial releases and every external host are not tested or guaranteed available. Native-only macOS rules still apply.

Run: npm test; node scripts/verify-host-transfer.mjs; node scripts/verify-catalog-import.mjs; npm run smoke.

## Counts

Run npx tsx scripts/audit-catalogs.ts. The supplied files contain 26,149 records, 25,694 exact distinct release-title strings, and 26,115 parsed download options after per-source duplicate-link elimination. Every individual record yields at least one supported link; lower counts in some sources are deduplication, not rejected games.

The title normalization heuristic yields 15,476 candidate game groups. This is an estimate, not an exact unique-game identity count: catalogs have no common game IDs, and versions, bundles, editions and spelling variants cannot be resolved unambiguously from titles alone. See artifacts/catalog-audit.json and artifacts/catalog-title-groups.json for reproducible results.

WebTorrent/fs-chunk-store are MIT licensed. The transitive ip advisory concerns the tracker server UDP parser; the launcher uses the client, not the server. No claim of a security audit or universal download compatibility is made. Windows portable builds are unsigned; Mac execution remains untested on hardware.

## alpha.11 performance
Torrent bandwidth is explicitly unlimited; prior defaults were also unlimited. Actual throughput depends on available peers/host and network/disk. The concurrent limit is a job count, not a speed cap. Unchanged source catalogs are omitted from routine IPC snapshots. Progress checkpoints run every 15 seconds; pause/completion still persist immediately. Lost progress counters after a crash are recovered by rechecking torrent pieces. Source refresh errors appear only under collapsed Settings diagnostics, not in the picker.

