const TYPE_URL = "https://esi.evetech.net/latest/universe/types";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_CONCURRENT_LOOKUPS = 5;

export function createEsiMarketItemNamesService({ fetchType = fetch } = {}) {
  const names = new Map();
  const pendingLookups = new Map();

  async function fetchName(typeId) {
    try {
      const response = await fetchType(`${TYPE_URL}/${typeId}/`, {
        headers: { Accept: "application/json" },
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      if (!response.ok) return null;

      const type = await response.json();
      const name = typeof type?.name === "string" ? type.name.trim() : "";

      if (!name) return null;

      names.set(typeId, name);
      return name;
    } catch {
      return null;
    }
  }

  function resolveTypeName(typeId) {
    const cachedName = names.get(typeId);
    if (cachedName) return Promise.resolve(cachedName);

    const pendingLookup = pendingLookups.get(typeId);
    if (pendingLookup) return pendingLookup;

    const lookup = fetchName(typeId).finally(() => {
      pendingLookups.delete(typeId);
    });

    pendingLookups.set(typeId, lookup);
    return lookup;
  }

  async function addItemNames(rows) {
    const typeIds = [...new Set(rows.map(({ typeId }) => typeId))]
      .filter((typeId) => Number.isSafeInteger(typeId) && typeId > 0);

    for (let offset = 0; offset < typeIds.length; offset += MAX_CONCURRENT_LOOKUPS) {
      const batch = typeIds.slice(offset, offset + MAX_CONCURRENT_LOOKUPS);
      await Promise.all(batch.map(resolveTypeName));
    }

    return rows.map((row) => ({
      ...row,
      itemName: names.get(row.typeId) ?? null,
    }));
  }

  return { addItemNames };
}