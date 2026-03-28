import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ded-graphs.css";
import { loadRuns } from "../lib/dedStorer";

const PIE_COLORS = [
  "#61dafb",
  "#7b8cff",
  "#4fd1c5",
  "#f6ad55",
  "#fc8181",
  "#b794f4",
];

export default function DEDGraphs() {
  const [runs, setRuns] = useState([]);
  const [dedFilter, setDedFilter] = useState("All");
  const navigate = useNavigate();

  useEffect(() => {
    setRuns(loadRuns());
    const onStorage = (e) => {
      if (e.key === "ded:runs:v1") setRuns(loadRuns());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const availableLevels = useMemo(() => {
    const set = new Set();
    for (const run of runs) {
      if (run.dedLevel) set.add(run.dedLevel);
    }
    return Array.from(set).sort(compareDedLevels);
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (dedFilter === "All") return runs;
    return runs.filter((run) => run.dedLevel === dedFilter);
  }, [runs, dedFilter]);

  const graphStats = useMemo(() => computeGraphStats(filteredRuns), [filteredRuns]);

  const dropChanceCharts = useMemo(() => {
    return computeDropChanceCharts(runs, dedFilter);
  }, [runs, dedFilter]);

  return (
    <div className="dedGraphs-page">
      <div className="dedGraphs-wrap">
        <div className="dedGraphs-header">
          <h1>DED Graphs</h1>
          <p>Visual breakdowns for earnings, efficiency, run volume, and observed drop rates.</p>

          <div className="dedGraphs-topRow">
            <div className="dedGraphs-filterGroup">
              <div className="dedGraphs-filterLabel">Filter by DED</div>
              <select
                value={dedFilter}
                onChange={(e) => setDedFilter(e.target.value)}
                className="dedGraphs-select"
              >
                <option value="All">All levels</option>
                {availableLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div className="dedGraphs-navGroup">
              <button
                type="button"
                className="dedGraphs-navBtn dedGraphs-navBtn--secondary"
                onClick={() => navigate("/ded-tracking")}
              >
                ← Tracker
              </button>
              <button
                type="button"
                className="dedGraphs-navBtn"
                onClick={() => navigate("/ded-analytics")}
              >
                Analytics →
              </button>
            </div>
          </div>
        </div>

        <section className="dedGraphs-metrics">
          <Metric title="Runs in Scope" value={fmtInt(graphStats.totalRuns)} />
          <Metric title="Total ISK" value={fmtISK(graphStats.totalISK)} />
          <Metric title="Avg ISK / Run" value={fmtISK(graphStats.avgISKPerRun)} />
          <Metric title="ISK / Hour" value={fmtISK(graphStats.iskPerHour)} />
        </section>

        <section className="dedGraphs-grid">
          <GraphCard title="Total ISK by DED Level">
            <VerticalBarChart
              data={graphStats.totalIskByLevel}
              emptyLabel="No DED value data yet."
              valueFormatter={fmtCompactISK}
            />
          </GraphCard>

          <GraphCard title="Runs by DED Level">
            <VerticalBarChart
              data={graphStats.runsByLevel}
              emptyLabel="No run volume data yet."
              valueFormatter={fmtInt}
            />
          </GraphCard>

          <GraphCard title="ISK / Hour by DED Level">
            <VerticalBarChart
              data={graphStats.iskPerHourByLevel}
              emptyLabel="No efficiency data yet."
              valueFormatter={fmtCompactISK}
            />
          </GraphCard>
        </section>

        <section className="dedGraphs-section">
          <div className="dedGraphs-sectionHead">
            <h2>Drop Chances</h2>
          </div>

          {dropChanceCharts.length === 0 ? (
            <div className="dedGraphs-empty">No drop chance data yet.</div>
          ) : (
            <div className="dedGraphs-pieGrid">
              {dropChanceCharts.map((section) => (
                <div key={section.level} className="dedGraphs-pieCard">
                  <div className="dedGraphs-pieHead">
                    <h3>{section.level}</h3>
                    <div className="dedGraphs-pieMeta">
                      {fmtInt(section.totalRuns)} run{section.totalRuns === 1 ? "" : "s"}
                    </div>
                  </div>

                  <PieChartCard
                    slices={section.slices}
                    emptyLabel="Not enough drop data for a pie chart yet."
                  />

                  {section.legend.length > 0 && (
                    <div className="dedGraphs-dropSummary">
                      {section.legend.map((item) => (
                        <div key={`${section.level}_${item.name}`} className="dedGraphs-dropSummaryRow">
                          <div className="dedGraphs-dropSummaryLeft">
                            <span
                              className="dedGraphs-dropSummaryDot"
                              style={{ background: item.color }}
                            />
                            <span className="dedGraphs-dropSummaryName">{item.name}</span>
                          </div>
                          <span className="dedGraphs-dropSummaryValue">{fmtPct(item.dropRate)}</span>
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
    <div className="dedGraphs-metric">
      <div className="dedGraphs-metricLabel">{title}</div>
      <div className="dedGraphs-metricValue">{value}</div>
    </div>
  );
}

function GraphCard({ title, subtitle, children }) {
  return (
    <section className="dedGraphs-card">
      <div className="dedGraphs-cardHead">
        <h2>{title}</h2>
        <div className="dedGraphs-muted">{subtitle}</div>
      </div>
      {children}
    </section>
  );
}

function VerticalBarChart({ data, valueFormatter, emptyLabel }) {
  if (!data.length) {
    return <div className="dedGraphs-empty">{emptyLabel}</div>;
  }

  const chartWidth = 1200;
  const chartHeight = 360;
  const padTop = 34;
  const padRight = 28;
  const padBottom = 78;
  const padLeft = 96;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const ticks = 4;
  const stepX = innerWidth / data.length;
  const barWidth = Math.max(48, Math.min(120, stepX * 0.42));

  return (
    <div className="dedGraphs-svgShell">
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="dedGraphs-svg" role="img">
        <defs>
          <linearGradient id="dedGraphsBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#61dafb" />
            <stop offset="100%" stopColor="#7b8cff" />
          </linearGradient>
        </defs>

        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + innerHeight}
          className="dedGraphs-axis"
        />
        <line
          x1={padLeft}
          y1={padTop + innerHeight}
          x2={padLeft + innerWidth}
          y2={padTop + innerHeight}
          className="dedGraphs-axis"
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
                className="dedGraphs-gridLine"
              />
              <text
                x={padLeft - 14}
                y={y + 5}
                textAnchor="end"
                className="dedGraphs-tickText"
              >
                {valueFormatter(tickValue)}
              </text>
            </g>
          );
        })}

        {data.map((item, index) => {
          const value = Number(item.value) || 0;
          const ratio = value / maxValue;
          const barHeight = Math.max(value > 0 ? 8 : 0, ratio * innerHeight);
          const x = padLeft + stepX * index + (stepX - barWidth) / 2;
          const y = padTop + innerHeight - barHeight;

          return (
            <g key={`${item.label}_${index}`}>
              <title>{`${item.label}: ${valueFormatter(value)}`}</title>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                rx="12"
                ry="12"
                fill="url(#dedGraphsBarGradient)"
              />
              <text
                x={x + barWidth / 2}
                y={Math.max(y - 10, 20)}
                textAnchor="middle"
                className="dedGraphs-valueText"
              >
                {valueFormatter(value)}
              </text>
              <text
                x={x + barWidth / 2}
                y={padTop + innerHeight + 28}
                textAnchor="middle"
                className="dedGraphs-labelText"
              >
                {item.label}
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
    return <div className="dedGraphs-empty">{emptyLabel}</div>;
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
    const result = {
      ...slice,
      path,
    };
    startAngle = endAngle;
    return result;
  });

  return (
    <div className="dedGraphs-pieShell">
      <svg viewBox={`0 0 ${size} ${size}`} className="dedGraphs-pieSvg" role="img">
        {paths.map((slice) => (
          <path key={slice.name} d={slice.path} fill={slice.color} className="dedGraphs-pieSlice">
            <title>{`${slice.name}: ${fmtPct(slice.dropRate)} (${slice.runHits} run hits)`}</title>
          </path>
        ))}

        <circle cx={cx} cy={cy} r="46" className="dedGraphs-pieInner" />
        <text x={cx} y={cy - 4} textAnchor="middle" className="dedGraphs-pieCenterTop">
          {fmtInt(slices.length)}
        </text>
        <text x={cx} y={cy + 18} textAnchor="middle" className="dedGraphs-pieCenterBottom">
          drops
        </text>
      </svg>
    </div>
  );
}

function computeGraphStats(runs) {
  const totalRuns = runs.length;
  const totalISK = runs.reduce((sum, run) => sum + num(run.iskTotal), 0);
  const totalMinutes = runs.reduce((sum, run) => sum + num(run.clearTimeMinutes), 0);
  const avgISKPerRun = totalRuns ? totalISK / totalRuns : 0;
  const iskPerHour = totalMinutes ? totalISK / (totalMinutes / 60) : 0;

  const byLevelMap = new Map();

  for (const run of runs) {
    const level = run.dedLevel || "Unknown";
    let row = byLevelMap.get(level);

    if (!row) {
      row = {
        level,
        totalISK: 0,
        runs: 0,
        totalMinutes: 0,
      };
      byLevelMap.set(level, row);
    }

    row.totalISK += num(run.iskTotal);
    row.runs += 1;
    row.totalMinutes += num(run.clearTimeMinutes);
  }

  const byLevel = Array.from(byLevelMap.values()).sort((a, b) => compareDedLevels(a.level, b.level));

  return {
    totalRuns,
    totalISK,
    avgISKPerRun,
    iskPerHour,
    totalIskByLevel: byLevel.map((row) => ({
      label: row.level,
      value: row.totalISK,
    })),
    runsByLevel: byLevel.map((row) => ({
      label: row.level,
      value: row.runs,
    })),
    iskPerHourByLevel: byLevel.map((row) => ({
      label: row.level,
      value: row.totalMinutes ? row.totalISK / (row.totalMinutes / 60) : 0,
    })),
  };
}

function computeDropChanceCharts(allRuns, dedFilter) {
  const filteredRuns =
    dedFilter === "All"
      ? allRuns
      : allRuns.filter((run) => run.dedLevel === dedFilter);

  const levelMap = new Map();

  for (const run of filteredRuns) {
    const level = run.dedLevel || "Unknown";
    let section = levelMap.get(level);

    if (!section) {
      section = {
        level,
        totalRuns: 0,
        items: new Map(),
      };
      levelMap.set(level, section);
    }

    section.totalRuns += 1;

    const presentInRun = new Set();

    for (const item of run.items || []) {
      const key = item.name || `type:${item.typeId || "unknown"}`;
      let row = section.items.get(key);

      if (!row) {
        row = {
          name: item.name || key,
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

  return Array.from(levelMap.values())
    .sort((a, b) => compareDedLevels(a.level, b.level))
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
        level: section.level,
        totalRuns: section.totalRuns,
        slices,
        legend,
      };
    });
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

function compareDedLevels(a, b) {
  const aNum = Number(String(a).split("/")[0]);
  const bNum = Number(String(b).split("/")[0]);

  if (Number.isFinite(aNum) && Number.isFinite(bNum)) {
    return aNum - bNum;
  }

  return String(a || "").localeCompare(String(b || ""));
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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