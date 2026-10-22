export function communityTitle(value:string) {
 return value.normalize('NFKC').replace(/[™®]/g,'').replace(/\.(?=[A-Za-z])/g,' ')
 .replace(/\s+Free Download\b.*$/i,'').replace(/\s*[\[(].*$/,'')
 .replace(/(?:[\s._–—-]+v\.?\d|[\s–—-]+(?:Build|Patch|Hotfix|Update)\s*[#\d]|[\s–—-]+REPACK\b).*$/i,'')
 .replace(/\s+\d+\.\d+(?:\.\d+)*.*$/,'')
 .replace(/\s*[:–—-]\s*(?:Digital Deluxe|Deluxe|Ultimate|Complete|Gold|Premium|GOTY)\s*(?:Edition)?\b.*$/i,'')
 .replace(/[._–—-]+$/,'').replace(/\s+/g,' ').trim();
}
export const communityKey=(value:string)=>communityTitle(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
