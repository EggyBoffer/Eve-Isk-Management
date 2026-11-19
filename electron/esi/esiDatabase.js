const FOB_GROSS_REWARD = 100_000_000;

function isFobCandidate(sourceType, refType, amount, taxRate = null) {
  if (refType !== "corporate_reward_payout") return false;
  if (Math.abs(amount - FOB_GROSS_REWARD) < 0.01) return true;
  if (sourceType !== "character" || amount <= 0) return false;

  if (Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 1) {
    const expected = Math.round(FOB_GROSS_REWARD * (1 - taxRate));
    return Math.abs(amount - expected) <= 1;
  }

  return Math.abs(amount - 99_000_000) < 0.01;
}

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

    CREATE TABLE IF NOT EXISTS esi_wallet_journal (
      source_type TEXT NOT NULL
        CHECK (source_type IN ('character', 'corporation')),
      owner_id INTEGER NOT NULL,
      division INTEGER NOT NULL,
      journal_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      ref_type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      first_party_id INTEGER,
      second_party_id INTEGER,
      context_id INTEGER,
      context_id_type TEXT,
      reason TEXT NOT NULL DEFAULT '',
      candidate_fob INTEGER NOT NULL DEFAULT 0,
      first_imported_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      PRIMARY KEY (
        source_type,
        owner_id,
        division,
        journal_id
      )
    );

    CREATE INDEX IF NOT EXISTS idx_esi_wallet_journal_date
    ON esi_wallet_journal (date DESC);

    CREATE INDEX IF NOT EXISTS idx_esi_wallet_journal_fob
    ON esi_wallet_journal (
      candidate_fob,
      date DESC
    );

    CREATE INDEX IF NOT EXISTS idx_esi_wallet_journal_recipient
    ON esi_wallet_journal (
      second_party_id,
      date DESC
    );
  `);

  db.prepare(`
    UPDATE esi_wallet_journal
    SET candidate_fob = 1
    WHERE candidate_fob = 0
      AND ref_type = 'corporate_reward_payout'
      AND (
        amount = 100000000
        OR (source_type = 'character' AND amount = 99000000)
      )
  `).run();

  initialiseEsiWalletSyncDatabase(db);
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

export function importEsiWalletJournal(
  db,
  sourceType,
  ownerId,
  division,
  entries
) {
  if (!["character", "corporation"].includes(sourceType)) {
    throw new Error("Invalid wallet source type");
  }

  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
    throw new Error("Invalid wallet owner ID");
  }

  if (
    !Number.isSafeInteger(division) ||
    division < 1 ||
    division > 7 ||
    (sourceType === "character" && division !== 1)
  ) {
    throw new Error("Invalid wallet division");
  }

  if (!Array.isArray(entries)) {
    throw new Error("Invalid wallet journal entries");
  }

  const insert = db.prepare(`
    INSERT INTO esi_wallet_journal (
      source_type,
      owner_id,
      division,
      journal_id,
      date,
      ref_type,
      amount,
      description,
      first_party_id,
      second_party_id,
      context_id,
      context_id_type,
      reason,
      candidate_fob,
      first_imported_at,
      last_seen_at
    )
    VALUES (
      @sourceType,
      @ownerId,
      @division,
      @journalId,
      @date,
      @refType,
      @amount,
      @description,
      @firstPartyId,
      @secondPartyId,
      @contextId,
      @contextIdType,
      @reason,
      @candidateFob,
      @now,
      @now
    )
    ON CONFLICT (
      source_type,
      owner_id,
      division,
      journal_id
    ) DO UPDATE SET
      date = excluded.date,
      ref_type = excluded.ref_type,
      amount = excluded.amount,
      description = excluded.description,
      first_party_id = excluded.first_party_id,
      second_party_id = excluded.second_party_id,
      context_id = excluded.context_id,
      context_id_type = excluded.context_id_type,
      reason = excluded.reason,
      candidate_fob = excluded.candidate_fob,
      last_seen_at = excluded.last_seen_at
  `);

  const exists = db.prepare(`
    SELECT 1
    FROM esi_wallet_journal
    WHERE source_type = ?
      AND owner_id = ?
      AND division = ?
      AND journal_id = ?
  `);

  const importTransaction = db.transaction((journalEntries) => {
    const now = new Date().toISOString();
    const seen = new Set();

    let inserted = 0;
    let updated = 0;

    for (const entry of journalEntries) {
      const journalId = Number(entry?.journalId);

      if (!Number.isSafeInteger(journalId) || journalId <= 0) {
        throw new Error("Invalid wallet journal ID");
      }

      if (seen.has(journalId)) {
        continue;
      }

      seen.add(journalId);

      const refType = entry.ref_type ?? entry.refType;
      const amount = entry.amount;
      const taxRate = entry.taxRate ?? entry.tax_rate ?? null;

      if (
        taxRate !== null &&
        (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1)
      ) {
        throw new Error("Invalid corporation tax rate");
      }

      if (
        typeof entry.date !== "string" ||
        !Number.isFinite(Date.parse(entry.date)) ||
        typeof refType !== "string" ||
        !Number.isFinite(amount)
      ) {
        throw new Error("Invalid wallet journal transaction");
      }

      const previous = exists.get(
        sourceType,
        ownerId,
        division,
        journalId
      );

      const firstPartyId =
        entry.first_party_id ?? entry.firstPartyId ?? null;

      const secondPartyId =
        entry.second_party_id ?? entry.secondPartyId ?? null;

      const contextId =
        entry.context_id ?? entry.contextId ?? null;

      const contextIdType =
        entry.context_id_type ?? entry.contextIdType ?? null;

      insert.run({
        sourceType,
        ownerId,
        division,
        journalId,
        date: entry.date,
        refType,
        amount,
        description: entry.description ?? "",
        firstPartyId,
        secondPartyId,
        contextId,
        contextIdType,
        reason: entry.reason ?? "",
        candidateFob: Number(
          isFobCandidate(sourceType, refType, amount, taxRate) ||
          previous?.candidate_fob === 1
        ),
        now,
      });

      if (previous) {
        updated++;
      } else {
        inserted++;
      }
    }

    return {
      sourceType,
      ownerId,
      division,
      processed: seen.size,
      inserted,
      updated,
    };
  });

  return importTransaction(entries);
}

export function listEsiWalletJournal(
  db,
  {
    sourceType = null,
    ownerId = null,
    candidateFob = null,
    limit = 100,
    offset = 0,
  } = {}
) {
  if (
    !Number.isSafeInteger(limit) ||
    limit < 1 ||
    limit > 1000 ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  ) {
    throw new Error("Invalid wallet journal pagination");
  }

  if (
    sourceType !== null &&
    !["character", "corporation"].includes(sourceType)
  ) {
    throw new Error("Invalid wallet source type");
  }

  if (
    ownerId !== null &&
    (!Number.isSafeInteger(ownerId) || ownerId <= 0)
  ) {
    throw new Error("Invalid wallet owner ID");
  }

  if (
    candidateFob !== null &&
    typeof candidateFob !== "boolean"
  ) {
    throw new Error("Invalid FOB filter");
  }

  return db.prepare(`
    SELECT
      source_type AS sourceType,
      owner_id AS ownerId,
      division,
      journal_id AS journalId,
      date,
      ref_type AS refType,
      amount,
      description,
      first_party_id AS firstPartyId,
      second_party_id AS secondPartyId,
      context_id AS contextId,
      context_id_type AS contextIdType,
      reason,
      candidate_fob AS candidateFob,
      first_imported_at AS firstImportedAt,
      last_seen_at AS lastSeenAt
    FROM esi_wallet_journal
    WHERE (@sourceType IS NULL OR source_type = @sourceType)
      AND (@ownerId IS NULL OR owner_id = @ownerId)
      AND (@candidateFob IS NULL OR candidate_fob = @candidateFob)
    ORDER BY date DESC, journal_id DESC
    LIMIT @limit OFFSET @offset
  `).all({
    sourceType,
    ownerId,
    candidateFob:
      candidateFob === null ? null : Number(candidateFob),
    limit,
    offset,
  });
}

export function getEsiWalletJournalSummary(db) {
  return db.prepare(`
    SELECT
      COUNT(*) AS totalTransactions,
      COALESCE(SUM(candidate_fob), 0) AS candidatePayouts,
      COALESCE(
        SUM(
          CASE
            WHEN candidate_fob = 1 THEN amount
            ELSE 0
          END
        ),
        0
      ) AS candidateIncome,
      MIN(date) AS oldestTransaction,
      MAX(date) AS newestTransaction
    FROM esi_wallet_journal
  `).get();
}


export function initialiseEsiWalletSyncDatabase(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS esi_wallet_sync_state (
      source_type TEXT NOT NULL
        CHECK (source_type IN ('character', 'corporation')),
      owner_id INTEGER NOT NULL,
      division INTEGER NOT NULL,
      backfill_status TEXT NOT NULL DEFAULT 'not_started'
        CHECK (
          backfill_status IN (
            'not_started',
            'in_progress',
            'complete',
            'error'
          )
        ),
      backfill_next_page INTEGER NOT NULL DEFAULT 1,
      backfill_pages_fetched INTEGER NOT NULL DEFAULT 0,
      backfill_started_at TEXT,
      backfill_completed_at TEXT,
      last_sync_started_at TEXT,
      last_successful_sync_at TEXT,
      last_sync_status TEXT NOT NULL DEFAULT 'never'
        CHECK (
          last_sync_status IN (
            'never',
            'running',
            'success',
            'error'
          )
        ),
      last_error TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (
        source_type,
        owner_id,
        division
      )
    );

    CREATE INDEX IF NOT EXISTS idx_esi_wallet_sync_status
    ON esi_wallet_sync_state (
      backfill_status,
      last_sync_status
    );
  `);
}

