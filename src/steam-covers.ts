/** Steam library capsules are portrait art, unlike the store API's header_image. */
export function steamCoverSources(
  appId: string | undefined,
  cached?: string,
): string[] {
  const sources = cached ? [cached] : [];
  if (appId && /^\d{1,12}$/.test(appId)) {
    const base = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900`;
    sources.push(
      base + ".jpg",
      base + ".png",
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_capsule.jpg`,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/library_capsule.png`,
      `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`,
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg`,
    );
  }
  return [...new Set(sources)];
}
