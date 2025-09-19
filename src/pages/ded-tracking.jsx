// src/pages/ded-tracking.jsx
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ded-tracking.css";
import {
  loadRuns,
  addRun,
  deleteRun,
  exportRunsAsJson,
  importRunsFromFile,
} from "../lib/dedStorer";
import { parseCargo } from "../lib/cargoParser";
import { priceItemsJita } from "../lib/marketClient";

export default function DEDTracking() {
  const [dedLevel, setDedLevel] = useState("4/10");
  const [clearTime, setClearTime] = useState("");
  const [cargoText, setCargoText] = useState("");
  const [runs, setRuns] = useState([]);
  const [fabOpen, setFabOpen] = useState(false);
  const [preview, setPreview] = useState({ items: [], unknownLines: [] });
  const [pricing, setPricing] = useState({ isLoading: false, error: "" });

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    setRuns(loadRuns());
    const onStorage = (e) => {
      if (e.key === "ded:runs:v1") setRuns(loadRuns());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setPricing({ isLoading: true, error: "" });

    try {
      const minutes = clearTime === "" ? null : Number(clearTime);
      const { items: parsedItems, unknownLines } = parseCargo(cargoText);

      const { items: pricedItems, iskTotal } = await priceItemsJita(parsedItems);

      if (unknownLines.length) {
        console.warn("Unparsed cargo lines:", unknownLines);
      }

      const entry = addRun({
        dedLevel,
        clearTimeMinutes: Number.isFinite(minutes) ? minutes : 0,
        cargoText: cargoText.trim(),
        items: pricedItems,
        iskTotal,
        meta: { regionId: 10000002, pricingStrategy: "sell.min" }, // Jita
      });

      setRuns(prev => [entry, ...prev]);
      setClearTime("");
      setCargoText("");
      setPreview({ items: [], unknownLines: [] });
      setPricing({ isLoading: false, error: "" });
    } catch (err) {
      setPricing({ isLoading: false, error: err?.message || String(err) });
    }
  };

  const handleReset = () => {
    setDedLevel("4/10");
    setClearTime("");
    setCargoText("");
    setPreview({ items: [], unknownLines: [] });
  };

  const handleDelete = (id) => {
    deleteRun(id);
    setRuns(loadRuns());
  };

  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const merged = await importRunsFromFile(file);
      setRuns(merged);
    } catch (err) {
      alert(`Import failed: ${err.message || err}`);
    } finally {
      e.target.value = "";
    }
  };

  const shownRuns = runs.slice(0, 5);
  const showingCount = shownRuns.length;
  const totalCount = runs.length;

  return (
    <div className="ded-tracking-page">
      {/* hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleImportChange}
      />

      <div className="ded-header">
        <h1>DED Tracking</h1>
        <p>Log, persist, and analyze your DED site runs.</p>
      </div>

      <div className="ded-card">
        <div className="ded-card-title-row">
          <h2 className="ded-card-title">Log a DED Run</h2>
          {pricing.isLoading && <span className="ded-badge">Pricing items…</span>}
        </div>

        <form className="ded-form" onSubmit={handleSubmit}>
          <div className="ded-form-row">
            <label className="ded-label">
              <span>DED Rating</span>
              <select
                className="ded-input"
                value={dedLevel}
                onChange={(e) => setDedLevel(e.target.value)}
              >
                {["1/10","2/10","3/10","4/10","5/10","6/10","7/10","8/10","9/10","10/10"]
                  .map((lvl) => <option key={lvl} value={lvl}>{lvl}</option>)}
              </select>
            </label>

            <label className="ded-label">
              <span>Clear Time (minutes)</span>
              <input
                className="ded-input"
                type="number"
                min="0"
                step="1"
                value={clearTime}
                onChange={(e) => setClearTime(e.target.value)}
                placeholder="e.g. 12"
                required
              />
            </label>
          </div>

          <label className="ded-label">
            <span>Cargo Contents (paste from EVE)</span>
            <textarea
              className="ded-input"
              value={cargoText}
              onChange={(e) => {
                const v = e.target.value;
                setCargoText(v);
                setPreview(parseCargo(v));
              }}
              placeholder="Paste cargo here..."
              rows={10}
              required
            />
            <small className="ded-help">
              Tip: Copy from your Cargo window in EVE (Ctrl+A → Ctrl+C) and paste here.
            </small>
          </label>

          {/* Preview parsed cargo */}
          {preview.items.length > 0 && (
            <div className="ded-preview">
              <div className="ded-preview-row">
                <strong>Parsed items:</strong>
                <span>{preview.items.reduce((s, it) => s + it.qty, 0)} total units</span>
              </div>
              <ul className="ded-preview-list">
                {preview.items.map((it) => (
                  <li key={it.name}>
                    {it.name} — <strong>{it.qty}</strong>
                  </li>
                ))}
              </ul>
              {preview.unknownLines.length > 0 && (
                <div className="ded-preview-unknown">
                  Couldn’t parse {preview.unknownLines.length} line(s):
                  <pre>{preview.unknownLines.join("\n")}</pre>
                </div>
              )}
            </div>
          )}

          <div className="ded-actions">
            <button type="button" className="btn-secondary" onClick={handleReset} disabled={pricing.isLoading}>
              Reset
            </button>
            <button type="submit" className="btn-primary" disabled={pricing.isLoading}>
              {pricing.isLoading ? "Saving…" : "Save Run"}
            </button>
          </div>

          {pricing.error && <div className="ded-error">Pricing failed: {pricing.error}</div>}
        </form>
      </div>

      <div className="ded-run-list">
        {totalCount === 0 ? (
          <em>No runs logged yet — save your first run to populate this list.</em>
        ) : (
          <>
            <table className="ded-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>DED</th>
                  <th>Time (min)</th>
                  <th>Items</th>
                  <th>ISK Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shownRuns.map(run => (
                  <tr key={run.id}>
                    <td>{new Date(run.createdAt).toLocaleString()}</td>
                    <td>{run.dedLevel}</td>
                    <td>{run.clearTimeMinutes}</td>
                    <td>{run.items?.length ?? 0}</td>
                    <td>{formatISK(run.iskTotal || 0)}</td>
                    <td>
                      <button className="btn-danger" onClick={() => handleDelete(run.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ded-run-footer">
              <span className="ded-muted">
                Showing {showingCount} of {totalCount} run{totalCount === 1 ? "" : "s"}
              </span>
              <button
                className="btn-analytics-link"
                onClick={() => navigate("/ded-analytics")}
              >
                View Analytics →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Floating settings cog */}
      <div className="ded-fab">
        <button
          aria-label="DED settings"
          className="ded-fab-button"
          onClick={() => setFabOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" stroke="currentColor" strokeWidth="1.6"/>
            <path d="M19.4 13.5a7.6 7.6 0 0 0 .05-3l1.68-1.22-1.9-3.29-1.98.58a7.63 7.63 0 0 0-2.6-1.5l-.4-2.03H9.75l-.4 2.03a7.63 7.63 0 0 0-2.6 1.5l-1.98-.58L2.87 9.3 4.55 10.5a7.6 7.6 0 0 0 0 3l-1.68 1.22 1.9 3.29 1.98-.58a7.63 7.63 0 0 0 2.6 1.5l.4 2.03h3.12l.4-2.03a7.63 7.63 0 0 0 2.6-1.5l1.98.58 1.9-3.29L19.4 13.5Z" stroke="currentColor" strokeWidth="1.6"/>
          </svg>
        </button>

        {fabOpen && (
          <>
            <div className="ded-fab-menu">
              <button onClick={exportRunsAsJson}>Export runs (.json)</button>
              <button onClick={handleImportClick}>Import runs (.json)</button>
            </div>
            <div className="ded-fab-backdrop" onClick={() => setFabOpen(false)} />
          </>
        )}
      </div>
    </div>
  );
}

function formatISK(v) {
  try { return `${new Intl.NumberFormat().format(Math.round(v))} ISK`; }
  catch { return `${Math.round(v)} ISK`; }
}
