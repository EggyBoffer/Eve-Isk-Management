import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/incursion.css";

import {
  parseIncursionWalletPaste,
  summarizeIncursionTicks,
} from "../lib/parsers/features/Incursions/incursionParser";
import {
  addIncursionTicks,
  loadIncursionTicks,
} from "../lib/parsers/features/Incursions/incursionStore";

function formatISK(n) {
  return `${Math.round(n || 0).toLocaleString("en-GB")} ISK`;
}

function formatLP(n) {
  return `${Math.round(n || 0).toLocaleString("en-GB")} LP`;
}

export default function IncursionTracker() {
  const [paste, setPaste] = useState("");
  const [storedTicks, setStoredTicks] = useState([]);
  const [importStatus, setImportStatus] = useState(null);

  const navigate = useNavigate();

  useEffect(() => {
    setStoredTicks(loadIncursionTicks());

    const onStorage = (e) => {
      if (e.key === "incursions:ticks:v1") setStoredTicks(loadIncursionTicks());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const summary = useMemo(
    () => summarizeIncursionTicks(storedTicks),
    [storedTicks]
  );

  const last10 = useMemo(
    () => storedTicks.slice(-10).reverse(),
    [storedTicks]
  );

  const handleAddTicks = () => {
    setImportStatus(null);

    const parsed = parseIncursionWalletPaste(paste);
    if (!parsed.length) {
      setImportStatus({
        added: 0,
        skipped: 0,
        total: storedTicks.length,
        error: "No incursion ticks found in pasted text.",
      });
      return;
    }

    const res = addIncursionTicks(parsed);
    setStoredTicks(loadIncursionTicks());
    setImportStatus({ ...res, error: "" });
    setPaste("");
  };

  const statusClass =
    "incursionImportStatus" +
    (importStatus?.error ? " incursionImportStatus--error" : "");

  return (
    <div className="incursionPage">
      <div className="incursionBackdrop" aria-hidden="true" />

      <div className="incursionWrap">
        <div className="incursionHeader">
          <h1>Incursion Tracker</h1>
          <p>Track your Incursion Income! Paste your wallet contents in by character.</p>
        </div>

        <div className="incursionTwoCol">
          <div className="incursionPanel">
            <div className="incursionPanelHead">
              <h2>Wallet Log</h2>
              <button
                type="button"
                className="incursionLinkBtn"
                onClick={() => navigate("/incursions/analytics")}
              >
                View Analytics →
              </button>
            </div>

            <textarea
              className="incursionTextarea"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              spellCheck={false}
              placeholder="Paste wallet log lines here..."
            />

            <div className="incursionInputRow">
              <button className="incursionBtn ghost" onClick={() => setPaste("")}>
                Clear Paste
              </button>
              <button className="incursionBtn" onClick={handleAddTicks}>
                Add Ticks
              </button>
            </div>

            {importStatus && (
              <div className={statusClass}>
                {importStatus.error ? (
                  <div className="incursionError">{importStatus.error}</div>
                ) : (
                  <div className="incursionOk">
                    Added {importStatus.added}, skipped {importStatus.skipped} duplicate
                    {importStatus.skipped === 1 ? "" : "s"}. Total saved:{" "}
                    {importStatus.total}.
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="incursionPanel">
            <div className="incursionPanelHead">
              <h2>Summary</h2>
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
                  {new Set(storedTicks.map((t) => t.character || "Unknown")).size}
                </div>
              </div>
            </div>

            <div className="incursionLinkRow">
              <button
                className="incursionLinkBtn"
                onClick={() => navigate("/incursions/analytics")}
              >
                View Incursion Analytics →
              </button>
            </div>
          </div>
        </div>

        <div className="incursionPanel incursionPanelSpacer">
          <div className="incursionPanelHead">
            <h2>Latest 10 Ticks</h2>
            {storedTicks.length > 10 && (
              <div className="incursionSubtle">
                Showing latest 10 of {storedTicks.length}.
              </div>
            )}
          </div>

          {storedTicks.length === 0 ? (
            <div className="incursionEmpty">
              No saved ticks yet. Paste wallet logs and click “Add Ticks”.
            </div>
          ) : (
            <div className="incursionTableWrap">
              <table className="incursionTable">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Character</th>
                    <th>ISK</th>
                    <th>LP</th>
                  </tr>
                </thead>
                <tbody>
                  {last10.map((t) => (
                    <tr key={`${t.timestamp}-${t.amountISK}-${t.character || "?"}`}>
                      <td>{t.timestamp}</td>
                      <td>{t.character || "Unknown"}</td>
                      <td>{formatISK(t.amountISK)}</td>
                      <td>{t.amountLP ? formatLP(t.amountLP) : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
