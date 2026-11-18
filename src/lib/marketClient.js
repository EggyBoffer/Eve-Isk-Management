const JITA_REGION_ID = 10000002;
const TYPEID_CACHE_KEY = "ded:typeid-cache:v1";
const MAX_TYPES_LENGTH = 3000;

function normalizeName(name) {
  return String(name || "").trim();
}

function cacheKeyForName(name) {
  return normalizeName(name).toLowerCase();
}

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
    console.warn("Market type ID cache save failed:", error);
  }
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validTypeId(value) {
  const id = toFiniteNumber(value);
  return id !== null && Number.isSafeInteger(id) && id > 0 ? id : null;
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

async function fetchTypeIdForName(name) {
  const cleanName = normalizeName(name);
  const url = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(cleanName)}`;

  const res = await window.api.requestApi({ url });

  if (!res.ok) {
    throw new Error(
      `typeid fetch failed for "${cleanName}" (${res.status}): ${res.error || "Request failed"}`
    );
  }

  const data = res.data;
  const parsedId = validTypeId(data?.typeID ?? data?.typeId ?? data?.typeid);

  if (parsedId === null) {
    throw new Error(`No typeID for "${cleanName}"`);
  }

  return parsedId;
}

function pLimit(concurrency = 5) {
  let active = 0;
  const queue = [];

  const next = () => {
    active--;
    if (queue.length) queue.shift()();
  };

  return function limit(fn) {
    return new Promise((resolve, reject) => {
      const run = () => {
        active++;
        Promise.resolve()
          .then(fn)
          .then((value) => {
            next();
            resolve(value);
          })
          .catch((error) => {
            next();
            reject(error);
          });
      };

      if (active < concurrency) run();
      else queue.push(run);
    });
  };
}

export async function resolveTypeIds(items) {
  const cache = loadTypeIdCache();
  const results = [];
  const toLookup = [];

  for (const item of items) {
    const directTypeId = validTypeId(item?.typeId);

    if (directTypeId !== null) {
      results.push({ ...item, typeId: directTypeId });
      continue;
    }

    const cleanName = normalizeName(item?.name);
    if (!cleanName) {
      results.push({ ...item, name: cleanName, typeId: null });
      continue;
    }

    const key = cacheKeyForName(cleanName);
    const cachedId = validTypeId(cache[key]);

    if (cachedId !== null) {
      results.push({ ...item, name: cleanName, typeId: cachedId });
    } else {
      toLookup.push({ ...item, name: cleanName });
    }
  }

  const limit = pLimit(5);

  const lookedUp = await Promise.all(
    toLookup.map((item) =>
      limit(async () => {
        try {
          const id = await fetchTypeIdForName(item.name);
          cache[cacheKeyForName(item.name)] = id;
          return { ...item, typeId: id };
        } catch {
          return { ...item, typeId: null };
        }
      })
    )
  );

  saveTypeIdCache(cache);
  return [...results, ...lookedUp];
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

function getAggregateForTypeId(aggregates, typeId) {
  if (!aggregates || !typeId) return null;
  return aggregates[typeId] || aggregates[String(typeId)] || null;
}

function pickUnitPrice(aggregate) {
  if (!aggregate) return 0;

  const sellMin = toFiniteNumber(aggregate?.sell?.min);
  if (sellMin && sellMin > 0) return sellMin;

  const sellWeighted = toFiniteNumber(aggregate?.sell?.weightedAverage);
  if (sellWeighted && sellWeighted > 0) return sellWeighted;

  const buyMax = toFiniteNumber(aggregate?.buy?.max);
  if (buyMax && buyMax > 0) return buyMax;

  const buyWeighted = toFiniteNumber(aggregate?.buy?.weightedAverage);
  if (buyWeighted && buyWeighted > 0) return buyWeighted;

  return 0;
}

export async function priceItemsJita(items) {
  const withIds = await resolveTypeIds(items);

  const ids = withIds
    .map((item) => validTypeId(item.typeId))
    .filter((id) => id !== null);

  const uniqueIds = Array.from(new Set(ids));
  const aggregates = await fetchAggregates(uniqueIds);

  const priced = withIds.map((item) => {
    const typeId = validTypeId(item.typeId);
    const aggregate = typeId ? getAggregateForTypeId(aggregates, typeId) : null;
    const unitPrice = pickUnitPrice(aggregate);
    const qty = Number(item.qty ?? item.quantity ?? 0);
    const total = unitPrice * qty;

    return {
      ...item,
      typeId: typeId ?? null,
      unitPrice,
      total,
      prices: aggregate || null,
    };
  });

  const iskTotal = priced.reduce(
    (sum, item) => sum + (Number(item.total) || 0),
    0
  );

  return {
    items: priced,
    iskTotal,
  };
}