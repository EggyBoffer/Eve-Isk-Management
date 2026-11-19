
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

    CREATE TABLE IF NOT EXISTS esi_corporation_authorisations (
      character_id INTEGER PRIMARY KEY,
      character_name TEXT NOT NULL,
      corporation_id INTEGER NOT NULL,
      corporation_name TEXT NOT NULL,
      encrypted_refresh_token TEXT NOT NULL,
      token_expires_at TEXT,
      last_validated_at TEXT,
      status TEXT NOT NULL DEFAULT 'valid',
      linked_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_esi_corporation_authorisations_corporation
    ON esi_corporation_authorisations (corporation_id);
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

export function listEsiCorporationAuthorisations(db) {
  return db.prepare(`
    SELECT
      character_id AS characterId,
      character_name AS characterName,
      corporation_id AS corporationId,
      corporation_name AS corporationName,
      token_expires_at AS tokenExpiresAt,
      last_validated_at AS lastValidatedAt,
      status,
      linked_at AS linkedAt
    FROM esi_corporation_authorisations
    ORDER BY corporation_name COLLATE NOCASE,
             character_name COLLATE NOCASE
  `).all();
}

export function getEsiCorporationAuthorisation(db, characterId) {
  return db.prepare(`
    SELECT *
    FROM esi_corporation_authorisations
    WHERE character_id = ?
  `).get(characterId);
}

export function listEsiCorporationAuthorisationsForCorporation(
  db,
  corporationId
) {
  return db.prepare(`
    SELECT
      character_id AS characterId,
      character_name AS characterName,
      corporation_id AS corporationId,
      corporation_name AS corporationName,
      token_expires_at AS tokenExpiresAt,
      last_validated_at AS lastValidatedAt,
      status,
      linked_at AS linkedAt
    FROM esi_corporation_authorisations
    WHERE corporation_id = ?
    ORDER BY character_name COLLATE NOCASE
  `).all(corporationId);
}

export function saveEsiCorporationAuthorisation(db, authorisation) {
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO esi_corporation_authorisations (
      character_id,
      character_name,
      corporation_id,
      corporation_name,
      encrypted_refresh_token,
      token_expires_at,
      last_validated_at,
      status,
      linked_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 'valid', ?, ?)
    ON CONFLICT(character_id) DO UPDATE SET
      character_name = excluded.character_name,
      corporation_id = excluded.corporation_id,
      corporation_name = excluded.corporation_name,
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      token_expires_at = excluded.token_expires_at,
      last_validated_at = excluded.last_validated_at,
      status = 'valid',
      updated_at = excluded.updated_at
  `).run(
    authorisation.characterId,
    authorisation.characterName,
    authorisation.corporationId,
    authorisation.corporationName,
    authorisation.encryptedRefreshToken,
    authorisation.tokenExpiresAt,
    now,
    now,
    now
  );
}

export function markEsiCorporationAuthorisationStatus(
  db,
  characterId,
  status
) {
  if (!["valid", "attention"].includes(status)) {
    throw new Error("Invalid ESI connection status");
  }

  return db.prepare(`
    UPDATE esi_corporation_authorisations
    SET status = ?, updated_at = ?
    WHERE character_id = ?
  `).run(
    status,
    new Date().toISOString(),
    characterId
  ).changes > 0;
}

export function deleteEsiCorporationAuthorisation(db, characterId) {
  return db.prepare(`
    DELETE FROM esi_corporation_authorisations
    WHERE character_id = ?
  `).run(characterId).changes > 0;
}
