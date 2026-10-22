import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Game } from "../src/types";
export function artworkFile(url: string, directory: string): string | null {
  const match =
    /^ember-art:\/\/library\/(steam-\d+-(?:cover|hero|logo)\.(?:jpg|png|webp))$/.exec(
      url,
    );
  return match ? path.join(directory, match[1]) : null;
}
export function bannerColor(bitmap: Buffer): string {
  const buckets = new Map<
    string,
    { weight: number; r: number; g: number; b: number }
  >();
  for (let i = 0; i + 3 < bitmap.length; i += 4) {
    const [b, g, r, a] = bitmap.subarray(i, i + 4);
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    if (a < 200 || max < 25 || min > 220) continue;
    const key = [r, g, b].map((x) => Math.floor(x / 48)).join(",");
    const weight = 1 + (max - min) / 80;
    const v = buckets.get(key) || { weight: 0, r: 0, g: 0, b: 0 };
    v.weight += weight;
    v.r += r * weight;
    v.g += g * weight;
    v.b += b * weight;
    buckets.set(key, v);
  }
  const best = [...buckets.values()].sort((a, b) => b.weight - a.weight)[0];
  if (!best) return "#263338";
  const rgb = [best.r, best.g, best.b].map((v) => v / best.weight);
  const scale = Math.min(0.72, 100 / Math.max(...rgb));
  return (
    "#" +
    rgb
      .map((v) =>
        Math.round(v * scale)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
export async function importSteamArtwork(
  root: string,
  games: Game[],
  destination: string,
  color?: (bytes: Buffer) => string,
) {
  await mkdir(destination, { recursive: true });
  for (const game of games) {
    if (!game.steamId || !/^\d+$/.test(game.steamId)) continue;
    const cache = path.join(root, "appcache", "librarycache");
    const appdir = path.join(cache, game.steamId);
    let directories = [appdir];
    try {
      const children = await readdir(appdir, { withFileTypes: true });
      directories.push(
        ...children
          .filter((d) => d.isDirectory() && /^[a-f0-9]{40}$/i.test(d.name))
          .map((d) => path.join(appdir, d.name)),
      );
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    for (const [kind, stems] of [
      ["cover", ["library_600x900", "library_capsule"]],
      ["hero", ["library_hero", "library_header", "header"]],
      ["logo", ["logo"]],
    ] as const) {
      const candidates = stems.flatMap((stem) =>
        ["jpg", "png", "webp"].flatMap((ext) => [
          ...directories.map((dir) => path.join(dir, `${stem}.${ext}`)),
          path.join(cache, `${game.steamId}_${stem}.${ext}`),
        ]),
      );
      for (const source of candidates) {
        let bytes: Buffer;
        try {
          if ((await stat(source)).size > 10 * 1024 * 1024) continue;
          bytes = await readFile(source);
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
          throw e;
        }
        const ext =
          bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
            ? "jpg"
            : bytes
                  .subarray(0, 8)
                  .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
              ? "png"
              : bytes.toString("ascii", 0, 4) === "RIFF" &&
                  bytes.toString("ascii", 8, 12) === "WEBP"
                ? "webp"
                : null;
        if (!ext) continue;
        const file = `steam-${game.steamId}-${kind}.${ext}`;
        await writeFile(path.join(destination, file), bytes, { mode: 0o600 });
        game[kind === "cover" ? "artwork" : kind] =
          `ember-art://library/${file}`;
        if (kind === "hero" && color) game.themeColor = color(bytes);
        break;
      }
    }
  }
}
