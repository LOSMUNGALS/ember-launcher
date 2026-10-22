import { jsonHttps } from "./http";
export interface OwnedGame {
  id: string;
  name: string;
  minutes: number;
  lastPlayed?: number;
}
export function parseOwned(raw: any): OwnedGame[] {
  const r = raw?.response;
  if (
    !r ||
    !Number.isSafeInteger(r.game_count) ||
    r.game_count < 0 ||
    (r.game_count > 0 && !Array.isArray(r.games))
  )
    throw Error(
      "Steam did not return an accessible owned-games library. Check account privacy.",
    );
  const games = r.games || [];
  if (games.length !== r.game_count)
    throw Error("Incomplete ownership response.");
  return games.map((g: any) => {
    if (
      !Number.isSafeInteger(g.appid) ||
      g.appid <= 0 ||
      !Number.isSafeInteger(g.playtime_forever) ||
      g.playtime_forever < 0
    )
      throw Error("Invalid owned-game record.");
    return {
      id: String(g.appid),
      name: String(g.name || "Steam game " + g.appid).slice(0, 200),
      minutes: g.playtime_forever,
      lastPlayed:
        Number.isSafeInteger(g.rtime_last_played) && g.rtime_last_played > 0
          ? g.rtime_last_played
          : undefined,
    };
  });
}
export async function ownedGames(steamId: string, key: string) {
  if (!/^7656119\d{10}$/.test(steamId) || !/^[a-f0-9]{32}$/i.test(key))
    throw Error(
      "Enter a 17-digit SteamID64 and a 32-character Steam Web API key.",
    );
  try {
    return parseOwned(
      await jsonHttps(
        `https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=${key}&steamid=${steamId}&include_appinfo=1&include_played_free_games=1&format=json`,
      ),
    );
  } catch {
    throw Error(
      "Unable to verify ownership with Steam. Check the API key, SteamID64, public Game details, and connection.",
    );
  }
}
