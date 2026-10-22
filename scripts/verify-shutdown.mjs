import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root=await mkdtemp(path.join(os.tmpdir(),'ember-shutdown-'));
const id=randomUUID();
const pkg={id:'fixture',gameId:'fixture',title:'Shutdown fixture',sourceName:'Fixture',version:'1',type:'archive',platforms:['windows'],bytes:0,url:'magnet:?xt=urn:btih:'+'a'.repeat(40),sha256:'',filename:'fixture.zip',install:{method:'zip'},authorization:{license:'Fixture',distribution:'Fixture',url:'https://example.com'},transport:'torrent'};
await writeFile(path.join(root,'ember2.json'),JSON.stringify({preferences:{region:'US',concurrency:2,minimumPositive:70,minimumReviews:10,catalogUrl:''},sources:[],catalog:{},ownership:{ids:[]},downloads:[{id,package:pkg,sourceId:'fixture',status:'paused',downloaded:0,total:0,speed:0,averageSpeed:0,created:new Date().toISOString(),updated:new Date().toISOString(),destination:root,attempts:0,priority:0,verified:false}]}));
const env={...process.env,EMBER_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
const options=process.env.EMBER_TEST_EXECUTABLE?{executablePath:path.resolve(process.env.EMBER_TEST_EXECUTABLE),args:[],env}:{args:['.'],env};
let instance=await electron.launch(options);
try {
 let page=await instance.firstWindow();await page.locator('.v2-app').waitFor();
 const nextWindow=instance.waitForEvent('window');
 await instance.evaluate(({app,BrowserWindow})=>{
   const listeners=app.listeners('window-all-closed');app.removeAllListeners('window-all-closed');
   BrowserWindow.getAllWindows()[0].destroy();
   app.emit('second-instance',{},[],process.cwd());
   for(const listener of listeners)app.on('window-all-closed',listener);
 });
 page=await nextWindow;await page.locator('.v2-app').waitFor();
 console.log('PASS: second launch recreates a destroyed main window.');
 await page.evaluate(id=>window.ember2.call('downloadControl',{id,action:'resume'}),id);
 await instance.close();
 const state=JSON.parse(await readFile(path.join(root,'ember2.json'),'utf8'));
 assert.equal(state.downloads[0].status,'paused');
 instance=await electron.launch(options);page=await instance.firstWindow();await page.locator('.v2-app').waitFor();
 const status=await page.evaluate(async()=> (await window.ember2.call('snapshot')).state.downloads[0].status);
 assert.equal(status,'paused');console.log('PASS: closing during peer discovery saves a paused job; next launch opens successfully.');
}finally{await instance.close();}


