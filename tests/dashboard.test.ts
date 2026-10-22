import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {communityCatalog} from '../desktop/community-catalog';
import {communityKey} from '../src/community-title';
import {detectedExecutables,runnableName} from '../desktop/detect-install';
import {steamPortrait} from '../desktop/store-assets';
import {parseCatalog} from '../desktop/catalog';
import type {PackageSource} from '../src/v2types';
test('community releases deduplicate without merging sequels and retain official console links',()=>{
 const source={enabled:true,packages:['Enshrouded v1.0 (Build 123)','Enshrouded: Deluxe Edition – v1.0','Bloodborne [Repack]','God of War III Remastered [Repack]','Portal','Portal 2'].map(title=>({title}))} as PackageSource;
 const games=communityCatalog([source]);assert.equal(games.length,5);
 assert.match(games.find(g=>g.title==='Bloodborne')!.purchaseUrl!,/playstation.com/);
 assert.equal(games.find(g=>g.title==='God of War III Remastered')!.platforms.length,0);
 assert.notEqual(communityKey('Portal'),communityKey('Portal 2'));
 assert.equal(communityCatalog([{...source,enabled:false}]).length,0);
});
test('hashed Steam portraits use exact app identity and reject path injection',()=>{
 const raw=(file:string)=>({response:{store_items:[{appid:10,success:1,assets:{asset_url_format:'steam/apps/10/${FILENAME}?t=123',library_capsule:file}}]}});
 assert.equal(steamPortrait('10',raw('abcd/library_capsule.jpg')),'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/10/abcd/library_capsule.jpg?t=123');
 assert.equal(steamPortrait('20',raw('abcd/library_capsule.jpg')),undefined);
 assert.equal(steamPortrait('10',raw('../other.jpg')),undefined);
});
test('install detection excludes installers and selects the matching game executable',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-detection-'));
 try{
  await mkdir(path.join(root,'Game','Binaries'),{recursive:true});
  for(const name of ['setup.exe','unins000.exe','UnityCrashHandler64.exe','Helper.exe']){
   assert.equal(runnableName(name),false);await writeFile(path.join(root,name),'fixture');
  }
  const game=path.join(root,'Game','Binaries','Portal-Win64-Shipping.exe');await writeFile(game,'fixture');
  assert.deepEqual(await detectedExecutables([root],'Portal'),[game]);
 }finally{await rm(root,{recursive:true,force:true});}
});
test('modern Steam trailers and free status survive catalog parsing',()=>{
 const url='https://video.akamai.steamstatic.com/store_trailers/10/hls.m3u8';
 const game=parseCatalog('10',{'10':{success:true,data:{type:'game',steam_appid:10,name:'Test',is_free:true,movies:[{hls_h264:url}],content_descriptors:{ids:[]}}}},null);
 assert.equal(game.isFree,true);assert.deepEqual(game.trailers,[url]);
});
