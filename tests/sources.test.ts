import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {parseSourceFeed,safeMagnet,defaultSources,bundledSources,importSourceJson,migrateSources,sourceKey} from '../desktop/sources';
import {packageMatches,downloadOptions} from '../src/package-matching';
import {runTorrent,torrentDirectory,validateTorrentFiles} from '../desktop/torrents';
import type {DownloadJob} from '../src/v2types';
const magnet='magnet:?xt=urn:btih:'+'a'.repeat(40);

test('dotted release versions match their base game without swallowing sequels',()=>{
 const source={id:'versions',url:'https://example.com/catalog.json',enabled:true,...parseSourceFeed({name:'Versions',downloads:[
  {title:'Funnel Runners 0.34.28',uris:[magnet]},
  {title:'Ore Factory Squad 1.0.4',uris:[magnet]},
  {title:'Ore Factory Squad 1.0.2',uris:[magnet]},
  {title:'A Game About Chopping Trees 1.0.0.2',uris:[magnet]},
 ]})};
 assert.equal(downloadOptions([source],undefined,'Funnel Runners','win32').length,1);
 assert.equal(downloadOptions([source],undefined,'Ore Factory Squad','win32').length,2);
 assert.equal(downloadOptions([source],undefined,'A Game About Chopping Trees','win32').length,1);
 assert.equal(packageMatches({...source.packages[0],title:'Portal 2 1.0.4'},undefined,'Portal'),false);
 assert.equal(packageMatches({...source.packages[0],title:'Portal 2 1.0.4'},undefined,'Portal 2'),true);
 assert.equal(packageMatches({...source.packages[0],steamAppId:'620'},'400','Funnel Runners'),false);
});
test('release matching accepts patch and hotfix suffixes without matching sequels',()=>{
 const pkg=parseSourceFeed({name:'Fixture',downloads:[{title:'Enshrouded (Patch #13 - Hotfix #35 v0.9)',uris:[magnet]}]}).packages[0];
 assert.equal(packageMatches(pkg,undefined,'Enshrouded'),true);
 assert.equal(packageMatches({...pkg,title:'Enshrouded 2'},undefined,'Enshrouded'),false);
 assert.equal(packageMatches({...pkg,title:'River God: Enshrouded Current'},undefined,'Enshrouded'),false);
});

test('console-origin download options match source editions and retain enabled/platform boundaries',()=>{
 const source={id:'fixture',url:'https://example.com/catalog.json',enabled:true,...parseSourceFeed({name:'Fixture',downloads:[
  {title:'Bloodborne: GOTY Free Download (Recompiled)',uris:['https://example.com/bloodborne']},
  {title:'Bloodborne: Game of the Year Edition, v1.09 + All DLCs + Online (Recompiled for PC v1.9.6)',uris:['https://example.com/bloodborne-edition']},
  {title:'God of War III Remastered Free Download (Recompiled)',uris:['https://example.com/gow']},
  {title:'God of War 3 Remastered [Repack]',uris:['https://example.com/gow-alias']},
  {title:'God of War II',uris:['https://example.com/sequel']},
 ]})};
 assert.equal(downloadOptions([source],undefined,'Bloodborne','win32').length,2);
 assert.equal(downloadOptions([source],undefined,'God of War III Remastered','win32').length,2);
 assert.equal(downloadOptions([{...source,enabled:false}],undefined,'Bloodborne','win32').length,0);
 assert.equal(downloadOptions([source],undefined,'Bloodborne','darwin').length,0);
 assert.equal(packageMatches(source.packages[4],undefined,'God of War III Remastered'),false);
});
test('community feeds import magnets and hosts without inventing integrity or platform claims',()=>{
 const source=parseSourceFeed({name:'Fixture',downloads:[{title:'Portal 2 v1.2',fileSize:'2 GB',uris:[magnet,'https://example.com/file','javascript:bad']} ]});
 assert.equal(source.packages.length,2);assert.equal(source.packages[0].transport,'torrent');assert.equal(source.packages[1].transport,'host');assert.equal(source.packages[0].sha256,'');
 assert.deepEqual(source.packages[0].platforms,['windows']);assert.equal(packageMatches(source.packages[0],'620','Portal 2'),true);assert.equal(packageMatches(source.packages[0],'400','Portal'),false);
});
test('FitGirl archive adapter and source defaults use distinct origins',()=>{
 assert.equal(parseSourceFeed([{name:'Example',magnet,packed:'1 GB'}]).packages.length,1);
 const sources=defaultSources();assert.equal(new Set(sources.map(s=>s.url)).size,6);
 assert.ok(sources.find(s=>s.name==='SteamRip')?.url.endsWith('/steamrip.json'));
});
test('magnet sanitization drops arbitrary trackers and web seeds',()=>{
 const result=safeMagnet(magnet+'&tr=http://localhost/&ws=file:///private');
 assert.ok(!result.includes('localhost'));assert.ok(!result.includes('private'));
 assert.throws(()=>safeMagnet('magnet:?xt=file:///etc/passwd'));
 assert.ok(safeMagnet(magnet+'&tr='+encodeURIComponent('udp://tracker.example.com:1337/announce')).includes('tracker.example.com'));
 assert.ok(!safeMagnet(magnet+'&tr='+encodeURIComponent('udp://127.0.0.1:1337/announce')).includes('127.0.0.1'));
});

