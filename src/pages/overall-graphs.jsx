import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/overall-graphs.css";

import { loadRuns as loadDEDRuns } from "../lib/dedStorer";
import { loadEventRuns } from "../lib/eventRunsStore";
import { loadEventBounties } from "../lib/eventBountiesStore";
import { loadIncursionTicks } from "../lib/parsers/features/Incursions/incursionStore";
import { getAllCrabRuns } from "../lib/crabStore";

const MODULES = [
  { label: "Abyssals", key: "abyss", color: "#61dafb" },
  { label: "DED", key: "ded", color: "#7b8cff" },
  { label: "Events", key: "events", color: "#4fd1c5" },
  { label: "Incursions", key: "incursions", color: "#ffd089" },
  { label: "CRABs", key: "crabs", color: "#ffb46b" },
  { label: "Officers", key: "officers", color: "#c084fc" },
  { label: "FOBs", key: "fobs", color: "#f472b6" },
];

const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const sum = (rows, fn) => rows.reduce((total, row) => total + fn(row), 0);
const fmtInt = (value) => Math.round(num(value)).toLocaleString("en-GB");
const fmtISK = (value) => `${fmtInt(value)} ISK`;
function fmtCompactISK(value) {
  const n = num(value);
  const absolute = Math.abs(n);
  if (absolute >= 1e9) return `${(n / 1e9).toFixed(absolute >= 1e10 ? 0 : 1)}b`;
  if (absolute >= 1e6) return `${(n / 1e6).toFixed(absolute >= 1e7 ? 0 : 1)}m`;
  if (absolute >= 1e3) return `${(n / 1e3).toFixed(absolute >= 1e4 ? 0 : 1)}k`;
  return fmtInt(n);
}
function dateValue(value) {
  if (!value) return null;
  const source = String(value).trim();
  const normalized = /^\d{4}\.\d{2}\.\d{2} /.test(source)
    ? source.replace(/\./g, "-").replace(" ", "T") + (source.endsWith("Z") ? "" : "Z")
    : source;
  const date = new Date(normalized);
  return Number.isFinite(date.getTime()) ? date : null;
}
function monthKey(value) {
  const date = dateValue(value);
  return date ? date.toISOString().slice(0, 7) : null;
}
function dayKey(value) {
  const date = dateValue(value);
  return date ? date.toISOString().slice(0, 10) : null;
}
function abyssProfit(entry) {
  const ship = String(entry?.ship_type || "").toLowerCase();
  const multiplier = ship === "frigate" ? 3 : ship === "destroyer" ? 2 : 1;
  return num(entry?.room1_isk) + num(entry?.room2_isk) + num(entry?.room3_isk) - num(entry?.fillament_cost) * multiplier;
}
function glorifiedProfit(entry) {
  return num(entry?.isk_earned ?? entry?.value_isk ?? entry?.value ?? entry?.isk);
}
function loadLocalData() {
  return {
    dedRuns: loadDEDRuns(),
    eventRuns: loadEventRuns(),
    eventBounties: loadEventBounties(),
    incursionTicks: loadIncursionTicks(),
  };
}
async function loadOfficerRecords() {
  if (typeof window.api?.officerListKills !== "function") throw new Error("Officer Tracking API unavailable");
  const records = [];
  let offset = 0;
  while (true) {
    const batch = await window.api.officerListKills({ limit: 1000, offset });
    if (!Array.isArray(batch)) throw new Error("Invalid Officer Tracking response");
    records.push(...batch);
    if (batch.length < 1000) break;
    offset += batch.length;
  }
  return records;
}
async function loadFobDashboard() {
  if (typeof window.api?.fobGetAnalyticsDashboard !== "function") throw new Error("FOB Analytics API unavailable");
  const now = new Date();
  const firstMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11, 1));
  return Promise.all([
    window.api.fobGetAnalyticsDashboard({ startDate: "2003-01-01T00:00:00.000Z", endDate: now.toISOString(), historyDays: 365 }),
    window.api.fobGetAnalyticsDashboard({ startDate: firstMonth.toISOString(), endDate: now.toISOString(), historyDays: 365 }),
  ]).then(([allTime, recent]) => ({ allTime, recent }));
}
function buildLast12Months() {
  const result = new Map();
  const now = new Date();
  for (let offset = 11; offset >= 0; offset--) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1));
    const key = date.toISOString().slice(0, 7);
    const row = { key, label: date.toLocaleString("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" }) };
    for (const module of MODULES) row[module.key] = 0;
    result.set(key, row);
  }
  return result;
}
function addMonth(months, date, key, amount) {
  const month = months.get(monthKey(date));
  if (month) month[key] += num(amount);
}
function groupBest(rows, keyFn, amountFn) {
  const totals = new Map();
  for (const row of rows) {
    const key = String(keyFn(row) || "Unknown");
    totals.set(key, (totals.get(key) || 0) + num(amountFn(row)));
  }
  return [...totals].sort((a, b) => b[1] - a[1])[0] || null;
}
function highlight(module, title, best, fallback = "No data yet") {
  return { module, title, value: best ? String(best[0]) : "No data", meta: best ? fmtISK(best[1]) : fallback };
}
function buildGraphs(data) {
  const { abyssals, glorified, dedRuns, eventRuns, eventBounties, incursionTicks, crabRuns, officers, fob } = data;
  const fobSummary = fob?.allTime?.summary;
  const fobHistory = fob?.recent?.history?.data || [];
  const totalsByModule = [
    { label: "Abyssals", profit: sum(abyssals, abyssProfit) + sum(glorified, glorifiedProfit), count: abyssals.length },
    { label: "DED", profit: sum(dedRuns, (r) => num(r.iskTotal)), count: dedRuns.length },
    { label: "Events", profit: sum(eventRuns, (r) => num(r.lootISK) + num(r.bountyISK)) + sum(eventBounties, (r) => num(r.tickISK)), count: eventRuns.length },
    { label: "Incursions", profit: sum(incursionTicks, (r) => num(r.amountISK)), count: incursionTicks.length },
    { label: "CRABs", profit: sum(crabRuns, (r) => num(r.net_profit)), count: crabRuns.length },
    { label: "Officers", profit: sum(officers, (r) => num(r.lootValue)), count: sum(officers, (r) => num(r.quantity) || 1) },
    { label: "FOBs", profit: num(fobSummary?.income?.gross ?? fobSummary?.income?.total), count: num(fobSummary?.completions?.total) },
  ];
  const months = buildLast12Months();
  for (const r of abyssals) addMonth(months, r.date || r.createdAt, "abyss", abyssProfit(r));
  for (const r of glorified) addMonth(months, r.date || r.createdAt, "abyss", glorifiedProfit(r));
  for (const r of dedRuns) addMonth(months, r.createdAt || r.date, "ded", r.iskTotal);
  for (const r of eventRuns) addMonth(months, r.createdAt || r.date, "events", num(r.lootISK) + num(r.bountyISK));
  for (const r of eventBounties) addMonth(months, r.walletTimestamp || r.timestamp || r.createdAt || r.date, "events", r.tickISK);
  for (const r of incursionTicks) addMonth(months, r.timestamp, "incursions", r.amountISK);
  for (const r of crabRuns) addMonth(months, r.created_at || r.createdAt || r.date, "crabs", r.net_profit);
  for (const r of officers) addMonth(months, r.date, "officers", r.lootValue);
  for (const r of fobHistory) addMonth(months, r.date, "fobs", r.grossIncome ?? r.income);
  const monthlyRows = [...months.values()].map((row) => ({
    ...row,
    total: MODULES.reduce((total, module) => total + row[module.key], 0),
  }));
  const abyssBest = groupBest(abyssals, (r) => `${r.tier || ""} ${r.storm_type || ""}`.trim(), abyssProfit);
  const dedBest = groupBest(dedRuns, (r) => r.dedLevel, (r) => r.iskTotal);
  const eventDays = [
    ...eventRuns.map((r) => ({ date: dayKey(r.createdAt || r.date), isk: num(r.lootISK) + num(r.bountyISK) })),
    ...eventBounties.map((r) => ({ date: dayKey(r.walletTimestamp || r.timestamp), isk: num(r.tickISK) })),
  ];
  const eventBest = groupBest(eventDays, (r) => r.date, (r) => r.isk);
  const incBest = groupBest(incursionTicks, (r) => String(r.lpLabel || "Unknown").replace(/\s*\((max|scaled)\)\s*$/i, ""), (r) => r.amountISK);
  const crabGroups = new Map();
  for (const r of crabRuns) {
    const key = r.beaconType || r.beacon_type || r.siteType || r.site_type || r.beacon || "Unknown";
    const item = crabGroups.get(key) || { total: 0, count: 0 };
    item.total += num(r.net_profit);
    item.count++;
    crabGroups.set(key, item);
  }
  const crabBest = [...crabGroups].map(([key, value]) => [key, value.total / value.count]).sort((a, b) => b[1] - a[1])[0];
  const officerBest = groupBest(officers, (r) => r.name, (r) => r.lootValue);
  const fobBest = groupBest(fobHistory, (r) => r.date, (r) => r.grossIncome ?? r.income);
  const highlights = [
    highlight("Abyssals", "Best Filament", abyssBest),
    highlight("DED", "Best DED Level", dedBest),
    highlight("Events", "Best Event Day", eventBest),
    highlight("Incursions", "Best Site Type", incBest),
    highlight("CRABs", "Best Beacon Return", crabBest),
    highlight("Officers", "Highest-Value Officer", officerBest),
    highlight("FOBs", "Best Day (Last 12 Months)", fobBest),
  ];
  return { totalsByModule, monthlyRows, highlights };
}

