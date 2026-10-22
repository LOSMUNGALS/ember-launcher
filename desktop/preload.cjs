const { contextBridge, ipcRenderer } = require("electron");
const actions = new Set([
  "accountForgotPassword",
  "accountStatus", "accountLogin", "accountRegister", "accountLogout", "accountConfigure", "updates", "publishUpdate",
  "snapshot",
  "importSteam",
  "syncSteam",
  "connectSteam",
  "disconnectSteam",
  "catalog",
  "detail",
  "detectInstall",
  "achievements",
  "rankings",
  "saveGame",
  "removeGame",
  "launch",
  "installSteam",
  "store",
  "addGame",
  "updateGame",
  "preferences",
  "addSource",
  "importSourceFile",
  "source",
  "syncSources",
  "openDownload",
  "download",
  "downloadControl",
  "installPackage",
  "uninstall",
  "reveal",
  "offlineInstaller",
]);
contextBridge.exposeInMainWorld("ember2", {
  call: (action, payload) => {
    if (!actions.has(action))
      return Promise.reject(new Error("Unsupported action"));
    return ipcRenderer.invoke("ember2", action, payload);
  },
  subscribe: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("changed", listener);
    return () => ipcRenderer.removeListener("changed", listener);
  },
});
