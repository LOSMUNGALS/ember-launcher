import { mkdir, lstat, statfs } from "node:fs/promises";
import path from "node:path";
import { lstatSync } from "node:fs";
import { Resolver } from "node:dns/promises";
import { publicAddress } from "./http";
import type { DownloadJob } from "../src/v2types";
import { relativeTarget, safeMagnet } from "./sources";
// Pin a public IPv4 result, rather than allowing feed-supplied tracker URLs.
export async function discoveryTrackers(magnet: string): Promise<string[]> {
  const resolver = new Resolver({timeout:2000, tries:1});
  const trackers = [...new URL(safeMagnet(magnet)).searchParams.getAll('tr'), 'udp://tracker.opentrackr.org:1337/announce'];
  const results = await Promise.all([...new Set(trackers)].map(async value=>{
    try {
      const u=new URL(value), addresses=await resolver.resolve4(u.hostname);
      if(!addresses.length||addresses.some(ip=>!publicAddress(ip))) return [];
      return addresses.slice(0,1).map(ip=>`udp://${ip}:${u.port}/announce`);
    } catch{return [];}
  }));
  return [...new Set(results.flat())];
}
export function torrentDirectory(job: DownloadJob) {
  if (!/^[0-9a-f-]{36}$/.test(job.id) || !path.isAbsolute(job.destination)) throw Error("Invalid torrent destination.");
  return path.join(job.destination, "Ember-download-" + job.id);
}
export function validateTorrentFiles(files: {path:string;length:number}[], length: number) {
  if (!files.length || files.length > 100000 || !Number.isSafeInteger(length) || length <= 0 || length > 1024 ** 4) throw Error("Invalid torrent size or file count.");
  const seen = new Set<string>();
  for (const f of files) {
    relativeTarget(f.path.split(path.sep).join("/"));
    if (!Number.isSafeInteger(f.length) || f.length < 0 || seen.has(f.path.toLowerCase())) throw Error("Invalid or duplicate torrent file.");
    seen.add(f.path.toLowerCase());
  }
}
export async function runTorrent(job: DownloadJob, signal: AbortSignal, changed: () => void, save: () => Promise<void>, testOptions?: {clientOptions?: any; onTorrent?: (torrent:any)=>void; announce?: string[]; metadataTimeoutMs?: number}) {
  process.env.WS_NO_BUFFER_UTIL = "1";
  process.env.WS_NO_UTF_8_VALIDATE = "1";
  const [{default: WebTorrent}, {default: FileStore}] = await Promise.all([import("webtorrent"), import("fs-chunk-store")]);
  const directory = torrentDirectory(job);
  await mkdir(directory, {recursive:true});
  if ((await lstat(directory)).isSymbolicLink()) throw Error("Download folder must not be a symbolic link.");
  const disk = await statfs(directory);
  const announce = testOptions?.announce ?? (testOptions ? [] : await discoveryTrackers(job.package.url));
  const client = new WebTorrent({downloadLimit:-1,uploadLimit:-1,maxConns:100,dht:true,tracker:announce.length ? {} : false,lsd:false,natUpnp:false,natPmp:false,utp:false,webSeeds:false,...testOptions?.clientOptions} as any);
  job.peers = 0;
  job.discovery = announce.length ? 'Searching trackers and DHT for peers…' : 'Searching DHT for peers; tracker unavailable…';
  changed();
  // Validate metadata before the storage implementation can open any payload file.
  class SafeStore {
    inner: any;
    failure?: Error;
    get(...args: any[]) { if(this.inner) this.inner.get(...args); else queueMicrotask(()=>args.at(-1)(this.failure)); }
    put(...args: any[]) { if(this.inner) this.inner.put(...args); else queueMicrotask(()=>args.at(-1)(this.failure)); }
    close(cb:()=>void) { if(this.inner) this.inner.close(cb); else queueMicrotask(cb); }
    destroy(cb:()=>void) { this.close(cb); }
    constructor(chunkLength: number, options: any) {
      try {
      validateTorrentFiles(options.files, options.length);
      for (const file of options.files) {
        let current = directory;
        for (const segment of file.path.split(path.sep).join("/").split("/")) {
          current = path.join(current, segment);
          try { if(lstatSync(current).isSymbolicLink()) throw Error("Symbolic links are not allowed in torrent destinations."); } catch(e) {if((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;}
        }
      }
      if (options.length + 64*1024*1024 > disk.bavail * disk.bsize) throw Error("Not enough free disk space.");
      this.inner = new FileStore(chunkLength, options);
      } catch(e) {this.failure = e instanceof Error ? e : Error(String(e)); queueMicrotask(()=>options.torrent.destroy(this.failure));}
    }
  }
  let timer: ReturnType<typeof setInterval> | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let saving = false;
  try {
    await new Promise<void>((resolve,reject)=>{
      let settled=false;
      const finish=(error?: Error)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);error?reject(error):resolve();};
      const abort=()=>finish(Error("Interrupted"));
      signal.addEventListener('abort',abort,{once:true});
      if(signal.aborted)return abort();
      client.on('error',(e: string | Error)=>finish(Error(String(e))));
      timeout=setTimeout(()=>finish(Error("No peers supplied torrent metadata within 90 seconds. This release may have no seeders, or your network may block peer connections. Choose another release/source or retry later.")),testOptions?.metadataTimeoutMs ?? 90000);
      // Preserve literal urn:btih:; this engine rejects URLSearchParams-encoded xt values.
      const magnet = safeMagnet(job.package.url).split('&tr=')[0];
      const torrent=client.add(magnet,{announce,path:directory,store:SafeStore,skipVerify:false} as any);
      testOptions?.onTorrent?.(torrent);
      torrent.on('error',(e: string | Error)=>finish(Error(String(e))));
      torrent.on('ready',()=>{clearTimeout(timeout);lastProgress=Date.now();job.total=torrent.length;job.status='downloading';changed();});
      torrent.on('done',()=>{job.total=torrent.length;job.downloaded=torrent.length;job.status='completed';job.installationState='downloaded';job.verified=false;finish();});
      let lastBytes = 0, lastProgress = Date.now(), lastSaved = Date.now();
      timer=setInterval(()=>{
        job.peers = torrent.numPeers;
        job.discovery = torrent.ready ? (torrent.numPeers ? 'Connected to peers' : 'Waiting for peers with available pieces…') : (torrent.numPeers ? 'Connected; requesting torrent metadata…' : 'Searching for peers. Older releases may have no seeders.');
        if (torrent.ready) {
          if(torrent.downloaded > lastBytes) {lastBytes=torrent.downloaded;lastProgress=Date.now();job.lastProgress=new Date(lastProgress).toISOString();}
          if(Date.now()-lastProgress > 120000) return finish(Error('No download progress for two minutes. Peers may not have the remaining pieces. Retry or choose another release/source; partial files are preserved.'));
          job.downloaded=torrent.downloaded;job.total=torrent.length;job.speed=torrent.downloadSpeed;
          job.averageSpeed=job.speed;job.eta=job.speed>0?(job.total-job.downloaded)/job.speed:undefined;
          if(!saving && Date.now()-lastSaved>=15000){saving=true;lastSaved=Date.now();void save().catch(e=>finish(e)).finally(()=>saving=false);}
        }
        changed();
      },1000);
    });
  } finally {
    clearTimeout(timeout);clearInterval(timer);
    await new Promise<void>(resolve=>client.destroy(()=>resolve()));
  }
}
