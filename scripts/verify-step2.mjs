import { _electron } from "playwright";
import { startService } from "../server/index.mjs";
import {
  mkdir,
  mkdtemp,
  writeFile,
  readFile,
  copyFile,
  stat,
  realpath,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import assert from "node:assert/strict";
await mkdir(".test-data", { recursive: true });
await mkdir("artifacts", { recursive: true });
const root = await realpath(await mkdtemp(path.resolve(".test-data/step2-"))),
  userData = path.join(root, "user"),
  id = randomUUID(),
  installed = path.join(root, "Ember-" + id),
  destination = path.join(root, "other-drive"),
  saves = path.join(root, "save-data"),
  steam = path.join(root, "Steam");
for (const directory of [
  userData,
  installed,
  destination,
  saves,
  path.join(steam, "steamapps"),
])
  await mkdir(directory, { recursive: true });
const executable = path.join(
  installed,
  process.platform === "win32" ? "fixture.exe" : "fixture",
);
await copyFile(
  process.platform === "win32"
    ? path.join(process.env.SystemRoot, "System32", "ping.exe")
    : "/bin/sleep",
  executable,
);
await writeFile(
  path.join(installed, ".ember-install.json"),
  JSON.stringify({
    id,
    target: installed,
    relativeExecutable: path.basename(executable),
  }),
);
await writeFile(path.join(saves, "save.dat"), "save fixture");
const game = {
  id: "library-fixture",
  name: "Cyberpunk fixture",
  executable,
  args: [],
  store: "local",
  platform: "native",
  seconds: 0,
  description: "Fixture",
  installed: true,
  owned: true,
  added: new Date().toISOString(),
  steamId: "730",
  managed: { directory: installed, jobId: randomUUID(), method: "zip" },
};
await writeFile(
  path.join(userData, "library.json"),
  JSON.stringify({
    version: 1,
    games: [game],
    settings: { wine: "", prefix: "", graphics: "default" },
    steamRoots: [steam],
  }),
);
const meta = {
  appId: "730",
  title: "Cyberpunk fixture",
  cover: "",
  banner: "",
  screenshots: [],
  description: "Fixture metadata",
  developers: [],
  publishers: [],
  genres: ["Action"],
  tags: [],
  platforms: ["windows"],
  comingSoon: false,
  releaseDate: "",
  content: "allowed",
  updated: new Date().toISOString(),
  artworkVersion: 1,
  reviews: { positive: 85, total: 100, summary: "Very Positive" },
  reviewsSource: "Steam",
  reviewsChecked: new Date().toISOString(),
};
await writeFile(
  path.join(userData, "ember2.json"),
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
    catalog: { 730: meta },
    ownership: { ids: [] },
    visits: 0,
  }),
);
const service = await startService({
    directory: path.join(root, "accounts"),
    port: 0,
    adminEmail: "fixture@example.com",
  }),
  password = "Isolated-ui-fixture-password-2026";
