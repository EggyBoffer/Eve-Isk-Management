import { useEffect, useMemo, useState } from "react";
import "../styles/ded-analytics.css";
import { loadRuns } from "../lib/dedStorer";

export default function DEDAnalytics() {
  const [runs, setRuns] = useState([]);
  const [dedFilter, setDedFilter] = useState("All");

  useEffect(() => {
    setRuns(loadRuns());
    const onStorage = (e) => {
      if (e.key === "ded:runs:v1") setRuns(loadRuns());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const levels = useMemo(() => {
    const set = new Set();
    for (const r of runs) if (r.dedLevel) set.add(r.dedLevel);
    return Array.from(set).sort((a, b) => (a || "").localeCompare(b || ""));
  }, [runs]);

  const filteredRuns = useMemo(() => {
    if (dedFilter === "All") return runs;
    return runs.filter((r) => r.dedLevel === dedFilter);
  }, [runs, dedFilter]);

  const stats = useMemo(() => computeStats(filteredRuns), [filteredRuns]);

  const scopeLabel = dedFilter === "All" ? "All levels" : dedFilter;

  return (
    <div className="dedAnalytics-page">
      <div className="dedAnalytics-wrap">
        <div className="dedAnalytics-header">
          <h1>DED Analytics</h1>
          <p>Aggregated performance and loot statistics from your saved DED runs.</p>

          <div className="dedAnalytics-filterRow">
            <div className="dedAnalytics-filterLeft">
              <div className="dedAnalytics-filterLabel">Filter by DED</div>
              <select
                value={dedFilter}
                onChange={(e) => setDedFilter(e.target.value)}
                className="dedAnalytics-select"
              >
                <option value="All">All levels</option>
                {levels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </select>
            </div>

            <div className="dedAnalytics-filterRight">
              <span className="dedAnalytics-scopePill">{scopeLabel}</span>
              <span className="dedAnalytics-scopeText">
                {fmtInt(stats.totalRuns)} run{stats.totalRuns === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>

        <section className="dedAnalytics-metrics">
          <Metric title="Total Runs" value={fmtInt(stats.totalRuns)} />
          <Metric title="Total ISK" value={fmtISK(stats.totalISK)} />
          <Metric title="Avg ISK / Run" value={fmtISK(stats.avgISKPerRun)} />
          <Metric title="ISK / Hour" value={fmtISK(stats.iskPerHour)} />
          <Metric title="Total Time" value={fmtMinutes(stats.totalMinutes)} />
          <Metric title="Avg Minutes / Run" value={fmtNum(stats.avgMinutesPerRun)} />
        </section>

        <section className="dedAnalytics-section">
          <div className="dedAnalytics-sectionHead">
            <h2>By DED Level</h2>
            <div className="dedAnalytics-muted">
              Based on {fmtInt(stats.totalRuns)} run{stats.totalRuns === 1 ? "" : "s"} in current
              scope.
            </div>
          </div>

          <div className="dedAnalytics-tableWrap">
            <table className="dedAnalytics-table">
              <thead>
                <tr>
                  <th>DED</th>
                  <th>Runs</th>
                  <th>Avg ISK / Run</th>
                  <th>Avg Time (min)</th>
                  <th>ISK / Hour</th>
                </tr>
              </thead>
              <tbody>
                {stats.byLevel.map((row) => (
                  <tr key={row.level}>
                    <td>{row.level}</td>
                    <td>{fmtInt(row.runs)}</td>
                    <td>{fmtISK(row.avgISKPerRun)}</td>
                    <td>{fmtNum(row.avgMinutesPerRun)}</td>
                    <td>{fmtISK(row.iskPerHour)}</td>
                  </tr>
                ))}
                {stats.byLevel.length === 0 && (
                  <tr>
                    <td colSpan={5} className="dedAnalytics-empty">
                      No data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dedAnalytics-section">
          <div className="dedAnalytics-sectionHead">
            <h2>Top Items by ISK Value</h2>
            <div className="dedAnalytics-muted">
              Sum of (unitPrice × qty) across runs in current scope.
            </div>
          </div>

          <div className="dedAnalytics-tableWrap dedAnalytics-tableWrap--tall">
            <table className="dedAnalytics-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Total Qty</th>
                  <th>Total ISK</th>
                  <th>Avg Unit (Jita)</th>
                  <th>Drop % of Runs</th>
                </tr>
              </thead>
              <tbody>
                {stats.itemsTopValue.map((it) => (
                  <tr key={it.name}>
                    <td>{it.name}</td>
                    <td>{fmtInt(it.totalQty)}</td>
                    <td>{fmtISK(it.totalISK)}</td>
                    <td>{fmtISK(it.avgUnitPrice)}</td>
                    <td>{fmtPct(it.dropRate)}</td>
                  </tr>
                ))}
                {stats.itemsTopValue.length === 0 && (
                  <tr>
                    <td colSpan={5} className="dedAnalytics-empty">
                      No items yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dedAnalytics-section">
          <div className="dedAnalytics-sectionHead">
            <h2>ISK by Day</h2>
            <div className="dedAnalytics-muted">
              Totals grouped by run date (local time) in current scope.
            </div>
          </div>

          <div className="dedAnalytics-tableWrap">
            <table className="dedAnalytics-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Runs</th>
                  <th>Total ISK</th>
                  <th>Total Time</th>
                  <th>ISK / Hour</th>
                </tr>
              </thead>
              <tbody>
                {stats.byDay.map((d) => (
                  <tr key={d.day}>
                    <td>{d.day}</td>
                    <td>{fmtInt(d.runs)}</td>
                    <td>{fmtISK(d.totalISK)}</td>
                    <td>{fmtMinutes(d.totalMinutes)}</td>
                    <td>{fmtISK(d.iskPerHour)}</td>
                  </tr>
                ))}
                {stats.byDay.length === 0 && (
                  <tr>
                    <td colSpan={5} className="dedAnalytics-empty">
                      No daily data yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ title, value }) {
  return (
    <div className="dedAnalytics-metric">
      <div className="dedAnalytics-metricLabel">{title}</div>
      <div className="dedAnalytics-metricValue">{value}</div>
    </div>
  );
}

function computeStats(runs) {
  const totalRuns = runs.length;
  const totalMinutes = runs.reduce((s, r) => s + (num(r.clearTimeMinutes) || 0), 0);
  const totalISK = runs.reduce((s, r) => s + (num(r.iskTotal) || 0), 0);
  const avgISKPerRun = totalRuns ? totalISK / totalRuns : 0;
  const iskPerHour = totalMinutes ? totalISK / (totalMinutes / 60) : 0;
  const avgMinutesPerRun = totalRuns ? totalMinutes / totalRuns : 0;

  const levelMap = new Map();
  for (const r of runs) {
    const key = r.dedLevel || "Unknown";
    let obj = levelMap.get(key);
    if (!obj) {
      obj = { level: key, runs: 0, totalISK: 0, totalMin: 0 };
      levelMap.set(key, obj);
    }
    obj.runs += 1;
    obj.totalISK += num(r.iskTotal) || 0;
    obj.totalMin += num(r.clearTimeMinutes) || 0;
  }

  const byLevel = Array.from(levelMap.values())
    .map((l) => ({
      level: l.level,
      runs: l.runs,
      avgISKPerRun: l.runs ? l.totalISK / l.runs : 0,
      avgMinutesPerRun: l.runs ? l.totalMin / l.runs : 0,
      iskPerHour: l.totalMin ? l.totalISK / (l.totalMin / 60) : 0,
    }))
    .sort((a, b) => (a.level || "").localeCompare(b.level || ""));

  const itemAgg = new Map();
  for (const r of runs) {
    const present = new Set();
    for (const it of r.items || []) {
      const key = it.name || `type:${it.typeId || "unknown"}`;
      let a = itemAgg.get(key);
      if (!a) {
        a = {
          name: it.name || key,
          totalQty: 0,
          totalISK: 0,
          unitSamples: 0,
          unitSum: 0,
          runHits: 0,
        };
        itemAgg.set(key, a);
      }
      a.totalQty += num(it.qty) || 0;
      a.totalISK += num(it.total) || 0;
      if (isFinite(it.unitPrice) && it.unitPrice > 0) {
        a.unitSamples += 1;
        a.unitSum += it.unitPrice;
      }
      present.add(key);
    }
    for (const k of present) itemAgg.get(k).runHits += 1;
  }

  const itemsTopValue = Array.from(itemAgg.values())
    .map((a) => ({
      name: a.name,
      totalQty: a.totalQty,
      totalISK: a.totalISK,
      avgUnitPrice: a.unitSamples ? a.unitSum / a.unitSamples : 0,
      dropRate: totalRuns ? a.runHits / totalRuns : 0,
    }))
    .sort((a, b) => b.totalISK - a.totalISK)
    .slice(0, 25);

  const dayMap = new Map();
  for (const r of runs) {
    const d = dayKey(r.createdAt);
    let obj = dayMap.get(d);
    if (!obj) {
      obj = { day: d, runs: 0, totalISK: 0, totalMinutes: 0 };
      dayMap.set(d, obj);
    }
    obj.runs += 1;
    obj.totalISK += num(r.iskTotal) || 0;
    obj.totalMinutes += num(r.clearTimeMinutes) || 0;
  }

  const byDay = Array.from(dayMap.values())
    .map((d) => ({ ...d, iskPerHour: d.totalMinutes ? d.totalISK / (d.totalMinutes / 60) : 0 }))
    .sort((a, b) => (a.day < b.day ? 1 : -1));

  return {
    totalRuns,
    totalMinutes,
    totalISK,
    avgISKPerRun,
    iskPerHour,
    avgMinutesPerRun,
    byLevel,
    itemsTopValue,
    byDay,
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dayKey(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return "Unknown";
  }
}

function fmtISK(v) {
  try {
    return `${new Intl.NumberFormat().format(Math.round(v))} ISK`;
  } catch {
    return `${Math.round(v)} ISK`;
  }
}

function fmtInt(v) {
  try {
    return new Intl.NumberFormat().format(Math.round(v));
  } catch {
    return String(Math.round(v));
  }
}

function fmtNum(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "-";
  return (Math.round(n * 10) / 10).toFixed(1);
}

function fmtMinutes(totalMin) {
  const n = Number(totalMin) || 0;
  const h = Math.floor(n / 60);
  const m = Math.round(n % 60);
  return h <= 0 ? `${m} min` : `${h}h ${m}m`;
}

function fmtPct(f) {
  const n = Number(f);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
}
