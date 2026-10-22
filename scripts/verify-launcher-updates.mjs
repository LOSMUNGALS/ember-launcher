import {_electron as electron,chromium} from 'playwright';
import {mkdtemp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {startService} from '../server/index.mjs';
await mkdir('.test-data',{recursive:true});await mkdir('artifacts',{recursive:true});
const root=await mkdtemp(path.resolve('.test-data/launcher-update-'));
const service=await startService({directory:path.join(root,'service'),port:0,adminEmail:'admin@example.com'});
const password='Update-fixture-password-2026';await service.accounts.bootstrap(password);
const admin=(await service.accounts.login({identifier:'admin@example.com',password})).token;
const env={...process.env,EMBER_DATA_DIR:path.join(root,'profile'),EMBER_ACCOUNT_URL:service.url};delete env.ELECTRON_RUN_AS_NODE;
const options=process.env.EMBER_TEST_EXECUTABLE?{executablePath:path.resolve(process.env.EMBER_TEST_EXECUTABLE),args:[],env}:{args:['.'],env};
let instance,browser;
async function login(){instance=await electron.launch(options);const page=await instance.firstWindow();await page.getByLabel('Username or email').fill('admin@example.com');await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Log In',exact:true}).click();await page.locator('.v2-app').waitFor();return page;}
const focus=page=>page.evaluate(()=>window.dispatchEvent(new Event('focus')));
try{
 browser=await chromium.launch({channel:'msedge',headless:true});const editor=await browser.newPage();
 await editor.goto(service.url);await editor.getByLabel('Username or email',{exact:true}).fill('admin@example.com');await editor.locator('#password').fill(password);await editor.getByRole('button',{name:'Log In',exact:true}).click();
 await editor.getByRole('heading',{name:'Launcher release editor',exact:true}).waitFor();
 await editor.getByLabel('Release title',{exact:true}).fill('New games, new features, and bugs squashed.');await editor.getByLabel('Release version',{exact:true}).fill('2.0.1');
 const body='# New games\n**New content** and *features*\n- Faster filtering\n- Bugs squashed\n<script>plain text only</script>';
 await editor.getByLabel('Release description',{exact:true}).fill(body);await editor.locator('#release-preview-body strong').filter({hasText:'New content'}).waitFor();await editor.locator('#release-preview-body em').filter({hasText:'features'}).waitFor();assert.equal(await editor.locator('#release-preview-body script').count(),0);
 await editor.getByRole('button',{name:'Save release',exact:true}).click();await editor.getByText('Release draft saved.',{exact:true}).waitFor();assert.equal(service.accounts.release(admin,'2.0.1'),null);
 await editor.getByLabel('Publish these release notes',{exact:true}).check();await editor.getByRole('button',{name:'Save release',exact:true}).click();await editor.getByText('Release notes published.',{exact:false}).waitFor();
 await editor.getByRole('button',{name:'New release',exact:true}).click();await editor.getByRole('button',{name:'Edit release 2.0.1',exact:true}).click();assert.equal(await editor.getByLabel('Release description',{exact:true}).inputValue(),body);
 await editor.getByLabel('Release version',{exact:true}).fill('2.0.2');await editor.getByRole('button',{name:'Save release',exact:true}).click();await editor.getByRole('button',{name:'Edit release 2.0.2',exact:true}).waitFor();assert.equal(service.accounts.release(admin,'2.0.1'),null);
 await editor.getByLabel('Release version',{exact:true}).fill('2.0.1');await editor.getByRole('button',{name:'Save release',exact:true}).click();await editor.getByRole('button',{name:'Edit release 2.0.1',exact:true}).waitFor();
 await editor.screenshot({path:'artifacts/admin-release-editor.png',fullPage:true});
 let page=await login();
 service.accounts.publish(admin,{body:'First announcement'});await focus(page);
 await page.getByRole('status',{name:'Unread announcements',exact:true}).waitFor();
 await page.getByRole('button',{name:'Updates',exact:true}).click();await page.getByText('First announcement',{exact:true}).waitFor();
 await page.getByRole('status',{name:'Unread announcements',exact:true}).waitFor({state:'hidden'});
 await page.getByTitle('Home',{exact:true}).click();await instance.close();instance=undefined;
 page=await login();assert.equal((await page.evaluate(()=>window.ember2.call('announcementStatus'))).unread,false);
 assert.equal(await page.getByRole('status',{name:'Unread announcements',exact:true}).count(),0);
 service.accounts.publish(admin,{body:'Second announcement'});await focus(page);await page.getByRole('status',{name:'Unread announcements',exact:true}).waitFor();
 await page.getByRole('button',{name:'Updates',exact:true}).click();await page.getByText('Second announcement',{exact:true}).waitFor();await page.getByRole('status',{name:'Unread announcements',exact:true}).waitFor({state:'hidden'});
 service.accounts.publish(admin,{body:'Third announcement'});await focus(page);await page.getByRole('status',{name:'Unread announcements',exact:true}).waitFor();
 await page.getByRole('button',{name:'Updates',exact:true}).click();await page.getByText('Third announcement',{exact:true}).waitFor();await page.getByRole('status',{name:'Unread announcements',exact:true}).waitFor({state:'hidden'});
 await page.getByTitle('Home',{exact:true}).click();
 const currentVersion=(await page.evaluate(()=>window.ember2.call('snapshot'))).launcherUpdate.currentVersion;
 await page.getByTitle('Settings',{exact:true}).click();assert.equal(await page.getByRole('button',{name:'Test update (refresh only)',exact:true}).count(),0);await page.evaluate(()=>window.ember2.call('previewLauncherUpdate'));
 await page.getByRole('button',{name:'Update available',exact:true}).click();
 await page.getByRole('dialog',{name:'Ember launcher update'}).getByRole('heading',{name:'Local update test',exact:true}).waitFor();
 assert.equal((await page.evaluate(()=>window.ember2.call('launcherUpdateStatus'))).testOnly,true);
 await page.screenshot({path:'artifacts/local-test-update.png'});
 const reloaded=page.waitForEvent('domcontentloaded');await page.getByRole('dialog').getByRole('button',{name:'Update Ember',exact:true}).click();await reloaded;await page.locator('.v2-app').waitFor();
 const refreshed=await page.evaluate(()=>window.ember2.call('snapshot'));assert.equal(refreshed.launcherUpdate.currentVersion,currentVersion);assert.equal(refreshed.launcherUpdate.release,undefined);assert.equal(refreshed.launcherUpdate.testOnly,false);
 assert.equal(await page.getByRole('button',{name:'Update available',exact:true}).count(),0);
 console.log('PASS: actual local test-update IPC pauses/saves and reloads the renderer, preserves the version/account, and clears the update button without an installer.');
 // UI-only release fixture. No installer is executed; lifecycle/driver ordering is unit-tested.
 await instance.evaluate(({ipcMain,BrowserWindow},release)=>{
  const original=ipcMain._invokeHandlers.get('ember2');let state={currentVersion:'2.0.0',supported:true,phase:'available',release:{version:release.version,title:release.title,notes:release.body}};
  globalThis.updateFixtureInstalls=0;ipcMain.removeHandler('ember2');ipcMain.handle('ember2',async(event,type,p)=>{
   if(type==='installLauncherUpdate'){globalThis.updateFixtureInstalls++;state={currentVersion:'2.0.1',supported:true,phase:'idle'};BrowserWindow.getAllWindows()[0].webContents.send('changed');return;}
   if(type==='launcherUpdateStatus'||type==='checkLauncherUpdate')return state;
   const result=await original(event,type,p);if(type==='snapshot')result.launcherUpdate=state;return result;
  });
 },service.accounts.release(admin,'2.0.1'));
 await page.getByTitle('Library',{exact:true}).click();
 await page.evaluate(()=>window.ember2.call('preferences',{region:'US',concurrency:2,minimumPositive:70,minimumReviews:10,catalogUrl:''}));
 await page.getByRole('button',{name:'Update available',exact:true}).waitFor();
 await page.getByRole('button',{name:'Update available',exact:true}).click();const modal=page.getByRole('dialog',{name:'Ember launcher update'});await modal.waitFor();
 await modal.getByText('2.0.1',{exact:true}).waitFor();assert.equal(await modal.locator('script').count(),0);
 await modal.getByRole('heading',{name:'New games',exact:true}).waitFor();await modal.locator('strong').filter({hasText:'New content'}).waitFor();await modal.locator('em').filter({hasText:'features'}).waitFor();assert.equal(await modal.locator('li').count(),2);
 await page.screenshot({path:'artifacts/launcher-update-dialog.png'});
 await modal.getByRole('button',{name:'Close launcher update',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Update available',exact:true}).count(),1);
 await page.getByRole('button',{name:'Update available',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Update Ember',exact:true}).click();
 await page.getByRole('button',{name:'Update available',exact:true}).waitFor({state:'hidden'});assert.equal(await instance.evaluate(()=>globalThis.updateFixtureInstalls),1);
 console.log('PASS: admin release editing, version rename, draft/publication, safe formatted preview; persistent announcement unread indicators; release modal headings/bold/italic/lists, close without install, explicit install once, and hiding the button on the updated version. This fixture does not execute an installer.');
}finally{await instance?.close();await browser?.close();await service.close();}
