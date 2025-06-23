import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  win.loadURL('http://localhost:5173');
}

ipcMain.handle('add-entry', (event, category, entry) => {
  const { date } = entry;

  if (category === 'abyssals') {
    const { room1_isk = 0, room2_isk = 0, room3_isk = 0, time_taken = 0, fillament_cost = 0 } = entry;

    const stmt = db.prepare(`
      INSERT INTO abyssals (date, room1_isk, room2_isk, room3_isk, time_taken, fillament_cost) 
      VALUES (?, ?, ?, ?, ?, ?)
    `);
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
  const rows = stmt.all();
  return rows;
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
