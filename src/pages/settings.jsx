
import { useEffect, useRef, useState } from "react";
import { Info, ShieldCheck } from "lucide-react";
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

  const [overlayHotkey, setOverlayHotkey] = useState("Control+Shift+F12");
  const [hotkeyError, setHotkeyError] = useState("");

  const [dbSize, setDbSize] = useState(null);

  const [repricing, setRepricing] = useState(false);
  const [repriceError, setRepriceError] = useState("");
  const [repriceSummary, setRepriceSummary] = useState(null);

  const [telemetryEnabled, setTelemetryEnabled] = useState(false);
  const [telemetryLoading, setTelemetryLoading] = useState(true);
  const [telemetrySaving, setTelemetrySaving] = useState(false);
  const [telemetryError, setTelemetryError] = useState("");
  const [telemetryTooltipOpen, setTelemetryTooltipOpen] = useState(false);

  const importInputRef = useRef(null);
  const telemetryTooltipRef = useRef(null);

  useEffect(() => {
    window.api.getDbSize?.().then((res) => {
      if (res?.size) {
        const kb = res.size / 1024;
        setDbSize(`${kb.toFixed(1)} KB`);
      }
    });
  }, []);

  useEffect(() => {
    window.api.getAppSettings().then((stored) => {
      if (typeof stored?.overlayCloseHotkey === "string") {
        setOverlayHotkey(stored.overlayCloseHotkey);
      }
    }).catch(() => setHotkeyError("Unable to load overlay hotkey."));
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

  useEffect(() => {
    let cancelled = false;

    async function loadTelemetrySettings() {
      try {
        const status = await window.api.telemetryGetStatus();

        if (!cancelled) {
          setTelemetryEnabled(status?.enabled === true);
          setTelemetryError("");
        }
      } catch {
        if (!cancelled) {
          setTelemetryError(
            "Unable to load usage statistics preferences."
          );
        }
      } finally {
        if (!cancelled) {
          setTelemetryLoading(false);
        }
      }
    }

    void loadTelemetrySettings();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!telemetryTooltipOpen) {
      return;
    }

    function handleOutsideClick(event) {
      if (
        telemetryTooltipRef.current &&
        !telemetryTooltipRef.current.contains(event.target)
      ) {
        setTelemetryTooltipOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setTelemetryTooltipOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [telemetryTooltipOpen]);

  async function changeTelemetryEnabled(enabled) {
    if (telemetrySaving || telemetryLoading) {
      return;
    }

    setTelemetrySaving(true);
    setTelemetryError("");

    try {
      const status = await window.api.telemetrySetEnabled(enabled);
      setTelemetryEnabled(status?.enabled === true);
    } catch {
      setTelemetryError(
        "Unable to save your usage statistics preference."
      );
    } finally {
      setTelemetrySaving(false);
    }
  }

  async function saveSettings() {
    setHotkeyError("");
    const modifiers = overlayHotkey.split("+").slice(0, -1);
    if (!modifiers.length) {
      setHotkeyError("Select at least one modifier.");
      return;
    }

    try {
      const result = await window.api.saveAppSettings({ overlayCloseHotkey: overlayHotkey });
      if (!result?.success) {
        setHotkeyError(result?.error || "Unable to save overlay hotkey.");
        return;
      }
    } catch (err) {
      setHotkeyError(err?.message || "Unable to save overlay hotkey.");
      return;
    }

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

              <div className="settingsField">
                <span className="settingsLabel">Close Overlay Hotkey (Global)</span>
                <div className="settingsRow">
                  {[
                    ["Control", "Ctrl"],
                    ["Shift", "Shift"],
                    ["Alt", "Alt"],
                  ].map(([modifier, label]) => (
                    <label className="settingsToggle" key={modifier}>
                      <input
                        type="checkbox"
                        checked={overlayHotkey.split("+").includes(modifier)}
                        onChange={(e) => {
                          const parts = overlayHotkey.split("+");
                          const key = parts.at(-1);
                          const selected = new Set(parts.slice(0, -1));
                          if (e.target.checked) selected.add(modifier);
                          else selected.delete(modifier);
                          const ordered = ["Control", "Shift", "Alt"].filter((item) => selected.has(item));
                          setOverlayHotkey([...ordered, key].join("+"));
                        }}
                      />
                      <span className="settingsToggleText">{label}</span>
                    </label>
                  ))}
                  <label className="settingsField">
                    <span className="settingsLabel">Key</span>
                    <select
                      className="settingsInput"
                      value={overlayHotkey.split("+").at(-1)}
                      onChange={(e) => {
                        const modifiers = overlayHotkey.split("+").slice(0, -1);
                        setOverlayHotkey([...modifiers, e.target.value].join("+"));
                      }}
                    >
                      {Array.from({ length: 12 }, (_, i) => `F${i + 1}`).map((key) => (
                        <option key={key} value={key}>{key}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="settingsMeta">Current selection: {overlayHotkey}</div>
                {hotkeyError && <div className="settingsNotice error">{hotkeyError}</div>}
                <button
                  type="button"
                  className="settingsBtn ghost"
                  onClick={() => setOverlayHotkey("Control+Shift+F12")}
                >
                  Reset Hotkey to Default
                </button>
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

          <div className="settingsCard">
            <div className="settingsCardHead">
              <h2>Privacy &amp; Usage Analytics</h2>
              <ShieldCheck size={20} color="#7dd3fc" aria-hidden="true" />
            </div>

            <div className="settingsSubtext">
              Control whether ISKONOMY shares basic usage statistics.
              This preference is saved automatically.
            </div>

            <div className="settingsForm">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                  flexWrap: "wrap",
                }}
              >
                <label
                  className="settingsToggle"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flex: "1 1 240px",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={telemetryEnabled}
                    disabled={telemetryLoading || telemetrySaving}
                    onChange={(e) =>
                      changeTelemetryEnabled(e.target.checked)
                    }
                  />
                  <span className="settingsToggleText">
                    Share anonymous usage statistics
                  </span>
                </label>

                <div
                  ref={telemetryTooltipRef}
                  style={{
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                  }}
                  onMouseEnter={() => setTelemetryTooltipOpen(true)}
                  onMouseLeave={() => setTelemetryTooltipOpen(false)}
                >
                  <button
                    type="button"
                    aria-label="What usage statistics are collected?"
                    aria-expanded={telemetryTooltipOpen}
                    onClick={() =>
                      setTelemetryTooltipOpen((open) => !open)
                    }
                    onFocus={() => setTelemetryTooltipOpen(true)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: 5,
                      background: "transparent",
                      border: "none",
                      color: "#7dd3fc",
                      cursor: "pointer",
                    }}
                  >
                    <Info size={19} />
                  </button>

                  {telemetryTooltipOpen && (
                    <div
                      role="tooltip"
                      style={{
                        position: "absolute",
                        right: 0,
                        bottom: "calc(100% + 10px)",
                        width: "min(310px, 75vw)",
                        zIndex: 50,
                        padding: 14,
                        borderRadius: 10,
                        background: "#172436",
                        border: "1px solid #40516a",
                        boxShadow: "0 12px 30px rgba(0, 0, 0, 0.4)",
                        color: "#e2e8f0",
                        fontSize: 13,
                        lineHeight: 1.6,
                      }}
                    >
                      <strong>What does ISKONOMY collect?</strong>

                      <p style={{ margin: "8px 0" }}>
                        A randomly generated installation ID and the
                        time the application launches.
                      </p>

                      <p style={{ margin: "8px 0" }}>
                        No character names, wallet information, ESI
                        tokens, operating system details or error
                        reports are collected.
                      </p>

                      <p style={{ margin: "8px 0 0" }}>
                        Turning this off stops future telemetry.
                        Previously collected statistics are not
                        automatically deleted.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="settingsMeta">
                {telemetryLoading
                  ? "Loading privacy preference..."
                  : telemetrySaving
                    ? "Saving privacy preference..."
                    : telemetryEnabled
                      ? "Usage statistics are enabled."
                      : "Usage statistics are disabled."}
              </div>

              {telemetryError && (
                <div className="settingsNotice error" role="alert">
                  {telemetryError}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
