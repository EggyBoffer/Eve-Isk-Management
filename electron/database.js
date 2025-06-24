import Database from "better-sqlite3";
import path from "node:path";
import { app } from "electron";

const userDataPath = app.getPath("userData");
const dbPath = path.join(userDataPath, "isk-tracker.sqlite");

const db = new Database(dbPath);

// Create abyssals table if not exists (basic columns)
db.exec(`
CREATE TABLE IF NOT EXISTS abyssals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT
);
`);

// Function to add column if it doesn't exist
function addColumnIfNotExists(table, column, definition) {
  const stmt = db.prepare(`PRAGMA table_info(${table})`);
  const columns = stmt.all().map((col) => col.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

// Add missing columns one by one
addColumnIfNotExists("abyssals", "room1_isk", "INTEGER DEFAULT 0");
addColumnIfNotExists("abyssals", "room2_isk", "INTEGER DEFAULT 0");
addColumnIfNotExists("abyssals", "room3_isk", "INTEGER DEFAULT 0");
addColumnIfNotExists("abyssals", "time_taken", "INTEGER DEFAULT 0");
addColumnIfNotExists("abyssals", "fillament_cost", "INTEGER DEFAULT 0");

export default db;
