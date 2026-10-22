import type { GamePackage } from "./v2types";
export const normalizedTitle = (title: string) => title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[™®]/g, "").replace(/[^a-z0-9]+/g," ").trim();
export function packageMatches(pkg: GamePackage, appId: string | undefined, title: string) {
  if (pkg.steamAppId) return pkg.steamAppId === appId;
  const target = normalizedTitle(title), candidate = normalizedTitle(pkg.title);
  if (!target || target.length < 3) return candidate === target;
  if (candidate === target) return true;
  // Accept common release suffixes, never a numbered sequel (e.g. Portal vs Portal 2).
  if (!candidate.startsWith(target + " ")) return false;
  return /^(?:v\d|\d+\.\d|build\b|patch\b|hotfix\b|update\b|free download\b|repack\b|fitgirl\b|digital deluxe\b|deluxe edition\b|ultimate edition\b|complete edition\b|goty\b|game of the year\b|multi\d|\d{4}\b)/.test(candidate.slice(target.length+1)) || /^(?:v\s?\d|build\b)/i.test(pkg.title.slice(title.length).replace(/^[\s–—\-:()\[\]]+/,""));
}

