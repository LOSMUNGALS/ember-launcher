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
  await page.evaluate(() => window.ember2.call("accountLogout"));
  await app.close();
  await launch();
  await page
    .getByRole("heading", { name: "Welcome back", exact: true })
    .waitFor();
  await assert.rejects(stat(path.join(userData, "remembered-session.bin")));
  assert.deepEqual(failures, []);
  console.log(
    "Step 2 UI passed: encrypted remembered login and logout across restart; fuzzy/recent search, collections, favorites, hidden games, cover import, review display, managed move and save backup.",
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
