/* eslint-env node */
/* global require */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  addEntry: (category, entry) => ipcRenderer.invoke('add-entry', category, entry),
  getEntries: (category) => ipcRenderer.invoke('get-entries', category),
  openOverlay: () => ipcRenderer.send('open-overlay'),
  closeOverlay: () => ipcRenderer.send('close-overlay'),
  deleteEntry: (category, id) => ipcRenderer.invoke('delete-entry', category, id), 
});
