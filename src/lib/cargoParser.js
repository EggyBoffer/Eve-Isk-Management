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
  if (/^[-=_.]{3,}$/.test(l)) return true;
  return false;
}

function parseQty(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[, ]+/g, "");
  if (!/^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isSafeInteger(n) ? n : null;
}

function isAssetRow(parts) {
  if (parts.length < 4) return false;
  const quantity = parts[1].trim();
  if (quantity && parseQty(quantity) == null) return false;
  return parts.slice(2).some((part) => /\b(?:m3|m³|ISK)\b/i.test(part)) ||
    parts.length >= 6;
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

    const tabParts = line.split("\t").map((part) => part.trim());
    let name = null;
    let qty = null;

    if (isAssetRow(tabParts)) {
      name = tabParts[0];
      qty = tabParts[1] === "" ? 1 : parseQty(tabParts[1]);
    } else if (tabParts.length >= 2) {
      const nonemptyParts = tabParts.filter(Boolean);
      const last = nonemptyParts[nonemptyParts.length - 1];
      const lastQty = parseQty(last);
      if (lastQty != null) {
        name = nonemptyParts.slice(0, -1).join(" ");
        qty = lastQty;
      } else if (nonemptyParts.length === 1) {
        name = nonemptyParts[0];
        qty = 1;
      } else {
        unknownLines.push(raw);
        continue;
      }
    } else {
      const tokens = line.split(/\s+/);
      const last = tokens[tokens.length - 1];
      const maybeQty = parseQty(last);
      if (maybeQty != null) {
        qty = maybeQty;
        name = tokens.slice(0, -1).join(" ");
      } else {
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