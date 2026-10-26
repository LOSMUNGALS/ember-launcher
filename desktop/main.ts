import {SaveVersions} from './save-versions';
import {displayZoom,changeZoom} from './display-zoom';
import {diagnosticReport} from './diagnostics';
import {cloudGames,restoreCloud,cloudKey} from './cloud-library';
import { HostDownloads } from "./host-downloads";
import {AccountClient} from './accounts';
import {LauncherUpdates} from './launcher-updates';
import {updaterDriver} from './updater-module';
import {AnnouncementRead} from './announcement-read';
import {downloadedInstallDirectory,uninstallDownloaded} from './download-uninstall';
import {detectedExecutables,installationRecords,executableStamp} from './detect-install';
import {communityKey,communityTitle} from '../src/community-title';
import {refreshOfficialArtwork} from './community-catalog';
import { packageMatches } from "../src/package-matching";
import { torrentDirectory } from "./torrents";
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  session,
  protocol,
  net,
  nativeImage,
  safeStorage,
  screen,
  Notification,
  Tray,
  Menu,
} from "electron";
import { pathToFileURL } from "node:url";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { launchResult, STARTUP_GRACE_MS } from './launch-result';
import {launchHealth} from './launch-health';
import {folderInventory,verifiedFolderCopy,managedMoveSource,retargetMoveMarker} from './storage';
import { mkdir, readFile, writeFile, rm, stat, realpath } from "node:fs/promises";
import { LibraryStore, validateGame } from "./library";
import { StateStore } from "./state";
import { CatalogService, appId, UnavailableGameError } from "./catalog";
import { ownedGames } from "./ownership";
import { httpsUrl } from "./http";
import { loadSource, bundledSources, sourceKey, importSourceJson, refreshSource } from "./sources";
import { DownloadManager } from "./downloads";
import { extractZip, nativePackage, uninstallManaged } from "./installations";
import { launchPlan, checkTarget, windowsExecutable } from "./platform";
import { nativeMacTarget } from "./mac";
import { scanSteam } from "./steam";
import { artworkFile, importSteamArtwork, bannerColor } from "./artwork";
import { isPlayableEntry } from "./steam-types";
import {
  steamAccounts,
  readLocalDashboard,
  publicDashboard,
  onlineAchievements,
} from "./steam-dashboard";
import type { Game } from "../src/types";
import type { V2Action, Preferences } from "../src/v2types";
protocol.registerSchemesAsPrivileged([
  { scheme: "ember-art", privileges: { standard: true, secure: true, corsEnabled: true } },
]);
if (process.env.EMBER_DATA_DIR)
  app.setPath("userData", path.resolve(process.env.EMBER_DATA_DIR));
