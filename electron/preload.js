/* eslint-env node */
/* global require */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  addEntry: (category, entry) => ipcRenderer.invoke('add-entry', category, entry),
  getEntries: (category) => ipcRenderer.invoke('get-entries', category),
  updateEntry: (category, entry) => ipcRenderer.invoke('update-entry', category, entry),
  deleteEntry: (category, id) => ipcRenderer.invoke('delete-entry', category, id),

  openOverlay: () => ipcRenderer.send('open-overlay'),
  openOverlayWithCost: (cost) => ipcRenderer.send('open-overlay-with-cost', cost),
  closeOverlay: () => ipcRenderer.send('close-overlay'),

  getAppSettings: () => ipcRenderer.invoke('get-app-settings'),
  saveAppSettings: (settings) => ipcRenderer.invoke('save-app-settings', settings),

  // Glorified drop handlers
  addGlorified: (entry) => ipcRenderer.invoke('add-glorified', entry),
  getGlorified: () => ipcRenderer.invoke('get-glorified'),
  deleteGlorified: (id) => ipcRenderer.invoke('delete-glorified', id),
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
