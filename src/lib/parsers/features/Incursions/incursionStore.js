

const KEY = "incursions:ticks:v1";

export function loadIncursionTicks() {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function addIncursionTicks(newTicks) {
  const existing = loadIncursionTicks();

  const seen = new Set(
    existing.map((t) => `${t.character || "?"}|${t.timestamp}|${t.amountISK}`)
  );

  let added = 0;
  let skipped = 0;

  for (const t of newTicks) {
    const key = `${t.character || "?"}|${t.timestamp}|${t.amountISK}`;
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    existing.push(t);
    added += 1;
  }

  existing.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  localStorage.setItem(KEY, JSON.stringify(existing));
  return { added, skipped, total: existing.length };
}

export function clearIncursionTicks() {
  localStorage.removeItem(KEY);
}
