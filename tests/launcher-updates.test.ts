import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {LauncherUpdates} from '../desktop/launcher-updates';
import {AnnouncementRead} from '../desktop/announcement-read';

class Driver extends EventEmitter {
 autoDownload=true;autoInstallOnAppQuit=true;autoRunAppAfterInstall=false;allowPrerelease=true;allowDowngrade=true;disableWebInstaller=false;
 checks=0;downloads=0;calls:string[]=[];failure=false;
 async checkForUpdates(){this.checks++;this.emit('update-available',{version:'2.0.1',releaseName:'New games, new features, and bugs squashed.',releaseNotes:'<p>Faster filters</p><script>bad()</script>'});}
 async downloadUpdate(){this.downloads++;this.calls.push('download');if(this.failure)throw Error('Checksum verification failed');this.emit('download-progress',{percent:51});this.emit('update-downloaded',{});return ['verified-installer.exe'];}
 quitAndInstall(silent:boolean,reopen:boolean){assert.equal(silent,true);assert.equal(reopen,true);this.calls.push('install');}
}
test('launcher updates require explicit consent and await durable pause before replacing the app',async()=>{
 const driver=new Driver();let finishPause:()=>void=()=>{};
 const manager=new LauncherUpdates(driver,'2.0.0',()=>{},{prepare:()=>new Promise<void>(resolve=>{finishPause=()=>{driver.calls.push('paused');resolve();};}),finish:async()=>{driver.calls.push('flushed');},recover:()=>{driver.calls.push('recover');}});
 assert.equal(driver.autoDownload,false);assert.equal(driver.autoInstallOnAppQuit,false);assert.equal(driver.allowDowngrade,false);assert.equal(driver.allowPrerelease,false);assert.equal(driver.disableWebInstaller,true);
 await Promise.all([manager.check(),manager.check()]);assert.equal(driver.checks,1);assert.equal(driver.downloads,0);
 assert.equal(manager.status().release?.version,'2.0.1');assert.doesNotMatch(manager.status().release!.notes,/script|bad\(\)/);
 manager.describe({version:'9.0.0',title:'Wrong release',body:'Do not show'});assert.notEqual(manager.status().release?.title,'Wrong release');
 manager.describe({version:'2.0.1',title:'Edited by administrator',body:'# Heading\n**Bold** and *italic*'});assert.equal(manager.status().release?.title,'Edited by administrator');assert.match(manager.status().release!.notes,/\*\*Bold\*\*/);
 manager.describe(null,'9.0.0');assert.equal(manager.status().release?.title,'Edited by administrator');
 manager.describe(null,'2.0.1');assert.equal(manager.status().release?.title,'New games, new features, and bugs squashed.');
 const install=manager.install(),duplicate=manager.install();assert.equal(install,duplicate);assert.equal(driver.downloads,0);finishPause();await install;
 assert.deepEqual(driver.calls,['paused','download','flushed','install']);assert.equal(manager.status().phase,'installing');
});
test('a failed update preserves the old installation and can be retried; source builds cannot self-replace',async()=>{
 const driver=new Driver();driver.failure=true;
 const manager=new LauncherUpdates(driver,'2.0.0',()=>{},{prepare:async()=>{},finish:async()=>{driver.calls.push('flushed');},recover:()=>{driver.calls.push('recover');}});
 await manager.check();await assert.rejects(manager.install(),/Checksum/);
 assert.deepEqual(driver.calls,['download','recover']);assert.equal(manager.status().phase,'error');assert.ok(manager.status().release);
 driver.failure=false;await manager.install();assert.deepEqual(driver.calls,['download','recover','download','flushed','install']);
 const source=new LauncherUpdates(undefined,'2.0.0',()=>{},{prepare:async()=>{throw Error('must not run');},finish:async()=>{},recover:()=>{}},'Use the installed version.');
 assert.equal((await source.check()).supported,false);await assert.rejects(source.install(),/installed version/);
});
test('no update clears the available button and a running game prevents the download',async()=>{
 const driver=new Driver(),manager=new LauncherUpdates(driver,'2.0.0',()=>{},{prepare:async()=>{throw Error('Close running games');},finish:async()=>{},recover:()=>{}});
 await manager.check();await assert.rejects(manager.install(),/running games/);assert.equal(driver.downloads,0);
 driver.emit('update-not-available',{});assert.equal(manager.status().release,undefined);assert.equal(manager.status().phase,'idle');
});

test('local test update refreshes once without downloading, installing or changing the version',async()=>{
 const driver=new Driver(),calls:string[]=[];
 const manager=new LauncherUpdates(driver,'2.0.0',()=>{},{prepare:async()=>{calls.push('paused');},finish:async()=>{throw Error('real installer handoff must not run');},recover:()=>{calls.push('recover');},testRefresh:async()=>{calls.push('refresh');}});
 const testState=manager.previewTest();assert.equal(testState.testOnly,true);assert.equal(testState.release?.version,'2.0.0');
 await manager.check();assert.equal(driver.checks,0);manager.describe({version:'2.0.0',title:'Remote notes',body:'Wrong'});assert.notEqual(manager.status().release?.title,'Remote notes');
 const first=manager.install(),second=manager.install();assert.equal(first,second);await first;
 assert.deepEqual(calls,['paused','refresh']);assert.equal(driver.downloads,0);assert.deepEqual(driver.calls,[]);
 assert.equal(manager.status().currentVersion,'2.0.0');assert.equal(manager.status().release,undefined);assert.equal(manager.status().testOnly,false);
});

test('source build test refresh works without an updater driver and refuses to replace a real release',async()=>{
 let refreshes=0;
 const source=new LauncherUpdates(undefined,'2.0.0',()=>{},{prepare:async()=>{},finish:async()=>{throw Error('must not install');},recover:()=>{},testRefresh:async()=>{refreshes++;}},'Source build');
 source.previewTest();await source.install();assert.equal(refreshes,1);assert.equal(source.status().supported,false);assert.equal(source.status().phase,'unsupported');
 const driver=new Driver(),real=new LauncherUpdates(driver,'2.0.0',()=>{},{prepare:async()=>{},finish:async()=>{},recover:()=>{},testRefresh:async()=>{}});
 await real.check();assert.throws(()=>real.previewTest(),/current launcher update/);
});
test('announcement read markers persist per service/account and cannot regress on late responses',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-unread-')),file=path.join(root,'read.json');
 const reader=new AnnouncementRead(file);await reader.load();assert.equal(reader.status('service:alice',1).unread,true);
 await Promise.all([reader.mark('service:alice',10),reader.mark('service:alice',3)]);
 assert.equal(reader.status('service:alice',10).unread,false);assert.equal(reader.status('service:alice',11).unread,true);
 assert.equal(reader.status('service:bob',10).unread,true);assert.equal(reader.status('other-service:alice',10).unread,true);
 const restarted=new AnnouncementRead(file);await restarted.load();assert.equal(restarted.status('service:alice',10).unread,false);
 await assert.rejects(reader.mark('service:alice',NaN),/Invalid/);assert.match(await readFile(file,'utf8'),/10/);
});