test('supplied catalogs load offline with exact names and usable release links',async()=>{
 const sources=await bundledSources(path.resolve('data/catalogs'));
 assert.deepEqual(sources.map(s=>s.name),['SteamRip','fitgirl','onlinefix','DODI','GOG','KaOsKrew']);
 assert.equal(sources.length,6);assert.ok(sources.every(s=>s.packages.length>1000));
 assert.ok(sources.every(s=>!s.fallbackUrl));
});
test('source import distinguishes descriptors from catalogs and migration preserves custom sources',()=>{
 const descriptors=importSourceJson({sources:[{name:'Source',source_url:'https://example.com/a.json'}]});
 assert.equal(descriptors[0].packages.length,0);
 const catalog=importSourceJson({name:'Exact NAME',downloads:[{title:'Fixture',uris:[magnet]}]});
 assert.equal(catalog[0].name,'Exact NAME');assert.equal(catalog[0].localSnapshot,true);
 assert.equal(migrateSources(descriptors,1).length,7);
 assert.deepEqual(migrateSources([],3),[]);
 assert.equal(sourceKey('https://example.com/a.json?utm_source=chatgpt.com'),'https://example.com/a.json');
});
test('torrent destination validation rejects traversal and file aliasing',()=>{
 assert.throws(()=>validateTorrentFiles([{path:'../escape',length:1}],1));
 assert.throws(()=>validateTorrentFiles([{path:'A',length:1},{path:'a',length:1}],2));
 assert.throws(()=>validateTorrentFiles([{path:'C:/escape',length:1}],1));
});
for (const useTracker of [false, true]) test(`actual torrent transfer via ${useTracker ? 'UDP tracker discovery' : 'direct peer'} verifies payload`, {timeout:30000}, async()=>{
 const {default:WebTorrent}=await import('webtorrent');
 const serverModule = 'bittorrent-tracker/server';
 const {default:TrackerServer} = await import(serverModule);
 const tracker = useTracker ? new TrackerServer({udp:true,http:false,ws:false,stats:false}) : undefined;
 if(tracker) await new Promise<void>(resolve=>tracker.listen(0,{udp:'127.0.0.1',udp6:'::1'},resolve));
 const announce = tracker ? ['udp://127.0.0.1:'+tracker.udp4.address().port+'/announce'] : [];
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-torrent-'));
 const seeder=new WebTorrent({dht:false,tracker:useTracker,lsd:false,utp:false,natUpnp:false,natPmp:false} as any);
 try {
   const input=randomBytes(128*1024);(input as any).name='fixture.bin';
   const torrent:any=await new Promise(resolve=>seeder.seed(input,{name:'fixture.bin',announce} as any,resolve));

   const pkg=parseSourceFeed({name:'Fixture',downloads:[{title:'Fixture',uris:[torrent.magnetURI]}]}).packages[0];
   const job:DownloadJob={id:randomUUID(),package:pkg,sourceId:'test',status:'connecting',downloaded:0,total:0,speed:0,averageSpeed:0,created:new Date().toISOString(),updated:new Date().toISOString(),destination:root,attempts:1,priority:0,verified:false};
   const port=(seeder.address() as any).port;
   await runTorrent(job,new AbortController().signal,()=>{},async()=>{}, {announce,clientOptions:{dht:false},onTorrent:useTracker ? undefined : t=>t.once('infoHash',()=>t.addPeer('127.0.0.1:'+port))});
   assert.equal(job.status,'completed');assert.equal(job.downloaded,input.length);
   assert.deepEqual(await readFile(path.join(torrentDirectory(job),'fixture.bin')),Buffer.from(input));
   assert.equal(job.verified,false); // Piece integrity is not publisher SHA-256 authorization.
 } finally {await new Promise<void>(resolve=>seeder.destroy(()=>resolve()));if(tracker) await new Promise<void>(resolve=>tracker.close(resolve));}
});

test('unavailable torrent fails with actionable metadata error', {timeout:10000}, async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-no-peers-'));
 const pkg=parseSourceFeed([{name:'Unavailable fixture',magnet}]).packages[0];
 const job:DownloadJob={id:randomUUID(),package:pkg,sourceId:'test',status:'connecting',downloaded:0,total:0,speed:0,averageSpeed:0,created:new Date().toISOString(),updated:new Date().toISOString(),destination:root,attempts:1,priority:0,verified:false};
 await assert.rejects(runTorrent(job,new AbortController().signal,()=>{},async()=>{}, {clientOptions:{dht:false},metadataTimeoutMs:100}), /Choose another release\/source/);
 assert.equal(job.peers,0);
});
