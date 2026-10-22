export function bannerColor(bitmap: Uint8Array): string {
  const buckets = new Map<
    string,
    { weight: number; r: number; g: number; b: number }
  >();
  for (let i = 0; i + 3 < bitmap.length; i += 4) {
    const [b, g, r, a] = bitmap.subarray(i, i + 4);
    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    if (a < 200 || max < 25 || min > 220) continue;
    const key = [r, g, b].map((x) => Math.floor(x / 48)).join(",");
    const weight = 1 + (max - min) / 80;
    const v = buckets.get(key) || { weight: 0, r: 0, g: 0, b: 0 };
    v.weight += weight;
    v.r += r * weight;
    v.g += g * weight;
    v.b += b * weight;
    buckets.set(key, v);
  }
  const best = [...buckets.values()].sort((a, b) => b.weight - a.weight)[0];
  if (!best) return "#263338";
  const rgb = [best.r, best.g, best.b].map((v) => v / best.weight);
  const scale = Math.min(0.72, 100 / Math.max(...rgb));
  return (
    "#" +
    rgb
      .map((v) =>
        Math.round(v * scale)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
