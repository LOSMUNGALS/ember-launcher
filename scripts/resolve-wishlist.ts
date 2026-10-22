import {readFile,writeFile} from 'node:fs/promises';
import {jsonHttps} from '../desktop/http';
import {matchSteamTitle} from '../desktop/title-match';
import {steamPortrait} from '../desktop/store-assets';
void(async()=>{
const input=JSON.parse(await readFile('data/wishlist-snapshot.json','utf8'));const result:any[]=[];let next=0;
await Promise.all(Array.from({length:3},async()=>{while(next<input.games.length){const row=input.games[next++];try{const search=await jsonHttps('https://store.steampowered.com/api/storesearch/?term='+encodeURIComponent(row.name)+'&l=english&cc=US');const m=matchSteamTitle(row.name,search.items);result.push({...row,appId:m?String(m.id):undefined,cover:m?.tiny_image});}catch(e){result.push({...row,error:String(e)});}}}));
result.sort((a,b)=>a.rank-b.rank);
const ids=result.filter(r=>r.appId).map(r=>({appid:Number(r.appId)}));
const assets=await jsonHttps('https://api.steampowered.com/IStoreBrowseService/GetItems/v1/?input_json='+encodeURIComponent(JSON.stringify({ids,context:{language:'english',country_code:'US'},data_request:{include_assets:true}})));
for(const row of result)if(row.appId)row.portrait=steamPortrait(row.appId,assets);
await writeFile('data/wishlist-resolved.json',JSON.stringify({...input,games:result},null,2));
console.log(JSON.stringify({total:result.length,matched:ids.length,portraits:result.filter(r=>r.portrait).length,unmatched:result.filter(r=>!r.appId).map(r=>({rank:r.rank,name:r.name,error:r.error}))}));
})();
