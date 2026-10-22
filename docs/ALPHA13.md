# Alpha 13 — dashboard and game details

- Home discovery includes the combined download catalog. Recently Played uses Ember launch/session timestamps. Recommendations come only from cached Coming Soon and Top Sellers entries, scored against Steam and Ember history; played and dismissed titles are excluded.
- All Games pages through all enabled bundled/imported sources, grouping release variants by normalized title and matching exact Steam titles where possible. This is heuristic deduplication, not a verified universal game identity database.
- Steam's asset API supplies exact hashed portrait URLs. Legacy portrait URLs and store headers remain fallbacks. Unmatched titles still show their full title when no verified artwork is available; complete artwork coverage is not guaranteed.
- Bloodborne and God of War III Remastered use official PlayStation purchase pages and bundled artwork. Unknown unmatched titles are not assigned speculative purchase links.
- All Games, Coming Soon and Top Sellers use an intersection-based loader with three animated dots, reduced-motion support and retry on failure. Genre buttons open All Games with the genre selected. Free Steam games do not offer community Download.
- Game details play available Steam MP4/WebM/HLS trailers. Steam metadata and video availability remain external dependencies.
- Closing hides Ember in the system tray. The tray menu has Open Ember and Quit Ember. Quit pauses transfers using the existing safe shutdown flow.
- Every 15 seconds, completed downloads are checked for game executables and matching Windows uninstall-registry installation directories. A unique candidate must remain stable across checks before registration. Installers/crash helpers are excluded. Ambiguous or unrecorded install locations need Find installed game. Download completion alone does not mean installation completion; Ember does not run installers automatically.

## Ranking source limitation

Both supplied SteamDB URLs returned HTTP 403 to direct desktop requests in this environment. Ember attempts SteamDB and labels the official Steam fallback explicitly. The fallback uses popular-wishlist search and regional Steam top-seller ordering; it must not be described as verified SteamDB global ordering. No challenge bypass is attempted.

## Validation

Unit coverage includes Home selection, cross-source grouping, exact Steam artwork paths, modern trailers/free status, and executable discovery, plus the existing download/storage tests. Electron checks cover all eight pages, screenshot navigation, launch/persistence, automatic paging on All Games/Coming Soon, genre navigation, free-game buttons, tray close/reopen, detected-install Play, and shutdown/relaunch. Six-catalog import and restart preserve 26,115 release options. Tests use fixtures and a harmless OS executable, not commercial game installs.

Windows package only. macOS packaging and native install detection have not been verified on a Mac in this run.
