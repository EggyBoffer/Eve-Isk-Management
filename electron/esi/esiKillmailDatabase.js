const SOURCE_TYPES = new Set(["character", "corporation"]);
const CONNECTION_STATUSES = new Set(["valid", "attention"]);
const SYNC_STATUSES = new Set(["never", "running", "success", "error"]);

function validateSource(sourceType, characterId) {
  if (!SOURCE_TYPES.has(sourceType)) {
    throw new Error("Invalid killmail authorisation type");
  }
  if (!Number.isSafeInteger(characterId) || characterId <= 0) {
    throw new Error("Invalid authorising character ID");
  }
}

function validateCorporation(corporationId) {
  if (!Number.isSafeInteger(corporationId) || corporationId <= 0) {
    throw new Error("Invalid corporation ID");
  }
}

function validateStatus(status) {
  if (!CONNECTION_STATUSES.has(status)) {
    throw new Error("Invalid killmail connection status");
  }
}

function validateAuthorisation(authorisation) {
  const {
    sourceType,
    characterId,
    characterName,
    corporationId = null,
    corporationName = null,
    encryptedRefreshToken,
    tokenExpiresAt,
  } = authorisation ?? {};

  validateSource(sourceType, characterId);
  if (typeof characterName !== "string" || !characterName.trim()) {
    throw new Error("Invalid authorising character name");
  }
  if (sourceType === "corporation") {
    validateCorporation(corporationId);
    if (typeof corporationName !== "string" || !corporationName.trim()) {
      throw new Error("Invalid corporation name");
    }
  }
  if (typeof encryptedRefreshToken !== "string" || !encryptedRefreshToken) {
    throw new Error("Encrypted killmail refresh token is required");
  }
  if (typeof tokenExpiresAt !== "string" || !Number.isFinite(Date.parse(tokenExpiresAt))) {
    throw new Error("Invalid killmail token expiry");
  }
}

