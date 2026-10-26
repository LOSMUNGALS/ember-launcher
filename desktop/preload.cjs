const { contextBridge, ipcRenderer } = require("electron");
const actions = new Set([
  "previewLauncherUpdate",
  "launcherUpdateStatus", "checkLauncherUpdate", "installLauncherUpdate", "announcementStatus", "readAnnouncements",
  "accountForgotPassword",
  "accountStatus", "accountLogin", "accountRegister", "accountLogout", "accountConfigure", "updates", "publishUpdate",
  "feedbackList", "feedbackThread", "feedbackImage", "createFeedback", "replyFeedback", "moderateFeedback",
  "repairGame",
  "saveProtection", "displaySettings", "personalization", "diagnostics", "cloudLibrary", "organizeGame", "gameArtwork", "storage", "moveGame", "backupSaves", "rememberSearch",
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

// Gestures work on the login screen as well as inside the launcher.
let lastZoomWheel=0;
window.addEventListener('wheel',event=>{
 if(!event.ctrlKey)return;
 event.preventDefault();event.stopPropagation();
 if(!event.deltaY||Date.now()-lastZoomWheel<70)return;
 lastZoomWheel=Date.now();ipcRenderer.send('ember-zoom',event.deltaY<0?'in':'out');
},{passive:false,capture:true});
window.addEventListener('mousedown',event=>{if(event.ctrlKey&&event.button===1){event.preventDefault();event.stopPropagation();ipcRenderer.send('ember-zoom','reset');}},{capture:true});
window.addEventListener('auxclick',event=>{if(event.ctrlKey&&event.button===1){event.preventDefault();event.stopPropagation();}},{capture:true});
