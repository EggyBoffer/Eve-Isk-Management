// src/lib/cargoParser.js
// Parses raw cargo text copied from EVE into [{ name, qty }] + unknown lines.
// Handles:
//  - "Barrage L    1995"
//  - "Navy Cap Booster 3200    5"  (numbers inside the name are OK)
//  - "Heavy Capacitor Booster II" (no qty -> defaults to 1)
//  - "Scan Resolution Script  1"
//  - Tabs or multi-space columns

const HEADER_PATTERNS = [
  /^item\b/i,
  /^type\b/i,
  /^name\b/i,
  /^quantity\b/i,
  /^qty\b/i,
  /^volume\b/i,
  /^group\b/i,
  /^size\b/i,
];
const FOOTER_PATTERNS = [
  /^total\b/i,
  /^grand total\b/i,
  /^estimated\b/i,
];

function isJunkLine(line) {
  const l = line.trim();
  if (!l) return true;
  if (HEADER_PATTERNS.some((r) => r.test(l))) return true;
  if (FOOTER_PATTERNS.some((r) => r.test(l))) return true;
  if (/^[\-\=\_\.]{3,}$/.test(l)) return true; // separators
  return false;
}

function parseQty(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[, ]+/g, "");
  if (!cleaned) return null;
  const n = Number.parseInt(cleaned, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseCargo(cargoText) {
  const items = [];
  const unknownLines = [];

  const lines = String(cargoText || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || isJunkLine(line)) continue;

    // Split by tabs first; if no tabs, fall back to spaces.
    const tabParts = line.split("\t").map(s => s.trim()).filter(Boolean);

    let name = null;
    let qty = null;

    if (tabParts.length >= 2) {
      // Assume last part is qty
      name = tabParts.slice(0, -1).join(" ");
      qty = parseQty(tabParts[tabParts.length - 1]);
    } else {
      // No tabs — use spaces. Take the LAST numeric token as qty, rest as name.
      const tokens = line.split(/\s+/);
      const last = tokens[tokens.length - 1];
      const maybeQty = parseQty(last);
      if (maybeQty != null) {
        qty = maybeQty;
        name = tokens.slice(0, -1).join(" ");
      } else {
        // No explicit qty — treat the whole line as the item name, qty = 1
        name = line;
        qty = 1;
      }
    }

    if (name && qty != null && qty > 0) {
      items.push({ name, qty });
    } else {
      unknownLines.push(raw);
    }
  }

  // Merge duplicates
  const merged = [];
  const map = new Map();
  for (const it of items) {
    const key = it.name;
    if (map.has(key)) {
      map.get(key).qty += it.qty;
    } else {
      const copy = { ...it };
      map.set(key, copy);
      merged.push(copy);
    }
  }

  return { items: merged, unknownLines };
}
