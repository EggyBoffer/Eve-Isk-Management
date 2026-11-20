const ORDERS_URL = "https://esi.evetech.net/latest/markets/10000002/orders/";
const JITA_STATION_ID = 60003760;
const REQUEST_TIMEOUT_MS = 15000;
const MAX_CONCURRENT_LOOKUPS = 4;

export function createEsiJitaPriceCheckService({ fetchOrders = fetch } = {}) {
  async function quoteType(typeId) {
    let bestBuy = null;
    let bestSell = null;
    let pageCount = 1;

    for (let page = 1; page <= pageCount; page += 1) {
      const url = new URL(ORDERS_URL);
      url.searchParams.set("order_type", "all");
      url.searchParams.set("type_id", String(typeId));
      url.searchParams.set("page", String(page));

      const response = await fetchOrders(url.toString(), {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) {
        throw new Error(`EVE market request failed (${response.status}).`);
      }

      const orders = await response.json();

      if (!Array.isArray(orders)) {
        throw new Error("EVE returned an invalid order book.");
      }

      if (page === 1) {
        pageCount = Number(response.headers.get("x-pages") ?? 1);

        if (!Number.isSafeInteger(pageCount) || pageCount < 1) {
          throw new Error("EVE returned an invalid order book page count.");
        }
      }

      for (const order of orders) {
        if (
          order.location_id !== JITA_STATION_ID ||
          order.volume_remain <= 0 ||
          !Number.isFinite(order.price) ||
          order.price <= 0
        ) {
          continue;
        }

        if (order.is_buy_order === true) {
          bestBuy = bestBuy === null ? order.price : Math.max(bestBuy, order.price);
        } else if (order.is_buy_order === false) {
          bestSell = bestSell === null ? order.price : Math.min(bestSell, order.price);
        }
      }
    }

    return { typeId, bestBuy, bestSell };
  }

  async function quoteTypes(typeIds) {
    if (
      !Array.isArray(typeIds) ||
      !typeIds.every((id) => Number.isSafeInteger(id) && id > 0)
    ) {
      throw new Error("Invalid item type IDs.");
    }

    const uniqueIds = [...new Set(typeIds)];
    const quotes = [];

    for (let offset = 0; offset < uniqueIds.length; offset += MAX_CONCURRENT_LOOKUPS) {
      const batch = uniqueIds.slice(offset, offset + MAX_CONCURRENT_LOOKUPS);
      const results = await Promise.all(
        batch.map(async (typeId) => {
          try {
            return await quoteType(typeId);
          } catch (error) {
            return {
              typeId,
              bestBuy: null,
              bestSell: null,
              error: error instanceof Error ? error.message : "Unable to load Jita prices.",
            };
          }
        })
      );

      quotes.push(...results);
    }

    return quotes;
  }

  return { quoteTypes };
}