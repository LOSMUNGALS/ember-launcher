import { mkdir, readFile, writeFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Game } from "../src/types";
export function artworkFile(url: string, directory: string): string | null {
  const custom=/^ember-art:\/\/library\/(custom-[a-f0-9-]{36}\.png)$/.exec(url);if(custom)return path.join(directory,custom[1]);
  const match =
    /^ember-art:\/\/library\/(steam-\d+-(?:cover|hero|logo)\.(?:jpg|png|webp))$/.exec(
      url,
    );
  return match ? path.join(directory, match[1]) : null;
}
export {bannerColor} from "../src/artwork-color";
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
