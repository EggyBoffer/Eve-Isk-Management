import http from "node:http";
import crypto from "node:crypto";
import { safeStorage } from "electron";
import { createEsiMarketCorporationLink } from "./esiMarketCorporationLink.js";
import {
  initialiseEsiDatabase,
  listEsiCharacters,
  getEsiCharacter,
  saveEsiCharacter,
  markEsiCharacterStatus,
  deleteEsiCharacter,
  listEsiCorporationAuthorisations,
  getEsiCorporationAuthorisation,
  saveEsiCorporationAuthorisation,
  markEsiCorporationAuthorisationStatus,
  deleteEsiCorporationAuthorisation,
} from "./esiDatabase.js";
import {
  initialiseEsiKillmailDatabase,
  listEsiKillmailAuthorisations,
  getEsiKillmailAuthorisation,
  saveEsiKillmailAuthorisation,
  markEsiKillmailAuthorisationStatus,
  setEsiKillmailSyncEnabled,
  deleteEsiKillmailAuthorisation,
} from "./esiKillmailDatabase.js";

const CLIENT_ID = "0be85dc3df334b098d1b123d73936275";
const REDIRECT_URI = "http://localhost:41721/callback";
const CALLBACK_PORT = 41721;

const MARKET_SCOPE = "esi-markets.read_character_orders.v1";
const CHARACTER_SCOPE = "esi-wallet.read_character_wallet.v1";
const CORPORATION_SCOPE = "esi-wallet.read_corporation_wallets.v1";
const CHARACTER_KILLMAIL_SCOPE = "esi-killmails.read_killmails.v1";
const CORPORATION_KILLMAIL_SCOPE = "esi-killmails.read_corporation_killmails.v1";
const KILLMAIL_SOURCES = new Set(["character", "corporation"]);

const AUTHORISE_URL = "https://login.eveonline.com/v2/oauth/authorize";
const TOKEN_URL = "https://login.eveonline.com/v2/oauth/token";
const VERIFY_URL = "https://login.eveonline.com/oauth/verify";
const ESI_BASE_URL = "https://esi.evetech.net/latest";

const LOGIN_TIMEOUT_MS = 180000;
const REQUEST_TIMEOUT_MS = 15000;
const TOKEN_EXPIRY_MARGIN_MS = 60000;

function validateCharacterId(value) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid EVE character ID");
  }

  return id;
}

function validateCorporationId(value) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid EVE corporation ID");
  }

  return id;
}

function validateKillmailSource(sourceType) {
  if (!KILLMAIL_SOURCES.has(sourceType)) {
    throw new Error("Invalid killmail authorisation type");
  }
  return sourceType;
}

function ensureEncryptionAvailable() {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(
      "Secure credential encryption is unavailable on this device."
    );
  }
}

function encryptRefreshToken(token) {
  ensureEncryptionAvailable();

  if (typeof token !== "string" || !token) {
    throw new Error("Invalid refresh token");
  }

  return safeStorage.encryptString(token).toString("base64");
}

function decryptRefreshToken(encryptedToken) {
  ensureEncryptionAvailable();

  if (
    typeof encryptedToken !== "string" ||
    !encryptedToken
  ) {
    throw new Error("Stored refresh token is invalid");
  }

  return safeStorage.decryptString(
    Buffer.from(encryptedToken, "base64")
  );
}

function createPkce() {
  const verifier = crypto.randomBytes(48).toString("base64url");

  const challenge = crypto
    .createHash("sha256")
    .update(verifier)
    .digest("base64url");

  return { verifier, challenge };
}

class EsiRequestError extends Error {
  constructor(status) {
    super(`EVE authentication request failed (${status})`);
    this.status = status;
  }
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new EsiRequestError(response.status);
  }

  return response.json();
}

async function exchangeToken(parameters) {
  return requestJson(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams(parameters).toString(),
  });
}

