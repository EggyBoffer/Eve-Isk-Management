import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/overall-analytics.css";

import { loadRuns as loadDEDRuns } from "../lib/dedStorer";
import { loadEventRuns } from "../lib/eventRunsStore";
import { loadEventBounties } from "../lib/eventBountiesStore";
import { loadIncursionTicks } from "../lib/parsers/features/Incursions/incursionStore";
import { getAllCrabRuns } from "../lib/crabStore";

const FOB_HISTORY_START = "2003-01-01T00:00:00.000Z";

export default function OverallAnalytics() {
  const navigate = useNavigate();
  const [abyssals, setAbyssals] = useState([]);
  const [glorified, setGlorified] = useState([]);
  const [dedRuns, setDedRuns] = useState([]);
  const [eventRuns, setEventRuns] = useState([]);
  const [eventBounties, setEventBounties] = useState([]);
  const [incursionTicks, setIncursionTicks] = useState([]);
  const [crabRuns, setCrabRuns] = useState([]);
  const [officerSummary, setOfficerSummary] = useState(null);
  const [fobSummary, setFobSummary] = useState(null);
  const [marketSales, setMarketSales] = useState(null);
  const [errors, setErrors] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const refreshAbyssals = useCallback(async () => {
    const [entries, bonus] = await Promise.all([
      window.api.getEntries("abyssals"),
      window.api.getGlorified(),
    ]);
    setAbyssals(Array.isArray(entries) ? entries : []);
    setGlorified(Array.isArray(bonus) ? bonus : []);
  }, []);

  const refreshCrabs = useCallback(async () => {
    const runs = await getAllCrabRuns();
    setCrabRuns(Array.isArray(runs) ? runs : []);
  }, []);

  const refreshOfficers = useCallback(async () => {
    if (typeof window.api?.officerGetSummary !== "function") {
      throw new Error("Officer summary API is unavailable");
    }
    const summary = await window.api.officerGetSummary();
    setOfficerSummary(summary);
  }, []);

  const refreshFobs = useCallback(async () => {
    if (typeof window.api?.fobGetAnalyticsDashboard !== "function") {
      throw new Error("FOB analytics API is unavailable");
    }
    const result = await window.api.fobGetAnalyticsDashboard({
      startDate: FOB_HISTORY_START,
      endDate: new Date().toISOString(),
      historyDays: 30,
    });
    if (!result?.summary) throw new Error("FOB summary is missing");
    setFobSummary(result.summary);
  }, []);

  const refreshMarketSales = useCallback(async () => {
    try {
      if (typeof window.api?.esiListMarketSales !== "function") {
        throw new Error("Market sales API is unavailable");
      }

      const result = await window.api.esiListMarketSales();

      if (
        !Number.isSafeInteger(result?.linkedCharacterCount) ||
        !Number.isFinite(result.grossSalesValue) ||
        !Array.isArray(result.sales) ||
        !Array.isArray(result.errors)
      ) {
        throw new Error("Market sales data is missing");
      }

      setMarketSales(result);
    } catch (error) {
      setMarketSales(null);
      throw error;
    }
  }, []);

  const refreshLocal = useCallback(() => {
    setDedRuns(loadDEDRuns());
    setEventRuns(loadEventRuns());
    setEventBounties(loadEventBounties());
    setIncursionTicks(loadIncursionTicks());
  }, []);

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    const tasks = [
      ["Abyssals", refreshAbyssals],
      ["CRABs", refreshCrabs],
      ["Officers", refreshOfficers],
      ["FOBs", refreshFobs],
      ["Market Sales", refreshMarketSales],
      ["Local trackers", refreshLocal],
    ];
    const results = await Promise.allSettled(tasks.map(([, run]) => Promise.resolve().then(run)));
    setErrors(results.flatMap((result, index) => result.status === "rejected"
      ? [`${tasks[index][0]}: ${result.reason?.message || "Unable to load data"}`]
      : []));
    setRefreshing(false);
  }, [refreshAbyssals, refreshCrabs, refreshOfficers, refreshFobs, refreshMarketSales, refreshLocal]);

  useEffect(() => {
    refreshAll();
    const onStorage = (event) => {
      if (["ded:runs:v1", "event:runs:v1", "event:bounties:v1", "incursions:ticks:v1"].includes(event.key)) {
        refreshLocal();
      }
    };
    window.addEventListener("storage", onStorage);
    const off = window.api?.on?.("entries-updated", (payload) => {
      if (payload?.table === "abyssals") refreshAbyssals().catch(() => {});
    });
    return () => {
      window.removeEventListener("storage", onStorage);
      if (typeof off === "function") off();
    };
  }, [refreshAll, refreshAbyssals, refreshLocal]);

  const totals = useMemo(() => {
    const abyss = computeAbyssalsTotals(abyssals, glorified);
    const ded = computeDEDTotals(dedRuns);
    const ev = computeEventTotals(eventRuns, eventBounties);
    const inc = computeIncursionTotals(incursionTicks);
    const crab = computeCrabTotals(crabRuns);
    const officers = {
      runs: num(officerSummary?.totalKills),
      totalISK: num(officerSummary?.totalLootValue),
      totalHours: 0,
      iskPerHour: null,
    };
    const fobs = {
      runs: num(fobSummary?.completions?.total),
      payouts: num(fobSummary?.income?.payoutCount),
      totalISK: num(fobSummary?.income?.gross ?? fobSummary?.income?.total),
      totalHours: 0,
      iskPerHour: null,
    };
    const timedISK = abyss.totalISK + ded.totalISK + ev.totalISK + inc.totalISK + crab.totalISK;
    const totalHours = abyss.totalHours + ded.totalHours + ev.totalHours + inc.totalHours + crab.totalHours;
    const totalISK = timedISK + officers.totalISK + fobs.totalISK;
    const iskPerHour = totalHours > 0 ? timedISK / totalHours : 0;
    return { abyss, ded, ev, inc, crab, officers, fobs, totalISK, timedISK, totalHours, iskPerHour };
  }, [abyssals, glorified, dedRuns, eventRuns, eventBounties, incursionTicks, crabRuns, officerSummary, fobSummary]);

  const modules = [
    { label: "Abyssals", route: "/analytics", count: totals.abyss.runs, unit: "runs", ...totals.abyss },
    { label: "DED", route: "/ded-analytics", count: totals.ded.runs, unit: "runs", ...totals.ded },
    { label: "Events", route: "/event-analytics", count: totals.ev.runs, unit: "runs", ...totals.ev },
    { label: "Incursions", route: "/incursions/analytics", count: totals.inc.ticks, unit: "ticks", ...totals.inc },
    { label: "CRABs", route: "/crabs/analytics", count: totals.crab.runs, unit: "runs", ...totals.crab },
    { label: "Officers", route: "/officers/analytics", count: totals.officers.runs, unit: "kills", ...totals.officers },
    { label: "FOBs", route: "/fobs", count: totals.fobs.runs, unit: "confirmed kills", ...totals.fobs },
  ];

  const hasMarketResults = marketSales &&
    marketSales.linkedCharacterCount > marketSales.errors.length;
  const partialMarketResults = hasMarketResults &&
    (marketSales.errors.length > 0 || (marketSales.warnings?.length ?? 0) > 0);

  return (
    <div className="overallPage">
      <div className="overallWrap">
        <div className="overallHeader">
          <h1>Overall Statistics</h1>
          <p>All income tracking combined into one unified overview.</p>
          <div className="overallHeaderNavRow">
            <button type="button" className="overallHeaderNavBtn" onClick={() => navigate("/overall-graphs")}>View Graphs →</button>
          </div>
        </div>

        {errors.length > 0 && (
          <div role="alert" className="overallSection" style={{ border: "1px solid #ef4444", padding: 16, marginBottom: 18 }}>
            <strong>Some tracker data could not be loaded.</strong>
            {errors.map((message) => <div key={message}>{message}</div>)}
          </div>
        )}

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
            <div className="overallMetricLabel">ISK / Hour (Timed Activities)</div>
            <div className="overallMetricValue">{fmtISK(totals.iskPerHour)}</div>
          </div>
          <button type="button" className="overallRefreshBtn" onClick={refreshAll} disabled={refreshing}>
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
          <div className="overallMetric" style={{ gridColumn: "1 / -1" }}>
            <div className="overallMetricLabel">Recent Market Sales</div>
            <div className="overallMetricValue">
              {hasMarketResults ? fmtISK(marketSales.grossSalesValue) : "—"}
            </div>
            <div className="overallMuted">
              {hasMarketResults
                ? `${fmtInt(marketSales.sales.length)} sale transactions · Gross proceeds`
                : refreshing
                  ? "Loading sales..."
                  : marketSales?.linkedCharacterCount === 0
                    ? "No personal or corporation wallets linked."
                    : "Market sales could not be loaded."}
            </div>
            {partialMarketResults && (
              <div className="overallMuted">Partial total. Some wallet data could not be loaded.</div>
            )}
          </div>
        </section>
        <p className="overallMuted" style={{ marginBottom: 20 }}>
          Total ISK includes Officer loot and FOB wallet rewards. Recent Market Sales is shown separately
          to avoid counting tracked loot again when it sells. ISK/hour uses activities with recorded time.
        </p>

        <section className="overallSection">
          <div className="overallSectionHead">
            <h2>Modules</h2>
            <div className="overallMuted">Jump straight into detailed analytics.</div>
          </div>
          <div className="overallModulesGrid">
            {modules.map((module) => (
              <button key={module.label} type="button" className="overallModuleCard" onClick={() => navigate(module.route)}>
                <div className="overallModuleTop"><div className="overallModuleTitle">{module.label}</div></div>
                <div className="overallModuleRow"><span>Total ISK</span><strong>{fmtISK(module.totalISK)}</strong></div>
                <div className="overallModuleRow"><span>{module.label === "FOBs" ? "Confirmed FOBs" : module.label === "Officers" ? "Kills" : module.unit === "ticks" ? "Ticks" : "Runs"}</span><strong>{fmtInt(module.count)}</strong></div>
                {module.label === "FOBs" && <div className="overallModuleRow"><span>Wallet payouts</span><strong>{fmtInt(module.payouts)}</strong></div>}
                <div className="overallModuleRow"><span>ISK / Hour</span><strong>{module.iskPerHour == null ? "N/A" : fmtISK(module.iskPerHour)}</strong></div>
              </button>
            ))}
          </div>
        </section>

        <section className="overallSection">
          <div className="overallSectionHead">
            <h2>Breakdown</h2>
            <div className="overallMuted">Totals by tracker.</div>
          </div>
          <div className="overallTableWrap">
            <table className="overallTable">
              <thead><tr><th>Tracker</th><th>Count</th><th>Total Time</th><th>Total ISK</th><th>ISK / Hour</th></tr></thead>
              <tbody>
                {modules.map((module) => (
                  <tr key={module.label}>
                    <td>{module.label}</td>
                    <td>{fmtInt(module.count)} {module.unit}</td>
                    <td>{module.iskPerHour == null ? "N/A" : fmtHours(module.totalHours)}</td>
                    <td>{fmtISK(module.totalISK)}</td>
                    <td>{module.iskPerHour == null ? "N/A" : fmtISK(module.iskPerHour)}</td>
                  </tr>
                ))}
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
  const baseISK = (entries || []).reduce((sum, entry) => sum + num(entry.room1_isk) + num(entry.room2_isk) + num(entry.room3_isk) - num(entry.fillament_cost), 0);
  const glorifiedISK = (glorified || []).reduce((sum, entry) => sum + num(entry.value_isk || entry.value || entry.isk || 0), 0);
  const totalMinutes = (entries || []).reduce((sum, entry) => sum + num(entry.time_taken), 0);
  const totalHours = totalMinutes / 60;
  const totalISK = baseISK + glorifiedISK;
  return { runs, totalISK, totalHours, iskPerHour: totalHours > 0 ? totalISK / totalHours : 0 };
}

