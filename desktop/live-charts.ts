import { chartSnapshot, chartSource } from "./chart-snapshots";
import { jsonHttps, requestHttps } from "./http";
import { plainText } from "./steam-dashboard";
import type { CatalogGame } from "../src/v2types";
import type { StateStore } from "./state";
type Kind = "coming" | "top";
export const CHART_REFRESH_MS = 3600000,
  CHART_RETRY_MS = 300000;
export function parseLiveChart(
  html: unknown,
  kind: Kind,
  now: number,
): CatalogGame[] {
  if (typeof html !== "string" || html.length > 4 * 1024 * 1024)
    throw Error("Invalid chart response.");
  const rows = [
    ...html.matchAll(
      /<a\b([^>]*\bclass=["'][^"']*\bsearch_result_row\b[^"']*["'][^>]*)>([\s\S]*?)<\/a>/gi,
    ),
  ];
  const seen = new Set<string>(),
    games: CatalogGame[] = [];
  for (let i = 0; i < Math.min(100, rows.length); i++) {
    const [, attributes, body] = rows[i],
      id = attributes.match(/\bdata-ds-appid=["'](\d{1,12})["']/)?.[1];
    if (!id || seen.has(id) || /\/bundle\/|\/sub\//i.test(attributes)) continue;
    const title = plainText(
      body.match(
        /<span\b[^>]*class=["']title["'][^>]*>([\s\S]*?)<\/span>/i,
      )?.[1] || "",
    ).trim();
    if (
      !title ||
      /^(Steam (Deck|Controller|Machine|Frame)|Valve Index)(\b|™)/i.test(title)
    )
      continue;
    const image = body.match(/<img\b[^>]*src=["']([^"']+)["']/i)?.[1];
    const cover =
      image && /^https:\/\/[\w.-]+\.steamstatic\.com\//.test(image)
        ? image.replace(/&amp;/g, "&")
        : "";
    seen.add(id);
    games.push({
      appId: `chart-${kind}-app-${id}`,
      steamAppId: id,
      chartRank: i + 1,
      productType: "game",
      title,
      cover,
      banner: cover,
      screenshots: [],
      description:
        "Live Steam " +
        (kind === "coming" ? "most wishlisted upcoming games" : "top sellers") +
        " listing.",
      developers: [],
      publishers: [],
      genres: [],
      tags: [],
      platforms: [
        ...(/platform_img win/.test(body) ? ["windows" as const] : []),
        ...(/platform_img mac/.test(body) ? ["mac" as const] : []),
      ],
      comingSoon: kind === "coming",
      releaseDate: plainText(
        body.match(
          /class=["']search_released[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
        )?.[1] || "",
      ),
      content: "allowed",
      updated: new Date(now).toISOString(),
      discoveryList: kind,
    });
  }
  if (!games.length) throw Error("Steam returned no usable chart list.");
  return games;
}
export class LiveCharts {
  private pending = new Map<Kind, Promise<void>>();
  constructor(
    private store: StateStore,
    private readJson: typeof jsonHttps = jsonHttps,
    private now = () => Date.now(),
  ) {}
  current(kind: Kind) {
    const cached = this.store.data.charts?.[kind];
    if (
      cached &&
      cached.region === this.store.data.preferences.region &&
      Array.isArray(cached.games) &&
      cached.games.length
    )
      return cached;
    return {
      games: chartSnapshot(kind),
      source: chartSource(kind),
      updated: "2026-10-21T00:00:00.000Z",
      nextRefresh: 0,
      region: this.store.data.preferences.region,
      error: undefined as string | undefined,
    };
  }
  refresh(kind: Kind, force = false): Promise<void> {
    const pending = this.pending.get(kind);
    if (pending) return pending;
    if (!force && this.current(kind).nextRefresh > this.now())
      return Promise.resolve();
    const task = this.fetch(kind).finally(() => this.pending.delete(kind));
    this.pending.set(kind, task);
    return task;
  }
  private async fetch(kind: Kind) {
    const region = this.store.data.preferences.region,
      previous = this.current(kind);
    let next;
    try {
      const url = new URL("https://store.steampowered.com/search/results/");
      url.search = new URLSearchParams({
        filter: kind === "coming" ? "popularwishlist" : "topsellers",
        category1: "998",
        start: "0",
        count: "100",
        infinite: "1",
        cc: region,
        l: "english",
      }).toString();
      const response = await this.readJson(url.href, (value, headers) =>
        requestHttps(value, headers, AbortSignal.timeout(15000)),
      );
      if (!response || !(response.success === true || response.success === 1))
        throw Error("Steam chart request failed.");
      const now = this.now();
      const games = parseLiveChart(response.results_html, kind, now);
      if (games.length < 10)
        throw Error("Steam returned an incomplete chart list.");
      next = {
        games,
        source: `Live Steam ${kind === "coming" ? "most wishlisted upcoming games" : "Top Sellers"}`,
        updated: new Date(now).toISOString(),
        nextRefresh: now + CHART_REFRESH_MS,
        region,
      };
    } catch {
      next = {
        ...previous,
        region,
        nextRefresh: this.now() + CHART_RETRY_MS,
        error: "Steam refresh unavailable; showing the last saved list.",
      };
    }
    // A region change during a request must not commit an obsolete response.
    if (this.store.data.preferences.region !== region) return;
    this.store.data.charts ??= {};
    this.store.data.charts[kind] = next;
    await this.store.save();
  }
}
