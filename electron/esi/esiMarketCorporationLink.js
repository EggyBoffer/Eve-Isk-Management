const CORPORATION_MARKET_SCOPE = "esi-markets.read_corporation_orders.v1";
const ESI_BASE_URL = "https://esi.evetech.net/latest";
const REQUEST_TIMEOUT_MS = 15000;

export function createEsiMarketCorporationLink({
  corporationDatabase,
  performLogin,
  getCharacterCorporation,
  encryptRefreshToken,
  fetchOrders = fetch,
}) {
  async function linkCorporationMarket() {
    const { identity, tokens } = await performLogin(
      CORPORATION_MARKET_SCOPE,
      CORPORATION_MARKET_SCOPE
    );

    const { characterId, name: characterName } = identity;
    const { corporationId, corporationName } = await getCharacterCorporation(characterId);

    const response = await fetchOrders(
      `${ESI_BASE_URL}/corporations/${corporationId}/orders/?page=1`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    );

    if (response.status === 403) {
      throw new Error(
        "EVE denied access to corporation orders. Select a character with the Accountant or Trader role."
      );
    }

    if (!response.ok) {
      throw new Error(`EVE corporation order access check failed (${response.status}).`);
    }

    const orders = await response.json();

    if (!Array.isArray(orders)) {
      throw new Error("EVE returned an invalid corporation orders response.");
    }

    corporationDatabase.saveAuthorisation({
      characterId,
      characterName,
      corporationId,
      corporationName,
      encryptedRefreshToken: encryptRefreshToken(tokens.refresh_token),
    });

    return { characterId, characterName, corporationId, corporationName };
  }

  return { linkCorporationMarket };
}