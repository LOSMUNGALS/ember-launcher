import {createHash} from 'node:crypto';
import {communityTitle,communityKey} from '../src/community-title';
import type {CatalogGame,PackageSource} from '../src/v2types';
export const officialPages:Record<string,{title:string;url:string;cover?:string;platforms?:('windows'|'mac')[]}>={
 bloodborne:{title:'Bloodborne',url:'https://www.playstation.com/en-us/games/bloodborne/',cover:'./bloodborne.jpg'},
 godofwariiiremastered:{title:'God of War III Remastered',url:'https://www.playstation.com/en-us/games/god-of-war-iii-remastered/',cover:'./god-of-war-iii.jpg'},
 '13sentinelsaegisrim':{title:'13 Sentinels: Aegis Rim',url:'https://www.playstation.com/en-us/games/13-sentinels-aegis-rim/',cover:'./13-sentinels.jpg'},
 '1nsane':{title:'1nsane',url:'https://www.gog.com/en/game/1nsane',cover:'https://images-1.gog-statics.com/dc3162872244a0e7b1d90e48d5026c529ca20bd7655b110c110c122eb8976b77.jpg',platforms:['windows']},
};
export function refreshOfficialArtwork(catalog:Record<string,CatalogGame>):number {
 let changed=0;
 for(const game of Object.values(catalog)){
  const key=communityKey(game.title);
  if(key!=='bloodborne'&&key!=='godofwariiiremastered')continue;
  const cover=officialPages[key].cover!;
  if(game.cover===cover&&game.portrait===cover&&game.banner===cover)continue;
  game.cover=cover;game.portrait=cover;game.banner=cover;
  game.updated=new Date().toISOString();changed++;
 }
 return changed;
}
export function communityCatalog(sources:PackageSource[]):CatalogGame[]{
 const entries=new Map<string,CatalogGame>();
 for(const source of sources.filter(s=>s.enabled))for(const pkg of source.packages){
  let title=communityTitle(pkg.title),key=communityKey(title);
  if(key.startsWith('bloodborne'))key='bloodborne';
  if(key.startsWith('godofwariiiremastered')||key.startsWith('godofwar3remastered'))key='godofwariiiremastered';
  if(!key||entries.has(key))continue;
  const official=officialPages[key];title=official?.title||title;
  entries.set(key,{appId:'feed-'+createHash('sha256').update(key).digest('hex').slice(0,20),title,origin:'community',purchaseUrl:official?.url,cover:official?.cover||'',portrait:official?.cover,banner:official?.cover||'',screenshots:[],description:'Available in your download catalogs. Store metadata has not been matched yet.',developers:[],publishers:[],genres:[],tags:[],platforms:official?(official.platforms||[]):['windows'],comingSoon:false,releaseDate:'',content:'allowed',updated:new Date().toISOString()});
 }
 return [...entries.values()].sort((a,b)=>a.title.localeCompare(b.title));
}
