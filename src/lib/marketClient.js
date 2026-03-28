const JITA_REGION_ID = 10000002;
const TYPEID_CACHE_KEY = "ded:typeid-cache:v1";

function normalizeName(name) {
  return String(name || "").trim();
}

function cacheKeyForName(name) {
  return normalizeName(name).toLowerCase();
}

function loadTypeIdCache() {
  try {
    return JSON.parse(localStorage.getItem(TYPEID_CACHE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveTypeIdCache(map) {
  try {
    localStorage.setItem(TYPEID_CACHE_KEY, JSON.stringify(map));
  } catch {}
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function fetchTypeIdForName(name) {
  const cleanName = normalizeName(name);
  const url = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(cleanName)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`typeid fetch failed for "${cleanName}" (${res.status})`);

  const data = await res.json();
  const parsedId = toFiniteNumber(data?.typeID ?? data?.typeId ?? data?.typeid);

  if (!parsedId) {
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
    const directTypeId = toFiniteNumber(item?.typeId);

    if (directTypeId) {
      results.push({ ...item, typeId: directTypeId });
      continue;
    }

    const cleanName = normalizeName(item?.name);
    if (!cleanName) {
      results.push({ ...item, name: cleanName, typeId: null });
      continue;
    }

    const key = cacheKeyForName(cleanName);
    const cachedId = toFiniteNumber(cache[key]);

    if (cachedId) {
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
  if (!typeIds.length) return {};

  const url = `https://market.fuzzwork.co.uk/aggregates/?region=${JITA_REGION_ID}&types=${typeIds.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`aggregates fetch failed (${res.status})`);

  const data = await res.json();
  return data || {};
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
    .map((item) => toFiniteNumber(item.typeId))
    .filter((id) => Number.isFinite(id));

  const uniqueIds = Array.from(new Set(ids));
  const aggregates = await fetchAggregates(uniqueIds);

  const priced = withIds.map((item) => {
    const typeId = toFiniteNumber(item.typeId);
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

  const iskTotal = priced.reduce((sum, item) => sum + (Number(item.total) || 0), 0);

  return {
    items: priced,
    iskTotal,
  };
}