export default function OverallGraphs() {
  const navigate = useNavigate();
  const [data, setData] = useState({
    abyssals: [], glorified: [], dedRuns: [], eventRuns: [], eventBounties: [],
    incursionTicks: [], crabRuns: [], officers: [], fob: null,
  });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(true);
  const refreshAll = useCallback(async () => {
    setLoading(true);
    const failures = [];
    const local = loadLocalData();
    const tasks = [
      ["Abyssals", async () => {
        const [abyssals, glorified] = await Promise.all([window.api.getEntries("abyssals"), window.api.getGlorified()]);
        return { abyssals: Array.isArray(abyssals) ? abyssals : [], glorified: Array.isArray(glorified) ? glorified : [] };
      }],
      ["CRABs", async () => ({ crabRuns: await getAllCrabRuns() })],
      ["Officers", async () => ({ officers: await loadOfficerRecords() })],
      ["FOBs", async () => ({ fob: await loadFobDashboard() })],
    ];
    const results = await Promise.all(tasks.map(async ([name, run]) => {
      try { return await run(); }
      catch (error) { failures.push(`${name}: ${error?.message || "Unable to load"}`); return null; }
    }));
    setData((previous) => {
      const next = { ...previous, ...local };
      for (const result of results) if (result) Object.assign(next, result);
      return next;
    });
    setErrors(failures);
    setLoading(false);
  }, []);
  useEffect(() => {
    refreshAll();
    const onStorage = (event) => {
      if (["ded:runs:v1", "event:runs:v1", "event:bounties:v1", "incursions:ticks:v1"].includes(event.key)) {
        setData((previous) => ({ ...previous, ...loadLocalData() }));
      }
    };
    window.addEventListener("storage", onStorage);
    const off = window.api?.on?.("entries-updated", (payload) => {
      if (payload?.table === "abyssals") refreshAll();
    });
    return () => {
      window.removeEventListener("storage", onStorage);
      if (typeof off === "function") off();
    };
  }, [refreshAll]);
  const graphData = useMemo(() => buildGraphs(data), [data]);
  return (
    <div className="overallGraphsPage">
      <div className="overallGraphsWrap">
        <div className="overallGraphsHeader">
          <h1>Overall Graphs</h1>
          <p>Track how well your different activities are performing!</p>
          <div className="overallGraphsNavRow">
            <button type="button" className="overallGraphsNavBtn overallGraphsNavBtn--secondary" onClick={() => navigate("/overall-analytics")}>← Overall Statistics</button>
            <button type="button" className="overallGraphsNavBtn" onClick={refreshAll} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
          </div>
        </div>
        {errors.length > 0 && <div role="alert" className="overallGraphsCard" style={{ color: "#fca5a5", marginBottom: 18 }}>
          Some tracker data could not be loaded: {errors.join(" | ")}
        </div>}
        <section className="overallGraphsGrid">
          <GraphCard title="Isk earned per Module">
            <VerticalBarChart data={graphData.totalsByModule.map((row) => ({ label: row.label, value: row.profit, color: MODULES.find((module) => module.label === row.label)?.color }))} valueFormatter={fmtCompactISK} emptyLabel="No overall profit data yet." />
          </GraphCard>
          <GraphCard title="Isk per month per Module.">
            <StackedMonthlyChart rows={graphData.monthlyRows} emptyLabel="No monthly overall data yet." />
          </GraphCard>
          <GraphCard title="Runs by Module">
            <VerticalBarChart data={graphData.totalsByModule.map((row) => ({ label: row.label, value: row.count, color: MODULES.find((module) => module.label === row.label)?.color }))} valueFormatter={fmtInt} emptyLabel="No run count data yet." />
          </GraphCard>
        </section>
        <section className="overallGraphsSection">
          <div className="overallGraphsSectionHead">
            <h2>Tracker Highlights</h2>
            <div className="overallGraphsMuted">One useful standout from each module.</div>
          </div>
          <div className="overallGraphsHighlightsGrid">
            {graphData.highlights.map((item) => (
              <div key={item.module} className="overallGraphsHighlightCard">
                <div className="overallGraphsHighlightModule">{item.module}</div>
                <div className="overallGraphsHighlightTitle">{item.title}</div>
                <div className="overallGraphsHighlightValue">{item.value}</div>
                <div className="overallGraphsHighlightMeta">{item.meta}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
function GraphCard({ title, children }) {
  return <section className="overallGraphsCard"><div className="overallGraphsCardHead"><h2>{title}</h2></div>{children}</section>;
}
function VerticalBarChart({ data, valueFormatter, emptyLabel }) {
  if (!data.length) return <div className="overallGraphsEmpty">{emptyLabel}</div>;
  const width = 1200, height = 360, top = 34, left = 96, bottom = 86, right = 28;
  const innerWidth = width - left - right, innerHeight = height - top - bottom;
  const max = Math.max(1, ...data.map((item) => Math.max(0, num(item.value))));
  const step = innerWidth / data.length, barWidth = Math.max(35, Math.min(110, step * 0.46));
  return <div className="overallGraphsSvgShell"><svg viewBox={`0 0 ${width} ${height}`} className="overallGraphsSvg" role="img" aria-label="Income and activity by module">
    <line x1={left} y1={top} x2={left} y2={top + innerHeight} className="overallGraphsAxis" />
    <line x1={left} y1={top + innerHeight} x2={left + innerWidth} y2={top + innerHeight} className="overallGraphsAxis" />
    {Array.from({ length: 5 }, (_, index) => {
      const y = top + innerHeight - index / 4 * innerHeight;
      return <g key={index}><line x1={left} y1={y} x2={left + innerWidth} y2={y} className="overallGraphsGridLine" /><text x={left - 14} y={y + 5} textAnchor="end" className="overallGraphsTickText">{valueFormatter(max * index / 4)}</text></g>;
    })}
    {data.map((item, index) => {
      const value = num(item.value), barHeight = Math.max(0, value) / max * innerHeight;
      const x = left + index * step + (step - barWidth) / 2, y = top + innerHeight - barHeight;
      return <g key={item.label}><title>{`${item.label}: ${valueFormatter(value)}`}</title>
        <rect x={x} y={y} width={barWidth} height={barHeight} rx="10" fill={item.color} />
        <text x={x + barWidth / 2} y={Math.max(y - 10, 20)} textAnchor="middle" className="overallGraphsValueText">{valueFormatter(value)}</text>
        <text x={x + barWidth / 2} y={top + innerHeight + 30} textAnchor="middle" className="overallGraphsLabelText">{item.label}</text>
      </g>;
    })}
  </svg></div>;
}
function StackedMonthlyChart({ rows, emptyLabel }) {
  if (!rows.length) return <div className="overallGraphsEmpty">{emptyLabel}</div>;
  const width = 1200, height = 380, top = 34, left = 96, bottom = 90, right = 28;
  const innerWidth = width - left - right, innerHeight = height - top - bottom;
  const max = Math.max(1, ...rows.map((row) => Math.max(0, row.total)));
  const step = innerWidth / rows.length, barWidth = Math.max(40, Math.min(84, step * 0.5));
  return <><div className="overallGraphsSvgShell"><svg viewBox={`0 0 ${width} ${height}`} className="overallGraphsSvg" role="img" aria-label="Monthly income by module">
    <line x1={left} y1={top} x2={left} y2={top + innerHeight} className="overallGraphsAxis" />
    <line x1={left} y1={top + innerHeight} x2={left + innerWidth} y2={top + innerHeight} className="overallGraphsAxis" />
    {Array.from({ length: 5 }, (_, index) => {
      const y = top + innerHeight - index / 4 * innerHeight;
      return <g key={index}><line x1={left} y1={y} x2={left + innerWidth} y2={y} className="overallGraphsGridLine" /><text x={left - 14} y={y + 5} textAnchor="end" className="overallGraphsTickText">{fmtCompactISK(max * index / 4)}</text></g>;
    })}
    {rows.map((row, index) => {
      const x = left + index * step + (step - barWidth) / 2;
      let accumulated = 0;
      return <g key={row.key}><title>{`${row.label}: ${fmtISK(row.total)}`}</title>
        {MODULES.map((module) => {
          const value = Math.max(0, num(row[module.key]));
          const segmentHeight = value / max * innerHeight;
          const y = top + innerHeight - accumulated - segmentHeight;
          accumulated += segmentHeight;
          return value > 0 ? <rect key={module.key} x={x} y={y} width={barWidth} height={segmentHeight} fill={module.color} /> : null;
        })}
        <text x={x + barWidth / 2} y={Math.max(top + innerHeight - accumulated - 10, 20)} textAnchor="middle" className="overallGraphsValueText">{fmtCompactISK(row.total)}</text>
        <text x={x + barWidth / 2} y={top + innerHeight + 30} textAnchor="middle" className="overallGraphsLabelText">{row.label}</text>
      </g>;
    })}
  </svg></div><div className="overallGraphsLegend">{MODULES.map((module) => <div key={module.key} className="overallGraphsLegendItem"><span className="overallGraphsLegendDot" style={{ background: module.color }} /><span>{module.label}</span></div>)}</div></>;
}