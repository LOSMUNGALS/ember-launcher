# Ember 2.0 implementation plan

Existing architecture: Electron main/preload, React + TypeScript renderer, Vite/esbuild, atomic JSON library storage. Existing Steam integration discovers local manifests and reads cached statistics; it does not establish ownership. Downloads previously delegated to external installers. Keep this architecture and preserve existing data, artwork and achievements.

1. Extend the data model with explicit ownership, installed/saved state and catalog metadata. Replace active Wine routes with native-only platform enforcement; preserve legacy paths as data, not executable Wine settings.
2. Add Steam owned-library synchronization using a user-supplied Web API key encrypted with Electron safeStorage. Without verified account data, local installations remain visible in Library as ownership-unverified, not Steam Library.
3. Add a bounded, persistent Steam discovery/catalog adapter, actual review metadata, content/quality filters, recommendations and hourly ranked-feed refresh. Document limits instead of inventing full coverage or rankings.
4. Add validated HTTPS JSON package sources, persistent byte-based download queue, pause/resume/recovery/checksum verification and safe explicit installation workflows.
5. Reuse the visual theme and achievement components with the exact requested navigation. All visible controls must invoke real functionality.
6. Test parsing/migration, native-only enforcement, filtering, source validation, real byte transfer/resume/integrity, archive traversal protection, and desktop navigation. Build runnable release and updated source handoff.

External gates: Steam credentials/account privacy, provider coverage, developer package permissions, macOS hardware execution and code signing cannot be inferred from unit tests. Keep them explicit.

Status: services, native-only migration, UI, queue and isolated tests implemented. See PROGRESS.md for live evidence and explicit external gates; alpha release preparation follows the final checks.
