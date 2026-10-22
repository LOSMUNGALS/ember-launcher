import {electron} from './authenticated-electron.mjs';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);require('tsx/cjs');
const {parseSourceFeed}=require('../desktop/sources.ts');
const {communityCatalog}=require('../desktop/community-catalog.ts');
await mkdir('.test-data',{recursive:true});await mkdir('artifacts',{recursive:true});
const root=await mkdtemp(path.resolve('.test-data/community-downloads-'));
const source={id:'fixture',url:'https://example.com/catalog.json',enabled:true,...parseSourceFeed({name:'Safe source fixture',downloads:[
 {title:'Bloodborne: GOTY Free Download (Recompiled)',uris:['https://example.com/bloodborne-fixture']},
 {title:'God of War III Remastered Free Download (Recompiled)',uris:['https://example.com/gow-fixture']},
]})};
const catalog=communityCatalog([source]);
await writeFile(path.join(root,'library.json'),JSON.stringify({version:1,settings:{wine:'',prefix:'',graphics:'default'},games:catalog.map(m=>({id:'steam-'+m.appId,catalogId:m.appId,name:m.title,executable:'',args:[],store:'local',platform:'native',seconds:0,description:'',added:new Date().toISOString(),installed:false,saved:true,owned:true}))}));
await writeFile(path.join(root,'ember2.json'),JSON.stringify({preferences:{region:'US',concurrency:2,minimumPositive:70,minimumReviews:10,catalogUrl:''},sources:[source],downloads:[],catalog:Object.fromEntries(catalog.map(m=>[m.appId,m])),ownership:{ids:[]},visits:0}));
const env={...process.env,EMBER_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env});
try{
 const page=await app.firstWindow();await page.locator('.v2-app').waitFor();
 await app.evaluate(({dialog})=>{globalThis.sourceFixtureFolderPrompts=0;dialog.showOpenDialog=async()=>{globalThis.sourceFixtureFolderPrompts++;return {canceled:true,filePaths:[]};};});
 for(const [title,release] of [['Bloodborne','Bloodborne: GOTY Free Download (Recompiled)'],['God of War III Remastered','God of War III Remastered Free Download (Recompiled)']]){
  await page.getByTitle('Library',{exact:true}).click();await page.locator('.card-open').filter({hasText:title}).click();
  await page.getByRole('heading',{name:title,exact:true}).waitFor();
  assert.equal(await page.locator('.actions').getByRole('button',{name:'Install in Steam',exact:true}).count(),0);
  await page.locator('.actions').getByRole('button',{name:'Download',exact:true}).click();
  const picker=page.getByRole('dialog',{name:'Choose Download Source'});await picker.waitFor();await picker.locator('.download-option').filter({hasText:release}).waitFor();
  await picker.locator('.download-option').filter({hasText:release}).click();
  await page.waitForTimeout(150);assert.equal(await picker.getByRole('alert').count(),0);
  await picker.getByRole('button',{name:'Close download sources',exact:true}).click();
  await page.screenshot({path:'artifacts/'+(title==='Bloodborne'?'bloodborne':'god-of-war-iii')+'-download-action.png'});
 }
 assert.equal(await app.evaluate(()=>globalThis.sourceFixtureFolderPrompts),2);
 assert.equal((await page.evaluate(()=>window.ember2.call('snapshot'))).state.downloads.length,0);
 console.log('PASS: both saved console-origin pages show Download and their matching source; neither offers Steam installation; real backend matching reaches the canceled folder dialog. No game files or real host pages were downloaded.');
}finally{await app.close();}


