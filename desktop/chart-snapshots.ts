import wishlist from '../data/wishlist-snapshot.json';
import sellers from '../data/top-sellers-snapshot.json';
import resolved from '../data/wishlist-resolved.json';
import topResolved from '../data/top-sellers-resolved.json';
import {communityKey} from '../src/community-title';
import type {CatalogGame} from '../src/v2types';
// Verified against the supplied chart's SteamDB product links, not fuzzy title guesses.
const verifiedWishlist:Record<number,string>={1:'1422450',16:'5006530',44:'2956040',47:'5072600',56:'3809270',71:'1536500',74:'3281420',95:'4258290',97:'1731290'};
export function chartSnapshot(kind:'coming'|'top'):CatalogGame[] {
 const input=kind==='coming'?wishlist.games:sellers.products;
 const seen=new Set<number>();
 return input.map((row:any)=>{
  if(!Number.isInteger(row.rank)||row.rank<1||row.rank>100||seen.has(row.rank)||typeof row.name!=='string')throw Error('Invalid ranking snapshot');
  seen.add(row.rank);
  const matches=(kind==='coming'?resolved.games:topResolved.products).filter(r=>communityKey(r.name)===communityKey(row.name));
  const known=matches.length===1?matches[0]:undefined;
  const steamAppId=(kind==='coming'?verifiedWishlist[row.rank]:undefined)||known?.appId;
  return {appId:`chart-${kind}-${row.rank}`,steamAppId,chartRank:row.rank,productType:row.type.toLowerCase(),origin:steamAppId?undefined:'community' as const,
   title:row.name,cover:known?.cover||'',portrait:known?.portrait,banner:known?.cover||'',screenshots:[],
   description:`${kind==='coming'?'Most wishlisted':'Global Top Sellers'} snapshot supplied for ${wishlist.snapshot_date}.`,
   developers:[],publishers:[],genres:[],tags:[],platforms:[],comingSoon:kind==='coming',releaseDate:row.release||'',
   content:'allowed' as const,updated:wishlist.snapshot_date+'T00:00:00.000Z',discoveryList:kind,
   isFree:row.free===true,price:row.free?'Free':typeof row.price_usd==='number'?`$${row.price_usd.toFixed(2)}`:undefined,
   purchaseUrl:steamAppId?(row.type.toLowerCase()==='game'?undefined:`https://store.steampowered.com/app/${steamAppId}/`):'https://store.steampowered.com/search/?term='+encodeURIComponent(row.name)};
 }).filter(row=>row.productType!=='hardware').sort((a,b)=>a.chartRank-b.chartRank);
}
export const chartSource=(kind:'coming'|'top')=>`Supplied SteamDB ${kind==='coming'?'most wishlisted':'global top sellers'} snapshot · ${wishlist.snapshot_date} · ${chartSnapshot(kind).length} entries · console/hardware products excluded; original ranks preserved`;
