import {test} from 'node:test';
import assert from 'node:assert/strict';
import {updaterDriver} from '../desktop/updater-module';
test('updater loads the CommonJS getter through the native ESM default export',()=>{
 const driver={on(){},checkForUpdates(){}};
 const commonjs={};Object.defineProperty(commonjs,'autoUpdater',{enumerable:true,get:()=>driver});
 assert.equal(updaterDriver({default:commonjs}),driver);
 assert.equal(updaterDriver({autoUpdater:driver}),driver);
 assert.throws(()=>updaterDriver({default:{}}),/could not be loaded/);
});
