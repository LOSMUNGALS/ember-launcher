import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
export class AnnouncementRead {
 private seen:Record<string,number>={};
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private file:string){}
 async load(){try{const data=JSON.parse(await readFile(this.file,'utf8'));if(data&&typeof data==='object'&&!Array.isArray(data))for(const [key,value] of Object.entries(data))if(Number.isSafeInteger(value)&&Number(value)>=0)this.seen[key]=Number(value);}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('Could not read announcement history; file preserved.');}}
 status(key:string,latest:number){return {latest,readThrough:this.seen[key]||0,unread:latest>(this.seen[key]||0)};}
 mark(key:string,through:number){
  if(!Number.isSafeInteger(through)||through<0)return Promise.reject(Error('Invalid announcement ID.'));
  const job=this.queue.catch(()=>{}).then(async()=>{
   const next={...this.seen,[key]:Math.max(through,this.seen[key]||0)};
   await mkdir(path.dirname(this.file),{recursive:true});await writeFile(this.file+'.tmp',JSON.stringify(next),{mode:0o600});await rename(this.file+'.tmp',this.file);this.seen=next;
  });this.queue=job;return job;
 }
}
