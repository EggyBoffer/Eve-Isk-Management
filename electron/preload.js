
const { contextBridge, ipcRenderer } = require("electron");

const allowedReceiveChannels = new Set([
  "entries-updated",
]);

const allowedSendChannels = new Set([]);

const listenerMap = new Map();

function isAllowedReceiveChannel(channel) {
  return typeof channel === "string" && allowedReceiveChannels.has(channel);
}

function isAllowedSendChannel(channel) {
  return typeof channel === "string" && allowedSendChannels.has(channel);
}

function getChannelListeners(channel) {
  if (!listenerMap.has(channel)) {
    listenerMap.set(channel, new Map());
  }

  return listenerMap.get(channel);
}

function off(channel, listener) {
  if (!isAllowedReceiveChannel(channel) || typeof listener !== "function") {
    return;
  }

  const listeners = listenerMap.get(channel);

  if (!listeners) {
    return;
  }

  const wrappedListener = listeners.get(listener);

  if (!wrappedListener) {
    return;
  }

  ipcRenderer.removeListener(channel, wrappedListener);
  listeners.delete(listener);

  if (listeners.size === 0) {
    listenerMap.delete(channel);
  }
}

function on(channel, listener) {
  if (!isAllowedReceiveChannel(channel) || typeof listener !== "function") {
    return () => {};
  }

  off(channel, listener);

  const listeners = getChannelListeners(channel);

  const wrappedListener = (_event, ...args) => {
    listener(null, ...args);
  };

  listeners.set(listener, wrappedListener);
  ipcRenderer.on(channel, wrappedListener);

  return () => {
    if (listeners.get(listener) === wrappedListener) {
      off(channel, listener);
    }
  };
}

function once(channel, listener) {
  if (!isAllowedReceiveChannel(channel) || typeof listener !== "function") {
    return;
  }

  off(channel, listener);

  const listeners = getChannelListeners(channel);

  const wrappedListener = (_event, ...args) => {
    if (listeners.get(listener) === wrappedListener) {
      listeners.delete(listener);

      if (listeners.size === 0) {
        listenerMap.delete(channel);
      }
    }

    listener(null, ...args);
  };

  listeners.set(listener, wrappedListener);
  ipcRenderer.once(channel, wrappedListener);
}

function send(channel, ...args) {
  if (!isAllowedSendChannel(channel)) {
    return;
  }

  ipcRenderer.send(channel, ...args);
}

function removeAllListeners(channel) {
  if (!isAllowedReceiveChannel(channel)) {
    return;
  }

  const listeners = listenerMap.get(channel);

  if (!listeners) {
    return;
  }

  for (const wrappedListener of listeners.values()) {
    ipcRenderer.removeListener(channel, wrappedListener);
  }

  listenerMap.delete(channel);
}

contextBridge.exposeInMainWorld("api", {
  addEntry: (category, entry) =>
    ipcRenderer.invoke("add-entry", category, entry),

  getEntries: (category) =>
    ipcRenderer.invoke("getEntries", category),

  updateEntry: (category, id, entry) =>
    ipcRenderer.invoke("update-entry", category, id, entry),

  deleteEntry: (category, id) =>
    ipcRenderer.invoke("delete-entry", category, id),

  addGlorified: (entry) =>
    ipcRenderer.invoke("add-glorified", entry),

  getGlorified: () =>
    ipcRenderer.invoke("get-glorified"),

  deleteGlorified: (id) =>
    ipcRenderer.invoke("delete-glorified", id),

  getAppSettings: () =>
    ipcRenderer.invoke("get-app-settings"),

  saveAppSettings: (settings) =>
    ipcRenderer.invoke("save-app-settings", settings),

  openOverlayWithCost: (cost, shipType, tier, stormType) =>
    ipcRenderer.send(
      "open-overlay-with-cost",
      cost,
      shipType,
      tier,
      stormType
    ),

  openExternal: (url) =>
    ipcRenderer.invoke("openExternal", url),

  requestApi: (request) =>
    ipcRenderer.invoke("api:request", request),

  bootProgress: (msg) =>
    ipcRenderer.send("boot:progress", msg),

  bootDone: () =>
    ipcRenderer.send("boot:done"),

  saveCrabRun: (payload) =>
    ipcRenderer.invoke("crab:saveRun", payload),

  getRecentCrabRuns: (limit) =>
    ipcRenderer.invoke("crab:getRecentRuns", limit),

  getAllCrabRuns: () =>
    ipcRenderer.invoke("crab:getAllRuns"),

  getCrabRun: (runId) =>
    ipcRenderer.invoke("crab:getRun", runId),

  esiListCharacters: () =>
    ipcRenderer.invoke("esi:listCharacters"),

  esiLinkCharacter: () =>
    ipcRenderer.invoke("esi:linkCharacter"),

  esiRefreshCharacter: (characterId) =>
    ipcRenderer.invoke("esi:refreshCharacter", characterId),

  esiUnlinkCharacter: (characterId) =>
    ipcRenderer.invoke("esi:unlinkCharacter", characterId),

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
    removeAllListeners,
  },
});
