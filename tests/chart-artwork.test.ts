import test from 'node:test';
import assert from 'node:assert/strict';
import {chartSnapshot} from '../desktop/chart-snapshots';
import {matchSteamTitle,lookupTitle} from '../desktop/title-match';
import {CatalogService} from '../desktop/catalog';
import {StateStore} from '../desktop/state';
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
