
import http from "node:http";
import crypto from "node:crypto";
import { safeStorage } from "electron";
import {
  initialiseEsiDatabase,
  listEsiCharacters,
  getEsiCharacter,
  saveEsiCharacter,
  markEsiCharacterStatus,
  deleteEsiCharacter,
} from "./esiDatabase.js";

const CLIENT_ID = "0be85dc3df334b098d1b123d73936275";
const REDIRECT_URI = "http://localhost:41721/callback";
const CALLBACK_PORT = 41721;
const SCOPE = "esi-wallet.read_character_wallet.v1";

const AUTHORISE_URL = "https://login.eveonline.com/v2/oauth/authorize";
const TOKEN_URL = "https://login.eveonline.com/v2/oauth/token";
const VERIFY_URL = "https://login.eveonline.com/oauth/verify";

const LOGIN_TIMEOUT_MS = 180000;
const REQUEST_TIMEOUT_MS = 15000;

function validateCharacterId(value) {
  const id = Number(value);

  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error("Invalid EVE character ID");
  }

  return id;
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

async function verifyCharacter(accessToken) {
  if (typeof accessToken !== "string" || !accessToken) {
    throw new Error("EVE did not return an access token");
  }

  const identity = await requestJson(VERIFY_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

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

      finish(new Error("EVE authentication was cancelled or denied"));
      return;
    }

    const codes = url.searchParams.getAll("code");

    if (codes.length !== 1 || !codes[0]) {
      response.writeHead(400);
      response.end("Missing authorisation code.");

      finish(new Error("EVE did not return an authorisation code"));
      return;
    }

    response.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'",
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

export function createEsiAuthService({ db, shell }) {
  initialiseEsiDatabase(db);

  let linking = false;
  const refreshLocks = new Map();

  async function linkCharacter() {
    if (linking) {
      throw new Error("Character linking is already in progress");
    }

    ensureEncryptionAvailable();
    linking = true;

    let callback;

    try {
      const state = crypto.randomBytes(32).toString("base64url");
      const { verifier, challenge } = createPkce();

      callback = await createCallbackListener(state);

      const url = new URL(AUTHORISE_URL);

      url.searchParams.set("response_type", "code");
      url.searchParams.set("redirect_uri", REDIRECT_URI);
      url.searchParams.set("client_id", CLIENT_ID);
      url.searchParams.set("scope", SCOPE);
      url.searchParams.set("state", state);
      url.searchParams.set("code_challenge", challenge);
      url.searchParams.set("code_challenge_method", "S256");

      await shell.openExternal(url.toString());

      const code = await callback.promise;

      const tokens = validateTokenResponse(
        await exchangeToken({
          grant_type: "authorization_code",
          code,
          client_id: CLIENT_ID,
          code_verifier: verifier,
        })
      );

      const identity = await verifyCharacter(
        tokens.access_token
      );

      saveEsiCharacter(db, {
        ...identity,
        encryptedRefreshToken: encryptRefreshToken(
          tokens.refresh_token
        ),
        tokenExpiresAt: getTokenExpiry(tokens),
      });

      return identity;
    } finally {
      callback?.close();
      linking = false;
    }
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

  function listCharacters() {
    return listEsiCharacters(db);
  }

  function unlinkCharacter(characterId) {
    const id = validateCharacterId(characterId);

    if (refreshLocks.has(id)) {
      throw new Error(
        "Cannot unlink a character while token refresh is in progress"
      );
    }

    return deleteEsiCharacter(db, id);
  }

  return {
    linkCharacter,
    refreshCharacter,
    listCharacters,
    unlinkCharacter,
  };
}
