import {DatabaseSync} from 'node:sqlite';
import {randomBytes, scrypt as derive, timingSafeEqual, createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(derive);
const digest=t=>createHash('sha256').update(t).digest('hex');
const DAY=86400000;
export class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}
const fail=(status,message)=>{throw new ApiError(status,message);};
function credentials(p){
 const email=String(p.email||'').trim().toLowerCase(), username=String(p.username||'').trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254)fail(400,'Enter a valid email address.');
 if(!/^[a-zA-Z0-9_-]{3,32}$/.test(username))fail(400,'Username must be 3–32 letters, numbers, underscores or hyphens.');
 if(typeof p.password!=='string'||p.password.length<12||p.password.length>128)fail(400,'Use a password between 12 and 128 characters.');
 return {email,username,password:p.password};
}
async function hashPassword(password){const salt=randomBytes(16).toString('hex');return salt+':'+(await scrypt(password,salt,64)).toString('hex');}
async function matches(password,stored){const [salt,key]=stored.split(':');return timingSafeEqual(Buffer.from(key,'hex'),await scrypt(password,salt,64));}
export function validMedia(value){
 if(!Array.isArray(value)||value.length>8)fail(400,'Attach at most eight media items.');
 return value.map(m=>{
  if(!m||!['image','video','giphy'].includes(m.type))fail(400,'Unsupported media type.');
  const url=String(m.url||'');
  if(url.length>2048)fail(400,'Media URL is too long.');
  let u;try{u=new URL(url);}catch{fail(400,'Use a complete HTTPS media URL.');}
  if(u.protocol!=='https:'||u.username||u.password)fail(400,'Media links must use HTTPS.');
  if(m.type==='giphy'&&!/^(?:media\d*\.)?giphy\.com$/.test(u.hostname))fail(400,'Use a giphy.com GIF link.');
  let finalUrl=url;
  if(m.type==='giphy'){
   const id=u.pathname.match(/\/media\/(?:v1\.[^/]+\/)?([a-zA-Z0-9]+)\//)?.[1] || u.pathname.match(/\/embed\/([a-zA-Z0-9]+)/)?.[1] || u.pathname.split('/').filter(Boolean).at(-1)?.split('-').at(-1);
   if(!id||!/^[a-zA-Z0-9]{4,100}$/.test(id))fail(400,'Use a GIPHY GIF page or media link.');
   finalUrl=`https://media.giphy.com/media/${id}/giphy.gif`;
  }
  return {type:m.type,url:finalUrl,caption:String(m.caption||'').slice(0,240)};
 });
}
export class Accounts {
 constructor(file,adminEmail,now=()=>Date.now()){
  this.now=now;this.adminEmail=adminEmail.trim().toLowerCase();this.db=new DatabaseSync(file);
  this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
   CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE COLLATE NOCASE,username TEXT UNIQUE COLLATE NOCASE,password TEXT NOT NULL,status TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',retryAt INTEGER NOT NULL DEFAULT 0,created INTEGER NOT NULL);
   CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,userId INTEGER REFERENCES users(id),expires INTEGER);
   CREATE TABLE IF NOT EXISTS posts(id INTEGER PRIMARY KEY,body TEXT NOT NULL,media TEXT NOT NULL,created INTEGER NOT NULL,author INTEGER REFERENCES users(id));
   CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor INTEGER,action TEXT,target INTEGER,created INTEGER);`);
 }
 setupNeeded(){return !this.db.prepare("SELECT id FROM users WHERE role='admin'").get();}
 async bootstrap(password){
  if(!this.setupNeeded())fail(409,'Administrator is already configured.');
  const c=credentials({email:this.adminEmail,username:'ember-admin',password});const hash=await hashPassword(c.password);
  if(!this.setupNeeded())fail(409,'Administrator is already configured.');
  this.db.prepare("INSERT INTO users(email,username,password,status,role,created) VALUES(?,?,?,'approved','admin',?)").run(c.email,c.username,hash,this.now());
 }
 async register(p){
  const c=credentials(p);
  if(c.email===this.adminEmail)fail(409,'This address is reserved for the administrator.');
  let old=this.db.prepare('SELECT * FROM users WHERE email=? OR username=?').all(c.email,c.username);
  if(old.length>1)fail(409,'Username or email is unavailable.');
  const existing=old[0];
  if(existing){
   if(existing.email!==c.email||existing.username.toLowerCase()!==c.username.toLowerCase())fail(409,'Username or email is unavailable.');
   if(existing.status==='rejected'&&existing.retryAt>this.now())fail(429,`Request rejected. Try again after ${new Date(existing.retryAt).toISOString()}.`);
   if(existing.status!=='rejected')fail(409,'An account or pending request already exists.');
   if(!await matches(c.password,existing.password))fail(401,'Use the original account password to request approval again.');
   this.db.prepare("UPDATE users SET status='pending',retryAt=0 WHERE id=? AND status='rejected'").run(existing.id);
  }else{
   const hash=await hashPassword(c.password);
   try{this.db.prepare("INSERT INTO users(email,username,password,status,created) VALUES(?,?,?,'pending',?)").run(c.email,c.username,hash,this.now());}catch{fail(409,'Username or email is unavailable.');}
  }
  return {message:'Your request to create an account has been sent. After approval, reopen Ember and log in.'};
 }
 async login(p){
  const identifier=String(p.identifier||'').trim().toLowerCase(),password=String(p.password||'');
  if(identifier.length>254||password.length>128)fail(401,'Invalid username/email or password.');
  const u=this.db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(identifier,identifier);
  // Use a real scrypt operation for unknown users as well.
  const ok=await matches(password,u?.password||'00000000000000000000000000000000:'+ '00'.repeat(64));
  if(!u||!ok)fail(401,'Invalid username/email or password.');
  const current=this.db.prepare('SELECT * FROM users WHERE id=?').get(u.id);
  if(current.status!=='approved')fail(403,current.status==='pending'?'Your account is awaiting approval.':current.status==='rejected'?`Request rejected. You may request again after ${new Date(current.retryAt).toISOString()}.`:'Your access has been revoked. Contact the administrator.');
  const token=randomBytes(32).toString('base64url');
  this.db.prepare('DELETE FROM sessions WHERE expires<?').run(this.now());
  this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),u.id,this.now()+7*DAY);
  return {token,user:this.publicUser(current)};
 }
 publicUser(u){return {id:u.id,username:u.username,email:u.email,role:u.role};}
 authorize(token,admin=false){
  if(typeof token!=='string'||token.length>200)fail(401,'Log in to continue.');
  const u=this.db.prepare("SELECT u.* FROM users u JOIN sessions s ON s.userId=u.id WHERE s.token=? AND s.expires>? AND u.status='approved'").get(digest(token),this.now());
  if(!u)fail(401,'Your session expired or access was revoked. Log in again.');
  if(admin&&u.role!=='admin')fail(403,'Administrator access required.');return u;
 }
 logout(token){this.db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));}
 requests(token){this.authorize(token,true);return this.db.prepare('SELECT id,email,username,status,role,retryAt,created FROM users ORDER BY created DESC').all();}
 decide(token,id,decision){
  const actor=this.authorize(token,true);if(!['approved','rejected','revoked'].includes(decision))fail(400,'Invalid decision.');
  const u=this.db.prepare('SELECT * FROM users WHERE id=?').get(Number(id));if(!u)fail(404,'Account not found.');if(u.role==='admin')fail(400,'The bootstrap administrator cannot be revoked here.');
  this.db.exec('BEGIN IMMEDIATE');try{
   this.db.prepare('UPDATE users SET status=?,retryAt=? WHERE id=?').run(decision,decision==='rejected'?this.now()+DAY:0,u.id);
   this.db.prepare('DELETE FROM sessions WHERE userId=?').run(u.id);
   this.db.prepare('INSERT INTO audit(actor,action,target,created) VALUES(?,?,?,?)').run(actor.id,decision,u.id,this.now());this.db.exec('COMMIT');
  }catch(e){this.db.exec('ROLLBACK');throw e;}
  return {ok:true};
 }
 posts(token,before=Number.MAX_SAFE_INTEGER){this.authorize(token);return this.db.prepare('SELECT p.id,p.body,p.media,p.created,u.username author FROM posts p JOIN users u ON u.id=p.author WHERE p.id<? ORDER BY p.id DESC LIMIT 50').all(Number(before)||Number.MAX_SAFE_INTEGER).map(p=>({...p,media:JSON.parse(p.media)}));}
 publish(token,p){const u=this.authorize(token,true),body=String(p.body||'').trim();if(!body||body.length>20000)fail(400,'Write an update between 1 and 20,000 characters.');const media=validMedia(p.media||[]);this.db.prepare('INSERT INTO posts(body,media,created,author) VALUES(?,?,?,?)').run(body,JSON.stringify(media),this.now(),u.id);return {ok:true};}
 close(){this.db.close();}
}
