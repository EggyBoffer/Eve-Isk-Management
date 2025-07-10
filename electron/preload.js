/* eslint-env node */
/* global require */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  addEntry: (category, entry) => ipcRenderer.invoke('add-entry', category, entry),
  getEntries: (category) => ipcRenderer.invoke('get-entries', category),
  updateEntry: (category, entry) => ipcRenderer.invoke('update-entry', category, entry),
  deleteEntry: (category, id) => ipcRenderer.invoke('delete-entry', category, id),

  openOverlay: () => ipcRenderer.send('open-overlay'),
  openOverlayWithCost: (cost, shipType, tier, stormType) =>
  ipcRenderer.send("open-overlay-with-cost", cost, shipType, tier, stormType),
  closeOverlay: () => ipcRenderer.send('close-overlay'),

  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),

  // Glorified drop handlers
  addGlorified: (entry) => ipcRenderer.invoke('add-glorified', entry),
  getGlorified: () => ipcRenderer.invoke('get-glorified'),
  deleteGlorified: (id) => ipcRenderer.invoke('delete-glorified', id),

   openExternal: (url) => ipcRenderer.invoke("open-external", url), // ✅ IPC handler here
});

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    send: (channel, data) => ipcRenderer.send(channel, data),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    receiveFilamentSettings: (callback) =>
      ipcRenderer.on('set-filament-settings', (_, settings) => callback(settings)),
  },
});
