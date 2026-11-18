
const { contextBridge, ipcRenderer } = require("electron");

function subscribe(channel, callback, transform) {
  if (typeof callback !== "function") {
    return () => {};
  }

  const listener = (_event, value) => {
    const result = transform(value);

    if (result !== undefined) {
      callback(result);
    }
  };

  ipcRenderer.on(channel, listener);

  return () => {
    ipcRenderer.removeListener(channel, listener);
  };
}

contextBridge.exposeInMainWorld("splashApi", {
  onLogoPath: (callback) =>
    subscribe("logo-path", callback, (value) =>
      typeof value === "string" ? value : undefined
    ),

  onProgress: (callback) =>
    subscribe("boot:progress", callback, (value) =>
      String(value ?? "").slice(0, 500)
    ),

  onVersion: (callback) =>
    subscribe("splash:version", callback, (value) =>
      typeof value === "string" ? value : undefined
    ),
});
