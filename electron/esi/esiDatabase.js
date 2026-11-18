
export function initialiseEsiDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS esi_characters (
      character_id INTEGER PRIMARY KEY,
      character_name TEXT NOT NULL,
      encrypted_refresh_token TEXT NOT NULL,
      token_expires_at TEXT,
      last_validated_at TEXT,
      status TEXT NOT NULL DEFAULT 'valid',
      linked_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

export function listEsiCharacters(db) {
  return db.prepare(`
    SELECT
      character_id AS characterId,
      character_name AS name,
      token_expires_at AS tokenExpiresAt,
      last_validated_at AS lastValidatedAt,
      status,
      linked_at AS linkedAt
    FROM esi_characters
    ORDER BY character_name COLLATE NOCASE
  `).all();
}

export function getEsiCharacter(db, characterId) {
  return db.prepare(`
    SELECT *
    FROM esi_characters
    WHERE character_id = ?
  `).get(characterId);
}

export function saveEsiCharacter(db, character) {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO esi_characters (
      character_id,
      character_name,
      encrypted_refresh_token,
      token_expires_at,
      last_validated_at,
      status,
      linked_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, 'valid', ?, ?)
    ON CONFLICT(character_id) DO UPDATE SET
      character_name = excluded.character_name,
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      token_expires_at = excluded.token_expires_at,
      last_validated_at = excluded.last_validated_at,
      status = 'valid',
      updated_at = excluded.updated_at
  `).run(
    character.characterId,
    character.name,
    character.encryptedRefreshToken,
    character.tokenExpiresAt,
    now,
    now,
    now
  );
}

export function markEsiCharacterStatus(db, characterId, status) {
  if (!["valid", "attention"].includes(status)) {
    throw new Error("Invalid ESI connection status");
  }

  db.prepare(`
    UPDATE esi_characters
    SET status = ?, updated_at = ?
    WHERE character_id = ?
  `).run(status, new Date().toISOString(), characterId);
}

export function deleteEsiCharacter(db, characterId) {
  return db.prepare(`
    DELETE FROM esi_characters
    WHERE character_id = ?
  `).run(characterId).changes > 0;
}
