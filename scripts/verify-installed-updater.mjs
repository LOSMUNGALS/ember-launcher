import {electron} from './authenticated-electron.mjs';
import {mkdtemp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
await mkdir('artifacts',{recursive:true});const root=await mkdtemp(path.join(os.tmpdir(),'ember-installed-update-'));
const env={...process.env,EMBER_DATA_DIR:root};delete env.ELECTRON_RUN_AS_NODE;delete env.PORTABLE_EXECUTABLE_FILE;
const app=await electron.launch({executablePath:path.resolve('release/win-unpacked/Ember.exe'),args:[],env});
try{
 const page=await app.firstWindow();await page.locator('.v2-app').waitFor();await page.getByTitle('Settings',{exact:true}).click();
 const status=await page.evaluate(()=>window.ember2.call('checkLauncherUpdate'));
 assert.equal(status.currentVersion,'1.0.2');assert.equal(status.supported,true);assert.equal(status.phase,'idle',status.error);
 assert.equal(await page.getByRole('button',{name:'Test update (refresh only)',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Check for launcher updates',exact:true}).isEnabled(),true);
 await page.getByRole('heading',{name:'Launcher updates',exact:true}).scrollIntoViewIfNeeded();
 await page.screenshot({path:'artifacts/1.0.2-updater.png'});console.log('PASS: packaged Windows 1.0.2 loads the real updater, completes a GitHub check, enables the check button and removes the test button. No installer executed.');
}finally{await app.close();}
