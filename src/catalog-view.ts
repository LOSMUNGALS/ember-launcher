import type { CatalogGame } from './v2types';

// Feed aliases and chart rows can refer to the same Steam game.
export function catalogCandidates(loaded: CatalogGame[], catalog: Record<string, CatalogGame>, kind: 'all'|'coming', includeCached: boolean) {
 const entries=new Map<string,CatalogGame>();
 const add=(game:CatalogGame)=>entries.set(game.steamAppId||game.appId,game);
 if(includeCached&&kind!=='coming')for(const game of Object.values(catalog)){
  if(game.productType&&game.productType!=='game')continue;
  add(game);
 }
 for(const game of loaded)add(catalog[game.appId]||game);
 return [...entries.values()];
}