function validateEsiWalletSyncIdentity(
  sourceType,
  ownerId,
  division
) {
  if (!["character", "corporation"].includes(sourceType)) {
    throw new Error("Invalid wallet source type");
  }

  if (!Number.isSafeInteger(ownerId) || ownerId <= 0) {
    throw new Error("Invalid wallet owner ID");
  }

  if (
    !Number.isSafeInteger(division) ||
    division < 1 ||
    division > 7 ||
    (sourceType === "character" && division !== 1)
  ) {
    throw new Error("Invalid wallet division");
  }
}

export function ensureEsiWalletSyncState(
  db,
  sourceType,
  ownerId,
  division
) {
  validateEsiWalletSyncIdentity(
    sourceType,
    ownerId,
    division
  );

  db.prepare(`
    INSERT INTO esi_wallet_sync_state (
      source_type,
      owner_id,
      division,
      updated_at
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT (
      source_type,
      owner_id,
      division
    ) DO NOTHING
  `).run(
    sourceType,
    ownerId,
    division,
    new Date().toISOString()
  );

  return getEsiWalletSyncState(
    db,
    sourceType,
    ownerId,
    division
  );
}

export function getEsiWalletSyncState(
  db,
  sourceType,
  ownerId,
  division
) {
  validateEsiWalletSyncIdentity(
    sourceType,
    ownerId,
    division
  );

  return db.prepare(`
    SELECT
      source_type AS sourceType,
      owner_id AS ownerId,
      division,
      backfill_status AS backfillStatus,
      backfill_next_page AS backfillNextPage,
      backfill_pages_fetched AS backfillPagesFetched,
      backfill_started_at AS backfillStartedAt,
      backfill_completed_at AS backfillCompletedAt,
      last_sync_started_at AS lastSyncStartedAt,
      last_successful_sync_at AS lastSuccessfulSyncAt,
      last_sync_status AS lastSyncStatus,
      last_error AS lastError,
      updated_at AS updatedAt
    FROM esi_wallet_sync_state
    WHERE source_type = ?
      AND owner_id = ?
      AND division = ?
  `).get(
    sourceType,
    ownerId,
    division
  ) ?? null;
}

