import {electron} from "./authenticated-electron.mjs";
import {mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const root=await mkdtemp(path.join(os.tmpdir(),'ember-live-art-'));
const entries=[['327410','A Bird Story'],['253230','A Hat in Time'],['1969080','A Building Full of Cats']];
await writeFile(path.join(root,'library.json'),JSON.stringify({version:1,games:entries.map(([id,name])=>({id:'steam-'+id,steamId:id,name,executable:'',args:[],store:'steam',platform:'native',seconds:0,description:'',added:new Date().toISOString(),installed:false,owned:true})),settings:{wine:'',prefix:'',graphics:'default'}}));
await writeFile(path.join(root,'ember2.json'),JSON.stringify({preferences:{region:'US',concurrency:2,minimumPositive:0,minimumReviews:10,catalogUrl:''},sources:[{id:'art-fixture',name:'Artwork regression',description:'',url:'https://example.com',enabled:true,localSnapshot:true,packages:entries.map(([id,title])=>({id,gameId:id,title}))}],catalog:{},ownership:{ids:entries.map(e=>e[0])},downloads:[]}));
const env={...process.env,EMBER_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch(process.env.EMBER_TEST_EXECUTABLE?{executablePath:path.resolve(process.env.EMBER_TEST_EXECUTABLE),args:[],env}:{args:['.'],env});
try{
 const page=await app.firstWindow();await page.locator('.v2-app').waitFor();await page.setViewportSize({width:1500,height:1000});
 for(const tab of ['All Games','Steam Library','Library','Coming Soon','Top Sellers','Home']){
  await page.locator('nav').getByTitle(tab,{exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.card-image img').length>=3,{},{timeout:90000});
  if(['Coming Soon','Top Sellers'].includes(tab)){
   while(await page.locator('.v2-card').count()<(tab==='Top Sellers'?96:99)){const before=await page.locator('.v2-card').count();await page.locator('.infinite-loader').scrollIntoViewIfNeeded();await page.waitForFunction(n=>document.querySelectorAll('.v2-card').length>n,before,{timeout:90000});}
  }
  await page.locator('.card-image img').evaluateAll(imgs=>imgs.forEach(img=>img.loading='eager'));
  await page.waitForFunction(()=>(()=>{const imgs=Array.from(document.querySelectorAll('.card-image img'));imgs.forEach(img=>img.loading='eager');return imgs.length===document.querySelectorAll('.card-image').length&&imgs.every(img=>img.complete&&img.naturalWidth>0);})(),{},{timeout:60000});
  const images=await page.locator('.card-image img').evaluateAll(imgs=>imgs.slice(0,3).map(img=>({src:img.currentSrc,width:img.naturalWidth})));
  assert.equal(images.length,3);console.log('PASS:',tab,await page.locator('.card-image img').count(),'loaded images',JSON.stringify(images));
  await page.evaluate(()=>window.scrollTo(0,0));
  await page.screenshot({path:'artifacts/alpha14-'+tab.toLowerCase().replaceAll(' ','-')+'.png'});
 }
 const snap=await page.evaluate(()=>window.ember2.call('snapshot'));
 assert.equal(snap.state.rankings.ids.length,96);assert.match(snap.state.rankings.source,/snapshot/);
}finally{await app.close();}
