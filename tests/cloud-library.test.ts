import { test } from "node:test";
import assert from "node:assert/strict";
import { cloudGames, restoreCloud } from "../desktop/cloud-library";
test("cloud preferences omit local paths and restore without pretending installation", () => {
  const local: any = {
    id: "local1",
    name: "Example",
    steamId: "123",
    executable: "C:\\private\\game.exe",
    args: ["secret"],
    saved: true,
    favorite: true,
    collections: ["Weekend"],
    playStatus: "playing",
    installed: true,
  };
  const entries = cloudGames([local]);
  assert.equal(JSON.stringify(entries).includes("private"), false);
  const games: any[] = [];
  restoreCloud(games, entries);
  assert.equal(games[0].installed, false);
  assert.equal(games[0].executable, "");
  assert.equal(games[0].favorite, true);
  restoreCloud(games, entries);
  assert.equal(games.length, 1);
  const installed = [local];
  restoreCloud(installed, [{ ...entries[0], favorite: false }]);
  assert.equal(local.executable, "C:\\private\\game.exe");
  assert.equal(local.installed, true);
  assert.equal(local.favorite, false);
});

test("restored non-Steam identities survive another backup and restore", () => {
  const original: any = { id: "fixture-local", name: "Local", saved: true };
  const entries = cloudGames([original]),
    games: any[] = [];
  restoreCloud(games, entries);
  restoreCloud(games, cloudGames(games));
  assert.equal(games.length, 1);
  assert.equal(cloudGames(games)[0].key, entries[0].key);
});
test("Steam and local copies share one cloud entry and both receive restored preferences", () => {
  const games: any[] = [
    {
      id: "steam-123",
      steamId: "123",
      name: "Fixture",
      saved: true,
      favorite: false,
      collections: ["Steam"],
      playStatus: "finished",
      executable: "C:\\steam.exe",
      installed: true,
    },
    {
      id: "local-fixture",
      steamId: "123",
      name: "Fixture",
      saved: false,
      favorite: true,
      collections: ["Local"],
      playStatus: "playing",
      executable: "C:\\local.exe",
      installed: true,
    },
  ];
  const entries = cloudGames(games);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].favorite, true);
  assert.equal(entries[0].playStatus, "playing");
  assert.deepEqual(entries[0].collections, ["Steam", "Local"]);
  restoreCloud(games, [{ ...entries[0], favorite: false }]);
  assert.ok(games.every((g) => g.favorite === false && g.installed));
  assert.equal(games[0].executable, "C:\\steam.exe");
  assert.equal(games[1].executable, "C:\\local.exe");
});
