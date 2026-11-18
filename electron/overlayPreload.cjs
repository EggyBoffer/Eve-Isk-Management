
const { contextBridge, ipcRenderer } = require("electron");

const allowedReceiveChannels = new Set([
  "set-filament-settings",
]);

const allowedSendChannels = new Set([
  "overlay-ready",
]);

const listenerMap = new Map();

function off(channel, listener) {
  if (!allowedReceiveChannels.has(channel) || typeof listener !== "function") {
    return;
  }

  const listeners = listenerMap.get(channel);
  if (!listeners) return;

  const wrapped = listeners.get(listener);
  if (!wrapped) return;

  ipcRenderer.removeListener(channel, wrapped);
  listeners.delete(listener);

  if (listeners.size === 0) {
    listenerMap.delete(channel);
  }
}

function on(channel, listener) {
  if (!allowedReceiveChannels.has(channel) || typeof listener !== "function") {
    return () => {};
  }

  off(channel, listener);

  const wrapped = (_event, ...args) => listener(null, ...args);

  if (!listenerMap.has(channel)) {
    listenerMap.set(channel, new Map());
  }

  const listeners = listenerMap.get(channel);

  listeners.set(listener, wrapped);
  ipcRenderer.on(channel, wrapped);

  return () => {
    if (listeners.get(listener) === wrapped) {
      off(channel, listener);
    }
  };
}

function send(channel, ...args) {
  if (!allowedSendChannels.has(channel)) {
    return;
  }

  ipcRenderer.send(channel, ...args);
}

contextBridge.exposeInMainWorld("api", {
  addEntry: (category, entry) => {
    if (category !== "abyssals") {
      return Promise.reject(new Error("Category not permitted"));
    }

    return ipcRenderer.invoke("add-entry", category, entry);
  },
});

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    on,
    off,
    removeListener: off,
    send,
  },
});
