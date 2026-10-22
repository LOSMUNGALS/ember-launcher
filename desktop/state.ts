import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import path from "node:path";
import type { V2State } from "../src/v2types";
export const initialState = (): V2State => ({
  preferences: {
    region: "US",
    concurrency: 2,
    minimumPositive: 70,
    minimumReviews: 10,
    catalogUrl: "",
  },
  sources: [],
  downloads: [],
  catalog: {},
  rankings: {
    ids: [],
    nextRefresh: 0,
    region: "US",
    source:
      "Steam public top-sellers search order; reporting window not published",
  },
  ownership: { ids: [] },
  visits: 0,
});
export class StateStore {
  data = initialState();
  private queue = Promise.resolve();
  constructor(readonly file: string) {}
  async load() {
    try {
      const value = JSON.parse(await readFile(this.file, "utf8"));
      if (
        !value ||
        !Array.isArray(value.downloads) ||
        !Array.isArray(value.sources) ||
        !value.catalog ||
        !value.ownership ||
        !Array.isArray(value.ownership.ids) ||
        !value.preferences ||
        !Number.isInteger(value.preferences.concurrency) ||
        value.preferences.concurrency < 1 ||
        value.preferences.concurrency > 4
      )
        throw Error("Invalid state");
      for (const j of value.downloads)
        if (
          !/^[0-9a-f-]{36}$/.test(j.id) ||
          !j.package ||
          !/^[\w .-]+\.(zip|exe|msi|pkg|dmg)$/i.test(j.package.filename) ||
          !Number.isSafeInteger(j.total) ||
          (j.package.transport ? j.total < 0 : j.total <= 0) ||
          !path.isAbsolute(j.destination)
        )
          throw Error("Invalid download record");
      this.data = { ...initialState(), ...value };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT")
        throw Error("State could not be loaded; file preserved: " + this.file);
    }
  }
  save() {
    const job = this.queue
      .catch(() => {})
      .then(async () => {
        await mkdir(path.dirname(this.file), { recursive: true });
        await writeFile(
          this.file + ".tmp",
          JSON.stringify(this.data, null, 2),
          { mode: 0o600 },
        );
        await copyFile(this.file, this.file + ".bak").catch((e) => {
          if (e.code !== "ENOENT") throw e;
        });
        await rename(this.file + ".tmp", this.file);
      });
    this.queue = job;
    return job;
  }
}
