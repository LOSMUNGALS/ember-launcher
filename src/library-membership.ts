import type { Game } from "./types";
export const belongsInLibrary = (g: Game) => g.store === "local" || Boolean(g.owned || g.installed || g.saved);
export const dismissedDiscovery = (g: Game) => g.store === "steam" && g.saved === false && !g.owned && !g.installed;
