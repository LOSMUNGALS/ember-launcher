import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, stat, rm } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import {
  DownloadManager,
  recoverDownload,
  retryableDownloadError,
} from "../desktop/downloads";
import { StateStore } from "../desktop/state";
import {
  downloadStage,
  downloadAdvice,
  sourceDiagnostics,
} from "../src/download-health";
import { launchHealth } from "../desktop/launch-health";
import { refreshSource } from "../desktop/sources";
import type { DownloadJob, GamePackage, PackageSource } from "../src/v2types";
import type { Game } from "../src/types";
import type { HttpClient } from "../desktop/http";
const data = Buffer.from("a small verified recovery fixture"),
  pkg: GamePackage = {
    id: "recovery",
    gameId: "recovery",
    title: "Recovery fixture",
    sourceName: "Fixture",
    version: "1",
    type: "archive",
    platforms: ["windows"],
    bytes: data.length,
    url: "https://example.com/fixture.zip",
    sha256: createHash("sha256").update(data).digest("hex"),
    filename: "fixture.zip",
    install: { method: "zip", executable: "game.exe" },
    authorization: {
      license: "Fixture",
      distribution: "Test",
      url: "https://example.com",
    },
  };
function job(extra: Partial<DownloadJob> = {}): DownloadJob {
  return {
    id: randomUUID(),
    package: structuredClone(pkg),
    sourceId: "fixture",
    status: "completed",
    downloaded: data.length,
    total: data.length,
    speed: 0,
    averageSpeed: 0,
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    destination: path.resolve(".test-data"),
    attempts: 0,
    priority: 0,
    verified: true,
    ...extra,
  };
}
const wait = async (predicate: () => boolean) => {
  const until = Date.now() + 5000;
  while (!predicate()) {
    if (Date.now() > until) throw Error("Fixture timed out");
    await new Promise((r) => setTimeout(r, 10));
  }
};
test("download completion is not installation completion, and interrupted installation preserves its package", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-install-recovery-")),
    store = new StateStore(path.join(root, "state.json")),
    entry = job({ status: "extracting" }),
    manager = new DownloadManager(root, store, () => {});
  store.data.downloads = [entry];
  await writeFile(manager.file(entry), data);
  await manager.initialize();
  assert.equal(entry.status, "completed");
  assert.equal(entry.installationState, "needs-attention");
  assert.match(entry.installationError!, /closed during installation/);
  assert.deepEqual(await readFile(manager.file(entry)), data);
  assert.equal(entry.downloaded, data.length);
  await manager.verify(entry);
  assert.equal(downloadStage(entry).label, "Installation needs attention");
  entry.installedGameId = "registered";
  assert.equal(downloadStage(entry).label, "Ready to play");
  await manager.shutdown();
  const downloaded = job();
  recoverDownload(downloaded);
  assert.equal(downloadStage(downloaded).label, "Downloaded · not installed");
});
test("automatic recovery only marks interrupted transfers, never manually paused or canceled transfers", () => {
  for (const status of [
    "queued",
    "connecting",
    "downloading",
    "verifying",
  ] as const) {
    const entry = job({ status });
    recoverDownload(entry);
    assert.equal(entry.status, "paused");
    assert.equal(entry.resumeOnStartup, true);
  }
  for (const status of ["paused", "failed", "canceled"] as const) {
    const entry = job({ status });
    recoverDownload(entry);
    assert.equal(entry.status, status);
    assert.notEqual(entry.resumeOnStartup, true);
  }
  const host = job({
    package: { ...pkg, transport: "host" },
    status: "downloading",
  });
  recoverDownload(host);
  assert.equal(host.status, "external");
  assert.equal(host.resumeOnStartup, true);
  assert.equal(
    retryableDownloadError("Download server returned HTTP 503"),
    true,
  );
  assert.equal(retryableDownloadError("SHA-256 mismatch"), false);
  assert.equal(
    retryableDownloadError("Download server returned HTTP 403"),
    false,
  );
  assert.equal(
    retryableDownloadError("No peers supplied torrent metadata"),
    false,
  );
});
test("a crash after package rename re-verifies the complete file without another network request", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-rename-recovery-")),
    store = new StateStore(path.join(root, "state.json")),
    entry = job({ status: "verifying", verified: false });
  store.data.downloads = [entry];
  let requests = 0;
  const manager = new DownloadManager(
    root,
    store,
    () => {},
    async () => {
      requests++;
      throw Error("No request should be necessary");
    },
  );
  await writeFile(manager.file(entry), data);
  try {
    await manager.initialize();
    assert.equal(entry.status, "paused");
    assert.equal(entry.downloaded, data.length);
    await manager.resumeRecovered();
    await wait(() => entry.status === "completed");
    assert.equal(requests, 0);
    assert.equal(entry.verified, true);
    assert.deepEqual(await readFile(manager.file(entry)), data);
  } finally {
    await manager.shutdown();
  }
});
test("recovered transfers wait for login, resume partial bytes with Range, and leave manual pauses alone", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-range-recovery-")),
    store = new StateStore(path.join(root, "state.json"));
  let requests = 0,
    range = "";
  const server = http.createServer((req, res) => {
    requests++;
    range = req.headers.range || "";
    const offset = Number(range.match(/bytes=(\d+)-/)?.[1] || 0);
    res.writeHead(
      offset ? 206 : 200,
      offset
        ? {
            "Content-Range": `bytes ${offset}-${data.length - 1}/${data.length}`,
          }
        : {},
    );
    res.end(data.subarray(offset));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as any).port,
    client: HttpClient = async (_url, headers, signal) =>
      new Promise((resolve, reject) => {
        const req = http.get(
          { host: "127.0.0.1", port, headers, signal },
          resolve,
        );
        req.on("error", reject);
      });
  const manager = new DownloadManager(root, store, () => {}, client),
    entry = job({ status: "downloading", verified: false, downloaded: 5 }),
    paused = job({ status: "paused", verified: false, downloaded: 0 });
  store.data.downloads = [entry, paused];
  await writeFile(manager.file(entry, true), data.subarray(0, 5));
  try {
    await manager.initialize();
    assert.equal(requests, 0);
    assert.equal(entry.status, "paused");
    store.data.preferences.resumeDownloads = false;
    await manager.resumeRecovered();
    assert.equal(requests, 0);
    store.data.preferences.resumeDownloads = true;
    await manager.resumeRecovered();
    await wait(() => entry.status === "completed");
    assert.equal(range, "bytes=5-");
    assert.deepEqual(await readFile(manager.file(entry)), data);
    assert.equal(paused.status, "paused");
  } finally {
    await manager.shutdown();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("stalled direct responses retry within a bounded budget and retain the completed verified bytes", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-stall-recovery-")),
    store = new StateStore(path.join(root, "state.json"));
  let requests = 0;
  const server = http.createServer((_req, res) => {
    requests++;
    res.writeHead(200, { "Content-Length": data.length });
    res.flushHeaders();
    if (requests > 1) res.end(data);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as any).port;
  const client: HttpClient = async (_url, headers, signal) =>
    new Promise((resolve, reject) => {
      const req = http.get(
        { host: "127.0.0.1", port, headers, signal },
        resolve,
      );
      req.on("error", reject);
    });
  const manager = new DownloadManager(root, store, () => {}, client, {
    idleTimeoutMs: 50,
    retryDelayMs: 10,
  });
  try {
    await manager.initialize();
    const id = await manager.enqueue(pkg, "test", root);
    const entry = store.data.downloads.find((j) => j.id === id)!;
    await wait(() => entry.status === "completed");
    assert.equal(requests, 2);
    assert.equal(entry.attempts, 2);
    assert.equal(entry.verified, true);
    assert.deepEqual(await readFile(manager.file(entry)), data);
  } finally {
    await manager.shutdown();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("source failures record attempts without changing successful load time or discarding packages", async () => {
  const source: PackageSource = {
    id: "source",
    url: "https://example.com/feed.json",
    name: "Fixture",
    description: "Fixture",
    enabled: true,
    updated: "2026-10-20T00:00:00Z",
    packages: [pkg, { ...pkg, id: "second", title: "Recovery fixture 1.2" }],
  };
  const failed = await refreshSource(source, async () => {
    throw Error("HTTP 403");
  });
  assert.ok(failed.lastAttempt);
  assert.equal(failed.updated, source.updated);
  assert.equal(failed.packages, source.packages);
  const health = sourceDiagnostics(failed);
  assert.equal(health.success, source.updated);
  assert.equal(health.groups, 1);
  assert.match(health.status, /Cached/);
  const success = await refreshSource(failed, async () => ({
    ...source,
    packages: [pkg],
  }));
  assert.ok(success.lastSuccess);
  assert.equal(success.error, undefined);
  assert.equal(success.packages.length, 1);
  assert.match(
    downloadAdvice(job({ error: "Not enough free disk space" })),
    /Free disk space/,
  );
});
test("launch diagnostics distinguish missing executables from platform failures without running anything", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-launch-health-")),
    file = path.join(root, "fixture.exe");
  const game = { executable: file } as Game;
  let validations = 0;
  let result = await launchHealth(game, async () => {
    validations++;
  });
  assert.equal(result.exists, false);
  assert.equal(validations, 0);
  assert.match(result.issues[0], /missing/);
  await writeFile(file, "fixture");
  result = await launchHealth(game, async () => {
    throw Error("Not a native executable");
  });
  assert.match(result.issues[0], /native/);
  assert.equal(result.ready, false);
  result = await launchHealth(game, async () => {});
  assert.equal(result.ready, true);
  assert.equal((await stat(file)).size, 7);
});
test('Steam launch repair validates the installation folder, not a native executable',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'ember-steam-health-'));try{let called=false;const result=await launchHealth({store:'steam',steamId:'123',executable:root,installed:true} as Game,async()=>{called=true;throw Error('Expected exe')});assert.equal(result.ready,true);assert.equal(result.launchMethod,'steam');assert.equal(called,false);const absent=await launchHealth({store:'steam',steamId:'123',executable:path.join(root,'missing'),installed:true} as Game,async()=>{});assert.equal(absent.ready,false)}finally{await rm(root,{recursive:true,force:true})}});
