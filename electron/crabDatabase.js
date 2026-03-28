import Database from "better-sqlite3";
import path from "node:path";
import { app } from "electron";

const userDataPath = app.getPath("userData");
const dbPath = path.join(userDataPath, "crab-tracker.sqlite");

const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

function tableHasColumn(table, column) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  return columns.some((col) => col.name === column);
}

function addColumnIfNotExists(table, column, definition) {
  if (!tableHasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function initCrabDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS crab_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_date TEXT NOT NULL,
      primary_character TEXT DEFAULT '',
      site_type TEXT NOT NULL DEFAULT 'CRAB',
      beacon_type TEXT NOT NULL DEFAULT '',
      beacon_type_id INTEGER,
      beacon_cost REAL NOT NULL DEFAULT 0,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      bounties_total REAL NOT NULL DEFAULT 0,
      loot_total REAL NOT NULL DEFAULT 0,
      gross_total REAL NOT NULL DEFAULT 0,
      net_profit REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  addColumnIfNotExists("crab_runs", "primary_character", "TEXT DEFAULT ''");
  addColumnIfNotExists("crab_runs", "site_type", "TEXT NOT NULL DEFAULT 'CRAB'");
  addColumnIfNotExists("crab_runs", "beacon_type", "TEXT NOT NULL DEFAULT ''");
  addColumnIfNotExists("crab_runs", "beacon_type_id", "INTEGER");
  addColumnIfNotExists("crab_runs", "beacon_cost", "REAL NOT NULL DEFAULT 0");
  addColumnIfNotExists("crab_runs", "duration_minutes", "INTEGER NOT NULL DEFAULT 60");
  addColumnIfNotExists("crab_runs", "bounties_total", "REAL NOT NULL DEFAULT 0");
  addColumnIfNotExists("crab_runs", "loot_total", "REAL NOT NULL DEFAULT 0");
  addColumnIfNotExists("crab_runs", "gross_total", "REAL NOT NULL DEFAULT 0");
  addColumnIfNotExists("crab_runs", "net_profit", "REAL NOT NULL DEFAULT 0");
  addColumnIfNotExists("crab_runs", "created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");

  db.exec(`
    CREATE TABLE IF NOT EXISTS crab_bounties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      entry_time TEXT NOT NULL,
      character_name TEXT DEFAULT '',
      system_name TEXT DEFAULT '',
      amount REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES crab_runs(id) ON DELETE CASCADE
    );
  `);

  addColumnIfNotExists("crab_bounties", "character_name", "TEXT DEFAULT ''");
  addColumnIfNotExists("crab_bounties", "system_name", "TEXT DEFAULT ''");
  addColumnIfNotExists("crab_bounties", "amount", "REAL NOT NULL DEFAULT 0");
  addColumnIfNotExists("crab_bounties", "created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");

  db.exec(`
    CREATE TABLE IF NOT EXISTS crab_loot (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      item_name TEXT NOT NULL,
      type_id INTEGER,
      quantity INTEGER NOT NULL DEFAULT 0,
      unit_price REAL NOT NULL DEFAULT 0,
      total_price REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (run_id) REFERENCES crab_runs(id) ON DELETE CASCADE
    );
  `);

  addColumnIfNotExists("crab_loot", "type_id", "INTEGER");
  addColumnIfNotExists("crab_loot", "quantity", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfNotExists("crab_loot", "unit_price", "REAL NOT NULL DEFAULT 0");
  addColumnIfNotExists("crab_loot", "total_price", "REAL NOT NULL DEFAULT 0");
  addColumnIfNotExists("crab_loot", "created_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_crab_runs_run_date
    ON crab_runs(run_date);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_crab_bounties_run_id
    ON crab_bounties(run_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_crab_loot_run_id
    ON crab_loot(run_id);
  `);
}

initCrabDatabase();

const insertCrabRunStmt = db.prepare(`
  INSERT INTO crab_runs (
    run_date,
    primary_character,
    site_type,
    beacon_type,
    beacon_type_id,
    beacon_cost,
    duration_minutes,
    bounties_total,
    loot_total,
    gross_total,
    net_profit
  ) VALUES (
    @run_date,
    @primary_character,
    @site_type,
    @beacon_type,
    @beacon_type_id,
    @beacon_cost,
    @duration_minutes,
    @bounties_total,
    @loot_total,
    @gross_total,
    @net_profit
  )
`);

const insertCrabBountyStmt = db.prepare(`
  INSERT INTO crab_bounties (
    run_id,
    entry_time,
    character_name,
    system_name,
    amount
  ) VALUES (
    @run_id,
    @entry_time,
    @character_name,
    @system_name,
    @amount
  )
`);

const insertCrabLootStmt = db.prepare(`
  INSERT INTO crab_loot (
    run_id,
    item_name,
    type_id,
    quantity,
    unit_price,
    total_price
  ) VALUES (
    @run_id,
    @item_name,
    @type_id,
    @quantity,
    @unit_price,
    @total_price
  )
`);

const getRecentCrabRunsStmt = db.prepare(`
  SELECT
    id,
    run_date,
    primary_character,
    site_type,
    beacon_type,
    beacon_type_id,
    beacon_cost,
    duration_minutes,
    bounties_total,
    loot_total,
    gross_total,
    net_profit,
    created_at
  FROM crab_runs
  ORDER BY datetime(run_date) DESC, id DESC
  LIMIT ?
`);

const getAllCrabRunsStmt = db.prepare(`
  SELECT
    id,
    run_date,
    primary_character,
    site_type,
    beacon_type,
    beacon_type_id,
    beacon_cost,
    duration_minutes,
    bounties_total,
    loot_total,
    gross_total,
    net_profit,
    created_at
  FROM crab_runs
  ORDER BY datetime(run_date) DESC, id DESC
`);

const getCrabBountiesForRunStmt = db.prepare(`
  SELECT
    id,
    run_id,
    entry_time,
    character_name,
    system_name,
    amount,
    created_at
  FROM crab_bounties
  WHERE run_id = ?
  ORDER BY datetime(entry_time) DESC, id DESC
`);

const getCrabLootForRunStmt = db.prepare(`
  SELECT
    id,
    run_id,
    item_name,
    type_id,
    quantity,
    unit_price,
    total_price,
    created_at
  FROM crab_loot
  WHERE run_id = ?
  ORDER BY total_price DESC, id DESC
`);

const saveCrabRunTx = db.transaction((payload) => {
  const info = insertCrabRunStmt.run({
    run_date: payload.run_date,
    primary_character: payload.primary_character ?? "",
    site_type: payload.site_type,
    beacon_type: payload.beacon_type,
    beacon_type_id: payload.beacon_type_id ?? null,
    beacon_cost: Number(payload.beacon_cost ?? 0),
    duration_minutes: Number(payload.duration_minutes ?? 0),
    bounties_total: Number(payload.bounties_total ?? 0),
    loot_total: Number(payload.loot_total ?? 0),
    gross_total: Number(payload.gross_total ?? 0),
    net_profit: Number(payload.net_profit ?? 0),
  });

  const runId = info.lastInsertRowid;

  for (const bounty of payload.bounties ?? []) {
    insertCrabBountyStmt.run({
      run_id: runId,
      entry_time: bounty.entry_time,
      character_name: bounty.character_name ?? "",
      system_name: bounty.system_name ?? "",
      amount: Number(bounty.amount ?? 0),
    });
  }

  for (const loot of payload.loot ?? []) {
    insertCrabLootStmt.run({
      run_id: runId,
      item_name: loot.item_name,
      type_id: loot.type_id ?? null,
      quantity: Number(loot.quantity ?? 0),
      unit_price: Number(loot.unit_price ?? 0),
      total_price: Number(loot.total_price ?? 0),
    });
  }

  return Number(runId);
});

function hydrateRuns(runs) {
  return runs.map((run) => ({
    ...run,
    participants: getUniqueParticipantsForRun(run.id),
    bounties: getCrabBountiesForRunStmt.all(run.id),
    loot: getCrabLootForRunStmt.all(run.id),
  }));
}

export function saveCrabRun(payload) {
  return saveCrabRunTx(payload);
}

export function getRecentCrabRuns(limit = 25) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(250, Number(limit))) : 25;
  const runs = getRecentCrabRunsStmt.all(safeLimit);
  return hydrateRuns(runs);
}

export function getAllCrabRuns() {
  const runs = getAllCrabRunsStmt.all();
  return hydrateRuns(runs);
}

export function getCrabRunById(runId) {
  const run = db
    .prepare(`
      SELECT
        id,
        run_date,
        primary_character,
        site_type,
        beacon_type,
        beacon_type_id,
        beacon_cost,
        duration_minutes,
        bounties_total,
        loot_total,
        gross_total,
        net_profit,
        created_at
      FROM crab_runs
      WHERE id = ?
    `)
    .get(runId);

  if (!run) {
    return null;
  }

  return {
    ...run,
    participants: getUniqueParticipantsForRun(run.id),
    bounties: getCrabBountiesForRunStmt.all(run.id),
    loot: getCrabLootForRunStmt.all(run.id),
  };
}

function getUniqueParticipantsForRun(runId) {
  const rows = db
    .prepare(`
      SELECT DISTINCT character_name
      FROM crab_bounties
      WHERE run_id = ?
        AND TRIM(COALESCE(character_name, '')) <> ''
      ORDER BY character_name COLLATE NOCASE ASC
    `)
    .all(runId);

  return rows.map((row) => row.character_name);
}

export default db;