import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root=await mkdtemp(path.join(os.tmpdir(),'ember-background-'));
const id=randomUUID(),folder=path.join(root,'Ember-download-'+id);
await mkdir(folder);
await copyFile(path.join(process.env.SystemRoot,'System32','ping.exe'),path.join(folder,'Detection fixture.exe'));
const pkg={id:'fixture',gameId:'fixture',title:'Detection fixture',steamAppId:'feed-fixture',sourceName:'Fixture',version:'1',type:'archive',platforms:['windows'],bytes:0,url:'magnet:?xt=urn:btih:'+'a'.repeat(40),sha256:'',filename:'fixture.zip',install:{method:'zip'},authorization:{license:'Fixture',distribution:'Fixture',url:'https://example.com'},transport:'torrent'};
await writeFile(path.join(root,'ember2.json'),JSON.stringify({preferences:{region:'US',concurrency:2,minimumPositive:70,minimumReviews:10,catalogUrl:''},sources:[],catalog:{},ownership:{ids:[]},downloads:[{id,package:pkg,sourceId:'fixture',status:'completed',downloaded:0,total:0,speed:0,averageSpeed:0,created:new Date().toISOString(),updated:new Date().toISOString(),destination:root,attempts:0,priority:0,verified:false}]}));
const env={...process.env,EMBER_DATA_DIR:root,EMBER_ENABLE_TRAY:'1'};delete env.ELECTRON_RUN_AS_NODE;
const options=process.env.EMBER_TEST_EXECUTABLE?{executablePath:path.resolve(process.env.EMBER_TEST_EXECUTABLE),args:[],env}:{args:['.'],env};
const app=await electron.launch(options);
try{
 const page=await app.firstWindow();await page.locator('.v2-app').waitFor();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
 await app.evaluate(({app})=>app.emit('second-instance',{},[],process.cwd()));
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),true);
 await page.evaluate(id=>window.ember2.call('detectInstall',{id}),id);
 const snap=await page.evaluate(()=>window.ember2.call('snapshot'));
 const job=snap.state.downloads.find(j=>j.id===id),game=snap.games.find(g=>g.id===job.installedGameId);
 assert.equal(game.catalogId,'feed-fixture');assert.equal(game.installed,true);
 await page.locator('nav').getByTitle('Library',{exact:true}).click();
 await page.locator('.card-open').filter({hasText:'Detection fixture'}).click();
 await page.getByRole('button',{name:'▶ Play',exact:true}).waitFor();
 console.log('PASS: close hides to tray, reopen restores window, detected installation registers and shows Play.');
 await app.evaluate(({ipcMain})=>{
  const original=ipcMain._invokeHandlers.get('ember2');
  const games=Array.from({length:3},(_,i)=>({appId:String(900001+i),title:'Paging fixture '+i,cover:'',banner:'',screenshots:[],description:'Fixture',developers:[],publishers:[],genres:['Action'],tags:[],platforms:['windows'],comingSoon:true,releaseDate:'',content:'allowed',updated:new Date().toISOString(),isFree:true}));
  ipcMain.removeHandler('ember2');
  ipcMain.handle('ember2',async(event,type,p={})=>{
   if(type==='catalog')return {games:[games[p.page||0]].filter(Boolean),hasMore:(p.page||0)<2,source:'Paging fixture'};
   if(type==='detail'&&games.some(g=>g.appId===p.id))return games.find(g=>g.appId===p.id);
   const result=await original(event,type,p);
   if(type==='snapshot')for(const game of games)result.state.catalog[game.appId]=game;
   return result;
  });
 });
 for(const name of ['All Games','Coming Soon']){
  await page.locator('nav').getByTitle(name,{exact:true}).click();
  await page.waitForFunction(()=>document.querySelectorAll('.v2-card').length===3);
  assert.equal(await page.getByRole('button',{name:'Load next page'}).count(),0);
  assert.equal(await page.locator('.infinite-loader').count(),0);
 }
 await page.locator('.card-open').first().click();
 await page.getByRole('button',{name:'View on Steam ↗',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Download',exact:true}).count(),0);
 await page.locator('.tags').getByRole('button',{name:'Action',exact:true}).click();
 await page.getByRole('heading',{name:'All Games',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Genre',{exact:true}).inputValue(),'Action');
 console.log('PASS: All Games and Coming Soon auto-page to completion; free games hide Download; genre chips navigate with the filter.');
}finally{await app.close();}
