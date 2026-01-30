import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/overall-analytics.css";

import { loadRuns as loadDEDRuns } from "../lib/dedStorer";
import { loadEventRuns } from "../lib/eventRunsStore";
import { loadEventBounties } from "../lib/eventBountiesStore";
import { loadIncursionTicks } from "../lib/parsers/features/Incursions/incursionStore";

export default function OverallAnalytics() {
  const navigate = useNavigate();

  const [abyssals, setAbyssals] = useState([]);
  const [glorified, setGlorified] = useState([]);
  const [dedRuns, setDedRuns] = useState([]);
  const [eventRuns, setEventRuns] = useState([]);
  const [eventBounties, setEventBounties] = useState([]);
  const [incursionTicks, setIncursionTicks] = useState([]);

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

  function refreshAll() {
    refreshAbyssals();
    setDedRuns(loadDEDRuns());
    setEventRuns(loadEventRuns());
    setEventBounties(loadEventBounties());
    setIncursionTicks(loadIncursionTicks());
  }

  const totals = useMemo(() => {
    const abyss = computeAbyssalsTotals(abyssals, glorified);
    const ded = computeDEDTotals(dedRuns);
    const ev = computeEventTotals(eventRuns, eventBounties);
    const inc = computeIncursionTotals(incursionTicks);

    const totalISK = abyss.totalISK + ded.totalISK + ev.totalISK + inc.totalISK;
    const totalHours = abyss.totalHours + ded.totalHours + ev.totalHours + inc.totalHours;
    const iskPerHour = totalHours > 0 ? totalISK / totalHours : 0;

    return { abyss, ded, ev, inc, totalISK, totalHours, iskPerHour };
  }, [abyssals, glorified, dedRuns, eventRuns, eventBounties, incursionTicks]);

  return (
    <div className="overallPage">
      <div className="overallWrap">
        <div className="overallHeader">
          <h1>Overall Statistics</h1>
          <p>All income tracking combined into one unified overview.</p>
        </div>

        <section className="overallTopGrid">
          <div className="overallMetric">
            <div className="overallMetricLabel">Total ISK</div>
            <div className="overallMetricValue">{fmtISK(totals.totalISK)}</div>
          </div>
          <div className="overallMetric">
            <div className="overallMetricLabel">Total Time</div>
            <div className="overallMetricValue">{fmtHours(totals.totalHours)}</div>
          </div>
          <div className="overallMetric">
            <div className="overallMetricLabel">ISK / Hour</div>
            <div className="overallMetricValue">{fmtISK(totals.iskPerHour)}</div>
          </div>
          <button type="button" className="overallRefreshBtn" onClick={refreshAll}>
            Refresh
          </button>
        </section>

        <section className="overallSection">
          <div className="overallSectionHead">
            <h2>Modules</h2>
            <div className="overallMuted">Jump straight into detailed analytics.</div>
          </div>

          <div className="overallModulesGrid">
            <button type="button" className="overallModuleCard" onClick={() => navigate("/analytics")}>
              <div className="overallModuleTop">
                <div className="overallModuleTitle">Abyssals</div>
              </div>
              <div className="overallModuleRow">
                <span>Total ISK</span>
                <strong>{fmtISK(totals.abyss.totalISK)}</strong>
              </div>
              <div className="overallModuleRow">
                <span>Runs</span>
                <strong>{fmtInt(totals.abyss.runs)}</strong>
              </div>
              <div className="overallModuleRow">
                <span>ISK / Hour</span>
                <strong>{fmtISK(totals.abyss.iskPerHour)}</strong>
              </div>
            </button>

            <button type="button" className="overallModuleCard" onClick={() => navigate("/ded-analytics")}>
              <div className="overallModuleTop">
                <div className="overallModuleTitle">DED</div>
              </div>
              <div className="overallModuleRow">
                <span>Total ISK</span>
                <strong>{fmtISK(totals.ded.totalISK)}</strong>
              </div>
              <div className="overallModuleRow">
                <span>Runs</span>
                <strong>{fmtInt(totals.ded.runs)}</strong>
              </div>
              <div className="overallModuleRow">
                <span>ISK / Hour</span>
                <strong>{fmtISK(totals.ded.iskPerHour)}</strong>
              </div>
            </button>

            <button type="button" className="overallModuleCard" onClick={() => navigate("/event-analytics")}>
              <div className="overallModuleTop">
                <div className="overallModuleTitle">Events</div>
              </div>
              <div className="overallModuleRow">
                <span>Total ISK</span>
                <strong>{fmtISK(totals.ev.totalISK)}</strong>
              </div>
              <div className="overallModuleRow">
                <span>Runs</span>
                <strong>{fmtInt(totals.ev.runs)}</strong>
              </div>
              <div className="overallModuleRow">
                <span>ISK / Hour</span>
                <strong>{fmtISK(totals.ev.iskPerHour)}</strong>
              </div>
            </button>

            <button
              type="button"
              className="overallModuleCard"
              onClick={() => navigate("/incursions/analytics")}
            >
              <div className="overallModuleTop">
                <div className="overallModuleTitle">Incursions</div>
              </div>
              <div className="overallModuleRow">
                <span>Total ISK</span>
                <strong>{fmtISK(totals.inc.totalISK)}</strong>
              </div>
              <div className="overallModuleRow">
                <span>Ticks</span>
                <strong>{fmtInt(totals.inc.ticks)}</strong>
              </div>
              <div className="overallModuleRow">
                <span>ISK / Hour</span>
                <strong>{fmtISK(totals.inc.iskPerHour)}</strong>
              </div>
            </button>
          </div>
        </section>

        <section className="overallSection">
          <div className="overallSectionHead">
            <h2>Breakdown</h2>
            <div className="overallMuted">Totals by tracker.</div>
          </div>

          <div className="overallTableWrap">
            <table className="overallTable">
              <thead>
                <tr>
                  <th>Tracker</th>
                  <th>Count</th>
                  <th>Total Time</th>
                  <th>Total ISK</th>
                  <th>ISK / Hour</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Abyssals</td>
                  <td>{fmtInt(totals.abyss.runs)} runs</td>
                  <td>{fmtHours(totals.abyss.totalHours)}</td>
                  <td>{fmtISK(totals.abyss.totalISK)}</td>
                  <td>{fmtISK(totals.abyss.iskPerHour)}</td>
                </tr>
                <tr>
                  <td>DED</td>
                  <td>{fmtInt(totals.ded.runs)} runs</td>
                  <td>{fmtHours(totals.ded.totalHours)}</td>
                  <td>{fmtISK(totals.ded.totalISK)}</td>
                  <td>{fmtISK(totals.ded.iskPerHour)}</td>
                </tr>
                <tr>
                  <td>Events</td>
                  <td>{fmtInt(totals.ev.runs)} runs</td>
                  <td>{fmtHours(totals.ev.totalHours)}</td>
                  <td>{fmtISK(totals.ev.totalISK)}</td>
                  <td>{fmtISK(totals.ev.iskPerHour)}</td>
                </tr>
                <tr>
                  <td>Incursions</td>
                  <td>{fmtInt(totals.inc.ticks)} ticks</td>
                  <td>{fmtHours(totals.inc.totalHours)}</td>
                  <td>{fmtISK(totals.inc.totalISK)}</td>
                  <td>{fmtISK(totals.inc.iskPerHour)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function computeAbyssalsTotals(entries, glorified) {
  const runs = Array.isArray(entries) ? entries.length : 0;

  const baseISK = (entries || []).reduce((s, e) => {
    return (
      s +
      num(e.room1_isk) +
      num(e.room2_isk) +
      num(e.room3_isk) -
      num(e.fillament_cost)
    );
  }, 0);

  const glorifiedISK = (glorified || []).reduce(
    (s, g) => s + num(g.value_isk || g.value || g.isk || 0),
    0
  );

  const totalMinutes = (entries || []).reduce((s, e) => s + num(e.time_taken), 0);
  const totalHours = totalMinutes / 60;
  const totalISK = baseISK + glorifiedISK;
  const iskPerHour = totalHours > 0 ? totalISK / totalHours : 0;

  return { runs, totalISK, totalHours, iskPerHour };
}

function computeDEDTotals(runs) {
  const count = Array.isArray(runs) ? runs.length : 0;
  const totalISK = (runs || []).reduce((s, r) => s + num(r.iskTotal), 0);
  const totalMinutes = (runs || []).reduce((s, r) => s + num(r.clearTimeMinutes), 0);
  const totalHours = totalMinutes / 60;
  const iskPerHour = totalHours > 0 ? totalISK / totalHours : 0;
  return { runs: count, totalISK, totalHours, iskPerHour };
}

function computeEventTotals(runs, bounties) {
  const count = Array.isArray(runs) ? runs.length : 0;
  const lootISK = (runs || []).reduce((s, r) => s + num(r.lootISK), 0);
  const bountyISKFromRuns = (runs || []).reduce((s, r) => s + num(r.bountyISK), 0);
  const bountyISKFromTicks = (bounties || []).reduce((s, t) => s + num(t.tickISK), 0);

  const totalISK = lootISK + bountyISKFromRuns + bountyISKFromTicks;

  const totalMinutes = (runs || []).reduce((s, r) => s + num(r.clearTimeMinutes), 0);
  const totalHours = totalMinutes / 60;
  const iskPerHour = totalHours > 0 ? totalISK / totalHours : 0;

  return { runs: count, totalISK, totalHours, iskPerHour };
}

function computeIncursionTotals(ticks) {
  const count = Array.isArray(ticks) ? ticks.length : 0;
  const totalISK = (ticks || []).reduce((s, t) => s + num(t.amountISK), 0);

  const timestamps = (ticks || [])
    .map((t) => parseWalletTs(t.timestamp))
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);

  const spanMs = timestamps.length >= 2 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
  const totalHours = spanMs > 0 ? spanMs / (1000 * 60 * 60) : 0;
  const iskPerHour = totalHours > 0 ? totalISK / totalHours : 0;

  return { ticks: count, totalISK, totalHours, iskPerHour };
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

function fmtHours(h) {
  const n = Number(h) || 0;
  if (n <= 0) return "0h";
  if (n < 1) return `${Math.round(n * 60)}m`;
  const whole = Math.floor(n);
  const mins = Math.round((n - whole) * 60);
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
}