async function verifyCharacter(accessToken, requiredScope) {
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("EVE did not return an access token");
  }

  const identity = await requestJson(VERIFY_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (requiredScope && !String(identity.Scopes ?? "").split(/\s+/).includes(requiredScope)) {
    throw new Error("EVE did not grant the requested Market access");
  }

  const characterId = validateCharacterId(identity.CharacterID);

  if (
    typeof identity.CharacterName !== "string" ||
    !identity.CharacterName.trim()
  ) {
    throw new Error("EVE returned an invalid character identity");
  }

  return {
    characterId,
    name: identity.CharacterName,
  };
}

function getTokenExpiry(tokens) {
  const seconds = Number(tokens.expires_in);

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error("Invalid EVE token expiry");
  }

  return new Date(
    Date.now() + seconds * 1000
  ).toISOString();
}

function validateTokenResponse(tokens) {
  if (
    !tokens ||
    typeof tokens.access_token !== "string" ||
    !tokens.access_token ||
    typeof tokens.refresh_token !== "string" ||
    !tokens.refresh_token
  ) {
    throw new Error("EVE returned an incomplete token response");
  }

  return tokens;
}

async function getCharacterCorporation(characterId) {
  const id = validateCharacterId(characterId);

  const character = await requestJson(
    `${ESI_BASE_URL}/characters/${id}/`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  const corporationId = validateCorporationId(
    character.corporation_id
  );

  const corporation = await requestJson(
    `${ESI_BASE_URL}/corporations/${corporationId}/`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (
    typeof corporation.name !== "string" ||
    !corporation.name.trim()
  ) {
    throw new Error("EVE returned an invalid corporation name");
  }

  return {
    corporationId,
    corporationName: corporation.name,
  };
}

async function verifyCorporationWalletAccess(
  accessToken,
  corporationId
) {
  const id = validateCorporationId(corporationId);

  try {
    const divisions = await requestJson(
      `${ESI_BASE_URL}/corporations/${id}/wallets/`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
      }
    );

    if (!Array.isArray(divisions)) {
      throw new Error(
        "EVE returned an invalid corporation wallet response"
      );
    }

    return divisions;
  } catch (error) {
    if (
      error instanceof EsiRequestError &&
      [401, 403].includes(error.status)
    ) {
      throw new Error(
        "Corporation wallet access was denied. Check that the authorising character has the required corporation wallet roles."
      );
    }

    throw error;
  }
}

async function createCallbackListener(expectedState) {
  let server;
  let timer;
  let settled = false;
  let resolveCallback;
  let rejectCallback;

  const callbackPromise = new Promise((resolve, reject) => {
    resolveCallback = resolve;
    rejectCallback = reject;
  });

  callbackPromise.catch(() => {});

  function finish(error, code) {
    if (settled) return;

    settled = true;
    clearTimeout(timer);

    if (server?.listening) {
      server.close();
    }

    if (error) {
      rejectCallback(error);
    } else {
      resolveCallback(code);
    }
  }

  server = http.createServer((request, response) => {
    if (
      request.method !== "GET" ||
      !["localhost:41721", "127.0.0.1:41721"].includes(
        request.headers.host
      )
    ) {
      response.writeHead(400);
      response.end("Invalid authentication request.");
      return;
    }

    let url;

    try {
      url = new URL(request.url, REDIRECT_URI);
    } catch {
      response.writeHead(400);
      response.end("Invalid callback URL.");
      return;
    }

    if (
      url.pathname !== "/callback" ||
      url.searchParams.getAll("state").length !== 1
    ) {
      response.writeHead(400);
      response.end("Invalid authentication callback.");
      return;
    }

    const receivedState = url.searchParams.get("state");

    if (receivedState !== expectedState) {
      response.writeHead(400);
      response.end("Authentication state mismatch.");
      return;
    }

    if (url.searchParams.has("error")) {
      response.writeHead(400);
      response.end("EVE authentication was cancelled or denied.");

      finish(
        new Error("EVE authentication was cancelled or denied")
      );
      return;
    }

    const codes = url.searchParams.getAll("code");

    if (codes.length !== 1 || !codes[0]) {
      response.writeHead(400);
      response.end("Missing authorisation code.");

      finish(
        new Error("EVE did not return an authorisation code")
      );
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy":
        "default-src 'none'; style-src 'unsafe-inline'",
    });

    response.end(`
      <!doctype html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>ISKONOMY Authentication</title>
        </head>
        <body style="background:#101820;color:#eef3fa;font-family:Arial,sans-serif;text-align:center;padding:80px 20px">
          <h1>Character authorised</h1>
          <p>You can close this tab and return to ISKONOMY.</p>
        </body>
      </html>
    `);

    finish(null, codes[0]);
  });

  try {
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        server.removeListener("listening", onListening);
        reject(error);
      };

      const onListening = () => {
        server.removeListener("error", onError);
        resolve();
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(CALLBACK_PORT, "localhost");
    });
  } catch (error) {
    server.close();
    throw new Error(
      `Unable to start EVE callback listener: ${error.message}`
    );
  }

  timer = setTimeout(() => {
    finish(new Error("EVE authentication timed out"));
  }, LOGIN_TIMEOUT_MS);

  return {
    promise: callbackPromise,
    close() {
      finish(new Error("EVE authentication was cancelled"));
    },
  };
}

