import {communityKey,communityTitle} from '../src/community-title';
export function lookupTitle(title:string) {
 return communityTitle(title).replace(/[ ._-]+(?:Build[ ._-]*\d|MULTI\d|\d{4}\.\d).*$/i,'')
  .replace(/\s+(?:Ultimate|Deluxe|Definitive|Complete|GOTY)\s+Edition$/i,'').trim();
}
export function matchSteamTitle(title:string,items:any[]) {
 const apps=(Array.isArray(items)?items:[]).filter(g=>g.type==='app'&&Number.isSafeInteger(g.id)&&g.id>0&&typeof g.name==='string');
 const key=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const exact=apps.filter(g=>key(g.name)===key(title));
 if(exact.length===1)return exact[0];
 const normalized=apps.filter(g=>key(g.name)===key(lookupTitle(title)));
 return normalized.length===1?normalized[0]:undefined;
}
