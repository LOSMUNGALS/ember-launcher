import { httpsUrl, jsonHttps, publicAddress } from "./http";
import {isIP} from 'node:net';
import type { GamePackage, PackageSource } from "../src/v2types";
import { randomUUID, createHash } from "node:crypto";
import directory from './source-directory.json';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
export const BUNDLED_CATALOG_VERSION=4;
export function upgradeBundledSources(current:PackageSource[],supplied:PackageSource[],previousVersion:number){
 const result=[...current];
 for(const source of supplied){
  const index=result.findIndex(s=>s.id===source.id||sourceKey(s.url)===sourceKey(source.url));
  if(index>=0&&(source.bundledRevision||3)<=previousVersion)continue;
  if(index<0){if((source.bundledRevision||3)>previousVersion)result.push(source);continue;}
  const old=result[index],ids=new Set(source.packages.map(p=>p.id));
  // Keep source IDs for existing download records and preserve user enable/disable choices.
  result[index]={...source,id:old.id,enabled:old.enabled,packages:[...source.packages,...old.packages.filter(p=>!ids.has(p.id))]};
 }
 return result;
}
export async function bundledSources(root: string): Promise<PackageSource[]> {
  return Promise.all(directory.sources.map(async row=>({
    ...configuredSource(row.name,row.source_url),
    ...parseSourceFeed(JSON.parse((await readFile(path.join(root,row.file),'utf8')).replace(/^\uFEFF/,''))),
    id:'default-'+createHash('sha256').update(sourceKey(row.source_url)).digest('hex').slice(0,16),
    updated:new Date().toISOString(), snapshotOrigin:row.snapshot_only?'Bundled catalog (provider feed URL not supplied)':'Bundled catalog',localSnapshot:row.snapshot_only===true,bundledRevision:row.catalog_revision,
  })));
}
export const sourceKey = (value: string) => { const u = httpsUrl(value); u.searchParams.delete('utm_source'); return u.href; };
export function configuredSource(name: string, url: string): PackageSource {
  httpsUrl(url);
  if (typeof name !== 'string' || !name.trim() || name.length > 150) throw Error('Source name is required (maximum 150 characters).');
  return {id:randomUUID(), name, url, description:'Configured; catalog has not loaded.', enabled:true, packages:[]};
}
export function importSourceJson(raw: any, origin?: string): PackageSource[] {
  if(raw?.sources || raw?.source_url) {
    const rows = raw.sources ?? [raw];
    if(!Array.isArray(rows) || rows.length > 100) throw Error('Invalid source directory.');
    return rows.map((row:any)=>configuredSource(row.name,row.source_url));
  }
  const feed = parseSourceFeed(raw);
  return [{...configuredSource(feed.name, origin || 'https://local.invalid/'+randomUUID()+'.json'),...feed,localSnapshot:!origin,snapshotOrigin:'Imported JSON file',updated:new Date().toISOString()}];
}
export function migrateSources(sources: PackageSource[], version = 0): PackageSource[] {
  if(version >= 2) return sources;
  const defaults = defaultSources();
  const keys = new Set(defaults.map(s=>sourceKey(s.url)));
  return [...sources.filter(s=>!s.id.startsWith('default-') && !keys.has(sourceKey(s.url))),...defaults];
}
export function relativeTarget(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value ||
    value.length > 500 ||
    value.includes("\\") ||
    value.includes(":") ||
    value.startsWith("/") ||
    value
      .split("/")
      .some(
        (p) =>
          !p ||
          p === "." ||
          p === ".." ||
          /[. ]$/.test(p) ||
          /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(p),
      ) ||
    /[\x00-\x1f]/.test(value)
  )
    throw Error("Unsafe relative file path.");
  return value;
}
export function validateFeed(feed: any): {
  name: string;
  description: string;
  packages: GamePackage[];
} {
  if (
    feed?.version !== 1 ||
    typeof feed.name !== "string" ||
    !feed.name.trim() ||
    feed.name.length > 150 ||
    typeof feed.id !== "string" ||
    !/^[\w-]{1,100}$/.test(feed.id) ||
    !Array.isArray(feed.packages) ||
    feed.packages.length > 1000
  )
    throw Error(
      "Source must have version 1, id, name and up to 1000 packages.",
    );
  const ids = new Set<string>();
  const packages = feed.packages.map((p: any) => {
    for (const k of ["id", "gameId", "title", "version", "filename"])
      if (typeof p[k] !== "string" || !p[k] || p[k].length > 200)
        throw Error("Missing or invalid package " + k);
    if (!/^[\w-]+$/.test(p.id) || !/^([\w-]+)$/.test(p.gameId) || ids.has(p.id))
      throw Error("Duplicate or invalid package identity.");
    ids.add(p.id);
    if (p.steamAppId !== undefined && !/^\d+$/.test(p.steamAppId))
      throw Error("Invalid Steam App ID.");
    if (
      !["archive", "installer", "drm-free", "multiplayer"].includes(p.type) ||
      !Array.isArray(p.platforms) ||
      !p.platforms.length ||
      p.platforms.some((x: string) => !["windows", "mac"].includes(x))
    )
      throw Error("Invalid package type or platforms.");
    if (
      !Number.isSafeInteger(p.bytes) ||
      p.bytes <= 0 ||
      p.bytes > 1024 ** 4 ||
      typeof p.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/i.test(p.sha256)
    )
      throw Error("Exact positive byte size and SHA-256 are required.");
    httpsUrl(p.url);
    relativeTarget(p.filename);
    if (p.filename.includes("/"))
      throw Error("Filename must not contain directories.");
    if (!p.install || !["zip", "installer"].includes(p.install.method))
      throw Error("Supported installation methods: zip, installer.");
    if (p.install.method === "zip") {
      if (!/\.zip$/i.test(p.filename))
        throw Error("Archives must be ZIP files.");
      relativeTarget(p.install.executable);
    } else if (!/\.(exe|msi|pkg|dmg)$/i.test(p.filename))
      throw Error("Unsupported native installer extension.");
    if (
      !p.authorization ||
      typeof p.authorization.license !== "string" ||
      !p.authorization.license.trim() ||
      typeof p.authorization.distribution !== "string" ||
      !p.authorization.distribution.trim()
    )
      throw Error("License and distribution authorization metadata required.");
    httpsUrl(p.authorization.url);
    return {
      id: p.id,
      gameId: p.gameId,
      steamAppId: p.steamAppId,
      title: p.title,
      sourceName: feed.name,
      version: p.version,
      type: p.type,
      platforms: p.platforms,
      bytes: p.bytes,
      url: p.url,
      sha256: p.sha256.toLowerCase(),
      filename: p.filename,
      install: { method: p.install.method, executable: p.install.executable },
      authorization: {
        license: p.authorization.license.slice(0, 1000),
        distribution: p.authorization.distribution.slice(0, 2000),
        url: p.authorization.url,
      },
    } as GamePackage;
  });
  return {
    name: feed.name,
    description: String(feed.description || "").slice(0, 2000),
    packages,
  };
}
export async function loadSource(url: string): Promise<PackageSource> {
  httpsUrl(url);
  const feed = parseSourceFeed(await jsonHttps(url, undefined, 32 * 1024 * 1024));
  return {
    id: randomUUID(),
    url,
    enabled: true,
    updated: new Date().toISOString(),
    ...feed,
  };
}

