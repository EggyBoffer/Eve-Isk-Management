const { contextBridge, ipcRenderer } = require("electron");

function on(channel, listener) {
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

function once(channel, listener) {
  ipcRenderer.once(channel, listener);
}

function off(channel, listener) {
  ipcRenderer.removeListener(channel, listener);
}

function send(channel, ...args) {
  ipcRenderer.send(channel, ...args);
}

contextBridge.exposeInMainWorld("api", {
  addEntry: (category, entry) => ipcRenderer.invoke("add-entry", category, entry),
  getEntries: (category) => ipcRenderer.invoke("getEntries", category),

  updateEntry: (category, id, entry) =>
    ipcRenderer.invoke("update-entry", category, id, entry),

  deleteEntry: (category, id) => ipcRenderer.invoke("delete-entry", category, id),

  addGlorified: (entry) => ipcRenderer.invoke("add-glorified", entry),
  getGlorified: () => ipcRenderer.invoke("get-glorified"),
  deleteGlorified: (id) => ipcRenderer.invoke("delete-glorified", id),

  getAppSettings: () => ipcRenderer.invoke("get-app-settings"),
  saveAppSettings: (settings) => ipcRenderer.invoke("save-app-settings", settings),

  openOverlayWithCost: (cost, shipType, tier, stormType) =>
    ipcRenderer.send("open-overlay-with-cost", cost, shipType, tier, stormType),

  openExternal: (url) => ipcRenderer.invoke("openExternal", url),

  bootProgress: (msg) => ipcRenderer.send("boot:progress", msg),
  bootDone: () => ipcRenderer.send("boot:done"),

  on,
  once,
  off,
  send,
});

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    on,
    once,
    off,
    send,
    removeListener: off,
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

    receiveFilamentSettings: (callback) =>
      ipcRenderer.on("set-filament-settings", (_e, settings) => callback(settings)),
  },
});
