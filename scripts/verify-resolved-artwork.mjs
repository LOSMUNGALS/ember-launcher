import {electron} from './authenticated-electron.mjs';
import {readFile,writeFile,mkdtemp} from 'node:fs/promises';
import path from 'node:path';
const report=JSON.parse(await readFile('artifacts/release-artwork-audit.json','utf8'));
const resolved=JSON.parse(await readFile('artifacts/missing-artwork-resolution.json','utf8'));
const root=await mkdtemp(path.resolve('.test-data/resolved-art-'));
const env={...process.env,EMBER_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['.'],env});
try{
 const page=await app.firstWindow();await page.locator('.v2-app').waitFor();
 const checked=await page.evaluate(async rows=>{
  const results=[];let index=0;
  await Promise.all(Array.from({length:4},async()=>{while(index<rows.length){const row=rows[index++];let loaded;
   for(const src of [row.portrait,row.cover].filter(Boolean)){
    const ok=await new Promise(resolve=>{const img=new Image();const timer=setTimeout(()=>{img.src='';resolve(false);},8000);img.onload=()=>{clearTimeout(timer);resolve(img.naturalWidth>0);};img.onerror=()=>{clearTimeout(timer);resolve(false);};img.src=src;});if(ok){loaded=src;break;}
   }
   results.push({...row,loaded});
  }}));return results;
 },resolved);
 report.afterFix={checked:new Date().toISOString(),recovered:checked.filter(r=>r.loaded).length,loaded:report.loaded+checked.filter(r=>r.loaded).length,remaining:checked.filter(r=>!r.loaded).map(r=>({id:r.id,title:r.title,error:r.error})),results:checked};
 await writeFile('artifacts/release-artwork-audit.json',JSON.stringify(report,null,2));
 console.log(JSON.stringify({...report.afterFix,results:undefined},null,2));
}finally{await app.close();}
