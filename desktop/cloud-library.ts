import type {Game} from '../src/types';
export type CloudGame={key:string;name:string;catalogId?:string;steamId?:string;saved:boolean;favorite:boolean;hidden:boolean;collections:string[];playStatus:'backlog'|'playing'|'finished'};
export function cloudKey(g:Pick<Game,'steamId'|'catalogId'|'id'>){return g.steamId?'steam-'+g.steamId:g.catalogId?(/^\d+$/.test(g.catalogId)?'steam-'+g.catalogId:'catalog-'+g.catalogId):'local-'+g.id;}
export function cloudGames(games:Game[]):CloudGame[]{return games.filter(g=>g.saved||g.favorite||g.hidden||g.collections?.length||g.playStatus).map(g=>({key:cloudKey(g),name:g.name,catalogId:g.catalogId,steamId:g.steamId,saved:!!g.saved,favorite:!!g.favorite,hidden:!!g.hidden,collections:g.collections||[],playStatus:g.playStatus||'backlog'}));}
export function restoreCloud(games:Game[],entries:CloudGame[]){
 for(const entry of entries){let game=games.find(g=>cloudKey(g)===entry.key);if(!game){game={id:'cloud-'+Buffer.from(entry.key).toString('hex'),name:entry.name,executable:'',args:[],store:entry.steamId?'steam':'local',steamId:entry.steamId,catalogId:entry.catalogId,description:'',platform:'native',seconds:0,added:new Date().toISOString(),installed:false};games.push(game)}Object.assign(game,{saved:entry.saved,favorite:entry.favorite,hidden:entry.hidden,collections:entry.collections,playStatus:entry.playStatus});}
}
