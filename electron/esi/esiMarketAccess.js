import { Buffer } from "node:buffer";
import { safeStorage } from "electron";

const TOKEN_URL = "https://login.eveonline.com/v2/oauth/token";
const CLIENT_ID = "0be85dc3df334b098d1b123d73936275";
const REQUEST_TIMEOUT_MS = 15000;
const EXPIRY_MARGIN_MS = 60000;

export function createEsiMarketAccessService({ db, corporationDatabase }) {
  const cache = new Map();
  const pending = new Map();

  const getPersonalAuthorisation = db.prepare(`
    SELECT
      encrypted_refresh_token AS encryptedRefreshToken,
      linked_at AS linkedAt
    FROM esi_market_authorisations
    WHERE character_id = ?
  `);

  const savePersonalRefreshToken = db.prepare(`
    UPDATE esi_market_authorisations
    SET encrypted_refresh_token = ?
    WHERE character_id = ? AND encrypted_refresh_token = ? AND linked_at = ?
  `);

  async function refresh(characterId, authorisation, corporation, key) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error("Secure credential encryption is unavailable on this device.");
    }

    const refreshToken = safeStorage.decryptString(
      Buffer.from(authorisation.encryptedRefreshToken, "base64")
    );

    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }),
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if ([400, 401, 403].includes(response.status)) {
      throw new Error("EVE rejected the Market credentials. Link Market access again.");
    }

    if (!response.ok) {
      throw new Error(`EVE Market token refresh failed (${response.status}).`);
    }

    const tokens = await response.json();
    const expiresIn = Number(tokens?.expires_in);

    if (
      typeof tokens?.access_token !== "string" || !tokens.access_token ||
      typeof tokens.refresh_token !== "string" || !tokens.refresh_token ||
      !Number.isFinite(expiresIn) || expiresIn <= 0
    ) {
      throw new Error("EVE returned an incomplete Market token response.");
    }

    const encryptedRefreshToken = safeStorage
      .encryptString(tokens.refresh_token)
      .toString("base64");

    const saved = corporation
      ? corporationDatabase.replaceRefreshToken(authorisation, encryptedRefreshToken)
      : savePersonalRefreshToken.run(
          encryptedRefreshToken,
          characterId,
          authorisation.encryptedRefreshToken,
          authorisation.linkedAt
        ).changes === 1;

    if (!saved) {
      throw new Error("Market authorisation changed during refresh. Refresh orders again.");
    }

    cache.set(key, {
      token: tokens.access_token,
      expiresAt: Date.now() + expiresIn * 1000,
      encryptedRefreshToken,
    });

    return tokens.access_token;
  }

  async function getMarketAccessToken(characterId, corporationId = null) {
    if (!Number.isSafeInteger(characterId) || characterId <= 0) {
      throw new Error("Invalid Market character ID.");
    }

    const corporation = corporationId !== null;
    const key = corporation
      ? `corporation:${characterId}`
      : `personal:${characterId}`;

    const authorisation = corporation
      ? corporationDatabase?.getAuthorisation(characterId)
      : getPersonalAuthorisation.get(characterId);

    if (!authorisation || (corporation && authorisation.corporationId !== corporationId)) {
      cache.delete(key);
      throw new Error("Market access is not linked for this character and source.");
    }

    const cached = cache.get(key);

    if (
      cached?.encryptedRefreshToken === authorisation.encryptedRefreshToken &&
      cached.expiresAt - Date.now() > EXPIRY_MARGIN_MS
    ) {
      return cached.token;
    }

    const activeRequest = pending.get(key);

    if (activeRequest) {
      if (activeRequest.encryptedRefreshToken !== authorisation.encryptedRefreshToken) {
        throw new Error("Market authorisation changed during refresh. Refresh orders again.");
      }

      return activeRequest.promise;
    }

    const promise = refresh(characterId, authorisation, corporation, key);

    pending.set(key, {
      promise,
      encryptedRefreshToken: authorisation.encryptedRefreshToken,
    });

    try {
      return await promise;
    } finally {
      pending.delete(key);
    }
  }

  function clearMarketAccessToken(characterId, corporation = false) {
    const source = corporation ? "corporation" : "personal";
    cache.delete(`${source}:${characterId}`);
  }

  return { getMarketAccessToken, clearMarketAccessToken };
}