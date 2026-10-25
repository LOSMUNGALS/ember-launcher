import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createClient} from '@libsql/client';
import {remoteAccounts} from './remote.mjs';
import {Accounts} from './service.mjs';
import {exportAccounts,importAccounts} from './migrate.mjs';
test('hosted adapter preserves accounts, approvals and announcements across service restarts',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-turso-')),url=pathToFileURL(path.join(root,'remote.sqlite')).href,password='Fixture-test-password-2026';
 let now=Date.now(),a;const open=()=>remoteAccounts({client:createClient({url}),adminEmail:'owner@example.com',now:()=>now});
 try{
  a=await open();assert.equal(await a.setupNeeded(),true);await a.bootstrap(password);
  const admin=(await a.login({identifier:'owner@example.com',password})).token;
  await a.register({email:'player@example.com',username:'player',password});await assert.rejects(a.login({identifier:'player',password}),/awaiting/);
  const id=(await a.requests(admin)).find(u=>u.username==='player').id;
  await a.decide(admin,id,'rejected');await assert.rejects(a.register({email:'player@example.com',username:'player',password}),/Try again/);now+=86400001;
  await a.register({email:'player@example.com',username:'player',password});await a.decide(admin,id,'approved');
  const user=(await a.login({identifier:'player',password})).token;
  await a.cloudLibrary(user,{entries:[{key:'steam-123',steamId:'123',name:'Fixture',saved:true,favorite:false,hidden:false,collections:[],playStatus:'backlog'}]});assert.equal((await a.cloudLibrary(admin)).entries.length,0);
  await assert.rejects(a.publish(user,{body:'unauthorized'}),/Administrator/);
  await Promise.all(Array.from({length:5},(_,i)=>a.publish(admin,{body:'Update '+i})));
  const release=await a.saveRelease(admin,{version:'1.0.1',title:'Test',body:'Description',published:true});assert.ok(release.id);
  await a.close();a=await open();assert.equal(await a.setupNeeded(),false);assert.equal((await a.cloudLibrary(user)).entries[0].name,'Fixture');assert.equal((await a.posts(user)).length,5);assert.equal((await a.release(user,'1.0.1')).title,'Test');
  const messages=[];await a.forgotPassword('player@example.com',async message=>messages.push(message),'https://accounts.example.com');const reset=new URL(messages[0].url).hash.slice(7);
  await a.resetPassword({token:reset,password:password+'new'});await assert.rejects(a.authorize(user),/expired/);
  const next=(await a.login({identifier:'player',password:password+'new'})).token;await a.decide(admin,id,'revoked');await assert.rejects(a.authorize(next),/revoked/);
  // A failed transaction must roll back and leave the next operation usable.
  await assert.rejects(a.resetPassword({token:'a'.repeat(43),password}),/expired/);assert.equal((await a.posts(admin)).length,5);
 }finally{await a?.close();await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
});
test('partial hosted configuration fails instead of using ephemeral SQLite',async()=>{
 await assert.rejects(remoteAccounts({url:'libsql://example.turso.io',adminEmail:'owner@example.com'}),/require/);
 await assert.rejects(remoteAccounts({url:'http://example.com',authToken:'fixture',adminEmail:'owner@example.com'}),/secure/);
});
test('unreachable database fails startup within a bounded time and closes the client',async()=>{
 let closed=false;const client={execute:()=>new Promise(()=>{}),close:()=>{closed=true;}};
 await assert.rejects(remoteAccounts({client,adminEmail:'owner@example.com',initializationTimeoutMs:10}),/connection limit/);assert.equal(closed,true);
});
