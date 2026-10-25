import test from 'node:test';
import assert from 'node:assert/strict';
import { CatalogService } from '../desktop/catalog';
import { StateStore } from '../desktop/state';
import { catalogCandidates } from '../src/catalog-view';
import type { CatalogGame, PackageSource } from '../src/v2types';

test('community pages save once and repeat searches perform no network or disk writes',async()=>{
 const store=new StateStore('unused');let saves=0,requests=0;
 store.save=async()=>{saves++;};
 store.data.sources=[{id:'fixture',enabled:true,packages:Array.from({length:24},(_,i)=>({title:'Fixture title '+(100+i)}))} as PackageSource];
 const service=new CatalogService(store,async url=>{
  requests++;const u=new URL(url);
  if(u.pathname.includes('storesearch')){const name=u.searchParams.get('term')!;return {items:[{name,id:Number(name.match(/\d+$/)![0]),type:'app'}]};}
  if(u.pathname.includes('appdetails')){const id=u.searchParams.get('appids')!;return {[id]:{success:true,data:{steam_appid:Number(id),type:'game',name:'Fixture title '+id,content_descriptors:{ids:[]},platforms:{windows:true}}}};}
  return {};
 });
 const first=await service.search('all');assert.equal(first.games.length,24);assert.equal(saves,1);assert.ok(requests>24);
 const firstRequests=requests;
 assert.deepEqual((await service.search('all')).games,first.games);assert.equal(saves,1);assert.equal(requests,firstRequests);
 await service.search('all','Fixture title 100');assert.equal(saves,1);assert.equal(requests,firstRequests);
});

test('unmatched metadata is retried once per short cache window, including overlapping searches',async()=>{
 const store=new StateStore('unused');store.save=async()=>{};
 store.data.sources=[{id:'fixture',enabled:true,packages:[{title:'Unmatched fixture'}]} as PackageSource];
 let requests=0;const service=new CatalogService(store,async()=>{requests++;return {items:[]};});
 const id=service.community()[0].appId;
 await Promise.all([service.communityDetail(id),service.communityDetail(id)]);
 await service.communityDetail(id);assert.equal(requests,1);
 store.data.sources[0].updated=new Date().toISOString();await service.communityDetail(id);assert.equal(requests,2);
});

test('filtered discovery includes off-page cached metadata and deduplicates feed/chart identities',()=>{
 const game=(appId:string,extra:Partial<CatalogGame>={}):CatalogGame=>({appId,title:appId,cover:'',banner:'',screenshots:[],description:'',developers:[],publishers:[],genres:['Strategy'],tags:[],platforms:['windows'],comingSoon:false,releaseDate:'',content:'allowed',updated:'',...extra});
 const loaded=game('10'),cached=game('20'),chart=game('chart-20',{steamAppId:'20',discoveryList:'coming',comingSoon:true});
 const catalog={'10':loaded,'20':cached,'feed-20':cached,'chart-20':chart,hardware:game('hardware',{productType:'hardware'})};
 assert.deepEqual(catalogCandidates([loaded],catalog,'all',false),[loaded]);
 const filtered=catalogCandidates([loaded],catalog,'all',true);assert.equal(filtered.length,2);assert.ok(filtered.some(g=>(g.steamAppId||g.appId)==='20'));
 assert.deepEqual(catalogCandidates([],catalog,'coming',true),[]);
 assert.deepEqual(catalogCandidates([chart],catalog,'coming',true),[chart]);
});
