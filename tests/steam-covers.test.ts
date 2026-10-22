import { test } from "node:test";
import assert from "node:assert/strict";
import { steamCoverSources } from "../src/steam-covers";
test("uninstalled Steam games get portrait covers without metadata or cached artwork", () => {
  const sources = steamCoverSources("1887840");
  assert.ok(sources.length > 0);
  assert.ok(
    sources.slice(0,-1).every((url) => /\/1887840\/library_(600x900|capsule)\./.test(url)),
  );
  assert.ok(sources.at(-1)?.endsWith("/header.jpg"));
});
test("cached portrait is first and invalid app IDs cannot construct remote URLs", () => {
  const cached = "ember-art://library/steam-1887840-cover.jpg";
  assert.equal(steamCoverSources("1887840", cached)[0], cached);
  assert.deepEqual(steamCoverSources("../escape"), []);
  assert.deepEqual(steamCoverSources(undefined), []);
});
