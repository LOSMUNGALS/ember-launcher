import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { artworkFile, importSteamArtwork } from "../desktop/artwork";
import { manifestGame } from "../desktop/steam";
test("artwork protocol only maps canonical filenames inside its cache", () => {
  const dir = path.resolve("cache");
  assert.equal(
    artworkFile("ember-art://library/steam-123-cover.jpg", dir),
    path.join(dir, "steam-123-cover.jpg"),
  );
  for (const url of [
    "ember-art://library/../library.json",
    "ember-art://library/%2e%2e/library.json",
    "ember-art://other/steam-123-cover.jpg",
    "ember-art://library/steam-123-cover.jpg?x=1",
    "file:///secret",
  ])
    assert.equal(artworkFile(url, dir), null);
});
test("Steam artwork copies cached JPEG files and leaves source untouched", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-art-"));
  const source = path.join(root, "appcache", "librarycache", "123");
  await mkdir(source, { recursive: true });
  const jpeg = Buffer.from([255, 216, 255, 217]);
  await writeFile(path.join(source, "library_600x900.jpg"), jpeg);
  await writeFile(path.join(source, "library_hero.jpg"), "not a jpeg");
  const g = manifestGame(
    '"appid" "123" "name" "Fixture" "installdir" "Fixture"',
    root,
  )!;
  const destination = path.join(root, "output");
  await importSteamArtwork(root, [g], destination);
  assert.equal(g.artwork, "ember-art://library/steam-123-cover.jpg");
  assert.equal(g.hero, undefined);
  assert.deepEqual(
    await readFile(path.join(destination, "steam-123-cover.jpg")),
    jpeg,
  );
  assert.deepEqual(
    await readFile(path.join(source, "library_600x900.jpg")),
    jpeg,
  );
});
test("uninstalled games import modern capsules from hashed Steam cache folders", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "ember-uninstalled-art-"));
  const source = path.join(
    root,
    "appcache",
    "librarycache",
    "123",
    "a".repeat(40),
  );
  await mkdir(source, { recursive: true });
  const jpeg = Buffer.from([255, 216, 255, 217]);
  await writeFile(path.join(source, "library_capsule.jpg"), jpeg);
  const game = {
    ...manifestGame(
      '"appid" "123" "name" "Fixture" "installdir" "Fixture"',
      root,
    )!,
    installed: false,
    executable: "",
  };
  await importSteamArtwork(root, [game], path.join(root, "output"));
  assert.equal(game.artwork, "ember-art://library/steam-123-cover.jpg");
  assert.equal(game.installed, false);
  assert.equal(game.executable, "");
});
