const ESI_BASE_URL = "https://esi.evetech.net/latest";
const REQUEST_TIMEOUT_MS = 15000;

function validateId(value, label) {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw new Error(`Invalid ${label}`);
  }
  return id;
}

async function requestJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ISKONOMY/0.4 Corporation Tax Detection",
    },
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`EVE ESI request failed (${response.status})`);
  }

  return response.json();
}

export async function getCorporationInfo(corporationId) {
  const id = validateId(corporationId, "corporation ID");
  const corporation = await requestJson(`${ESI_BASE_URL}/corporations/${id}/`);
  const taxRate = Number(corporation.tax_rate);

  if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) {
    throw new Error("EVE returned an invalid corporation tax rate");
  }

  return {
    corporationId: id,
    name: corporation.name,
    ticker: corporation.ticker,
    taxRate,
    taxPercent: Math.round(taxRate * 10000) / 100,
    recommendCorporationWallet: taxRate > 0.2,
    requiresCorporationWallet: taxRate >= 1,
    checkedAt: new Date().toISOString(),
  };
}

export async function getCharacterCorporation(characterId) {
  const id = validateId(characterId, "character ID");
  const character = await requestJson(`${ESI_BASE_URL}/characters/${id}/`);
  const corporationId = validateId(character.corporation_id, "corporation ID");
  const corporation = await getCorporationInfo(corporationId);

  return { characterId: id, ...corporation };
}
