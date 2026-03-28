import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/incursion.css";

import { summarizeIncursionTicks } from "../lib/parsers/features/Incursions/incursionParser";
import { loadIncursionTicks } from "../lib/parsers/features/Incursions/incursionStore";
import {
  groupIncursionsByCharacter,
  groupIncursionsByMonth,
} from "../lib/parsers/features/Incursions/incursionAnalytics";

function formatISK(n) {
  return `${Math.round(n || 0).toLocaleString("en-GB")} ISK`;
}

function formatLP(n) {
  return `${Math.round(n || 0).toLocaleString("en-GB")} LP`;
}

function formatCompactISK(n) {
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(n || 0));
}

function normalizeSiteLabel(label) {
  const value = String(label || "").trim();
  if (!value) return "Unknown";
  return value.replace(/\s*\((max|scaled)\)\s*$/i, "").trim();
}

function groupIncursionsBySite(rows) {
  const grouped = {};

  for (const row of rows) {
    const label = normalizeSiteLabel(row.lpLabel);
    if (!grouped[label]) {
      grouped[label] = { site: label, ticks: 0, isk: 0, lp: 0 };
    }

    grouped[label].ticks += 1;
    grouped[label].isk += Number(row.amountISK) || 0;
    grouped[label].lp += Number(row.lp) || 0;
  }

  return Object.values(grouped).sort((a, b) => b.isk - a.isk);
}