export function safeMagnet(value: string) {
  if (value.length > 16000) throw Error("Magnet link too long.");
  const u = new URL(value);
  const xt = u.searchParams.get("xt") || "";
  if (u.protocol !== "magnet:" || !/^urn:btih:([a-f0-9]{40}|[a-z2-7]{32})$/i.test(xt)) throw Error("Invalid torrent magnet.");
  // Only retain the hash and display name. Discovery uses DHT and an app-controlled tracker; arbitrary web seeds,
  // local trackers and filesystem URLs supplied by feeds are never followed.
  const clean = new URL("magnet:?");
  clean.searchParams.set("xt", xt);
  const name = u.searchParams.get("dn");
  if (name) clean.searchParams.set("dn", name.slice(0, 300));
  const trackers = [...new Set(u.searchParams.getAll('tr'))].filter(value=>{
    try {const t=new URL(value); return t.protocol==='udp:' && !t.username && !t.password && !!t.port && t.hostname.includes('.') && t.hostname!=='localhost' && (!isIP(t.hostname)||publicAddress(t.hostname));} catch{return false;}
  }).slice(0,12);
  return "magnet:?xt=" + xt.toLowerCase() + (name ? "&dn=" + encodeURIComponent(name.slice(0,300)) : "") + trackers.map(t=>'&tr='+encodeURIComponent(t)).join('');
}
export function parseSourceFeed(raw: any): {name: string; description: string; packages: GamePackage[]} {
  if (raw?.version === 1) return validateFeed(raw);
  const rows = Array.isArray(raw) ? raw : raw?.downloads;
  if (!Array.isArray(rows) || rows.length > 50000) throw Error("Expected an Ember package feed or a JSON download list (name, downloads). Maximum 50,000 entries.");
  if (!Array.isArray(raw) && (typeof raw?.name !== 'string' || !raw.name.trim() || raw.name.length > 150)) throw Error('Catalog must contain a valid name.');
  const name = Array.isArray(raw) ? "Imported archive" : raw.name;
  const packages: GamePackage[] = [], seen = new Set<string>();
  for (const row of rows) {
    const title = row?.title || row?.name;
    if (typeof title !== "string" || !title.trim() || title.length > 500) continue;
    const uris = Array.isArray(row.uris) ? row.uris : row.magnet ? [row.magnet] : [];
    for (const uri of uris.slice(0,20)) {
      if (typeof uri !== "string") continue;
      try {
        const torrent = uri.startsWith("magnet:");
        const url = torrent ? safeMagnet(uri) : httpsUrl(uri).href;
        const id = createHash("sha256").update(title + "\n" + url).digest("hex").slice(0,32);
        if (seen.has(id)) continue;
        seen.add(id);
        if (packages.length >= 100000) throw Error("Feed has too many download links.");
        packages.push({id, gameId:id, title, sourceName:name, version:"", type:"archive", platforms:["windows"], bytes:0,
          url, sha256:"", filename:id+".zip", install:{method:"zip"},
          authorization:{license:"Not supplied by feed", distribution:"Community download listing", url:"https://github.com/"},
          transport:torrent ? "torrent" : "host", sizeLabel:String(row.fileSize || row.packed || "Size unknown").slice(0,80),
          uploadDate:typeof (row.uploadDate || row.date) === "string" ? (row.uploadDate || row.date).slice(0,50) : undefined});
      } catch { /* Ignore malformed individual links, retain valid alternatives. */ }
    }
  }
  if (rows.length && !packages.length) throw Error("This JSON contains no supported HTTPS or magnet download links.");
  return {name,description:"Community feed. Availability and versions are supplied by its publisher.",packages};
}
export const defaultSources = (): PackageSource[] => directory.sources.map(row=>({...configuredSource(row.name,row.source_url),localSnapshot:row.snapshot_only===true,bundledRevision:row.catalog_revision,id:'default-'+createHash('sha256').update(sourceKey(row.source_url)).digest('hex').slice(0,16)}));
export async function refreshSource(source: PackageSource,loader:typeof loadSource=loadSource) {
  if(source.localSnapshot) return source;
  const lastAttempt=new Date().toISOString();
  try {
    const feed = await loader(source.url);
    return {...source,...feed,id:source.id,enabled:source.enabled,snapshotOrigin:undefined,fallbackUrl:undefined,resolvedUrl:source.url,error:undefined,lastAttempt,lastSuccess:new Date().toISOString()};
  } catch (error) {
    return {...source,lastAttempt,error:String(error)+(source.packages.length?' Previously loaded catalog retained.':' Import a full catalog JSON file to load releases.')};
  }
}