function computeDEDTotals(runs) {
  const count = Array.isArray(runs) ? runs.length : 0;
  const totalISK = (runs || []).reduce((sum, run) => sum + num(run.iskTotal), 0);
  const totalHours = (runs || []).reduce((sum, run) => sum + num(run.clearTimeMinutes), 0) / 60;
  return { runs: count, totalISK, totalHours, iskPerHour: totalHours > 0 ? totalISK / totalHours : 0 };
}

function computeEventTotals(runs, bounties) {
  const count = Array.isArray(runs) ? runs.length : 0;
  const lootISK = (runs || []).reduce((sum, run) => sum + num(run.lootISK), 0);
  const bountyISKFromRuns = (runs || []).reduce((sum, run) => sum + num(run.bountyISK), 0);
  const bountyISKFromTicks = (bounties || []).reduce((sum, tick) => sum + num(tick.tickISK), 0);
  const totalISK = lootISK + bountyISKFromRuns + bountyISKFromTicks;
  const totalHours = (runs || []).reduce((sum, run) => sum + num(run.clearTimeMinutes), 0) / 60;
  return { runs: count, totalISK, totalHours, iskPerHour: totalHours > 0 ? totalISK / totalHours : 0 };
}

function computeIncursionTotals(ticks) {
  const count = Array.isArray(ticks) ? ticks.length : 0;
  const totalISK = (ticks || []).reduce((sum, tick) => sum + num(tick.amountISK), 0);
  const timestamps = (ticks || []).map((tick) => parseWalletTs(tick.timestamp)).filter(Number.isFinite).sort((a, b) => a - b);
  const spanMs = timestamps.length >= 2 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
  const totalHours = spanMs > 0 ? spanMs / 3600000 : 0;
  return { ticks: count, totalISK, totalHours, iskPerHour: totalHours > 0 ? totalISK / totalHours : 0 };
}

function computeCrabTotals(runs) {
  const count = Array.isArray(runs) ? runs.length : 0;
  const totalISK = (runs || []).reduce((sum, run) => sum + num(run.net_profit), 0);
  const totalHours = (runs || []).reduce((sum, run) => sum + num(run.duration_minutes), 0) / 60;
  return { runs: count, totalISK, totalHours, iskPerHour: totalHours > 0 ? totalISK / totalHours : 0 };
}

function parseWalletTs(ts) {
  const s = String(ts || "").trim();
  if (!s) return NaN;
  const isoLike = s.replace(/\./g, "-").replace(" ", "T") + ":00";
  const ms = Date.parse(isoLike);
  return Number.isFinite(ms) ? ms : NaN;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtISK(value) {
  return `${new Intl.NumberFormat("en-GB").format(Math.round(num(value)))} ISK`;
}

function fmtInt(value) {
  return new Intl.NumberFormat("en-GB").format(Math.round(num(value)));
}

function fmtHours(value) {
  const minutes = Math.round(num(value) * 60);
  if (minutes <= 0) return "0h";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours}h${remainder ? ` ${remainder}m` : ""}` : `${remainder}m`;
}