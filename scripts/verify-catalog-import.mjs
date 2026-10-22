import {electron} from "./authenticated-electron.mjs";
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const root=await mkdtemp(path.join(os.tmpdir(),'ember-catalogs-'));
const directory=JSON.parse(await readFile('desktop/source-directory.json','utf8'));
const files=directory.sources.map(s=>path.resolve('data/catalogs',s.file));
const env={...process.env,EMBER_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
const options=process.env.EMBER_TEST_EXECUTABLE ? {executablePath:path.resolve(process.env.EMBER_TEST_EXECUTABLE),args:[],env} : {args:['.'],env};
for(let pass=0;pass<2;pass++){
 const app=await electron.launch(options);
 try {
  const page=await app.firstWindow();await page.locator('.v2-app').waitFor();
  if(!pass){
   await app.evaluate(({dialog},files)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:files});},files);
   await page.evaluate(()=>window.ember2.call('importSourceFile'));
  }
  const sources=await page.evaluate(async()=>{const result=await window.ember2.call('snapshot');return result.state.sources.map(s=>({name:s.name,count:s.packages.length}));});
  assert.deepEqual(sources.map(s=>s.name),directory.sources.map(s=>s.name));
  assert.equal(sources.reduce((n,s)=>n+s.count,0),26115);
  const delta=await page.evaluate(async()=>{
    const full=await window.ember2.call('snapshot');
    const compact=await window.ember2.call('snapshot',{sourcesRevision:full.sourcesRevision});
    return {omitted:compact.state.sources===undefined,full:JSON.stringify(full).length,compact:JSON.stringify(compact).length};
  });
  assert.ok(delta.omitted);assert.ok(delta.compact<delta.full/10);
  console.log('PASS: unchanged catalogs omitted from progress snapshots ('+delta.full+' → '+delta.compact+' bytes).');
  console.log('PASS: '+(pass?'restart preserved':'UI IPC imported')+' all six catalogs and 26,115 options.');
 } finally{await app.close();}
}