export function listEsiWalletSyncStates(db) {
  return db.prepare(`
    SELECT
      source_type AS sourceType,
      owner_id AS ownerId,
      division,
      backfill_status AS backfillStatus,
      backfill_next_page AS backfillNextPage,
      backfill_pages_fetched AS backfillPagesFetched,
      backfill_started_at AS backfillStartedAt,
      backfill_completed_at AS backfillCompletedAt,
      last_sync_started_at AS lastSyncStartedAt,
      last_successful_sync_at AS lastSuccessfulSyncAt,
      last_sync_status AS lastSyncStatus,
      last_error AS lastError,
      updated_at AS updatedAt
    FROM esi_wallet_sync_state
    ORDER BY source_type, owner_id, division
  `).all();
}

export function startEsiWalletSync(
  db,
  sourceType,
  ownerId,
  division,
  mode = "incremental"
) {
  if (!["incremental", "backfill"].includes(mode)) {
    throw new Error("Invalid wallet synchronisation mode");
  }

  ensureEsiWalletSyncState(
    db,
    sourceType,
    ownerId,
    division
  );

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE esi_wallet_sync_state
    SET
      last_sync_started_at = ?,
      last_sync_status = 'running',
      last_error = NULL,
      backfill_status = CASE
        WHEN ? = 'backfill'
          AND backfill_status != 'complete'
        THEN 'in_progress'
        ELSE backfill_status
      END,
      backfill_started_at = CASE
        WHEN ? = 'backfill'
        THEN COALESCE(backfill_started_at, ?)
        ELSE backfill_started_at
      END,
      updated_at = ?
    WHERE source_type = ?
      AND owner_id = ?
      AND division = ?
  `).run(
    now,
    mode,
    mode,
    now,
    now,
    sourceType,
    ownerId,
    division
  );

  return getEsiWalletSyncState(
    db,
    sourceType,
    ownerId,
    division
  );
}

export function saveEsiWalletBackfillProgress(
  db,
  sourceType,
  ownerId,
  division,
  nextPage,
  pagesFetched
) {
  validateEsiWalletSyncIdentity(
    sourceType,
    ownerId,
    division
  );

  if (
    !Number.isSafeInteger(nextPage) ||
    nextPage < 1 ||
    !Number.isSafeInteger(pagesFetched) ||
    pagesFetched < 0
  ) {
    throw new Error("Invalid wallet backfill progress");
  }

  const state = getEsiWalletSyncState(
    db,
    sourceType,
    ownerId,
    division
  );

  if (!state || state.lastSyncStatus !== "running") {
    throw new Error("Wallet backfill is not running");
  }

  if (state.backfillStatus !== "in_progress") {
    throw new Error("Wallet backfill is not in progress");
  }

  if (nextPage < state.backfillNextPage) {
    throw new Error("Wallet backfill cannot move backwards");
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE esi_wallet_sync_state
    SET
      backfill_next_page = ?,
      backfill_pages_fetched = ?,
      updated_at = ?
    WHERE source_type = ?
      AND owner_id = ?
      AND division = ?
  `).run(
    nextPage,
    pagesFetched,
    now,
    sourceType,
    ownerId,
    division
  );

  return getEsiWalletSyncState(
    db,
    sourceType,
    ownerId,
    division
  );
}

