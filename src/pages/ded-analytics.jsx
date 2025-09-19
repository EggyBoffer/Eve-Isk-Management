// src/pages/ded-analytics.jsx
import { useEffect, useMemo, useState } from "react";
import "../styles/ded-analytics.css";
import { loadRuns } from "../lib/dedStorer";

export default function DEDAnalytics() {
  const [runs, setRuns] = useState([]);

  useEffect(() => {
    setRuns(loadRuns());
    const onStorage = (e) => {
      if (e.key === "ded:runs:v1") setRuns(loadRuns());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const stats = useMemo(() => computeStats(runs), [runs]);

  return (
    <div className="ded-analytics-page">
      <div className="ded-analytics-header">
        <h1>DED Analytics</h1>
        <p>Aggregated performance and loot statistics from your saved DED runs.</p>
      </div>

      {/* Overview cards */}
      <section className="ded-cards">
        <Card title="Total Runs" value={fmtInt(stats.totalRuns)} />
        <Card title="Total ISK" value={fmtISK(stats.totalISK)} />
        <Card title="Avg ISK / Run" value={fmtISK(stats.avgISKPerRun)} />
        <Card title="ISK / Hour" value={fmtISK(stats.iskPerHour)} />
        <Card title="Total Time" value={fmtMinutes(stats.totalMinutes)} />
        <Card title="Avg Minutes / Run" value={fmtNum(stats.avgMinutesPerRun)} />
      </section>

      {/* Per-level table */}
      <section className="ded-section">
        <div className="ded-section-head">
          <h2>By DED Level</h2>
          <small className="ded-muted">
            Based on {fmtInt(stats.totalRuns)} run{stats.totalRuns === 1 ? "" : "s"}.
          </small>
        </div>
        <div className="ded-table-wrap">
          <table className="ded-table">
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
                <tr key={row.level || "unknown"}>
                  <td>{row.level}</td>
                  <td>{fmtInt(row.runs)}</td>
                  <td>{fmtISK(row.avgISKPerRun)}</td>
                  <td>{fmtNum(row.avgMinutesPerRun)}</td>
                  <td>{fmtISK(row.iskPerHour)}</td>
                </tr>
              ))}
              {stats.byLevel.length === 0 && (
                <tr>
                  <td colSpan={5} className="ded-muted">No data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Top items by value */}
      <section className="ded-section">
        <div className="ded-section-head">
          <h2>Top Items by ISK Value</h2>
          <small className="ded-muted">Sum of (unitPrice × qty) across all runs.</small>
        </div>
        <div className="ded-table-wrap">
          <table className="ded-table">
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
                  <td colSpan={5} className="ded-muted">No items yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* ISK by day */}
      <section className="ded-section">
        <div className="ded-section-head">
          <h2>ISK by Day</h2>
        </div>
        <div className="ded-table-wrap">
          <table className="ded-table">
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
                  <td colSpan={5} className="ded-muted">No daily data yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/* ---------- helpers ---------- */

function Card({ title, value }) {
  return (
    <div className="ded-card">
      <div className="ded-card-title">{title}</div>
      <div className="ded-card-value">{value}</div>
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

  // By DED level
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

  // Items aggregation
  const itemAgg = new Map();
  for (const r of runs) {
    const present = new Set();
    for (const it of r.items || []) {
      const key = it.name || `type:${it.typeId || "unknown"}`;
      let a = itemAgg.get(key);
      if (!a) {
        a = { name: it.name || key, totalQty: 0, totalISK: 0, unitSamples: 0, unitSum: 0, runHits: 0 };
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
    for (const k of present) {
      itemAgg.get(k).runHits += 1;
    }
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

  // By day
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

function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function dayKey(iso) {
  try {
    const d = new Date(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch { return "Unknown"; }
}
function fmtISK(v) {
  try { return `${new Intl.NumberFormat().format(Math.round(v))} ISK`; }
  catch { return `${Math.round(v)} ISK`; }
}
function fmtInt(v) {
  try { return new Intl.NumberFormat().format(Math.round(v)); }
  catch { return String(Math.round(v)); }
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
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}m`;
}
function fmtPct(f) {
  const n = Number(f);
  if (!Number.isFinite(n)) return "-";
  return `${(n * 100).toFixed(1)}%`;
}
