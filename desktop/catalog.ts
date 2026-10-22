import {chartSnapshot,chartSource} from './chart-snapshots';
import {lookupTitle,matchSteamTitle} from './title-match';
import {steamPortrait} from './store-assets';
import { jsonHttps, requestHttps } from "./http";
import {communityCatalog,officialPages} from './community-catalog';
import {communityKey} from '../src/community-title';
import { plainText } from "./steam-dashboard";
import type { CatalogGame, Preferences } from "../src/v2types";
import type { Game } from "../src/types";
import type { StateStore } from "./state";
export function rankedRows(html: string) {
  const rows = [
    ...html.matchAll(/<a\b[^>]*class="[^"]*search_result_row[^"]*"[^>]*>/g),
  ];
  const ids: string[] = [],
    positions: Record<string, number> = {};
  for (let i = 0; i < Math.min(rows.length, 100); i++) {
    const id = rows[i][0].match(/data-ds-appid="(\d+)"/)?.[1];
    if (id && !positions[id]) {
      ids.push(id);
      positions[id] = i + 1;
    }
  }
  return { ids, positions };
}
export const appId = (id: unknown) => {
  if (typeof id !== "string" || !/^\d{1,12}$/.test(id))
    throw Error("Invalid Steam App ID.");
  return id;
};
export class UnavailableGameError extends Error {}
export async function steamDbIds(kind:'coming'|'top') {
 const url='https://steamdb.info/stats/'+(kind==='coming'?'mostwished':'globaltopsellers')+'/';
 const response=await requestHttps(url,{},AbortSignal.timeout(10000));
 if(response.statusCode!==200){response.resume();throw Error('SteamDB returned HTTP '+response.statusCode);}
 let html='';for await(const chunk of response){html+=chunk.toString();if(html.length>4*1024*1024){response.destroy();throw Error('Ranking page too large');}}
 const body=html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1]||'';
 const ids=[...new Set([...body.matchAll(/data-appid=["'](\d+)["']/g)].map(m=>m[1]))].slice(0,100);
 if(!ids.length)throw Error('SteamDB ranking rows unavailable');return ids;
}
export function parseCatalog(id: string, raw: any, reviews: any): CatalogGame {
  if (raw?.[id]?.success === false) throw new UnavailableGameError("Steam listing unavailable.");
  const d = raw?.[id]?.success && raw[id].data;
  if (d && typeof d.type === "string" && d.type !== "game") throw new UnavailableGameError("Not a Steam game.");
  if (!d || d.type !== "game" || String(d.steam_appid) !== id)
    throw Error("Not an available Steam game.");
  const descriptors = d.content_descriptors?.ids;
  const content = !Array.isArray(descriptors)
    ? "uncertain"
    : descriptors.some((x: number) => [3, 4].includes(x))
      ? "explicit"
      : "allowed";
  const q = reviews?.success === 1 ? reviews.query_summary : undefined;
  const valid =
    q &&
    Number.isSafeInteger(q.total_reviews) &&
    Number.isSafeInteger(q.total_positive) &&
    q.total_reviews >= 0 &&
    q.total_positive >= 0 &&
    q.total_positive <= q.total_reviews;
  const releaseDate = String(d.release_date?.date || "To be announced");
  const stamp = Date.parse(releaseDate);
  const image = (u: unknown) =>
    typeof u === "string" &&
    /^https:\/\/(?:[\w-]+\.)*(?:steamstatic\.com|steamcdn-a\.akamaihd\.net)\//.test(
      u,
    )
      ? u
      : "";
  return {
    appId: id,
    isFree: d.is_free === true,
    trailers: (d.movies||[]).map((m:any)=>image(m.mp4?.max || m.mp4?.['480'] || m.webm?.max || m.hls_h264)).filter(Boolean).slice(0,3),
    title: String(d.name).slice(0, 200),
    cover: image(d.header_image),
    banner: image(d.background_raw || d.background || d.header_image),
    screenshots: (d.screenshots || [])
      .slice(0, 12)
      .map((s: any) => image(s.path_full))
      .filter(Boolean),
    description: plainText(d.about_the_game || d.short_description),
    developers: (d.developers || []).map(String).slice(0, 20),
    publishers: (d.publishers || []).map(String).slice(0, 20),
    genres: (d.genres || [])
      .map((g: any) => String(g.description))
      .slice(0, 20),
    tags: [],
    platforms: [
      ...(d.platforms?.windows ? ["windows" as const] : []),
      ...(d.platforms?.mac ? ["mac" as const] : []),
    ],
    comingSoon: d.release_date?.coming_soon === true,
    releaseDate,
    releaseTimestamp: Number.isFinite(stamp) ? stamp : undefined,
    reviews: valid
      ? {
          positive: q.total_positive,
          total: q.total_reviews,
          summary: String(q.review_score_desc || "Not Enough Reviews"),
        }
      : undefined,
    price: d.is_free ? "Free" : d.price_overview?.final_formatted,
    content,
    updated: new Date().toISOString(),
  };
}
export function quality(g: CatalogGame, p: Preferences) {
  const r = g.reviews;
  if (!r || r.total < p.minimumReviews) return true;
  return r.total > 0 && (r.positive / r.total) * 100 >= p.minimumPositive;
}
export function recommendationScore(
  g: CatalogGame,
  library: Game[],
  catalog: Record<string, CatalogGame>,
) {
  let relevance = 0;
  for (const owned of library) {
    const meta = owned.steamId && catalog[owned.steamId];
    if (!meta) continue;
    const minutes = owned.steam?.playtimeMinutes ?? owned.seconds / 60;
    const overlap = g.genres.filter((x) => meta.genres.includes(x)).length;
    const recency = owned.steam?.lastPlayed
      ? Math.max(0, 1 - (Date.now() / 1000 - owned.steam.lastPlayed) / 2592000)
      : 0;
    relevance += overlap * (Math.log1p(minutes) + recency);
  }
  const r = g.reviews;
  return (
    relevance +
    (r && r.total
      ? ((r.positive + 5) / (r.total + 10)) * Math.log1p(r.total)
      : 0)
  );
}
export class CatalogService {
  private chartEntries=[...chartSnapshot('coming'),...chartSnapshot('top')];
  async chartDetail(id:string,full=false):Promise<CatalogGame> {
    const entry=this.chartEntries.find(g=>g.appId===id);if(!entry)throw Error('Chart entry not found.');
    const old=this.store.data.catalog[id];
    if(!full && entry.portrait && !old?.artworkVersion){const seeded={...entry,...old,portrait:old?.portrait||entry.portrait,artworkVersion:2,updated:new Date().toISOString()};this.store.data.catalog[id]=seeded;return seeded;}
    if(!full&&old?.artworkVersion===2&&Date.now()-Date.parse(old.updated)<86400000)return old;
    let steamId=old?.steamAppId||entry.steamAppId;
    let cover=old?.cover||entry.cover;
    try{
      if(!steamId){const found=await this.readJson('https://store.steampowered.com/api/storesearch/?term='+encodeURIComponent(entry.title)+'&l=english&cc='+this.store.data.preferences.region);const match=matchSteamTitle(entry.title,found.items);if(match){steamId=String(match.id);cover=match.tiny_image||cover;}}
      if(steamId){
        const raw=await this.readJson('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json='+encodeURIComponent(JSON.stringify({ids:[{appid:Number(steamId)}],context:{language:'english',country_code:this.store.data.preferences.region},data_request:{include_assets:true}})));
        const portrait=steamPortrait(steamId,raw);
        const meta=full?await this.detail(steamId).catch(()=>this.store.data.catalog[steamId!]):this.store.data.catalog[steamId];
        const result:CatalogGame={...entry,...meta,appId:id,steamAppId:steamId,origin:undefined,chartRank:entry.chartRank,productType:entry.productType,discoveryList:entry.discoveryList,comingSoon:entry.comingSoon,portrait:portrait||meta?.portrait||entry.portrait,cover:meta?.cover||cover,purchaseUrl:entry.productType==='game'?undefined:`https://store.steampowered.com/app/${steamId}/`,updated:new Date().toISOString(),artworkVersion:portrait?2:undefined};
        this.store.data.catalog[id]=result;return result;
      }
    }catch{/* Preserve verified IDs and bundled artwork on transient failures. */}
    const result={...entry,...old,steamAppId:steamId,cover};this.store.data.catalog[id]=result;return result;
  }
  private sourceIndex: CatalogGame[]=[];
  private sourceRevision='';
  private wishlist?: {ids:string[];source:string;time:number};
  community() {
    const revision=JSON.stringify(this.store.data.sources.map(s=>[s.id,s.enabled,s.updated,s.packages.length]));
    if(revision!==this.sourceRevision){this.sourceIndex=communityCatalog(this.store.data.sources);this.sourceRevision=revision;this.communityChecked.clear();}
    return this.sourceIndex;
  }
  private communityChecked=new Map<string,number>();
  private communityPending=new Map<string,Promise<CatalogGame>>();
  async communityDetail(id:string,persist=true):Promise<CatalogGame> {
    this.community();
    const old=this.store.data.catalog[id];
    if(old&&Date.now()-(this.communityChecked.get(id)||0)<300000)return old;
    let task=this.communityPending.get(id);
    if(!task){task=this.resolveCommunityDetail(id);this.communityPending.set(id,task);}
    try{
      const result=await task;
      this.communityChecked.set(id,Date.now());
      if(persist&&result!==old)await this.store.save();
      return result;
    }finally{if(this.communityPending.get(id)===task)this.communityPending.delete(id);}
  }
  private async resolveCommunityDetail(id:string):Promise<CatalogGame> {
    const old=this.store.data.catalog[id];
    const entry=this.community().find(g=>g.appId===id)||old;if(!entry)throw Error('Catalog game not found.');
    if(old&&old.origin!=='community'&&old.artworkVersion===1&&Date.now()-Date.parse(old.updated)<86400000)return old;
    const official=officialPages[communityKey(entry.title)];
    if(official){const result={...entry,title:official.title,purchaseUrl:official.url,cover:official.cover||entry.cover,portrait:official.cover||entry.portrait,banner:official.cover||entry.banner,platforms:official.platforms||[]};this.store.data.catalog[id]=result;return result;}
    if(entry.purchaseUrl){this.store.data.catalog[id]=entry;return entry;}
    try{
      const result=await this.readJson('https://store.steampowered.com/api/storesearch/?term='+encodeURIComponent(lookupTitle(entry.title))+'&l=english&cc='+this.store.data.preferences.region);
      const match=matchSteamTitle(entry.title,result.items);
      if(match){
       const fallback:CatalogGame={...entry,appId:String(match.id),origin:undefined,title:match.name,cover:typeof match.tiny_image==='string'&&/^https:\/\/[\w.-]+\.steamstatic\.com\//.test(match.tiny_image)?match.tiny_image:'',updated:new Date().toISOString()};
       const meta=await this.detail(String(match.id),false,false).catch(()=>fallback);
       this.store.data.catalog[id]=meta;this.store.data.catalog[meta.appId]=meta;return meta;
      }
    }catch{/* Keep unmatched catalog records visible without inventing Steam ownership. */}
    this.store.data.catalog[id]=entry;return entry;
  }
  private pending = new Map<string, Promise<CatalogGame>>();
  constructor(private store: StateStore, private readJson:typeof jsonHttps=jsonHttps) {}
  async detail(id: string, force = false, persist = true): Promise<CatalogGame> {
    appId(id);
    const old = this.store.data.catalog[id];
    if (!force && old && (old.artworkVersion === 1 || Boolean(process.env.EMBER_DATA_DIR)) && Date.now() - Date.parse(old.updated) < 86400000)
      return old;
    const active = this.pending.get(id);
    if (active) return active;
    const job = (async () => {
      const region = this.store.data.preferences.region;
      const [raw, reviews, assets] = await Promise.all([
        this.readJson(
          `https://store.steampowered.com/api/appdetails?appids=${id}&cc=${region}&l=english`,
        ),
        this.readJson(
          `https://store.steampowered.com/appreviews/${id}?json=1&language=all&purchase_type=all&num_per_page=0`,
        ).catch(() => null),
        this.readJson('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json='+encodeURIComponent(JSON.stringify({ids:[{appid:Number(id)}],context:{language:'english',country_code:region},data_request:{include_assets:true}}))).catch(()=>null),
      ]);
      const game = parseCatalog(id, raw, reviews);
      game.portrait=steamPortrait(id,assets);game.artworkVersion=1;game.discoveryList=old?.discoveryList;
      this.store.data.catalog[id] = game;
      if(persist)await this.store.save();
      return game;
    })();
    this.pending.set(id, job);
    try {
      return await job;
    } finally {
      this.pending.delete(id);
    }
  }
  async search(kind: "all" | "coming" | "top", term = "", page = 0) {
    if (
      !["all", "coming", "top"].includes(kind) ||
      typeof term !== "string" ||
      term.length > 150 ||
      !Number.isInteger(page) ||
      page < 0 ||
      page > 10000
    )
      throw Error("Invalid catalog query.");
    const preferences = this.store.data.preferences;
    if(kind==='coming'&&!preferences.catalogUrl){
      const rows=this.chartEntries.filter(g=>g.discoveryList==='coming'&&g.title.toLowerCase().includes(term.toLowerCase()));
      const games:CatalogGame[]=[];
      for(let i=page*24;i<Math.min(rows.length,(page+1)*24);i+=4)games.push(...await Promise.all(rows.slice(i,Math.min(i+4,(page+1)*24)).map(g=>this.chartDetail(g.appId))));
      await this.store.save();return {games,page,hasMore:(page+1)*24<rows.length,source:chartSource('coming'),total:rows.length};
    }
    if(kind==='all'&&!preferences.catalogUrl){
      const entries=this.community().filter(g=>g.title.toLowerCase().includes(term.toLowerCase()));
      if(page*24<entries.length){
        const rows=entries.slice(page*24,(page+1)*24);
        const before=rows.map(g=>this.store.data.catalog[g.appId]);
        const games:CatalogGame[]=[];
        for(let n=0;n<rows.length;n+=4){const group=await Promise.all(rows.slice(n,n+4).map(g=>this.communityDetail(g.appId,false)));games.push(...group);}
        if(rows.some((g,i)=>this.store.data.catalog[g.appId]!==before[i]))await this.store.save();
        return {games:[...new Map(games.map(g=>[g.appId,g])).values()],page,hasMore:true,source:'Combined download catalogs · matched store metadata where available'};
      }
      page-=Math.ceil(entries.length/24);
    }
    if(kind==='coming'&&!preferences.catalogUrl){
      if(!this.wishlist||Date.now()-this.wishlist.time>3600000){try{this.wishlist={ids:await steamDbIds('coming'),source:'SteamDB · most wishlisted',time:Date.now()};}catch{this.wishlist={ids:[],source:'Steam · most wishlisted (SteamDB blocked)',time:Date.now()};}}
      if(this.wishlist.ids.length){
        const games=(await Promise.allSettled(this.wishlist.ids.slice(page*24,(page+1)*24).map(id=>this.detail(id)))).flatMap(r=>r.status==='fulfilled'&&r.value.comingSoon?[{...r.value,discoveryList:'coming' as const}]:[]);
        for(const g of games)this.store.data.catalog[g.appId]=g;
        return {games,page,hasMore:(page+1)*24<this.wishlist.ids.length,source:this.wishlist.source};
      }
    }
    // Optional permitted index accepts the same paging request and returns App IDs,
    // never scripts or download URLs. Full metadata is still verified with Valve.
    const url = preferences.catalogUrl
      ? new URL(preferences.catalogUrl)
      : new URL("https://store.steampowered.com/search/results/");
    const query = {
      term,
      start: String(page * 24),
      count: "24",
      infinite: "1",
      cc: preferences.region,
      l: "english",
      category1: "998",
      filter:
        kind === "coming" ? "popularwishlist" : kind === "top" ? "topsellers" : "",
      sort_by: "",
      query: "",
    };
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    const response = await this.readJson(url.href);
    const ids = preferences.catalogUrl
      ? response.appIds
      : [
          ...String(response.results_html || "").matchAll(
            /data-ds-appid="(\d+)"/g,
          ),
        ].map((m) => m[1]);
    if (!Array.isArray(ids))
      throw Error("Catalog provider returned no appIds.");
    const unique = [
      ...new Set<string>(
        ids.filter((x: unknown) => typeof x === "string" && /^\d+$/.test(x)),
      ),
    ].slice(0, 24);
    const games: CatalogGame[] = [];
    for (let offset = 0; offset < unique.length; offset += 4) {
      const group = await Promise.allSettled(
        unique.slice(offset, offset + 4).map((id) => this.detail(id)),
      );
      for (const r of group)
        if (
          r.status === "fulfilled" &&
          quality(r.value, preferences) &&
          (kind !== "coming" || r.value.comingSoon)
        )
          {if(kind==='coming'||kind==='top')r.value.discoveryList=kind;games.push(r.value);}
    }
    return {
      games,
      total: Number.isFinite(response.total_count)
        ? response.total_count
        : undefined,
      page,
      hasMore: Number.isFinite(response.total_count)
        ? (page + 1) * 24 < response.total_count
        : unique.length >= 24,
      source: preferences.catalogUrl
        ? "Configured catalog index"
        : kind==='coming' ? 'Steam · most wishlisted (SteamDB blocked)' : "Steam public store search",
    };
  }
  async refreshRankings() {
    const ranks = this.store.data.rankings;
    const entries=this.chartEntries.filter(g=>g.discoveryList==='top');
    ranks.ids=entries.map(g=>g.appId);ranks.positions=Object.fromEntries(entries.map(g=>[g.appId,g.chartRank!]));ranks.source=chartSource('top');ranks.region='Global';ranks.updated='2026-10-21T00:00:00.000Z';ranks.nextRefresh=Date.now()+3600000;ranks.error=undefined;
    for(const entry of entries)if(!this.store.data.catalog[entry.appId])this.store.data.catalog[entry.appId]=entry;
    await this.store.save();return ranks;
  }
}
