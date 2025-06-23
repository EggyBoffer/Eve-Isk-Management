import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  addEntry: (category, entry) => ipcRenderer.invoke('add-entry', category, entry),
  getEntries: (category) => ipcRenderer.invoke('get-entries', category),
});
