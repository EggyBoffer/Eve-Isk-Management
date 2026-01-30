import { app, BrowserWindow, ipcMain, globalShortcut, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import os from "os";
import db from "./database.js";

console.log("DB path being used:", db.name);

try {
  db.prepare(`ALTER TABLE abyssals ADD COLUMN tier TEXT`).run();
  console.log("✅ Added 'tier' column to abyssals");
} catch (err) {
  if (!err.message.includes("duplicate column"))
    console.error("❌ Error adding 'tier':", err.message);
}

try {
  db.prepare(`ALTER TABLE abyssals ADD COLUMN storm_type TEXT`).run();
  console.log("✅ Added 'storm_type' column to abyssals");
} catch (err) {
  if (!err.message.includes("duplicate column"))
    console.error("❌ Error adding 'storm_type':", err.message);
}

try {
  db.prepare(`ALTER TABLE abyssals ADD COLUMN ship_type TEXT`).run();
  console.log("✅ Added 'ship_type' column to abyssals");
} catch (err) {
  if (!err.message.includes("duplicate column"))
    console.error("❌ Error adding 'ship_type':", err.message);
}

const settingsPath = path.join(app.getPath("userData"), "settings.json");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

let mainWindow;
let splash;

function notifyEntriesUpdated(table, action, extra = {}) {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("entries-updated", { table, action, ...extra });
    }
  } catch (err) {
    console.error("❌ Failed to notify renderer:", err);
  }
}

function getProdIndexPath() {
  // In production, app.getAppPath() points to .../resources/app.asar
  // dist/** will live INSIDE the asar (as it should).
  return path.join(app.getAppPath(), "dist", "index.html");
}

function createMainWindow() {
  const preloadPath = path.join(__dirname, "preload.js");

  const windowIcon = app.isPackaged
    ? path.join(process.resourcesPath, "iskonomy.ico")
    : path.join(process.cwd(), "public", "iskonomy.ico");

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    show: false,
    icon: windowIcon,
    title: "ISKonomy",
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    const indexPath = getProdIndexPath();

    if (!fs.existsSync(indexPath)) {
      console.error("❌ UI file missing in packaged build:", indexPath);
    }

    mainWindow.loadFile(indexPath);
  }

  mainWindow.webContents.on("did-fail-load", (_e, code, desc) => {
    try {
      splash?.webContents?.send("boot:progress", `Failed to load UI (${code}): ${desc}`);
    } catch {}
  });

  mainWindow.webContents.on("did-finish-load", () => {
    splash?.webContents?.send("boot:progress", "Starting ISKONOMY!...");
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    if (splash && !splash.isDestroyed()) splash.close();
    splash = null;
  });
}

function createSplash() {
  const windowIcon = app.isPackaged
    ? path.join(process.resourcesPath, "iskonomy.ico")
    : path.join(process.cwd(), "public", "iskonomy.ico");

  splash = new BrowserWindow({
    width: 320,
    height: 320,
    transparent: false,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    icon: windowIcon,
    center: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const logoPath = path.join(process.resourcesPath, "splash-assets", "iskonomy.png");

  splash.loadFile(path.join(__dirname, "splash.html"));
  splash.webContents.once("did-finish-load", () => {
    splash.webContents.send("logo-path", `file://${logoPath.replace(/\\/g, "/")}`);
    splash.show();
  });

  splash.on("closed", () => {
    splash = null;
  });
}

ipcMain.on("boot:progress", (_event, msg) => {
  if (splash && !splash.isDestroyed()) {
    splash.webContents.send("boot:progress", String(msg || ""));
  }
});

ipcMain.on("boot:done", () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    mainWindow.focus();
  }

  if (splash && !splash.isDestroyed()) {
    splash.close();
  }
});

function createOverlay() {
  const savedSettings = loadSettings();

  const overlayWin = new BrowserWindow({
    width: 275,
    height: 80,
    x: savedSettings.x,
    y: savedSettings.y,
    title: "Overlay",
    alwaysOnTop: true,
    frame: false,
    backgroundColor: "#121217",
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    }
  });

  overlayWin.setAlwaysOnTop(true, "screen-saver");

  if (!app.isPackaged) {
    overlayWin.loadURL("http://localhost:5173/#/overlay");
  } else {
    const indexPath = getProdIndexPath();

    if (!fs.existsSync(indexPath)) {
      console.error("❌ UI file missing for overlay in packaged build:", indexPath);
    }

    overlayWin.loadFile(indexPath, { hash: "/overlay" });
  }

  ipcMain.once("overlay-ready", () => {
    overlayWin.webContents.send("set-filament-settings", {
      fillament_cost: filamentCost,
      ship_type: activeShipType,
      tier: activeTier,
      storm_type: activeStormType
    });
  });

  globalShortcut.register("Escape", () => {
    overlayWin.close();
    globalShortcut.unregister("Escape");
  });

  overlayWin.on("close", () => saveSettings(overlayWin.getBounds()));
}

let filamentCost = 0;
let activeShipType = "";
let activeTier = "";
let activeStormType = "";

