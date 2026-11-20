
import {
  listEsiKillmailAuthorisations,
  getEsiKillmailAuthorisation,
  startEsiKillmailSync,
  completeEsiKillmailSync,
  failEsiKillmailSync,
} from "./esiKillmailDatabase.js";

const ESI_BASE_URL = "https://esi.evetech.net/latest";
const REQUEST_TIMEOUT_MS = 20000;
const HISTORY_DAYS = 30;
const MAX_PAGES = 20;
const KILLMAIL_HASH_PATTERN = /^[a-f0-9]{40}$/i;
const SOURCE_TYPES = new Set(["character", "corporation"]);

function validId(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function getRecentPath(sourceType, authorisation) {
  if (sourceType === "character") {
    return `/characters/${authorisation.characterId}/killmails/recent/`;
  }

  if (!validId(authorisation.corporationId)) {
    throw new Error("Corporation killmail authorisation has no valid corporation ID");
  }

  return `/corporations/${authorisation.corporationId}/killmails/recent/`;
}

async function fetchRecentKillmails(path, accessToken, page) {
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("Killmail access token is unavailable");
  }

  const response = await fetch(`${ESI_BASE_URL}${path}?page=${page}`, {
    method: "GET",
    redirect: "error",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(`Killmail ESI access rejected (${response.status}); check the authorisation and corporation roles`);
    }

    if (response.status === 420 || response.status === 429) {
      throw new Error(`ESI rate limit reached (${response.status}); try again later`);
    }

    throw new Error(`Killmail ESI request failed (${response.status})`);
  }

  const result = await response.json();

  if (!Array.isArray(result)) {
    throw new Error("Unexpected ESI recent killmails response");
  }

  const references = result.map((entry) => {
    const id = entry?.killmail_id;
    const hash = entry?.killmail_hash;

    if (!validId(id) || typeof hash !== "string" || !KILLMAIL_HASH_PATTERN.test(hash)) {
      throw new Error("ESI returned an invalid killmail reference");
    }

    return { id, hash: hash.toLowerCase() };
  });

  const totalPagesHeader = Number(response.headers.get("x-pages"));
  const totalPages = Number.isSafeInteger(totalPagesHeader) && totalPagesHeader > 0
    ? totalPagesHeader
    : null;

  return { references, totalPages };
}

async function isWithinHistoryWindow(reference, cutoff) {
  const response = await fetch(
    `${ESI_BASE_URL}/killmails/${reference.id}/${reference.hash}/`,
    {
      method: "GET",
      redirect: "error",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(`Killmail details request failed (${response.status})`);
  }

  const data = await response.json();
  const timestamp = Date.parse(data?.killmail_time);
  if (data?.killmail_id !== reference.id || !Number.isFinite(timestamp)) {
    throw new Error("Unexpected ESI killmail details response");
  }

  return timestamp >= cutoff;
}

export function createEsiKillmailSyncService({ db, getKillmailAccessToken, importKillmail }) {
  if (!db || typeof getKillmailAccessToken !== "function" || typeof importKillmail !== "function") {
    throw new Error("Killmail sync requires a database, token provider and importer");
  }

  const active = new Set();

  async function syncSource(sourceType, characterId) {
    if (!SOURCE_TYPES.has(sourceType) || !validId(characterId)) {
      throw new Error("Invalid killmail sync source");
    }

    const key = `${sourceType}:${characterId}`;

    if (active.has(key)) {
      throw new Error("Killmail synchronisation is already running for this source");
    }

    const authorisation = getEsiKillmailAuthorisation(db, sourceType, characterId);

    if (!authorisation || authorisation.status !== "valid" || authorisation.sync_enabled !== 1) {
      throw new Error("Killmail authorisation is not enabled and valid");
    }

    active.add(key);
    let started = false;

    try {
      startEsiKillmailSync(db, sourceType, characterId);
      started = true;

      const accessToken = await getKillmailAccessToken(sourceType, characterId);
      const recentPath = getRecentPath(sourceType, {
        characterId,
        corporationId: authorisation.corporation_id,
      });

      let imported = 0;
      let duplicates = 0;
      let confirmedFobs = 0;
      let outsideHistory = 0;
      const cutoff = Date.now() - HISTORY_DAYS * 24 * 60 * 60 * 1000;
      const failures = [];
      const unique = new Set();

      let fetched = 0;
      let pagesFetched = 0;
      let reachedHistoryCutoff = false;

      for (let page = 1; page <= MAX_PAGES; page++) {
        const { references, totalPages } = await fetchRecentKillmails(
          recentPath, accessToken, page
        );
        pagesFetched += 1;
        fetched += references.length;

        if (references.length === 0) break;

        for (const reference of references) {
          if (unique.has(reference.id)) continue;
          unique.add(reference.id);

          try {
            if (!(await isWithinHistoryWindow(reference, cutoff))) {
              outsideHistory += 1;
              reachedHistoryCutoff = true;
              continue;
            }

            const result = await importKillmail(
              `${ESI_BASE_URL}/killmails/${reference.id}/${reference.hash}/`
            );

            if (result?.imported) {
              imported += 1;
              if (result.killmail?.classification === "confirmed") confirmedFobs += 1;
            } else if (result?.duplicate) {
              duplicates += 1;
            }
          } catch (error) {
            failures.push({
              killmailId: reference.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }

        if (reachedHistoryCutoff || (totalPages !== null && page >= totalPages)) break;
      }

      if (failures.length) {
        throw new Error(
          `${failures.length} of ${unique.size} killmails could not be imported; first failure: ${failures[0].killmailId}: ${failures[0].error}`
        );
      }

      completeEsiKillmailSync(db, sourceType, characterId);

      return {
        sourceType,
        characterId,
        fetched,
        pagesFetched,
        reachedHistoryCutoff,
        imported,
        duplicates,
        confirmedFobs,
        outsideHistory,
      };
    } catch (error) {
      if (started) {
        try {
          failEsiKillmailSync(db, sourceType, characterId, error);
        } catch (syncError) {
          console.warn("Unable to record killmail sync failure:", syncError);
        }
      }
      throw error;
    } finally {
      active.delete(key);
    }
  }

  async function runOnce() {
    const sources = listEsiKillmailAuthorisations(db).filter(
      (source) => source.syncEnabled && source.status === "valid"
    );

    const results = [];

    for (const source of sources) {
      try {
        results.push({
          success: true,
          ...(await syncSource(source.sourceType, source.characterId)),
        });
      } catch (error) {
        results.push({
          success: false,
          sourceType: source.sourceType,
          characterId: source.characterId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { sourcesChecked: sources.length, results };
  }

  return { syncSource, runOnce };
}
