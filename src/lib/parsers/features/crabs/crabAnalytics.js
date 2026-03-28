function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeText(value, fallback = "Unknown") {
  const text = String(value || "").trim();
  return text || fallback;
}

function parseRunTimestamp(value) {
  const raw = String(value || "").trim();
  if (!raw) return NaN;
  const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
  const date = new Date(normalized);
  const ms = date.getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function getRunCharacter(run) {
  return normalizeText(run.primary_character || run.participants?.[0], "Unknown");
}

function getMonthKey(value) {
  const ms = parseRunTimestamp(value);
  if (!Number.isFinite(ms)) return "Unknown";
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function toHours(minutes) {
  return num(minutes) / 60;
}

export function summarizeCrabRuns(runs) {
  const safeRuns = Array.isArray(runs) ? runs : [];
  const totalRuns = safeRuns.length;
  const totalBounties = safeRuns.reduce((sum, run) => sum + num(run.bounties_total), 0);
  const totalLoot = safeRuns.reduce((sum, run) => sum + num(run.loot_total), 0);
  const totalBeaconCost = safeRuns.reduce((sum, run) => sum + num(run.beacon_cost), 0);
  const grossTotal = safeRuns.reduce((sum, run) => sum + num(run.gross_total), 0);
  const netProfit = safeRuns.reduce((sum, run) => sum + num(run.net_profit), 0);
  const totalMinutes = safeRuns.reduce((sum, run) => sum + num(run.duration_minutes), 0);
  const totalHours = totalMinutes / 60;
  const avgNetProfit = totalRuns > 0 ? netProfit / totalRuns : 0;
  const avgLoot = totalRuns > 0 ? totalLoot / totalRuns : 0;
  const iskPerHour = totalHours > 0 ? netProfit / totalHours : 0;
  const uniqueCharacters = new Set(safeRuns.map(getRunCharacter)).size;

  return {
    runs: totalRuns,
    totalBounties,
    totalLoot,
    totalBeaconCost,
    grossTotal,
    netProfit,
    totalMinutes,
    totalHours,
    avgNetProfit,
    avgLoot,
    iskPerHour,
    uniqueCharacters,
  };
}

export function groupCrabsByCharacter(runs) {
  const map = new Map();

  for (const run of Array.isArray(runs) ? runs : []) {
    const key = getRunCharacter(run);
    const current = map.get(key) || {
      character: key,
      runs: 0,
      bounties: 0,
      loot: 0,
      beaconCost: 0,
      netProfit: 0,
      totalMinutes: 0,
      iskPerHour: 0,
    };

    current.runs += 1;
    current.bounties += num(run.bounties_total);
    current.loot += num(run.loot_total);
    current.beaconCost += num(run.beacon_cost);
    current.netProfit += num(run.net_profit);
    current.totalMinutes += num(run.duration_minutes);
    current.iskPerHour = current.totalMinutes > 0 ? current.netProfit / toHours(current.totalMinutes) : 0;

    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => b.netProfit - a.netProfit);
}

export function groupCrabsByBeaconType(runs) {
  const map = new Map();

  for (const run of Array.isArray(runs) ? runs : []) {
    const key = normalizeText(run.beacon_type || run.site_type, "Unknown");
    const current = map.get(key) || {
      beaconType: key,
      runs: 0,
      bounties: 0,
      loot: 0,
      beaconCost: 0,
      netProfit: 0,
      totalMinutes: 0,
      iskPerHour: 0,
      avgNetProfit: 0,
    };

    current.runs += 1;
    current.bounties += num(run.bounties_total);
    current.loot += num(run.loot_total);
    current.beaconCost += num(run.beacon_cost);
    current.netProfit += num(run.net_profit);
    current.totalMinutes += num(run.duration_minutes);
    current.iskPerHour = current.totalMinutes > 0 ? current.netProfit / toHours(current.totalMinutes) : 0;
    current.avgNetProfit = current.runs > 0 ? current.netProfit / current.runs : 0;

    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => b.netProfit - a.netProfit);
}

export function groupCrabsByMonth(runs) {
  const map = new Map();

  for (const run of Array.isArray(runs) ? runs : []) {
    const key = getMonthKey(run.run_date);
    const current = map.get(key) || {
      month: key,
      runs: 0,
      bounties: 0,
      loot: 0,
      beaconCost: 0,
      netProfit: 0,
      totalMinutes: 0,
      iskPerHour: 0,
    };

    current.runs += 1;
    current.bounties += num(run.bounties_total);
    current.loot += num(run.loot_total);
    current.beaconCost += num(run.beacon_cost);
    current.netProfit += num(run.net_profit);
    current.totalMinutes += num(run.duration_minutes);
    current.iskPerHour = current.totalMinutes > 0 ? current.netProfit / toHours(current.totalMinutes) : 0;

    map.set(key, current);
  }

  return Array.from(map.values()).sort((a, b) => String(b.month).localeCompare(String(a.month)));
}

export function groupCrabLootByItem(runs) {
  const map = new Map();

  for (const run of Array.isArray(runs) ? runs : []) {
    for (const item of Array.isArray(run.loot) ? run.loot : []) {
      const key = normalizeText(item.item_name, "Unknown");
      const current = map.get(key) || {
        itemName: key,
        quantity: 0,
        totalValue: 0,
        avgUnitPrice: 0,
        lines: 0,
      };

      current.quantity += num(item.quantity);
      current.totalValue += num(item.total_price);
      current.lines += 1;
      current.avgUnitPrice = current.quantity > 0 ? current.totalValue / current.quantity : 0;

      map.set(key, current);
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
}