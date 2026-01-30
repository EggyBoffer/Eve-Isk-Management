

export const INCURSION_PAYOUTS = [
  
  { isk: 10395000, lp: 1400, label: "HS Vanguard (max)" },
  { isk: 18200000, lp: 3500, label: "HS Assault (max)" },
  { isk: 31500000, lp: 7000, label: "HS HQ (max)" },

  
  { isk: 15000000, lp: 2000, label: "LS/NS Vanguard (max)" },
  { isk: 26000000, lp: 5000, label: "LS/NS Assault (max)" },
  { isk: 45000000, lp: 10000, label: "LS/NS HQ (max)" },

  
  { isk: 9615375, lp: 1295, label: "HS Vanguard (scaled)" },
  { isk: 8783775, lp: 1183, label: "HS Vanguard (scaled)" },
  { isk: 7900200, lp: 1064, label: "HS Vanguard (scaled)" },

  { isk: 16835000, lp: 3238, label: "HS Assault (scaled)" },
  { isk: 15379000, lp: 2958, label: "HS Assault (scaled)" },
];

export function deriveLPFromISK(amountISK, opts) {
  const tolerancePct = (opts && opts.tolerancePct) != null ? opts.tolerancePct : 0.02;

  const exact = INCURSION_PAYOUTS.find((p) => p.isk === amountISK);
  if (exact) {
    return { lp: exact.lp, label: exact.label, matchedISK: exact.isk, confidence: "exact" };
  }

  let best = null;
  let bestDelta = Number.POSITIVE_INFINITY;

  for (const p of INCURSION_PAYOUTS) {
    const delta = Math.abs(amountISK - p.isk) / p.isk;
    if (delta < bestDelta) {
      bestDelta = delta;
      best = p;
    }
  }

  if (best && bestDelta <= tolerancePct) {
    return { lp: best.lp, label: best.label, matchedISK: best.isk, confidence: "nearest" };
  }

  return { lp: 0, confidence: "unknown" };
}
