import { useEffect, useRef, useState } from "react";
import "../styles/settings.css";

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

  const [repricing, setRepricing] = useState(false);
  const [repriceError, setRepriceError] = useState("");
  const [repriceSummary, setRepriceSummary] = useState(null);

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
      autoRepriceDEDOnLaunch,
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

  async function handleRepriceAllDED() {
    setRepricing(true);
    setRepriceError("");
    setRepriceSummary(null);

    try {
      const runs = loadDEDRuns();
      if (!runs.length) {
        setRepriceSummary({ updated: 0, failed: 0 });
        return;
      }

      let updated = 0;
      let failed = 0;

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
        } catch {
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
    const ok = confirm("This will permanently delete all DED runs stored locally. Are you sure?");
    if (!ok) return;
    clearDEDRuns();
    alert("All DED runs cleared.");
  }

  return (
    <div className="settingsPage">
      <div className="settingsWrap">
        <div className="settingsHeader">
          <h1>Settings</h1>
          <p>Configure defaults, export data, and manage stored trackers.</p>
        </div>

        <div className="settingsGrid">
          <div className="settingsCard">
            <div className="settingsCardHead">
              <h2>Defaults</h2>
              <div className="settingsPill">Abyssals + Overlay</div>
            </div>

            <div className="settingsForm">
              <label className="settingsToggle">
                <input
                  type="checkbox"
                  checked={showOverlayHelp}
                  onChange={(e) => setShowOverlayHelp(e.target.checked)}
                />
                <span className="settingsToggleText">Show overlay help on launch</span>
              </label>

              <div className="settingsRow">
                <label className="settingsField">
                  <span className="settingsLabel">Default Filament Tier</span>
                  <select
                    className="settingsInput"
                    value={filamentTier}
                    onChange={(e) => setFilamentTier(e.target.value)}
                  >
                    {["T0", "T1", "T2", "T3", "T4", "T5", "T6"].map((tier) => (
                      <option key={tier} value={tier}>
                        {tier}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="settingsField">
                  <span className="settingsLabel">Default Storm Type</span>
                  <select
                    className="settingsInput"
                    value={stormType}
                    onChange={(e) => setStormType(e.target.value)}
                  >
                    {["Firestorm", "Dark", "Gamma", "Electrical", "Exotic"].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="settingsRow">
                <label className="settingsField">
                  <span className="settingsLabel">Default Ship Type</span>
                  <select
                    className="settingsInput"
                    value={shipType}
                    onChange={(e) => setShipType(e.target.value)}
                  >
                    {["Cruiser", "Destroyer", "Frigate"].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="settingsField">
                  <span className="settingsLabel">ISK Display Format</span>
                  <select
                    className="settingsInput"
                    value={iskFormat}
                    onChange={(e) => setIskFormat(e.target.value)}
                  >
                    <option value="1,000,000 ISK">1,000,000 ISK</option>
                    <option value="1.00 M">1.00 M</option>
                    <option value="1.0M">1.0M</option>
                    <option value="1M">1M</option>
                  </select>
                </label>
              </div>

              <label className="settingsToggle">
                <input
                  type="checkbox"
                  checked={autoRepriceDEDOnLaunch}
                  onChange={(e) => setAutoRepriceDEDOnLaunch(e.target.checked)}
                />
                <span className="settingsToggleText">Auto reprice DED runs on launch (Jita)</span>
              </label>

              <div className="settingsActions">
                <button type="button" className="settingsBtn" onClick={saveSettings}>
                  💾 Save Settings
                </button>
                <button type="button" className="settingsBtn ghost" onClick={exportData}>
                  📤 Export All Data
                </button>
              </div>

              {dbSize && <div className="settingsMeta">Database size: {dbSize}</div>}
            </div>
          </div>

          <div className="settingsCard">
            <div className="settingsCardHead">
              <h2>DED Data</h2>
              <div className="settingsPill warn">Jita pricing</div>
            </div>

            <div className="settingsSubtext">
              Jita-only pricing (sell.min). Manage and maintain your DED run data here.
            </div>

            <div className="settingsActions settingsActionsLeft">
              <button
                type="button"
                className="settingsBtn"
                onClick={handleRepriceAllDED}
                disabled={repricing}
              >
                {repricing ? "Repricing…" : "Reprice All DED Runs"}
              </button>

              <button type="button" className="settingsBtn ghost" onClick={handleExportDEDRuns}>
                Export DED Runs
              </button>

              <button
                type="button"
                className="settingsBtn ghost"
                onClick={() => importInputRef.current?.click()}
              >
                Import DED Runs
              </button>

              <input
                ref={importInputRef}
                className="settingsHiddenInput"
                type="file"
                accept="application/json"
                onChange={handleImportDEDRuns}
              />

              <button type="button" className="settingsBtn danger" onClick={confirmClearDEDRuns}>
                Clear DED Runs
              </button>
            </div>

            {repriceError && <div className="settingsNotice error">Repricing failed: {repriceError}</div>}

            {repriceSummary && (
              <div className="settingsNotice ok">
                Reprice complete — Updated: <strong>{repriceSummary.updated}</strong>, Failed:{" "}
                <strong>{repriceSummary.failed}</strong>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
