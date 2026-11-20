
import {
  detectOfficersFromJournal,
} from "./officerDetection.js";

import {
  saveOfficerKills,
} from "./officerDatabase.js";

const DEFAULT_BATCH_SIZE = 100;
const MAX_BATCH_SIZE = 500;

export function createOfficerSyncService({
  db,
  logger = console,
}) {
  if (!db || typeof db.prepare !== "function") {
    throw new Error("Officer sync requires a database");
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS officer_scan_state (
      character_id INTEGER NOT NULL,
      journal_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      scanned_at TEXT NOT NULL,
      PRIMARY KEY (character_id, journal_id)
    );

    CREATE INDEX IF NOT EXISTS idx_officer_scan_character
    ON officer_scan_state (character_id);
  `);

  const findPending = db.prepare(`
    SELECT
      journal.owner_id AS characterId,
      journal.journal_id AS journalId,
      journal.date,
      journal.ref_type AS refType,
      journal.amount,
      journal.description,
      journal.reason
    FROM esi_wallet_journal AS journal
    LEFT JOIN officer_scan_state AS scanned
      ON scanned.character_id = journal.owner_id
      AND scanned.journal_id = journal.journal_id
    WHERE journal.source_type = 'character'
      AND journal.division = 1
      AND journal.ref_type = 'bounty_prizes'
      AND journal.reason != ''
      AND (
        scanned.journal_id IS NULL
        OR scanned.reason != journal.reason
      )
      AND (
        @characterId IS NULL
        OR journal.owner_id = @characterId
      )
    ORDER BY journal.date ASC, journal.journal_id ASC
    LIMIT @limit
  `);

  const markScanned = db.prepare(`
    INSERT INTO officer_scan_state (
      character_id,
      journal_id,
      reason,
      scanned_at
    )
    VALUES (?, ?, ?, ?)
    ON CONFLICT (character_id, journal_id)
    DO UPDATE SET
      reason = excluded.reason,
      scanned_at = excluded.scanned_at
  `);

  const commitEntry = db.transaction((entry, officers) => {
    if (officers.length > 0) {
      saveOfficerKills(db, officers);
    }

    markScanned.run(
      entry.characterId,
      entry.journalId,
      entry.reason,
      new Date().toISOString()
    );
  });

  let running = false;
  let lastStartedAt = null;
  let lastCompletedAt = null;
  let lastResult = null;

  function getStatus() {
    return {
      running,
      lastStartedAt,
      lastCompletedAt,
      lastResult,
    };
  }

  async function runOnce({
    characterId = null,
    batchSize = DEFAULT_BATCH_SIZE,
  } = {}) {
    if (running) {
      return {
        skipped: true,
        reason: "already_running",
        ...getStatus(),
      };
    }

    if (
      characterId !== null &&
      (!Number.isSafeInteger(characterId) ||
        characterId <= 0)
    ) {
      throw new Error("Invalid officer sync character ID");
    }

    if (
      !Number.isSafeInteger(batchSize) ||
      batchSize < 1 ||
      batchSize > MAX_BATCH_SIZE
    ) {
      throw new Error("Invalid officer sync batch size");
    }

    running = true;
    lastStartedAt = new Date().toISOString();

    const result = {
      success: false,
      characterId,
      scanned: 0,
      detected: 0,
      officers: [],
      errors: [],
      startedAt: lastStartedAt,
      completedAt: null,
    };

    try {
      while (true) {
        const entries = findPending.all({
          characterId,
          limit: batchSize,
        });

        if (entries.length === 0) {
          break;
        }

        for (const entry of entries) {
          try {
            const officers = await detectOfficersFromJournal(entry);

            commitEntry(entry, officers);

            result.scanned++;
            result.detected += officers.reduce(
              (total, officer) => total + officer.quantity,
              0
            );

            for (const officer of officers) {
              result.officers.push({
                characterId: officer.characterId,
                journalId: officer.journalId,
                typeId: officer.typeId,
                name: officer.name,
                officerClass: officer.officerClass,
                quantity: officer.quantity,
                date: officer.date,
              });
            }
          } catch (error) {
            const message = error instanceof Error
              ? error.message
              : String(error);

            result.errors.push({
              characterId: entry.characterId,
              journalId: entry.journalId,
              error: message,
            });

            logger.error(
              `[OFFICER SYNC] Journal ${entry.journalId}: ${message}`
            );

            break;
          }
        }

        if (result.errors.length > 0) {
          break;
        }
      }

      result.success = result.errors.length === 0;
    } catch (error) {
      result.errors.push({
        error: error instanceof Error
          ? error.message
          : String(error),
      });

      logger.error("[OFFICER SYNC] Failed:", error);
    } finally {
      running = false;
      lastCompletedAt = new Date().toISOString();
      result.completedAt = lastCompletedAt;
      lastResult = result;
    }

    logger.log(
      `[OFFICER SYNC] Scanned ${result.scanned} wallet entries, ` +
      `detected ${result.detected} officers, ` +
      `${result.errors.length} errors`
    );

    return result;
  }

  return {
    runOnce,
    getStatus,
  };
}
