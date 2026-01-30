

const JITA_REGION_ID = 10000002; 


const EVENT_OVERRIDES = {
  "Nation Stormhive Shard": 1_000_000,
};


async function fetchAggregates(typeIds) {
  if (!typeIds.length) return {};
  const url = `https://market.fuzzwork.co.uk/aggregates/?region=${JITA_REGION_ID}&types=${typeIds.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`aggregates fetch failed (${res.status})`);
  const data = await res.json();
  return data || {};
}


async function fetchTypeIdForName(name) {
  const url = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`typeid fetch failed for "${name}" (${res.status})`);
  const data = await res.json();
  if (!data || typeof data.typeID !== "number") throw new Error(`No typeID for "${name}"`);
  return data.typeID;
}


const TYPEID_CACHE_KEY = "event:typeid-cache:v1";

function loadTypeIdCache() {
  try { return JSON.parse(localStorage.getItem(TYPEID_CACHE_KEY) || "{}"); }
  catch { return {}; }
}
function saveTypeIdCache(map) {
  try { localStorage.setItem(TYPEID_CACHE_KEY, JSON.stringify(map)); }
  catch {  }
}


async function resolveTypeIds(items) {
  const cache = loadTypeIdCache();
  const results = [];
  const toLookup = [];

  for (const it of items) {
    const cached = cache[it.name];
    if (typeof cached === "number") {
      results.push({ ...it, typeId: cached });
    } else {
      toLookup.push(it);
    }
  }

  const lookedUp = await Promise.all(toLookup.map(async (it) => {
    try {
      const id = await fetchTypeIdForName(it.name);
      cache[it.name] = id;
      return { ...it, typeId: id };
    } catch {
      return { ...it, typeId: null };
    }
  }));

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
      overrideItems.push({ ...it, unitPrice: unit, total, prices: { override: true } });
    } else {
      jitaItems.push(it);
    }
  }

  let jitaPriced = [];
  if (jitaItems.length) {
    const withIds = await resolveTypeIds(jitaItems);
    const ids = withIds.map(x => x.typeId).filter(id => typeof id === "number");
    const uniqueIds = Array.from(new Set(ids));
    const aggregates = await fetchAggregates(uniqueIds);

    jitaPriced = withIds.map(it => {
      const agg = it.typeId ? aggregates[it.typeId] : null;
      const unit = agg ? Number(agg.sell?.min ?? 0) : 0;
      const total = unit * (Number(it.qty) || 0);
      return { ...it, unitPrice: unit, total, prices: agg || null };
    });
  }

  const combined = [...overrideItems, ...jitaPriced];
  const lootISK = combined.reduce((s, it) => s + (Number(it.total) || 0), 0);

  return { items: combined, lootISK };
}
