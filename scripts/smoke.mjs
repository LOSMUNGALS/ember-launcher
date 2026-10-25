import { electron } from "./authenticated-electron.mjs";
import { mkdir, writeFile, readFile, mkdtemp } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
await mkdir("artifacts", { recursive: true });
await mkdir(".test-data", { recursive: true });
const root = await mkdtemp(path.resolve(".test-data/v2-smoke-")),
  steam = path.join(root, "Steam");
await mkdir(path.join(steam, "steamapps", "common", "Verified"), {
  recursive: true,
});
await mkdir(path.join(steam, "steamapps", "common", "Unverified"), {
  recursive: true,
});
await writeFile(
  path.join(steam, "steamapps", "appmanifest_10.acf"),
  '"appid" "10" "name" "Verified fixture" "installdir" "Verified" "StateFlags" "4"',
);
await writeFile(
  path.join(steam, "steamapps", "appmanifest_20.acf"),
  '"appid" "20" "name" "Unverified fixture" "installdir" "Unverified" "StateFlags" "4"',
);
const local = {
  id: "smoke",
  name: "Launch verification",
  executable:
    process.platform === "win32"
      ? path.join(process.env.SystemRoot, "System32", "ping.exe")
      : "/bin/sleep",
  args: process.platform === "win32" ? ["-n", "5", "127.0.0.1"] : ["4"],
  store: "local",
  platform: "native",
  seconds: 0,
  description:
    "Harmless operating-system process used only by the automated test.",
  added: new Date().toISOString(),
  installed: true,
};
const game = (id, installed, saved = false) => ({
  id: "steam-" + id,
  steamId: id,
  name:
    id === "10"
      ? "Verified fixture"
      : id === "20"
        ? "Unverified fixture"
        : "Saved fixture",
  executable: installed
    ? path.join(
        steam,
        "steamapps",
        "common",
        id === "10" ? "Verified" : "Unverified",
      )
    : "",
  args: [],
  store: "steam",
  platform: "native",
  seconds: 0,
  description: "Test fixture",
  added: new Date().toISOString(),
  installed,
  saved,
  steam: {
    about: "Test description",
    aboutUpdated: new Date().toISOString(),
    deck: "unknown",
    deckUpdated: new Date().toISOString(),
  },
});
await writeFile(
  path.join(root, "library.json"),
  JSON.stringify({
    version: 1,
    games: [
      local,
      game("10", true),
      game("20", true),
      game("30", false, true),
      { ...game("40", false), name: "Owned uninstalled fixture" },
    ],
    settings: { wine: "", prefix: "", graphics: "default" },
    steamRoots: [steam],
  }),
);
const catalog = Object.fromEntries(
  ["10", "20", "30", "40"].map((id) => [
    id,
    {
      appId: id,
      title: "Fixture " + id,
      cover: "",
      banner: "",
      screenshots: ["https://shared.steamstatic.com/test-one.jpg", "https://shared.steamstatic.com/test-two.jpg"],
      description: "Controlled metadata fixture.",
      developers: [],
      publishers: [],
      genres: ["Action"],
      tags: [],
      platforms: ["windows", "mac"],
      comingSoon: false,
      releaseDate: "2020",
      content: "allowed",
      updated: new Date().toISOString(),
    },
  ]),
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
    sources: [{id:'host-fixture',name:'Test source',error:'HTTP 403 fixture refresh unavailable',url:'https://example.com/source.json',enabled:true,description:'Controlled host transfer',packages:[{id:'host-file',gameId:'host-file',steamAppId:'40',title:'Fixture 40',sourceName:'Test source',version:'1',type:'archive',platforms:['windows','mac'],bytes:0,url:'https://example.com/host',sha256:'',filename:'fixture.zip',install:{method:'zip'},authorization:{license:'Test',distribution:'Test',url:'https://example.com'},transport:'host'},{id:'torrent-fixture',gameId:'torrent-fixture',steamAppId:'40',title:'Fixture 40 v1.2',sourceName:'Test source',version:'1',type:'archive',platforms:['windows','mac'],bytes:0,url:'magnet:?xt=urn:btih:438bc629afed407a87651d920c3f4a89823c5012',sha256:'',filename:'torrent.zip',install:{method:'zip'},authorization:{license:'Test',distribution:'Test',url:'https://example.com'},transport:'torrent'}]}],
    downloads: [],
    catalog,
    rankings: {
      ids: [],
      nextRefresh: Date.now() + 3600000,
      region: "US",
      source: "No live ranking in isolated test",
    },
    ownership: { ids: ["10", "40"] },
    visits: 0,
  }),
);
const env = { ...process.env, EMBER_DATA_DIR: root };
delete env.ELECTRON_RUN_AS_NODE;
const options = process.env.EMBER_TEST_EXECUTABLE
  ? {
      executablePath: path.resolve(process.env.EMBER_TEST_EXECUTABLE),
      args: [],
      env,
    }
  : { args: ["."], env };
