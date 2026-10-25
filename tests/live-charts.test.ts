import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { StateStore } from "../desktop/state";
import {
  LiveCharts,
  parseLiveChart,
  CHART_REFRESH_MS,
  CHART_RETRY_MS,
} from "../desktop/live-charts";
import { CatalogService } from "../desktop/catalog";
const row = (id: number, title = "Game " + id) =>
  `<a href="https://store.steampowered.com/app/${id}/" data-ds-appid="${id}" class="search_result_row"><img src="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${id}/capsule.jpg"><span class="title">${title}</span><span class="platform_img win"></span><div class="search_released responsive_secondrow">Coming soon</div></a>`;
const response = (start = 100) => ({
  success: 1,
  results_html: Array.from({ length: 12 }, (_, i) => row(start + i)).join(""),
});
test("live chart parsing retains order, safe artwork and ranks, excluding duplicates and hardware", () => {
  const html =
    row(20, "Alpha &amp; Beta") +
    row(21, "Steam Deck") +
    row(22, "Gamma") +
    row(20, "Duplicate");
  const games = parseLiveChart(html, "top", Date.now());
  assert.deepEqual(
    games.map((g) => g.steamAppId),
    ["20", "22"],
  );
  assert.deepEqual(
    games.map((g) => g.chartRank),
    [1, 3],
  );
  assert.equal(games[0].title, "Alpha & Beta");
  assert.ok(games[0].cover.startsWith("https:"));
  assert.equal(games[0].comingSoon, false);
  assert.throws(
    () => parseLiveChart("<html>blocked</html>", "coming", 0),
    /usable/,
  );
});
test("charts refresh hourly, share in-flight fetches, retain success on failures and retry after five minutes", async () => {
  const store = new StateStore("unused");
  store.save = async () => {};
  let now = 100000,
    calls = 0,
    fail = false;
  const charts = new LiveCharts(
    store,
    async (url) => {
      calls++;
      assert.match(url, /category1=998/);
      if (fail) throw Error("offline");
      return response();
    },
    () => now,
  );
  assert.match(charts.current("top").source, /snapshot/);
  await Promise.all([charts.refresh("top"), charts.refresh("top")]);
  assert.equal(calls, 1);
  assert.equal(charts.current("top").games.length, 12);
  const stamp = charts.current("top").updated;
  await charts.refresh("top");
  assert.equal(calls, 1);
  now += CHART_REFRESH_MS;
  fail = true;
  await charts.refresh("top");
  assert.equal(calls, 2);
  assert.equal(charts.current("top").updated, stamp);
  assert.equal(charts.current("top").nextRefresh, now + CHART_RETRY_MS);
  assert.ok(charts.current("top").error);
  await charts.refresh("top");
  assert.equal(calls, 2);
  fail = false;
  now += CHART_RETRY_MS;
  await charts.refresh("top");
  assert.equal(calls, 3);
  assert.equal(charts.current("top").error, undefined);
  await charts.refresh("top", true);
  assert.equal(calls, 4);
});
test("chart snapshots survive restart and malformed remote data never erases the last list", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "ember-chart-cache-")),
    file = path.join(directory, "state.json"),
    store = new StateStore(file);
  await new LiveCharts(store, async () => response()).refresh("coming");
  const old = store.data.charts!.coming!.games.map((g) => g.appId);
  const loaded = new StateStore(file);
  await loaded.load();
  const charts = new LiveCharts(loaded, async () => ({
    success: 1,
    results_html: "<html>challenge</html>",
  }));
  assert.deepEqual(
    charts.current("coming").games.map((g) => g.appId),
    old,
  );
  await charts.refresh("coming", true);
  assert.deepEqual(
    charts.current("coming").games.map((g) => g.appId),
    old,
  );
  assert.ok(charts.current("coming").error);
});
test("region changes discard obsolete requests and force new charts", async () => {
  const store = new StateStore("unused");
  store.save = async () => {};
  let complete!: (value: any) => void;
  const charts = new LiveCharts(
    store,
    async () =>
      new Promise((resolve) => {
        complete = resolve;
      }),
  );
  const pending = charts.refresh("top");
  store.data.preferences.region = "GB";
  complete(response());
  await pending;
  assert.equal(store.data.charts?.top, undefined);
});
test("catalog uses live chart order and removes stale wishlist entries from filtered candidates", async () => {
  const store = new StateStore("unused");
  store.save = async () => {};
  const service = new CatalogService(store, async (url) =>
    url.includes("/search/results/")
      ? response(url.includes("popularwishlist") ? 200 : 400)
      : Promise.reject(Error("metadata unavailable")),
  );
  const ranks = await service.refreshRankings();
  assert.equal(ranks.ids.length, 12);
  assert.equal(ranks.region, "US");
  assert.match(ranks.source, /Live Steam/);
  assert.equal(ranks.positions![ranks.ids[0]], 1);
  const result = await service.search("coming", "", 0);
  assert.equal(result.games.length, 12);
  assert.equal(result.games[0].steamAppId, "200");
  assert.equal(result.hasMore, false);
  assert.match(result.source, /Live Steam/);
});
