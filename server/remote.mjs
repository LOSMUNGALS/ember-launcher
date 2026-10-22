import {createClient} from '@libsql/client';
import {AsyncAccounts} from './async-service.mjs';
export class RemoteDatabase {
 constructor(client){this.client=client;this.transaction=undefined;}
 async exec(sql){
  if(sql==='BEGIN IMMEDIATE'){this.transaction=await this.client.transaction('write');return;}
  if(sql==='COMMIT'||sql==='ROLLBACK'){const tx=this.transaction;try{if(sql==='COMMIT')await tx.commit();else await tx.rollback();}finally{tx.close();this.transaction=undefined;}return;}
  for(const statement of sql.split(';').map(s=>s.trim()).filter(Boolean)){if(/^PRAGMA /i.test(statement))continue;await (this.transaction||this.client).execute(statement);}
 }
 prepare(sql){const execute=args=>(this.transaction||this.client).execute({sql,args});return {
  get:async(...args)=>(await execute(args)).rows[0],
  all:async(...args)=>(await execute(args)).rows,
  run:async(...args)=>{const r=await execute(args);return {changes:r.rowsAffected,lastInsertRowid:r.lastInsertRowid};}
 };}
 close(){this.transaction?.close();this.client.close();}
}
export async function remoteAccounts({url,authToken,adminEmail,client,now}){
 if(!client){
  if(!url||!authToken)throw Error('Hosted accounts require TURSO_DATABASE_URL and TURSO_AUTH_TOKEN.');
  const parsed=new URL(url);if(!['libsql:','https:'].includes(parsed.protocol)||parsed.username||parsed.password)throw Error('Use the secure Turso database URL.');
  client=createClient({url,authToken});
 }
 const database=new RemoteDatabase(client),accounts=new AsyncAccounts(database,adminEmail,now);
 try{await accounts.ready;}catch{database.close();throw Error('Cannot initialize the Turso account database. Verify the database URL, token and database engine.');}
 // Serialize complete operations, including transactions, so concurrent HTTP requests
 // cannot share an interactive transaction. One hosted service instance is supported.
 let tail=Promise.resolve();
 return new Proxy(accounts,{get(target,key){const value=target[key];if(typeof value!=='function'||key==='publicUser')return typeof value==='function'?value.bind(target):value;return (...args)=>{const next=tail.then(()=>value.apply(target,args));tail=next.catch(()=>{});return next;};}});
}
