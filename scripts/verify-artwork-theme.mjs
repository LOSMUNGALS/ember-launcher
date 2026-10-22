import {electron} from './authenticated-electron.mjs';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
await mkdir('.test-data',{recursive:true});
const root=await mkdtemp(path.resolve('.test-data/artwork-theme-'));
const rows=[['900001','Red cover'],['900002','Blue cover'],['900003','Missing cover'],['900004','Cached cover'],['900005','Bundled cover']];
const catalog=Object.fromEntries(rows.map(([id,title])=>[id,{appId:id,title,portrait:id==='900005'?'./bloodborne.png':id==='900004'?'ember-art://library/steam-900004-cover.png':`https://shared.akamai.steamstatic.com/${id}.svg`,cover:'',banner:'',screenshots:[],description:'Fixture',developers:[],publishers:[],genres:[],tags:[],platforms:['windows'],comingSoon:false,releaseDate:'',content:'allowed',updated:new Date().toISOString()}]));
await writeFile(path.join(root,'library.json'),JSON.stringify({version:1,settings:{wine:'',prefix:'',graphics:'default'},games:rows.map(([id,name])=>({id:'steam-'+id,catalogId:id,name,store:'local',saved:true,installed:false,executable:'',args:[],platform:'native',seconds:0,description:'',added:new Date().toISOString()}))}));
await writeFile(path.join(root,'ember2.json'),JSON.stringify({preferences:{region:'US',concurrency:2,minimumPositive:70,minimumReviews:10,catalogUrl:''},sources:[],downloads:[],catalog,ownership:{ids:[]},visits:0}));
const env={...process.env,EMBER_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env});
try{
 const page=await app.firstWindow();await page.locator('.v2-app').waitFor();
 await mkdir(path.join(root,'artwork'),{recursive:true});
 const png=await app.evaluate(({nativeImage})=>{const bytes=Buffer.alloc(32*32*4);for(let i=0;i<bytes.length;i+=4){bytes[i+1]=255;bytes[i+3]=255;}return nativeImage.createFromBitmap(bytes,{width:32,height:32}).toPNG().toString('base64');});
 await writeFile(path.join(root,'artwork','steam-900004-cover.png'),Buffer.from(png,'base64'));
 await page.route('https://shared.akamai.steamstatic.com/90000*.svg',async route=>{
  if(route.request().url().includes('900003'))return route.abort();
  const color=route.request().url().includes('900001')?'#ff0000':'#0000ff';
  await route.fulfill({contentType:'image/svg+xml',headers:{'access-control-allow-origin':'*'},body:`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="${color}"/></svg>`});
 });
 await app.evaluate(({ipcMain},catalog)=>{const original=ipcMain._invokeHandlers.get('ember2');ipcMain.removeHandler('ember2');ipcMain.handle('ember2',(event,type,p)=>type==='detail'&&catalog[p.id]?catalog[p.id]:original(event,type,p));},catalog);
 await page.reload();await page.locator('.v2-app').waitFor();
 for(const [title,color] of [['Red cover','#640000'],['Blue cover','#000064'],['Missing cover','#273b40'],['Cached cover','#006400'],['Bundled cover','sampled'],['Red cover','#640000']]){
  await page.locator('nav').getByTitle('Library',{exact:true}).click();await page.locator('.card-open').filter({hasText:title}).click();
  await page.getByRole('heading',{name:title,exact:true}).waitFor();
  console.log('Checking',title);await page.waitForFunction(color=>color==='sampled'?document.querySelector('.v2-app').style.getPropertyValue('--theme')!=='#273b40':document.querySelector('.v2-app').style.getPropertyValue('--theme')===color,color);
  if(color!=='sampled')assert.equal(await page.locator('.v2-app').evaluate(el=>el.style.getPropertyValue('--theme')),color);
 }
 console.log('PASS: each detail page samples its own cover hue; switching games and returning uses the correct color; missing artwork uses the neutral theme.');
}finally{await app.close();}