export function completeEsiWalletSync(
  db,
  sourceType,
  ownerId,
  division,
  {
    backfillComplete = false,
  } = {}
) {
  validateEsiWalletSyncIdentity(
    sourceType,
    ownerId,
    division
  );

  if (typeof backfillComplete !== "boolean") {
    throw new Error("Invalid wallet backfill completion status");
  }

  const state = getEsiWalletSyncState(
    db,
    sourceType,
    ownerId,
    division
  );

  if (!state || state.lastSyncStatus !== "running") {
    throw new Error("Wallet synchronisation is not running");
  }

  if (
    backfillComplete &&
    state.backfillStatus !== "in_progress"
  ) {
    throw new Error("No active historical backfill to complete");
  }

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE esi_wallet_sync_state
    SET
      last_sync_status = 'success',
      last_successful_sync_at = ?,
      last_error = NULL,
      backfill_status = CASE
        WHEN ? = 1 THEN 'complete'
        ELSE backfill_status
      END,
      backfill_completed_at = CASE
        WHEN ? = 1 THEN ?
        ELSE backfill_completed_at
      END,
      updated_at = ?
    WHERE source_type = ?
      AND owner_id = ?
      AND division = ?
  `).run(
    now,
    Number(backfillComplete),
    Number(backfillComplete),
    now,
    now,
    sourceType,
    ownerId,
    division
  );

  return getEsiWalletSyncState(
    db,
    sourceType,
    ownerId,
    division
  );
}

export function failEsiWalletSync(
  db,
  sourceType,
  ownerId,
  division,
  error
) {
  validateEsiWalletSyncIdentity(
    sourceType,
    ownerId,
    division
  );

  const state = getEsiWalletSyncState(
    db,
    sourceType,
    ownerId,
    division
  );

  if (!state || state.lastSyncStatus !== "running") {
    throw new Error("Wallet synchronisation is not running");
  }

  const now = new Date().toISOString();

  const errorMessage = (
    error instanceof Error
      ? error.message
      : String(error ?? "Unknown synchronisation error")
  ).slice(0, 1000);

  db.prepare(`
    UPDATE esi_wallet_sync_state
    SET
      last_sync_status = 'error',
      last_error = ?,
      backfill_status = CASE
        WHEN backfill_status = 'in_progress'
        THEN 'error'
        ELSE backfill_status
      END,
      updated_at = ?
    WHERE source_type = ?
      AND owner_id = ?
      AND division = ?
  `).run(
    errorMessage,
    now,
    sourceType,
    ownerId,
    division
  );

  return getEsiWalletSyncState(
    db,
    sourceType,
    ownerId,
    division
  );
}