# Ember 2 architecture

Electron main is the privileged coordinator; the sandboxed React renderer has an allowlisted IPC bridge, no Node integration, no renderer network fetch, no arbitrary shell interface and no automatic remote navigation. Artwork URLs and public catalog images have constrained protocols/hosts. Existing JSON library storage and Steam parsing were retained.

- `desktop/main.ts`: lifecycle, migrations, trusted IPC, OS dialogs, Steam handoff, native launch/session tracking, setup workflows.
- `desktop/library.ts`: atomic validated library JSON with backup; `desktop/state.ts`: separate catalog/preferences/source/queue state.
- `desktop/steam.ts`, `steam-types.ts`, `steam-dashboard.ts`, `artwork.ts`: actual manifests, app classification, local account data, Valve descriptions/Deck, cached art.
- `desktop/ownership.ts`: official GetOwnedGames parsing; main encrypts the supplied API key with safeStorage. Ownership and installation are independent.
- `desktop/catalog.ts`: bounded public Steam adapter, metadata cache, search pagination and original ranking positions. Optional HTTPS index takes the same paging query and returns `{appIds: string[], total_count?: number}`; metadata is still verified with Valve. This is an integration contract, not a deployed complete indexing backend.
- `desktop/http.ts`: public HTTPS, DNS address filtering, literal-IP filtering, redirect validation, inactivity timeout, bounded JSON.
- `desktop/sources.ts`: strict package validation and feed acquisition; `downloads.ts`: streamed bytes, queue/recovery/ranges/checksum; `installations.ts`: staged ZIP extraction, bounds and marker-controlled deletion.
- `desktop/platform.ts` and `mac.ts`: native launch plan and executable format checks. There is no active Wine or graphics-engine module.
- `src/main.tsx`, `v2.css`, `recommendations.ts`: eight pages, library/discovery UI, source selection and actual download controls; `SteamDetails.tsx` preserves achievements and descriptions.

Secrets never cross back into renderer snapshots. Feed URLs must be public and must not embed credentials. State files may include public package URLs; do not register feeds containing private tokens. No downloader disables OS security features.

Limitations: storefront endpoints can change or rate-limit; network metadata failures are not evidence of incompatibility. Owned-game verification needs user credentials/privacy access. No fabricated catalog, rankings, download availability, or simulated transfer progress is used. No source licenses or code signatures are inferred from a feed's claims. ZIP symlinks are unsupported. External installer completion is not inferred from launching it: the user selects an installed target afterwards. Child-process runtime may undercount launchers that spawn and immediately exit.
