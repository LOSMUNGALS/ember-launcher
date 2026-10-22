import http from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {Accounts,ApiError} from './service.mjs';
import {resendMailer} from './email.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
export async function startService({directory=path.resolve('.account-service'),port=Number(process.env.PORT||4783),host=process.env.HOST||'127.0.0.1',adminEmail=process.env.EMBER_ADMIN_EMAIL||'nicolas2mv@gmail.com',publicUrl=process.env.PUBLIC_URL,sendReset=resendMailer(),accountStore}={}){
 await mkdir(directory,{recursive:true});
 const hosted=process.env.RENDER==='true';
 if(hosted&&(!process.env.TURSO_DATABASE_URL||!process.env.TURSO_AUTH_TOKEN))throw Error('Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Render Environment before deploying. Local SQLite fallback is disabled on Render.');
 const accounts=accountStore || (process.env.TURSO_DATABASE_URL||process.env.TURSO_AUTH_TOKEN
  ? await (await import('./remote.mjs')).remoteAccounts({url:process.env.TURSO_DATABASE_URL,authToken:process.env.TURSO_AUTH_TOKEN,adminEmail})
  : new Accounts(path.join(directory,'accounts.sqlite'),adminEmail));
 const setupToken=randomBytes(32).toString('hex');
 const limits=new Map();
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
  try{
   const address=server.address(),origin=publicUrl||`http://${host}:${typeof address==='object'?address.port:port}`;
   if(req.headers.host!==new URL(origin).host)throw new ApiError(403,'Unrecognized host. Configure PUBLIC_URL for deployment.');
   if(req.headers.origin&&req.headers.origin!==new URL(origin).origin)throw new ApiError(403,'Cross-origin requests are not allowed.');
   const url=new URL(req.url,origin),route=url.pathname,token=(req.headers.authorization||'').replace(/^Bearer /,'');
   if(req.method==='GET'&&!route.startsWith('/api/')){
    const assets={'/':'index.html','/admin.js':'admin.js','/formatting.mjs':'formatting.mjs','/style.css':'style.css','/logo.png':'../../public/launcher.png'};
    if(!assets[route])throw new ApiError(404,'Not found.');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' https:; media-src https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
    res.setHeader('Content-Type',/\.m?js$/.test(route)?'text/javascript':route.endsWith('.css')?'text/css':route.endsWith('.png')?'image/png':'text/html');
    res.end(await readFile(path.resolve(here,'public',assets[route])));return;
   }
   let body={};
   if(req.method==='POST'){
    if(!String(req.headers['content-type']).startsWith('application/json'))throw new ApiError(415,'Use JSON.');
    let bytes=0,chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)throw new ApiError(413,'Request is too large.');chunks.push(chunk);}
    try{body=JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{throw new ApiError(400,'Invalid JSON.');}
    if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError(400,'Invalid request.');
   }
   if(['/api/login','/api/register','/api/setup','/api/forgot-password','/api/reset-password'].includes(route)){
    const now=Date.now();for(const [k,v] of limits)if(v.until<now)limits.delete(k);
    const keys=[`${route}:ip:${req.socket.remoteAddress}`,`${route}:identity:${String(body.identifier||body.email||'').toLowerCase().slice(0,254)}`];
    for(const key of keys){const v=limits.get(key)||{count:0,until:now+900000};if(++v.count>20||limits.size>10000)throw new ApiError(429,'Too many attempts. Try again in 15 minutes.');limits.set(key,v);}
   }
   let result;
   if(req.method==='GET'&&route==='/api/setup-status')result={setupNeeded:!!(await accounts.setupNeeded())};
   else if(req.method==='POST'&&route==='/api/forgot-password')result=await accounts.forgotPassword(body.email,sendReset,origin);
   else if(req.method==='POST'&&route==='/api/reset-password')result=await accounts.resetPassword(body);
   else if(req.method==='POST'&&route==='/api/setup'){
    const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    const supplied=Buffer.from(String(body.token||''));const wanted=Buffer.from(setupToken);
    if(!local||supplied.length!==wanted.length||!timingSafeEqual(supplied,wanted))throw new ApiError(403,'Use the one-time setup link on the server computer.');
    await accounts.bootstrap(body.password);result={message:'Administrator created. Log in with your email and new password.'};
   }else if(req.method==='POST'&&route==='/api/register')result=await accounts.register(body);
   else if(req.method==='POST'&&route==='/api/login')result=await accounts.login(body);
   else if(req.method==='GET'&&route==='/api/me')result={user:accounts.publicUser(await accounts.authorize(token))};
   else if(req.method==='POST'&&route==='/api/logout'){await accounts.logout(token);result={ok:true};}
   else if(req.method==='GET'&&route==='/api/accounts')result={users:await accounts.requests(token)};
   else if(req.method==='POST'&&route==='/api/decision')result=await accounts.decide(token,body.id,body.status);
   else if(req.method==='GET'&&route==='/api/updates')result={posts:await accounts.posts(token,url.searchParams.get('before')||undefined)};
   else if(req.method==='GET'&&route==='/api/updates/latest')result=await accounts.latestPost(token);
   else if(req.method==='POST'&&route==='/api/updates')result=await accounts.publish(token,body);
   else if(req.method==='GET'&&route==='/api/launcher-releases')result={releases:await accounts.releases(token)};
   else if(req.method==='POST'&&route==='/api/launcher-releases')result=await accounts.saveRelease(token,body);
   else if(req.method==='GET'&&route==='/api/launcher-release')result={release:await accounts.release(token,url.searchParams.get('version'))};
   else throw new ApiError(404,'Not found.');
   json(res,200,result);
  }catch(e){json(res,e instanceof ApiError?e.status:500,{error:e instanceof ApiError?e.message:'The service could not complete this request.'});}
 });
 server.requestTimeout=15000;server.headersTimeout=10000;
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,resolve);});
 return {server,accounts,setupToken,url:publicUrl||`http://${host}:${server.address().port}`,close:()=>new Promise((resolve,reject)=>server.close(()=>{Promise.resolve(accounts.close()).then(resolve,reject);}))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const service=await startService();
 console.log(`Ember account administration: ${service.url}`);
 if(await service.accounts.setupNeeded())console.log(`One-time administrator setup (open on this computer): ${service.url}/#setup=${service.setupToken}`);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void service.close().then(()=>process.exit(0)));
}
