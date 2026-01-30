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

        <div className="incursionPanel incursionPanelSpacer">
          <div className="incursionPanelHead">
            <h2>Income by Character</h2>
            <div className="incursionSubtle">{byChar.length} character row(s)</div>
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
            <div className="incursionSubtle">{byMonth.length} month row(s)</div>
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
      </div>
    </div>
  );
}