await service.accounts.bootstrap(password);
let app, page;
const failures = [];
const launch = async () => {
  app = await _electron.launch({
    args: ["."],
    env: {
      ...process.env,
      EMBER_DATA_DIR: userData,
      EMBER_ACCOUNT_URL: service.url,
    },
  });
  page = await app.firstWindow();
  page.on("pageerror", (e) => failures.push(e.message));
  await page.waitForFunction(() => !!window.ember2);
};
try {
  await launch();
  await page
    .getByLabel("Username or email", { exact: true })
    .fill("fixture@example.com");
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Remember this device", { exact: true }).check();
  await page.getByRole("button", { name: "Log In", exact: true }).click();
  await page.locator(".v2-app").waitFor();
  assert.ok(
    (await stat(path.join(userData, "remembered-session.bin"))).size > 0,
  );
  await app.close();
  await launch();
  await page.locator(".v2-app").waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "Welcome back" }).count(),
    0,
  );
  await page.getByTitle("Library", { exact: true }).click();
  await page.getByLabel("Search games").fill("cyberpnuk");
  await page
    .locator(".v2-card")
    .filter({ hasText: "Cyberpunk fixture" })
    .waitFor();
  await page.getByLabel("Search games").press("Enter");
  await page.getByLabel("Search games").fill("");
  const card = page
    .locator(".v2-card")
    .filter({ hasText: "Cyberpunk fixture" });
  await card.click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Manage collections and cover" })
    .click();
  await page.getByLabel("Game collections").fill("Favorites, Weekend");
  await page.getByLabel("Game play status").selectOption("playing");
  await page.getByLabel("Favorite", { exact: true }).check();
  await page.getByRole("button", { name: "Save game preferences" }).click();
  await page.getByLabel("Collection", { exact: true }).selectOption("Weekend");
  await card.waitFor();
  await card.click({ button: "right" });
  await page
    .getByRole("menuitem", { name: "Manage collections and cover" })
    .click();
  await app.evaluate(({ dialog }, file) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [file],
    });
  }, path.resolve("public/launcher.png"));
  await page.getByRole("button", { name: "Choose cover image" }).click();
  await page.waitForFunction(async () =>
    Boolean((await window.ember2.call("snapshot")).games[0].customArtwork),
  );
  await page.getByRole("button", { name: "Close game management" }).click();
  await page.waitForFunction(() =>
    document
      .querySelector(".v2-card img")
      ?.src.startsWith("ember-art://library/custom-"),
  );
  await page.screenshot({ path: "artifacts/step2-library.png" });
  await card.locator(".card-open").click();
  await page.getByText("85% positive", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Manage game", exact: true }).click();
  await page.getByLabel("Hide from discovery", { exact: false }).check();
  await page.getByRole("button", { name: "Save game preferences" }).click();
  await page.getByTitle("Library", { exact: true }).click();
  assert.equal(await page.locator(".v2-card").count(), 0);
  await page.getByLabel("Library status").selectOption("hidden");
  await card.waitFor();
  await page.getByTitle("Settings", { exact: true }).click();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k"); await page.waitForFunction(()=>document.activeElement?.getAttribute("aria-label")==="Search games"); await page.getByTitle("Settings",{exact:true}).click(); await page.getByRole("button", { name: "Scan installed games" }).click();
  await page.locator(".storage-row").waitFor();
  if (process.platform === "win32") {
    await app.evaluate(({ dialog }, folder) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [folder],
      });
      dialog.showMessageBox = async () => ({
        response: 1,
        checkboxChecked: false,
      });
    }, destination);
    await page
      .getByRole("button", { name: "Move to another drive", exact: true })
      .click();
    await page.waitForFunction(async () => {
      const game = (await window.ember2.call("snapshot")).games[0];
      return game.executable.includes("other-drive");
    });
    await page
      .getByRole("button", { name: "Refresh storage", exact: true })
      .waitFor();
    await assert.rejects(stat(installed));
    const moved = JSON.parse(
      await readFile(path.join(userData, "library.json"), "utf8"),
    ).games[0];
    assert.ok((await stat(moved.executable)).isFile());
  }
  await app.evaluate(({ dialog, shell }, folder) => {
    dialog.showOpenDialog = async () => ({
      canceled: false,
      filePaths: [folder],
    });
    shell.showItemInFolder = () => {};
  }, saves);
  const backup = await page.evaluate(() =>
    window.ember2.call("backupSaves", { id: "library-fixture" }),
  );
  assert.equal(
    await readFile(path.join(backup.directory, "save.dat"), "utf8"),
    "save fixture",
  );
  await app.evaluate(({dialog})=>{dialog.showMessageBox=async()=>({response:1,checkboxChecked:false})});
  await page.evaluate(()=>window.ember2.call('organizeGame',{id:'library-fixture',favorite:true,collections:['Cloud fixture'],playStatus:'playing'}));
  const cloudBackup=await page.evaluate(()=>window.ember2.call('cloudLibrary',{mode:'upload'}));
  assert.match(cloudBackup.message,/Backed up/);
  await page.evaluate(()=>window.ember2.call('organizeGame',{id:'library-fixture',favorite:false,collections:[],playStatus:'backlog'}));
  const cloudRestore=await page.evaluate(()=>window.ember2.call('cloudLibrary',{mode:'restore'}));
  assert.match(cloudRestore.message,/Restored/);
  const restoredLibrary=JSON.parse(await readFile(path.join(userData,'library.json'),'utf8'));
  assert.equal(restoredLibrary.games.find(g=>g.id==='library-fixture').favorite,true);
  assert.deepEqual(restoredLibrary.games.find(g=>g.id==='library-fixture').collections,['Cloud fixture']);
  const preferences=await page.evaluate(()=>window.ember2.call('displaySettings'));
  await page.evaluate(p=>window.ember2.call('personalization',{...p,reduceMotion:true,highContrast:true}),preferences);
  await page.waitForFunction(()=>document.documentElement.dataset.motion==='reduced'&&document.documentElement.dataset.contrast==='high');
  const diagnostics=await page.evaluate(()=>window.ember2.call('diagnostics'));assert.equal(diagnostics.version,JSON.parse(await readFile('package.json','utf8')).version);assert.equal(JSON.stringify(diagnostics).includes(userData),false);
  const savesBefore=await page.evaluate(()=>window.ember2.call('saveProtection',{id:'library-fixture',mode:'list'}));assert.ok(savesBefore.versions.length);
  const status=await page.evaluate(()=>window.ember2.call('saveProtection',{id:'library-fixture',mode:'cloudStatus'}));assert.equal(status.revision,0);
  await page.evaluate(()=>window.ember2.call('saveProtection',{id:'library-fixture',mode:'upload',expectedRevision:0}));
  await writeFile(path.join(saves,'save.dat'),'second version');
  const fetched=await page.evaluate(()=>window.ember2.call('saveProtection',{id:'library-fixture',mode:'download'}));
  await page.evaluate(version=>window.ember2.call('saveProtection',{id:'library-fixture',mode:'restore',version}),fetched.id);
  assert.equal(await readFile(path.join(saves,'save.dat'),'utf8'),'save fixture');
  await assert.rejects(page.evaluate(()=>window.ember2.call('saveProtection',{id:'library-fixture',mode:'upload',expectedRevision:0})),/conflict/);
  const oldPersonalization=await page.evaluate(()=>window.ember2.call('displaySettings'));
  await assert.rejects(page.evaluate(()=>window.ember2.call('personalization',{reduceMotion:false})),/Invalid personalization/);
  assert.deepEqual(await page.evaluate(()=>window.ember2.call('displaySettings')),oldPersonalization);
  await page.getByLabel('High contrast',{exact:true}).uncheck();
  await page.waitForFunction(()=>document.documentElement.dataset.contrast==='');
  await page.getByLabel('Reduce motion',{exact:true}).uncheck();
  await page.waitForFunction(()=>document.documentElement.dataset.motion==='');
  const toggled=await page.evaluate(()=>window.ember2.call('displaySettings'));assert.equal(toggled.highContrast,false);assert.equal(toggled.reduceMotion,false);
  await app.evaluate(({ipcMain})=>{
    const original=ipcMain._invokeHandlers.get('ember2');ipcMain.__auditOriginal=original;ipcMain.removeHandler('ember2');
    ipcMain.handle('ember2',async(event,type,p={})=>{
      if(type==='saveProtection'&&p.mode==='list'){await new Promise(r=>setTimeout(r,p.id==='library-fixture'?200:10));return {versions:[{id:p.id,created:'2026-10-25T00:00:00Z',files:p.id==='library-fixture'?111:222}]};}
      const result=await original(event,type,p);if(type==='snapshot')result.games.push({...result.games[0],id:'race-two',name:'Race two'});return result;
    });
  });
  await page.evaluate(()=>window.ember2.call('rememberSearch',{query:'race check'}));
  await page.getByLabel('Game',{exact:true}).selectOption('library-fixture');
  await page.getByLabel('Game',{exact:true}).selectOption('race-two');
  await page.waitForTimeout(300);
  const savePanel=page.locator('.settings-panel').filter({has:page.getByRole('heading',{name:'Save protection',exact:true})});
  assert.ok((await savePanel.innerText()).includes('222 files'));assert.ok(!(await savePanel.innerText()).includes('111 files'));
  await app.evaluate(({ipcMain})=>{ipcMain.removeHandler('ember2');ipcMain.handle('ember2',ipcMain.__auditOriginal);delete ipcMain.__auditOriginal});
  await page.getByRole('heading',{name:'Save protection',exact:true}).scrollIntoViewIfNeeded();
  await page.screenshot({path:'artifacts/part4-save-protection.png'});
  await page.getByTitle('Feedback',{exact:true}).click();
  await page.getByRole('button',{name:'New post'}).click();
  await page.getByRole('button',{name:'Attach diagnostics',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Post description"]')?.value.includes('ember-diagnostics-v1'));
  assert.equal((await page.getByLabel('Post description').inputValue()).includes(userData),false);
  await page.evaluate(() => window.ember2.call("accountLogout"));
  await app.close();
  await launch();
  await page
    .getByRole("heading", { name: "Welcome back", exact: true })
    .waitFor();
  await assert.rejects(stat(path.join(userData, "remembered-session.bin")));
  assert.deepEqual(failures, []);
  console.log(
    "Step 2 UI passed: encrypted remembered login and logout across restart; fuzzy/recent search, collections, favorites, hidden games, cover import, review display, managed move, versioned save backup, cloud transfer/conflict and restore, diagnostic report and accessibility preferences.",
  );
} catch (error) {
  if (page) {
    console.error((await page.locator("body").innerText()).slice(-5000));
    await page.screenshot({ path: "artifacts/step2-failure.png" });
  }
  throw error;
} finally {
  await app?.close();
  await service.close();
}
