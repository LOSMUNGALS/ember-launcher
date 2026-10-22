import { build } from "esbuild";
import { mkdir, copyFile, cp } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["desktop/main.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/main.cjs",
  external: ["electron", "webtorrent", "fs-chunk-store"],
  target: "node22",
  sourcemap: true,
});
await copyFile("desktop/preload.cjs", "dist/preload.cjs");
await cp('data/catalogs', 'dist/catalogs', {recursive:true});
