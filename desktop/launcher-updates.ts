import type {LauncherUpdateState} from '../src/launcher-update-types';
import {plainText} from './steam-dashboard';

export interface UpdaterDriver {
 autoDownload:boolean;autoInstallOnAppQuit:boolean;autoRunAppAfterInstall:boolean;
 allowPrerelease:boolean;allowDowngrade:boolean;disableWebInstaller:boolean;
 on(event:string,listener:(value:any)=>void):unknown;
 checkForUpdates():Promise<unknown>;
 downloadUpdate():Promise<string[]>;
 quitAndInstall(silent:boolean,runAfter:boolean):void;
}
export class LauncherUpdates {
 private state:LauncherUpdateState;
 private checking?:Promise<LauncherUpdateState>;
 private installing?:Promise<void>;
 private originalRelease?:NonNullable<LauncherUpdateState['release']>;
 private beforeTest?:LauncherUpdateState;
 constructor(private driver:UpdaterDriver|undefined,currentVersion:string,private changed:()=>void,private lifecycle:{prepare:()=>Promise<void>;finish:()=>Promise<void>;recover:()=>void;testRefresh?:()=>Promise<void>},reason?:string){
  this.state={currentVersion,supported:!!driver,phase:driver?'idle':'unsupported',reason};
  if(!driver)return;
  driver.autoDownload=false;driver.autoInstallOnAppQuit=false;driver.autoRunAppAfterInstall=true;
  driver.allowPrerelease=false;driver.allowDowngrade=false;driver.disableWebInstaller=true;
  driver.on('update-available',info=>{
   const notes=Array.isArray(info.releaseNotes)?info.releaseNotes.map((n:any)=>n.note||'').join('\n\n'):String(info.releaseNotes||'');
   this.originalRelease={version:String(info.version),title:plainText(String(info.releaseName||'New games, new features, and bugs squashed.')).slice(0,200),notes:plainText(notes).slice(0,20000)};
   this.set({phase:'available',release:this.originalRelease,error:undefined,percent:undefined});
  });
  driver.on('update-not-available',()=>this.set({phase:'idle',release:undefined,error:undefined,percent:undefined}));
  driver.on('download-progress',p=>this.set({percent:Math.min(100,Math.max(0,Number(p.percent)||0))}));
  driver.on('update-downloaded',()=>this.set({phase:'downloaded',percent:100}));
  driver.on('error',e=>{if(this.state.phase==='installing')this.lifecycle.recover();this.set({phase:'error',error:String(e.message||e).slice(0,1000)});});
 }
 status(){return structuredClone(this.state);}
 previewTest(){
  if(this.state.testOnly)return this.status();
  if(this.installing||this.checking||this.state.release)throw Error('Finish the current launcher update or update check before starting a test.');
  if(!this.lifecycle.testRefresh)throw Error('Local update testing is not available.');
  this.beforeTest=this.status();
  this.set({phase:'available',testOnly:true,error:undefined,release:{version:this.state.currentVersion,title:'Test update — refresh Ember',notes:'# Local update test\nThis is a **refresh-only test** of the update button and dialog.\n- No new version is installed.\n- No application or game files are replaced.\n- Your library and account stay the same.\n\nClick **Update Ember** to refresh the launcher. The update button will disappear afterward.'}});
  return this.status();
 }
 describe(release:{version:string;title:string;body:string}|null,expectedVersion=this.state.release?.version){
  if(this.state.testOnly||!this.state.release||this.state.release.version!==expectedVersion||(release&&release.version!==expectedVersion))return;
  const next=release?{version:release.version,title:release.title,notes:release.body}:this.originalRelease;
  if(!next)return;
  if(JSON.stringify(next)!==JSON.stringify(this.state.release))this.set({release:next});
 }
 private set(value:Partial<LauncherUpdateState>){this.state={...this.state,...value};this.changed();}
 check():Promise<LauncherUpdateState>{
  if(!this.driver||this.installing||this.state.testOnly)return Promise.resolve(this.status());
  if(this.checking)return this.checking;
  this.set({phase:'checking',error:undefined});
  this.checking=this.driver.checkForUpdates().then(()=>this.status()).catch(e=>{this.set({phase:'error',error:String(e.message||e).slice(0,1000)});return this.status();}).finally(()=>{this.checking=undefined;});
  return this.checking;
 }
 install():Promise<void>{
  if(this.installing)return this.installing;
  if((!this.driver&&!this.state.testOnly)||!this.state.release)return Promise.reject(Error(this.state.reason||'No launcher update is available.'));
  this.installing=(async()=>{
   try{
    await this.lifecycle.prepare();
    if(this.state.testOnly){
      this.set({phase:'installing'});await this.lifecycle.testRefresh!();
      const previous=this.beforeTest!;this.beforeTest=undefined;
      this.set({...previous,testOnly:false,release:previous.release,error:undefined,percent:undefined});return;
    }
    this.set({phase:'downloading',percent:0,error:undefined});
    const files=await this.driver!.downloadUpdate();
    if(!files.length)throw Error('The update download did not produce an installer.');
    // The updater verifies the downloaded installer before this handoff.
    await this.lifecycle.finish();
    this.set({phase:'installing'});
    this.driver!.quitAndInstall(true,true);
   }catch(e){this.lifecycle.recover();this.set({phase:'error',error:String((e as Error).message||e).slice(0,1000)});throw e;}
  })().finally(()=>{this.installing=undefined;});
  return this.installing;
 }
}
