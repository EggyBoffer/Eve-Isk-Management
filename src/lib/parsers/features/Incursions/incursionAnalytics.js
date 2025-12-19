// src/lib/parsers/features/Incursions/incursionAnalytics.js

export function groupIncursionsByCharacter(rows) {
  const by = {};

  for (const r of rows) {
    const name = r.character || "Unknown";
    if (!by[name]) by[name] = { character: name, ticks: 0, isk: 0, lp: 0 };
    by[name].ticks += 1;
    by[name].isk += Number(r.amountISK) || 0;
    by[name].lp += Number(r.lp) || 0;
  }

  return Object.values(by).sort((a, b) => b.isk - a.isk);
}

export function groupIncursionsByMonth(rows) {
  const by = {};

  for (const r of rows) {
    if (!r.ts) continue;
    const d = new Date(r.ts);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; // YYYY-MM

    if (!by[key]) by[key] = { month: key, ticks: 0, isk: 0, lp: 0 };
    by[key].ticks += 1;
    by[key].isk += Number(r.amountISK) || 0;
    by[key].lp += Number(r.lp) || 0;
  }

  return Object.values(by).sort((a, b) => (a.month > b.month ? 1 : -1));
}
