import {realpath,rm,lstat} from 'node:fs/promises';
import path from 'node:path';
export async function downloadedInstallDirectory(destination:string,jobId:string,executable:string){
 if(!path.isAbsolute(destination)||!/^[0-9a-f-]{36}$/.test(jobId))throw Error('Invalid download folder.');
 const expected=path.join(destination,'Ember-download-'+jobId);
 if((await lstat(expected)).isSymbolicLink())throw Error('Refusing to uninstall a linked download folder.');
 const actual=await realpath(expected),parent=await realpath(destination),target=await realpath(executable);
 if(path.dirname(actual)!==parent||path.basename(actual)!=='Ember-download-'+jobId)throw Error('Download folder does not match its recorded destination.');
 const relative=path.relative(actual,target);
 if(!relative||relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('Game is installed outside its Ember download folder. Use the operating system uninstaller.');
 return actual;
}
export async function uninstallDownloaded(destination:string,jobId:string,executable:string){
 const directory=await downloadedInstallDirectory(destination,jobId,executable);
 await rm(directory,{recursive:true,force:false});
}