export function createEsiAuthService({ db, shell, corporationMarketDatabase }) {
  initialiseEsiDatabase(db);
  initialiseEsiKillmailDatabase(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS esi_market_authorisations (
      character_id INTEGER PRIMARY KEY,
      character_name TEXT NOT NULL,
      encrypted_refresh_token TEXT NOT NULL,
      linked_at TEXT NOT NULL
    )
  `);

  let activeLogin = null;

  const refreshLocks = new Map();
  const accessTokenCache = new Map();

  const corporationRefreshLocks = new Map();
  const corporationAccessTokenCache = new Map();

  const killmailRefreshLocks = new Map();
  const killmailAccessTokenCache = new Map();

  function killmailKey(sourceType, characterId) {
    return `${validateKillmailSource(sourceType)}:${validateCharacterId(characterId)}`;
  }

  function cacheKillmailAccessToken(sourceType, characterId, tokens) {
    killmailAccessTokenCache.set(killmailKey(sourceType, characterId), {
      token: tokens.access_token,
      expiresAt: Date.parse(getTokenExpiry(tokens)),
    });
  }

  function cacheAccessToken(characterId, tokens) {
    const expiresAt = Date.parse(getTokenExpiry(tokens));

    accessTokenCache.set(characterId, {
      token: tokens.access_token,
      expiresAt,
    });
  }

  function cacheCorporationAccessToken(characterId, tokens) {
    const expiresAt = Date.parse(getTokenExpiry(tokens));

    corporationAccessTokenCache.set(characterId, {
      token: tokens.access_token,
      expiresAt,
    });
  }

  function cancelLinking() {
    if (!activeLogin || activeLogin.cancelled) {
      return false;
    }

    activeLogin.cancelled = true;
    activeLogin.callback?.close();
    return true;
  }

  async function performLogin(scope, requiredScope) {
    if (activeLogin) {
      throw new Error("EVE linking is already in progress");
    }

    ensureEncryptionAvailable();

    const session = {
      cancelled: false,
      callback: null,
    };

    activeLogin = session;

    function ensureNotCancelled() {
      if (session.cancelled) {
        throw new Error("EVE authentication was cancelled");
      }
    }

    try {
      const state = crypto.randomBytes(32).toString("base64url");
      const { verifier, challenge } = createPkce();

      session.callback = await createCallbackListener(state);
      ensureNotCancelled();

      const url = new URL(AUTHORISE_URL);

      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("client_id", CLIENT_ID);
      url.searchParams.set("scope", scope);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");

      await shell.openExternal(url.toString());
      ensureNotCancelled();

      const code = await session.callback.promise;
      ensureNotCancelled();

      const tokens = validateTokenResponse(
        await exchangeToken({
          grant_type: "authorization_code",
          code,
          client_id: CLIENT_ID,
          code_verifier: verifier,
        })
      );
      ensureNotCancelled();

      const identity = await verifyCharacter(tokens.access_token, requiredScope);
      ensureNotCancelled();

      return { tokens, identity };
    } finally {
      session.callback?.close();
      if (activeLogin === session) {
        activeLogin = null;
      }
    }
  }

  async function linkCharacter() {
    const { tokens, identity } = await performLogin(
      CHARACTER_SCOPE
    );

    saveEsiCharacter(db, {
      ...identity,
      encryptedRefreshToken: encryptRefreshToken(
        tokens.refresh_token
      ),
      tokenExpiresAt: getTokenExpiry(tokens),
    });

    cacheAccessToken(identity.characterId, tokens);

    return identity;
  }

  async function linkCorporation() {
    const { tokens, identity } = await performLogin(
      CORPORATION_SCOPE
    );

    const corporation = await getCharacterCorporation(
      identity.characterId
    );

    await verifyCorporationWalletAccess(
      tokens.access_token,
      corporation.corporationId
    );

    saveEsiCorporationAuthorisation(db, {
      characterId: identity.characterId,
      characterName: identity.name,
      corporationId: corporation.corporationId,
      corporationName: corporation.corporationName,
      encryptedRefreshToken: encryptRefreshToken(
        tokens.refresh_token
      ),
      tokenExpiresAt: getTokenExpiry(tokens),
    });

    cacheCorporationAccessToken(
      identity.characterId,
      tokens
    );

    return {
      characterId: identity.characterId,
      characterName: identity.name,
      ...corporation,
    };
  }

  async function linkMarket() {
    const { tokens, identity } = await performLogin(MARKET_SCOPE, MARKET_SCOPE);

    db.prepare(`
      INSERT INTO esi_market_authorisations (
        character_id, character_name, encrypted_refresh_token, linked_at
      ) VALUES (?, ?, ?, ?)
      ON CONFLICT (character_id) DO UPDATE SET
        character_name = excluded.character_name,
        encrypted_refresh_token = excluded.encrypted_refresh_token,
        linked_at = excluded.linked_at
    `).run(
      identity.characterId,
      identity.name,
      encryptRefreshToken(tokens.refresh_token),
      new Date().toISOString()
    );

    return { characterId: identity.characterId, characterName: identity.name };
  }

  async function linkKillmail(sourceType) {
    validateKillmailSource(sourceType);
    const scope = sourceType === "character"
      ? CHARACTER_KILLMAIL_SCOPE
      : CORPORATION_KILLMAIL_SCOPE;
    const { tokens, identity } = await performLogin(scope);
    let corporation = null;

    if (sourceType === "corporation") {
      corporation = await getCharacterCorporation(identity.characterId);
    }

    saveEsiKillmailAuthorisation(db, {
      sourceType,
      characterId: identity.characterId,
      characterName: identity.name,
      corporationId: corporation?.corporationId ?? null,
      corporationName: corporation?.corporationName ?? null,
      encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token),
      tokenExpiresAt: getTokenExpiry(tokens),
    });

    cacheKillmailAccessToken(sourceType, identity.characterId, tokens);

    return {
      sourceType,
      characterId: identity.characterId,
      characterName: identity.name,
      ...corporation,
    };
  }

  async function performKillmailRefresh(sourceType, characterId) {
    const authorisation = getEsiKillmailAuthorisation(db, sourceType, characterId);
    if (!authorisation || authorisation.status !== "valid") {
      throw new Error("Killmail authorisation is not linked or requires attention");
    }

    const key = killmailKey(sourceType, characterId);
    const refreshToken = decryptRefreshToken(authorisation.encrypted_refresh_token);
    let tokens;

    try {
      tokens = validateTokenResponse(await exchangeToken({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: CLIENT_ID,
      }));
    } catch (error) {
      if (error instanceof EsiRequestError && [400, 401, 403].includes(error.status)) {
        killmailAccessTokenCache.delete(key);
        markEsiKillmailAuthorisationStatus(db, sourceType, characterId, "attention");
      }
      throw error;
    }

    try {
      const identity = await verifyCharacter(tokens.access_token);
      if (identity.characterId !== characterId) {
        throw new Error("Refreshed killmail token belongs to a different character");
      }

      let corporation = null;
      if (sourceType === "corporation") {
        corporation = await getCharacterCorporation(characterId);
        if (corporation.corporationId !== authorisation.corporation_id) {
          throw new Error("Authorising character changed corporations. Relink killmail access.");
        }
      }

      saveEsiKillmailAuthorisation(db, {
        sourceType,
        characterId,
        characterName: identity.name,
        corporationId: corporation?.corporationId ?? null,
        corporationName: corporation?.corporationName ?? null,
        encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token),
        tokenExpiresAt: getTokenExpiry(tokens),
      });

      cacheKillmailAccessToken(sourceType, characterId, tokens);
      return {
        sourceType,
        characterId,
        characterName: identity.name,
        ...corporation,
      };
    } catch (error) {
      killmailAccessTokenCache.delete(key);
      markEsiKillmailAuthorisationStatus(db, sourceType, characterId, "attention");
      throw error;
    }
  }

  async function refreshKillmail(sourceType, characterId) {
    const key = killmailKey(sourceType, characterId);
    if (killmailRefreshLocks.has(key)) {
      return killmailRefreshLocks.get(key);
    }

    const operation = performKillmailRefresh(sourceType, validateCharacterId(characterId));
    killmailRefreshLocks.set(key, operation);
    try {
      return await operation;
    } finally {
      killmailRefreshLocks.delete(key);
    }
  }

  async function getKillmailAccessToken(sourceType, characterId, options = {}) {
    const id = validateCharacterId(characterId);
    const key = killmailKey(sourceType, id);
    const authorisation = getEsiKillmailAuthorisation(db, sourceType, id);
    if (!authorisation || authorisation.status !== "valid") {
      killmailAccessTokenCache.delete(key);
      throw new Error("Killmail authorisation is not linked or requires attention");
    }

    if (killmailRefreshLocks.has(key)) {
      await killmailRefreshLocks.get(key);
    }

    const cached = killmailAccessTokenCache.get(key);
    if (
      options.forceRefresh !== true &&
      cached &&
      cached.expiresAt - Date.now() > TOKEN_EXPIRY_MARGIN_MS
    ) {
      return cached.token;
    }

    await refreshKillmail(sourceType, id);
    const updated = killmailAccessTokenCache.get(key);
    if (!updated?.token) {
      throw new Error("Unable to obtain killmail ESI access token");
    }
    return updated.token;
  }

  function unlinkKillmail(sourceType, characterId) {
    const key = killmailKey(sourceType, characterId);
    if (killmailRefreshLocks.has(key)) {
      throw new Error("Cannot unlink killmail access during token refresh");
    }
    const deleted = deleteEsiKillmailAuthorisation(
      db, sourceType, validateCharacterId(characterId)
    );
    killmailAccessTokenCache.delete(key);
    return deleted;
  }

  function setKillmailSyncEnabled(sourceType, characterId, enabled) {
    return setEsiKillmailSyncEnabled(
      db, validateKillmailSource(sourceType), validateCharacterId(characterId), enabled
    );
  }

  async function performRefresh(characterId) {
    const character = getEsiCharacter(db, characterId);

    if (!character) {
      throw new Error("Character is not linked");
    }

    const refreshToken = decryptRefreshToken(
      character.encrypted_refresh_token
    );

    let tokens;

    try {
      tokens = validateTokenResponse(
        await exchangeToken({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: CLIENT_ID,
        })
      );
    } catch (error) {
      if (
        error instanceof EsiRequestError &&
        [400, 401, 403].includes(error.status)
      ) {
        accessTokenCache.delete(characterId);

        markEsiCharacterStatus(
          db,
          characterId,
          "attention"
        );
      }

      throw error;
    }

    const identity = await verifyCharacter(
      tokens.access_token
    );

    if (identity.characterId !== characterId) {
      accessTokenCache.delete(characterId);
      markEsiCharacterStatus(db, characterId, "attention");

      throw new Error(
        "Refreshed token belongs to a different character"
      );
    }

    saveEsiCharacter(db, {
      ...identity,
      encryptedRefreshToken: encryptRefreshToken(
        tokens.refresh_token
      ),
      tokenExpiresAt: getTokenExpiry(tokens),
    });

    cacheAccessToken(characterId, tokens);

    return identity;
  }

  async function refreshCharacter(characterId) {
    const id = validateCharacterId(characterId);

    if (refreshLocks.has(id)) {
      return refreshLocks.get(id);
    }

    const operation = performRefresh(id);
    refreshLocks.set(id, operation);

    try {
      return await operation;
    } finally {
      refreshLocks.delete(id);
    }
  }

  async function getAccessToken(characterId, options = {}) {
    const id = validateCharacterId(characterId);
    const forceRefresh = options.forceRefresh === true;

    if (!getEsiCharacter(db, id)) {
      accessTokenCache.delete(id);
      throw new Error("Character is not linked");
    }

    if (refreshLocks.has(id)) {
      await refreshLocks.get(id);
    }

    const cached = accessTokenCache.get(id);

    if (
      !forceRefresh &&
      cached &&
      cached.expiresAt - Date.now() > TOKEN_EXPIRY_MARGIN_MS
    ) {
      return cached.token;
    }

    await refreshCharacter(id);

    const updated = accessTokenCache.get(id);

    if (!updated?.token) {
      throw new Error("Unable to obtain ESI access token");
    }

    return updated.token;
  }

  async function performCorporationRefresh(characterId) {
    const authorisation = getEsiCorporationAuthorisation(
      db,
      characterId
    );

    if (!authorisation) {
      throw new Error("Corporation authorisation is not linked");
    }

    const refreshToken = decryptRefreshToken(
      authorisation.encrypted_refresh_token
    );

    let tokens;

    try {
      tokens = validateTokenResponse(
        await exchangeToken({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          client_id: CLIENT_ID,
        })
      );
    } catch (error) {
      if (
        error instanceof EsiRequestError &&
        [400, 401, 403].includes(error.status)
      ) {
        corporationAccessTokenCache.delete(characterId);

        markEsiCorporationAuthorisationStatus(
          db,
          characterId,
          "attention"
        );
      }

      throw error;
    }

    try {
      const identity = await verifyCharacter(
        tokens.access_token
      );

      if (identity.characterId !== characterId) {
        throw new Error(
          "Refreshed corporation token belongs to a different character"
        );
      }

      const corporation = await getCharacterCorporation(
        characterId
      );

      if (
        corporation.corporationId !==
        authorisation.corporation_id
      ) {
        throw new Error(
          "Authorising character has changed corporations. Relink corporation wallet access."
        );
      }

      await verifyCorporationWalletAccess(
        tokens.access_token,
        corporation.corporationId
      );

      saveEsiCorporationAuthorisation(db, {
        characterId,
        characterName: identity.name,
        corporationId: corporation.corporationId,
        corporationName: corporation.corporationName,
        encryptedRefreshToken: encryptRefreshToken(
          tokens.refresh_token
        ),
        tokenExpiresAt: getTokenExpiry(tokens),
      });

      cacheCorporationAccessToken(characterId, tokens);

      return {
        characterId,
        characterName: identity.name,
        ...corporation,
      };
    } catch (error) {
      corporationAccessTokenCache.delete(characterId);

      markEsiCorporationAuthorisationStatus(
        db,
        characterId,
        "attention"
      );

      throw error;
    }
  }

  async function refreshCorporation(characterId) {
    const id = validateCharacterId(characterId);

    if (corporationRefreshLocks.has(id)) {
      return corporationRefreshLocks.get(id);
    }

    const operation = performCorporationRefresh(id);

    corporationRefreshLocks.set(id, operation);

    try {
      return await operation;
    } finally {
      corporationRefreshLocks.delete(id);
    }
  }

  async function getCorporationAccessToken(
    characterId,
    options = {}
  ) {
    const id = validateCharacterId(characterId);
    const forceRefresh = options.forceRefresh === true;

    const authorisation = getEsiCorporationAuthorisation(
      db,
      id
    );

    if (!authorisation) {
      corporationAccessTokenCache.delete(id);
      throw new Error("Corporation authorisation is not linked");
    }

    if (authorisation.status !== "valid") {
      corporationAccessTokenCache.delete(id);
      throw new Error(
        "Corporation wallet authorisation requires attention"
      );
    }

    if (corporationRefreshLocks.has(id)) {
      await corporationRefreshLocks.get(id);
    }

    const cached = corporationAccessTokenCache.get(id);

    if (
      !forceRefresh &&
      cached &&
      cached.expiresAt - Date.now() > TOKEN_EXPIRY_MARGIN_MS
    ) {
      return cached.token;
    }

    await refreshCorporation(id);

    const updated = corporationAccessTokenCache.get(id);

    if (!updated?.token) {
      throw new Error(
        "Unable to obtain corporation ESI access token"
      );
    }

    return updated.token;
  }

  function listCharacters() {
    return listEsiCharacters(db);
  }

  function listCorporations() {
    return listEsiCorporationAuthorisations(db);
  }

  function unlinkCharacter(characterId) {
    const id = validateCharacterId(characterId);

    if (refreshLocks.has(id)) {
      throw new Error(
        "Cannot unlink a character while token refresh is in progress"
      );
    }

    const deleted = deleteEsiCharacter(db, id);
    accessTokenCache.delete(id);

    return deleted;
  }

  function unlinkCorporation(characterId) {
    const id = validateCharacterId(characterId);

    if (corporationRefreshLocks.has(id)) {
      throw new Error(
        "Cannot unlink a corporation while token refresh is in progress"
      );
    }

    const deleted = deleteEsiCorporationAuthorisation(
      db,
      id
    );

    corporationAccessTokenCache.delete(id);

    return deleted;
  }

  const corporationMarketLink = corporationMarketDatabase
    ? createEsiMarketCorporationLink({
        corporationDatabase: corporationMarketDatabase,
        performLogin,
        getCharacterCorporation,
        encryptRefreshToken,
      })
    : null;

  return {
    linkCorporationMarket() {
      if (!corporationMarketLink) {
        throw new Error("Corporation Market linking is unavailable.");
      }

      return corporationMarketLink.linkCorporationMarket();
    },
    cancelLinking,
    linkCharacter,
    refreshCharacter,
    getAccessToken,
    listCharacters,
    unlinkCharacter,
    linkCorporation,
    refreshCorporation,
    getCorporationAccessToken,
    listCorporations,
    unlinkCorporation,
    linkMarket,
    listMarketAuthorisations() {
      return db.prepare(`
        SELECT character_id AS characterId, character_name AS characterName
        FROM esi_market_authorisations
        ORDER BY character_name COLLATE NOCASE
      `).all();
    },
    unlinkMarket(characterId) {
      return db.prepare(`
        DELETE FROM esi_market_authorisations WHERE character_id = ?
      `).run(validateCharacterId(characterId)).changes > 0;
    },
    linkKillmail,
    refreshKillmail,
    getKillmailAccessToken,
    listKillmailAuthorisations(sourceType = null) {
      return listEsiKillmailAuthorisations(db, sourceType);
    },
    setKillmailSyncEnabled,
    unlinkKillmail,
  };
}