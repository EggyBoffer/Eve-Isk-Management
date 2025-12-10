// src/lib/eventWalletParser.js
// Parse EVE wallet "Bounty Prizes" lines into structured ticks.
//
// Example line:
// 2025.12.10 06:08    Bounty Prizes    50,671,073 ISK    437,980,326 ISK    [r] Jhalabhar Xho got bounty prizes for killing pirates in Manjonakko

function parseAmount(raw) {
  if (!raw) return 0;
  const cleaned = String(raw).replace(/[, ]+/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseTimestamp(dateStr, timeStr) {
  // dateStr: 2025.12.10, timeStr: 06:08
  try {
    const [y, m, d] = dateStr.split(".").map((v) => Number(v));
    const [hh, mm] = timeStr.split(":").map((v) => Number(v));
    if (!y || !m || !d || hh == null || mm == null) return null;

    // Use UTC-ish ISO – timezone isn't super critical for our grouping
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

    // 1) Date + time at the start
    //    2025.12.10 06:08 ...
    const dtMatch = line.match(
      /^(\d{4}\.\d{2}\.\d{2})\s+(\d{2}:\d{2})/
    );
    if (!dtMatch) continue;
    const [, dateStr, timeStr] = dtMatch;
    const walletTimestamp = parseTimestamp(dateStr, timeStr);
    if (!walletTimestamp) continue;

    // 2) First ISK amount after "Bounty Prizes" = tick amount
    //    ... Bounty Prizes    50,671,073 ISK    437,980,326 ISK ...
    const bountyMatch = line.match(
      /Bounty Prizes\s+([\d.,]+)\s+ISK/i
    );
    if (!bountyMatch) continue;
    const tickISK = parseAmount(bountyMatch[1]);
    if (!tickISK) continue;

    // 3) Character name after "[r]" and before "got bounty prizes"
    //    ... [r] Jhalabhar Xho got bounty prizes ...
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
