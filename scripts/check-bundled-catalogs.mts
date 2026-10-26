import assert from 'node:assert/strict';
import {bundledSources} from '../desktop/sources';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const directory=JSON.parse(await readFile('desktop/source-directory.json','utf8'));
const sources=await bundledSources(path.resolve('data/catalogs'));
for(let i=0;i<sources.length;i++){const source=sources[i],raw=JSON.parse(await readFile(path.join('data/catalogs',directory.sources[i].file),'utf8')),titles=new Set(source.packages.map(p=>p.title));assert.equal(raw.downloads.filter((r:any)=>!titles.has(r.title)).length,0,source.name+' has an unsupported release title');console.log(JSON.stringify({name:source.name,rows:raw.downloads.length,options:source.packages.length,releaseTitles:titles.size,rowsWithoutSupportedOptions:raw.downloads.filter((r:any)=>!titles.has(r.title)).length,snapshotOnly:!!source.localSnapshot}));}
