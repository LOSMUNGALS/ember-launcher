import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import path from "node:path";
import type { Library, Game, Settings } from "../src/types";
import { validateSteamDashboard } from "./steam-dashboard";
export const emptyLibrary = (): Library => ({
  version: 1,
  games: [],
  settings: { wine: "", prefix: "", graphics: "default" },
});
export function validateSettings(s: Settings) {
  if (
    !s ||
    typeof s.wine !== "string" ||
    typeof s.prefix !== "string" ||
    !["default", "wined3d", "dxvk"].includes(s.graphics)
  )
    throw new Error("Invalid compatibility settings.");
  for (const p of [s.wine, s.prefix])
    if (p && (!path.isAbsolute(p) || p.includes("\0")))
      throw new Error("Engine and prefix paths must be absolute.");
  if (
    s.windowsSteam !== undefined &&
    (typeof s.windowsSteam !== "string" ||
      (s.windowsSteam &&
        (!path.isAbsolute(s.windowsSteam) || s.windowsSteam.includes("\0"))))
  )
    throw new Error("Windows Steam path must be absolute.");
}
export function validateGame(g: Game) {
  if (g?.steam !== undefined) validateSteamDashboard(g.steam);
  if (
    g?.macWorkload !== undefined &&
    !["unknown", "light", "moderate", "heavy", "extreme"].includes(
      g.macWorkload,
    )
  )
    throw new Error("Invalid Mac workload.");
  if (
    g?.macOptimization !== undefined &&
    !["automatic", "unity"].includes(g.macOptimization)
  )
    throw new Error("Invalid Mac optimization adapter.");
  if (
    !g ||
    typeof g.id !== "string" ||
    !/^[\w-]+$/.test(g.id) ||
    typeof g.name !== "string" ||
    !g.name.trim() ||
    g.name.length > 200 ||
    typeof g.executable !== "string" ||
    (g.executable !== "" && !path.isAbsolute(g.executable)) ||
    (g.executable === "" && g.installed !== false) ||
    g.executable.includes("\0")
  )
    throw new Error("Invalid game name or executable path.");
  if (
    !Array.isArray(g.args) ||
    g.args.length > 100 ||
    g.args.some(
      (a) => typeof a !== "string" || a.includes("\0") || a.length > 8192,
    )
  )
    throw new Error("Arguments must be a JSON array of strings.");
  if (
    !["local", "steam", "epic", "gog"].includes(g.store) ||
    !["native", "windows"].includes(g.platform) ||
    typeof g.description !== "string" ||
    g.description.length > 10000 ||
    !Number.isFinite(g.seconds) ||
    g.seconds < 0
  )
    throw new Error("Invalid game data.");
  if (g.steamId && !/^\d+$/.test(g.steamId))
    throw new Error("Steam app ID must contain digits only.");
  if (g.themeColor !== undefined && !/^#[0-9a-f]{6}$/i.test(g.themeColor))
    throw new Error("Invalid theme color.");
  for (const url of [g.artwork, g.hero, g.logo]) {
    if (
      url !== undefined &&
      (typeof url !== "string" ||
        !/^ember-art:\/\/library\/steam-\d+-(cover|hero|logo)\.(jpg|png|webp)$/.test(
          url,
        ))
    )
      throw new Error("Invalid local artwork reference.");
  }
}
export class LibraryStore {
  data: Library = emptyLibrary();
  private queue: Promise<unknown> = Promise.resolve();
  constructor(readonly file: string) {}
  async load() {
    try {
      const data = JSON.parse(await readFile(this.file, "utf8")) as Library;
      if (data.version !== 1 || !Array.isArray(data.games))
        throw new Error("Unsupported library format.");
      data.games.forEach(validateGame);
      validateSettings(data.settings);
      this.data = data;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw new Error(
          `Library could not be read. Original file preserved at ${this.file}. ${String(e)}`,
        );
    }
  }
  mutate(fn: (draft: Library) => void): Promise<void> {
    const job = this.queue.then(async () => {
      const draft = structuredClone(this.data);
      fn(draft);
      draft.games.forEach(validateGame);
      validateSettings(draft.settings);
      await mkdir(path.dirname(this.file), { recursive: true });
      await writeFile(this.file + ".tmp", JSON.stringify(draft, null, 2), {
        mode: 0o600,
      });
      try {
        await copyFile(this.file, this.file + ".bak");
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
      await rename(this.file + ".tmp", this.file);
      this.data = draft;
    });
    this.queue = job.catch(() => {});
    return job;
  }
}
