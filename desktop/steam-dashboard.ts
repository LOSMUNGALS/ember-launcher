import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { SteamDashboard, SteamAchievement } from "../src/types";

// A bounded text KeyValues parser, not a regex spanning neighbouring app records.
export function parseVdf(text: string): Record<string, any> {
  if (text.length > 16 * 1024 * 1024)
    throw Error("Steam configuration exceeds limit.");
  const tokens = text.match(/"(?:\\.|[^"\\])*"|[{}]|\/\/[^\r\n]*/g) || [];
  let index = 0;
  const token = () => {
    while (tokens[index]?.startsWith("//")) index++;
    return tokens[index++];
  };
  const unquote = (x: string) => x.slice(1, -1).replace(/\\([\\"])/g, "$1");
  function object(depth: number, nested: boolean): Record<string, any> {
    if (depth > 40) throw Error("Steam configuration nesting exceeds limit.");
    const result = Object.create(null);
    for (;;) {
      const k = token();
      if (k === undefined) {
        if (nested) throw Error("Truncated Steam configuration.");
        return result;
      }
      if (k === "}") {
        if (!nested) throw Error("Unexpected closing brace.");
        return result;
      }
      if (!k.startsWith('"')) throw Error("Invalid Steam key.");
      const v = token();
      if (!v) throw Error("Missing Steam value.");
      result[unquote(k).toLowerCase()] =
        v === "{"
          ? object(depth + 1, true)
          : v.startsWith('"')
            ? unquote(v)
            : (() => {
                throw Error("Invalid Steam value.");
              })();
    }
  }
  return object(0, false);
}
async function boundedRead(file: string, limit = 16 * 1024 * 1024) {
  if ((await stat(file)).size > limit)
    throw Error("Steam cache exceeds size limit.");
  return readFile(file, "utf8");
}
export async function steamAccounts(root: string): Promise<string[]> {
  return (
    await readdir(path.join(root, "userdata"), { withFileTypes: true }).catch(
      () => [],
    )
  )
    .filter((d) => d.isDirectory() && /^\d+$/.test(d.name) && d.name !== "0")
    .map((d) => d.name);
}
export function localPlaytimes(
  text: string,
): Record<string, { minutes?: number; lastPlayed?: number }> {
  const v = parseVdf(text);
  const apps = v.userlocalconfigstore?.software?.valve?.steam?.apps;
  const output: Record<string, { minutes?: number; lastPlayed?: number }> =
    Object.create(null);
  for (const [id, value] of Object.entries(apps || {})) {
    if (!/^\d+$/.test(id) || !value || typeof value !== "object") continue;
    const a = value as any;
    const number = (s: unknown) =>
      typeof s === "string" &&
      /^\d+$/.test(s) &&
      Number.isSafeInteger(Number(s))
        ? Number(s)
        : undefined;
    output[id] = {
      minutes: number(a.playtime),
      lastPlayed: number(a.lastplayed),
    };
  }
  return output;
}
export function iconUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length > 1500) return;
  try {
    const u = new URL(value);
    if (
      u.protocol === "https:" &&
      !u.username &&
      !u.password &&
      [
        "shared.steamstatic.com",
        "cdn.akamai.steamstatic.com",
        "steamcdn-a.akamaihd.net",
        "cdn.cloudflare.steamstatic.com",
        "community.akamai.steamstatic.com",
        "avatars.steamstatic.com",
      ].includes(u.hostname)
    )
      return u.href;
  } catch {}
}
export function plainText(html: unknown): string {
  if (typeof html !== "string") return "";
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    trade: "™",
    reg: "®",
    copy: "©",
    ndash: "–",
    mdash: "—",
    rsquo: "’",
    lsquo: "‘",
    ldquo: "“",
    rdquo: "”",
  };
  return html
    .slice(0, 300000)
    .replace(
      /\[(img|imgvid|video|previewyoutube)\b[^\]]*\][\s\S]*?\[\/\1\]/gi,
      "",
    )
    .replace(/\[\*\]/g, "\n• ")
    .replace(/\[\/(?:p|h[1-6]|list|olist|tr)\]/gi, "\n")
    .replace(
      /\[\/?(?:b|i|u|s|p|h[1-6]|list|olist|url|table|tr|td|th|quote|spoiler|code)(?:=[^\]]*)?\]/gi,
      "",
    )
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<(?:br\s*\/?|\/p|\/div|\/h[1-6]|\/li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (all, key: string) => {
      if (key.startsWith("#")) {
        const n =
          key[1].toLowerCase() === "x"
            ? parseInt(key.slice(2), 16)
            : Number(key.slice(1));
        return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
      }
      return entities[key.toLowerCase()] ?? all;
    })
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim()
    .slice(0, 20000);
}
export function cachedDetails(value: unknown): Partial<SteamDashboard> {
  if (!Array.isArray(value)) throw Error("Unrecognized Steam library cache.");
  const entry = (name: string) =>
    value.find((v) => Array.isArray(v) && v[0] === name)?.[1]?.data;
  const result: Partial<SteamDashboard> = {};
  const a = entry("achievements");
  if (a && typeof a === "object") {
    if (Number.isSafeInteger(a.nTotal) && a.nTotal >= 0)
      result.achievementTotal = a.nTotal;
    if (Number.isSafeInteger(a.nAchieved) && a.nAchieved >= 0)
      result.achievementUnlocked = a.nAchieved;
    const byId = new Map<string, SteamAchievement>();
    for (const key of ["vecUnachieved", "vecAchievedHidden", "vecHighlight"])
      for (const item of Array.isArray(a[key]) ? a[key].slice(0, 5000) : []) {
        if (typeof item?.strID !== "string" || typeof item.strName !== "string")
          continue;
        byId.set(item.strID, {
          id: item.strID.slice(0, 200),
          name: item.strName.slice(0, 500),
          description: plainText(item.strDescription).slice(0, 2000),
          icon: iconUrl(item.strImage),
          unlocked:
            typeof item.bAchieved === "boolean" ? item.bAchieved : undefined,
          unlockedAt:
            Number.isSafeInteger(item.rtUnlocked) && item.rtUnlocked > 0
              ? item.rtUnlocked
              : undefined,
          hidden: item.bHidden === true,
        });
      }
    result.achievements = [...byId.values()];
  }
  const description = entry("descriptions");
  const about = plainText(
    description?.strFullDescription || description?.strSnippet,
  );
  if (about) result.about = about;
  return result;
}
export async function readLocalDashboard(
  root: string,
  accountId: string,
  ids: string[],
) {
  if (!/^\d+$/.test(accountId)) throw Error("Invalid Steam account.");
  const config = path.join(root, "userdata", accountId, "config");
  const times = await boundedRead(path.join(config, "localconfig.vdf"))
    .then(localPlaytimes)
    .catch(() => null);
  const result = new Map<string, Partial<SteamDashboard>>();
  for (const id of ids) {
    if (!/^\d+$/.test(id)) continue;
    const details = await boundedRead(
      path.join(config, "librarycache", id + ".json"),
    )
      .then((x) => cachedDetails(JSON.parse(x)))
      .catch(() => null);
    if (!times?.[id] && !details) continue;
    const now = new Date().toISOString();
    result.set(id, {
      accountId,
      playtimeMinutes: times?.[id]?.minutes,
      lastPlayed: times?.[id]?.lastPlayed,
      localUpdated: now,
      ...details,
      ...(details?.about
        ? {
            aboutSource: `https://store.steampowered.com/app/${id}/`,
            aboutUpdated: now,
          }
        : {}),
    });
  }
  return result;
}
export function deckCategory(data: any, id: string): SteamDashboard["deck"] {
  if (data?.success !== 1 || String(data.results?.appid) !== id)
    throw Error("Steam Deck report unavailable.");
  const categories = [
    "unknown",
    "unsupported",
    "playable",
    "verified",
  ] as const;
  const n = data.results.resolved_category;
  if (!Number.isInteger(n) || n < 0 || n > 3)
    throw Error("Unrecognized Steam Deck rating.");
  return categories[n];
}
type FetchJson = (url: string) => Promise<any>;
export function validateSteamDashboard(s: SteamDashboard) {
  if (!s || typeof s !== "object") throw Error("Invalid Steam dashboard data.");
  for (const field of [
    "playtimeMinutes",
    "lastPlayed",
    "achievementTotal",
    "achievementUnlocked",
  ] as const)
    if (
      s[field] !== undefined &&
      (!Number.isSafeInteger(s[field]) || s[field]! < 0)
    )
      throw Error("Invalid Steam statistic.");
  if (s.accountId !== undefined && !/^\d+$/.test(s.accountId))
    throw Error("Invalid Steam account.");
  if (
    s.deck !== undefined &&
    !["unknown", "unsupported", "playable", "verified"].includes(s.deck)
  )
    throw Error("Invalid Steam Deck rating.");
  if (
    s.about !== undefined &&
    (typeof s.about !== "string" || s.about.length > 20000)
  )
    throw Error("Invalid Steam description.");
  if (
    s.aboutSource !== undefined &&
    !/^https:\/\/store\.steampowered\.com\/app\/\d+\/$/.test(s.aboutSource)
  )
    throw Error("Invalid description source.");
  for (const key of ["aboutUpdated", "localUpdated", "deckUpdated", "achievementUpdated"] as const)
    if (
      s[key] !== undefined &&
      (typeof s[key] !== "string" || !Number.isFinite(Date.parse(s[key]!)))
    )
      throw Error("Invalid Steam timestamp.");
  if (
    s.errors !== undefined &&
    (!Array.isArray(s.errors) ||
      s.errors.length > 10 ||
      s.errors.some((e) => typeof e !== "string" || e.length > 500))
  )
    throw Error("Invalid Steam errors.");
  if (s.achievements !== undefined) {
    if (!Array.isArray(s.achievements) || s.achievements.length > 15000)
      throw Error("Invalid achievements.");
    for (const a of s.achievements) {
      if (
        !a ||
        typeof a.id !== "string" ||
        a.id.length > 200 ||
        typeof a.name !== "string" ||
        a.name.length > 500 ||
        typeof a.description !== "string" ||
        a.description.length > 2000 ||
        (a.icon !== undefined && !iconUrl(a.icon)) ||
        (a.unlocked !== undefined && typeof a.unlocked !== "boolean") ||
        (a.hidden !== undefined && typeof a.hidden !== "boolean") ||
        (a.unlockedAt !== undefined &&
          (!Number.isSafeInteger(a.unlockedAt) || a.unlockedAt < 0))
      )
        throw Error("Invalid achievement.");
    }
  }
}
export async function steamJson(url: string): Promise<any> {
  // Callers construct fixed Valve endpoints. Never follow a cache-provided URL.
  const response = await fetch(url, {
    signal: AbortSignal.timeout(12000),
    redirect: "error",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw Error(`Steam returned HTTP ${response.status}.`);
  const reader = response.body?.getReader();
  if (!reader) throw Error("Empty Steam response.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 4 * 1024 * 1024) throw Error("Steam response exceeds limit.");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
export async function publicDashboard(
  id: string,
  previous: SteamDashboard = {},
  force = false,
  get: FetchJson = steamJson,
): Promise<SteamDashboard> {
  if (!/^\d+$/.test(id)) throw Error("Invalid Steam ID.");
  const result = { ...previous, errors: [] as string[] };
  const now = new Date().toISOString();
  const stale = (date?: string) =>
    !date ||
    !Number.isFinite(Date.parse(date)) ||
    Date.now() - Date.parse(date) > 86400000;
  if (force || stale(previous.aboutUpdated))
    try {
      const data = await get(
        `https://store.steampowered.com/api/appdetails?appids=${id}&l=english`,
      );
      const about = plainText(
        data[id]?.success && data[id].data?.about_the_game,
      );
      if (!about) throw Error("Description unavailable.");
      result.about = about;
      result.aboutSource = `https://store.steampowered.com/app/${id}/`;
      result.aboutUpdated = now;
    } catch {
      result.errors.push(
        "Steam description could not be refreshed; any cached text is retained.",
      );
    }
  if (force || stale(previous.deckUpdated))
    try {
      result.deck = deckCategory(
        await get(
          `https://store.steampowered.com/saleaction/ajaxgetdeckappcompatibilityreport?nAppID=${id}`,
        ),
        id,
      );
      result.deckUpdated = now;
    } catch {
      result.errors.push(
        "Steam Deck rating could not be refreshed; any cached rating is retained.",
      );
    }
  return result;
}

export async function onlineAchievements(id: string, steamId: string, key: string, previous: SteamDashboard = {}, get: FetchJson = steamJson): Promise<SteamDashboard> {
  if (!/^\d+$/.test(id) || !/^\d{17}$/.test(steamId) || !/^[a-f0-9]{32}$/i.test(key)) throw Error("Invalid Steam credentials.");
  const result = { ...previous, achievementUpdated: new Date().toISOString(), achievementMessage: "" };
  const query = new URLSearchParams({ appid: id, steamid: steamId, key, l: "english" });
  const [schema, player] = await Promise.allSettled([
    get("https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?" + query),
    get("https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?" + query),
  ]);
  const definitions = schema.status === "fulfilled" ? schema.value?.game?.availableGameStats?.achievements : undefined;
  const progress = player.status === "fulfilled" && player.value?.playerstats?.success === true ? player.value.playerstats.achievements : undefined;
  if (!Array.isArray(definitions)) {
    result.achievementMessage = "Steam achievement definitions are unavailable. Existing details are retained; try Refresh achievements.";
    return result;
  }
  const states = new Map<string, any>((Array.isArray(progress) ? progress : []).map((a: any) => [a.apiname, a]));
  result.achievements = definitions.map((a: any) => {
    const state = states.get(a.name);
    return { id: a.name, name: a.displayName || a.name, description: a.description || "", icon: iconUrl(a.icon), hidden: a.hidden === 1,
      unlocked: state && [0, 1].includes(state.achieved) ? state.achieved === 1 : undefined,
      unlockedAt: state?.achieved === 1 && Number.isSafeInteger(state.unlocktime) && state.unlocktime > 0 ? state.unlocktime : undefined };
  });
  result.achievementTotal = definitions.length;
  result.achievementUnlocked = Array.isArray(progress) && result.achievements.every(a => a.unlocked !== undefined) ? result.achievements.filter(a => a.unlocked).length : undefined;
  result.achievementMessage = Array.isArray(progress) ? "Updated from Steam." : "Achievement icons and descriptions loaded. Your unlock progress is private or unavailable on Steam.";
  validateSteamDashboard(result);
  return result;
}
