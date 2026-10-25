import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Accounts} from './service.mjs';
test('cloud library enforces ownership, approval, validation and no extra fields',async()=>{
 const a=new Accounts(':memory:','owner@example.com');try{
 await a.bootstrap('Very-long-test-password-789');const token=(await a.login({identifier:'owner@example.com',password:'Very-long-test-password-789'})).token;
 const entry={key:'steam-123',steamId:'123',name:'Example',saved:true,favorite:true,hidden:false,collections:['Weekend'],playStatus:'playing',executable:'private'};
 assert.equal(a.cloudLibrary(token,{entries:[entry]}).entries[0].executable,undefined);
 assert.equal(a.cloudLibrary(token).entries.length,1);
 assert.throws(()=>a.cloudLibrary('invalid'),/expired|Log in|session/i);
 assert.throws(()=>a.cloudLibrary(token,{entries:[entry,entry]}),/Invalid/);
 await a.register({username:'player',email:'player@example.com',password:'Very-long-test-password-789'});const user=a.db.prepare('SELECT id FROM users WHERE username=?').get('player');a.decide(token,user.id,'approved');const other=(await a.login({identifier:'player',password:'Very-long-test-password-789'})).token;
 assert.equal(a.cloudLibrary(other).entries.length,0);
 }finally{a.close()}
});
