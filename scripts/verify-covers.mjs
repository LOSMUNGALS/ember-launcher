import {electron} from "./authenticated-electron.mjs";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
await mkdir(".test-data", { recursive: true });
await mkdir("artifacts", { recursive: true });
const root = await mkdtemp(path.resolve(".test-data/covers-"));
const steam = path.join(root, "Steam");
await mkdir(path.join(steam, "steamapps"), { recursive: true });
const titles = {
  1808500: "ARC Raiders",
  1887840: "Another Crab’s Treasure",
  498240: "Batman - The Telltale Series",
};
await writeFile(
  path.join(root, "library.json"),
  JSON.stringify({
    version: 1,
    steamRoots: [steam],
    settings: { wine: "", prefix: "", graphics: "default" },
    games: Object.entries(titles).map(([id, name]) => ({
      id: "steam-" + id,
      steamId: id,
      name,
      executable: "",
      installed: false,
      owned: true,
      store: "steam",
      platform: "native",
      seconds: 0,
      args: [],
      description: "",
      added: "2026-10-19",
    })),
  }),
);
await writeFile(
  path.join(root, "ember2.json"),
  JSON.stringify({
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
      region: "US",
      source: "Test",
      nextRefresh: Date.now() + 3600000,
    },
    ownership: { ids: Object.keys(titles) },
    visits: 0,
  }),
);
const env = { ...process.env, EMBER_DATA_DIR: root };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env });
try {
  const page = await app.firstWindow();
  await page.locator(".v2-app").waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page
    .locator("nav")
    .getByTitle("Steam Library", { exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Steam Library", exact: true })
    .waitFor();
  for (const title of Object.values(titles)) {
    const card = page
      .locator(".game-collection .v2-card")
      .filter({ hasText: title });
    await card.scrollIntoViewIfNeeded();
    const deadline = Date.now() + 30000;
    let image;
    do {
      image = await card
        .locator("img")
        .evaluateAll((images) =>
          images.map((img) => ({
            src: img.currentSrc,
            w: img.naturalWidth,
            h: img.naturalHeight,
            complete: img.complete,
          })),
        );
      if (image[0]?.complete && image[0].w > 0) break;
      if (Date.now() > deadline) throw Error("Cover did not load: " + title);
      await new Promise((r) => setTimeout(r, 200));
    } while (true);
    assert.match(image[0].src, /library_600x900|ember-art:\/\/library\/steam-\d+-cover\./);
    assert.ok(image[0].h > image[0].w);
    console.log(title + ": " + image[0].w + "×" + image[0].h);
  }
  await page.screenshot({ path: "artifacts/steam-portrait-covers.png" });
  console.log(
    "PASS: three uninstalled owned games with no catalog metadata load genuine Steam portrait covers.",
  );
} finally {
  await app.close();
}
