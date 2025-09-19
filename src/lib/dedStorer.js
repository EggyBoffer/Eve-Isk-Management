// src/lib/dedStore.js
// Storage layer for DED runs. Designed so we can swap to an API/DB later
// without touching page components. Includes basic import/export utilities.

const KEY = "ded:runs:v1";

// --- helpers ---
function safeParse(json) {
  try { return JSON.parse(json ?? "[]") || []; }
  catch { return []; }
}
function save(runs) {
  localStorage.setItem(KEY, JSON.stringify(runs));
}
function newId() {
  return (crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
}

// --- public API ---
export function loadRuns() {
  return safeParse(localStorage.getItem(KEY));
}

/**
 * Add a new run
 * Shape is future-analytics ready:
 * - dedLevel: "1/10".."10/10"
 * - clearTimeMinutes: number
 * - cargoText: raw pasted text from EVE
 * - items: parsed [{ name, qty }] (optional; we’ll fill later)
 * - iskTotal: number (optional; we’ll fill later from market API)
 * - meta: { region, constellation, system, ship, notes } (optional)
 */
export function addRun(run) {
  const runs = loadRuns();
  const entry = {
    id: newId(),
    createdAt: new Date().toISOString(),
    ...run,
  };
  runs.unshift(entry); // newest first
  save(runs);
  return entry;
}

export function updateRun(id, patch) {
  const runs = loadRuns();
  const idx = runs.findIndex(r => r.id === id);
  if (idx === -1) return null;
  runs[idx] = { ...runs[idx], ...patch, updatedAt: new Date().toISOString() };
  save(runs);
  return runs[idx];
}

export function deleteRun(id) {
  const next = loadRuns().filter(r => r.id !== id);
  save(next);
}

export function clearAllRuns() {
  localStorage.removeItem(KEY);
}

// --- import/export for backups/migration ---
export function exportRunsAsJson() {
  const blob = new Blob([JSON.stringify(loadRuns(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ded-runs-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function importRunsFromFile(file) {
  const text = await file.text();
  const incoming = safeParse(text);
  if (!Array.isArray(incoming)) throw new Error("Invalid file format");

  // naive merge (dedupe by id)
  const current = loadRuns();
  const mergedMap = new Map();
  [...incoming, ...current].forEach(r => mergedMap.set(r.id, r));

  const result = Array.from(mergedMap.values()).sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  );
  save(result);
  return result;
}

// --- (optional) selectors useful for a future DEDAnalytics page ---
export function getBasicStats() {
  const runs = loadRuns();
  const totalRuns = runs.length;
  const totalMinutes = runs.reduce((s, r) => s + (Number(r.clearTimeMinutes) || 0), 0);
  const totalISK = runs.reduce((s, r) => s + (Number(r.iskTotal) || 0), 0);
  const avgISKPerRun = totalRuns ? totalISK / totalRuns : 0;
  const iskPerHour = totalMinutes ? totalISK / (totalMinutes / 60) : 0;
  return { totalRuns, totalMinutes, totalISK, avgISKPerRun, iskPerHour };
}
