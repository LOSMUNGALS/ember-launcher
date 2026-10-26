import {execFileSync} from 'node:child_process';
import { build } from "esbuild";
import { mkdir, copyFile, cp, writeFile, readFile } from "node:fs/promises";
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

const packageInfo=JSON.parse(await readFile('package.json','utf8'));
let sourceCommit=null,sourceDirty=true;
try{sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();sourceDirty=!!execFileSync('git',['status','--porcelain','--untracked-files=normal'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();}catch{/* Source archives can still build; verified releases require a clean Git checkout. */}
await writeFile('dist/build-info.json',JSON.stringify({version:packageInfo.version,sourceCommit,sourceDirty,builtAt:new Date().toISOString()},null,2)+'\n');
