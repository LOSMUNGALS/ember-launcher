import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import type { Game } from "../src/types";
import { readAppTypes, isPlayableEntry } from "./steam-types";
export function manifestGame(text: string, root: string): Game | null {
  const field = (key: string) =>
    text.match(new RegExp(`"${key}"\\s+"([^"\\r\\n]*)"`, "i"))?.[1];
  const id = field("appid"),
    name = field("name"),
    dir = field("installdir");
  if (
    !id ||
    !/^\d+$/.test(id) ||
    !name ||
    !dir ||
    dir.includes("..") ||
    /[\\/]/.test(dir)
  )
    return null;
  return {
    id: `steam-${id}`,
    steamId: id,
    name,
    executable: path.join(root, "steamapps", "common", dir),
    args: [],
    store: "steam",
    platform: "native",
    seconds: 0,
    installed: true,
    owned: false,
    description:
      "Imported from Steam. Steam manages installation and launch. Ownership is verified separately.",
    added: new Date().toISOString(),
  };
}
export async function scanSteam(root: string): Promise<Game[]> {
  const roots = new Set([root]);
  try {
    const vdf = await readFile(
      path.join(root, "steamapps", "libraryfolders.vdf"),
      "utf8",
    );
    for (const match of vdf.matchAll(/"path"\s+"([^"\r\n]+)"/g))
      roots.add(match[1].replace(/\\\\/g, "\\"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  const games = new Map<string, Game>();
  for (const dir of roots) {
    let files: string[];
    try {
      files = await readdir(path.join(dir, "steamapps"));
    } catch (e) {
      if (dir === root)
        throw new Error("Choose the Steam folder containing steamapps.");
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw e;
    }
    for (const file of files.filter((f) => /^appmanifest_\d+\.acf$/.test(f))) {
      const text = await readFile(path.join(dir, "steamapps", file), "utf8");
      const game = manifestGame(text, dir);
      const flags = Number(text.match(/"StateFlags"\s+"(\d+)"/i)?.[1] || 0);
      if (
        game &&
        flags & 4 &&
        (await stat(game.executable)
          .then((s) => s.isDirectory())
          .catch(() => false))
      )
        games.set(game.id, game);
    }
  }
  const types = await readAppTypes(
    root,
    new Set([...games.values()].map((g) => g.steamId!)),
  );
  return [...games.values()]
    .map((g) => ({ ...g, productType: types.get(g.steamId!) }))
    .filter(isPlayableEntry);
}
