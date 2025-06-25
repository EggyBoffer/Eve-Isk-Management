/* eslint-env node */
/* global process */

import { app, BrowserWindow, ipcMain, globalShortcut } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import os from "os";
import db from "./database.js";

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

function createWindow() {
  const preloadPath = path.join(__dirname, "preload.js");
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    title: "MainApp",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  const isDev = !app.isPackaged;
  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
}

// ** Modified: store filament cost globally for overlay **
let filamentCost = 0;

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
    transparent: false,
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

  // 🔑 Once the overlay renderer tells us it's ready, send filament cost
  ipcMain.once('overlay-ready', () => {
    overlayWin.webContents.send('set-filament-settings', {
      fillament_cost: filamentCost,
    });
  });

  globalShortcut.register('Escape', () => {
    overlayWin.close();
    globalShortcut.unregister('Escape');
  });

  overlayWin.on('close', () => saveSettings(overlayWin.getBounds()));
}


// Listen for request to open overlay with cost
ipcMain.on('open-overlay-with-cost', (event, cost) => {
  filamentCost = cost; // save global filament cost
  createOverlay();
});

ipcMain.handle('add-entry', (event, category, entry) => {
  const { date } = entry;

  if (category === 'abyssals') {
    const { room1_isk = 0, room2_isk = 0, room3_isk = 0, time_taken = 0, fillament_cost = 0 } = entry;
    const stmt = db.prepare(
      `INSERT INTO abyssals (date, room1_isk, room2_isk, room3_isk, time_taken, fillament_cost) 
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    stmt.run(date, room1_isk, room2_isk, room3_isk, time_taken, fillament_cost);
  } else {
    const { isk_earned } = entry;
    const stmt = db.prepare(`INSERT INTO ${category} (date, isk_earned) VALUES (?, ?)`);
    stmt.run(date, isk_earned);
  }

  return { success: true };
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
  const { id, date, room1_isk, room2_isk, room3_isk, time_taken, fillament_cost } = entry;
  const stmt = db.prepare(
    `UPDATE ${category} 
     SET date = ?, room1_isk = ?, room2_isk = ?, room3_isk = ?, time_taken = ?, fillament_cost = ? 
     WHERE id = ?`
  );
  stmt.run(date, room1_isk, room2_isk, room3_isk, time_taken, fillament_cost, id);
  return { success: true };
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (os.platform() !== 'darwin') app.quit();
});

ipcMain.on('close-overlay', () => {
  const overlay = BrowserWindow.getAllWindows().find(w => w.getTitle() === "Overlay");
  if (overlay) overlay.close();
});
