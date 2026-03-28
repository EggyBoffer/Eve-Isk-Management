import { parseCargo } from "../../../cargoParser";
import { priceItemsJita } from "../../../marketClient";

const ESI_UNIVERSE_IDS_URL = "https://esi.evetech.net/latest/universe/ids/?datasource=tranquility";
const CRAB_LOOT_TYPEID_CACHE_KEY = "crabs:loot-typeids:v1";
const FIXED_PRICE_OVERRIDES = {
  "rogue drone infestation data": 100000,
};

function normalizeName(name) {
  return String(name || "").trim();
}

function cacheKey(name) {
  return normalizeName(name).toLowerCase();
}

function loadCache() {
  try {
    return JSON.parse(localStorage.getItem(CRAB_LOOT_TYPEID_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveCache(map) {
  try {
    localStorage.setItem(CRAB_LOOT_TYPEID_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

async function resolveNamesViaEsi(names) {
  if (!names.length) return {};

  const res = await fetch(ESI_UNIVERSE_IDS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(names),
  });

  if (!res.ok) {
    throw new Error(`ESI universe ids lookup failed (${res.status})`);
  }

  const data = await res.json();
  const inventoryTypes = Array.isArray(data?.inventory_types) ? data.inventory_types : [];
  const resolved = {};

  for (const entry of inventoryTypes) {
    const name = normalizeName(entry?.name);
    const id = Number(entry?.id);
    if (name && Number.isFinite(id) && id > 0) {
      resolved[cacheKey(name)] = id;
    }
  }

  return resolved;
}

export function parseCrabLoot(text) {
  const { items, unknownLines } = parseCargo(text);

  return {
    items: items.map((item) => ({
      item_name: item.name,
      name: item.name,
      quantity: item.qty,
      qty: item.qty,
      type_id: null,
      unit_price: 0,
      total_price: 0,
    })),
    unknownLines,
  };
}

async function resolveCrabLootTypeIds(items) {
  const cache = loadCache();
  const unresolvedNames = [];

  for (const item of items) {
    const key = cacheKey(item.name);
    const cachedId = Number(cache[key]);
    if (!(Number.isFinite(cachedId) && cachedId > 0)) {
      unresolvedNames.push(normalizeName(item.name));
    }
  }

  const uniqueUnresolved = Array.from(new Set(unresolvedNames.filter(Boolean)));

  if (uniqueUnresolved.length) {
    const resolved = await resolveNamesViaEsi(uniqueUnresolved);
    for (const [key, id] of Object.entries(resolved)) {
      cache[key] = id;
    }
    saveCache(cache);
  }

  return items.map((item) => {
    const key = cacheKey(item.name);
    const typeId = Number(cache[key]);
    return {
      ...item,
      type_id: Number.isFinite(typeId) && typeId > 0 ? typeId : null,
    };
  });
}

export async function priceCrabLoot(text) {
  const parsed = parseCrabLoot(text);

  if (!parsed.items.length) {
    return {
      items: [],
      unknownLines: parsed.unknownLines,
      unresolvedItems: [],
      lootTotal: 0,
    };
  }

  const withTypeIds = await resolveCrabLootTypeIds(parsed.items);

  const fixedPriceItems = withTypeIds.filter((item) => {
    const key = cacheKey(item.name);
    return Number.isFinite(FIXED_PRICE_OVERRIDES[key]);
  });

  const marketPriceItems = withTypeIds.filter((item) => {
    const key = cacheKey(item.name);
    return !Number.isFinite(FIXED_PRICE_OVERRIDES[key]) && item.type_id;
  });

  const unresolvedItems = withTypeIds
    .filter((item) => {
      const key = cacheKey(item.name);
      return !Number.isFinite(FIXED_PRICE_OVERRIDES[key]) && !item.type_id;
    })
    .map((item) => item.item_name);

  const priced = marketPriceItems.length
    ? await priceItemsJita(
        marketPriceItems.map((item) => ({
          typeId: item.type_id,
          qty: item.qty,
          name: item.name,
        }))
      )
    : { items: [], iskTotal: 0 };

  const pricedByTypeId = new Map(priced.items.map((item) => [Number(item.typeId), item]));

  const items = withTypeIds.map((item) => {
    const key = cacheKey(item.name);
    const fixedUnitPrice = FIXED_PRICE_OVERRIDES[key];

    if (Number.isFinite(fixedUnitPrice)) {
      const quantity = Number(item.qty ?? item.quantity ?? 0);
      return {
        item_name: item.item_name,
        name: item.name,
        quantity,
        qty: quantity,
        type_id: item.type_id ?? null,
        unit_price: fixedUnitPrice,
        total_price: fixedUnitPrice * quantity,
      };
    }

    const pricedItem = item.type_id ? pricedByTypeId.get(Number(item.type_id)) : null;

    return {
      item_name: item.item_name,
      name: item.name,
      quantity: Number(item.qty ?? item.quantity ?? 0),
      qty: Number(item.qty ?? item.quantity ?? 0),
      type_id: item.type_id ?? null,
      unit_price: Number(pricedItem?.unitPrice ?? 0),
      total_price: Number(pricedItem?.total ?? 0),
    };
  });

  return {
    items,
    unknownLines: parsed.unknownLines,
    unresolvedItems,
    lootTotal: items.reduce((sum, item) => sum + Number(item.total_price || 0), 0),
  };
}

export function sumCrabLoot(items) {
  return items.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
}