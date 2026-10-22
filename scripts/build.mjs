import { build } from "esbuild";
import { mkdir, copyFile, cp } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["desktop/main.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  outfile: "dist/main.cjs",
  external: ["electron", "electron-updater", "webtorrent", "fs-chunk-store"],
  target: "node22",
  sourcemap: true,
  define: { __EMBER_ACCOUNT_URL__: JSON.stringify(process.env.EMBER_ACCOUNT_URL || 'https://ember-accounts.onrender.com') },
});
await copyFile("desktop/preload.cjs", "dist/preload.cjs");
await cp('data/catalogs', 'dist/catalogs', {recursive:true});
