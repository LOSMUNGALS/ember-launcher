import type { Game } from "../src/types";
export type CloudGame = {
  key: string;
  name: string;
  catalogId?: string;
  steamId?: string;
  saved: boolean;
  favorite: boolean;
  hidden: boolean;
  collections: string[];
  playStatus: "backlog" | "playing" | "finished";
};
export function cloudKey(
  g: Pick<Game, "steamId" | "catalogId" | "id" | "syncKey">,
) {
  return g.syncKey && /^[\w-]{1,220}$/.test(g.syncKey)
    ? g.syncKey
    : g.steamId
      ? "steam-" + g.steamId
      : g.catalogId
        ? /^\d+$/.test(g.catalogId)
          ? "steam-" + g.catalogId
          : "catalog-" + g.catalogId
        : "local-" + g.id;
}
export function cloudGames(games: Game[]): CloudGame[] {
  const entries = new Map<string, CloudGame>();
  for (const g of games.filter(
    (g) =>
      g.saved ||
      g.favorite ||
      g.hidden ||
      g.collections?.length ||
      g.playStatus,
  )) {
    const key = cloudKey(g),
      old = entries.get(key),
      status = g.playStatus || "backlog";
    const collections = [
      ...new Set([...(old?.collections || []), ...(g.collections || [])]),
    ];
    if (collections.length > 20)
      throw Error(
        g.name +
          " has more than 20 combined collections across its installations. Consolidate them before backing up.",
      );
    entries.set(key, {
      key,
      name: old?.name || g.name,
      catalogId: old?.catalogId || g.catalogId,
      steamId: old?.steamId || g.steamId,
      saved: !!g.saved || !!old?.saved,
      favorite: !!g.favorite || !!old?.favorite,
      hidden: !!g.hidden || !!old?.hidden,
      collections,
      playStatus:
        old?.playStatus === "playing" || status === "playing"
          ? "playing"
          : old?.playStatus === "finished" || status === "finished"
            ? "finished"
            : "backlog",
    });
  }
  return [...entries.values()];
}
export function restoreCloud(games: Game[], entries: CloudGame[]) {
  for (const entry of entries) {
    let matches = games.filter((g) => cloudKey(g) === entry.key);
    if (!matches.length) {
      const game: Game = {
        id: "cloud-" + Buffer.from(entry.key).toString("hex"),
        syncKey: entry.key,
        name: entry.name,
        executable: "",
        args: [],
        store: entry.steamId ? "steam" : "local",
        steamId: entry.steamId,
        catalogId: entry.catalogId,
        description: "",
        platform: "native",
        seconds: 0,
        added: new Date().toISOString(),
        installed: false,
      };
      games.push(game);
      matches = [game];
    }
    for (const game of matches)
      Object.assign(game, {
        saved: entry.saved,
        favorite: entry.favorite,
        hidden: entry.hidden,
        collections: [...entry.collections],
        playStatus: entry.playStatus,
      });
  }
}
