import {electron} from './authenticated-electron.mjs';
import {mkdir,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
await mkdir('.test-data',{recursive:true});await mkdir('artifacts',{recursive:true});
const root=await mkdtemp(path.resolve('.test-data/filters-'));
const env={...process.env,EMBER_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env});
try{
 const page=await app.firstWindow();await page.locator('.v2-app').waitFor();
 await app.evaluate(({ipcMain})=>{
  const original=ipcMain._invokeHandlers.get('ember2');
  const game=(id,genre)=>({appId:String(id),title:genre+' fixture '+id,cover:'',banner:'',screenshots:[],description:'Fixture',developers:[],publishers:[],genres:[genre],tags:[],platforms:['windows'],comingSoon:false,releaseDate:'2025',releaseTimestamp:Date.UTC(2025,6,1),reviews:{total:2000,positive:1900,summary:'Positive'},content:'allowed',updated:new Date().toISOString()});
  const loaded=Array.from({length:24},(_,i)=>game(900001+i,'Action'));
  const cached=game(900100,'Strategy'),more=game(900101,'Strategy');
  globalThis.filterCatalogCalls=0;ipcMain.removeHandler('ember2');
  ipcMain.handle('ember2',async(event,type,p={})=>{
   if(type==='catalog'){globalThis.filterCatalogCalls++;return {games:p.page?[more]:loaded,hasMore:!p.page,source:'Isolated filtering fixture'};}
   const result=await original(event,type,p);
   if(type==='snapshot')for(const m of [...loaded,cached])result.state.catalog[m.appId]=m;
   return result;
  });
 });
 await page.locator('nav').getByTitle('All Games',{exact:true}).click();
 await page.waitForFunction(()=>document.querySelectorAll('.v2-card').length===24);
 assert.equal(await app.evaluate(()=>globalThis.filterCatalogCalls),1);
 await page.getByLabel('Genre',{exact:true}).selectOption('Strategy');
 await page.getByText('Strategy fixture 900100',{exact:true}).waitFor({timeout:1500});
 await page.getByRole('button',{name:'Load more games',exact:true}).waitFor();
 assert.equal(await page.locator('.infinite-loader').count(),0);
 await page.waitForTimeout(500);assert.equal(await app.evaluate(()=>globalThis.filterCatalogCalls),1);
 for(const [label,value] of [['Platform','windows'],['Minimum reviews','1000'],['Release year','2025']]){
  await page.getByLabel(label,{exact:true}).selectOption(value);
  assert.equal(await page.locator('.v2-card').count(),1);
 }
 await page.screenshot({path:'artifacts/fast-game-filters.png'});
 await page.getByRole('button',{name:'Load more games',exact:true}).click();
 await page.getByText('Strategy fixture 900101',{exact:true}).waitFor();
 assert.equal(await app.evaluate(()=>globalThis.filterCatalogCalls),2);
 assert.equal(await page.locator('.v2-card').count(),2);
 console.log('PASS: genre immediately finds off-page cached games; platform/review/year filters remain responsive; filters make no catalog requests or automatic page scans; explicit Load more retains discovery pagination.');
}finally{await app.close();}
