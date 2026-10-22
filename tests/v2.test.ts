import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { ZipFile } from "yazl";
import { DownloadManager } from "../desktop/downloads";
import { StateStore, initialState } from "../desktop/state";
import { validateFeed, relativeTarget } from "../desktop/sources";
import {
  extractZip,
  safeArchiveEntry,
  nativePackage,
  uninstallManaged,
} from "../desktop/installations";
import { parseOwned } from "../desktop/ownership";
import { parseCatalog, quality } from "../desktop/catalog";
import {
  httpsUrl,
  publicAddress,
  requestHttps,
  type HttpClient,
} from "../desktop/http";
const payload = Buffer.alloc(2 * 1024 * 1024, 123);
const hash = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const pkg = (overrides = {}) => ({
  id: "game",
  gameId: "game",
  title: "Download test fixture",
  version: "1",
  type: "archive",
  platforms: ["windows"],
  bytes: payload.length,
  url: "https://example.com/game.zip",
  sha256: hash(payload),
  filename: "game.zip",
  install: { method: "zip", executable: "game.exe" },
  authorization: {
    license: "Test fixture",
    distribution: "Test authored in this repository",
    url: "https://example.com/license",
  },
  ...overrides,
});
const feed = (p = pkg()) => ({
  version: 1,
  id: "test",
  name: "Test source",
  packages: [p],
});
const waitFor = async (fn: () => boolean, timeout = 10000) => {
  const start = Date.now();
  while (!fn()) {
    if (Date.now() - start > timeout) throw Error("Condition timed out");
    await new Promise((r) => setTimeout(r, 15));
  }
};
test("feeds reject unsafe paths, missing hashes, insecure URLs and unsupported platforms", () => {
  assert.equal(validateFeed(feed()).packages.length, 1);
  for (const value of [
    "../x",
    "C:/x",
    "a\\b",
    "/absolute",
    "a/../b",
    "CON.exe",
    "game.",
    "x:stream",
  ])
    assert.throws(() => relativeTarget(value));
  for (const override of [
    { sha256: "" },
    { url: "http://example.com/file" },
    { platforms: ["linux"] },
    { bytes: -1 },
    { install: { method: "script" } },
    { authorization: {} },
  ])
    assert.throws(() => validateFeed(feed(pkg(override))));
  assert.throws(() => safeArchiveEntry("link", 0xa000));
  assert.equal(nativePackage(["windows"], "darwin"), false);
  assert.equal(nativePackage(["mac"], "darwin"), true);
});
test("public network rules reject private literals before any request", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.2",
    "172.16.0.1",
    "::1",
    "fc00::1",
  ])
    assert.equal(publicAddress(ip), false);
  assert.equal(publicAddress("8.8.8.8"), true);
  assert.throws(() => httpsUrl("https://user:secret@example.com/"));
  await assert.rejects(requestHttps("https://127.0.0.1/file"), /Private/);
});
test("ownership requires complete official records and preserves real zero playtime", () => {
  assert.throws(() => parseOwned({ response: {} }));
  assert.throws(() => parseOwned({ response: { game_count: 2, games: [] } }));
  assert.deepEqual(parseOwned({ response: { game_count: 0 } }), []);
  assert.equal(
    parseOwned({
      response: {
        game_count: 1,
        games: [{ appid: 10, name: "Game", playtime_forever: 0 }],
      },
    })[0].minutes,
    0,
  );
});
test("catalog excludes explicit or unclassified content without penalizing small samples", () => {
  const raw: any = {
    "10": {
      success: true,
      data: {
        steam_appid: 10,
        type: "game",
        name: "Game",
        platforms: { windows: true },
        content_descriptors: { ids: [1, 2] },
        release_date: { coming_soon: true, date: "Coming soon" },
      },
    },
  };
  const g = parseCatalog("10", raw, {
    success: 1,
    query_summary: { total_reviews: 2, total_positive: 0 },
  });
  assert.equal(quality(g, initialState().preferences), true);
  assert.equal(g.comingSoon, true);
  assert.deepEqual(g.platforms, ["windows"]);
  raw[10].data.content_descriptors.ids = [3];
  assert.equal(
    quality(parseCatalog("10", raw, null), initialState().preferences),
    false,
  );
  delete raw[10].data.content_descriptors;
  assert.equal(parseCatalog("10", raw, null).content, "uncertain");
  raw[10].data.type = "dlc";
  assert.throws(() => parseCatalog("10", raw, null));
});
async function fixture(mode: "range" | "restart" | "badRange" = "range") {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-download-"));
  const store = new StateStore(path.join(root, "state.json"));
  let requests = 0;
  let resumed = false;
  const server = http.createServer((req, res) => {
    requests++;
    const offset = Number(req.headers.range?.match(/bytes=(\d+)-/)?.[1] || 0);
    resumed ||= offset > 0;
    let start = mode === "restart" ? 0 : offset;
    res.statusCode = offset && mode !== "restart" ? 206 : 200;
    if (res.statusCode === 206)
      res.setHeader(
        "Content-Range",
        `bytes ${mode === "badRange" ? 0 : start}-${payload.length - 1}/${payload.length}`,
      );
    res.setHeader("Content-Length", payload.length - start);
    res.setHeader("ETag", '"fixture"');
    const timer = setInterval(() => {
      if (start >= payload.length) {
        clearInterval(timer);
        res.end();
        return;
      }
      res.write(payload.subarray(start, start + 32768));
      start += 32768;
    }, 8);
    res.on("close", () => clearInterval(timer));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address() as any;
  const client: HttpClient = (_url, headers, signal) =>
    new Promise((resolve, reject) => {
      const request = http.get(
        `http://127.0.0.1:${address.port}`,
        { headers, signal },
        resolve,
      );
      request.on("error", reject);
    });
  const manager = new DownloadManager(
    path.join(root, "files"),
    store,
    () => {},
    client,
  );
  await manager.initialize();
  return {
    root,
    store,
    manager,
    client,
    resumed: () => resumed,
    requests: () => requests,
    close: async () => {
      await manager.shutdown();
      server.closeAllConnections();
      await new Promise<void>((r) => server.close(() => r()));
    },
  };
}
test("real transfers pause, resume using Range, verify and persist across restart", async () => {
  const f = await fixture();
  try {
    const id = await f.manager.enqueue(
      validateFeed(feed()).packages[0],
      "source",
      f.root,
    );
    const j = f.store.data.downloads[0];
    await waitFor(() => j.downloaded > 100000 && j.speed > 0);
    assert.ok(j.eta !== undefined);
    await f.manager.control(id, "pause");
    const at = j.downloaded;
    assert.ok(at > 0 && at < j.total);
    assert.equal((await stat(f.manager.file(j, true))).size, at);
    await f.manager.shutdown();
    const state = new StateStore(f.store.file);
    await state.load();
    const restarted = new DownloadManager(
      f.manager.root,
      state,
      () => {},
      f.client,
    );
    await restarted.initialize();
    assert.equal(state.data.downloads[0].status, "paused");
    await restarted.control(id, "resume");
    await waitFor(() => state.data.downloads[0].status === "completed");
    assert.equal(f.resumed(), true);
    assert.equal(
      hash(await readFile(restarted.file(state.data.downloads[0]))),
      hash(payload),
    );
    await restarted.verify(state.data.downloads[0]);
    assert.equal(state.data.downloads[0].installedGameId, undefined);
    await assert.rejects(restarted.control(id, "pause"));
    await restarted.shutdown();
  } finally {
    await f.close();
  }
});
test("servers ignoring Range restart cleanly; checksum failures block installation", async () => {
  const f = await fixture("restart");
  try {
    const p = validateFeed(feed()).packages[0];
    const id = await f.manager.enqueue(p, "source", f.root);
    const j = f.store.data.downloads[0];
    await waitFor(() => j.downloaded > 100000);
    await f.manager.control(id, "pause");
    await f.manager.control(id, "resume");
    await waitFor(() => j.status === "completed");
    assert.equal(hash(await readFile(f.manager.file(j))), hash(payload));
    const bad = validateFeed(feed(pkg({ id: "bad", sha256: "0".repeat(64) })))
      .packages[0];
    await f.manager.enqueue(bad, "source", f.root);
    const broken = f.store.data.downloads[1];
    await waitFor(() => broken.status === "failed");
    assert.match(broken.error!, /SHA-256/);
    await assert.rejects(f.manager.verify(broken));
  } finally {
    await f.close();
  }
});
test("invalid resume response preserves partial bytes; cancellation removes them", async () => {
  const f = await fixture("badRange");
  try {
    const id = await f.manager.enqueue(
      validateFeed(feed()).packages[0],
      "source",
      f.root,
    );
    const j = f.store.data.downloads[0];
    await waitFor(() => j.downloaded > 100000);
    await f.manager.control(id, "pause");
    await f.manager.control(id, "resume");
    await waitFor(() => j.status === "failed");
    assert.match(j.error!, /resume response/);
    assert.ok((await stat(f.manager.file(j, true))).size > 0);
    await f.manager.control(id, "cancel");
    await assert.rejects(stat(f.manager.file(j, true)));
    assert.equal(j.status, "canceled");
  } finally {
    await f.close();
  }
});
test("safe ZIP extraction registers only after real extraction and managed uninstall checks marker", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-zip-"));
  const file = path.join(root, "test.zip");
  const zip = new ZipFile();
  zip.addBuffer(Buffer.from("MZfixture"), "game/game.exe");
  zip.end();
  await pipeline(zip.outputStream, createWriteStream(file));
  const result = await extractZip(file, root, "game/game.exe");
  assert.equal((await readFile(result.executable)).toString(), "MZfixture");
  await assert.rejects(uninstallManaged(root));
  await uninstallManaged(result.directory);
  await assert.rejects(stat(result.directory));
  const linkFile = path.join(root, "link.zip"),
    links = new ZipFile();
  links.addBuffer(Buffer.from("../outside"), "game", { mode: 0o120777 });
  links.end();
  await pipeline(links.outputStream, createWriteStream(linkFile));
  await assert.rejects(extractZip(linkFile, root, "game"), /symlink/);
});
import { rankedRows } from "../desktop/catalog";
test("ranking omissions preserve source positions instead of renumbering", () => {
  const html =
    '<a data-ds-appid="10" class="search_result_row"></a><a data-ds-bundleid="2" class="search_result_row"></a><a class="search_result_row" data-ds-appid="30"></a>';
  assert.deepEqual(rankedRows(html), {
    ids: ["10", "30"],
    positions: { "10": 1, "30": 3 },
  });
});
import { windowsExecutable } from "../desktop/platform";
test("native Windows target rejects renamed text and accepts PE executable headers", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-pe-")),
    file = path.join(root, "game.exe");
  await writeFile(file, "not executable");
  assert.equal(await windowsExecutable(file), false);
  const data = Buffer.alloc(128);
  data.write("MZ");
  data.writeUInt32LE(64, 60);
  data.writeUInt32LE(0x4550, 64);
  data.writeUInt16LE(2, 86);
  await writeFile(file, data);
  assert.equal(await windowsExecutable(file), true);
  data.writeUInt16LE(0x2002, 86);
  await writeFile(file, data);
  assert.equal(await windowsExecutable(file), false);
});
test("concurrency and queue priority affect actual request ordering", async () => {
  const f = await fixture();
  try {
    f.store.data.preferences.concurrency = 1;
    await f.manager.enqueue(validateFeed(feed()).packages[0], "source", f.root);
    const second = await f.manager.enqueue(
      validateFeed(feed(pkg({ id: "second" }))).packages[0],
      "source",
      f.root,
    );
    const third = await f.manager.enqueue(
      validateFeed(feed(pkg({ id: "third" }))).packages[0],
      "source",
      f.root,
    );
    await f.manager.control(third, "top");
    assert.equal(
      f.store.data.downloads.find((j) => j.id === second)!.status,
      "queued",
    );
    await waitFor(
      () =>
        f.store.data.downloads.find((j) => j.id === third)!.status ===
        "downloading",
    );
    assert.equal(
      f.store.data.downloads.find((j) => j.id === second)!.status,
      "queued",
    );
    assert.equal(f.requests(), 2);
  } finally {
    await f.close();
  }
});
