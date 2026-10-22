import { belongsInLibrary, dismissedDiscovery } from "./library-membership";
import type { Game } from "./types";
import type { CatalogGame, Preferences } from "./v2types";
import { quality, recommendationScore } from "./recommendations";
export const lastActivity = (g: Game) =>
  Math.max(
    g.steam?.lastPlayed ? g.steam.lastPlayed * 1000 : 0,
    Date.parse(g.lastPlayed || "") || 0,
    Date.parse(g.lastLaunchRequested || "") || 0,
  );
export const hasPlayHistory = (g: Game) =>
  g.seconds > 0 || (g.steam?.playtimeMinutes || 0) > 0 || lastActivity(g) > 0;
export function homeSelection(
  games: Game[],
  catalog: Record<string, CatalogGame>,
  preferences: Preferences,
  visits: number,
  running: string[] = [],
) {
  const dismissedIds = new Set(games.filter(dismissedDiscovery).map(g => g.steamId || g.catalogId));
  games = games.filter(belongsInLibrary);
  const playedIds = new Set(
    games
      .filter(hasPlayHistory)
      .map((g) => g.steamId || g.catalogId)
      .filter(Boolean),
  );
  const unplayed = (g: Game) => !hasPlayHistory(g) && !playedIds.has(g.steamId);
  const recommendations = [...new Map(Object.values(catalog).map(m=>[m.steamAppId||m.appId,m])).values()]
    .filter((m) => Boolean(m.discoveryList) && (!m.productType||m.productType==='game') && !playedIds.has(m.steamAppId||m.appId) && !dismissedIds.has(m.steamAppId||m.appId) && quality(m, preferences))
    .sort(
      (a, b) =>
        recommendationScore(b, games, catalog) -
          recommendationScore(a, games, catalog) ||
        a.appId.localeCompare(b.appId),
    );
  const recent = games
    .filter((g) => g.installed && Boolean(g.lastLaunchRequested || g.lastPlayed))
    .sort((a, b) => Math.max(Date.parse(b.lastLaunchRequested||'')||0,Date.parse(b.lastPlayed||'')||0)-Math.max(Date.parse(a.lastLaunchRequested||'')||0,Date.parse(a.lastPlayed||'')||0));
  const recentPick = recent.find((g) => !running.includes(g.id));
  const candidates = games
    .filter(
      (g) =>
        unplayed(g) &&
        !running.includes(g.id) &&
        (!g.steamId ||
          !catalog[g.steamId] ||
          quality(catalog[g.steamId], preferences)),
    )
    .sort(
      (a, b) =>
        Number(Boolean(b.installed)) - Number(Boolean(a.installed)) ||
        a.id.localeCompare(b.id),
    );
  const rotation = Math.floor(Math.max(0, visits - 1) / 2);
  const discovery = [...new Map(Object.values(catalog).filter(m=>!playedIds.has(m.steamAppId||m.appId)&&!dismissedIds.has(m.steamAppId||m.appId)&&quality(m,preferences)).map(m=>[m.steamAppId||m.appId,m])).values()];
  const newGame = !discovery.length && candidates.length
    ? candidates[rotation % candidates.length]
    : undefined;
  const discoveryMeta = newGame?.steamId
    ? catalog[newGame.steamId]
    : !newGame && discovery.length
      ? discovery[rotation % discovery.length]
      : undefined;
  const discover =
    Boolean(newGame || discoveryMeta) && (!recentPick || visits % 2 === 0);
  const heroGame = discover ? newGame : recentPick;
  const heroMeta = discover
    ? discoveryMeta
    : heroGame?.steamId
      ? catalog[heroGame.steamId]
      : undefined;
  return { recommendations, recent, recentPick, heroGame, heroMeta, discover };
}
