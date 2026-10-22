import {electron} from './authenticated-electron.mjs';
import {readFile,mkdir,mkdtemp,writeFile,copyFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('tsx/cjs');
const {communityCatalog}=require('../desktop/community-catalog.ts');
const {steamCoverSources}=require('../src/steam-covers.ts');
const {chartSnapshot}=require('../desktop/chart-snapshots.ts');
const {refreshSource}=require('../desktop/sources.ts');
const directory=process.argv[2]||path.join(process.env.APPDATA,'ember-launcher');
const state=JSON.parse(await readFile(path.join(directory,'ember2.json'),'utf8'));
const library=JSON.parse(await readFile(path.join(directory,'library.json'),'utf8'));
const entries=new Map(Object.entries(state.catalog));
for(const m of [...chartSnapshot('coming'),...chartSnapshot('top')])if(!entries.has(m.appId))entries.set(m.appId,m);
const inventory=communityCatalog(state.sources);
const unvisited=inventory.filter(m=>!entries.has(m.appId));
const jobs=[...entries].map(([id,m])=>({id,title:m.title,sources:[m.portrait,...steamCoverSources(m.steamAppId||m.appId),m.cover].filter(Boolean)}));
for(const g of library.games)jobs.push({id:g.id,title:g.name,sources:[...steamCoverSources(g.steamId,g.artwork),state.catalog[g.catalogId||g.steamId]?.cover].filter(Boolean)});
await mkdir('artifacts',{recursive:true});await mkdir('.test-data',{recursive:true});
const root=await mkdtemp(path.resolve('.test-data/release-art-'));
await mkdir(path.join(root,'artwork'),{recursive:true});
for(const file of await readdir(path.join(directory,'artwork')).catch(()=>[]))if(/^steam-\d+-(cover|hero|logo)\.(jpg|png|webp)$/.test(file))await copyFile(path.join(directory,'artwork',file),path.join(root,'artwork',file));
const env={...process.env,EMBER_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env});
try{
 const page=await app.firstWindow();await page.locator('.v2-app').waitFor();
 const results=[];
 for(let offset=0;offset<jobs.length;offset+=40){
 const batch=await page.evaluate(async jobs=>{
  const cache=new Map();
  const check=src=>{if(!cache.has(src))cache.set(src,new Promise(resolve=>{const img=new Image();const timer=setTimeout(()=>{img.src='';resolve(false);},8000);img.onload=()=>{clearTimeout(timer);const ok=img.naturalWidth>0&&img.naturalHeight>0;img.removeAttribute('src');resolve(ok);};img.onerror=()=>{clearTimeout(timer);resolve(false);};img.src=src;}));return cache.get(src);};
  const results=[];let index=0;
  await Promise.all(Array.from({length:8},async()=>{while(index<jobs.length){const job=jobs[index++];let loaded;for(const src of job.sources)if(await check(src)){loaded=src;break;}results.push({id:job.id,title:job.title,loaded,attempted:job.sources.length});}}));
  return results;
 },jobs.slice(offset,offset+40));
 results.push(...batch);await writeFile('artifacts/release-artwork-progress.json',JSON.stringify(results));console.log('Artwork checked',results.length,'of',jobs.length);
 }
 const sourceHealth=[];
 for(const s of state.sources){const refreshed=await refreshSource(structuredClone(s));sourceHealth.push({name:s.name,enabled:s.enabled,options:s.packages.length,refreshError:refreshed.error||null,refreshedOptions:refreshed.packages.length,installation:'Not verified against individual external releases',transports:s.packages.reduce((r,p)=>(r[p.transport||'direct']=(r[p.transport||'direct']||0)+1,r),{})});}
 const report={checked:new Date().toISOString(),scope:'Every cached catalog/chart entry and saved/local library entry on this laptop. Unvisited source identities are enumerated separately; they are not falsely counted as verified.',checkedEntries:results.length,loaded:results.filter(r=>r.loaded).length,failed:results.filter(r=>!r.loaded),unvisitedSourceTitles:unvisited.map(m=>({id:m.appId,title:m.title})),sourceHealth,results};
 await writeFile('artifacts/release-artwork-audit.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({checked:report.checkedEntries,loaded:report.loaded,failed:report.failed,unvisited:unvisited.length,sourceHealth},null,2));
}finally{await app.close();}
