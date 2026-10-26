# Catalog update — October 25, 2026

Imported the four supplied pasted JSON catalogs. Each contained a trailing `Explain` line outside the JSON object; that line was removed as pasted text, not treated as a launcher instruction. The original attachments were not modified.

| Source shown in Ember | New release entries | Existing entries updated | Older omitted entries retained |
| --- | ---: | ---: | ---: |
| fitgirl | 23 | 0 | 8 |
| SteamRip | 4 | 23 | 0 |
| onlinefix | 14 | 50 | 0 |
| Kazumi (David Kazumi) | 2,055 | 0 | 0 |

These are catalog release rows, not an exact count of unique games: editions, versions and providers can overlap. Incoming rows replace existing rows with the same exact title; titles omitted from this batch remain available. DODI, GOG and KaOsKrew catalog files were not changed.

Kazumi is the exact name in the supplied JSON. It is a new default bundled snapshot for all users of the updated build. No provider-maintained feed address was supplied. Its configured origin identifies Ember's GitHub copy, and snapshot-only mode avoids attempting an unverified provider refresh. To update this source later, supply a newer catalog or a verified live feed URL.

Catalog revision 4 upgrades existing defaults at normal startup. It preserves source IDs used by download records, enable/disable choices, unrelated custom sources, older valid download options and unchanged source catalogs. The three refreshed providers retain their existing configured refresh URLs. Existing users receive the data migration when they run the updated build; already installed applications are not changed merely by pushing source code.

Verification:

- All seven bundled catalogs parse offline with their supplied names.
- Every raw release title has at least one supported HTTPS or sanitized magnet option.
- There are 28,204 parsed download options across all seven bundled sources. This is not a unique-game count or a live availability guarantee.
- Unit coverage checks migration preservation and repeat upgrades.
- The Electron import test imports all seven catalogs through IPC and checks that all 28,204 options survive restart.
- `node --import tsx scripts/check-bundled-catalogs.mts` prints per-source row, option and title coverage counts.

The structured import summary is in `data/catalog-update-2026-10-25.json`.
