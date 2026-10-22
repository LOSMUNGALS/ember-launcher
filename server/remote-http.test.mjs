import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createClient} from '@libsql/client';
import {remoteAccounts} from './remote.mjs';
import {startService} from './index.mjs';
test('hosted HTTP endpoints await access checks and preserve meaningful authorization errors',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-hosted-http-'));
 const accounts=await remoteAccounts({client:createClient({url:pathToFileURL(path.join(root,'remote.sqlite')).href}),adminEmail:'owner@example.com'});
 const s=await startService({directory:root,port:0,accountStore:accounts});
 const post=(route,body,token='')=>fetch(s.url+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
 try{
  const password='Fixture-password-2026';assert.equal((await fetch(s.url+'/api/setup-status').then(r=>r.json())).setupNeeded,true);
  assert.equal((await post('setup',{token:s.setupToken,password})).status,200);
  const login=await post('login',{identifier:'owner@example.com',password});const {token}=await login.json();assert.ok(token);
  const me=await fetch(s.url+'/api/me',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json());assert.equal(me.user.email,'owner@example.com');
  assert.equal((await post('updates',{body:'Hosted announcement'},token)).status,200);
  assert.equal((await fetch(s.url+'/api/updates',{headers:{Authorization:'Bearer '+token}}).then(r=>r.json())).posts.length,1);
  assert.equal((await post('register',{email:'player@example.com',username:'player',password})).status,200);
  assert.equal((await post('login',{identifier:'player',password})).status,403);
  assert.equal((await fetch(s.url+'/api/accounts')).status,401);
 }finally{await s.close();await rm(root,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
});
