import test from 'node:test';
import assert from 'node:assert/strict';
import { onlineAchievements } from '../desktop/steam-dashboard';
import { parseCatalog, UnavailableGameError } from '../desktop/catalog';
const schema = {game:{availableGameStats:{achievements:[{name:'A',displayName:'First',description:'Win',icon:'https://shared.steamstatic.com/a.png'}]}}};
test('online achievements join definitions, icons and progress by API name', async()=>{
 const result=await onlineAchievements('10','76561198000000000','a'.repeat(32),{},async url=>url.includes('GetSchema')?schema:{playerstats:{success:true,achievements:[{apiname:'A',achieved:1,unlocktime:123}]}});
 assert.equal(result.achievements?.[0].name,'First');assert.equal(result.achievementUnlocked,1);assert.equal(result.achievements?.[0].icon,'https://shared.steamstatic.com/a.png');
});
test('private progress retains definitions without inventing locked achievements', async()=>{
 const result=await onlineAchievements('10','76561198000000000','a'.repeat(32),{},async url=>url.includes('GetSchema')?schema:{playerstats:{success:false}});
 assert.equal(result.achievementTotal,1);assert.equal(result.achievementUnlocked,undefined);assert.equal(result.achievements?.[0].unlocked,undefined);
});
test('network failure retains cached achievements without exposing request secrets', async()=>{
 const result=await onlineAchievements('10','76561198000000000','a'.repeat(32),{achievements:[{id:'A',name:'Saved',description:''}]},async()=>{throw Error('secret url')});
 assert.equal(result.achievements?.[0].name,'Saved');assert.ok(!result.achievementMessage?.includes('secret'));
});
test('only explicit unavailable responses hide listings',()=>{
 assert.throws(()=>parseCatalog('10',{'10':{success:false}},null),UnavailableGameError);
 assert.throws(()=>parseCatalog('10',{},null),e=>e instanceof Error && !(e instanceof UnavailableGameError));
});
