import {
  importEsiWalletJournal,
  ensureEsiWalletSyncState,
  getEsiWalletSyncState,
  startEsiWalletSync,
  saveEsiWalletBackfillProgress,
  completeEsiWalletSync,
  failEsiWalletSync,
} from "./esiDatabase.js";

const MAX_PAGES_PER_RUN = 20;
const activeSyncs = new Set();

function validatePageLimit(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PAGES_PER_RUN) {
    throw new Error("Invalid wallet sync page limit");
  }
  return value;
}

export function createEsiWalletSyncService({ db, fobWallet, listCorporations }) {
  if (!db || typeof fobWallet?.fetchCorporationPage !== "function") {
    throw new Error("Wallet sync dependencies are unavailable");
  }

  if (typeof listCorporations !== "function") {
    throw new Error("Corporation authorisation provider is unavailable");
  }

  async function syncCorporation(characterId, division = 1, pageLimit = 20) {
    if (!Number.isSafeInteger(characterId) || characterId <= 0) {
      throw new Error("Invalid authorising character ID");
    }
    if (!Number.isSafeInteger(division) || division < 1 || division > 7) {
      throw new Error("Invalid wallet division");
    }
    validatePageLimit(pageLimit);

    const authorisation = listCorporations().find(
      (item) => Number(item.characterId) === characterId
    );

    if (!authorisation || authorisation.status !== "valid") {
      throw new Error("Valid corporation wallet authorisation required");
    }

    const corporationId = Number(authorisation.corporationId);
    if (!Number.isSafeInteger(corporationId) || corporationId <= 0) {
      throw new Error("Invalid corporation ID");
    }

    const key = `corporation:${corporationId}:${division}`;
    if (activeSyncs.has(key)) {
      throw new Error("Wallet synchronisation is already running");
    }

    activeSyncs.add(key);
    let started = false;

    try {
      const initialState = ensureEsiWalletSyncState(
        db, "corporation", corporationId, division
      );
      const backfill = initialState.backfillStatus !== "complete";
      startEsiWalletSync(
        db,
        "corporation",
        corporationId,
        division,
        backfill ? "backfill" : "incremental"
      );
      started = true;

      let token = null;
      let availablePages = null;
      let pagesFetched = 0;
      let processed = 0;
      let inserted = 0;
      let updated = 0;
      let reachedExisting = false;
      let reachedEnd = false;

      for (let page = 1; page <= pageLimit; page++) {
        const result = await fobWallet.fetchCorporationPage(
          characterId, corporationId, division, page, token
        );
        token = result.token;

        if (availablePages === null) {
          availablePages = result.pages;
        }

        const imported = importEsiWalletJournal(
          db, "corporation", corporationId, division, result.entries
        );
        pagesFetched++;
        processed += imported.processed;
        inserted += imported.inserted;
        updated += imported.updated;

        if (backfill) {
          const checkpoint = getEsiWalletSyncState(
            db, "corporation", corporationId, division
          );
          saveEsiWalletBackfillProgress(
            db, "corporation", corporationId, division,
            Math.max(checkpoint.backfillNextPage, page + 1),
            Math.max(checkpoint.backfillPagesFetched, pagesFetched)
          );
        } else if (imported.inserted === 0) {
          reachedExisting = true;
        }

        if (result.entries.length === 0 || page >= availablePages) {
          reachedEnd = true;
          break;
        }

        if (!backfill && reachedExisting) {
          break;
        }
      }

      const state = completeEsiWalletSync(
        db, "corporation", corporationId, division,
        { backfillComplete: backfill && reachedEnd }
      );

      return {
        corporationId,
        corporationName: authorisation.corporationName,
        authorisingCharacterId: characterId,
        division,
        mode: backfill ? "backfill" : "incremental",
        pagesFetched,
        availablePages,
        processed,
        inserted,
        updated,
        reachedEnd,
        backfillComplete: state.backfillStatus === "complete",
        state,
      };
      } catch (error) {
        if (started) {
          try {
            failEsiWalletSync(db, "corporation", corporationId, division, error);
          } catch (syncError) {
            console.error("Failed to record ESI wallet sync error:", syncError);
          }
        }
        throw error;
      } finally {
        activeSyncs.delete(key);
      }
    }

  return {
    syncCorporation,
    getCorporationSyncState(corporationId, division = 1) {
      return getEsiWalletSyncState(db, "corporation", corporationId, division);
    },
  };
}