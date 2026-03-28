export function parseCrabLoot(text) {
  if (!text || typeof text !== "string") return [];

  const lines = text.split(/\r?\n/);
  const results = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(.*?)(?:\t+|\s{2,})(\d+)$/);
    if (!match) continue;

    const itemName = String(match[1] || "").trim();
    const quantity = Number(match[2] || 0);

    if (!itemName || !Number.isFinite(quantity) || quantity <= 0) continue;

    results.push({
      item_name: itemName,
      type_id: null,
      quantity,
      unit_price: 0,
      total_price: 0,
    });
  }

  return results;
}

export function sumCrabLoot(items) {
  return items.reduce((sum, item) => sum + Number(item.total_price || 0), 0);
}