export function initialiseEsiKillmailDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS esi_killmail_authorisations (
      source_type TEXT NOT NULL CHECK (source_type IN ('character', 'corporation')),
      character_id INTEGER NOT NULL,
      character_name TEXT NOT NULL,
      corporation_id INTEGER,
      corporation_name TEXT,
      encrypted_refresh_token TEXT NOT NULL,
      token_expires_at TEXT NOT NULL,
      last_validated_at TEXT,
      status TEXT NOT NULL DEFAULT 'valid' CHECK (status IN ('valid', 'attention')),
      sync_enabled INTEGER NOT NULL DEFAULT 0 CHECK (sync_enabled IN (0, 1)),
      last_sync_started_at TEXT,
      last_successful_sync_at TEXT,
      last_sync_status TEXT NOT NULL DEFAULT 'never'
        CHECK (last_sync_status IN ('never', 'running', 'success', 'error')),
      last_sync_error TEXT,
      linked_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (source_type, character_id),
      CHECK (
        (source_type = 'character' AND corporation_id IS NULL AND corporation_name IS NULL)
        OR
        (source_type = 'corporation' AND corporation_id IS NOT NULL AND corporation_name IS NOT NULL)
      )
    );

    CREATE INDEX IF NOT EXISTS idx_esi_killmail_authorisations_corporation
    ON esi_killmail_authorisations (corporation_id);

    CREATE INDEX IF NOT EXISTS idx_esi_killmail_authorisations_sync
    ON esi_killmail_authorisations (sync_enabled, status);
  `);
}

export function listEsiKillmailAuthorisations(db, sourceType = null) {
  if (sourceType !== null && !SOURCE_TYPES.has(sourceType)) {
    throw new Error("Invalid killmail authorisation type");
  }

  return db.prepare(`
    SELECT
      source_type AS sourceType,
      character_id AS characterId,
      character_name AS characterName,
      corporation_id AS corporationId,
      corporation_name AS corporationName,
      token_expires_at AS tokenExpiresAt,
      last_validated_at AS lastValidatedAt,
      status,
      sync_enabled AS syncEnabled,
      last_sync_started_at AS lastSyncStartedAt,
      last_successful_sync_at AS lastSuccessfulSyncAt,
      last_sync_status AS lastSyncStatus,
      last_sync_error AS lastSyncError,
      linked_at AS linkedAt
    FROM esi_killmail_authorisations
    WHERE (? IS NULL OR source_type = ?)
    ORDER BY source_type, character_name COLLATE NOCASE
  `).all(sourceType, sourceType).map((row) => ({
    ...row,
    syncEnabled: row.syncEnabled === 1,
  }));
}

export function getEsiKillmailAuthorisation(db, sourceType, characterId) {
  validateSource(sourceType, characterId);

  return db.prepare(`
    SELECT * FROM esi_killmail_authorisations
    WHERE source_type = ? AND character_id = ?
  `).get(sourceType, characterId) ?? null;
}

export function saveEsiKillmailAuthorisation(db, authorisation) {
  validateAuthorisation(authorisation);
  const now = new Date().toISOString();
  const corporationId = authorisation.sourceType === "corporation"
    ? authorisation.corporationId
    : null;
  const corporationName = authorisation.sourceType === "corporation"
    ? authorisation.corporationName.trim()
    : null;

  db.prepare(`
    INSERT INTO esi_killmail_authorisations (
      source_type, character_id, character_name, corporation_id,
      corporation_name, encrypted_refresh_token, token_expires_at,
      last_validated_at, status, linked_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'valid', ?, ?)
    ON CONFLICT (source_type, character_id) DO UPDATE SET
      character_name = excluded.character_name,
      corporation_id = excluded.corporation_id,
      corporation_name = excluded.corporation_name,
      encrypted_refresh_token = excluded.encrypted_refresh_token,
      token_expires_at = excluded.token_expires_at,
      last_validated_at = excluded.last_validated_at,
      status = 'valid',
      updated_at = excluded.updated_at
  `).run(
    authorisation.sourceType,
    authorisation.characterId,
    authorisation.characterName.trim(),
    corporationId,
    corporationName,
    authorisation.encryptedRefreshToken,
    authorisation.tokenExpiresAt,
    now,
    now,
    now
  );

  return getEsiKillmailAuthorisation(
    db, authorisation.sourceType, authorisation.characterId
  );
}

export function markEsiKillmailAuthorisationStatus(db, sourceType, characterId, status) {
  validateSource(sourceType, characterId);
  validateStatus(status);

  return db.prepare(`
    UPDATE esi_killmail_authorisations
    SET status = ?, updated_at = ?
    WHERE source_type = ? AND character_id = ?
  `).run(status, new Date().toISOString(), sourceType, characterId).changes > 0;
}

export function setEsiKillmailSyncEnabled(db, sourceType, characterId, enabled) {
  validateSource(sourceType, characterId);
  if (typeof enabled !== "boolean") {
    throw new Error("Invalid killmail sync setting");
  }

  const result = db.prepare(`
    UPDATE esi_killmail_authorisations
    SET sync_enabled = ?, updated_at = ?
    WHERE source_type = ? AND character_id = ?
  `).run(Number(enabled), new Date().toISOString(), sourceType, characterId);

  if (result.changes === 0) {
    throw new Error("Killmail authorisation is not linked");
  }

  return enabled;
}

export function startEsiKillmailSync(db, sourceType, characterId) {
  validateSource(sourceType, characterId);
  const authorisation = getEsiKillmailAuthorisation(db, sourceType, characterId);
  if (!authorisation || authorisation.status !== "valid" || authorisation.sync_enabled !== 1) {
    throw new Error("Killmail authorisation is not enabled and valid");
  }
  if (authorisation.last_sync_status === "running") {
    throw new Error("Killmail synchronisation is already running");
  }

  const now = new Date().toISOString();
  db.prepare(`
    UPDATE esi_killmail_authorisations
    SET last_sync_started_at = ?, last_sync_status = 'running',
        last_sync_error = NULL, updated_at = ?
    WHERE source_type = ? AND character_id = ?
  `).run(now, now, sourceType, characterId);
}

export function completeEsiKillmailSync(db, sourceType, characterId) {
  validateSource(sourceType, characterId);
  const now = new Date().toISOString();
  const result = db.prepare(`
    UPDATE esi_killmail_authorisations
    SET last_successful_sync_at = ?, last_sync_status = 'success',
        last_sync_error = NULL, updated_at = ?
    WHERE source_type = ? AND character_id = ? AND last_sync_status = 'running'
  `).run(now, now, sourceType, characterId);

  if (result.changes === 0) {
    throw new Error("Killmail synchronisation is not running");
  }
}

export function failEsiKillmailSync(db, sourceType, characterId, error) {
  validateSource(sourceType, characterId);
  const now = new Date().toISOString();
  const message = (error instanceof Error ? error.message : String(error ?? "Unknown error"))
    .slice(0, 1000);

  const result = db.prepare(`
    UPDATE esi_killmail_authorisations
    SET last_sync_status = 'error', last_sync_error = ?, updated_at = ?
    WHERE source_type = ? AND character_id = ? AND last_sync_status = 'running'
  `).run(message, now, sourceType, characterId);

  if (result.changes === 0) {
    throw new Error("Killmail synchronisation is not running");
  }
}

export function deleteEsiKillmailAuthorisation(db, sourceType, characterId) {
  validateSource(sourceType, characterId);

  return db.prepare(`
    DELETE FROM esi_killmail_authorisations
    WHERE source_type = ? AND character_id = ?
  `).run(sourceType, characterId).changes > 0;
}