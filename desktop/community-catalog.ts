import {createHash} from 'node:crypto';
import {communityTitle,communityKey} from '../src/community-title';
import type {CatalogGame,PackageSource} from '../src/v2types';
export const officialPages:Record<string,{title:string;url:string;cover?:string}>={
 bloodborne:{title:'Bloodborne',url:'https://www.playstation.com/en-us/games/bloodborne/',cover:'./bloodborne.png'},
 godofwariiiremastered:{title:'God of War III Remastered',url:'https://www.playstation.com/en-us/games/god-of-war-iii-remastered/',cover:'./god-of-war-iii.png'},
};
export function communityCatalog(sources:PackageSource[]):CatalogGame[]{
 const entries=new Map<string,CatalogGame>();
 for(const source of sources.filter(s=>s.enabled))for(const pkg of source.packages){
  let title=communityTitle(pkg.title),key=communityKey(title);
  if(key.startsWith('bloodborne'))key='bloodborne';
  if(key.startsWith('godofwariiiremastered')||key.startsWith('godofwar3remastered'))key='godofwariiiremastered';
  if(!key||entries.has(key))continue;
  const official=officialPages[key];title=official?.title||title;
  entries.set(key,{appId:'feed-'+createHash('sha256').update(key).digest('hex').slice(0,20),title,origin:'community',purchaseUrl:official?.url,cover:official?.cover||'',banner:official?.cover||'',screenshots:[],description:'Available in your download catalogs. Store metadata has not been matched yet.',developers:[],publishers:[],genres:[],tags:[],platforms:official?[]:['windows'],comingSoon:false,releaseDate:'',content:'allowed',updated:new Date().toISOString()});
 }
 return [...entries.values()].sort((a,b)=>a.title.localeCompare(b.title));
}
