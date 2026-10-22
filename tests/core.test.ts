import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { LibraryStore, validateGame, emptyLibrary } from "../desktop/library";
import { launchPlan } from "../desktop/platform";
import { manifestGame, scanSteam } from "../desktop/steam";
import type { Game } from "../src/types";
const game = (): Game => ({
  id: "test",
  name: "Test game",
  executable: path.resolve("test.exe"),
  args: [],
  store: "local",
  platform: "windows",
  seconds: 0,
  description: "",
  added: new Date().toISOString(),
});
test("atomic storage serializes concurrent changes and keeps the previous backup", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-test-"));
  const store = new LibraryStore(path.join(root, "library.json"));
  await store.load();
  await Promise.all([
    store.mutate((d) => d.games.push(game())),
    store.mutate((d) => (d.games[0].seconds += 10)),
  ]);
  const again = new LibraryStore(store.file);
  await again.load();
  assert.equal(again.data.games[0].seconds, 10);
  assert.equal(
    JSON.parse(await readFile(store.file + ".bak", "utf8")).games[0].seconds,
    0,
  );
});
test("invalid mutation leaves current data intact and subsequent save succeeds", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-test-"));
  const store = new LibraryStore(path.join(root, "library.json"));
  await assert.rejects(
    store.mutate((d) =>
      d.games.push({ ...game(), args: [3] as unknown as string[] }),
    ),
  );
  assert.equal(store.data.games.length, 0);
  await store.mutate((d) => d.games.push(game()));
  assert.equal(store.data.games.length, 1);
});
test("corrupt storage is preserved rather than silently reset", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-test-"));
  const file = path.join(root, "library.json");
  await writeFile(file, "broken");
  await assert.rejects(
    new LibraryStore(file).load(),
    /Original file preserved/,
  );
  assert.equal(await readFile(file, "utf8"), "broken");
});
test("native launch keeps shell metacharacters as literal arguments", () => {
  const g = { ...game(), args: ["a b", "$(anything)", "& danger"] };
  const plan = launchPlan(g, emptyLibrary().settings, "win32");
  assert.deepEqual(plan.args, g.args);
  assert.equal(plan.command, g.executable);
});
test("macOS blocks Windows games even with legacy Wine settings", () => {
  assert.throws(
    () => launchPlan(game(), emptyLibrary().settings, "darwin"),
    /native Mac games only/,
  );
  assert.throws(
    () =>
      launchPlan(
        game(),
        { wine: "/opt/wine", prefix: "/prefix", graphics: "dxvk" },
        "darwin",
      ),
    /native Mac games only/,
  );
});
test("native macOS application waits and preserves argument boundaries", () => {
  const plan = launchPlan(
    {
      ...game(),
      platform: "native",
      executable: "/Applications/Test.app",
      args: ["two words"],
    },
    emptyLibrary().settings,
    "darwin",
  );
  assert.deepEqual(plan.args, [
    "-W",
    "-a",
    "/Applications/Test.app",
    "--args",
    "two words",
  ]);
});
test("validation rejects malformed arguments and Steam identifiers", () => {
  assert.throws(() => validateGame({ ...game(), steamId: "123/evil" }));
  assert.throws(() => validateGame({ ...game(), args: ["bad\0"] }));
});
test("Steam parser rejects traversal and malformed manifests", () => {
  assert.equal(
    manifestGame(
      '"appid" "12" "name" "Game" "installdir" "../escape"',
      os.tmpdir(),
    ),
    null,
  );
  assert.equal(manifestGame("broken", os.tmpdir()), null);
});
test("Steam scan reads actual fixture manifests and ignores unrelated files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-steam-"));
  await mkdir(path.join(root, "steamapps", "common", "Fixture"), {
    recursive: true,
  });
  await writeFile(
    path.join(root, "steamapps", "appmanifest_123.acf"),
    '"AppState" { "appid" "123" "name" "Fixture Game" "installdir" "Fixture" "StateFlags" "4" }',
  );
  const games = await scanSteam(root);
  assert.equal(games.length, 1);
  assert.equal(games[0].id, "steam-123");
  assert.equal(games[0].name, "Fixture Game");
});
