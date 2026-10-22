import type {UpdaterDriver} from './launcher-updates';
// electron-updater exposes autoUpdater through a CommonJS getter. Native ESM
// import namespaces may expose that getter only on the default export.
export function updaterDriver(module:any):UpdaterDriver {
 const driver=module.autoUpdater??module.default?.autoUpdater;
 if(!driver||typeof driver.checkForUpdates!=='function'||typeof driver.on!=='function')throw Error('The launcher update component could not be loaded.');
 return driver;
}
