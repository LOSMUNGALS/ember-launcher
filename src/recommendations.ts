import type { CatalogGame, Preferences } from "./v2types";
import type { Game } from "./types";
export function quality(g: CatalogGame, p: Preferences) {
  if (g.content !== "allowed") return false;
  const r = g.reviews;
  if (!r || r.total < p.minimumReviews) return true;
  return r.total > 0 && (r.positive / r.total) * 100 >= p.minimumPositive;
}
export function recommendationScore(
  g: CatalogGame,
  library: Game[],
  catalog: Record<string, CatalogGame>,
) {
  let relevance = 0;
  for (const owned of library) {
    const meta = owned.steamId && catalog[owned.steamId];
    if (!meta) continue;
    const minutes = (owned.steam?.playtimeMinutes || 0) + owned.seconds / 60;
    const overlap = g.genres.filter((x) => meta.genres.includes(x)).length;
    const recency = owned.steam?.lastPlayed
      ? Math.max(0, 1 - (Date.now() / 1000 - owned.steam.lastPlayed) / 2592000)
      : 0;
    relevance += overlap * (Math.log1p(minutes) + recency);
  }
  const r = g.reviews;
  return (
    relevance +
    (r && r.total
      ? ((r.positive + 5) / (r.total + 10)) * Math.log1p(r.total)
      : 0)
  );
}
