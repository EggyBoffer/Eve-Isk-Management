export function initialiseOfficerDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS officer_kills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL DEFAULT 'character',
      character_id INTEGER NOT NULL,
      division INTEGER NOT NULL DEFAULT 1,
      journal_id INTEGER NOT NULL,
      npc_type_id INTEGER NOT NULL,
      npc_name TEXT NOT NULL,
      npc_group_id INTEGER NOT NULL,
      officer_class TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      killed_at TEXT NOT NULL,
      wallet_amount REAL NOT NULL DEFAULT 0,
      description TEXT NOT NULL DEFAULT '',
      loot_text TEXT NOT NULL DEFAULT '',
      loot_value REAL NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (source_type, character_id, division, journal_id, npc_type_id)
    );
    CREATE INDEX IF NOT EXISTS idx_officer_kills_date ON officer_kills (killed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_officer_kills_character ON officer_kills (character_id, killed_at DESC);
    CREATE INDEX IF NOT EXISTS idx_officer_kills_type ON officer_kills (npc_type_id);
  `);
}

function validateOfficer(officer) {
  if (!officer || typeof officer !== "object") throw new Error("Invalid officer record");
  const characterId = officer.characterId;
  const journalId = officer.journalId;
  const typeId = officer.typeId;
  const groupId = officer.groupId;
  const division = officer.division ?? 1;
  const sourceType = officer.sourceType ?? "character";
  const quantity = officer.quantity ?? 1;
  if (
    sourceType !== "character" ||
    !Number.isSafeInteger(characterId) || characterId <= 0 ||
    !Number.isSafeInteger(journalId) || journalId <= 0 ||
    !Number.isSafeInteger(typeId) || typeId <= 0 ||
    !Number.isSafeInteger(groupId) || groupId <= 0 ||
    division !== 1 ||
    !Number.isSafeInteger(quantity) || quantity <= 0 ||
    typeof officer.name !== "string" || !officer.name.trim() ||
    !["Battleship", "Cruiser", "Frigate"].includes(officer.officerClass) ||
    typeof officer.date !== "string" || !Number.isFinite(Date.parse(officer.date)) ||
    !Number.isFinite(officer.walletAmount ?? 0)
  ) throw new Error("Invalid officer record data");
}

export function saveOfficerKill(db, officer) {
  validateOfficer(officer);
  const now = new Date().toISOString();
  const result = db.prepare(`
    INSERT INTO officer_kills (
      source_type, character_id, division, journal_id, npc_type_id, npc_name,
      npc_group_id, officer_class, quantity, killed_at, wallet_amount,
      description, created_at, updated_at
    ) VALUES (
      @sourceType, @characterId, @division, @journalId, @typeId, @name,
      @groupId, @officerClass, @quantity, @date, @walletAmount,
      @description, @now, @now
    )
    ON CONFLICT (source_type, character_id, division, journal_id, npc_type_id)
    DO UPDATE SET
      npc_name = excluded.npc_name,
      npc_group_id = excluded.npc_group_id,
      officer_class = excluded.officer_class,
      quantity = excluded.quantity,
      killed_at = excluded.killed_at,
      wallet_amount = excluded.wallet_amount,
      description = excluded.description,
      updated_at = excluded.updated_at
  `).run({
    sourceType: "character",
    characterId: officer.characterId,
    division: 1,
    journalId: officer.journalId,
    typeId: officer.typeId,
    name: officer.name.trim(),
    groupId: officer.groupId,
    officerClass: officer.officerClass,
    quantity: officer.quantity ?? 1,
    date: officer.date,
    walletAmount: officer.walletAmount ?? 0,
    description: officer.description ?? "",
    now,
  });
  return { id: Number(result.lastInsertRowid), changes: result.changes };
}

export function saveOfficerKills(db, officers) {
  if (!Array.isArray(officers)) throw new Error("Invalid officer records");
  const transaction = db.transaction((records) => {
    let processed = 0;
    for (const officer of records) {
      saveOfficerKill(db, officer);
      processed++;
    }
    return { processed };
  });
  return transaction(officers);
}

export function listOfficerKills(db, { characterId = null, limit = 100, offset = 0 } = {}) {
  if (
    (characterId !== null && (!Number.isSafeInteger(characterId) || characterId <= 0)) ||
    !Number.isSafeInteger(limit) || limit < 1 || limit > 1000 ||
    !Number.isSafeInteger(offset) || offset < 0
  ) throw new Error("Invalid officer query");
  return db.prepare(`
    SELECT id, source_type AS sourceType, character_id AS characterId, division,
      journal_id AS journalId, npc_type_id AS typeId, npc_name AS name,
      npc_group_id AS groupId, officer_class AS officerClass, quantity,
      killed_at AS date, wallet_amount AS walletAmount, description,
      loot_text AS lootText, loot_value AS lootValue, notes,
      created_at AS createdAt, updated_at AS updatedAt
    FROM officer_kills
    WHERE (@characterId IS NULL OR character_id = @characterId)
    ORDER BY killed_at DESC, id DESC
    LIMIT @limit OFFSET @offset
  `).all({ characterId, limit, offset });
}

export function getOfficerKill(db, id) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid officer ID");
  return db.prepare(`SELECT * FROM officer_kills WHERE id = ?`).get(id) ?? null;
}

export function updateOfficerLoot(db, id, { lootText, lootValue, notes }) {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid officer ID");
  if (
    typeof lootText !== "string" || lootText.length > 100000 ||
    !Number.isFinite(lootValue) || lootValue < 0 ||
    typeof notes !== "string" || notes.length > 10000
  ) throw new Error("Invalid officer loot data");
  return db.prepare(`
    UPDATE officer_kills
    SET loot_text = ?, loot_value = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).run(lootText, lootValue, notes, new Date().toISOString(), id).changes > 0;
}

export function getOfficerSummary(db) {
  return db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS totalKills,
      COUNT(*) AS totalRecords,
      COALESCE(SUM(loot_value), 0) AS totalLootValue,
      COUNT(DISTINCT character_id) AS characters,
      MIN(killed_at) AS oldestKill,
      MAX(killed_at) AS newestKill
    FROM officer_kills
  `).get();
}