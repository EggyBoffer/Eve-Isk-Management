/* eslint-env node */
/* global process */

import { app, BrowserWindow, ipcMain, globalShortcut } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import os from "os";
import db from "./database.js";

console.log("DB path being used:", db.name);

// Ensure necessary columns exist
try {
  db.prepare(`ALTER TABLE abyssals ADD COLUMN tier TEXT`).run();
  console.log("✅ Added 'tier' column to abyssals");
} catch (err) {
  if (!err.message.includes("duplicate column")) console.error("❌ Error adding 'tier':", err.message);
}

try {
  db.prepare(`ALTER TABLE abyssals ADD COLUMN storm_type TEXT`).run();
  console.log("✅ Added 'storm_type' column to abyssals");
} catch (err) {
  if (!err.message.includes("duplicate column")) console.error("❌ Error adding 'storm_type':", err.message);
}

try {
  db.prepare(`ALTER TABLE abyssals ADD COLUMN ship_type TEXT`).run();
  console.log("✅ Added 'ship_type' column to abyssals");
} catch (err) {
  if (!err.message.includes("duplicate column")) console.error("❌ Error adding 'ship_type':", err.message);
}

const settingsPath = path.join(app.getPath('userData'), 'settings.json');
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

function createMainWindow() {
  const preloadPath = path.join(__dirname, "preload.js");

  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    show: false,
    icon: path.join(__dirname, "public", "iskonomy.ico"),
    title: "ISKonomy",
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  mainWindow.webContents.on("did-finish-load", () => {
    setTimeout(() => {
      splash?.close();
      mainWindow.show();
    }, 2000);
  });
}

function createSplash() {
  splash = new BrowserWindow({
    width: 320,
    height: 320,
    transparent: false,
    frame: false,
    alwaysOnTop: true,
    resizable: false,
    icon: path.join(__dirname, "public", "iskonomy.ico"),
    center: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  const logoPath = path.join(process.resourcesPath, 'splash-assets', 'iskonomy.png');

  splash.loadFile(path.join(__dirname, "splash.html"));
  splash.webContents.once("did-finish-load", () => {
    splash.webContents.send("logo-path", `file://${logoPath.replace(/\\/g, '/')}`);
    splash.show();
  });
}

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
      webSecurity: false,
    },
  });

  overlayWin.setAlwaysOnTop(true, "screen-saver");

  if (!app.isPackaged) {
    overlayWin.loadURL('http://localhost:5173/#/overlay');
  } else {
    overlayWin.loadFile(
      path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html'),
      { hash: '/overlay' }
    );
  }

  ipcMain.once('overlay-ready', () => {
  overlayWin.webContents.send('set-filament-settings', {
    fillament_cost: filamentCost,
    ship_type: activeShipType,
    tier: activeTier,
    storm_type: activeStormType,
  });
});


  globalShortcut.register('Escape', () => {
    overlayWin.close();
    globalShortcut.unregister('Escape');
  });

  overlayWin.on('close', () => saveSettings(overlayWin.getBounds()));
}

let filamentCost = 0;
let activeShipType = '';
let activeTier = '';
let activeStormType = '';

ipcMain.on('open-overlay-with-cost', (event, cost, shipType, tier, stormType) => {
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

ipcMain.handle('add-entry', (event, category, entry) => {
  const { date = new Date().toISOString().slice(0, 10) } = entry;

  try {
    if (category === 'abyssals') {
      const {
      room1_isk = 0,
      room2_isk = 0,
      room3_isk = 0,
      time_taken = 0,
      fillament_cost = 0,
      tier = '',
      storm_type = '',
      ship_type = ''
    } = entry;

      const stmt = db.prepare(`
        INSERT INTO abyssals (date, room1_isk, room2_isk, room3_isk, time_taken, fillament_cost, tier, storm_type, ship_type)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(date, room1_isk, room2_isk, room3_isk, time_taken, fillament_cost, tier, storm_type, ship_type);

    } else if (category === 'glorified') {
      const {
        isk_earned = 0,
        tier = '',
        storm_type = ''
      } = entry;

      const stmt = db.prepare(`
        INSERT INTO glorified (date, isk_earned, tier, storm_type)
        VALUES (?, ?, ?, ?)
      `);
      stmt.run(date, isk_earned, tier, storm_type);

    } else {
      const { isk_earned = 0 } = entry;

      const stmt = db.prepare(`
        INSERT INTO ${category} (date, isk_earned)
        VALUES (?, ?)
      `);
      stmt.run(date, isk_earned);
    }

    return { success: true };

  } catch (err) {
    console.error("Error occurred in handler for 'add-entry':", err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('get-entries', (event, category) => {
  const stmt = db.prepare(`SELECT * FROM ${category}`);
  return stmt.all();
});

ipcMain.handle('delete-entry', (event, category, id) => {
  const stmt = db.prepare(`DELETE FROM ${category} WHERE id = ?`);
  stmt.run(id);
  return { success: true };
});

ipcMain.handle('update-entry', (event, category, entry) => {
  const {
    id,
    date,
    room1_isk = 0,
    room2_isk = 0,
    room3_isk = 0,
    time_taken = 0,
    fillament_cost = 0,
    tier = '',
    storm_type = '',
    ship_type = ''
  } = entry;

  const stmt = db.prepare(`
    UPDATE ${category}
    SET date = ?, room1_isk = ?, room2_isk = ?, room3_isk = ?, time_taken = ?, fillament_cost = ?, tier = ?, storm_type = ?, ship_type = ?
    WHERE id = ?
  `);

  stmt.run(date, room1_isk, room2_isk, room3_isk, time_taken, fillament_cost, tier, storm_type, ship_type, id);
  return { success: true };
});

ipcMain.handle('add-glorified', (event, entry) => {
  const { date, isk_earned, tier, storm_type, name } = entry;
  const stmt = db.prepare(`
    INSERT INTO glorified (date, isk_earned, tier, storm_type, name)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(date, parseInt(isk_earned) || 0, tier, storm_type, name || '');
  return { success: true };
});

ipcMain.handle('get-glorified', () => {
  const stmt = db.prepare(`SELECT * FROM glorified`);
  return stmt.all();
});

import fs from "fs";

ipcMain.handle('get-db-size', () => {
  try {
    const stats = fs.statSync(db.name);
    return { size: stats.size };
  } catch (err) {
    return { error: err.message };
  }
});


ipcMain.handle('delete-glorified', (event, id) => {
  const stmt = db.prepare(`DELETE FROM glorified WHERE id = ?`);
  stmt.run(id);
  return { success: true };
});

ipcMain.on('close-overlay', () => {
  const overlay = BrowserWindow.getAllWindows().find(w => w.getTitle() === "Overlay");
  if (overlay) overlay.close();
});

app.whenReady().then(() => {
  createSplash();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (os.platform() !== 'darwin') app.quit();
});
