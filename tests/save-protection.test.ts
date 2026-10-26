import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { SaveVersions } from "../desktop/save-versions";
import { displayZoom, changeZoom } from "../desktop/display-zoom";
import { diagnosticReport } from "../desktop/diagnostics";
import { initialState } from "../desktop/state";
test("zoom composes with display sizing, resets and stays bounded", () => {
  assert.equal(displayZoom(3840), 1.6);
  assert.equal(displayZoom(1280), 1);
  assert.equal(changeZoom(1, 1), 1.1);
  assert.equal(displayZoom(1920, 0.6), 0.6);
  assert.equal(displayZoom(3840, 1.8), 2.5);
  assert.equal(changeZoom(0.6, -1), 0.6);
  assert.equal(changeZoom(1.8, 1), 1.8);
});
test("versioned saves verify hashes, restore previous files, reject corruption and round trip cloud", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-saves-"));
  try {
    const source = path.join(root, "saves");
    await mkdir(source);
    await writeFile(path.join(source, "slot.dat"), "first");
    const v = new SaveVersions(path.join(root, "backups")),
      one = await v.snapshot("steam-123", "Fixture", source);
    await writeFile(path.join(source, "slot.dat"), "second");
    const two = await v.snapshot("steam-123", "Fixture", source);
    assert.notEqual(one.id, two.id);
    assert.equal((await v.list("steam-123")).length, 2);
    assert.equal((await v.list("steam-other")).length, 0);
    const payload = await v.payload(one.id, "steam-123"),
      cloud = await v.importCloud(payload);
    const result = await v.restore(cloud.id, "steam-123", "Fixture", source);
    assert.equal(
      await readFile(path.join(source, "slot.dat"), "utf8"),
      "first",
    );
    assert.equal(
      await readFile(path.join(result.rollback, "slot.dat"), "utf8"),
      "second",
    );
    await writeFile(
      path.join(cloud.directory, "files", "slot.dat"),
      "tampered",
    );
    await assert.rejects(
      v.restore(cloud.id, "steam-123", "Fixture", source),
      /integrity/,
    );
    assert.equal(
      await readFile(path.join(source, "slot.dat"), "utf8"),
      "first",
    );
    await assert.rejects(v.manifest(one.id, "wrong"), /belong/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
test("diagnostics omit secrets, paths, source links, names and raw errors", () => {
  const state = initialState();
  state.sources.push({
    id: "private",
    name: "secret-source",
    url: "https://user:pass@example.com/token",
    enabled: true,
    description: "",
    packages: [],
    error: "secret-password",
    updated: "",
  });
  const report = JSON.stringify(diagnosticReport(state, "fixture"));
  assert.equal(/secret|token|pass|example.com/.test(report), false);
  assert.match(report, /Refresh failed/);
});
