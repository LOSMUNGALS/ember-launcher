import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
import { LiveCharts } from "../desktop/live-charts.ts";
import { StateStore } from "../desktop/state.ts";
await mkdir(".test-data", { recursive: true });
await mkdir("artifacts", { recursive: true });
const directory = await mkdtemp(path.resolve(".test-data/live-charts-")),
  store = new StateStore(path.join(directory, "state.json"));
const charts = new LiveCharts(store);
await Promise.all([
  charts.refresh("coming", true),
  charts.refresh("top", true),
]);
const report = {};
for (const kind of ["coming", "top"]) {
  const chart = charts.current(kind);
  assert.match(chart.source, /^Live Steam/);
  assert.equal(chart.error, undefined);
  assert.ok(chart.games.length >= 10);
  assert.equal(
    new Set(chart.games.map((g) => g.steamAppId)).size,
    chart.games.length,
  );
  assert.ok(chart.games.every((g) => g.productType === "game"));
  report[kind] = {
    count: chart.games.length,
    updated: chart.updated,
    source: chart.source,
  };
}
const restarted = new StateStore(store.file);
await restarted.load();
assert.equal(restarted.data.charts.top.games.length, report.top.count);
await writeFile(
  "artifacts/live-chart-verification.json",
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
