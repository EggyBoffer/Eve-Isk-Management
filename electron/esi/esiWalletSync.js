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
const TAX_RATE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const activeSyncs = new Set();

function validatePageLimit(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_PAGES_PER_RUN) {
    throw new Error("Invalid wallet sync page limit");
  }
  return value;
}

function validateCharacterId(value) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error("Invalid character ID");
  }
  return value;
}

function validateDivision(value) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 7) {
    throw new Error("Invalid wallet division");
  }
  return value;
}

async function fetchPublicEsi(path) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://esi.evetech.net/latest${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`ESI public lookup failed (${response.status})`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function getCurrentCorporationTax(characterId) {
  const character = await fetchPublicEsi(`/characters/${characterId}/`);
  const corporationId = Number(character.corporation_id);
  if (!Number.isSafeInteger(corporationId) || corporationId <= 0) {
    throw new Error("Invalid character corporation returned by ESI");
  }
  const corporation = await fetchPublicEsi(`/corporations/${corporationId}/`);
  const taxRate = corporation.tax_rate;
  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
    throw new Error("Invalid corporation tax rate returned by ESI");
  }
  return { corporationId, taxRate, checkedAt: Date.now() };
}

export function createEsiWalletSyncService({
  db,
  fobWallet,
  listCorporations,
  listCharacters,
}) {
  if (
    !db ||
    typeof fobWallet?.fetchCorporationPage !== "function" ||
    typeof fobWallet?.fetchPage !== "function"
  ) {
    throw new Error("Wallet sync dependencies are unavailable");
  }

  if (typeof listCorporations !== "function") {
    throw new Error("Corporation authorisation provider is unavailable");
  }

  async function syncWallet({
    sourceType,
    ownerId,
    division,
    pageLimit,
    fetchPage,
    taxInfo = null,
  }) {
    validatePageLimit(pageLimit);
    const key = `${sourceType}:${ownerId}:${division}`;

    if (activeSyncs.has(key)) {
      throw new Error("Wallet synchronisation is already running");
    }

    activeSyncs.add(key);
    let started = false;

    try {
      const initialState = ensureEsiWalletSyncState(
        db,
        sourceType,
        ownerId,
        division
      );
      const backfill = initialState.backfillStatus !== "complete";
      const mode = backfill ? "backfill" : "incremental";

      startEsiWalletSync(db, sourceType, ownerId, division, mode);
      started = true;

      let pagesFetched = 0;
      let availablePages = null;
      let processed = 0;
      let inserted = 0;
      let updated = 0;
      let reachedExisting = false;
      let reachedEnd = false;
      let token = null;

      for (let page = 1; page <= pageLimit; page++) {
        const result = await fetchPage(page, token);
        token = result.token;

        if (availablePages === null) {
          availablePages = result.pages;
        }

        const entries = taxInfo && sourceType === "character"
          ? result.entries.map((entry) => {
              const timestamp = Date.parse(entry.date);
              const recent = Number.isFinite(timestamp) &&
                timestamp <= taxInfo.checkedAt &&
                timestamp >= taxInfo.checkedAt - TAX_RATE_MAX_AGE_MS;
              return recent ? { ...entry, taxRate: taxInfo.taxRate } : entry;
            })
          : result.entries;

        const imported = importEsiWalletJournal(
          db,
          sourceType,
          ownerId,
          division,
          entries
        );

        pagesFetched++;
        processed += imported.processed;
        inserted += imported.inserted;
        updated += imported.updated;

        if (backfill) {
          const checkpoint = getEsiWalletSyncState(
            db,
            sourceType,
            ownerId,
            division
          );

          saveEsiWalletBackfillProgress(
            db,
            sourceType,
            ownerId,
            division,
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
        db,
        sourceType,
        ownerId,
        division,
        { backfillComplete: backfill && reachedEnd }
      );

      return {
        sourceType,
        ownerId,
        division,
        mode,
        pagesFetched,
        availablePages,
        processed,
        inserted,
        updated,
        reachedExisting,
        reachedEnd,
        backfillComplete: state.backfillStatus === "complete",
        state,
      };
    } catch (error) {
      if (started) {
        try {
          failEsiWalletSync(db, sourceType, ownerId, division, error);
        } catch (syncError) {
          console.error("Failed to record ESI wallet sync error:", syncError);
        }
      }
      throw error;
    } finally {
      activeSyncs.delete(key);
    }
  }

  async function syncCharacter(characterId, pageLimit = 20) {
    validateCharacterId(characterId);
    validatePageLimit(pageLimit);

    if (typeof listCharacters !== "function") {
      throw new Error("Character authorisation provider is unavailable");
    }

    const authorisation = listCharacters().find(
      (item) => Number(item.characterId) === characterId
    );

    if (!authorisation || authorisation.status !== "valid") {
      throw new Error("Valid character wallet authorisation required");
    }

    let taxInfo = null;
    try {
      taxInfo = await getCurrentCorporationTax(characterId);
    } catch (error) {
      console.warn("Corporation tax lookup unavailable; continuing wallet sync:", error);
    }

    const result = await syncWallet({
      sourceType: "character",
      ownerId: characterId,
      division: 1,
      pageLimit,
      taxInfo,
      fetchPage: (page, token) =>
        fobWallet.fetchPage(characterId, page, token),
    });

    return {
      ...result,
      characterId,
      characterName: authorisation.name,
      corporationTaxRate: taxInfo?.taxRate ?? null,
      corporationTaxId: taxInfo?.corporationId ?? null,
    };
  }

  async function syncCorporation(characterId, division = 1, pageLimit = 20) {
    validateCharacterId(characterId);
    validateDivision(division);
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

    const result = await syncWallet({
      sourceType: "corporation",
      ownerId: corporationId,
      division,
      pageLimit,
      fetchPage: (page, token) =>
        fobWallet.fetchCorporationPage(
          characterId,
          corporationId,
          division,
          page,
          token
        ),
    });

    return {
      ...result,
      corporationId,
      corporationName: authorisation.corporationName,
      authorisingCharacterId: characterId,
    };
  }

  return {
    syncCharacter,
    syncCorporation,

    getCharacterSyncState(characterId) {
      validateCharacterId(characterId);
      return getEsiWalletSyncState(db, "character", characterId, 1);
    },

    getCorporationSyncState(corporationId, division = 1) {
      validateDivision(division);
      return getEsiWalletSyncState(db, "corporation", corporationId, division);
    },
  };
}