let win: BrowserWindow, downloads: DownloadManager, hostDownloads: HostDownloads;
let quitting = false;
let tray: Tray | undefined;
const running = new Map<string, number>();
let observeChanges=()=>{};
const changed = () => {
  observeChanges();
  if (win && !win.isDestroyed() && !win.webContents.isDestroyed()) win.webContents.send("changed");
};
if (!app.requestSingleInstanceLock()) app.quit();
else
  void app
    .whenReady()
    .then(async () => {
      const root = app.getPath("userData"),
        art = path.join(root, "artwork");
      const library = new LibraryStore(path.join(root, "library.json")),
        state = new StateStore(path.join(root, "ember2.json"));
      await library.load();
      await state.load();
      if(refreshOfficialArtwork(state.data.catalog))await state.save();
      const accounts = new AccountClient(root,{available:()=>safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||safeStorage.getSelectedStorageBackend()!=='basic_text'),encrypt:value=>safeStorage.encryptString(value),decrypt:value=>safeStorage.decryptString(value)});
      await accounts.load();
      const announcementRead=new AnnouncementRead(path.join(root,'announcement-read.json'));
      await announcementRead.load();
      if ((state.data.defaultSourcesVersion || 0) < 3 && !process.env.EMBER_DATA_DIR) {
        const supplied = await bundledSources(path.join(__dirname,'catalogs'));
        const keys = new Set(supplied.map(s=>sourceKey(s.url)));
        state.data.sources = [...state.data.sources.filter(s=>!s.id.startsWith('default-') && !keys.has(sourceKey(s.url))), ...supplied];
        state.data.defaultSourcesVersion = 3;
        await state.save();
      }
      await library.mutate((d) => {
        for (const g of d.games) {
          if (["epic", "gog"].includes(g.store)) g.store = "local";
          g.installed ??= Boolean(g.executable);
          g.owned =
            g.store === "steam"
              ? state.data.ownership.ids.includes(g.steamId!)
              : true;
        }
        d.settings = { wine: "", prefix: "", graphics: "default" };
        d.games = d.games.filter(isPlayableEntry);
      });
      const catalog = new CatalogService(state);
      // Index every enabled local catalog before exposing the launcher UI.
      // Store metadata and network availability must not determine inclusion.
      catalog.community();
      let busy = false,
        updating = false,
        message = "",
        scanning = false,
        installing = false;
      const saveVersions=new SaveVersions(path.join(root,'save-backups'));
      const storageLocks=new Set<string>();
      const report = (e: unknown) => {
        message = String(e);
        changed();
      };
      downloads = new DownloadManager(
        path.join(root, "packages"),
        state,
        changed,
      );
      await downloads.initialize();
      const notified=new Map(state.data.downloads.map(j=>[j.id,j.status]));
      observeChanges=()=>{for(const job of state.data.downloads){const old=notified.get(job.id);notified.set(job.id,job.status);if(old&&old!==job.status&&accounts.user&&Notification.isSupported()&&((job.status==='completed'&&state.data.preferences.notifyDownloads)||(job.status==='failed'&&state.data.preferences.notifyErrors))){try{new Notification({title:'Ember',body:job.status==='completed'?'A download has finished. Open Downloads to install it.':'A download needs attention. Open Downloads for details.'}).show()}catch{}}}};

      hostDownloads = new HostDownloads(state, changed);
      const updaterSupported=app.isPackaged&&process.platform==='win32'&&!process.env.PORTABLE_EXECUTABLE_FILE;
      const updateDriver=updaterSupported?updaterDriver(await import('electron-updater')):undefined;
      const launcherUpdates=new LauncherUpdates(updateDriver,app.getVersion(),changed,{
        prepare:async()=>{
          if(running.size||installing)throw Error('Close running games and finish game installation before updating Ember.');
          updating=true;
          await downloads.pauseForUpdate();await hostDownloads.pauseForUpdate();await state.save();
        },
        finish:async()=>{
          await hostDownloads.shutdown();await library.mutate(()=>{});await state.save();
          quitting=true;
        },
        recover:()=>{updating=false;quitting=false;hostDownloads.recoverAfterUpdate();},
        testRefresh:async()=>{
          await library.mutate(()=>{});await state.save();updating=false;
          setImmediate(()=>{if(win&&!win.isDestroyed())win.webContents.reloadIgnoringCache();});
        },
      },updaterSupported?undefined:'Automatic updates require the installed Windows version of Ember. Source and portable builds are updated manually.');
      if(!app.isPackaged&&process.env.EMBER_PREVIEW_UPDATE==='1')launcherUpdates.previewTest();
      const describeRelease=async()=>{
        const status=launcherUpdates.status(),release=status.release;if(status.testOnly||!release||!accounts.user)return;
        try{const result=await accounts.request('launcher-release?version='+encodeURIComponent(release.version));launcherUpdates.describe(result.release,release.version);}catch{/* GitHub notes remain available when the account service is offline. */}
      };
      state.data.visits++;
      await state.save();
      protocol.handle("ember-art", async (request) => {
        const bundled=/^ember-art:\/\/bundled\/(bloodborne\.(?:png|jpg)|god-of-war-iii\.(?:png|jpg)|13-sentinels\.jpg)$/.exec(request.url);
        const file = bundled?path.join(__dirname,'ui',bundled[1]):artworkFile(request.url, art);
        if (!file || request.method !== "GET")
          return new Response("Not found", { status: 404 });
        try {
          const response=await net.fetch(pathToFileURL(file).href);
          const headers=new Headers(response.headers);
          headers.set('Access-Control-Allow-Origin','*');
          return new Response(response.body,{status:response.status,headers});
        } catch {
          return new Response("Not found", { status: 404 });
        }
      });
      session.defaultSession.setPermissionRequestHandler((_w, _p, cb) =>
        cb(false),
      );
      session.defaultSession.setPermissionCheckHandler(() => false);
      const defaultSteam =
        process.platform === "win32"
          ? path.join(
              process.env["ProgramFiles(x86)"] || "C:/Program Files (x86)",
              "Steam",
            )
          : path.join(os.homedir(), "Library/Application Support/Steam");
      const find = (id: string) => {
        const g = library.data.games.find((g) => g.id === id);
        if (!g) throw Error("Game not found.");
        return g;
      };
      const nativeTarget = async (file: string) => {
        await checkTarget(file);
        if (process.platform === "darwin") {
          if (!(await nativeMacTarget(file)))
            throw Error(
              "Choose a native macOS application. Windows games are not supported.",
            );
        } else if (
          process.platform !== "win32" ||
          !/\.exe$/i.test(file) ||
          (await stat(file)).isDirectory() ||
          !(await windowsExecutable(file))
        )
          throw Error("Choose a Windows .exe file.");
      };
      const confirm = async (title: string, detail: string) =>
        (
          await dialog.showMessageBox(win, {
            type: "question",
            message: title,
            detail,
            buttons: ["Cancel", "Continue"],
            defaultId: 0,
            cancelId: 0,
          })
        ).response === 1;
      async function scan() {
        if (scanning) return;
        scanning = true;
        try {
          const all = new Map<string, Game>();
          const roots = library.data.steamRoots?.length
            ? library.data.steamRoots
            : [defaultSteam];
          let read = 0;
          for (const folder of roots) {
            try {
              const games = await scanSteam(folder);
              read++;
              await importSteamArtwork(folder, games, art, (b) =>
                bannerColor(
                  nativeImage
                    .createFromBuffer(b)
                    .resize({ width: 32, height: 32 })
                    .toBitmap(),
                ),
              );
              for (const g of games) all.set(g.id, g);
            } catch (e) {
              if (roots.length === 1) throw e;
            }
          }
          if (!read) return;
          await library.mutate((d) => {
            for (const g of d.games.filter((g) => g.store === "steam")) {
              g.installed = all.has(g.id);
              if (!g.installed) g.executable = "";
            }
            for (const fresh of all.values()) {
              const old = d.games.find((g) => g.id === fresh.id);
              if (old)
                Object.assign(old, {
                  ...fresh,
                  seconds: old.seconds,
                  added: old.added,
                  steam: old.steam,
                  saved: old.saved,
                  owned: state.data.ownership.ids.includes(fresh.steamId!),
                });
              else
                d.games.push({
                  ...fresh,
                  owned: state.data.ownership.ids.includes(fresh.steamId!),
                });
            }
          });
          changed();
        } finally {
          scanning = false;
        }
      }
      async function sync(force = false) {
        if (busy) return;
        busy = true;
        message = "Refreshing Steam playtime, achievements and metadata…";
        changed();
        try {
          // Steam caches artwork for owned games even when their files are not installed.
          // Modern capsules can live beneath hashed folders and have no fixed CDN URL.
          const artworkGames = structuredClone(
            library.data.games.filter((g) => g.steamId),
          );
          for (const folder of new Set([
            ...(library.data.steamRoots || []),
            defaultSteam,
          ])) {
            await importSteamArtwork(folder, artworkGames, art, (b) =>
              bannerColor(
                nativeImage
                  .createFromBuffer(b)
                  .resize({ width: 32, height: 32 })
                  .toBitmap(),
              ),
            );
          }
          await library.mutate((d) => {
            for (const artwork of artworkGames) {
              const target = d.games.find((g) => g.id === artwork.id);
              if (!target) continue;
              for (const key of [
                "artwork",
                "hero",
                "logo",
                "themeColor",
              ] as const)
                if (artwork[key]) target[key] = artwork[key];
            }
          });
          changed();
          const games = library.data.games.filter(
            (g) => g.steamId,
          );
          const roots = library.data.steamRoots?.length
            ? library.data.steamRoots
            : [defaultSteam];
          const local = new Map<string, Partial<NonNullable<Game["steam"]>>>();
          for (const folder of roots) {
            const accounts = await steamAccounts(folder);
            const chosen = state.data.ownership.steamId
              ? String(
                  BigInt(state.data.ownership.steamId) - 76561197960265728n,
                )
              : accounts.length === 1
                ? accounts[0]
                : undefined;
            if (chosen && accounts.includes(chosen)) {
              for (const [id, info] of await readLocalDashboard(
                folder,
                chosen,
                games.map((g) => g.steamId!),
              ))
                local.set(id, info);
            }
          }
          let index = 0;
          await Promise.all(
            Array.from({ length: 3 }, async () => {
              for (;;) {
                const g = games[index++];
                if (!g) break;
                const previous = { ...g.steam, ...local.get(g.steamId!) };
                const stats = await publicDashboard(
                  g.steamId!,
                  previous,
                  force,
                );
                await gameDetail(g.steamId!, force).catch(() => undefined);
                await library.mutate((d) => {
                  const found = d.games.find((x) => x.id === g.id);
                  if (found) {
                    const online = found.steam;
                    found.steam = stats;
                    if (online?.achievementUpdated) for (const key of ["achievements", "achievementTotal", "achievementUnlocked", "achievementUpdated", "achievementMessage"] as const) (found.steam as any)[key] = online[key];
                  }
                });
                changed();
              }
            }),
          );
          message =
            "Steam refresh complete. Unavailable fields retain their last cached values.";
        } finally {
          busy = false;
          changed();
        }
      }
      async function connect(steamId: string, key: string) {
        const owned = await ownedGames(steamId, key);
        if (!safeStorage.isEncryptionAvailable())
          throw Error(
            "OS credential encryption is unavailable. API key was not stored.",
          );
        await writeFile(
          path.join(root, "steam-key.bin"),
          safeStorage.encryptString(key),
          { mode: 0o600 },
        );
        state.data.ownership = {
          steamId,
          updated: new Date().toISOString(),
          ids: owned.map((g) => g.id),
        };
        await state.save();
        await library.mutate((d) => {
          for (const g of d.games) if (g.store === "steam") g.owned = false;
          for (const row of owned) {
            let g = d.games.find((g) => g.steamId === row.id);
            if (!g) {
              g = {
                id: "steam-" + row.id,
                steamId: row.id,
                name: row.name,
                executable: "",
                args: [],
                store: "steam",
                platform: "native",
                seconds: 0,
                description: "",
                added: new Date().toISOString(),
                installed: false,
              };
              d.games.push(g);
            }
            g.owned = true;
            g.steam = {
              ...(g.steam?.accountId === String(BigInt(steamId) - 76561197960265728n) ? g.steam : {}),
              playtimeMinutes: row.minutes,
              lastPlayed: row.lastPlayed,
              accountId: String(BigInt(steamId) - 76561197960265728n),
            };
          }
        });
        changed();
      }
      async function steamNative(id: string, installed?: Game) {
        const meta = await catalog.detail(id);
        if (!nativePackage(meta.platforms, process.platform))
          throw Error(
            process.platform === "darwin"
              ? "This game has no confirmed native Mac version. Windows compatibility layers are not supported."
              : "No native Windows version is listed.",
          );
        if (
          process.platform === "darwin" &&
          installed &&
          !(await nativeMacTarget(installed.executable))
        )
          throw Error(
            "No native Mac executable was found in this installation. Install the Mac version in Steam first.",
          );
      }
      async function add(file?: string, name?: string, steamId?: string, catalogId?:string) {
        if (!file) {
          const result = await dialog.showOpenDialog(win, {
            title: "Choose a native game",
            properties: ["openFile"],
            filters:
              process.platform === "win32"
                ? [{ name: "Windows game", extensions: ["exe"] }]
                : undefined,
          });
          if (result.canceled) return;
          file = result.filePaths[0];
        }
        await nativeTarget(file);
        const existing = library.data.games.find(
          (g) => g.executable === file || (steamId && g.steamId === steamId) || (catalogId&&g.catalogId===catalogId),
        );
        if (existing) {
          await library.mutate((d) => {
            const target = d.games.find((g) => g.id === existing.id)!;
            Object.assign(target, {
              executable: file,
              installed: true,
              platform: "native",
              store: "local",
            });
          });
          changed();
          return find(existing.id);
        }
        const g: Game = {
          id: steamId ? "steam-" + steamId : randomUUID(),
          steamId,
          catalogId,
          name: name || path.basename(file, path.extname(file)),
          executable: file,
          args: [],
          store: "local",
          platform: "native",
          seconds: 0,
          description: "",
          added: new Date().toISOString(),
          installed: true,
          owned: true,
        };
        await library.mutate((d) => d.games.push(g));
        changed();
        return g;
      }
      async function launch(id: string) {
        if(storageLocks.has(id))throw Error('Wait for this game to finish moving.');
        await accounts.require(true);
        if(updating)throw Error('Wait for the launcher update to finish.');
        const g = find(id);
        if (!g.installed) throw Error("Install this game first.");
        if (running.has(id)) throw Error("This game is already running.");
        if (g.store === "steam") {
          await steamNative(g.steamId!, g);
          await shell.openExternal("steam://rungameid/" + appId(g.steamId!));
          await library.mutate((d) => {
            const found = d.games.find((x) => x.id === id);
            if (found) found.lastLaunchRequested = new Date().toISOString();
          });
          message =
            "Launch requested from Steam. Steam records playtime; Ember does not infer a running session from this request.";
          changed();
          return;
        }
        await nativeTarget(g.executable);
        const plan = launchPlan(g, library.data.settings, process.platform);
        await new Promise<void>((resolve, reject) => {
          const child = spawn(plan.command, plan.args, {
            cwd: path.dirname(g.executable),
            shell: false,
            stdio: "ignore",
          });
          let startupTimer: ReturnType<typeof setTimeout> | undefined;
          child.once("error", (error) => {
            clearTimeout(startupTimer);
            running.delete(id);
            reject(new Error(`Could not start ${g.name}: ${error.message}`));
          });
          child.once("spawn", () => {
            running.set(id, Date.now());
            startupTimer = setTimeout(() => {
              if (running.has(id)) void library.mutate(d=>{const g=d.games.find(g=>g.id===id);if(g)g.lastLaunchRequested=new Date().toISOString();}).then(changed).catch(report);
            }, STARTUP_GRACE_MS);
            changed();
            resolve();
          });
          child.once("close", (code, signal) => {
            clearTimeout(startupTimer);
            const start = running.get(id);
            running.delete(id);
            const result = launchResult(g.name, start ? Date.now() - start : 0, code, signal);
            if (start && result.recordPlaytime)
              void library
                .mutate((d) => {
                  const found = d.games.find((x) => x.id === id);
                  if (found) {
                    found.seconds += Math.max(
                      0,
                      Math.floor((Date.now() - start) / 1000),
                    );
                    found.lastPlayed = new Date().toISOString();
                  }
                })
                .then(changed)
                .catch(report);
            if (start && result.message){report(result.message);void library.mutate(d=>{const game=d.games.find(g=>g.id===id);if(game)game.lastLaunchError=result.message}).then(changed).catch(report);}
            changed();
          });
        });
      }
      async function installPackage(id: string) {
        if (installing) throw Error("Another installer is active.");
        const job = state.data.downloads.find((j) => j.id === id);
        if (!job) throw Error("Download not found.");
        if (job.installedGameId)
          throw Error("This package is already registered.");
        if (!nativePackage(job.package.platforms, process.platform))
          throw Error("Package is not native to this platform.");
        await downloads.verify(job);
        if (
          !(await confirm(
            "Install " + job.package.title + "?",
            `Source: ${job.package.sourceName}\nLicense: ${job.package.authorization.license}\nDistribution: ${job.package.authorization.distribution}\n${job.package.authorization.url}\nSHA-256 verified. Only install software from publishers you trust.`,
          ))
        )
          return;
        installing = true;
        try {
          if (job.package.install.method === "zip") {
            job.status = "extracting";
            job.installationState='extracting';job.installationError=undefined;
            await state.save();
            changed();
            const installed = await extractZip(
              downloads.file(job),
              job.destination,
              job.package.install.executable!,
              nativeTarget,
            );
            job.status = "completed";
            const game = await add(
              installed.executable,
              job.package.title,
              job.package.steamAppId,
            );
            if (game) {
              await library.mutate((d) => {
                const g = d.games.find((g) => g.id === game.id)!;
                g.managed = {
                  directory: installed.directory,
                  jobId: job.id,
                  method: "zip",
                };
              });
              job.installedGameId = game.id;
            }
          } else {
            const file = downloads.file(job);
            if (
              !(
                process.platform === "darwin"
                  ? /\.(pkg|dmg)$/i
                  : /\.(exe|msi)$/i
              ).test(file)
            )
              throw Error(
                "Installer extension is not supported on this platform.",
              );
            job.status = "installing";
            job.installationState='installing';job.installationError=undefined;
            await state.save();
            changed();
            const error = await shell.openPath(file);
            if (error) throw Error(error);
            await dialog.showMessageBox(win, {
              message:
                "Finish the native installer, then select the installed game.",
              detail:
                "Ember cannot infer whether an external installer completed successfully.",
              buttons: ["Choose installed game"],
            });
            const game = await add(
              undefined,
              job.package.title,
              job.package.steamAppId,
            );
            if (game) job.installedGameId = game.id;
            job.status = "completed";
          }
        } catch (e) {
          job.status = "completed";
          job.installationState='needs-attention';job.installationError="Installation failed: "+String(e);
          throw e;
        } finally {
          installing = false;
          if(job.installedGameId){job.installationState='ready';job.installationError=undefined;job.error=undefined}
          else if(job.installationState!=='needs-attention'){job.installationState='needs-attention';job.installationError='Installation has not been confirmed. Locate the installed game or retry installation.'}
          await state.save();
          changed();
        }
      }
      async function gameDetail(id: string, force = false) {
        try {
          const result = await catalog.detail(id, force);
          await library.mutate(d => { for (const g of d.games) if (g.steamId === id) g.unavailable = false; });
          return result;
        } catch (e) {
          if (e instanceof UnavailableGameError) {
            await library.mutate(d => { for (const g of d.games) if (g.steamId === id) g.unavailable = true; });
            delete state.data.catalog[id];
            await state.save(); changed(); return null;
          }
          throw e;
        }
      }
      let sourceSync: Promise<void> | undefined;
      const stableInstalls=new Map<string,string>();
      let detecting=false;
      async function detectInstallation(id?:string,manual=false){
        if(detecting)return;detecting=true;
        try{
          const records=await installationRecords();
          for(const job of state.data.downloads.filter(j=>j.status==='completed'&&!j.installedGameId&&(!id||j.id===id))){
            const catalogId=job.package.steamAppId;
            const meta=catalogId?state.data.catalog[catalogId]:undefined;
            const title=meta?.title||communityTitle(job.package.title);
            const roots=[torrentDirectory(job),...records.filter(r=>communityKey(r.name)===communityKey(title)).map(r=>r.directory)];
            const candidates=await detectedExecutables(roots,title);
            let file=candidates.length===1?candidates[0]:undefined;
            if(file&&!manual){const stamp=await executableStamp(file).catch(()=>undefined);const previous=stableInstalls.get(file);if(stamp)stableInstalls.set(file,stamp);if(!stamp||previous!==stamp)continue;}
            if(!file&&manual){const choice=await dialog.showOpenDialog(win,{title:'Select the installed game executable (not Setup)',properties:['openFile'],defaultPath:roots[0],filters:[{name:'Game executable',extensions:process.platform==='win32'?['exe']:['app']}]});if(!choice.canceled)file=choice.filePaths[0];}
            if(!file)continue;
            try{const g=await add(file,title,catalogId&&/^\d+$/.test(catalogId)?catalogId:undefined,catalogId?.startsWith('feed-')?catalogId:undefined);if(g){job.installedGameId=g.id;job.installationState='ready';job.installationError=undefined;await state.save();changed();}}catch(e){if(manual)throw e;}
          }
        }finally{detecting=false;}
      }
      function syncSources(): Promise<void> {
        if(sourceSync) return sourceSync;
        sourceSync = (async()=>{
        const pending = state.data.sources.filter(s=>s.enabled&&!s.localSnapshot).map(s=>structuredClone(s));
        const worker = async()=>{ for (let source; (source=pending.shift());) {
          const updated = await refreshSource(source);
          const target = state.data.sources.find(s => s.id === source.id);
          if (target && target.url === source.url && target.updated === source.updated) Object.assign(target, updated, {enabled:target.enabled});
          await state.save(); changed();
        }};
        await Promise.all([worker(),worker()]);
        catalog.community();
        })().finally(()=>{sourceSync=undefined});
        return sourceSync;
      }
      async function action(type: V2Action, p: any = {}) {
        if(type==='displaySettings')return {reduceMotion:state.data.preferences.reduceMotion===true,highContrast:state.data.preferences.highContrast===true,notifyDownloads:state.data.preferences.notifyDownloads===true,notifyErrors:state.data.preferences.notifyErrors===true,announcementBadge:state.data.preferences.announcementBadge!==false};
        if(type==='accountStatus') { if(accounts.user)await accounts.require().catch(()=>{});else{const restored=await accounts.restore();if(restored.user)await downloads.resumeRecovered()}return accounts.status(); }
        if(type==='accountLogin'){const status=await accounts.login(p);await downloads.resumeRecovered();return status;}
        if(type==='accountRegister') return accounts.request('register',p);
        if(type==='accountForgotPassword') return accounts.request('forgot-password',p);
        if(type==='accountLogout') return accounts.logout();
        if(type==='accountConfigure') return accounts.configure(String(p.url));
        await accounts.require();
        if(type==='launcherUpdateStatus'){await describeRelease();return launcherUpdates.status();}
        if(type==='previewLauncherUpdate'){
          await accounts.require(true);if(accounts.user?.role!=='admin')throw Error('Administrator access required.');
          return launcherUpdates.previewTest();
        }
        if(type==='checkLauncherUpdate'){await launcherUpdates.check();await describeRelease();return launcherUpdates.status();}
        if(type==='installLauncherUpdate')return launcherUpdates.install();
        if(type==='announcementStatus'||type==='readAnnouncements'){
          const key=JSON.stringify([accounts.url,accounts.user!.id]);
          const {latest}=await accounts.request('updates/latest');
          if(type==='readAnnouncements')await announcementRead.mark(key,Math.min(Number(p.through),latest));
          return announcementRead.status(key,latest);
        }
        if(updating&&type!=='snapshot')throw Error('Ember is preparing a launcher update. Please wait.');
        if(type==='updates')return accounts.updates(p.before);
        if(type==='publishUpdate')return accounts.publish(p);
        if(type==='feedbackList')return accounts.request('feedback?'+new URLSearchParams({query:String(p.query||''),label:String(p.label||''),...(p.before?{before:String(p.before)}:{})}));
        if(type==='feedbackThread')return accounts.request('feedback/thread?'+new URLSearchParams({id:String(p.id),...(p.before?{before:String(p.before)}:{})}));
        if(type==='feedbackImage')return accounts.request('feedback/image?id='+encodeURIComponent(p.id));
        if(type==='createFeedback')return accounts.request('feedback',p);
        if(type==='replyFeedback')return accounts.request('feedback/reply',p);
        if(type==='moderateFeedback')return accounts.request('feedback/moderate',p);
        switch (type) {
          case 'saveProtection': {
            const game=find(p.id),key=cloudKey(game);
            if(p.mode==='list')return {versions:await saveVersions.list(key)};
            if(p.mode==='cloudStatus'){const r=await accounts.request('saves?key='+encodeURIComponent(key));return {revision:r.revision,updated:r.updated,message:r.revision?'Cloud save is available.':'No cloud save yet.'}}
            if(running.has(game.id)||storageLocks.has(game.id)||installing)throw Error('Close the game and finish other installation/save operations first.');
            storageLocks.add(game.id);installing=true;
            try{
              if(p.mode==='download'){
                const r=await accounts.request('saves?key='+encodeURIComponent(key));if(!r.payload)throw Error('No cloud save exists.');if(r.payload.key!==key)throw Error('Cloud save identity does not match.');
                const local=await saveVersions.importCloud(r.payload);return {message:'Cloud revision '+r.revision+' saved as a local backup. Choose Restore this version to apply it.',...local};
              }
              if(!['backup','upload','restore'].includes(p.mode))throw Error('Choose a save operation.');
              const selected=await dialog.showOpenDialog(win,{title:(p.mode==='restore'?'Choose the current save folder to replace for ':'Choose the save-data folder for ')+game.name,properties:['openDirectory']});if(selected.canceled)return {message:'Canceled.'};
              if(p.mode==='restore'){
                if(!await confirm('Restore this save version?',game.name+'\nCurrent saves will be backed up first. Close the game before continuing.'))return {message:'Canceled.'};
                const result=await saveVersions.restore(String(p.version),key,game.name,selected.filePaths[0]);return {message:'Save version restored. Previous saves are preserved in the backup list and at '+result.rollback,...result};
              }
              if(p.mode==='upload'&&!await confirm(p.expectedRevision?'Replace cloud revision '+p.expectedRevision+'?':'Upload saves to your account?',game.name+'\nOnly select this game’s save folder. A new remote revision will block this upload.'))return {message:'Canceled.'};
              const local=await saveVersions.snapshot(key,game.name,selected.filePaths[0]);
              if(p.mode==='upload'){const previous=await accounts.request('saves?key='+encodeURIComponent(key));if(previous.revision!==p.expectedRevision)throw Error('Cloud save conflict: refresh cloud status and choose which version to keep. Local backup preserved.');if(previous.payload)await saveVersions.importCloud(previous.payload);const payload=await saveVersions.payload(local.id,key);const r=await accounts.request('saves?key='+encodeURIComponent(key),{expectedRevision:p.expectedRevision,payload});return {message:'Uploaded cloud revision '+r.revision+'. Refresh cloud status before uploading again.',...local}}
              return {message:'Created a new verified save version.',...local};
            }finally{storageLocks.delete(game.id);installing=false;changed()}
          }
          case 'diagnostics':return diagnosticReport(state.data,app.getVersion());
          case 'personalization': {
            for(const key of ['reduceMotion','highContrast','notifyDownloads','notifyErrors','announcementBadge'] as const){if(typeof p[key]!=='boolean')throw Error('Invalid personalization settings.');state.data.preferences[key]=p[key]}
            await state.save();return action('displaySettings');
          }
          case 'cloudLibrary': {
 await accounts.require(true);
 if(!['upload','restore'].includes(p.mode))throw Error('Choose backup or restore.');
 const choice=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel',p.mode==='upload'?'Back up':'Restore'],defaultId:0,cancelId:0,message:p.mode==='upload'?'Replace this account’s cloud backup with this computer’s library preferences?':'Merge cloud preferences? Matching games will use cloud favorites, collections and play status.'});
 if(choice.response!==1)return {message:'Canceled.'};
 const identity=accounts.url+':'+accounts.user!.id;
 const result=await accounts.request('library',p.mode==='upload'?{entries:cloudGames(library.data.games)}:undefined);
 if(identity!==accounts.url+':'+accounts.user?.id)throw Error('Account changed. Try again.');
 if(p.mode==='restore')await library.mutate(d=>restoreCloud(d.games,result.entries));
 return {message:result.updated?(p.mode==='upload'?'Backed up ':'Restored ')+result.entries.length+' games. Backup date: '+new Date(result.updated).toLocaleString():'No cloud backup exists yet.'};
 }
 case 'rememberSearch': {
            const query=String(p.query||'').trim().slice(0,150);if(query){state.data.recentSearches=[query,...(state.data.recentSearches||[]).filter(q=>q.toLowerCase()!==query.toLowerCase())].slice(0,12);await state.save()}return;
          }
          case 'organizeGame': {
            const game=find(p.id),collections=Array.isArray(p.collections)?p.collections.map(String).map((c:string)=>c.trim()).filter(Boolean):game.collections||[];
            if(collections.length>20||collections.some((c:string)=>c.length>50)||p.playStatus&&!['backlog','playing','finished'].includes(p.playStatus))throw Error('Use up to 20 collections with names up to 50 characters.');
            await library.mutate(d=>{const g=d.games.find(g=>g.id===game.id)!;g.collections=[...new Set<string>(collections)];if(typeof p.favorite==='boolean')g.favorite=p.favorite;if(typeof p.hidden==='boolean')g.hidden=p.hidden;if(p.playStatus)g.playStatus=p.playStatus});return;
          }
          case 'gameArtwork': {
            const game=find(p.id);if(!['choose','reset'].includes(p.action))throw Error('Choose a cover action.');
            if(p.action==='reset'){await library.mutate(d=>{d.games.find(g=>g.id===game.id)!.customArtwork=undefined});return}
            const choice=await dialog.showOpenDialog(win,{title:'Choose a game cover',properties:['openFile'],filters:[{name:'Cover image',extensions:['png','jpg','jpeg','webp']}]});if(choice.canceled)return;
            const file=choice.filePaths[0];if((await stat(file)).size>20*1024*1024)throw Error('Use an image smaller than 20 MB.');const image=nativeImage.createFromPath(file);if(image.isEmpty())throw Error('The image could not be read.');const size=image.getSize(),scale=Math.min(1,2000/Math.max(size.width,size.height));const bytes=(scale<1?image.resize({width:Math.max(1,Math.round(size.width*scale)),height:Math.max(1,Math.round(size.height*scale))}):image).toPNG();const name='custom-'+randomUUID()+'.png';await mkdir(art,{recursive:true});await writeFile(path.join(art,name),bytes,{mode:0o600});await library.mutate(d=>{d.games.find(g=>g.id===game.id)!.customArtwork='ember-art://library/'+name});return;
          }
          case 'storage': {
            const rows=[];for(const game of library.data.games.filter(g=>g.installed)){
              const directory=game.managed?.directory||(game.executable.toLowerCase().endsWith('.app')?game.executable:path.dirname(game.executable));
              try{if(!path.isAbsolute(directory)||directory===path.parse(directory).root)throw Error('Storage location is unavailable.');const inventory=await folderInventory(directory);const disk=await (await import('node:fs/promises')).statfs(directory);rows.push({id:game.id,name:game.name,directory,bytes:inventory.bytes,free:disk.bavail*disk.bsize,movable:game.managed?.method==='zip',store:game.store})}catch(e){rows.push({id:game.id,name:game.name,directory,error:String(e),movable:false,store:game.store})}
            }return {games:rows};
          }
          case 'backupSaves': {
            const game=find(p.id);if(running.has(game.id)||storageLocks.has(game.id)||installing)throw Error('Close the game and finish installation/save operations first.');
            storageLocks.add(game.id);installing=true;
            try{const selected=await dialog.showOpenDialog(win,{title:'Choose the save-data folder for '+game.name,properties:['openDirectory']});if(selected.canceled)return;
            const backup=await saveVersions.snapshot(cloudKey(game),game.name,selected.filePaths[0]);const directory=path.join(backup.directory,'files');shell.showItemInFolder(directory);return {directory,version:backup.id};
            }finally{storageLocks.delete(game.id);installing=false;changed()}
          }
          case 'moveGame': {
            const game=find(p.id);if(running.has(game.id)||storageLocks.has(game.id)||installing)throw Error('Close the game and wait for other installation operations first.');if(game.managed?.method!=='zip')throw Error('Only Ember-managed archive installations can move here. Use the original installer for this game.');
            const source=await managedMoveSource(game.managed.directory,game.executable),choice=await dialog.showOpenDialog(win,{title:'Choose the destination drive or folder for '+game.name,properties:['openDirectory','createDirectory']});if(choice.canceled)return;
            const target=path.join(await realpath(choice.filePaths[0]),path.basename(source.actual));if(!await confirm('Move '+game.name+'?',source.actual+'\n→ '+target+'\nThe copy is verified before Ember updates the library and removes the original.'))return;
            storageLocks.add(game.id);installing=true;
            try{await verifiedFolderCopy(source.actual,target);await retargetMoveMarker(target,target);const executable=path.join(target,source.relative);await nativeTarget(executable);await library.mutate(d=>{const g=d.games.find(g=>g.id===game.id)!;g.executable=executable;g.managed={...g.managed!,directory:target};g.lastLaunchError=undefined});
              try{await uninstallManaged(source.actual)}catch{return {warning:'Game moved successfully. The old folder was retained because cleanup could not be verified.',directory:target}}return {directory:target};
            }finally{storageLocks.delete(game.id);installing=false;changed()}
          }
          case "snapshot": {
            const sourcesRevision = JSON.stringify(state.data.sources.map(s=>[s.id,s.url,s.updated,s.enabled,s.error,s.packages.length,s.lastAttempt,s.lastSuccess]));
            return {
              state: {...state.data, sources:p.sourcesRevision===sourcesRevision ? undefined : state.data.sources},
              sourcesRevision,
              games: library.data.games.filter(g => isPlayableEntry(g) && !g.unavailable),
              platform: process.platform,
              running: [...running.keys()],
              dataPath: root,
              busy,
              message,
              launcherUpdate:launcherUpdates.status(),
            };
          }
          case "detectInstall":
            return detectInstallation(p.id,true);
          case "importSteam": {
            const r = await dialog.showOpenDialog(win, {
              title: "Choose Steam folder containing steamapps",
              properties: ["openDirectory"],
              defaultPath: defaultSteam,
            });
            if (r.canceled) return;
            await scanSteam(r.filePaths[0]);
            await library.mutate((d) => {
              d.steamRoots = [
                ...new Set([...(d.steamRoots || []), r.filePaths[0]]),
              ];
            });
            await scan();
            void sync().catch(report);
            return;
          }
          case "syncSteam": {
            if (state.data.ownership.steamId) {
              try {
                const key = safeStorage.decryptString(
                  await readFile(path.join(root, "steam-key.bin")),
                );
                await connect(state.data.ownership.steamId, key);
              } catch (e) {
                state.data.ownership.error = String(e);
                await state.save();
              }
            }
            await scan();
            await sync(true);
            return;
          }
          case "connectSteam":
            await connect(String(p.steamId), String(p.key));
            void sync().catch(report);
            return;
          case "disconnectSteam":
            state.data.ownership = { ids: [] };
            await state.save();
            await rm(path.join(root, "steam-key.bin"), { force: true });
            await library.mutate((d) => {
              for (const g of d.games.filter((g) => g.store === "steam")) {
                g.owned = false;
                g.steam = undefined;
              }
            });
            return;
          case "catalog":
            return catalog.search(p.kind, p.term, p.page);
          case "detail":
            if(String(p.id).startsWith('chart-'))return catalog.chartDetail(p.id,true);
            return String(p.id).startsWith('feed-') ? catalog.communityDetail(p.id) : gameDetail(appId(p.id));
          case "achievements": {
            const id = appId(p.id), g = library.data.games.find(g => g.steamId === id);
            if (!g) return;
            if (!p.force && g.steam?.achievementUpdated && Date.now() - Date.parse(g.steam.achievementUpdated) < 3600000) return;
            const steamId = state.data.ownership.steamId;
            let stats;
            try {
              if (!steamId) throw Error("Not connected");
              const key = safeStorage.decryptString(await readFile(path.join(root, "steam-key.bin")));
              stats = await onlineAchievements(id, steamId, key, g.steam);
            } catch {
              stats = { ...g.steam, achievementMessage: "Connect your Steam account in Settings to load online achievements, or retry if Steam is unavailable." };
            }
            if (state.data.ownership.steamId !== steamId) return;
            await library.mutate(d => { const target = d.games.find(x => x.id === g.id); if (target) target.steam = { ...target.steam, ...stats }; });
            changed(); return;
          }
          case "rankings": {
            if (p.refresh || !state.data.rankings.ids.length || Date.now() >= state.data.rankings.nextRefresh)
              await catalog.refreshRankings(Boolean(p.refresh));
            const ids = state.data.rankings.ids.slice(
              p.offset || 0,
              (p.offset || 0) + 20,
            );
            await Promise.allSettled(ids.map(async id=>{const m=id.startsWith('chart-')?await catalog.chartDetail(id):await catalog.detail(id);m.discoveryList='top';return m;}));
            await state.save();return state.data.rankings;
          }
          case "saveGame": {
            if(/^(feed|chart)-/.test(String(p.id))){
              const m=String(p.id).startsWith('chart-')?await catalog.chartDetail(p.id):await catalog.communityDetail(p.id);
              if(!m.origin)return action('saveGame',{id:m.steamAppId||m.appId});
              await library.mutate(d=>{const g=d.games.find(g=>g.catalogId===m.appId);if(g)g.saved=!g.saved;else d.games.push({id:'steam-'+m.appId,catalogId:m.appId,name:m.title,executable:'',args:[],store:'local',platform:'native',seconds:0,description:m.description,added:new Date().toISOString(),saved:true,installed:false,owned:false});});return;
            }
            const id = appId(p.id);
            const existing = library.data.games.find(g => g.store === "steam" && g.steamId === id);
            if (existing?.saved) {
              await library.mutate(d => { const g = d.games.find(g => g.id === existing.id); if (g) g.saved = false; });
              return;
            }
            const meta = await catalog.detail(appId(p.id));
            if (meta.content !== "allowed")
              throw Error("This content is excluded from discovery.");
            await library.mutate((d) => {
              const g = d.games.find(
                (g) => g.steamId === meta.appId && g.store === "steam",
              );
              if (g) g.saved = !g.saved;
              else
                d.games.push({
                  id: "steam-" + meta.appId,
                  steamId: meta.appId,
                  name: meta.title,
                  executable: "",
                  args: [],
                  store: "steam",
                  platform: "native",
                  seconds: 0,
                  description: meta.description.slice(0, 10000),
                  added: new Date().toISOString(),
                  owned: false,
                  installed: false,
                  saved: true,
                });
            });
            return;
          }
          case "removeGame": {
            if(storageLocks.has(p.id))throw Error('Wait for this game move to finish.');
            if (running.has(p.id)) throw Error("Close the game first.");
            await library.mutate((d) => {
              d.games = d.games.filter((g) => g.id !== p.id);
            });
            return;
          }
          case "launch": {
            try{await launch(p.id);await library.mutate(d=>{const g=d.games.find(g=>g.id===p.id);if(g)g.lastLaunchError=undefined})}
            catch(e){if(!running.has(p.id))await library.mutate(d=>{const g=d.games.find(g=>g.id===p.id);if(g)g.lastLaunchError=String(e).slice(0,1500)});throw e}
            return;
          }
          case "repairGame": {
            const game=find(p.id);
            if(storageLocks.has(game.id))throw Error('Wait for this game move to finish.');
            if(!['diagnose','choose','rescan'].includes(p.action))throw Error('Choose a valid repair action.');
            if(p.action==='diagnose')return launchHealth(game,nativeTarget);
            if(running.has(game.id))throw Error('Close this game before changing its executable.');
            let executable:string|undefined;
            if(p.action==='rescan'){
              if(game.store==='steam'){await scan();return launchHealth(find(game.id),nativeTarget)}
              const records=await installationRecords();
              const roots=[...(game.executable?[path.dirname(game.executable)]:[]),...(game.managed?[game.managed.directory]:[]),...state.data.downloads.filter(j=>j.installedGameId===game.id).map(j=>torrentDirectory(j)),...records.filter(r=>communityKey(r.name)===communityKey(game.name)).map(r=>r.directory)];
              const matches=await detectedExecutables(roots,game.name);
              if(matches.length!==1)throw Error(matches.length?'Several executables found. Choose the game executable.':'No game executable found. Choose its installed executable manually.');
              executable=matches[0];
            }else{
              const selected=await dialog.showOpenDialog(win,{title:'Choose the installed game executable (not its installer)',properties:process.platform==='darwin'?['openFile','openDirectory']:['openFile'],filters:process.platform==='win32'?[{name:'Windows game',extensions:['exe']}]:undefined});
              if(!selected.canceled)executable=selected.filePaths[0];
            }
            if(executable){
              await nativeTarget(executable);
              await library.mutate(d=>{const g=d.games.find(g=>g.id===game.id)!;g.executable=executable!;g.installed=true;g.lastLaunchError=undefined});
              for(const job of state.data.downloads.filter(j=>j.installedGameId===game.id)){job.installationState='ready';job.installationError=undefined}
              await state.save();
            }
            return launchHealth(find(game.id),nativeTarget);
          }
          case "installSteam": {
            const id = appId(p.id);
            if (!state.data.ownership.ids.includes(id))
              throw Error(
                "Verify ownership first, or view the Steam store to obtain the game.",
              );
            await steamNative(id);
            return shell.openExternal("steam://install/" + id);
          }
          case "store":
            if(String(p.id).startsWith('feed-')){const m=await catalog.communityDetail(p.id);if(!m.origin)return action('store',{id:m.steamAppId||m.appId});if(m.purchaseUrl)return shell.openExternal(m.purchaseUrl);throw Error('No verified official purchase page is available for this title.');}
            return shell.openExternal(
              "https://store.steampowered.com/app/" + appId(p.id) + "/",
            );
          case "addGame":
            return add();
          case "updateGame": {
            const old = find(p.id);
            const updated = {
              ...old,
              name: p.name,
              description: p.description,
              args: p.args,
            };
            validateGame(updated);
            await library.mutate((d) => {
              d.games[d.games.findIndex((g) => g.id === old.id)] = updated;
            });
            return;
          }
          case "preferences": {
            const v = p as Preferences;
            if (
              !/^[A-Z]{2}$/.test(v.region) ||
              !Number.isInteger(v.concurrency) ||
              v.concurrency < 1 ||
              v.concurrency > 4 ||
              !Number.isFinite(v.minimumPositive) ||
              v.minimumPositive < 0 ||
              v.minimumPositive > 100 ||
              !Number.isInteger(v.minimumReviews) ||
              v.minimumReviews < 0 ||
              v.minimumReviews > 1000000 ||
              typeof v.catalogUrl !== "string"
            )
              throw Error("Invalid preferences.");
            if (v.catalogUrl) httpsUrl(v.catalogUrl);
            if (v.region !== state.data.preferences.region) {
              state.data.catalog = {};
              state.data.rankings.nextRefresh = 0;
            }
            state.data.preferences = {
              ...state.data.preferences,
              resumeDownloads:v.resumeDownloads!==false,
              torrentNatTraversal:v.torrentNatTraversal===true,
              region: v.region,
              concurrency: v.concurrency,
              minimumPositive: v.minimumPositive,
              minimumReviews: v.minimumReviews,
              catalogUrl: v.catalogUrl,
            };
            await state.save();
            downloads.pump();
            return;
          }
          case "addSource": {
            const source = await loadSource(p.url);
            if (state.data.sources.some((s) => sourceKey(s.url) === sourceKey(source.url)))
              throw Error("Source is already registered.");
            state.data.sources.push(source);
            await state.save();
            return;
          }
          case "importSourceFile": {
            const selected = await dialog.showOpenDialog(win,{title:'Import source catalogs',properties:['openFile','multiSelections'],filters:[{name:'JSON catalogs',extensions:['json']}]});
            if(selected.canceled) return;
            const imported = [];
            for(const file of selected.filePaths) {
              if((await stat(file)).size > 32*1024*1024) throw Error('Catalog exceeds 32 MB.');
              const raw = JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,''));
              const existing = state.data.sources.find(s=>s.name === raw.name);
              imported.push(...importSourceJson(raw, existing?.url));
            }
            for(const source of imported) {
              const previous = state.data.sources.find(s=>sourceKey(s.url)===sourceKey(source.url) || s.name===source.name);
              if(previous) Object.assign(previous, source, {id:previous.id,enabled:previous.enabled,error:undefined});
              else state.data.sources.push(source);
            }
            await state.save(); changed(); return;
          }
          case "syncSources":
            await syncSources(); return;
          case "openDownload": {
            const job = state.data.downloads.find(j => j.id === p.id);
            if (!job) throw Error("Download not found.");
            if (job.package.transport === "host") {
              if (job.status === "completed" && job.outputPath) return shell.showItemInFolder(job.outputPath);
              return hostDownloads.open(job);
            }
            if (job.package.transport === "torrent") return shell.openPath(torrentDirectory(job));
            return shell.showItemInFolder(downloads.file(job));
          }
          case "source": {
            const s = state.data.sources.find((s) => s.id === p.id);
            if (!s) throw Error("Source not found.");
            if (p.action === "update") {
              httpsUrl(p.url);
              if (state.data.sources.some(x => x.id !== s.id && x.url === p.url)) throw Error("Source is already registered.");
              s.url = p.url; s.fallbackUrl = undefined; s.packages = []; s.resolvedUrl = undefined; s.localSnapshot = false; s.snapshotOrigin = undefined; s.updated = undefined;
              Object.assign(s, await refreshSource(s));
            }
            else if (p.action === "remove")
              state.data.sources = state.data.sources.filter(
                (s) => s.id !== p.id,
              );
            else if (p.action === "toggle") s.enabled = !s.enabled;
            else if (p.action === "refresh") {
              try {
                Object.assign(s, await refreshSource(s), {
                  id: s.id,
                  enabled: s.enabled,

                });
              } catch (e) {
                s.error = String(e);
              }
            } else throw Error("Invalid source action.");
            await state.save();
            return;
          }
          case "download": {
            const source = state.data.sources.find(
                (s) => s.id === p.sourceId && s.enabled,
              ),
              original = source?.packages.find((g) => g.id === p.packageId);
            const pkg = original && structuredClone(original);
            if (!source || !pkg)
              throw Error("Enabled source package not found.");
            if (!nativePackage(pkg.platforms, process.platform))
              throw Error("Package is not native to this platform.");
            if (p.appId) {
              const meta = String(p.appId).startsWith('feed-') ? await catalog.communityDetail(p.appId) : await catalog.detail(appId(p.appId));
              if(meta.isFree||meta.price==='Free')throw Error('Free games are available from the official store.');
              if (!packageMatches(pkg, meta.origin?undefined:meta.appId, meta.title)) throw Error("Package does not match this game.");
              pkg.steamAppId = meta.appId;
            }
            const r = await dialog.showOpenDialog(win, {
              title: "Choose download folder",
              properties: ["openDirectory", "createDirectory"],
            });
            if (!r.canceled)
              return downloads.enqueue(pkg, source.id, r.filePaths[0]);
            return;
          }
          case "downloadControl": {
            const hostJob = state.data.downloads.find(j => j.id === p.id && j.package.transport === "host");
            if (hostJob) return hostDownloads.control(hostJob, p.action);
            if (p.action === "pauseAll") {
              await Promise.all(
                state.data.downloads
                  .filter((j) =>
                    [
                      "queued",
                      "connecting",
                      "downloading",
                      "verifying",
                    ].includes(j.status),
                  )
                  .map((j) => j.package.transport === "host" ? hostDownloads.control(j,"pause") : downloads.control(j.id, "pause")),
              );
              return;
            }
            if (p.action === "resumeAll") {
              for (const j of state.data.downloads.filter(
                (j) => j.status === "paused",
              ))
                await (j.package.transport === "host" ? hostDownloads.control(j,"resume") : downloads.control(j.id, "resume"));
              return;
            }
            if (["cancel", "remove"].includes(p.action)) {
              const job = state.data.downloads.find((j) => j.id === p.id);
              if (
                job &&
                !job.package.transport && job.downloaded > 0 &&
                job.status !== "completed" &&
                !(await confirm(
                  "Delete partial download?",
                  job.package.title +
                    " — " +
                    job.downloaded +
                    " downloaded bytes will be removed.",
                ))
              )
                return;
            }
            return downloads.control(p.id, p.action);
          }
          case "installPackage":
            return installPackage(p.id);
          case "uninstall": {
            const g = find(p.id);
            if(storageLocks.has(g.id))throw Error('Wait for the game move to finish.');
            if (running.has(g.id)) throw Error("Close the game first.");
            if (g.store === "steam")
              return shell.openExternal(
                "steam://uninstall/" + appId(g.steamId!),
              );
            if (!g.managed) {
              const job=state.data.downloads.find(j=>j.installedGameId===g.id);
              if(!job)throw Error('Use the operating system to uninstall this manually added game.');
              let directory:string;
              try{directory=await downloadedInstallDirectory(job.destination,job.id,g.executable);}
              catch{
                if(await confirm('Open the system uninstaller?', 'This game was installed outside its Ember download folder. Remove it using the operating system uninstaller. Ember will not delete that folder.')){
                  if(process.platform==='win32')await shell.openExternal('ms-settings:appsfeatures');else shell.showItemInFolder(g.executable);
                }
                return;
              }
              if(!await confirm('Uninstall '+g.name+'?',directory+'\nThis deletes the game and all downloaded files in this Ember folder. Saves inside it will also be removed.'))return;
              await uninstallDownloaded(job.destination,job.id,g.executable);
              await library.mutate(d=>{const target=d.games.find(x=>x.id===g.id)!;target.installed=false;target.executable='';target.managed=undefined;});
              job.installedGameId=undefined;job.status='canceled';await state.save();return;
            }
            const managed = {...g.managed};
            if (
              await confirm(
                "Uninstall " + g.name + "?",
                g.managed.directory +
                  "\nAll files inside this managed folder will be deleted.",
              )
            ) {
              await uninstallManaged(managed.directory);
              await library.mutate((d) => {
                const target = d.games.find((x) => x.id === g.id)!;
                target.installed = false;
                target.executable = "";
                target.managed = undefined;
              });
              const job = state.data.downloads.find(
                (j) => j.id === managed.jobId,
              );
              if (job) job.installedGameId = undefined;
              await state.save();
            }
            return;
          }
          case "reveal": {
            const g = find(p.id);
            if (g.installed) shell.showItemInFolder(g.executable);
            return;
          }
          case "offlineInstaller": {
            const r = await dialog.showOpenDialog(win, {
              title: "Choose a native installer",
              properties: ["openFile"],
              filters: [
                {
                  name: "Native installer",
                  extensions:
                    process.platform === "darwin"
                      ? ["pkg", "dmg"]
                      : ["exe", "msi"],
                },
              ],
            });
            if (r.canceled) return;
            const file = r.filePaths[0];
            if (
              !(
                process.platform === "darwin"
                  ? /\.(pkg|dmg)$/i
                  : /\.(exe|msi)$/i
              ).test(file)
            )
              throw Error("Unsupported native installer.");
            if (await confirm("Run this installer?", file)) {
              const error = await shell.openPath(file);
              if (error) throw Error(error);
            }
            return;
          }
          default:
            throw Error("Unsupported action.");
        }
      }
      ipcMain.handle("ember2", async (event, type, p) => {
        if (
          !win || win.isDestroyed() || event.sender !== win.webContents ||
          event.senderFrame !== win.webContents.mainFrame
        )
          throw Error("Untrusted sender.");
        try {
          return await action(type, p);
        } finally {
          if (!['snapshot','accountStatus','updates','announcementStatus','launcherUpdateStatus','checkLauncherUpdate','feedbackList','feedbackThread','feedbackImage'].includes(type)) changed();
        }
      });
      function createWindow() {
        win = new BrowserWindow({
          width: 1400,
          height: 920,
          minWidth: 720,
          minHeight: 540,
          backgroundColor: "#151b1d",
          title: "Ember",
          icon: path.join(__dirname, "ui/launcher.png"),
          autoHideMenuBar: true,
          webPreferences: {
            preload: path.join(__dirname, "preload.cjs"),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
          },
        });
        const fitDisplay=()=>{
          if(win.isDestroyed()||win.webContents.isDestroyed())return;
          const display=screen.getDisplayMatching(win.getBounds());
          const width=Math.min(win.getContentBounds().width,display.workAreaSize.width);
          win.webContents.setZoomFactor(displayZoom(width,state.data.preferences.uiZoom));
        };
        ipcMain.removeAllListeners('ember-zoom');
        ipcMain.on('ember-zoom',(event,direction)=>{
          if(win.isDestroyed()||event.sender!==win.webContents||event.senderFrame!==win.webContents.mainFrame||!['in','out','reset'].includes(direction))return;
          state.data.preferences.uiZoom=direction==='reset'?1:changeZoom(state.data.preferences.uiZoom||1,direction==='in'?1:-1);
          fitDisplay();void state.save().catch(report);
        });
        win.on('resize',fitDisplay);win.on('move',fitDisplay);
        win.webContents.on('did-finish-load',fitDisplay);
        win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
        win.webContents.on("will-navigate", (e) => e.preventDefault());
        void win.loadFile(path.join(__dirname, "ui/index.html"));
        win.on("close", (e) => {
          if(!quitting && tray){e.preventDefault();win.hide();return;}
          if (!quitting && (running.size || installing)) {
            e.preventDefault();
            void dialog.showMessageBox(win, {
              message:
                "Close the running game or installer before exiting Ember.",
            });
          }
        });
      }
      createWindow();
      if(!process.env.EMBER_DATA_DIR)void catalog.refreshRankings(true).then(changed).catch(report);
      if(updaterSupported){void launcherUpdates.check();const updatePoll=setInterval(()=>void launcherUpdates.check(),15*60000);updatePoll.unref();}
      if(!process.env.EMBER_DATA_DIR || process.env.EMBER_ENABLE_TRAY==='1'){
        tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'ui/launcher.png')).resize({width:32,height:32}));
        const show=()=>{if(win.isDestroyed())createWindow();win.show();win.focus();};
        tray.setToolTip('Ember · running in background');tray.setContextMenu(Menu.buildFromTemplate([{label:'Open Ember',click:show},{label:'Quit Ember',click:()=>app.quit()}]));tray.on('double-click',show);
      }
      const installPoll=setInterval(()=>{if(!quitting)void detectInstallation().catch(report);},15000);installPoll.unref();
      if(!process.env.EMBER_DATA_DIR)void Promise.allSettled([catalog.search('coming'),catalog.search('all'),action('rankings',{offset:0})]).then(changed);
      void scan()
        .then(() => sync())
        .catch(report);
      if (!process.env.EMBER_DATA_DIR) void syncSources().catch(report);
      const poll = setInterval(() => void scan().catch(report), 30000);
      poll.unref();
      const ranks = setInterval(() => {
        if (Date.now() >= state.data.rankings.nextRefresh)
          void catalog.refreshRankings().then(changed).catch(report);
      }, 60000);
      ranks.unref();
      app.on("activate", () => {
        if (!BrowserWindow.getAllWindows().length) createWindow();
      });
      app.on("second-instance", () => {
        if (quitting) return;
        if (!win || win.isDestroyed()) { createWindow(); return; }
        if (win.isMinimized()) win.restore();
        win.show();
        win.focus();
      });
    })
    .catch((e) => {
      dialog.showErrorBox("Ember needs attention", String(e));
      app.quit();
    });
app.on("before-quit", (e) => {
  if (!quitting && downloads) {
    e.preventDefault();
    quitting = true;
    void (async()=>{
      try {await hostDownloads?.shutdown();await downloads.shutdown();}
      catch(e) {console.error('Download shutdown failed:',e);}
      finally {app.quit();}
    })();
  }
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});


