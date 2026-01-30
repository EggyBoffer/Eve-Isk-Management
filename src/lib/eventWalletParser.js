





function parseAmount(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[, ]+/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseTimestamp(dateStr, timeStr) {
  
  try {
    const [y, m, d] = dateStr.split(".").map((v) => Number(v));
    const [hh, mm] = timeStr.split(":").map((v) => Number(v));
    if (!y || !m || !d || hh == null || mm == null) return null;

    
    const iso = new Date(Date.UTC(y, m - 1, d, hh, mm, 0)).toISOString();
    return iso;
  } catch {
    return null;
  }
}


export function parseBountyTicks(rawText) {
  const text = String(rawText || "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");

  const ticks = [];

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (!line.includes("Bounty Prizes")) continue;

    
    
    const dtMatch = line.match(
      /^(\d{4}\.\d{2}\.\d{2})\s+(\d{2}:\d{2})/
    );
    if (!dtMatch) continue;
    const [, dateStr, timeStr] = dtMatch;
    const walletTimestamp = parseTimestamp(dateStr, timeStr);
    if (!walletTimestamp) continue;

    
    
    const bountyMatch = line.match(
      /Bounty Prizes\s+([\d.,]+)\s+ISK/i
    );
    if (!bountyMatch) continue;
    const tickISK = parseAmount(bountyMatch[1]);
    if (!tickISK) continue;

    
    
    const charMatch = line.match(
      /\[r\]\s+(.+?)\s+got bounty prizes/i
    );
    const character = charMatch ? charMatch[1].trim() : "Unknown";

    ticks.push({
      walletTimestamp,
      character,
      tickISK,
      rawLine: raw,
    });
  }

  return ticks;
}
