import { _electron as electron } from "playwright";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
const steamRoot = process.argv[2];
if (!steamRoot) throw Error("Pass an existing Steam folder.");
await mkdir(".test-data", { recursive: true });
await mkdir("artifacts", { recursive: true });
const root = await mkdtemp(path.resolve(".test-data/dashboard-v2-"));
await writeFile(
  path.join(root, "library.json"),
  JSON.stringify({
    version: 1,
    games: [],
    settings: { wine: "", prefix: "", graphics: "default" },
    steamRoots: [path.resolve(steamRoot)],
  }),
);
const env = { ...process.env, EMBER_DATA_DIR: root };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: ["."], env });
try {
  const page = await app.firstWindow();
  await page.locator(".v2-app").waitFor();
  let data;
  const deadline=Date.now()+240000;
  do {data=await page.evaluate(()=>window.ember2.call('snapshot'));if(data.games.length>0&&!data.busy)break;if(Date.now()>deadline)throw Error('Steam refresh timeout: '+data.message);await new Promise(r=>setTimeout(r,300));}while(true);
  assert.ok(data.games.length>0);
  const count = (fn) => data.games.filter(fn).length;
  console.log(
    JSON.stringify(
      {
        games: data.games.length,
        playtime: count((g) => g.steam?.playtimeMinutes !== undefined),
        achievementIcons: count((g) =>
          g.steam?.achievements?.some((a) => a.icon),
        ),
        descriptions: count((g) => g.steam?.about),
        deck: count((g) => g.steam?.deck),
        owned: count((g) => g.owned),
      },
      null,
      2,
    ),
  );
  assert.equal(
    count((g) => g.owned),
    0,
  );
  await page.locator("nav").getByTitle("Library", { exact: true }).click();
  await page.getByRole("heading", { name: "Library", exact: true }).waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "artifacts/ember2-live-library.png" });
} finally {
  await app.close();
}
