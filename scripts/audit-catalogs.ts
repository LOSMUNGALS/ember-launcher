import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {parseSourceFeed} from '../desktop/sources';
import directory from '../desktop/source-directory.json';
// A candidate grouping, not authoritative identity: feeds lack shared game IDs.
export function titleKey(title:string) {
 return title.normalize('NFKC').toLowerCase().replace(/[™®]/g,'')
  .replace(/\.(?=[a-z])/g,' ')
  .replace(/\s+free download\b.*$/i,'')
  .replace(/[\[(].*$/,'')
  .replace(/(?:[\s._–—-]+v?\d+\.\d|[\s–—-]+build\s*\d|[\s–—-]+repack\b).*$/i,'')
  .replace(/\s*[:–—-]?\s*(?:digital deluxe|deluxe|ultimate|complete|definitive|standard|enhanced|game of the year|goty|gold|premium|collector.?s)\s*(?:edition)?\b.*$/i,'')
  .replace(/[^\p{L}\p{N}]+/gu,' ').trim();
}
async function main(){
 const exact=new Set<string>(), groups=new Map<string,{title:string;source:string}[]>(), sources=[];
 for(const entry of directory.sources){
  const raw=JSON.parse((await readFile(path.join('data/catalogs',entry.file),'utf8')).replace(/^\uFEFF/,''));
  const parsed=parseSourceFeed(raw);
  for(const row of raw.downloads){exact.add(row.title); const key=titleKey(row.title)||row.title; const group=groups.get(key)||[];group.push({title:row.title,source:raw.name});groups.set(key,group);}
  sources.push({name:raw.name,records:raw.downloads.length,acceptedLinks:parsed.packages.length,torrents:parsed.packages.filter(p=>p.transport==='torrent').length,hosts:parsed.packages.filter(p=>p.transport==='host').length});
 }
 const report={sources,totalRecords:sources.reduce((n,s)=>n+s.records,0),exactDistinctReleaseTitles:exact.size,estimatedGameTitleGroups:groups.size,note:'Exact distinct release-title count is reproducible. Estimated groups strip release/version/edition text; not an exact unique-game count because catalogs lack shared game identifiers.'};
 await mkdir('artifacts',{recursive:true});
 await writeFile('artifacts/catalog-audit.json',JSON.stringify(report,null,2));
 await writeFile('artifacts/catalog-title-groups.json',JSON.stringify(Object.fromEntries([...groups].sort()),null,2));
 console.log(JSON.stringify(report,null,2));
}
void main();
