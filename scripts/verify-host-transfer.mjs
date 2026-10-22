import {build} from 'esbuild';
import {spawn} from 'node:child_process';
import electron from 'electron';
await build({entryPoints:['scripts/host-transfer-fixture.ts'],outfile:'.test-data/host-transfer.mjs',bundle:true,platform:'node',format:'esm',external:['electron','webtorrent','fs-chunk-store'],target:'node22'});
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(electron,['.test-data/host-transfer.mjs'],{env,stdio:'inherit',windowsHide:true});
child.on('exit',(code,signal)=>process.exitCode=signal ? 1 : code ?? 1);
