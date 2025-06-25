/* eslint-env node */
/* global require */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  addEntry: (category, entry) => ipcRenderer.invoke('add-entry', category, entry),
  getEntries: (category) => ipcRenderer.invoke('get-entries', category),
  openOverlay: () => ipcRenderer.send('open-overlay'),
  closeOverlay: () => ipcRenderer.send('close-overlay'),
  deleteEntry: (category, id) => ipcRenderer.invoke('delete-entry', category, id),
  openOverlayWithCost: (cost) => ipcRenderer.send('open-overlay-with-cost', cost),
});

contextBridge.exposeInMainWorld('electron', {
  ipcRenderer: {
    on: (channel, callback) => ipcRenderer.on(channel, callback),
    send: (channel, data) => ipcRenderer.send(channel, data),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
     receiveFilamentSettings: (callback) => ipcRenderer.on('set-filament-settings', (_, settings) => callback(settings))
  },
});
