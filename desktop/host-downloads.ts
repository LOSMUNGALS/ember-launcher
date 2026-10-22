import {lookup} from "node:dns/promises";
import {BrowserWindow,session} from 'electron';
import type {DownloadItem} from 'electron';
import {mkdir,lstat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import type {StateStore} from './state';
import type {DownloadJob} from '../src/v2types';
import {httpsUrl,publicAddress} from './http';
import {torrentDirectory} from './torrents';
export class HostDownloads {
 private windows=new Map<string,BrowserWindow>();
 private items=new Map<string,DownloadItem>();
 private closing=false;
 constructor(private store:StateStore,private changed:()=>void){}
 async open(job:DownloadJob) {
  if(this.closing) throw Error('Ember is closing. Reopen it to continue this download.');
  const existing=this.windows.get(job.id);
  if(existing&&!existing.isDestroyed()){existing.show();existing.focus();return;}
  if(this.items.has(job.id))throw Error('This host download is already active.');
  const target=torrentDirectory(job);
  await mkdir(target,{recursive:true});
  if((await lstat(target)).isSymbolicLink())throw Error('Download folder must not be a symbolic link.');
  const ses=session.fromPartition('host-'+job.id+'-'+randomUUID());
  ses.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  ses.setPermissionCheckHandler(()=>false);
  ses.webRequest.onBeforeRequest((details,cb)=>{
   try {
     const u=httpsUrl(details.url);
     void lookup(u.hostname.replace(/^\[|\]$/g,''),{all:true}).then(addresses=>cb({cancel:!addresses.length||addresses.some(a=>!publicAddress(a.address))})).catch(()=>cb({cancel:true}));
   } catch {cb({cancel:true})}
  });
  const win=new BrowserWindow({width:1100,height:800,title:'Ember · '+job.package.sourceName,autoHideMenuBar:true,webPreferences:{session:ses,sandbox:true,nodeIntegration:false,contextIsolation:true,webSecurity:true}});
  this.windows.set(job.id,win);
  const navigate=(url:string)=>{try{void win.loadURL(httpsUrl(url).href).catch(()=>{})}catch{}};
  win.webContents.setWindowOpenHandler(({url})=>{navigate(url);return {action:'deny'}});
  let selected=false;
  ses.on('will-download',(event,item)=>{
   if(this.closing||selected){event.preventDefault();return;}
   selected=true;
   const filename=path.basename(item.getFilename()).replace(/[^a-zA-Z0-9._ -]/g,'_').slice(-150)||'download.bin';
   const output=path.join(target,randomUUID()+'-'+filename);
   item.setSavePath(output);job.outputPath=output;
   this.items.set(job.id,item);job.status='downloading';job.error=undefined;job.started=new Date().toISOString();
   let previous=0,stamp=Date.now(),saved=0;
   item.on('updated',()=>{
    if(this.closing || this.items.get(job.id)!==item) return;
    try {
    const now=Date.now(),received=item.getReceivedBytes();
    job.downloaded=received;job.total=item.getTotalBytes();job.speed=(received-previous)/Math.max(.001,(now-stamp)/1000);previous=received;stamp=now;
    job.averageSpeed=job.speed;job.eta=job.speed&&job.total?(job.total-received)/job.speed:undefined;
    job.status=item.isPaused()?'paused':item.getState()==='interrupted'?'failed':'downloading';
    this.changed();if(now-saved>15000){saved=now;void this.store.save().catch(()=>{});}
    } catch { /* Electron may dispose the item during cancellation/window teardown. */ }
   });
   item.once('done',(_event,status)=>{
    this.items.delete(job.id);selected=false;job.speed=0;job.eta=undefined;
    try {job.downloaded=item.getReceivedBytes();job.total=item.getTotalBytes()||job.downloaded;} catch { /* Keep the last measured counters if native item is gone. */ }
    job.status=this.closing?'external':status==='completed'?'completed':status==='cancelled'?'canceled':'failed';job.error=status==='interrupted'?'Host transfer interrupted. Retry from the host page.':undefined;job.updated=new Date().toISOString();
    void this.store.save().then(this.changed).catch(()=>{});
   });
   void this.store.save().then(this.changed).catch(()=>{});
  });
  win.on('closed',()=>{this.windows.delete(job.id);if(!selected && !['completed','canceled','failed'].includes(job.status)){job.status='external';void this.store.save().then(this.changed).catch(()=>{});}});
  job.status='external';job.error=undefined;await this.store.save();this.changed();
  await win.loadURL(httpsUrl(job.package.url).href).catch(()=>{if(!selected && job.status!=='completed'){job.error='Could not load host page. Retry or use another source.';void this.store.save().then(this.changed);}});
 }
 async control(job:DownloadJob,action:string) {
  const item=this.items.get(job.id);
  if(action==='pause'&&item){item.pause();job.status='paused';}
  else if((action==='resume'||action==='retry')&&item&&item.canResume()){item.resume();job.status='downloading';}
  else if(action==='resume'||action==='retry'){if(item) throw Error('This transfer cannot resume. Cancel it, then retry from the host.');this.windows.get(job.id)?.close();await this.open(job);return;}
  else if(action==='cancel'){item?.cancel();job.status='canceled';this.windows.get(job.id)?.close();job.status='canceled';}
  else if(action==='remove'&&!item){this.windows.get(job.id)?.close();this.store.data.downloads=this.store.data.downloads.filter(j=>j.id!==job.id);}
  else throw Error('This host transfer cannot perform that action.');
  await this.store.save();this.changed();
 }
 async shutdown(){
  if(this.closing)return;
  this.closing=true;
  // Let Electron finish the current download notification before canceling native items.
  await new Promise<void>(resolve=>setImmediate(resolve));
  for(const [id,item] of [...this.items]) {
    const job=this.store.data.downloads.find(j=>j.id===id);
    if(job){job.status='external';job.speed=0;job.eta=undefined;}
    try{item.cancel();}catch{/* Already disposed by Electron. */}
  }
  this.items.clear();
  for(const win of [...this.windows.values()]) if(!win.isDestroyed())win.destroy();
  this.windows.clear();
  await this.store.save();
 }
}



