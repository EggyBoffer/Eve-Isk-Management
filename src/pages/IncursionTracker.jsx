import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/incursion.css";

import incursionBg from "../assets/incursionbackdrop.webp";

import {
  parseIncursionWalletPaste,
  summarizeIncursionTicks,
} from "../lib/parsers/features/Incursions/incursionParser";
import {
  addIncursionTicks,
  loadIncursionTicks,
} from "../lib/parsers/features/Incursions/incursionStore";

function formatISK(n) {
  return `${Math.round(n).toLocaleString("en-GB")} ISK`;
}

function formatLP(n) {
  return `${Math.round(n).toLocaleString("en-GB")} LP`;
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

  return (
    <div className="incursionPage">
      <div
        className="incursionBackdrop"
        style={{ backgroundImage: `url(${incursionBg})` }}
        aria-hidden="true"
      />

      <div className="incursionHeader">
        <h1>Incursion Tracker</h1>
        <p>Track your Incursion Income! Paste your wallet contents in by character.</p>
      </div>

      <div className="incursionTwoCol">
        <div className="incursionPanel">
          <h2>Wallet Log:</h2>

          <textarea
            className="incursionTextarea"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            spellCheck={false}
            placeholder="Paste wallet log lines here..."
          />

          <div className="incursionInputRow">
            <button className="incursionBtn" onClick={() => setPaste("")}>
              Clear Paste
            </button>
            <button className="incursionBtn" onClick={handleAddTicks}>
              Add Ticks
            </button>
          </div>

          {importStatus && (
            <div style={{ marginTop: 10, opacity: importStatus.error ? 1 : 0.9 }}>
              {importStatus.error ? (
                <div className="ded-error">{importStatus.error}</div>
              ) : (
                <div className="ded-preview">
                  Added {importStatus.added}, skipped {importStatus.skipped} duplicate
                  {importStatus.skipped === 1 ? "" : "s"}. Total saved:{" "}
                  {importStatus.total}.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="incursionPanel">
          <h2>Summary</h2>

          <div className="incursionSummaryGrid">
            <div className="incursionSummaryBlock">
              <div className="incursionSummaryLabel">Total ISK</div>
              <div className="incursionSummaryValue">
                {formatISK(summary.totalISK)}
              </div>
            </div>

            <div className="incursionSummaryBlock">
              <div className="incursionSummaryLabel">Total LP</div>
              <div className="incursionSummaryValue">
                {formatLP(summary.totalLP)}
              </div>
            </div>

            <div className="incursionSummaryBlock">
              <div className="incursionSummaryLabel">Ticks</div>
              <div className="incursionSummaryValue">{summary.ticks}</div>
            </div>

            <div className="incursionSummaryBlock">
              <div className="incursionSummaryLabel">Unknown LP ticks</div>
              <div className="incursionSummaryValue">
                {summary.unknownLPCount}
              </div>
            </div>

            <div className="incursionSummaryBlock">
              <div className="incursionSummaryLabel">ISK / hour</div>
              <div className="incursionSummaryValue">
                {summary.iskPerHour ? formatISK(summary.iskPerHour) : "-"}
              </div>
            </div>

            <div className="incursionSummaryBlock">
              <div className="incursionSummaryLabel">LP / hour</div>
              <div className="incursionSummaryValue">
                {summary.lpPerHour ? formatLP(summary.lpPerHour) : "-"}
              </div>
            </div>
          </div>

          <div className="incursionLinkRow">
            <button
              className="btn-analytics-link"
              onClick={() => navigate("/incursions/analytics")}
            >
              View Incursion Analytics →
            </button>
          </div>
        </div>
      </div>

      <div className="incursionPanel incursionPanelSpacer">
        <h2>Latest 10 Ticks</h2>

        {storedTicks.length === 0 ? (
          <div className="muted">
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
                  <th>Match</th>
                </tr>
              </thead>
              <tbody>
                {last10.map((t) => (
                  <tr
                    key={`${t.timestamp}-${t.amountISK}-${t.character || "?"}`}
                    className={t.lpConfidence === "unknown" ? "incursionRowUnknown" : ""}
                  >
                    <td>{t.timestamp}</td>
                    <td>{t.character || "Unknown"}</td>
                    <td>{formatISK(t.amountISK)}</td>
                    <td>{formatLP(t.lp)}</td>
                    <td>
                      {t.lpConfidence}
                      {t.lpLabel ? ` (${t.lpLabel})` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {storedTicks.length > 10 && (
          <div style={{ marginTop: 8, opacity: 0.7 }}>
            Showing latest 10 of {storedTicks.length}.
          </div>
        )}
      </div>
    </div>
  );
}
