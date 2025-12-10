// src/lib/eventBountiesStore.js
// Separate store for event bounty ticks (wallet log).
// Each entry is a parsed bounty tick, not tied to a specific site.

const KEY = "event:bounties:v1";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function loadEventBounties() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function saveEventBounties(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
  } catch {
    // ignore in non-browser environments
  }
}

/**
 * Add bounty ticks with dedupe.
 * Dedupes by (character, walletTimestamp, tickISK).
 *
 * @param {Array<{ character:string|null, tickISK:number, walletTimestamp:string|null, rawLine:string }>} ticks
 * @returns {{added:number, skipped:number}}
 */
export function addBountyTicks(ticks) {
  if (!Array.isArray(ticks) || ticks.length === 0) {
    return { added: 0, skipped: 0 };
  }

  const existing = loadEventBounties();
  const keyOf = (t) =>
    `${t.character || ""}|${t.walletTimestamp || ""}|${Math.round(t.tickISK || 0)}`;

  const existingKeys = new Set(existing.map(keyOf));
  const toAdd = [];
  let added = 0;
  let skipped = 0;

  for (const t of ticks) {
    const k = keyOf(t);
    if (existingKeys.has(k)) {
      skipped += 1;
      continue;
    }
    existingKeys.add(k);
    added += 1;
    toAdd.push({
      id: uid(),
      character: t.character || null,
      tickISK: Number(t.tickISK) || 0,
      walletTimestamp: t.walletTimestamp || null,
      rawLine: t.rawLine || "",
    });
  }

  if (toAdd.length) {
    const updated = [...toAdd, ...existing];
    saveEventBounties(updated);
  }

  return { added, skipped };
}

export function clearAllEventBounties() {
  saveEventBounties([]);
}
