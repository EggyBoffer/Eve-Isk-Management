const JITA_REGION_ID = 10000002;
const MAX_TYPES_LENGTH = 3000;

const EVENT_OVERRIDES = {
  "Nation Stormhive Shard": 1_000_000,
};

function validTypeId(value) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

function batchTypeIds(typeIds) {
  const batches = [];
  let current = [];
  let length = 0;

  for (const id of typeIds) {
    const text = String(id);
    const additionalLength = text.length + (current.length ? 1 : 0);

    if (current.length && length + additionalLength > MAX_TYPES_LENGTH) {
      batches.push(current);
      current = [];
      length = 0;
    }

    current.push(id);
    length += text.length + (current.length > 1 ? 1 : 0);
  }

  if (current.length) batches.push(current);
  return batches;
}

async function fetchAggregates(typeIds) {
  const uniqueIds = Array.from(
    new Set(typeIds.map(validTypeId).filter((id) => id !== null))
  );

  if (!uniqueIds.length) return {};

  const aggregates = {};

  for (const batch of batchTypeIds(uniqueIds)) {
    const url = `https://market.fuzzwork.co.uk/aggregates/?region=${JITA_REGION_ID}&types=${batch.join(",")}`;

    const res = await window.api.requestApi({ url });

    if (!res.ok) {
      throw new Error(
        `aggregates fetch failed (${res.status}): ${res.error || "Request failed"}`
      );
    }

    Object.assign(aggregates, res.data || {});
  }

  return aggregates;
}

async function fetchTypeIdForName(name) {
  const url = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(name)}`;

  const res = await window.api.requestApi({ url });

  if (!res.ok) {
    throw new Error(
      `typeid fetch failed for "${name}" (${res.status}): ${res.error || "Request failed"}`
    );
  }

  const data = res.data;
  const typeId = validTypeId(data?.typeID);

  if (typeId === null) {
    throw new Error(`No typeID for "${name}"`);
  }

  return typeId;
}

const TYPEID_CACHE_KEY = "event:typeid-cache:v1";

function loadTypeIdCache() {
  try {
    const value = JSON.parse(localStorage.getItem(TYPEID_CACHE_KEY) || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};
  } catch {
    return {};
  }
}

function saveTypeIdCache(map) {
  try {
    localStorage.setItem(TYPEID_CACHE_KEY, JSON.stringify(map));
  } catch (error) {
    console.warn("Event type ID cache save failed:", error);
  }
}

async function resolveTypeIds(items) {
  const cache = loadTypeIdCache();
  const results = [];
  const toLookup = [];

  for (const it of items) {
    const cached = validTypeId(cache[it.name]);

    if (cached !== null) {
      results.push({ ...it, typeId: cached });
    } else {
      toLookup.push(it);
    }
  }

  const lookedUp = await Promise.all(
    toLookup.map(async (it) => {
      try {
        const id = await fetchTypeIdForName(it.name);
        cache[it.name] = id;
        return { ...it, typeId: id };
      } catch {
        return { ...it, typeId: null };
      }
    })
  );

  saveTypeIdCache(cache);
  return [...results, ...lookedUp];
}

export async function priceEventItems(items) {
  const overrideItems = [];
  const jitaItems = [];

  for (const it of items) {
    if (Object.prototype.hasOwnProperty.call(EVENT_OVERRIDES, it.name)) {
      const unit = Number(EVENT_OVERRIDES[it.name]) || 0;
      const total = unit * (Number(it.qty) || 0);

      overrideItems.push({
        ...it,
        unitPrice: unit,
        total,
        prices: { override: true },
      });
    } else {
      jitaItems.push(it);
    }
  }

  let jitaPriced = [];

  if (jitaItems.length) {
    const withIds = await resolveTypeIds(jitaItems);
    const ids = withIds
      .map((x) => validTypeId(x.typeId))
      .filter((id) => id !== null);

    const uniqueIds = Array.from(new Set(ids));
    const aggregates = await fetchAggregates(uniqueIds);

    jitaPriced = withIds.map((it) => {
      const agg = it.typeId ? aggregates[it.typeId] : null;
      const unit = agg ? Number(agg.sell?.min ?? 0) : 0;
      const total = unit * (Number(it.qty) || 0);

      return {
        ...it,
        unitPrice: unit,
        total,
        prices: agg || null,
      };
    });
  }

  const combined = [...overrideItems, ...jitaPriced];

  const lootISK = combined.reduce(
    (s, it) => s + (Number(it.total) || 0),
    0
  );

  return { items: combined, lootISK };
}