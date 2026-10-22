import { test } from "node:test";
import assert from "node:assert/strict";
import { homeSelection } from "../src/home";
import { initialState } from "../desktop/state";
import type { Game } from "../src/types";
import type { CatalogGame } from "../src/v2types";
const game = (id: string, extra: Partial<Game> = {}): Game => ({
  id: "steam-" + id,
  steamId: id,
  name: id,
  executable: "",
  installed: true,
  store: "steam",
  platform: "native",
  seconds: 0,
  args: [],
  description: "",
  added: "2026-01-01",
  ...extra,
});
const meta = (id: string): CatalogGame => ({
  appId: id,
  title: id,
  cover: "",
  banner: "",
  screenshots: [],
  description: "",
  developers: [],
  publishers: [],
  genres: ["Action"],
  tags: [],
  platforms: ["windows"],
  comingSoon: false,
  releaseDate: "",
  content: "allowed",
  discoveryList: "top",
  updated: "",
});
const catalog = Object.fromEntries(
  ["1", "2", "3", "4", "5"].map((id) => [id, meta(id)]),
);
const prefs = initialState().preferences;
test("Home alternates Ember activity and unplayed dashboard games", () => {
  const games = [
    game("1", { steam: { lastPlayed: 100, playtimeMinutes: 10 } }),
    game("2", { lastLaunchRequested: "2026-01-02", steam: { lastPlayed: 200, playtimeMinutes: 20 } }),
    game("3", { owned: true }),
    game("4", { owned: true }),
  ];
  assert.equal(homeSelection(games, catalog, prefs, 1).heroGame?.steamId, "2");
  const second = homeSelection(games, catalog, prefs, 2);
  assert.equal(second.discover, true);
  assert.equal(second.heroMeta?.appId, "3");
  assert.equal(homeSelection(games, catalog, prefs, 3).heroGame?.steamId, "2");
  assert.equal(homeSelection(games, catalog, prefs, 4).heroMeta?.appId, "4");
  assert.deepEqual(second.recommendations.map((g) => g.appId).sort(), [
    "3",
    "4",
    "5",
  ]);
});
test("recommendations exclude Steam history, Ember sessions, launch requests and duplicate identities", () => {
  const games = [
    game("1", { seconds: 1 }),
    game("2", { lastPlayed: "2026-01-01" }),
    game("3", { lastLaunchRequested: "2026-01-02" }),
    game("4", { steam: { playtimeMinutes: 10 } }),
    game("4", { id: "duplicate", owned: false }),
  ];
  assert.deepEqual(
    homeSelection(games, catalog, prefs, 2).recommendations.map((g) => g.appId),
    ["5"],
  );
});
test("no discovery candidate never relabels the last played title as new", () => {
  const g = game("1", { seconds: 1, lastPlayed: "2026-01-01" });
  const result = homeSelection([g], { "1": meta("1") }, prefs, 2);
  assert.equal(result.discover, false);
  assert.equal(result.heroGame?.steamId, "1");
  assert.equal(result.recommendations.length, 0);
});

test("unsaved unowned discoveries stay out of Home including cached recommendations", () => {
  const dismissed = game("1", {saved:false,owned:false,installed:false});
  const result = homeSelection([dismissed], {"1":{...meta("1"),reviews:{total:100,positive:99,summary:"Positive"}}}, prefs, 2);
  assert.equal(result.heroGame,undefined);
  assert.equal(result.heroMeta,undefined);
  assert.equal(result.recommendations.length,0);
});


test("Steam-only recency does not enter Recently Played; only ranked lists recommend", () => {
 const result=homeSelection([game("1",{steam:{lastPlayed:200,playtimeMinutes:20}})],{"2":{...meta("2"),discoveryList:undefined},"3":meta("3"),alias:meta("3")},prefs,2);
 assert.equal(result.recent.length,0);
 assert.deepEqual(result.recommendations.map(m=>m.appId),["3"]);
 assert.equal(result.heroMeta?.appId,"2");
});
