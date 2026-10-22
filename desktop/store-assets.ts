/** Only accept Valve's asset path for this exact App ID. */
export function steamPortrait(id:string,raw:any):string|undefined {
 const item=raw?.response?.store_items?.find((x:any)=>String(x.appid)===id&&x.success===1);
 const assets=item?.assets;
 const file=assets?.library_capsule_2x||assets?.library_capsule;
 const format=assets?.asset_url_format;
 if(typeof file!=='string'||typeof format!=='string'||!format.startsWith(`steam/apps/${id}/`)||!format.includes('${FILENAME}'))return;
 if(!/^[\w/-]+\.(?:png|jpg|webp)$/.test(file)||file.includes('..'))return;
 const relative=format.replace('${FILENAME}',file);
 if(relative.includes('..')||/[\\#]/.test(relative))return;
 return 'https://shared.akamai.steamstatic.com/store_item_assets/'+relative;
}
