import {readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {communityKey} from '../src/community-title';
export const runnableName=(name:string)=>/\.exe$/i.test(name)&&!/(?:^|[-_. ])(?:setup|install|unins\w*|crash\w*|report\w*|redist|dxsetup|vcredist|unitycrashhandler\w*|cef\w*|helper)(?:[-_. ]|$)/i.test(name);
export async function installationRecords():Promise<{name:string;directory:string}[]> {
 if(process.platform!=='win32')return [];
 const script="$ErrorActionPreference='SilentlyContinue'; @(Get-ItemProperty 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*','HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' | Where-Object { $_.DisplayName -and $_.InstallLocation } | Select-Object @{n='name';e={$_.DisplayName}},@{n='directory';e={$_.InstallLocation}}) | ConvertTo-Json -Compress";
 try {const {stdout}=await promisify(execFile)('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:10000,maxBuffer:2*1024*1024});const rows=JSON.parse(stdout);return (Array.isArray(rows)?rows:rows?[rows]:[]).filter(r=>typeof r.name==='string'&&typeof r.directory==='string');}catch{return [];}
}
export async function detectedExecutables(roots:string[],title:string):Promise<string[]> {
 const found:string[]=[];let visited=0;
 const walk=async(dir:string,depth:number)=>{
  if(depth>5||visited>4000)return;
  const entries=await readdir(dir,{withFileTypes:true}).catch(()=>[]);
  for(const entry of entries){if(++visited>4000)break;if(entry.isSymbolicLink())continue;const file=path.join(dir,entry.name);
   if(entry.isDirectory()&&!/^(?:_?redist|directx|support|installer|engine|__installer)$/i.test(entry.name))await walk(file,depth+1);
   else if(entry.isFile()&&runnableName(entry.name))found.push(file);
  }
 };
 for(const root of [...new Set(roots.filter(path.isAbsolute))])await walk(root,0);
 const key=communityKey(title);
 const exact=found.filter(file=>communityKey(path.basename(file,'.exe').replace(/-Win64-Shipping$/i,''))===key);
 return [...new Set(exact.length?exact:found)];
}
export async function executableStamp(file:string){const s=await stat(file);return `${s.size}:${s.mtimeMs}`;}
