
const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;
const DEFAULT_PAGE_LIMIT = 20;
const DEFAULT_RATE_LIMIT_COOLDOWN_MS = 60_000;

export function createEsiAutoSyncService({
  listCharacters,
  syncCharacter,
  listCorporations,
  syncCorporation,
  intervalMs = DEFAULT_INTERVAL_MS,
  pageLimit = DEFAULT_PAGE_LIMIT,
  divisions = [1],
  logger = console,
}) {
  if (typeof listCharacters !== "function") {
    throw new Error("Character authorisation provider is required");
  }

  if (typeof syncCharacter !== "function") {
    throw new Error("Character wallet sync provider is required");
  }

  if (typeof listCorporations !== "function") {
    throw new Error("Corporation authorisation provider is required");
  }

  if (typeof syncCorporation !== "function") {
    throw new Error("Corporation wallet sync provider is required");
  }

  if (!Number.isSafeInteger(intervalMs) || intervalMs < 60_000) {
    throw new Error("Invalid automatic ESI sync interval");
  }

  if (!Number.isSafeInteger(pageLimit) || pageLimit < 1 || pageLimit > 20) {
    throw new Error("Invalid automatic ESI page limit");
  }

  if (
    !Array.isArray(divisions) ||
    divisions.length === 0 ||
    new Set(divisions).size !== divisions.length ||
    divisions.some((division) =>
      !Number.isSafeInteger(division) || division < 1 || division > 7
    )
  ) {
    throw new Error("Invalid automatic ESI wallet divisions");
  }

  let timer = null;
  let enabled = false;
  let running = false;
  let lastStartedAt = null;
  let lastCompletedAt = null;
  let lastResults = [];
  let cooldownUntil = 0;
  let generation = 0;

  function getStatus() {
    return {
      enabled,
      running,
      intervalMs,
      pageLimit,
      divisions: [...divisions],
      lastStartedAt,
      lastCompletedAt,
      lastResults: lastResults.map((result) => ({ ...result })),
      cooldownUntil: cooldownUntil > Date.now()
        ? new Date(cooldownUntil).toISOString()
        : null,
    };
  }

  function isRateLimitError(error) {
    const status = Number(error?.status ?? error?.statusCode);
    const message = error instanceof Error ? error.message : String(error);

    return status === 420 || status === 429 ||
      /\b(420|429)\b|error limit|rate limit|cooldown/i.test(message);
  }

  function getCooldownDeadline(error) {
    const values = [error?.retryAt, error?.cooldownUntil];

    for (const value of values) {
      const timestamp = typeof value === "number"
        ? value
        : Date.parse(value);

      if (Number.isFinite(timestamp) && timestamp > Date.now()) {
        return timestamp;
      }
    }

    const retryAfterMs = Number(error?.retryAfterMs);

    if (Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
      return Date.now() + retryAfterMs;
    }

    return Date.now() + DEFAULT_RATE_LIMIT_COOLDOWN_MS;
  }

  async function runOnce() {
    if (running) {
      return {
        skipped: true,
        reason: "already_running",
        ...getStatus(),
      };
    }

    if (cooldownUntil > Date.now()) {
      return {
        skipped: true,
        reason: "rate_limited",
        rateLimited: true,
        ...getStatus(),
      };
    }

    running = true;
    lastStartedAt = new Date().toISOString();

    const results = [];
    let rateLimited = false;
    const runGeneration = generation;

    try {
      const characters = listCharacters();

      if (!Array.isArray(characters)) {
        throw new Error("Invalid character authorisation list");
      }

      const seenCharacters = new Set();

      for (const character of characters) {
        if (runGeneration !== generation) break;
        if (character?.status !== "valid") continue;

        const characterId = Number(character.characterId);

        if (!Number.isSafeInteger(characterId) || characterId <= 0) {
          continue;
        }

        if (seenCharacters.has(characterId)) continue;
        seenCharacters.add(characterId);

        try {
          const result = await syncCharacter(characterId, pageLimit);

          results.push({
            sourceType: "character",
            ownerId: characterId,
            characterId,
            success: true,
            pagesFetched: result.pagesFetched,
            inserted: result.inserted,
            updated: result.updated,
            mode: result.mode,
          });
        } catch (error) {
          const message = error instanceof Error
            ? error.message
            : String(error);

          results.push({
            sourceType: "character",
            ownerId: characterId,
            characterId,
            success: false,
            error: message,
          });

          logger.error(
            `[ESI AUTO SYNC] Character ${characterId}: ${message}`
          );

          if (isRateLimitError(error)) {
            rateLimited = true;
            cooldownUntil = Math.max(
              cooldownUntil,
              getCooldownDeadline(error)
            );
            break;
          }
        }
      }

      if (!rateLimited && runGeneration === generation) {
        const authorisations = listCorporations();

        if (!Array.isArray(authorisations)) {
          throw new Error("Invalid corporation authorisation list");
        }

        const seenCorporations = new Set();

        for (const authorisation of authorisations) {
          if (runGeneration !== generation) break;
          if (authorisation?.status !== "valid") continue;

          const characterId = Number(authorisation.characterId);
          const corporationId = Number(authorisation.corporationId);

          if (
            !Number.isSafeInteger(characterId) ||
            characterId <= 0 ||
            !Number.isSafeInteger(corporationId) ||
            corporationId <= 0
          ) {
            continue;
          }

          for (const division of divisions) {
            if (runGeneration !== generation) break;

            const key = `${corporationId}:${division}`;

            if (seenCorporations.has(key)) continue;
            seenCorporations.add(key);

            try {
              const result = await syncCorporation(
                characterId,
                division,
                pageLimit
              );

              results.push({
                sourceType: "corporation",
                ownerId: corporationId,
                corporationId,
                division,
                success: true,
                pagesFetched: result.pagesFetched,
                inserted: result.inserted,
                updated: result.updated,
                mode: result.mode,
              });
            } catch (error) {
              const message = error instanceof Error
                ? error.message
                : String(error);

              results.push({
                sourceType: "corporation",
                ownerId: corporationId,
                corporationId,
                division,
                success: false,
                error: message,
              });

              logger.error(
                `[ESI AUTO SYNC] Corporation ${corporationId}, division ${division}: ${message}`
              );

              if (isRateLimitError(error)) {
                rateLimited = true;
                cooldownUntil = Math.max(
                  cooldownUntil,
                  getCooldownDeadline(error)
                );
                break;
              }
            }
          }

          if (rateLimited) break;
        }
      }

      lastResults = results;
    } catch (error) {
      lastResults = results;
      logger.error("[ESI AUTO SYNC] Run failed:", error);
      throw error;
    } finally {
      running = false;
      lastCompletedAt = new Date().toISOString();
    }

    return {
      skipped: false,
      rateLimited,
      results,
      ...getStatus(),
    };
  }

  function start({ runImmediately = true } = {}) {
    if (enabled) return getStatus();

    enabled = true;
    generation += 1;

    timer = setInterval(() => {
      runOnce().catch((error) => {
        logger.error("[ESI AUTO SYNC] Scheduled run failed:", error);
      });
    }, intervalMs);

    timer.unref?.();

    if (runImmediately) {
      runOnce().catch((error) => {
        logger.error("[ESI AUTO SYNC] Startup run failed:", error);
      });
    }

    return getStatus();
  }

  function stop() {
    enabled = false;
    generation += 1;

    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }

    return getStatus();
  }

  return {
    start,
    stop,
    runOnce,
    getStatus,
  };
}
