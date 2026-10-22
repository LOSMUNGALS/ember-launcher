import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Accounts,validMedia} from './service.mjs';
import {startService} from './index.mjs';
const password='Test-password-only-29381';
test('pending approval, persistent accounts, 24-hour rejection, revocation and admin-only posts',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-accounts-'));let now=Date.now(),a=new Accounts(path.join(root,'test.sqlite'),'owner@example.com',()=>now);
 try{
  await a.bootstrap(password);const admin=(await a.login({identifier:'owner@example.com',password})).token;
  const c={email:'player@example.com',username:'player',password};await a.register(c);
  await assert.rejects(a.login({identifier:'player',password}),/awaiting/);
  await assert.rejects(a.register({...c,username:'different'}),/unavailable/);
  const id=a.requests(admin).find(u=>u.username==='player').id;
  a.decide(admin,id,'rejected');await assert.rejects(a.register(c),/Try again/);
  now+=86400000-1;await assert.rejects(a.register(c),/Try again/);now+=2;await a.register(c);a.decide(admin,id,'approved');
  const user=(await a.login({identifier:'PLAYER',password})).token;
  assert.throws(()=>a.decide(user,id,'approved'),/Administrator/);
  assert.throws(()=>a.publish(user,{body:'no'}),/Administrator/);
  a.publish(admin,{body:'**Release**\n<script>unsafe</script>',media:[{type:'giphy',url:'https://giphy.com/gifs/hello-AbCd1234'}]});
  const posts=a.posts(user);assert.equal(posts.length,1);assert.equal(posts[0].media[0].url,'https://media.giphy.com/media/AbCd1234/giphy.gif');
  a.close();a=new Accounts(path.join(root,'test.sqlite'),'owner@example.com',()=>now);assert.equal(a.posts(user).length,1);
  a.decide(admin,id,'revoked');assert.throws(()=>a.authorize(user),/revoked/);await assert.rejects(a.login({identifier:'player',password}),/revoked/);
  await assert.rejects(a.register(c),/exists/);assert.equal(a.db.prepare('SELECT COUNT(*) n FROM audit').get().n,3);
 }finally{a.close();await rm(root,{recursive:true,force:true});}
});
test('HTTP service rejects cross-origin mutation and unauthorized reads',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-http-'));const s=await startService({directory:root,port:0,adminEmail:'owner@example.com'});
 try{
  assert.equal((await fetch(s.url+'/api/accounts')).status,401);
  assert.equal((await fetch(s.url+'/api/setup',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://evil.example'},body:JSON.stringify({token:s.setupToken,password})})).status,403);
  const setup=await fetch(s.url+'/api/setup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:s.setupToken,password})});assert.equal(setup.status,200);
  const login=await fetch(s.url+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:'owner@example.com',password})});const {token}=await login.json();assert.ok(token);
  assert.equal((await fetch(s.url+'/api/me',{headers:{Authorization:'Bearer '+token}})).status,200);
  await fetch(s.url+'/api/logout',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:'{}'});
  assert.equal((await fetch(s.url+'/api/me',{headers:{Authorization:'Bearer '+token}})).status,401);
  assert.match(await (await fetch(s.url)).text(),/Account administration/);
 }finally{await s.close();await rm(root,{recursive:true,force:true});}
});
test('media rejects unsafe protocols and unrelated GIPHY hosts',()=>{
 for(const url of ['javascript:alert(1)','http://example.com/a.png','https://user:pass@example.com/image'])assert.throws(()=>validMedia([{type:'image',url}]));
 assert.throws(()=>validMedia([{type:'giphy',url:'https://evil.example/gif'}]));
});
