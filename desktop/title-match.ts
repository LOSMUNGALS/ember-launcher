import {communityKey,communityTitle} from '../src/community-title';
export function lookupTitle(title:string) {
 const clean=communityTitle(title).replace(/[ ._-]+(?:Build[ ._-]*\d|MULTI\d|\d{4}\.\d).*$/i,'')
  .replace(/\s*\+\s*(?:(?:All\s+)?(?:\d+\s+)?DLCs?\b|Bonus\s+Soundtrack\b|Windows\s+7\s+Fix\b|COSTUME\s+DLC\b|Coats\s+of\s+Arms\s+DLC\b).*$/i,'')
  .replace(/\s+(?:Ultimate|Digital Deluxe|Deluxe|Definitive|Complete|GOTY|Supporter.s)\s+Edition$/i,'')
  .replace(/[\s,+]+$/,'').trim();
 // An explicit publisher-verified alias, not a fuzzy prefix match.
 const aliases:Record<string,string>={'1000 Deaths':'1000 Deaths (Thousand Deaths)','City Game Studio':'City Game Studio: Your Game Dev Adventure Begins','ABRISS':'ABRISS - build to destroy'};
 return aliases[clean]||clean;
}
export function matchSteamTitle(title:string,items:any[]) {
 const apps=(Array.isArray(items)?items:[]).filter(g=>g.type==='app'&&Number.isSafeInteger(g.id)&&g.id>0&&typeof g.name==='string');
 const key=(value:string)=>value.replace(/[™®]/g,'').normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
 const exact=apps.filter(g=>key(g.name)===key(title));
 if(exact.length===1)return exact[0];
 const normalized=apps.filter(g=>key(g.name)===key(lookupTitle(title)));
 return normalized.length===1?normalized[0]:undefined;
}