ipcMain.on("open-overlay-with-cost", (event, cost, shipType, tier, stormType) => {
  filamentCost = cost;
  activeShipType = shipType;
  activeTier = tier;
  activeStormType = stormType;
  createOverlay();
});

ipcMain.handle("get-app-settings", () => loadSettings());

ipcMain.handle("save-app-settings", (event, newSettings) => {
  saveSettings(newSettings);
  return { success: true };
});

ipcMain.handle("add-entry", (event, category, entry) => {
  const { date = new Date().toISOString().slice(0, 10) } = entry;

  try {
    if (category === "abyssals") {
      const {
        room1_isk = 0,
        room2_isk = 0,
        room3_isk = 0,
        time_taken = 0,
        fillament_cost = 0,
        tier = "",
        storm_type = "",
        ship_type = ""
      } = entry;

      const stmt = db.prepare(`
        INSERT INTO abyssals (date, room1_isk, room2_isk, room3_isk, time_taken, fillament_cost, tier, storm_type, ship_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        date,
        room1_isk,
        room2_isk,
        room3_isk,
        time_taken,
        fillament_cost,
        tier,
        storm_type,
        ship_type
      );

      notifyEntriesUpdated("abyssals", "add", { id: info.lastInsertRowid });
    } else if (category === "glorified") {
      const { isk_earned = 0, tier = "", storm_type = "" } = entry;

      const stmt = db.prepare(`
        INSERT INTO glorified (date, isk_earned, tier, storm_type)
        VALUES (?, ?, ?, ?)
      `);
      const info = stmt.run(date, isk_earned, tier, storm_type);

      notifyEntriesUpdated("glorified", "add", { id: info.lastInsertRowid });
    } else {
      const { isk_earned = 0 } = entry;

      const stmt = db.prepare(`
        INSERT INTO ${category} (date, isk_earned)
        VALUES (?, ?)
      `);
      const info = stmt.run(date, isk_earned);

      notifyEntriesUpdated(category, "add", { id: info.lastInsertRowid });
    }

    return { success: true };
  } catch (err) {
    console.error("❌ add-entry failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("update-entry", (event, category, id, entry) => {
  try {
    if (category === "abyssals") {
      const {
        room1_isk = 0,
        room2_isk = 0,
        room3_isk = 0,
        time_taken = 0,
        fillament_cost = 0,
        tier = "",
        storm_type = "",
        ship_type = ""
      } = entry;

      db.prepare(`
        UPDATE abyssals
        SET room1_isk = ?, room2_isk = ?, room3_isk = ?, time_taken = ?, fillament_cost = ?, tier = ?, storm_type = ?, ship_type = ?
        WHERE id = ?
      `).run(
        room1_isk,
        room2_isk,
        room3_isk,
        time_taken,
        fillament_cost,
        tier,
        storm_type,
        ship_type,
        id
      );

      notifyEntriesUpdated("abyssals", "update", { id });
    }

    return { success: true };
  } catch (err) {
    console.error("❌ update-entry failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("delete-entry", (event, category, id) => {
  try {
    db.prepare(`DELETE FROM ${category} WHERE id = ?`).run(id);
    notifyEntriesUpdated(category, "delete", { id });
    return { success: true };
  } catch (err) {
    console.error("❌ delete-entry failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("getEntries", (event, category) => {
  try {
    const stmt = db.prepare(`SELECT * FROM ${category} ORDER BY date DESC`);
    return stmt.all();
  } catch (err) {
    console.error("❌ getEntries failed:", err);
    return [];
  }
});

ipcMain.handle("add-glorified", (event, drop) => {
  try {
    const {
      date = new Date().toISOString().slice(0, 10),
      isk_earned = 0,
      tier = "",
      storm_type = ""
    } = drop;

    const stmt = db.prepare(`
      INSERT INTO glorified (date, isk_earned, tier, storm_type)
      VALUES (?, ?, ?, ?)
    `);
    const info = stmt.run(date, isk_earned, tier, storm_type);

    notifyEntriesUpdated("glorified", "add", { id: info.lastInsertRowid });
    return { success: true };
  } catch (err) {
    console.error("❌ add-glorified failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("delete-glorified", (event, id) => {
  try {
    db.prepare(`DELETE FROM glorified WHERE id = ?`).run(id);
    notifyEntriesUpdated("glorified", "delete", { id });
    return { success: true };
  } catch (err) {
    console.error("❌ delete-glorified failed:", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle("get-glorified", () => {
  try {
    return db.prepare(`SELECT * FROM glorified ORDER BY date DESC`).all();
  } catch (err) {
    console.error("❌ get-glorified failed:", err);
    return [];
  }
});

ipcMain.handle("openExternal", (event, url) => {
  if (!url) return;
  shell.openExternal(url);
});

function getLocalIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) return iface.address;
    }
  }
  return "127.0.0.1";
}

app.whenReady().then(() => {
  createSplash();
  createMainWindow();

  app.on("activate", function () {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
