import { useState, useEffect } from "react";

export default function Settings() {
  const [filamentTier, setFilamentTier] = useState("T3");
  const [stormType, setStormType] = useState("Firestorm");
  const [iskFormat, setIskFormat] = useState("1,000,000 ISK");
  const [shipType, setShipType] = useState("Cruiser");
  const [showOverlayHelp, setShowOverlayHelp] = useState(() => {
    return localStorage.getItem("hideOverlayInfo") !== "true";
  });

  const [dbSize, setDbSize] = useState(null);

  useEffect(() => {
    window.api.getDbSize?.().then(res => {
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

  }, []);

  function saveSettings() {
  const settings = {
    filamentTier,
    stormType,
    iskFormat,
    shipType,
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
          <option key={tier} value={tier}>{tier}</option>
        ))}
      </select>
    </div>

    <div className="settings-field">
      <label>Default Storm Type:</label>
      <select value={stormType} onChange={(e) => setStormType(e.target.value)}>
        {["Firestorm", "Dark", "Gamma", "Electrical", "Exotic"].map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
    </div>

    <label>
    Default Ship Type:
    <select value={shipType} onChange={(e) => setShipType(e.target.value)}>
      {["Cruiser", "Destroyer", "Frigate"].map((type) => (
        <option key={type} value={type}>{type}</option>
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
  </div>

  <div className="settings-actions">
    <button onClick={saveSettings}>💾 Save Settings</button>
    <button onClick={exportData}>📤 Export All Data</button>
    {dbSize && <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>Database Size: {dbSize}</p>}

  </div>
</div>

  );
}
