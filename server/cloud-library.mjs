export function cloudEntries(value){
 if(!Array.isArray(value)||value.length>2000)throw Error('Use at most 2,000 library entries.');
 const keys=new Set();return value.map(g=>{
 if(!g||typeof g.key!=='string'||! /^[\w-]{1,220}$/.test(g.key)||keys.has(g.key)||typeof g.name!=='string'||!g.name.trim()||g.name.length>200)throw Error('Invalid library entry.');keys.add(g.key);
 if(!['backlog','playing','finished'].includes(g.playStatus)||!Array.isArray(g.collections)||g.collections.length>20||g.collections.some(c=>typeof c!=='string'||!c.trim()||c.length>50))throw Error('Invalid library preferences.');
 for(const field of ['saved','favorite','hidden'])if(typeof g[field]!=='boolean')throw Error('Invalid library preference.');
 for(const field of ['steamId','catalogId'])if(g[field]!==undefined&&(typeof g[field]!=='string'||! /^[\w-]{1,200}$/.test(g[field])))throw Error('Invalid catalog ID.');
 return {key:g.key,name:g.name.trim(),steamId:g.steamId,catalogId:g.catalogId,saved:g.saved,favorite:g.favorite,hidden:g.hidden,collections:[...new Set(g.collections)],playStatus:g.playStatus};});
}
