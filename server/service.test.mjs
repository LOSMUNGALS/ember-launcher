import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Accounts,validMedia} from './service.mjs';
import {startService} from './index.mjs';
import {resendMailer} from './email.mjs';
const password='Test-password-only-29381';

test('reset links are hashed, expiring, single-use, revoke sessions and preserve approval status',async()=>{
 let now=Date.now();const a=new Accounts(':memory:','owner@example.com',()=>now),sent=[];
 const send=async mail=>sent.push(mail),origin='https://accounts.example.com',next='New-password-only-29381';
 try{
  await a.bootstrap(password);const admin=(await a.login({identifier:'owner@example.com',password})).token;
  const known=await a.forgotPassword('OWNER@example.com',send,origin),unknown=await a.forgotPassword('missing@example.com',send,origin);
  assert.deepEqual(known,unknown);assert.equal(sent.length,1);assert.equal(sent[0].to,'owner@example.com');
  const token=new URL(sent[0].url).hash.slice(7);
  assert.notEqual(a.db.prepare('SELECT token FROM password_resets').get().token,token);
  await assert.rejects(a.resetPassword({token,password:'short'}),/12 and 128/);
  await a.resetPassword({token,password:next});
  assert.throws(()=>a.authorize(admin),/expired/);await assert.rejects(a.login({identifier:'owner@example.com',password}),/Invalid/);
  assert.equal((await a.login({identifier:'owner@example.com',password:next})).user.role,'admin');
  await assert.rejects(a.resetPassword({token,password:next}),/invalid or expired/);
  await a.register({email:'player@example.com',username:'player',password});
  await a.forgotPassword('player@example.com',send,origin);const expired=new URL(sent.at(-1).url).hash.slice(7);now+=30*60000;
  await assert.rejects(a.resetPassword({token:expired,password:next}),/expired/);
  await a.forgotPassword('player@example.com',send,origin);await a.resetPassword({token:new URL(sent.at(-1).url).hash.slice(7),password:next});
  await assert.rejects(a.login({identifier:'player',password:next}),/awaiting approval/);
  await assert.rejects(a.forgotPassword('owner@example.com',undefined,origin),/not configured/);
  await assert.rejects(a.forgotPassword('owner@example.com',async()=>{throw Error('provider secret');},origin),/could not be sent/);
  assert.equal(a.db.prepare('SELECT COUNT(*) n FROM password_resets').get().n,0);
 }finally{a.close();}
});

test('Resend adapter sends server-side text email and handles delivery errors',async()=>{
 assert.equal(resendMailer({apiKey:'',from:''}),undefined);
 let request;
 const send=resendMailer({apiKey:'fixture-key',from:'Ember <sender@example.com>',request:async(url,options)=>{request={url,...options};return new Response('{}');}});
 await send({to:'player@example.com',url:'https://accounts.example.com/#reset=fixture'});
 assert.equal(request.url,'https://api.resend.com/emails');assert.equal(request.headers.Authorization,'Bearer fixture-key');
 const body=JSON.parse(request.body);assert.deepEqual(body.to,['player@example.com']);assert.match(body.text,/#reset=fixture/);
 await assert.rejects(resendMailer({apiKey:'fixture',from:'sender@example.com',request:async()=>new Response('{}',{status:403})})({to:'player@example.com',url:'https://example.com'}),/rejected/);
});

test('HTTP reset flow protects origin, hides account existence and reports setup state',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'ember-reset-http-')),sent=[];
 const s=await startService({directory:root,port:0,adminEmail:'owner@example.com',sendReset:async mail=>sent.push(mail)});
 const post=(route,body,extra={})=>fetch(s.url+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json',...extra},body:JSON.stringify(body)});
 try{
  assert.equal((await (await fetch(s.url+'/api/setup-status')).json()).setupNeeded,true);
  await s.accounts.bootstrap(password);
  assert.equal((await (await fetch(s.url+'/api/setup-status')).json()).setupNeeded,false);
  assert.equal((await post('forgot-password',{email:'owner@example.com'},{Origin:'https://evil.example'})).status,403);
  assert.equal((await post('forgot-password',{email:'owner@example.com'})).status,200);
  const token=new URL(sent[0].url).hash.slice(7);
  assert.equal((await post('reset-password',{token,password:'Changed-password-29381'})).status,200);
  assert.equal((await post('reset-password',{token,password:'Changed-password-29381'})).status,400);
  assert.equal((await post('login',{identifier:'owner@example.com',password:'Changed-password-29381'})).status,200);
  for(let i=0;i<20;i++)await post('forgot-password',{email:'missing@example.com'});
  assert.equal((await post('forgot-password',{email:'missing@example.com'})).status,429);
 }finally{await s.close();await rm(root,{recursive:true,force:true});}
});

test('registration cannot claim the administrator username before setup',async()=>{
 const a=new Accounts(':memory:','owner@example.com');
 try{
  for(const username of ['ember-admin','EMBER-ADMIN'])await assert.rejects(a.register({email:'player@example.com',username,password}),/reserved/);
  await a.bootstrap(password);
  assert.equal((await a.login({identifier:'owner@example.com',password})).user.role,'admin');
 }finally{a.close();}
});
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
