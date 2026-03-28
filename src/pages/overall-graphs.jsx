import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/overall-graphs.css";

import { loadRuns as loadDEDRuns } from "../lib/dedStorer";
import { loadEventRuns } from "../lib/eventRunsStore";
import { loadEventBounties } from "../lib/eventBountiesStore";
import { loadIncursionTicks } from "../lib/parsers/features/Incursions/incursionStore";
import { getAllCrabRuns } from "../lib/crabStore";

const MODULE_COLORS = {
  Abyssals: "#61dafb",
  DED: "#7b8cff",
  Events: "#4fd1c5",
  Incursions: "#ffd089",
  CRABs: "#ffb46b",
};

export default function OverallGraphs() {
  const navigate = useNavigate();

  const [abyssals, setAbyssals] = useState([]);
  const [glorified, setGlorified] = useState([]);
  const [dedRuns, setDedRuns] = useState([]);
  const [eventRuns, setEventRuns] = useState([]);
  const [eventBounties, setEventBounties] = useState([]);
  const [incursionTicks, setIncursionTicks] = useState([]);
  const [crabRuns, setCrabRuns] = useState([]);

  useEffect(() => {
    refreshAll();

    const onStorage = (e) => {
      if (e.key === "ded:runs:v1") setDedRuns(loadDEDRuns());
      if (e.key === "event:runs:v1") setEventRuns(loadEventRuns());
      if (e.key === "event:bounties:v1") setEventBounties(loadEventBounties());
      if (e.key === "incursions:ticks:v1") setIncursionTicks(loadIncursionTicks());
    };

    window.addEventListener("storage", onStorage);

    const off = window.api?.on?.("entries-updated", (payload) => {
      if (payload?.table === "abyssals") refreshAbyssals();
    });

    return () => {
      window.removeEventListener("storage", onStorage);
      if (typeof off === "function") off();
    };
  }, []);

  async function refreshAbyssals() {
    try {
      const [a, g] = await Promise.all([
        window.api.getEntries("abyssals"),
        window.api.getGlorified(),
      ]);
      setAbyssals(Array.isArray(a) ? a : []);
      setGlorified(Array.isArray(g) ? g : []);
    } catch {
      setAbyssals([]);
      setGlorified([]);
    }
  }

  async function refreshCrabs() {
    try {
      const runs = await getAllCrabRuns();
      setCrabRuns(Array.isArray(runs) ? runs : []);
    } catch {
      setCrabRuns([]);
    }
  }

  function refreshAll() {
    refreshAbyssals();
    refreshCrabs();
    setDedRuns(loadDEDRuns());
    setEventRuns(loadEventRuns());
    setEventBounties(loadEventBounties());
    setIncursionTicks(loadIncursionTicks());
  }

  const graphData = useMemo(() => {
    const totalsByModule = buildTotalsByModule({
      abyssals,
      glorified,
      dedRuns,
      eventRuns,
      eventBounties,
      incursionTicks,
      crabRuns,
    });

    const monthlyRows = buildMonthlyRows({
      abyssals,
      glorified,
      dedRuns,
      eventRuns,
      eventBounties,
      incursionTicks,
      crabRuns,
    });

    const highlights = buildHighlights({
      abyssals,
      glorified,
      dedRuns,
      eventRuns,
      eventBounties,
      incursionTicks,
      crabRuns,
    });

    return {
      totalsByModule,
      monthlyRows,
      highlights,
    };
  }, [abyssals, glorified, dedRuns, eventRuns, eventBounties, incursionTicks, crabRuns]);

  return (
    <div className="overallGraphsPage">
      <div className="overallGraphsWrap">
        <div className="overallGraphsHeader">
          <h1>Overall Graphs</h1>
          <p>Track how well your different activities are performing!</p>

          <div className="overallGraphsNavRow">
            <button
              type="button"
              className="overallGraphsNavBtn overallGraphsNavBtn--secondary"
              onClick={() => navigate("/overall-analytics")}
            >
              ← Overall Statistics
            </button>
          </div>
        </div>

        <section className="overallGraphsGrid">
          <GraphCard title="Isk earned per Module">
            <VerticalBarChart
              data={graphData.totalsByModule.map((row) => ({
                label: row.label,
                value: row.profit,
                color: MODULE_COLORS[row.label] || "#61dafb",
              }))}
              emptyLabel="No overall profit data yet."
              valueFormatter={fmtCompactISK}
              labelMaxLength={14}
            />
          </GraphCard>

          <GraphCard title="Isk per month per Module.">
            <StackedMonthlyChart
              rows={graphData.monthlyRows}
              emptyLabel="No monthly overall data yet."
            />
          </GraphCard>

          <GraphCard title="Runs by Module">
            <VerticalBarChart
              data={graphData.totalsByModule.map((row) => ({
                label: row.label,
                value: row.count,
                color: MODULE_COLORS[row.label] || "#61dafb",
              }))}
              emptyLabel="No run count data yet."
              valueFormatter={fmtInt}
              labelMaxLength={14}
            />
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
  return (
    <section className="overallGraphsCard">
      <div className="overallGraphsCardHead">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function VerticalBarChart({ data, valueFormatter, emptyLabel, labelMaxLength = 14 }) {
  if (!data.length) {
    return <div className="overallGraphsEmpty">{emptyLabel}</div>;
  }

  const chartWidth = 1200;
  const chartHeight = 360;
  const padTop = 34;
  const padRight = 28;
  const padBottom = 86;
  const padLeft = 96;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const maxValue = Math.max(...data.map((item) => Number(item.value) || 0), 1);
  const ticks = 4;
  const stepX = innerWidth / data.length;
  const barWidth = Math.max(50, Math.min(110, stepX * 0.46));

  return (
    <div className="overallGraphsSvgShell">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overallGraphsSvg" role="img">
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + innerHeight}
          className="overallGraphsAxis"
        />
        <line
          x1={padLeft}
          y1={padTop + innerHeight}
          x2={padLeft + innerWidth}
          y2={padTop + innerHeight}
          className="overallGraphsAxis"
        />

        {Array.from({ length: ticks + 1 }).map((_, index) => {
          const ratio = index / ticks;
          const y = padTop + innerHeight - ratio * innerHeight;
          const tickValue = maxValue * ratio;

          return (
            <g key={index}>
              <line
                x1={padLeft}
                y1={y}
                x2={padLeft + innerWidth}
                y2={y}
                className="overallGraphsGridLine"
              />
              <text
                x={padLeft - 14}
                y={y + 5}
                textAnchor="end"
                className="overallGraphsTickText"
              >
                {valueFormatter(tickValue)}
              </text>
            </g>
          );
        })}

        {data.map((item, index) => {
          const value = Number(item.value) || 0;
          const barHeight = (value / maxValue) * innerHeight;
          const safeBarHeight = value > 0 ? Math.max(barHeight, 8) : 0;
          const x = padLeft + stepX * index + (stepX - barWidth) / 2;
          const y = padTop + innerHeight - safeBarHeight;
          const centerX = x + barWidth / 2;

          return (
            <g key={`${item.label}_${index}`}>
              <title>{`${item.label}: ${valueFormatter(value)}`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={safeBarHeight}
                rx="12"
                fill={item.color || "#61dafb"}
              />
              <text
                x={centerX}
                y={Math.max(y - 10, 20)}
                textAnchor="middle"
                className="overallGraphsValueText"
              >
                {valueFormatter(value)}
              </text>
              <text
                x={centerX}
                y={padTop + innerHeight + 30}
                textAnchor="middle"
                className="overallGraphsLabelText"
              >
                {truncateLabel(item.label, labelMaxLength)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function StackedMonthlyChart({ rows, emptyLabel }) {
  if (!rows.length) {
    return <div className="overallGraphsEmpty">{emptyLabel}</div>;
  }

  const chartWidth = 1200;
  const chartHeight = 380;
  const padTop = 34;
  const padRight = 28;
  const padBottom = 90;
  const padLeft = 96;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const maxValue = Math.max(...rows.map((row) => row.total), 1);
  const ticks = 4;
  const stepX = innerWidth / rows.length;
  const barWidth = Math.max(46, Math.min(84, stepX * 0.5));

  return (
    <div className="overallGraphsSvgShell">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="overallGraphsSvg" role="img">
        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + innerHeight}
          className="overallGraphsAxis"
        />
        <line
          x1={padLeft}
          y1={padTop + innerHeight}
          x2={padLeft + innerWidth}
          y2={padTop + innerHeight}
          className="overallGraphsAxis"
        />

        {Array.from({ length: ticks + 1 }).map((_, index) => {
          const ratio = index / ticks;
          const y = padTop + innerHeight - ratio * innerHeight;
          const tickValue = maxValue * ratio;

          return (
            <g key={index}>
              <line
                x1={padLeft}
                y1={y}
                x2={padLeft + innerWidth}
                y2={y}
                className="overallGraphsGridLine"
              />
              <text
                x={padLeft - 14}
                y={y + 5}
                textAnchor="end"
                className="overallGraphsTickText"
              >
                {fmtCompactISK(tickValue)}
              </text>
            </g>
          );
        })}

        {rows.map((row, index) => {
          const x = padLeft + stepX * index + (stepX - barWidth) / 2;
          const centerX = x + barWidth / 2;
          let runningHeight = 0;

          const segments = [
            { key: "abyss", color: MODULE_COLORS.Abyssals, value: row.abyss },
            { key: "ded", color: MODULE_COLORS.DED, value: row.ded },
            { key: "events", color: MODULE_COLORS.Events, value: row.events },
            { key: "incursions", color: MODULE_COLORS.Incursions, value: row.incursions },
            { key: "crabs", color: MODULE_COLORS.CRABs, value: row.crabs },
          ];

          return (
            <g key={row.label}>
              <title>{`${row.label}: ${fmtCompactISK(row.total)}`}</title>

              {segments.map((segment) => {
                const value = Number(segment.value) || 0;
                if (value <= 0) return null;

                const segmentHeight = (value / maxValue) * innerHeight;
                const y = padTop + innerHeight - runningHeight - segmentHeight;
                runningHeight += segmentHeight;

                return (
                  <rect
                    key={`${row.label}_${segment.key}`}
                    x={x}
                    y={y}
                    width={barWidth}
                    height={Math.max(segmentHeight, 6)}
                    fill={segment.color}
                  />
                );
              })}

              <text
                x={centerX}
                y={Math.max(padTop + innerHeight - runningHeight - 10, 20)}
                textAnchor="middle"
                className="overallGraphsValueText"
              >
                {fmtCompactISK(row.total)}
              </text>
              <text
                x={centerX}
                y={padTop + innerHeight + 30}
                textAnchor="middle"
                className="overallGraphsLabelText"
              >
                {row.label}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="overallGraphsLegend">
        {Object.entries(MODULE_COLORS).map(([label, color]) => (
          <div key={label} className="overallGraphsLegendItem">
            <span className="overallGraphsLegendDot" style={{ background: color }} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildTotalsByModule({
  abyssals,
  glorified,
  dedRuns,
  eventRuns,
  eventBounties,
  incursionTicks,
  crabRuns,
}) {
  const abyss = computeAbyssTotals(abyssals, glorified);
  const ded = computeDEDTotals(dedRuns);
  const events = computeEventTotals(eventRuns, eventBounties);
  const incursions = computeIncursionTotals(incursionTicks);
  const crabs = computeCrabTotals(crabRuns);

  return [
    { label: "Abyssals", profit: abyss.totalISK, count: abyss.runs },
    { label: "DED", profit: ded.totalISK, count: ded.runs },
    { label: "Events", profit: events.totalISK, count: events.runs },
    { label: "Incursions", profit: incursions.totalISK, count: incursions.ticks },
    { label: "CRABs", profit: crabs.totalISK, count: crabs.runs },
  ];
}

function buildMonthlyRows({
  abyssals,
  glorified,
  dedRuns,
  eventRuns,
  eventBounties,
  incursionTicks,
  crabRuns,
}) {
  const months = buildLast12Months();

  for (const entry of abyssals || []) {
    addToMonth(
      months,
      getMonthKey(entry?.date || entry?.createdAt),
      "abyss",
      getAbyssEntryProfit(entry)
    );
  }

  for (const drop of glorified || []) {
    addToMonth(
      months,
      getMonthKey(drop?.date || drop?.createdAt),
      "abyss",
      num(drop?.isk_earned || drop?.value_isk || drop?.value || drop?.isk)
    );
  }

  for (const run of dedRuns || []) {
    addToMonth(months, getMonthKey(run?.createdAt || run?.date), "ded", num(run?.iskTotal));
  }

  for (const run of eventRuns || []) {
    addToMonth(
      months,
      getMonthKey(run?.createdAt || run?.date),
      "events",
      num(run?.lootISK) + num(run?.bountyISK)
    );
  }

  for (const tick of eventBounties || []) {
    addToMonth(
      months,
      getMonthKey(tick?.timestamp || tick?.createdAt || tick?.date),
      "events",
      num(tick?.tickISK)
    );
  }

  for (const tick of incursionTicks || []) {
    addToMonth(
      months,
      getMonthKeyFromWalletTimestamp(tick?.timestamp) || getMonthKey(tick?.timestamp),
      "incursions",
      num(tick?.amountISK)
    );
  }

  for (const run of crabRuns || []) {
    addToMonth(
      months,
      getMonthKey(run?.created_at || run?.createdAt || run?.date),
      "crabs",
      num(run?.net_profit)
    );
  }

  return Array.from(months.values()).map((row) => ({
    ...row,
    total: row.abyss + row.ded + row.events + row.incursions + row.crabs,
  }));
}

function buildHighlights({
  abyssals,
  glorified,
  dedRuns,
  eventRuns,
  eventBounties,
  incursionTicks,
  crabRuns,
}) {
  return [
    buildAbyssHighlight(abyssals, glorified),
    buildDEDHighlight(dedRuns),
    buildEventHighlight(eventRuns, eventBounties),
    buildIncursionHighlight(incursionTicks),
    buildCrabHighlight(crabRuns),
  ];
}

function buildAbyssHighlight(entries, glorified) {
  const byFilament = new Map();

  for (const entry of entries || []) {
    const key = `${entry?.tier || ""} ${entry?.storm_type || ""}`.trim() || "Unknown";
    const profit = getAbyssEntryProfit(entry);
    byFilament.set(key, (byFilament.get(key) || 0) + profit);
  }

  const best = Array.from(byFilament.entries()).sort((a, b) => b[1] - a[1])[0];
  const glorifiedISK = (glorified || []).reduce(
    (sum, drop) => sum + num(drop?.isk_earned || drop?.value_isk || drop?.value || drop?.isk),
    0
  );

  if (!best) {
    return {
      module: "Abyssals",
      title: "Best Filament",
      value: "No data",
      meta: glorifiedISK > 0 ? `Glorified: ${fmtISK(glorifiedISK)}` : "No runs yet",
    };
  }

  return {
    module: "Abyssals",
    title: "Best Filament",
    value: best[0],
    meta: fmtISK(best[1]),
  };
}

function buildDEDHighlight(runs) {
  const byLevel = new Map();

  for (const run of runs || []) {
    const key = run?.dedLevel || "Unknown";
    byLevel.set(key, (byLevel.get(key) || 0) + num(run?.iskTotal));
  }

  const best = Array.from(byLevel.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    module: "DED",
    title: "Best DED Level",
    value: best ? best[0] : "No data",
    meta: best ? fmtISK(best[1]) : "No runs yet",
  };
}

function buildEventHighlight(eventRuns, eventBounties) {
  const dayMap = new Map();

  for (const run of eventRuns || []) {
    const key = getDayKey(run?.createdAt || run?.date);
    dayMap.set(key, (dayMap.get(key) || 0) + num(run?.lootISK) + num(run?.bountyISK));
  }

  for (const tick of eventBounties || []) {
    const key = getDayKeyFromWalletTimestamp(tick?.timestamp) || getDayKey(tick?.timestamp);
    dayMap.set(key, (dayMap.get(key) || 0) + num(tick?.tickISK));
  }

  const best = Array.from(dayMap.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    module: "Events",
    title: "Best Event Day",
    value: best ? best[0] : "No data",
    meta: best ? fmtISK(best[1]) : "No event data yet",
  };
}

function buildIncursionHighlight(ticks) {
  const bySite = new Map();

  for (const tick of ticks || []) {
    const label = normalizeSiteLabel(tick?.lpLabel);
    bySite.set(label, (bySite.get(label) || 0) + num(tick?.amountISK));
  }

  const best = Array.from(bySite.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    module: "Incursions",
    title: "Best Site Type",
    value: best ? best[0] : "No data",
    meta: best ? fmtISK(best[1]) : "No ticks yet",
  };
}

function buildCrabHighlight(runs) {
  const byBeacon = new Map();

  for (const run of runs || []) {
    const key = getCrabBeaconType(run);
    let row = byBeacon.get(key);
    if (!row) {
      row = { total: 0, runs: 0 };
      byBeacon.set(key, row);
    }
    row.total += num(run?.net_profit);
    row.runs += 1;
  }

  const best = Array.from(byBeacon.entries())
    .map(([key, row]) => ({
      key,
      avg: row.runs ? row.total / row.runs : 0,
    }))
    .sort((a, b) => b.avg - a.avg)[0];

  return {
    module: "CRABs",
    title: "Best Beacon Return",
    value: best ? best.key : "No data",
    meta: best ? fmtISK(best.avg) : "No runs yet",
  };
}

function buildLast12Months() {
  const map = new Map();
  const now = new Date();

  for (let offset = 11; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-GB", { month: "short", year: "2-digit" });

    map.set(key, {
      key,
      label,
      abyss: 0,
      ded: 0,
      events: 0,
      incursions: 0,
      crabs: 0,
    });
  }

  return map;
}

function addToMonth(months, key, field, value) {
  if (!key || !months.has(key)) return;
  const row = months.get(key);
  row[field] += num(value);
}

function getAbyssEntryProfit(entry) {
  const shipType = String(entry?.ship_type || "").toLowerCase();
  const multiplier =
    shipType === "frigate" ? 3 : shipType === "destroyer" ? 2 : 1;

  return (
    num(entry?.room1_isk) +
    num(entry?.room2_isk) +
    num(entry?.room3_isk) -
    num(entry?.fillament_cost) * multiplier
  );
}

function computeAbyssTotals(entries, glorified) {
  const runs = Array.isArray(entries) ? entries.length : 0;

  const baseISK = (entries || []).reduce((sum, entry) => sum + getAbyssEntryProfit(entry), 0);
  const glorifiedISK = (glorified || []).reduce(
    (sum, drop) => sum + num(drop?.isk_earned || drop?.value_isk || drop?.value || drop?.isk),
    0
  );

  return {
    runs,
    totalISK: baseISK + glorifiedISK,
  };
}

function computeDEDTotals(runs) {
  return {
    runs: (runs || []).length,
    totalISK: (runs || []).reduce((sum, run) => sum + num(run?.iskTotal), 0),
  };
}

function computeEventTotals(runs, bounties) {
  const totalRunISK = (runs || []).reduce(
    (sum, run) => sum + num(run?.lootISK) + num(run?.bountyISK),
    0
  );

  const totalTickISK = (bounties || []).reduce(
    (sum, tick) => sum + num(tick?.tickISK),
    0
  );

  return {
    runs: (runs || []).length,
    totalISK: totalRunISK + totalTickISK,
  };
}

function computeIncursionTotals(ticks) {
  return {
    ticks: (ticks || []).length,
    totalISK: (ticks || []).reduce((sum, tick) => sum + num(tick?.amountISK), 0),
  };
}

function computeCrabTotals(runs) {
  return {
    runs: (runs || []).length,
    totalISK: (runs || []).reduce((sum, run) => sum + num(run?.net_profit), 0),
  };
}

function getCrabBeaconType(run) {
  return (
    run?.beaconType ||
    run?.beacon_type ||
    run?.siteType ||
    run?.site_type ||
    run?.beacon ||
    "Unknown"
  );
}

function normalizeSiteLabel(label) {
  const value = String(label || "").trim();
  if (!value) return "Unknown";
  return value.replace(/\s*\((max|scaled)\)\s*$/i, "").trim();
}

function getMonthKey(raw) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getDayKey(raw) {
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function getMonthKeyFromWalletTimestamp(ts) {
  const ms = parseWalletTs(ts);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getDayKeyFromWalletTimestamp(ts) {
  const ms = parseWalletTs(ts);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function parseWalletTs(ts) {
  const s = String(ts || "").trim();
  if (!s) return NaN;
  const isoLike = s.replace(/\./g, "-").replace(" ", "T") + ":00";
  const ms = new Date(isoLike).getTime();
  return Number.isFinite(ms) ? ms : NaN;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function truncateLabel(value, maxLength) {
  if (!value) return "—";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function fmtISK(v) {
  try {
    return `${new Intl.NumberFormat().format(Math.round(v))} ISK`;
  } catch {
    return `${Math.round(v)} ISK`;
  }
}

function fmtCompactISK(v) {
  const n = Number(v) || 0;
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(n >= 10_000_000_000 ? 0 : 1)}b`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`;
  return `${Math.round(n)}`;
}

function fmtInt(v) {
  try {
    return new Intl.NumberFormat().format(Math.round(v));
  } catch {
    return String(Math.round(v));
  }
}