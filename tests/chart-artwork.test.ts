import test from 'node:test';
import assert from 'node:assert/strict';
import {chartSnapshot} from '../desktop/chart-snapshots';
import {matchSteamTitle,lookupTitle} from '../desktop/title-match';
import {CatalogService} from '../desktop/catalog';
import {StateStore} from '../desktop/state';
import {refreshOfficialArtwork,communityCatalog} from '../desktop/community-catalog';
import type {PackageSource} from '../src/v2types';
test('charts retain original ranks while excluding consoles and hardware',()=>{
 for(const kind of ['coming','top'] as const){const rows=chartSnapshot(kind);const count=kind==='coming'?99:96;assert.equal(rows.length,count);assert.equal(new Set(rows.map(r=>r.chartRank)).size,count);assert.equal(rows[0].chartRank,1);assert.equal(rows.at(-1)?.chartRank,100);assert.ok(rows.every(r=>r.productType!=='hardware'));}
 assert.ok(chartSnapshot('top').every(r=>!['Steam Machine','Steam Deck','Steam Controller'].includes(r.title)));
 assert.equal(chartSnapshot('coming')[0].steamAppId,'1422450');
 assert.ok(chartSnapshot('coming').filter(r=>r.portrait).length>=89);
});
test('title matching strips release noise but refuses ambiguous titles and sequels',()=>{
 assert.equal(lookupTitle('A Hat in Time Ultimate Edition.2024.1'),'A Hat in Time');
 assert.equal(lookupTitle('A Little to the Left Build.14590954 MULTi11'),'A Little to the Left');
 const app=(name:string,id:number)=>({name,id,type:'app'});
 assert.equal(matchSteamTitle('A Hat in Time Ultimate Edition',[app('A Hat in Time',10)])?.id,10);
 assert.equal(matchSteamTitle('Portal',[app('Portal 2',20)]),undefined);
 assert.equal(matchSteamTitle('Deadlock',[app('Deadlock',1),app('DeadLock',2)]),undefined);
 assert.equal(matchSteamTitle('God of War Ragnarok',[app('God of War Ragnarök',1593500)])?.id,1593500);
 assert.equal(matchSteamTitle('Abathor + Bonus Soundtrack',[app('Abathor',10)])?.id,10);
 assert.equal(matchSteamTitle('11F + Windows 7 Fix',[app('11F',11)])?.id,11);
 assert.equal(matchSteamTitle('13 Sentinels: Aegis Rim,',[app('13 Sentinels: Aegis Rim',12)])?.id,12);
 assert.equal(matchSteamTitle('Portal + DLC',[app('Portal 2',20)]),undefined);
 assert.equal(matchSteamTitle('A Game About Digging A Hole',[app('A Game About Digging A Hole™',3244220)])?.id,3244220);
 assert.equal(matchSteamTitle('City Game Studio',[app('City Game Studio: Your Game Dev Adventure Begins',726840)])?.id,726840);
});
test('old blank community caches retry and metadata failure retains a verified Steam identity',async()=>{
 const store=new StateStore('unused');store.save=async()=>{};
 store.data.sources=[{enabled:true,id:'test',packages:[{title:'A Bird Story'}]} as PackageSource];
 let searches=0;
 const service=new CatalogService(store,async(url)=>{
  if(url.includes('storesearch')){searches++;return {items:[{type:'app',id:327410,name:'A Bird Story',tiny_image:'https://shared.steamstatic.com/cover.jpg'}]};}
  throw Error('temporary service failure');
 });
 const entry=service.community()[0];store.data.catalog[entry.appId]=entry;
 const result=await service.communityDetail(entry.appId);
 assert.equal(searches,1);assert.equal(result.appId,'327410');assert.ok(result.cover);assert.equal(result.origin,undefined);
});
test('Coming Soon pagination and Top Sellers use supplied snapshots rather than live chart requests',async()=>{
 const store=new StateStore('unused');store.save=async()=>{};
 const service=new CatalogService(store,async()=>{throw Error('offline');});
 const ids:string[]=[];
 for(let page=0;page<5;page++){const result=await service.search('coming','',page);ids.push(...result.games.map(g=>g.appId));assert.equal(result.hasMore,page<4);assert.match(result.source,/snapshot/);}
 assert.equal(ids.length,99);assert.equal(new Set(ids).size,99);
 const rankings=await service.refreshRankings();assert.equal(rankings.ids.length,96);assert.match(rankings.source,/snapshot/);assert.equal(rankings.region,'Global');
});

test('saved community metadata remains readable when its source is removed',async()=>{
 const store=new StateStore('unused');store.save=async()=>{};
 store.data.sources=[{enabled:true,id:'test',packages:[{title:'Saved fixture'}]} as PackageSource];
 const service=new CatalogService(store,async()=>({items:[]}));
 const entry=service.community()[0];store.data.catalog[entry.appId]=entry;
 store.data.sources=[];
 assert.equal((await service.communityDetail(entry.appId)).title,'Saved fixture');
});

test('official non-Steam artwork does not fabricate Steam identity or console compatibility',async()=>{
 const store=new StateStore('unused');store.save=async()=>{};
 store.data.sources=[{enabled:true,id:'test',packages:[{title:'13 Sentinels: Aegis Rim,'},{title:'1nsane'}]} as PackageSource];
 const service=new CatalogService(store,async()=>{throw Error('Should use verified official metadata');});
 const consoleGame=service.community().find(m=>m.title==='13 Sentinels: Aegis Rim')!;
 const result=await service.communityDetail(consoleGame.appId);
 assert.equal(result.cover,'./13-sentinels.jpg');assert.equal(result.steamAppId,undefined);assert.deepEqual(result.platforms,[]);
 const pc=service.community().find(m=>m.title==='1nsane')!;
 store.data.catalog[pc.appId]={...pc,cover:''};store.data.sources=[];
 const saved=await service.communityDetail(pc.appId);
 assert.match(saved.cover,/gog-statics.com/);assert.deepEqual(saved.platforms,['windows']);assert.equal(saved.steamAppId,undefined);
});

test('1.0.1 replaces cached console covers once without changing game identities or other metadata',()=>{
 const source={enabled:true,id:'test',packages:[{title:'Bloodborne'},{title:'God of War III Remastered'},{title:'God of War'}]} as PackageSource;
 const rows=communityCatalog([source]);const catalog=Object.fromEntries(rows.map(m=>[m.appId,{...m,cover:'./old.png',portrait:'./old-portrait.png',banner:'./old.png',description:'Keep my description',updated:'2026-01-01'}]));
 assert.equal(refreshOfficialArtwork(catalog),2);
 for(const [title,file] of [['Bloodborne','./bloodborne.jpg'],['God of War III Remastered','./god-of-war-iii.jpg']]){
  const original=rows.find(m=>m.title===title)!;const m=catalog[original.appId];
  assert.equal(m.cover,file);assert.equal(m.portrait,file);assert.equal(m.banner,file);
  assert.equal(m.appId,original.appId);assert.equal(m.description,'Keep my description');assert.deepEqual(m.platforms,[]);
 }
 const other=rows.find(m=>m.title==='God of War')!;assert.equal(catalog[other.appId].cover,'./old.png');
 assert.equal(refreshOfficialArtwork(catalog),0);
});
