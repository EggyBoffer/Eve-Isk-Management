const ESI_BASE_URL = "https://esi.evetech.net";
const REQUEST_TIMEOUT_MS = 15000;

function parseOrder(order, authorisation) {
  const {
    order_id: orderId,
    type_id: typeId,
    location_id: locationId,
    is_buy_order: isBuyOrder = false,
    price,
    volume_remain: volumeRemaining,
    volume_total: volumeTotal,
    issued,
    duration,
  } = order ?? {};

  if (
    !Number.isSafeInteger(orderId) || orderId <= 0 ||
    !Number.isSafeInteger(typeId) || typeId <= 0 ||
    !Number.isSafeInteger(locationId) || locationId <= 0 ||
    typeof isBuyOrder !== "boolean" ||
    !Number.isFinite(price) || price < 0 ||
    !Number.isSafeInteger(volumeRemaining) || volumeRemaining < 0 ||
    !Number.isSafeInteger(volumeTotal) || volumeTotal < volumeRemaining
  ) {
    throw new Error("EVE returned an invalid market order.");
  }

  const {
    characterId,
    characterName,
    corporationId = null,
    corporationName = null,
  } = authorisation;

  return {
    orderId,
    characterId,
    characterName,
    source: corporationId === null ? "personal" : "corporation",
    corporationId,
    corporationName,
    typeId,
    locationId,
    isBuyOrder,
    price,
    volumeRemaining,
    volumeTotal,
    issued,
    duration,
  };
}

export function createEsiMarketOrdersService({
  listMarketAuthorisations,
  listCorporationMarketAuthorisations = () => [],
  getMarketAccessToken,
  fetchOrders = fetch,
}) {
  let pendingRequest = null;

  async function loadOrders(authorisation) {
    const { characterId, corporationId = null } = authorisation;

    if (!Number.isSafeInteger(characterId) || characterId <= 0) {
      throw new Error("Invalid Market character ID.");
    }

    if (corporationId !== null && (!Number.isSafeInteger(corporationId) || corporationId <= 0)) {
      throw new Error("Invalid Market corporation ID.");
    }

    const corporate = corporationId !== null;
    const path = corporate
      ? `/latest/corporations/${corporationId}/orders/`
      : `/v2/characters/${characterId}/orders/`;

    const accessToken = await getMarketAccessToken(characterId, corporationId);
    const orders = new Map();
    let pageCount = 1;

    for (let page = 1; page <= pageCount; page += 1) {
      const url = new URL(path, ESI_BASE_URL);

      if (corporate) {
        url.searchParams.set("page", String(page));
      }

      const response = await fetchOrders(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        if (corporate && response.status === 403) {
          throw new Error("EVE denied corporation order access. Check the authorising character’s corporation roles.");
        }

        throw new Error(`EVE market orders request failed (${response.status}).`);
      }

      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error("EVE returned an invalid market orders response.");
      }

      for (const row of data) {
        const order = parseOrder(row, authorisation);
        orders.set(order.orderId, order);
      }

      if (corporate && page === 1) {
        pageCount = Number(response.headers.get("x-pages") ?? 1);

        if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
          throw new Error("EVE returned an invalid corporation order page count.");
        }
      }
    }

    return [...orders.values()];
  }

  async function loadCorporationOrders(authorisations) {
    const failures = [];

    for (const authorisation of authorisations) {
      try {
        return await loadOrders(authorisation);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to fetch orders.";
        failures.push(`${authorisation.characterName || authorisation.characterId}: ${message}`);
      }
    }

    throw new Error(failures.join(" "));
  }

  async function loadOpenOrders() {
    const personalAuthorisations = listMarketAuthorisations();
    const corporationAuthorisations = listCorporationMarketAuthorisations();
    const corporations = new Map();

    for (const authorisation of corporationAuthorisations) {
      const { corporationId } = authorisation;

      if (!corporations.has(corporationId)) {
        corporations.set(corporationId, []);
      }

      corporations.get(corporationId).push(authorisation);
    }

    const orders = [];
    const errors = [];

    for (const authorisation of personalAuthorisations) {
      const { characterId, characterName } = authorisation;

      try {
        orders.push(...await loadOrders(authorisation));
      } catch (error) {
        errors.push({
          source: "personal",
          characterId,
          characterName,
          message: error instanceof Error ? error.message : "Unable to fetch market orders.",
        });
      }
    }

    for (const [corporationId, authorisations] of corporations) {
      const { corporationName } = authorisations[0];

      try {
        orders.push(...await loadCorporationOrders(authorisations));
      } catch (error) {
        errors.push({
          source: "corporation",
          corporationId,
          corporationName,
          characterId: authorisations[0].characterId,
          characterName: corporationName || `Corporation ${corporationId}`,
          message: error instanceof Error ? error.message : "Unable to fetch corporation orders.",
        });
      }
    }

    const sellOrders = orders.filter((order) => !order.isBuyOrder);
    const projectedGrossSellIncome = sellOrders.reduce(
      (total, order) => total + order.price * order.volumeRemaining,
      0
    );

    return {
      linkedCharacterCount: personalAuthorisations.length + corporations.size,
      personalSourceCount: personalAuthorisations.length,
      corporationSourceCount: corporations.size,
      orders,
      errors,
      buyOrderCount: orders.length - sellOrders.length,
      sellOrderCount: sellOrders.length,
      projectedGrossSellIncome,
      fetchedAt: new Date().toISOString(),
    };
  }

  function listOpenOrders() {
    if (!pendingRequest) {
      pendingRequest = loadOpenOrders().finally(() => {
        pendingRequest = null;
      });
    }

    return pendingRequest;
  }

  return { listOpenOrders };
}