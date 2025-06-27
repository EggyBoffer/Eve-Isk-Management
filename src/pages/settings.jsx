import { useState, useEffect } from "react";

export default function Settings() {
  const [filamentTier, setFilamentTier] = useState("T3");
  const [stormType, setStormType] = useState("Firestorm");
  const [iskFormat, setIskFormat] = useState("1,000,000 ISK");
  const [showOverlayHelp, setShowOverlayHelp] = useState(() => {
    return localStorage.getItem("hideOverlayInfo") !== "true";
  });

  useEffect(() => {
    // Load saved settings
    const stored = JSON.parse(localStorage.getItem("settings")) || {};
    if (stored.filamentTier) setFilamentTier(stored.filamentTier);
    if (stored.stormType) setStormType(stored.stormType);
    if (stored.iskFormat) setIskFormat(stored.iskFormat);
  }, []);

  function saveSettings() {
    const settings = {
      filamentTier,
      stormType,
      iskFormat,
    };
    localStorage.setItem("settings", JSON.stringify(settings));
    localStorage.setItem("hideOverlayInfo", showOverlayHelp ? "false" : "true");
    alert("Settings saved!");
  }

  function exportData() {
    window.api?.exportAllData?.();
  }

  return (
    <div className="settings-page">
      <h2>Settings</h2>

      <div className="settings-grid">
        <label>
          <input
            type="checkbox"
            checked={showOverlayHelp}
            onChange={(e) => setShowOverlayHelp(e.target.checked)}
          />
          Show overlay help on launch
        </label>

        <label>
          Default Filament Tier:
          <select value={filamentTier} onChange={(e) => setFilamentTier(e.target.value)}>
            {["T0", "T1", "T2", "T3", "T4", "T5", "T6"].map((tier) => (
              <option key={tier} value={tier}>{tier}</option>
            ))}
          </select>
        </label>

        <label>
          Default Storm Type:
          <select value={stormType} onChange={(e) => setStormType(e.target.value)}>
            {["Firestorm", "Dark", "Gamma", "Electrical", "Exotic"].map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>

        <label>
          ISK Display Format:
          <select value={iskFormat} onChange={(e) => setIskFormat(e.target.value)}>
            <option value="1,000,000 ISK">1,000,000 ISK</option>
            <option value="1.00 M">1.00 M</option>
            <option value="1.0M">1.0M</option>
            <option value="1M">1M</option>
          </select>
        </label>
      </div>

      <div className="settings-buttons">
        <button onClick={saveSettings}>💾 Save Settings</button>
        <button onClick={exportData}>📤 Export All Data</button>
      </div>
    </div>
  );
}
