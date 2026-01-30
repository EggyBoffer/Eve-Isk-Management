
import { useEffect, useMemo, useState } from "react";
import "../styles/ded-analytics.css";
import { loadEventRuns } from "../lib/eventRunsStore.js";
import { loadEventBounties } from "../lib/eventBountiesStore.js";

export default function EventAnalytics() {
  const [runs, setRuns] = useState([]);
  const [bounties, setBounties] = useState([]);

  useEffect(() => {
    setRuns(loadEventRuns());
    setBounties(loadEventBounties());

    const onStorage = (e) => {
      if (e.key === "event:runs:v1") setRuns(loadEventRuns());
      if (e.key === "event:bounties:v1") setBounties(loadEventBounties());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const stats = useMemo(() => computeStats(runs, bounties), [runs, bounties]);

  return (
    <div className="ded-analytics-page">
      <div className="ded-analytics-header">
        <h1>Event Analytics</h1>
        <p>Loot per site, plus global bounty income from your wallet ticks.</p>
      </div>

      {}
      <section className="ded-cards">
        <Card title="Total Runs" value={fmtInt(stats.totalRuns)} />
        <Card title="Total Loot ISK" value={fmtISK(stats.totalLootISK)} />
        <Card title="Total Bounty ISK" value={fmtISK(stats.totalBountyISK)} />
        <Card title="Total ISK" value={fmtISK(stats.totalISK)} />
        <Card title="Total Time" value={fmtMinutes(stats.totalMinutes)} />
        <Card title="ISK / Hour (Loot + Bounty)" value={fmtISK(stats.iskPerHour)} />
      </section>

      {}
      <section className="ded-section">
        <div className="ded-section-head">
          <h2>By Site Type (Loot Only)</h2>
          <small className="ded-muted">
            Based on {fmtInt(stats.totalRuns)} run{stats.totalRuns === 1 ? "" : "s"}.
          </small>
        </div>
        <div className="ded-table-wrap">
          <table className="ded-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>Runs</th>
                <th>Total Loot ISK</th>
                <th>Avg Loot / Run</th>
                <th>Avg Time (min)</th>
                <th>ISK / Hour (Loot)</th>
              </tr>
            </thead>
            <tbody>
              {stats.bySite.map((row) => (
                <tr key={row.siteType}>
                  <td>{row.siteType}</td>
                  <td>{fmtInt(row.runs)}</td>
                  <td>{fmtISK(row.totalLootISK)}</td>
                  <td>{fmtISK(row.avgLootPerRun)}</td>
                  <td>{fmtNum(row.avgMinutesPerRun)}</td>
                  <td>{fmtISK(row.lootIskPerHour)}</td>
                </tr>
              ))}
              {stats.bySite.length === 0 && (
                <tr>
                  <td colSpan={6} className="ded-muted">
                    No event runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {}
      <section className="ded-section">
        <div className="ded-section-head">
          <h2>Bounty by Character</h2>
          <small className="ded-muted">
            Based on parsed wallet <strong>Bounty Prizes</strong> entries.
          </small>
        </div>
        <div className="ded-table-wrap">
          <table className="ded-table">
            <thead>
              <tr>
                <th>Character</th>
                <th>Ticks</th>
                <th>Total Bounty ISK</th>
                <th>Avg Tick</th>
              </tr>
            </thead>
            <tbody>
              {stats.byCharacter.map((row) => (
                <tr key={row.character}>
                  <td>{row.character}</td>
                  <td>{fmtInt(row.ticks)}</td>
                  <td>{fmtISK(row.totalBountyISK)}</td>
                  <td>{fmtISK(row.avgTick)}</td>
                </tr>
              ))}
              {stats.byCharacter.length === 0 && (
                <tr>
                  <td colSpan={4} className="ded-muted">
                    No bounty ticks recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {}
      <section className="ded-section">
        <div className="ded-section-head">
          <h2>ISK by Day (Loot + Bounty)</h2>
          <small className="ded-muted">Totals grouped by local date.</small>
        </div>
        <div className="ded-table-wrap">
          <table className="ded-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Runs</th>
                <th>Loot ISK</th>
                <th>Bounty ISK</th>
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
                  <td>{fmtISK(d.totalLootISK)}</td>
                  <td>{fmtISK(d.totalBountyISK)}</td>
                  <td>{fmtISK(d.totalISK)}</td>
                  <td>{fmtMinutes(d.totalMinutes)}</td>
                  <td>{fmtISK(d.iskPerHour)}</td>
                </tr>
              ))}
              {stats.byDay.length === 0 && (
                <tr>
                  <td colSpan={7} className="ded-muted">
                    No daily data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}



function Card({ title, value }) {
  return (
    <div className="ded-card">
      <div className="ded-card-title">{title}</div>
      <div className="ded-card-value">{value}</div>
    </div>
  );
}

function computeStats(runs, bounties) {
  const totalRuns = runs.length;
  const totalMinutes = runs.reduce((s, r) => s + (num(r.clearTimeMinutes) || 0), 0);
  const totalLootISK = runs.reduce((s, r) => s + (num(r.lootISK) || 0), 0);
  const totalBountyISK = bounties.reduce((s, b) => s + (num(b.tickISK) || 0), 0);
  const totalISK = totalLootISK + totalBountyISK;
  const iskPerHour = totalMinutes ? totalISK / (totalMinutes / 60) : 0;

  
  const siteMap = new Map();
  for (const r of runs) {
    const key = r.siteType || "Unknown";
    let obj = siteMap.get(key);
    if (!obj) {
      obj = {
        siteType: key,
        runs: 0,
        totalLootISK: 0,
        totalMinutes: 0,
      };
      siteMap.set(key, obj);
    }
    obj.runs += 1;
    obj.totalLootISK += num(r.lootISK) || 0;
    obj.totalMinutes += num(r.clearTimeMinutes) || 0;
  }

  const bySite = Array.from(siteMap.values())
    .map((s) => ({
      ...s,
      avgLootPerRun: s.runs ? s.totalLootISK / s.runs : 0,
      avgMinutesPerRun: s.runs ? s.totalMinutes / s.runs : 0,
      lootIskPerHour: s.totalMinutes ? s.totalLootISK / (s.totalMinutes / 60) : 0,
    }))
    .sort((a, b) => (a.siteType || "").localeCompare(b.siteType || ""));

  
  const charMap = new Map();
  for (const b of bounties) {
    const key = b.character || "Unknown";
    let obj = charMap.get(key);
    if (!obj) {
      obj = { character: key, ticks: 0, totalBountyISK: 0 };
      charMap.set(key, obj);
    }
    obj.ticks += 1;
    obj.totalBountyISK += num(b.tickISK) || 0;
  }

  const byCharacter = Array.from(charMap.values())
    .map((c) => ({
      ...c,
      avgTick: c.ticks ? c.totalBountyISK / c.ticks : 0,
    }))
    .sort((a, b) => b.totalBountyISK - a.totalBountyISK);

  
  const dayMap = new Map();

  for (const r of runs) {
    const d = dayKey(r.createdAt);
    let obj = dayMap.get(d);
    if (!obj) {
      obj = {
        day: d,
        runs: 0,
        totalLootISK: 0,
        totalBountyISK: 0,
        totalISK: 0,
        totalMinutes: 0,
      };
      dayMap.set(d, obj);
    }
    obj.runs += 1;
    obj.totalLootISK += num(r.lootISK) || 0;
    obj.totalMinutes += num(r.clearTimeMinutes) || 0;
  }

  for (const b of bounties) {
    const d = dayKey(b.walletTimestamp);
    let obj = dayMap.get(d);
    if (!obj) {
      obj = {
        day: d,
        runs: 0,
        totalLootISK: 0,
        totalBountyISK: 0,
        totalISK: 0,
        totalMinutes: 0,
      };
      dayMap.set(d, obj);
    }
    obj.totalBountyISK += num(b.tickISK) || 0;
  }

  const byDay = Array.from(dayMap.values())
    .map((d) => {
      const totalISKDay = d.totalLootISK + d.totalBountyISK;
      return {
        ...d,
        totalISK: totalISKDay,
        iskPerHour: d.totalMinutes ? totalISKDay / (d.totalMinutes / 60) : 0,
      };
    })
    .sort((a, b) => (a.day < b.day ? 1 : -1)); 

  return {
    totalRuns,
    totalMinutes,
    totalLootISK,
    totalBountyISK,
    totalISK,
    iskPerHour,
    bySite,
    byCharacter,
    byDay,
  };
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dayKey(iso) {
  if (!iso) return "Unknown";
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
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}m`;
}