const instance = await electron.launch(options);
const failures = [];
try {
  const page = await instance.firstWindow();
  page.on("pageerror", (e) => failures.push(e.message));
  await page.locator(".v2-app").waitFor();
  assert.match(await page.locator("nav button.selected").innerText(), /Home/);
  const nav = (name) => page.locator("nav").getByTitle(name, { exact: true });
  assert.equal(await page.locator("nav button").count(), 9);
  await page.evaluate(async () => {
    await Promise.all(
      document.getAnimations().map((a) => a.finished.catch(() => {})),
    );
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "artifacts/ember2-home.png" });
  await page.route('https://shared.steamstatic.com/test-*.jpg', route => route.fulfill({contentType:'image/svg+xml', body:'<svg xmlns="http://www.w3.org/2000/svg" width="800" height="450"><rect width="800" height="450" fill="teal"/></svg>'}));
  await nav("Steam Library").click();
  await page
    .getByRole("heading", { name: "Steam Library", exact: true })
    .waitFor();
  await page.waitForFunction(
    () => document.querySelectorAll(".game-collection .v2-card").length === 2,
  );
  assert.match(
    await page.locator(".game-collection").textContent(),
    /Verified fixture/,
  );
  assert.doesNotMatch(
    await page.locator(".game-collection").textContent(),
    /Unverified/,
  );
  const ownedCard = page
    .locator(".game-collection .v2-card")
    .filter({ hasText: "Owned uninstalled fixture" });
  assert.equal(await ownedCard.count(), 1);
  assert.equal(
    await ownedCard.getByRole("button", { name: "Install in Steam" }).count(),
    1,
  );
  assert.equal(
    await ownedCard
      .getByRole("button", { name: "▶ Play", exact: true })
      .count(),
    0,
  );
  await ownedCard.locator('.card-open').click();
  await instance.evaluate(({dialog,app}, root) => {
    dialog.showOpenDialog = async () => ({canceled:false,filePaths:[root]});
    app.on('session-created', ses => {
      void ses.protocol.handle('https', req => req.url.endsWith('/payload')
        ? new Response(new Uint8Array(32768).fill(42),{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="fixture.bin"','content-length':'32768'}})
        : new Response('<h1>Test host</h1><a href="https://example.com/payload" download="fixture.bin">Download fixture</a>',{headers:{'content-type':'text/html'}}));
    });
  }, root);
  const actions=page.locator('.hero .actions');
  await page.getByRole('button',{name:'Download',exact:true}).click();
  await page.getByRole('dialog',{name:'Choose Download Source'}).waitFor();
  assert.equal(await page.getByRole('dialog').getByText('HTTP 403',{exact:false}).count(),0);
  assert.equal(await page.locator('.download-option').count(),2);
  await page.waitForTimeout(350);
  await page.screenshot({path:'artifacts/download-source-picker.png'});
  const hostPromise=instance.waitForEvent('window');
  await page.locator('.download-option').first().click();
  const host=await hostPromise;
  await host.getByRole('heading',{name:'Test host'}).waitFor();
  await host.close();
  const torrentId=await page.evaluate(()=>window.ember2.call('download',{sourceId:'host-fixture',packageId:'torrent-fixture',appId:'40'}));
  await page.waitForTimeout(1500);
  const torrentJob=await page.evaluate(async(id)=>(await window.ember2.call('snapshot')).state.downloads.find(j=>j.id===id),torrentId);
  assert.equal(torrentJob.status,'connecting');
  await page.evaluate(id=>window.ember2.call('downloadControl',{id,action:'cancel'}),torrentId);
  await page.getByRole('button',{name:'View game download'}).click();
  await page.getByRole('heading',{name:'Downloads',exact:true}).waitFor();
  await nav('Steam Library').click();
  await page.locator('.game-collection .v2-card').filter({hasText:'Owned uninstalled fixture'}).locator('.card-open').click();
  await page.getByRole('button', {name:'Open screenshot 1', exact:true}).click();
  await page.getByRole('dialog', {name:'Screenshot gallery'}).waitFor();
  await page.getByRole('button', {name:'Next screenshot', exact:true}).click();
  assert.equal(await page.locator('.viewer-count').textContent(), '2 / 2');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.viewer-count').textContent(), '1 / 2');
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('.viewer-count').textContent(), '2 / 2');
  await page.waitForFunction(() => { const img=document.querySelector('.viewer-frame img'); return img && img.complete && img.naturalWidth > 0; });
  await page.waitForTimeout(300);
  await page.screenshot({path:'artifacts/screenshot-gallery.png'});
  await page.keyboard.press('Escape');
  await page.getByRole('dialog', {name:'Screenshot gallery'}).waitFor({state:'hidden'});
  await nav('Steam Library').click();
  await page.getByLabel("Library status").selectOption("installed");
  assert.equal(await page.locator(".game-collection .v2-card").count(), 1);
  await page.getByLabel("Library status").selectOption("uninstalled");
  assert.equal(await page.locator(".game-collection .v2-card").count(), 1);
  assert.match(
    await page.locator(".game-collection").textContent(),
    /Owned uninstalled fixture/,
  );
  await nav("Library").click();
  assert.equal(await page.locator(".game-collection .v2-card").count(), 5);
  await page
    .locator(".card-open")
    .filter({ hasText: "Launch verification" })
    .click();
  await page.getByRole("button", { name: "▶ Play", exact: true }).click();
  await page.getByRole("button", { name: "Running", exact: true }).waitFor();
  const duplicate = await page.evaluate(async () => {
    try {
      await window.ember2.call("launch", { id: "smoke" });
      return "";
    } catch (e) {
      return String(e);
    }
  });
  assert.match(duplicate, /already running/);
  await page
    .getByRole("button", { name: "▶ Play", exact: true })
    .waitFor({ timeout: 15000 });
  await page.getByRole("button", { name: "Edit details" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Verified native launch");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("heading", { name: "Verified native launch" }).waitFor();
  for (const name of [
    "All Games",
    "Coming Soon",
    "Top Sellers",
    "Downloads",
    "Settings",
  ]) {
    await nav(name).click();
    await page.getByRole("heading", { name, exact: true }).waitFor();
  }
  assert.equal(
    await page.getByText("Wine executable", { exact: false }).count(),
    0,
  );
  assert.equal(
    await page.locator("nav").getByText("Epic Games", { exact: true }).count(),
    0,
  );
  await page.getByLabel("Concurrent downloads").selectOption("3");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await page.waitForFunction(
    async () =>
      (await window.ember2.call("snapshot")).state.preferences.concurrency ===
      3,
  );
  await page.screenshot({ path: "artifacts/ember2-settings.png" });
  await nav("Downloads").click();
  await page.screenshot({ path: "artifacts/ember2-downloads.png" });
  await page.evaluate(() => window.ember2.call("saveGame", {id:"30"}));
  await nav("Library").click();
  await page.waitForFunction(() => !document.querySelector('.game-collection')?.textContent?.includes('Saved fixture'));
  assert.equal(await page.locator('.game-collection .v2-card').count(),4);
  const snapshot = await page.evaluate(() => window.ember2.call("snapshot"));
  assert.ok(snapshot.games.find((g) => g.id === "smoke").seconds >= 1);
  assert.equal(snapshot.games.find((g) => g.id === "steam-30").owned, false);
  assert.deepEqual(failures, []);
  console.log(
    "PASS: all eight pages, owned installed and uninstalled library, saved status, native launch, duplicate launch guard, persisted playtime, editing, preferences, no renderer errors.",
  );
} finally {
  await instance.close();
}
const restarted = await electron.launch(options);
try {
  const page = await restarted.firstWindow();
  await page.locator(".v2-app").waitFor();
  const snapshot = await page.evaluate(() => window.ember2.call("snapshot"));
  assert.equal(snapshot.state.preferences.concurrency, 3);
  assert.equal(snapshot.games.find(g => g.id === "steam-30").saved,false);
  await page.locator('nav').getByTitle('Library',{exact:true}).click();
  assert.equal(await page.locator('.game-collection .v2-card').count(),4);
  await page.locator('nav').getByTitle('Home',{exact:true}).click();
  assert.equal(
    snapshot.games.find((g) => g.id === "smoke").name,
    "Verified native launch",
  );
  assert.match(await page.locator("nav button.selected").innerText(), /Home/);
  console.log(
    "PASS: restart preserves library and preferences and opens Home.",
  );
} finally {
  await restarted.close();
}



