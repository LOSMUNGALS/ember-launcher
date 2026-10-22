import { StateStore } from "../desktop/state";
import { CatalogService } from "../desktop/catalog";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import path from "node:path";
async function main() {
  await mkdir(".test-data", { recursive: true });
  const dir = await mkdtemp(path.resolve(".test-data/live-catalog-"));
  const state = new StateStore(path.join(dir, "state.json")),
    catalog = new CatalogService(state);
  const details = await catalog.detail("570");
  const ranks = await catalog.refreshRankings();
  const upcoming = await catalog.search("coming", "", 0);
  const search = await catalog.search("all", "Portal", 0);
  const result = {
    checked: new Date().toISOString(),
    detail: {
      title: details.title,
      reviews: details.reviews,
      platforms: details.platforms,
      content: details.content,
    },
    rankings: {
      count: ranks.ids.length,
      first: ranks.ids.slice(0, 5),
      error: ranks.error,
      source: ranks.source,
      region: ranks.region,
    },
    upcoming: {
      eligible: upcoming.games.length,
      allUpcoming: upcoming.games.every((g) => g.comingSoon),
      hasMore: upcoming.hasMore,
    },
    search: {
      eligible: search.games.length,
      titles: search.games.slice(0, 5).map((g) => g.title),
    },
  };
  await mkdir("artifacts", { recursive: true });
  await writeFile(
    "artifacts/catalog-live.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result, null, 2));
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
