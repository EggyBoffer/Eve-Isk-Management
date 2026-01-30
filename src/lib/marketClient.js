




const JITA_REGION_ID = 10000002; 
const TYPEID_CACHE_KEY = "ded:typeid-cache:v1";

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
  } catch (err) {
    
    
    
    console.debug && console.debug("marketClient: failed to save typeId cache", err);
  }
}

async function fetchTypeIdForName(name) {
  const url = `https://www.fuzzwork.co.uk/api/typeid.php?typename=${encodeURIComponent(name)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`typeid fetch failed for "${name}" (${res.status})`);
  const data = await res.json();
  if (!data || typeof data.typeID !== "number") throw new Error(`No typeID for "${name}"`);
  return data.typeID;
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
          .then((v) => { next(); resolve(v); })
          .catch((e) => { next(); reject(e); });
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

  for (const it of items) {
    const cached = cache[it.name];
    if (typeof cached === "number") results.push({ ...it, typeId: cached });
    else toLookup.push(it);
  }

  const limit = pLimit(5);
  const lookedUp = await Promise.all(
    toLookup.map((it) =>
      limit(async () => {
        try {
          const id = await fetchTypeIdForName(it.name);
          cache[it.name] = id;
          return { ...it, typeId: id };
        } catch {
          return { ...it, typeId: null }; 
        }
      })
    )
  );

  saveTypeIdCache(cache);
  return [...results, ...lookedUp];
}

async function fetchAggregates(typeIds) {
  if (typeIds.length === 0) return {};
  const url = `https://market.fuzzwork.co.uk/aggregates/?region=${JITA_REGION_ID}&types=${typeIds.join(",")}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`aggregates fetch failed (${res.status})`);
  const data = await res.json();
  return data || {};
}


export async function priceItemsJita(items) {
  
  const withIds = await resolveTypeIds(items);

  
  const ids = withIds.map((x) => x.typeId).filter((id) => typeof id === "number");
  const uniqueIds = Array.from(new Set(ids));
  const aggregates = await fetchAggregates(uniqueIds);

  
  const priced = withIds.map((it) => {
    const agg = it.typeId ? aggregates[it.typeId] : null;
    const unit = agg ? Number(agg.sell?.min ?? 0) : 0;
    const total = unit * (Number(it.qty) || 0);
    return { ...it, unitPrice: unit, total, prices: agg || null };
  });

  const iskTotal = priced.reduce((s, it) => s + (Number(it.total) || 0), 0);
  return { items: priced, iskTotal };
}