function buildLast12MonthsData(rows) {
  const now = new Date();
  const months = [];

  for (let offset = 11; offset >= 0; offset -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = d.getFullYear();
    const monthIndex = d.getMonth();
    const key = `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
    const label = d.toLocaleString("en-GB", { month: "short", year: "2-digit" });

    months.push({
      key,
      label,
      value: 0,
    });
  }

  const monthMap = new Map(months.map((m) => [m.key, m]));

  for (const row of rows) {
    if (!monthMap.has(row.month)) continue;
    monthMap.get(row.month).value = Number(row.isk) || 0;
  }

  return months;
}

export default function IncursionAnalytics() {
  const navigate = useNavigate();
  const [ticks, setTicks] = useState([]);

  useEffect(() => {
    setTicks(loadIncursionTicks());

    const onStorage = (e) => {
      if (e.key === "incursions:ticks:v1") setTicks(loadIncursionTicks());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const summary = useMemo(() => summarizeIncursionTicks(ticks), [ticks]);
  const byChar = useMemo(() => groupIncursionsByCharacter(ticks), [ticks]);
  const byMonth = useMemo(() => groupIncursionsByMonth(ticks), [ticks]);
  const bySite = useMemo(() => groupIncursionsBySite(ticks), [ticks]);

  const iskPerMonthGraphData = useMemo(
    () => buildLast12MonthsData(byMonth),
    [byMonth]
  );

  const iskPerSiteGraphData = useMemo(
    () => bySite.map((s) => ({ label: s.site, value: s.isk })),
    [bySite]
  );

  return (
    <div className="incursionPage">
      <div className="incursionBackdrop" aria-hidden="true" />

      <div className="incursionWrap">
        <div className="incursionHeader">
          <h1>Incursion Analytics</h1>
          <p>Detailed breakdown of your saved incursion payouts.</p>

          <div className="incursionLinkRow">
            <button
              className="incursionLinkBtn"
              onClick={() => navigate("/incursions")}
            >
              ← Back to Incursion Tracker
            </button>
          </div>
        </div>

        <div className="incursionPanel incursionPanelSpacer">
          <div className="incursionPanelHead">
            <h2>Totals</h2>
            <div className="incursionPill">{summary.ticks} ticks</div>
          </div>

          <div className="incursionMetricsGrid">
            <div className="incursionMetric">
              <div className="incursionMetricLabel">Total ISK</div>
              <div className="incursionMetricValue">{formatISK(summary.totalISK)}</div>
            </div>
            <div className="incursionMetric">
              <div className="incursionMetricLabel">Total LP</div>
              <div className="incursionMetricValue">{formatLP(summary.totalLP)}</div>
            </div>
            <div className="incursionMetric">
              <div className="incursionMetricLabel">ISK / hour</div>
              <div className="incursionMetricValue">
                {summary.iskPerHour ? formatISK(summary.iskPerHour) : "-"}
              </div>
            </div>
            <div className="incursionMetric">
              <div className="incursionMetricLabel">LP / hour</div>
              <div className="incursionMetricValue">
                {summary.lpPerHour ? formatLP(summary.lpPerHour) : "-"}
              </div>
            </div>
            <div className="incursionMetric">
              <div className="incursionMetricLabel">Unknown LP ticks</div>
              <div className="incursionMetricValue">{summary.unknownLPCount}</div>
            </div>
            <div className="incursionMetric">
              <div className="incursionMetricLabel">Characters</div>
              <div className="incursionMetricValue">
                {new Set(ticks.map((t) => t.character || "Unknown")).size}
              </div>
            </div>
          </div>
        </div>

        <div className="incursionGraphsGrid">
          <GraphCard
            title="ISK per Month"
            subtitle="Displaying Last 12 months"
          >
            <VerticalBarChart
              data={iskPerMonthGraphData}
              emptyLabel="No monthly incursion data yet."
              valueFormatter={formatCompactISK}
              labelMaxLength={8}
            />
          </GraphCard>

          <GraphCard
            title="ISK per Site"
          >
            <VerticalBarChart
              data={iskPerSiteGraphData}
              emptyLabel="No site payout data yet."
              valueFormatter={formatCompactISK}
              labelMaxLength={18}
            />
          </GraphCard>
        </div>

        <div className="incursionPanel incursionPanelSpacer">
          <div className="incursionPanelHead">
            <h2>Income by Character</h2>
            <div className="incursionSubtle">{byChar.length} character's included in metrics.</div>
          </div>

          <div className="incursionTableWrap">
            <table className="incursionTable">
              <thead>
                <tr>
                  <th>Character</th>
                  <th>Ticks</th>
                  <th>Total ISK</th>
                  <th>Total LP</th>
                </tr>
              </thead>
              <tbody>
                {byChar.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="incursionTableEmpty">
                      No saved incursion ticks yet.
                    </td>
                  </tr>
                ) : (
                  byChar.map((r) => (
                    <tr key={r.character}>
                      <td>{r.character}</td>
                      <td>{r.ticks}</td>
                      <td>{formatISK(r.isk)}</td>
                      <td>{formatLP(r.lp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="incursionPanel incursionPanelSpacer">
          <div className="incursionPanelHead">
            <h2>Income per Month</h2>
            <div className="incursionSubtle">{byMonth.length} month(s)</div>
          </div>

          <div className="incursionTableWrap">
            <table className="incursionTable">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Ticks</th>
                  <th>Total ISK</th>
                  <th>Total LP</th>
                </tr>
              </thead>
              <tbody>
                {byMonth.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="incursionTableEmpty">
                      No saved incursion ticks yet.
                    </td>
                  </tr>
                ) : (
                  byMonth.map((m) => (
                    <tr key={m.month}>
                      <td>{m.month}</td>
                      <td>{m.ticks}</td>
                      <td>{formatISK(m.isk)}</td>
                      <td>{formatLP(m.lp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="incursionPanel incursionPanelSpacer">
          <div className="incursionPanelHead">
            <h2>Income per Site</h2>
          </div>

          <div className="incursionTableWrap">
            <table className="incursionTable">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Ticks</th>
                  <th>Total ISK</th>
                  <th>Total LP</th>
                </tr>
              </thead>
              <tbody>
                {bySite.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="incursionTableEmpty">
                      No saved incursion ticks yet.
                    </td>
                  </tr>
                ) : (
                  bySite.map((s) => (
                    <tr key={s.site}>
                      <td>{s.site}</td>
                      <td>{s.ticks}</td>
                      <td>{formatISK(s.isk)}</td>
                      <td>{formatLP(s.lp)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function GraphCard({ title, subtitle, children }) {
  return (
    <section className="incursionGraphCard">
      <div className="incursionGraphHead">
        <h3>{title}</h3>
        <div className="incursionGraphSubtle">{subtitle}</div>
      </div>
      {children}
    </section>
  );
}

function VerticalBarChart({
  data,
  valueFormatter,
  emptyLabel,
  labelMaxLength = 14,
}) {
  if (!data.length) {
    return <div className="incursionChartEmpty">{emptyLabel}</div>;
  }

  const chartWidth = 1200;
  const chartHeight = 360;
  const padTop = 34;
  const padRight = 28;
  const padBottom = 86;
  const padLeft = 96;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const tickCount = 4;
  const stepX = innerWidth / data.length;
  const barWidth = Math.max(42, Math.min(92, stepX * 0.42));

  return (
    <div className="incursionChartShell">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="incursionChartSvg"
        role="img"
      >
        <defs>
          <linearGradient id="incursionBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe08a" />
            <stop offset="100%" stopColor="#ffb454" />
          </linearGradient>
        </defs>

        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + innerHeight}
          className="incursionChartAxis"
        />
        <line
          x1={padLeft}
          y1={padTop + innerHeight}
          x2={padLeft + innerWidth}
          y2={padTop + innerHeight}
          className="incursionChartAxis"
        />

        {Array.from({ length: tickCount + 1 }).map((_, index) => {
          const ratio = index / tickCount;
          const y = padTop + innerHeight - ratio * innerHeight;
          const tickValue = maxValue * ratio;

          return (
            <g key={index}>
              <line
                x1={padLeft}
                y1={y}
                x2={padLeft + innerWidth}
                y2={y}
                className="incursionChartGridLine"
              />
              <text
                x={padLeft - 14}
                y={y + 5}
                textAnchor="end"
                className="incursionChartTickText"
              >
                {valueFormatter(tickValue)}
              </text>
            </g>
          );
        })}

        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * innerHeight;
          const safeBarHeight = item.value > 0 ? Math.max(barHeight, 8) : 0;
          const x = padLeft + stepX * index + (stepX - barWidth) / 2;
          const y = padTop + innerHeight - safeBarHeight;
          const centerX = x + barWidth / 2;

          return (
            <g key={item.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={safeBarHeight}
                rx="12"
                fill="url(#incursionBarGradient)"
              />
              <text
                x={centerX}
                y={Math.max(y - 10, 20)}
                textAnchor="middle"
                className="incursionChartValueText"
              >
                {valueFormatter(item.value)}
              </text>
              <text
                x={centerX}
                y={padTop + innerHeight + 30}
                textAnchor="middle"
                className="incursionChartLabelText"
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

function truncateLabel(value, maxLength) {
  if (!value) return "—";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}