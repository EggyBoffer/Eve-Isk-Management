import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/crab-analytics.css";
import { getAllCrabRuns } from "../lib/crabStore";
import {
  summarizeCrabRuns,
  groupCrabsByCharacter,
  groupCrabsByBeaconType,
  groupCrabsByMonth,
  groupCrabLootByItem,
} from "../lib/parsers/features/crabs/crabAnalytics";

function formatISK(n) {
  return `${Math.round(Number(n || 0)).toLocaleString("en-GB")} ISK`;
}

function formatHours(hours) {
  const value = Number(hours || 0);
  if (value <= 0) return "0h";
  if (value < 1) return `${Math.round(value * 60)}m`;
  const whole = Math.floor(value);
  const mins = Math.round((value - whole) * 60);
  return mins > 0 ? `${whole}h ${mins}m` : `${whole}h`;
}

function formatCompact(n) {
  return Math.round(Number(n || 0)).toLocaleString("en-GB");
}

export default function CrabAnalytics() {
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);

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

  const summary = useMemo(() => summarizeCrabRuns(runs), [runs]);
  const byCharacter = useMemo(() => groupCrabsByCharacter(runs), [runs]);
  const byBeaconType = useMemo(() => groupCrabsByBeaconType(runs), [runs]);
  const byMonth = useMemo(() => groupCrabsByMonth(runs), [runs]);
  const topLoot = useMemo(() => groupCrabLootByItem(runs).slice(0, 15), [runs]);

  return (
    <div className="crabAnalyticsPage">
      <div className="crabAnalyticsWrap">
        <div className="crabAnalyticsHeader">
          <h1>CRAB Analytics</h1>
          <p>Breakdown of Crab Beacon history!</p>

          <div className="crabAnalyticsLinkRow">
            <button
              className="crabAnalyticsLinkBtn"
              onClick={() => navigate("/crabs")}
            >
              ← Back to CRAB Tracker
            </button>
            <button
              className="crabAnalyticsLinkBtn"
              onClick={() => navigate("/crabs/graphs")}
            >
              View Graphs →
            </button>
          </div>
        </div>

        <div className="crabAnalyticsSection">
          <div className="crabAnalyticsSectionHead">
            <h2>Totals</h2>
            <div className="crabAnalyticsPill">{summary.runs} runs</div>
          </div>

          <div className="crabAnalyticsMetricsGrid">
            <div className="crabAnalyticsMetric">
              <div className="crabAnalyticsMetricLabel">Net Profit</div>
              <div className="crabAnalyticsMetricValue">{formatISK(summary.netProfit)}</div>
            </div>
            <div className="crabAnalyticsMetric">
              <div className="crabAnalyticsMetricLabel">Gross Income</div>
              <div className="crabAnalyticsMetricValue">{formatISK(summary.grossTotal)}</div>
            </div>
            <div className="crabAnalyticsMetric">
              <div className="crabAnalyticsMetricLabel">Total Bounties</div>
              <div className="crabAnalyticsMetricValue">{formatISK(summary.totalBounties)}</div>
            </div>
            <div className="crabAnalyticsMetric">
              <div className="crabAnalyticsMetricLabel">Total Loot</div>
              <div className="crabAnalyticsMetricValue">{formatISK(summary.totalLoot)}</div>
            </div>
            <div className="crabAnalyticsMetric">
              <div className="crabAnalyticsMetricLabel">Beacon Cost</div>
              <div className="crabAnalyticsMetricValue">{formatISK(summary.totalBeaconCost)}</div>
            </div>
            <div className="crabAnalyticsMetric">
              <div className="crabAnalyticsMetricLabel">ISK / Hour</div>
              <div className="crabAnalyticsMetricValue">{formatISK(summary.iskPerHour)}</div>
            </div>
            <div className="crabAnalyticsMetric">
              <div className="crabAnalyticsMetricLabel">Average Profit / Run</div>
              <div className="crabAnalyticsMetricValue">{formatISK(summary.avgNetProfit)}</div>
            </div>
            <div className="crabAnalyticsMetric">
              <div className="crabAnalyticsMetricLabel">Total Time</div>
              <div className="crabAnalyticsMetricValue">{formatHours(summary.totalHours)}</div>
            </div>
          </div>
        </div>

        <div className="crabAnalyticsSection">
          <div className="crabAnalyticsSectionHead">
            <h2>Income by Character</h2>
            <div className="crabAnalyticsSubtle">{byCharacter.length} character row(s)</div>
          </div>

          <div className="crabAnalyticsTableWrap">
            <table className="crabAnalyticsTable">
              <thead>
                <tr>
                  <th>Character</th>
                  <th>Runs</th>
                  <th>Bounties</th>
                  <th>Loot</th>
                  <th>Beacon Cost</th>
                  <th>Net Profit</th>
                  <th>ISK / Hour</th>
                </tr>
              </thead>
              <tbody>
                {byCharacter.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="crabAnalyticsTableEmpty">
                      No saved CRAB runs yet.
                    </td>
                  </tr>
                ) : (
                  byCharacter.map((row) => (
                    <tr key={row.character}>
                      <td>{row.character}</td>
                      <td>{formatCompact(row.runs)}</td>
                      <td>{formatISK(row.bounties)}</td>
                      <td>{formatISK(row.loot)}</td>
                      <td>{formatISK(row.beaconCost)}</td>
                      <td>{formatISK(row.netProfit)}</td>
                      <td>{formatISK(row.iskPerHour)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="crabAnalyticsTwoCol">
          <div className="crabAnalyticsSection">
            <div className="crabAnalyticsSectionHead">
              <h2>By Beacon Type</h2>
              <div className="crabAnalyticsSubtle">{byBeaconType.length} row(s)</div>
            </div>

            <div className="crabAnalyticsTableWrap">
              <table className="crabAnalyticsTable">
                <thead>
                  <tr>
                    <th>Beacon</th>
                    <th>Runs</th>
                    <th>Net Profit</th>
                    <th>Avg Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {byBeaconType.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="crabAnalyticsTableEmpty">
                        No saved CRAB runs yet.
                      </td>
                    </tr>
                  ) : (
                    byBeaconType.map((row) => (
                      <tr key={row.beaconType}>
                        <td>{row.beaconType}</td>
                        <td>{formatCompact(row.runs)}</td>
                        <td>{formatISK(row.netProfit)}</td>
                        <td>{formatISK(row.avgNetProfit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="crabAnalyticsSection">
            <div className="crabAnalyticsSectionHead">
              <h2>By Month</h2>
              <div className="crabAnalyticsSubtle">{byMonth.length} row(s)</div>
            </div>

            <div className="crabAnalyticsTableWrap">
              <table className="crabAnalyticsTable">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Runs</th>
                    <th>Net Profit</th>
                    <th>ISK / Hour</th>
                  </tr>
                </thead>
                <tbody>
                  {byMonth.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="crabAnalyticsTableEmpty">
                        No saved CRAB runs yet.
                      </td>
                    </tr>
                  ) : (
                    byMonth.map((row) => (
                      <tr key={row.month}>
                        <td>{row.month}</td>
                        <td>{formatCompact(row.runs)}</td>
                        <td>{formatISK(row.netProfit)}</td>
                        <td>{formatISK(row.iskPerHour)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="crabAnalyticsSection">
          <div className="crabAnalyticsSectionHead">
            <h2>Top Loot by Value</h2>
            <div className="crabAnalyticsSubtle">Top 15 item rows by total value</div>
          </div>

          <div className="crabAnalyticsTableWrap">
            <table className="crabAnalyticsTable">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Total Value</th>
                  <th>Avg Unit Price</th>
                </tr>
              </thead>
              <tbody>
                {topLoot.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="crabAnalyticsTableEmpty">
                      No saved CRAB loot yet.
                    </td>
                  </tr>
                ) : (
                  topLoot.map((row) => (
                    <tr key={row.itemName}>
                      <td>{row.itemName}</td>
                      <td>{formatCompact(row.quantity)}</td>
                      <td>{formatISK(row.totalValue)}</td>
                      <td>{formatISK(row.avgUnitPrice)}</td>
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