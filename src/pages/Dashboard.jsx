import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import pkg from "../../package.json";

export default function Dashboard() {
  const navigate = useNavigate();

  const [showFilamentPrompt, setShowFilamentPrompt] = useState(false);
  const storedSettings = JSON.parse(localStorage.getItem("settings")) || {};

  const [tier, setTier] = useState(() =>
    storedSettings.filamentTier || sessionStorage.getItem("tier") || "T3"
  );

  const [stormType, setStormType] = useState(() =>
    storedSettings.stormType || sessionStorage.getItem("stormType") || "Firestorm"
  );

  const [shipType, setShipType] = useState(() =>
    storedSettings.shipType || sessionStorage.getItem("shipType") || "Cruiser"
  );

  const [latestVersion, setLatestVersion] = useState(null);
  const [updateUrl, setUpdateUrl] = useState(null);
  const [versionStatus, setVersionStatus] = useState("checking");

  const SHIP_MULTIPLIER = {
    Cruiser: 1,
    Destroyer: 2,
    Frigate: 3,
  };

  const getFilamentTypeId = (tier, storm) => {
    const FILAMENT_TYPES = {
      T0: { Firestorm: 56134, Dark: 56132, Gamma: 56136, Electrical: 56131, Exotic: 56133 },
      T1: { Firestorm: 47763, Dark: 47762, Gamma: 47764, Electrical: 47765, Exotic: 47761 },
      T2: { Firestorm: 47896, Dark: 47892, Gamma: 47900, Electrical: 47904, Exotic: 47888 },
      T3: { Firestorm: 47897, Dark: 47893, Gamma: 47901, Electrical: 47905, Exotic: 47889 },
      T4: { Firestorm: 47898, Dark: 47894, Gamma: 47902, Electrical: 47906, Exotic: 47890 },
      T5: { Firestorm: 47899, Dark: 47895, Gamma: 47903, Electrical: 47907, Exotic: 47891 },
      T6: { Firestorm: 56142, Dark: 56140, Gamma: 56143, Electrical: 56139, Exotic: 56141 },
    };
    return FILAMENT_TYPES[tier]?.[storm] || 0;
  };

  function isNewerVersion(current, latest) {
    const c = current.split(".").map(Number);
    const l = latest.split(".").map(Number);
    for (let i = 0; i < l.length; i++) {
      if ((l[i] || 0) > (c[i] || 0)) return true;
      if ((l[i] || 0) < (c[i] || 0)) return false;
    }
    return false;
  }

  useEffect(() => {
    fetch("https://api.github.com/repos/EggyBoffer/Eve-Isk-Management/releases/latest")
      .then((res) => res.json())
      .then((data) => {
        const tag = data.tag_name?.replace(/^v/, "");
        if (!tag) throw new Error("No tag found");
        if (isNewerVersion(pkg.version, tag)) {
          setLatestVersion(tag);
          setUpdateUrl(data.html_url);
          setVersionStatus("outdated");
        } else {
          setVersionStatus("latest");
        }
      })
      .catch((err) => {
        console.error("Version check failed:", err);
        setVersionStatus("error");
      });
  }, []);

  function openOverlayWithSettings() {
    sessionStorage.setItem("tier", tier);
    sessionStorage.setItem("stormType", stormType);
    sessionStorage.setItem("shipType", shipType);

    const filamentId = getFilamentTypeId(tier, stormType);
    const multiplier = SHIP_MULTIPLIER[shipType] || 1;

    fetch(
      `https://esi.evetech.net/latest/markets/10000002/orders/?type_id=${filamentId}`
    )
      .then((res) => res.json())
      .then((data) => {
        const sellOrders = data.filter((order) => !order.is_buy_order);
        const lowestSell = sellOrders.sort((a, b) => a.price - b.price)[0];
        const filamentPrice = Math.round((lowestSell?.price || 0) * multiplier);

        sessionStorage.setItem("filamentPrice", filamentPrice);
        window.api.openOverlayWithCost(filamentPrice, shipType, tier, stormType);
        setShowFilamentPrompt(false);
      })
      .catch(() => {
        sessionStorage.setItem("filamentPrice", "0");
        window.api.openOverlay();
        setShowFilamentPrompt(false);
      });
  }

  return (
    <div className="dashboard-container">
      {latestVersion && updateUrl && (
        <div className="update-banner" style={{ padding: "0.5rem", background: "#fffae5" }}>
          🎉 New version {latestVersion} available!{" "}
          <a href={updateUrl} target="_blank" rel="noopener noreferrer">
            Download here
          </a>
        </div>
      )}

      <button className="overlay-launch-btn" onClick={() => setShowFilamentPrompt(true)}>
        🚀 Overlay
      </button>

      {showFilamentPrompt && (
        <div className="filament-prompt-modal">
          <h2>Select Filament</h2>
          <label>
            Tier:
            <select value={tier} onChange={(e) => setTier(e.target.value)}>
              {["T0", "T1", "T2", "T3", "T4", "T5", "T6"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
          <label>
            Storm Type:
            <select value={stormType} onChange={(e) => setStormType(e.target.value)}>
              {["Firestorm", "Dark", "Gamma", "Electrical", "Exotic"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Ship Type:
            <select value={shipType} onChange={(e) => setShipType(e.target.value)}>
              {["Cruiser", "Destroyer", "Frigate"].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
          <button onClick={openOverlayWithSettings}>Open Overlay</button>
          <button onClick={() => setShowFilamentPrompt(false)}>Cancel</button>
        </div>
      )}

      <h1 className="dashboard-title">ISKONOMY!</h1>
      <p className="dashboard-subtitle">From plex to profit—stay in control.</p>

      <div className="discord-wrapper">
      <button
        className="discord-button"
        onClick={() => window.api?.openExternal("https://discord.gg/M87HtnjBYg")}
      >
        <img
          src="https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/discord.svg"
          alt="Join Discord"
          style={{ height: "20px", marginRight: "0.5rem" }}
        />
        Join Discord
      </button>
    </div>


      <div className="dashboard-links">
        <button onClick={() => navigate("/abyssals")}>Abyssals</button>
        <button onClick={() => navigate("/industry")}>Industry</button>
        <button onClick={() => navigate("/market")}>Market</button>
        <button onClick={() => navigate("/misc")}>Misc</button>
      </div>

      <div className="dashboard-footer">
        <button className="patch-notes-btn" onClick={() => navigate("/patch-notes")}>
          Patch Notes
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span className="version-label">
            Version {pkg.version}
            {versionStatus === "outdated" && updateUrl && (
              <span className="version-indicator red" title="Version is out of date">
                ❌
                <span className="version-tooltip">
                  Version is out of date.{" "}
                  <a href={updateUrl} target="_blank" rel="noopener noreferrer">
                    Download here
                  </a>
                </span>
              </span>
            )}
            {versionStatus === "latest" && (
              <span className="version-indicator green" title="You're on the latest version">
                ✅
                <span className="version-tooltip">You're on the latest version</span>
              </span>
            )}
            {versionStatus === "error" && (
              <span className="version-indicator yellow" title="Could not check for updates">
                ⚠️
                <span className="version-tooltip">Could not check for updates</span>
              </span>
            )}
          </span>

          <div className="support-tooltip-container">
            <button
              className="support-button"
              onClick={() => {
                const el = document.querySelector(".support-tooltip");
                el.style.display = el.style.display === "block" ? "none" : "block";
              }}
              title="Support Development"
            >
              💖
            </button>
            <div className="support-tooltip">
              <p style={{ margin: 0 }}>
                Help out on{" "}
                <a
                  href="https://github.com/EggyBoffer/Eve-Isk-Management/discussions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                <br />
                or donate ISK to <strong>Death Killer21</strong>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
