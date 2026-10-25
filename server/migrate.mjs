import {DatabaseSync} from 'node:sqlite';
import {readFile,writeFile} from 'node:fs/promises';
import {remoteAccounts} from './remote.mjs';
// Sessions and reset tokens deliberately do not migrate: users log in again.
const legacyTables=['users','posts','launcher_releases','audit'];
const tables=[...legacyTables,'feedback_threads','feedback_messages','feedback_images'];
export async function exportAccounts(source,destination){
 const db=new DatabaseSync(source,{readOnly:true});
 try{db.exec('BEGIN');const data={format:'ember-accounts-v1',tables:{}};for(const name of tables){const exists=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name);data.tables[name]=exists?db.prepare(`SELECT * FROM ${name}`).all():[];}db.exec('COMMIT');await writeFile(destination,JSON.stringify(data),{flag:'wx',mode:0o600});return data.tables.users.length;}
 finally{db.close();}
}
export async function importAccounts(data,accounts){
 if(data?.format!=='ember-accounts-v1'||!legacyTables.every(t=>Array.isArray(data.tables?.[t]))||!tables.every(t=>data.tables?.[t]===undefined||Array.isArray(data.tables[t])))throw Error('Invalid Ember account export.');
 const db=accounts.db;
 await db.exec('BEGIN IMMEDIATE');
 try{
  for(const t of [...tables,'sessions','password_resets'])if(Number((await db.prepare(`SELECT COUNT(*) n FROM ${t}`).get()).n)!==0)throw Error('Hosted database is not empty. Import canceled; no existing records replaced.');
  for(const t of tables){const allowed=(await db.prepare(`PRAGMA table_info(${t})`).all()).map(c=>c.name);for(const row of data.tables[t]||[]){const keys=Object.keys(row);if(!keys.length||keys.some(k=>!allowed.includes(k)))throw Error('Export contains unknown columns.');await db.prepare(`INSERT INTO ${t} (${keys.map(k=>'"'+k+'"').join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]));}}
  await db.exec('COMMIT');return data.tables.users.length;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
if(process.argv[1]?.endsWith('migrate.mjs')){
 const [mode,source,destination]=process.argv.slice(2);
 if(mode==='export'&&source&&destination){console.log(`Exported ${await exportAccounts(source,destination)} accounts. Keep this file private; it contains password hashes.`);}
 else if(mode==='import'&&source){const accounts=await remoteAccounts({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN,adminEmail:process.env.EMBER_ADMIN_EMAIL||'nicolas2mv@gmail.com'});try{console.log(`Imported ${await importAccounts(JSON.parse(await readFile(source,'utf8')),accounts)} accounts. Existing passwords and approvals are preserved.`);}finally{await accounts.close();}}
 else throw Error('Usage: migrate.mjs export <accounts.sqlite> <private-export.json> OR migrate.mjs import <private-export.json>');
}
