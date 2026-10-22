import {app,session} from 'electron';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {HostDownloads} from '../desktop/host-downloads';
import {StateStore} from '../desktop/state';
async function main(){
await app.whenReady();
app.on('window-all-closed',()=>{});
const root=await mkdtemp(path.join(os.tmpdir(),'ember-host-test-'));
const store=new StateStore(path.join(root,'state.json'));
const id=randomUUID();
store.data.downloads.push({id,sourceId:'fixture',status:'external',downloaded:0,total:0,speed:0,averageSpeed:0,created:new Date().toISOString(),updated:new Date().toISOString(),destination:root,attempts:0,priority:0,verified:false,package:{id:'fixture',gameId:'fixture',title:'Fixture',sourceName:'Fixture',version:'1',type:'archive',platforms:['windows'],bytes:0,url:'https://example.com/host',sha256:'',filename:'fixture.zip',install:{method:'zip'},authorization:{license:'fixture',distribution:'fixture',url:'https://example.com'},transport:'host'}});
const payload=new Uint8Array(32768).fill(42);
app.on('session-created',ses=>{void ses.protocol.handle('https',req=>req.url.endsWith('/payload')?new Response(payload,{headers:{'content-type':'application/octet-stream','content-disposition':'attachment; filename="fixture.bin"','content-length':String(payload.length)}}):new Response('<a href="https://example.com/payload" download="fixture.bin">Download fixture</a>',{headers:{'content-type':'text/html'}}));});
app.on('browser-window-created',(_event,win)=>win.webContents.once('did-finish-load',()=>{void win.webContents.executeJavaScript('document.querySelector("a").click()');}));
let finished=false;
const manager=new HostDownloads(store,()=>{
 const job=store.data.downloads[0];
 if(process.env.EMBER_TEST_CLOSE_HOST && job.status==='downloading' && !finished){finished=true;void manager.shutdown().then(async()=>{const saved=JSON.parse(await readFile(store.file,'utf8'));assert.equal(saved.downloads[0].status,'external');console.log('PASS: closing an active host transfer persists retryable state without destroyed-object errors.');app.exit(0);}).catch(e=>{console.error(e);app.exit(1)});return;} 
 if(job.status==='completed'&&!finished){finished=true;void (async()=>{
   try{const bytes=await readFile(job.outputPath!);assert.deepEqual(bytes,Buffer.from(payload));assert.ok(job.outputPath!.startsWith(root+path.sep));console.log('PASS: host transfer saved exact payload in chosen destination with real progress.');manager.shutdown();app.exit(0);}catch(e){console.error(e);manager.shutdown();app.exit(1);}
 })();}
});
setTimeout(()=>{console.error('Host transfer timed out');manager.shutdown();app.exit(1)},15000);
await manager.open(store.data.downloads[0]);

}
void main().catch(e=>{console.error(e);app.exit(1)});


