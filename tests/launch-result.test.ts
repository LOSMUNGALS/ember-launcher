import {test} from 'node:test';
import assert from 'node:assert/strict';
import {launchResult} from '../desktop/launch-result';
test('immediate exits do not count as playtime even with a zero exit code',()=>{
  for(const code of [0,1,-1073741515]) {
    const result=launchResult('Game',12,code,null);
    assert.equal(result.recordPlaytime,false);
    assert.match(result.message,/exited immediately/);
  }
  assert.match(launchResult('Game',12,-1073741515,null).message,/0xC0000135/);
});
test('normal sessions retain playtime and crashes retain exit diagnostics',()=>{
  assert.deepEqual(launchResult('Game',10000,0,null),{recordPlaytime:true,message:''});
  assert.match(launchResult('Game',10000,5,null).message,/code 5/);
  assert.match(launchResult('Game',10000,null,'SIGTERM').message,/SIGTERM/);
});
