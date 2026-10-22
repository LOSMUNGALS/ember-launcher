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
test('migration keeps original password hashes and refuses to overwrite a populated database',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-migrate-')),source=path.join(root,'local.sqlite'),file=path.join(root,'private-export.json');
 const local=new Accounts(source,'owner@example.com');let remote;
 try{
  const password='Original-password-fixture-2026';await local.bootstrap(password);const admin=(await local.login({identifier:'owner@example.com',password})).token;local.publish(admin,{body:'Existing announcement'});
  assert.equal(await exportAccounts(source,file),1);
  const {readFile}=await import('node:fs/promises');const data=JSON.parse(await readFile(file,'utf8'));
  remote=await remoteAccounts({client:createClient({url:pathToFileURL(path.join(root,'hosted.sqlite')).href}),adminEmail:'owner@example.com'});
  assert.equal(await importAccounts(data,remote),1);
  const session=await remote.login({identifier:'owner@example.com',password});assert.equal((await remote.posts(session.token))[0].body,'Existing announcement');
  const hash=await remote.db.prepare('SELECT password FROM users').get();assert.equal(hash.password,local.db.prepare('SELECT password FROM users').get().password);
  await assert.rejects(importAccounts(data,remote),/not empty/);assert.equal((await remote.requests(session.token)).length,1);
  await assert.rejects(remote.authorize(admin),/expired/);
 }finally{local.close();await remote?.close();await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
});

