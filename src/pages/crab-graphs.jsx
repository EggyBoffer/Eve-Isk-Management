import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/crab-graphs.css";
import { getAllCrabRuns } from "../lib/crabStore";

const PIE_COLORS = [
  "#ffb46b",
  "#ffd089",
  "#ff8a5b",
  "#61dafb",
  "#7b8cff",
  "#b794f4",
];

export default function CrabGraphs() {
  const [runs, setRuns] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadRuns();
  }, []);

  async function loadRuns() {
    try {
      const allRuns = await getAllCrabRuns();
      setRuns(Array.isArray(allRuns) ? allRuns : []);
    } catch {
      setRuns([]);
    }
  }

  const graphStats = useMemo(() => computeCrabGraphStats(runs), [runs]);
  const dropChanceCharts = useMemo(() => computeCrabDropChanceCharts(runs), [runs]);

  return (
    <div className="crabGraphsPage">
      <div className="crabGraphsWrap">
        <div className="crabGraphsHeader">
          <h1>CRAB Graphs</h1>
          <p>Montior Isk/hour and loot drop trends!</p>

          <div className="crabGraphsTopRow">
            <div className="crabGraphsNavGroup">
              <button
                type="button"
                className="crabGraphsNavBtn crabGraphsNavBtn--secondary"
                onClick={() => navigate("/crabs")}
              >
                ← Tracker
              </button>
              <button
                type="button"
                className="crabGraphsNavBtn"
                onClick={() => navigate("/crabs/analytics")}
              >
                Analytics →
              </button>
            </div>
          </div>
        </div>

        <section className="crabGraphsMetrics">
          <Metric title="Runs" value={fmtInt(graphStats.totalRuns)} />
          <Metric title="Net Profit" value={fmtISK(graphStats.totalNetProfit)} />
          <Metric title="Avg Profit / Run" value={fmtISK(graphStats.avgNetProfit)} />
          <Metric title="ISK / Hour" value={fmtISK(graphStats.iskPerHour)} />
        </section>

        <section className="crabGraphsGrid">
          <GraphCard title="ISK earned per Beacon">
            <VerticalBarChart
              data={graphStats.netProfitByBeacon}
              emptyLabel="No beacon profit data yet."
              valueFormatter={fmtCompactISK}
              labelMaxLength={18}
            />
          </GraphCard>

          <GraphCard title="Average Return per Beacon">
            <VerticalBarChart
              data={graphStats.avgReturnByBeacon}
              emptyLabel="No average return data yet."
              valueFormatter={fmtCompactISK}
              labelMaxLength={18}
            />
          </GraphCard>

          <GraphCard title="ISK per Month">
            <VerticalBarChart
              data={graphStats.iskByMonth}
              emptyLabel="No monthly CRAB data yet."
              valueFormatter={fmtCompactISK}
              labelMaxLength={10}
            />
          </GraphCard>
        </section>

        <section className="crabGraphsSection">
          <div className="crabGraphsSectionHead">
            <h2>Item Drop Chance per Beacon</h2>
          </div>

          {dropChanceCharts.length === 0 ? (
            <div className="crabGraphsEmpty">No drop chance data yet.</div>
          ) : (
            <div className="crabGraphsPieGrid">
              {dropChanceCharts.map((section) => (
                <div key={section.beaconType} className="crabGraphsPieCard">
                  <div className="crabGraphsPieHead">
                    <h3>{section.beaconType}</h3>
                    <div className="crabGraphsPieMeta">
                      {fmtInt(section.totalRuns)} run{section.totalRuns === 1 ? "" : "s"}
                    </div>
                  </div>

                  <PieChartCard
                    slices={section.slices}
                    emptyLabel="Cannot display chart as there is no data.  Maybe you should get to krabbing?"
                  />

                  {section.legend.length > 0 && (
                    <div className="crabGraphsDropSummary">
                      {section.legend.map((item) => (
                        <div
                          key={`${section.beaconType}_${item.name}`}
                          className="crabGraphsDropSummaryRow"
                        >
                          <div className="crabGraphsDropSummaryLeft">
                            <span
                              className="crabGraphsDropSummaryDot"
                              style={{ background: item.color }}
                            />
                            <span className="crabGraphsDropSummaryName">{item.name}</span>
                          </div>
                          <span className="crabGraphsDropSummaryValue">
                            {fmtPct(item.dropRate)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ title, value }) {
  return (
    <div className="crabGraphsMetric">
      <div className="crabGraphsMetricLabel">{title}</div>
      <div className="crabGraphsMetricValue">{value}</div>
    </div>
  );
}

function GraphCard({ title, children }) {
  return (
    <section className="crabGraphsCard">
      <div className="crabGraphsCardHead">
        <h2>{title}</h2>
      </div>
      {children}
    </section>
  );
}

function VerticalBarChart({ data, valueFormatter, emptyLabel, labelMaxLength = 14 }) {
  if (!data.length) {
    return <div className="crabGraphsEmpty">{emptyLabel}</div>;
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
  const barWidth = Math.max(42, Math.min(96, stepX * 0.42));

  return (
    <div className="crabGraphsSvgShell">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="crabGraphsSvg" role="img">
        <defs>
          <linearGradient id="crabGraphsBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffb46b" />
            <stop offset="100%" stopColor="#ff8a5b" />
          </linearGradient>
        </defs>

        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + innerHeight}
          className="crabGraphsAxis"
        />
        <line
          x1={padLeft}
          y1={padTop + innerHeight}
          x2={padLeft + innerWidth}
          y2={padTop + innerHeight}
          className="crabGraphsAxis"
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
                className="crabGraphsGridLine"
              />
              <text
                x={padLeft - 14}
                y={y + 5}
                textAnchor="end"
                className="crabGraphsTickText"
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
                fill="url(#crabGraphsBarGradient)"
              />
              <text
                x={centerX}
                y={Math.max(y - 10, 20)}
                textAnchor="middle"
                className="crabGraphsValueText"
              >
                {valueFormatter(value)}
              </text>
              <text
                x={centerX}
                y={padTop + innerHeight + 30}
                textAnchor="middle"
                className="crabGraphsLabelText"
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

function PieChartCard({ slices, emptyLabel }) {
  if (!slices.length) {
    return <div className="crabGraphsEmpty">{emptyLabel}</div>;
  }

  const size = 420;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 118;

  let startAngle = -Math.PI / 2;

  const paths = slices.map((slice) => {
    const angle = slice.share * Math.PI * 2;
    const endAngle = startAngle + angle;
    const path = describeArcSlice(cx, cy, radius, startAngle, endAngle);
    const result = { ...slice, path };
    startAngle = endAngle;
    return result;
  });

  return (
    <div className="crabGraphsPieShell">
      <svg viewBox={`0 0 ${size} ${size}`} className="crabGraphsPieSvg" role="img">
        {paths.map((slice) => (
          <path key={slice.name} d={slice.path} fill={slice.color} className="crabGraphsPieSlice">
            <title>{`${slice.name}: ${fmtPct(slice.dropRate)} (${slice.runHits} run hits)`}</title>
          </path>
        ))}

        <circle cx={cx} cy={cy} r="46" className="crabGraphsPieInner" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="crabGraphsPieCenterTop">
          {fmtInt(slices.length)}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" className="crabGraphsPieCenterBottom">
          drops
        </text>
      </svg>
    </div>
  );
}

function computeCrabGraphStats(runs) {
  const totalRuns = runs.length;
  const totalNetProfit = runs.reduce((sum, run) => sum + getNetProfit(run), 0);
  const totalHours = runs.reduce((sum, run) => sum + getHours(run), 0);
  const avgNetProfit = totalRuns ? totalNetProfit / totalRuns : 0;
  const iskPerHour = totalHours ? totalNetProfit / totalHours : 0;

  const beaconMap = new Map();
  const monthMap = new Map();

  for (const run of runs) {
    const beaconType = getBeaconType(run);
    const netProfit = getNetProfit(run);
    const hours = getHours(run);
    const month = getMonthKey(run);

    let beaconRow = beaconMap.get(beaconType);
    if (!beaconRow) {
      beaconRow = {
        beaconType,
        runs: 0,
        netProfit: 0,
        totalHours: 0,
      };
      beaconMap.set(beaconType, beaconRow);
    }

    beaconRow.runs += 1;
    beaconRow.netProfit += netProfit;
    beaconRow.totalHours += hours;

    let monthRow = monthMap.get(month);
    if (!monthRow) {
      monthRow = {
        month,
        runs: 0,
        netProfit: 0,
      };
      monthMap.set(month, monthRow);
    }

    monthRow.runs += 1;
    monthRow.netProfit += netProfit;
  }

  const byBeacon = Array.from(beaconMap.values()).sort((a, b) =>
    String(a.beaconType).localeCompare(String(b.beaconType))
  );

  const byMonth = Array.from(monthMap.values()).sort((a, b) =>
    String(a.month).localeCompare(String(b.month))
  );

  return {
    totalRuns,
    totalNetProfit,
    avgNetProfit,
    iskPerHour,
    netProfitByBeacon: byBeacon.map((row) => ({
      label: row.beaconType,
      value: row.netProfit,
    })),
    avgReturnByBeacon: byBeacon.map((row) => ({
      label: row.beaconType,
      value: row.runs ? row.netProfit / row.runs : 0,
    })),
    iskByMonth: byMonth.map((row) => ({
      label: row.month,
      value: row.netProfit,
    })),
  };
}

function computeCrabDropChanceCharts(runs) {
  const beaconMap = new Map();

  for (const run of runs) {
    const beaconType = getBeaconType(run);

    let section = beaconMap.get(beaconType);
    if (!section) {
      section = {
        beaconType,
        totalRuns: 0,
        items: new Map(),
      };
      beaconMap.set(beaconType, section);
    }

    section.totalRuns += 1;

    const presentInRun = new Set();
    for (const item of getRunItems(run)) {
      const key = getItemName(item);
      if (!key) continue;

      let row = section.items.get(key);
      if (!row) {
        row = {
          name: key,
          runHits: 0,
        };
        section.items.set(key, row);
      }

      presentInRun.add(key);
    }

    for (const key of presentInRun) {
      const row = section.items.get(key);
      if (row) row.runHits += 1;
    }
  }

  return Array.from(beaconMap.values())
    .sort((a, b) => String(a.beaconType).localeCompare(String(b.beaconType)))
    .map((section) => {
      const items = Array.from(section.items.values())
        .map((item) => ({
          ...item,
          dropRate: section.totalRuns ? item.runHits / section.totalRuns : 0,
        }))
        .filter((item) => item.runHits > 0)
        .sort((a, b) => {
          if (b.dropRate !== a.dropRate) return b.dropRate - a.dropRate;
          return a.name.localeCompare(b.name);
        });

      const topItems = items.slice(0, 6);
      const totalHits = topItems.reduce((sum, item) => sum + item.runHits, 0);

      const slices = topItems.map((item, index) => ({
        name: item.name,
        runHits: item.runHits,
        dropRate: item.dropRate,
        share: totalHits ? item.runHits / totalHits : 0,
        color: PIE_COLORS[index % PIE_COLORS.length],
      }));

      const legend = topItems.map((item, index) => ({
        ...item,
        color: PIE_COLORS[index % PIE_COLORS.length],
      }));

      return {
        beaconType: section.beaconType,
        totalRuns: section.totalRuns,
        slices,
        legend,
      };
    });
}

function getBeaconType(run) {
  return (
    run?.beaconType ||
    run?.beacon_type ||
    run?.siteType ||
    run?.site_type ||
    run?.beacon ||
    "Unknown"
  );
}

function getNetProfit(run) {
  const value =
    run?.netProfit ??
    run?.net_profit ??
    run?.profit ??
    run?.iskNet ??
    0;

  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getHours(run) {
  const directHours =
    run?.hours ??
    run?.totalHours ??
    run?.durationHours ??
    null;

  const hourValue = Number(directHours);
  if (Number.isFinite(hourValue) && hourValue > 0) return hourValue;

  const minuteValue = Number(
    run?.minutes ??
      run?.durationMinutes ??
      run?.timeMinutes ??
      run?.clearTimeMinutes ??
      0
  );

  if (Number.isFinite(minuteValue) && minuteValue > 0) return minuteValue / 60;

  return 0;
}

function getMonthKey(run) {
  const raw =
    run?.createdAt ||
    run?.date ||
    run?.runDate ||
    run?.timestamp ||
    run?.created_at;

  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "Unknown";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function getRunItems(run) {
  if (Array.isArray(run?.items)) return run.items;
  if (Array.isArray(run?.loot)) return run.loot;
  if (Array.isArray(run?.lootItems)) return run.lootItems;
  if (Array.isArray(run?.lootRows)) return run.lootRows;
  if (Array.isArray(run?.drops)) return run.drops;
  return [];
}

function getItemName(item) {
  return (
    item?.itemName ||
    item?.name ||
    item?.typeName ||
    item?.type_name ||
    null
  );
}

function describeArcSlice(cx, cy, radius, startAngle, endAngle) {
  const start = polarToCartesian(cx, cy, radius, endAngle);
  const end = polarToCartesian(cx, cy, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= Math.PI ? 0 : 1;

  return [
    `M ${cx} ${cy}`,
    `L ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`,
    "Z",
  ].join(" ");
}

function polarToCartesian(cx, cy, radius, angleInRadians) {
  return {
    x: cx + radius * Math.cos(angleInRadians),
    y: cy + radius * Math.sin(angleInRadians),
  };
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

function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
}