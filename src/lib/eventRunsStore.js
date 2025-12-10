
const KEY = "event:runs:v1";

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function loadEventRuns() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

function saveEventRuns(runs) {
  localStorage.setItem(KEY, JSON.stringify(runs));
  try {
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
  } catch {
    // ignore
  }
}

export function addEventRun(run) {
  const now = new Date().toISOString();
  const entry = {
    id: uid(),
    createdAt: now,
    siteType: run.siteType || "Event Site",
    clearTimeMinutes: run.clearTimeMinutes || 0,
    cargoText: run.cargoText || "",
    items: run.items || [],
    lootISK: run.lootISK || 0,
    bountyISK: run.bountyISK || 0,
    totalISK: (run.lootISK || 0) + (run.bountyISK || 0),
    bountyMeta: run.bountyMeta || null, 
    meta: run.meta || {},
  };

  const all = [entry, ...loadEventRuns()];
  saveEventRuns(all);
  return entry;
}

export function deleteEventRun(id) {
  const all = loadEventRuns().filter(r => r.id !== id);
  saveEventRuns(all);
}

export function clearAllEventRuns() {
  saveEventRuns([]);
}

export function exportEventRunsAsJson() {
  const blob = new Blob([JSON.stringify(loadEventRuns(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "event-runs.json";
  a.click();
  URL.revokeObjectURL(url);
}

export async function importEventRunsFromFile(file) {
  const text = await file.text();
  const incoming = JSON.parse(text);
  if (!Array.isArray(incoming)) throw new Error("Invalid file format");
  const merged = [...incoming, ...loadEventRuns()];
  saveEventRuns(merged);
  return merged;
}
