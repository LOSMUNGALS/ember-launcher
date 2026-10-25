import {_electron} from 'playwright';
import {mkdtemp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
await mkdir('.test-data',{recursive:true});const root=await mkdtemp(path.resolve('.test-data/display-'));
const app=await _electron.launch({args:['.'],env:{...process.env,EMBER_DATA_DIR:root,EMBER_ACCOUNT_URL:'http://127.0.0.1:1'}});
try{const page=await app.firstWindow();await page.locator('.account-card').waitFor();
for(const [width,height,zoom] of [[1280,720,1],[1920,1080,1],[3840,2160,1.6],[800,600,1]]){
 await app.evaluate(({BrowserWindow},v)=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(v.width,v.height);w.webContents.setZoomFactor(v.zoom)}, {width,height,zoom});
 await page.waitForTimeout(300);
 const metrics=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,card:document.querySelector('.account-card').getBoundingClientRect().width,input:document.querySelector('input').getBoundingClientRect().width}));
 assert.equal(metrics.overflow,false,JSON.stringify({width,metrics}));assert.ok(metrics.card>300&&metrics.input>200);await page.screenshot({path:`artifacts/display-${width}.png`,fullPage:true});
}console.log('Login layout passed at 800, 1280, 1920 and simulated 3840 with bounded scaling.');
}finally{await app.close()}
