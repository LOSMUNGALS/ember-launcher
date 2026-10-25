import { electron } from "./authenticated-electron.mjs";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
await mkdir("artifacts", { recursive: true });
await mkdir(".test-data", { recursive: true });
const root = await mkdtemp(path.resolve(".test-data/reliability-"));
await mkdir(path.join(root, "packages"));
const missing = {
  id: "repair-fixture",
  name: "Repair fixture",
  executable: path.join(root, "missing.exe"),
  args: [],
  store: "local",
  platform: "native",
  seconds: 0,
  description: "Isolated launch repair fixture",
  installed: true,
  owned: true,
  added: new Date().toISOString(),
};
await writeFile(
  path.join(root, "library.json"),
  JSON.stringify({
    version: 1,
    games: [missing],
    settings: { wine: "", prefix: "", graphics: "default" },
    steamRoots: [],
  }),
);
const bytes = Buffer.from("isolated package fixture"),
  pkg = {
    id: "fixture",
    gameId: "fixture",
    title: "Downloaded fixture",
    version: "1",
    type: "archive",
    platforms: ["windows"],
    bytes: bytes.length,
    url: "https://example.com/file.zip",
    sha256: createHash("sha256").update(bytes).digest("hex"),
    filename: "fixture.zip",
    install: { method: "zip", executable: "game.exe" },
    authorization: {
      license: "Fixture",
      distribution: "Test",
      url: "https://example.com",
    },
  };
const jobs = ["completed", "extracting"].map((status, i) => ({
  id: randomUUID(),
  package: {
    ...pkg,
    id: "fixture-" + i,
    title: i ? "Interrupted install fixture" : "Downloaded fixture",
  },
  sourceId: "fixture",
  status,
  downloaded: bytes.length,
  total: bytes.length,
  speed: 0,
  averageSpeed: 0,
  created: new Date().toISOString(),
  updated: new Date().toISOString(),
  destination: root,
  attempts: 0,
  priority: 0,
  verified: true,
}));
for (const job of jobs)
  await writeFile(path.join(root, "packages", job.id + ".package.zip"), bytes);
await writeFile(
  path.join(root, "ember2.json"),
  JSON.stringify({
    preferences: {
      region: "US",
      concurrency: 2,
      minimumPositive: 70,
      minimumReviews: 10,
      catalogUrl: "",
      resumeDownloads: false,
    },
    sources: [
      {
        id: "fixture",
        name: "Diagnostic fixture",
        url: "https://example.com/feed.json",
        enabled: true,
        description: "Offline fixture",
        updated: "2026-10-20T00:00:00Z",
        lastAttempt: "2026-10-24T00:00:00Z",
        error: "Fixture refresh unavailable",
        packages: [pkg],
      },
    ],
    downloads: jobs,
    catalog: {},
    ownership: { ids: [] },
    visits: 0,
  }),
);
const app = await electron.launch({
    args: ["."],
    env: { ...process.env, EMBER_DATA_DIR: root },
  }),
  page = await app.firstWindow(),
  failures = [];
page.on("pageerror", (e) => failures.push(e.message));
try {
  await page.locator(".v2-app").waitFor();
  await page.getByTitle("Downloads", { exact: true }).click();
  await page.getByText("Downloaded · not installed", { exact: true }).waitFor();
  await page
    .getByText("Installation needs attention", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "Locate installed game", exact: true })
      .count(),
    2,
  );
  await page.screenshot({ path: "artifacts/reliability-downloads.png" });
  const health = await page.evaluate(() =>
    window.ember2.call("repairGame", {
      id: "repair-fixture",
      action: "diagnose",
    }),
  );
  assert.equal(health.exists, false);
  const error = await page.evaluate(async () => {
    try {
      await window.ember2.call("launch", { id: "repair-fixture" });
      return "";
    } catch (e) {
      return String(e);
    }
  });
  assert.ok(error);
  const library = JSON.parse(
    await readFile(path.join(root, "library.json"), "utf8"),
  );
  assert.ok(library.games[0].lastLaunchError);
  await page.getByTitle("Library", { exact: true }).click();
  await page
    .locator(".v2-card")
    .filter({ hasText: "Repair fixture" })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Fix this game", exact: true })
    .click();
  await page
    .getByText("The registered executable is missing.", { exact: false })
    .waitFor();
  await page.screenshot({ path: "artifacts/reliability-repair.png" });
  if (process.platform === "win32") {
    const valid = path.join(process.env.SystemRoot, "System32", "ping.exe");
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({
        canceled: false,
        filePaths: [file],
      });
    }, valid);
    await page
      .getByRole("button", { name: "Choose executable", exact: true })
      .click();
    await page
      .getByText("Executable found and passed the platform checks.", {
        exact: false,
      })
      .waitFor();
    const fixed = JSON.parse(
      await readFile(path.join(root, "library.json"), "utf8"),
    );
    assert.equal(fixed.games[0].executable, valid);
    assert.equal(fixed.games[0].lastLaunchError, undefined);
  }
  await page.getByRole("button", { name: "Close launch repair" }).click();
  await page.getByTitle("Settings", { exact: true }).click();
  await page
    .getByText("Cached · refresh unavailable", { exact: false })
    .waitFor();
  assert.equal(
    await page
      .getByRole("checkbox", {
        name: "Resume interrupted direct and torrent downloads after login.",
        exact: false,
      })
      .isChecked(),
    false,
  );
  assert.deepEqual(failures, []);
  console.log(
    "Reliability UI passed: distinct install stages, interrupted package preservation, launch diagnosis/error persistence, executable repair and source diagnostics.",
  );
} catch (error) {
  console.error((await page.locator("body").innerText()).slice(-4000));
  await page.screenshot({ path: "artifacts/reliability-failure.png" });
  throw error;
} finally {
  await app.close();
}
