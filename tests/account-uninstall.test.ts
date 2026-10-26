import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,stat,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {accountEndpoint,AccountClient} from '../desktop/accounts';
import {mock} from 'node:test';
import {downloadedInstallDirectory,uninstallDownloaded} from '../desktop/download-uninstall';
test('account endpoints reject plaintext remote services, embedded credentials and paths',()=>{
 assert.equal(accountEndpoint('https://accounts.example.com'),'https://accounts.example.com');
 assert.equal(accountEndpoint('http://127.0.0.1:4783'),'http://127.0.0.1:4783');
 for(const u of ['http://accounts.example.com','https://user:password@example.com','https://example.com/another','file:///tmp/test'])assert.throws(()=>accountEndpoint(u));
});
test('launcher requires login before any authorized operation',async()=>{
 const client=new AccountClient(os.tmpdir());await assert.rejects(client.require(true),/Log in/);assert.equal(client.status().user,null);
});
test('hosted login allows server wake-up time and never retries a submitted credential request',async()=>{
 const original=globalThis.fetch,timeouts:number[]=[];let calls=0;
 const timeout=mock.method(AbortSignal,'timeout',(milliseconds:number)=>{timeouts.push(milliseconds);return new AbortController().signal;});
 globalThis.fetch=(async()=>{calls++;throw Error('network failure');}) as typeof fetch;
 try{const client=new AccountClient(os.tmpdir());client.url='https://ember-accounts.onrender.com';await assert.rejects(client.login({identifier:'fixture',password:'not-a-real-password'}),/waking up/);assert.equal(calls,1);assert.equal(timeouts[0],75000);client.url='http://127.0.0.1:4783';await assert.rejects(client.request('me'),/Account service connection/);assert.equal(timeouts[1],10000);}
 finally{globalThis.fetch=original;timeout.mock.restore();}
});
test('an in-flight access check cannot restore a logged-out session',async()=>{
 const original=globalThis.fetch;let finish:(value:Response)=>void=()=>{};
 globalThis.fetch=(async(url)=>{
  if(String(url).endsWith('/login'))return Response.json({token:'fixture',user:{id:1,username:'test',email:'test@example.com',role:'user'}});
  if(String(url).endsWith('/me'))return new Promise<Response>(resolve=>{finish=resolve;});
  return Response.json({ok:true});
 }) as typeof fetch;
 try{const client=new AccountClient(os.tmpdir());await client.login({});const verification=client.require(true);await client.logout();finish(Response.json({user:{id:1}}));await assert.rejects(verification,/Session changed/);assert.equal(client.status().user,null);await assert.rejects(client.require(),/Log in/);}
 finally{globalThis.fetch=original;}
});
test('download uninstall deletes only the recorded job folder and rejects outside executables',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-uninstall-')),id='12345678-1234-1234-1234-123456789abc',dir=path.join(root,'Ember-download-'+id);
 try{
  await mkdir(path.join(dir,'Game'),{recursive:true});const exe=path.join(dir,'Game','Game.exe');await writeFile(exe,'fixture');const outside=path.join(root,'keep.exe');await writeFile(outside,'keep');
  await assert.rejects(downloadedInstallDirectory(root,id,outside),/outside/);
  await assert.rejects(downloadedInstallDirectory(root,'../other',exe),/Invalid/);
  assert.equal(await downloadedInstallDirectory(root,id,exe),await import('node:fs/promises').then(fs=>fs.realpath(dir)));
  await uninstallDownloaded(root,id,exe);await assert.rejects(stat(dir));assert.ok((await stat(outside)).isFile());
 }finally{await rm(root,{recursive:true,force:true});}
});
test('responses from an earlier session cannot affect a replacement login',async()=>{const root=await mkdtemp(path.join(os.tmpdir(),'ember-session-race-'));const previousUrl=process.env.EMBER_ACCOUNT_URL;process.env.EMBER_ACCOUNT_URL='http://127.0.0.1:4783';let release:()=>void=()=>{};const gate=new Promise<void>(r=>release=r);const fetch=mock.method(globalThis,'fetch',async(input:any)=>{if(String(input).endsWith('/me'))await gate;return new Response(JSON.stringify(String(input).endsWith('/login')?{token:'fixture-token-long-enough-1234',user:{id:1,username:'fixture',email:'fixture@example.com',role:'user'}}:{user:{id:1}}),{status:200,headers:{'content-type':'application/json'}})});try{const client=new AccountClient(root);await client.login({identifier:'fixture',password:'fixture'});const original=client.sessionIdentity(),pending=client.request('me');await client.login({identifier:'fixture',password:'fixture'});assert.notEqual(client.sessionIdentity(),original);release();await assert.rejects(pending,/Session changed/);assert.equal(client.status().user?.username,'fixture')}finally{fetch.mock.restore();if(previousUrl===undefined)delete process.env.EMBER_ACCOUNT_URL;else process.env.EMBER_ACCOUNT_URL=previousUrl;await rm(root,{recursive:true,force:true})}});
