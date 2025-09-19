// src/pages/settings.jsx
import { useState, useEffect, useRef } from "react";

// DED storage + pricing
import {
  loadRuns as loadDEDRuns,
  updateRun as updateDEDRun,
  exportRunsAsJson as exportDEDRuns,
  importRunsFromFile as importDEDRunsFromFile,
  clearAllRuns as clearDEDRuns,
} from "../lib/dedStorer";
import { priceItemsJita } from "../lib/marketClient";

export default function Settings() {
  const [filamentTier, setFilamentTier] = useState("T3");
  const [stormType, setStormType] = useState("Firestorm");
  const [iskFormat, setIskFormat] = useState("1,000,000 ISK");
  const [shipType, setShipType] = useState("Cruiser");
  const [showOverlayHelp, setShowOverlayHelp] = useState(() => {
    return localStorage.getItem("hideOverlayInfo") !== "true";
  });
  const [autoRepriceDEDOnLaunch, setAutoRepriceDEDOnLaunch] = useState(true);

  const [dbSize, setDbSize] = useState(null);

  // DED admin states
  const [repricing, setRepricing] = useState(false);
  const [repriceError, setRepriceError] = useState("");
  const [repriceSummary, setRepriceSummary] = useState(null); // {updated, failed}
  const importInputRef = useRef(null);

  useEffect(() => {
    window.api.getDbSize?.().then((res) => {
      if (res?.size) {
        const kb = res.size / 1024;
        setDbSize(`${kb.toFixed(1)} KB`);
      }
    });
  }, []);

  useEffect(() => {
    // Load saved settings
    const stored = JSON.parse(localStorage.getItem("settings")) || {};
    if (stored.filamentTier) setFilamentTier(stored.filamentTier);
    if (stored.stormType) setStormType(stored.stormType);
    if (stored.iskFormat) setIskFormat(stored.iskFormat);
    if (stored.shipType) setShipType(stored.shipType);
    if (typeof stored.autoRepriceDEDOnLaunch === "boolean") {
      setAutoRepriceDEDOnLaunch(stored.autoRepriceDEDOnLaunch);
    }
  }, []);

  function saveSettings() {
    const settings = {
      filamentTier,
      stormType,
      iskFormat,
      shipType,
      autoRepriceDEDOnLaunch, // ← NEW
    };
    localStorage.setItem("settings", JSON.stringify(settings));
    sessionStorage.setItem("tier", filamentTier);
    sessionStorage.setItem("stormType", stormType);
    sessionStorage.setItem("shipType", shipType);
    localStorage.setItem("hideOverlayInfo", showOverlayHelp ? "false" : "true");
    alert("Settings saved!");
  }

  function exportData() {
    window.api?.exportAllData?.();
  }

  /* ---------------- DED admin: Reprice / Export / Import / Clear ---------------- */

  async function handleRepriceAllDED() {
    setRepricing(true);
    setRepriceError("");
    setRepriceSummary(null);

    try {
      const runs = loadDEDRuns();
      if (!runs.length) {
        setRepricing(false);
        setRepriceSummary({ updated: 0, failed: 0 });
        return;
      }

      let updated = 0;
      let failed = 0;

      // Reprice sequentially to be gentle. (Could batch if desired.)
      for (const r of runs) {
        try {
          const { items, iskTotal } = await priceItemsJita(r.items || []);
          const patched = updateDEDRun(r.id, {
            items,
            iskTotal,
            repricedAt: new Date().toISOString(),
          });
          if (patched) updated += 1;
          else failed += 1;
        } catch (e) {
          console.warn("Failed to reprice run", r.id, e);
          failed += 1;
        }
      }

      setRepriceSummary({ updated, failed });
    } catch (err) {
      setRepriceError(err?.message || String(err));
    } finally {
      setRepricing(false);
    }
  }

  function handleExportDEDRuns() {
    exportDEDRuns();
  }

  async function handleImportDEDRuns(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await importDEDRunsFromFile(file);
      alert("DED runs imported successfully.");
    } catch (err) {
      alert(`Import failed: ${err?.message || String(err)}`);
    } finally {
      e.target.value = "";
    }
  }

  function confirmClearDEDRuns() {
    const ok = confirm(
      "This will permanently delete all DED runs stored locally. Are you sure?"
    );
    if (!ok) return;
    clearDEDRuns();
    alert("All DED runs cleared.");
  }

  return (
    <div className="settings-container">
      <h2 className="settings-title">Settings</h2>

      <div className="settings-form">
        <div className="settings-field">
          <label>
            <input
              type="checkbox"
              checked={showOverlayHelp}
              onChange={(e) => setShowOverlayHelp(e.target.checked)}
            />
            Show overlay help on launch
          </label>
        </div>

        <div className="settings-field">
          <label>Default Filament Tier:</label>
          <select value={filamentTier} onChange={(e) => setFilamentTier(e.target.value)}>
            {["T0", "T1", "T2", "T3", "T4", "T5", "T6"].map((tier) => (
              <option key={tier} value={tier}>
                {tier}
              </option>
            ))}
          </select>
        </div>

        <div className="settings-field">
          <label>Default Storm Type:</label>
          <select value={stormType} onChange={(e) => setStormType(e.target.value)}>
            {["Firestorm", "Dark", "Gamma", "Electrical", "Exotic"].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        <label>
          Default Ship Type:
          <select value={shipType} onChange={(e) => setShipType(e.target.value)}>
            {["Cruiser", "Destroyer", "Frigate"].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <div className="settings-field">
          <label>ISK Display Format:</label>
          <select value={iskFormat} onChange={(e) => setIskFormat(e.target.value)}>
            <option value="1,000,000 ISK">1,000,000 ISK</option>
            <option value="1.00 M">1.00 M</option>
            <option value="1.0M">1.0M</option>
            <option value="1M">1M</option>
          </select>
        </div>

        <div className="settings-field">
          <label>
            <input
              type="checkbox"
              checked={autoRepriceDEDOnLaunch}
              onChange={(e) => setAutoRepriceDEDOnLaunch(e.target.checked)}
            />
            Auto reprice DED runs on launch (Jita)
          </label>
        </div>
      </div>

      <div className="settings-actions">
        <button onClick={saveSettings}>💾 Save Settings</button>
        <button onClick={exportData}>📤 Export All Data</button>
        {dbSize && (
          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Database Size: {dbSize}
          </p>
        )}
      </div>

      {/* ---------------- DED Data admin ---------------- */}
      <hr style={{ opacity: 0.1, margin: "1.25rem 0" }} />

      <h3 className="settings-subtitle">DED Data</h3>
      <p style={{ color: "#9aa3b2", marginTop: "-0.25rem" }}>
        Jita-only pricing (sell.min). Manage and maintain your DED run data here.
      </p>

      <div className="settings-field" style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={handleRepriceAllDED}
          disabled={repricing}
          className="btn-small"
          title="Re-fetch Jita prices and update stored totals"
        >
          {repricing ? "Repricing…" : "Reprice All DED Runs"}
        </button>

        <button onClick={handleExportDEDRuns} className="btn-small" title="Export DED runs as JSON">
          Export DED Runs
        </button>

        <button
          onClick={() => importInputRef.current?.click()}
          className="btn-small"
          title="Import DED runs from JSON"
        >
          Import DED Runs
        </button>

        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          style={{ display: "none" }}
          onChange={handleImportDEDRuns}
        />

        <button onClick={confirmClearDEDRuns} className="btn-small danger" title="Delete all DED runs">
          Clear DED Runs
        </button>
      </div>

      {repriceError && (
        <div
          style={{
            marginTop: "0.6rem",
            background: "rgba(255,120,120,0.09)",
            border: "1px solid rgba(255,120,120,0.35)",
            color: "#ffc9c9",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            fontSize: "0.9rem",
            maxWidth: 600,
          }}
        >
          Repricing failed: {repriceError}
        </div>
      )}

      {repriceSummary && (
        <div
          style={{
            marginTop: "0.6rem",
            background: "rgba(97,218,251,0.08)",
            border: "1px solid rgba(97,218,251,0.35)",
            color: "#bfefff",
            padding: "0.5rem 0.75rem",
            borderRadius: 8,
            fontSize: "0.9rem",
            maxWidth: 600,
          }}
        >
          Reprice complete — Updated: <strong>{repriceSummary.updated}</strong>
          {", "}Failed: <strong>{repriceSummary.failed}</strong>
        </div>
      )}

      {/* Tiny inline styles for small buttons if not in your global CSS */}
      <style>{`
        .settings-subtitle { margin: 0 0 0.5rem 0; }
        .btn-small {
          padding: 0.35rem 0.6rem;
          border-radius: 6px;
          border: 1px solid rgba(255,255,255,0.18);
          background: #2a2f45;
          color: #e8edf7;
          font-size: 0.85rem;
          cursor: pointer;
        }
        .btn-small:hover { background: #343a56; }
        .btn-small:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-small.danger {
          background: transparent;
          color: #ffb3b3;
          border-color: rgba(255, 99, 99, 0.35);
        }
        .btn-small.danger:hover {
          background: rgba(255, 99, 99, 0.12);
          border-color: rgba(255, 99, 99, 0.55);
        }
      `}</style>
    </div>
  );
}
