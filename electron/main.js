import { app, BrowserWindow, ipcMain, globalShortcut } from "electron";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import os from "os";
import db from "./database.js";



// Path to store settings
const settingsPath = path.join(app.getPath('userData'), 'settings.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read settings
function loadSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath));
  } catch {
    return {};
  }
}

// Save settings
function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

// Create main application window
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

// Create overlay window
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
  transparent: false,               // <== CHANGE HERE
  backgroundColor: "#121217",       // <== MATCH your CSS background-color
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
  const indexPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html');
  overlayWin.loadFile(indexPath);
  overlayWin.webContents.once('did-finish-load', () => {
    overlayWin.webContents.executeJavaScript(`window.location.hash = "/overlay"`);
  });
}

  globalShortcut.register('Escape', () => {
    overlayWin.close();
    globalShortcut.unregister('Escape');
  });

  overlayWin.on('close', () => saveSettings(overlayWin.getBounds()));
}

// Listen for request to open overlay
ipcMain.on('open-overlay', () => {
  console.log('Received request to open overlay.');
  createOverlay();
});

// === IPC handlers for database operations ===
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
    const stmt = db.prepare(
      `INSERT INTO ${category} (date, isk_earned) VALUES (?, ?)`
    );
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

// App lifecycle
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
  const overlay = BrowserWindow.getAllWindows().find(
    w => w.getTitle() === "Overlay"
  );
  if (overlay) {
    overlay.close();
  }
});
