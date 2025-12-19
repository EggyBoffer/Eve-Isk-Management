// src/lib/parsers/features/Incursions/incursionParser.js

import { deriveLPFromISK } from "./incursionLP";

function parseISK(value) {
  // "15,000,000 ISK" -> 15000000
  const cleaned = String(value || "")
    .replace(/ISK/i, "")
    .replace(/,/g, "")
    .trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function parseWalletTimestampToMs(ts) {
  // "2025.11.02 23:32" -> local time ms
  const s = String(ts || "").trim();
  if (!s) return 0;
  const isoLike = s.replace(/\./g, "-").replace(" ", "T") + ":00";
  const ms = new Date(isoLike).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function extractCharacter(desc) {
  const s = String(desc || "");
  const m = s.match(/CONCORD rewarded (.+?) for services performed\./i);
  return m && m[1] ? m[1].trim() : undefined;
}

function dedupeKey(r) {
  return `${r.character || "?"}|${r.timestamp}|${r.amountISK}`;
}

export function parseIncursionWalletPaste(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed = [];

  for (const raw of lines) {
    // EVE wallet paste is tab-separated
    const parts = raw.split("\t");
    if (parts.length < 3) continue;

    const timestamp = parts[0];
    const type = parts[1];
    const amountStr = parts[2];
    const balanceStr = parts[3];
    const description = parts[4] || "";

    if (type !== "Corporate Reward Payout") continue;

    const amountISK = parseISK(amountStr);
    const balanceISK = balanceStr ? parseISK(balanceStr) : undefined;
    const ts = parseWalletTimestampToMs(timestamp);
    const character = extractCharacter(description);

    const lpResult = deriveLPFromISK(amountISK);

    parsed.push({
      timestamp,
      ts,
      type,
      amountISK,
      balanceISK,
      character,
      lp: lpResult.lp,
      lpConfidence: lpResult.confidence,
      lpLabel: lpResult.label,
      raw,
    });
  }

  // Deduplicate within the pasted text itself
  const seen = new Set();
  const deduped = [];

  for (const r of parsed) {
    const key = dedupeKey(r);
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }

  // Oldest -> newest
  deduped.sort((a, b) => (a.ts || 0) - (b.ts || 0));

  return deduped;
}

export function summarizeIncursionTicks(rows) {
  const ticks = rows.length;

  let totalISK = 0;
  let totalLP = 0;
  let unknownLPCount = 0;

  const byCharacter = {};

  for (const r of rows) {
    totalISK += Number(r.amountISK) || 0;
    totalLP += Number(r.lp) || 0;
    if (r.lpConfidence === "unknown") unknownLPCount += 1;

    const name = r.character || "Unknown";
    if (!byCharacter[name]) byCharacter[name] = { ticks: 0, isk: 0, lp: 0 };
    byCharacter[name].ticks += 1;
    byCharacter[name].isk += Number(r.amountISK) || 0;
    byCharacter[name].lp += Number(r.lp) || 0;
  }

  const startTs = ticks > 0 ? rows[0].ts : undefined;
  const endTs = ticks > 0 ? rows[ticks - 1].ts : undefined;

  const durationMs =
    startTs && endTs && endTs > startTs ? endTs - startTs : 0;

  const hours = durationMs > 0 ? durationMs / 3600000 : 0;

  return {
    ticks,
    totalISK,
    totalLP,
    startTs,
    endTs,
    hours,
    iskPerHour: hours > 0 ? totalISK / hours : 0,
    lpPerHour: hours > 0 ? totalLP / hours : 0,
    unknownLPCount,
    byCharacter,
  };
}
