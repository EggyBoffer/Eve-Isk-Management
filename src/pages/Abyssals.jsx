import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/abyssals.css";

const FILAMENT_TYPES = {
  T0: { Firestorm: 56134, Dark: 56132, Gamma: 56136, Electrical: 56131, Exotic: 56133 },
  T1: { Firestorm: 47763, Dark: 47762, Gamma: 47764, Electrical: 47765, Exotic: 47761 },
  T2: { Firestorm: 47896, Dark: 47892, Gamma: 47900, Electrical: 47904, Exotic: 47888 },
  T3: { Firestorm: 47897, Dark: 47893, Gamma: 47901, Electrical: 47905, Exotic: 47889 },
  T4: { Firestorm: 47898, Dark: 47894, Gamma: 47902, Electrical: 47906, Exotic: 47890 },
  T5: { Firestorm: 47899, Dark: 47895, Gamma: 47903, Electrical: 47907, Exotic: 47891 },
  T6: { Firestorm: 56142, Dark: 56140, Gamma: 56143, Electrical: 56139, Exotic: 56141 },
};

export default function Abyssals() {
  const navigate = useNavigate();

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [room1Isk, setRoom1Isk] = useState("");
  const [room2Isk, setRoom2Isk] = useState("");
  const [room3Isk, setRoom3Isk] = useState("");
  const [timeTaken, setTimeTaken] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [fillamentCost, setFillamentCost] = useState("");

  const [tier, setTier] = useState(() => {
    const stored = JSON.parse(localStorage.getItem("settings"));
    return stored?.filamentTier || sessionStorage.getItem("tier") || "T3";
  });

  const [stormType, setStormType] = useState(() => {
    const stored = JSON.parse(localStorage.getItem("settings"));
    return stored?.stormType || sessionStorage.getItem("stormType") || "Firestorm";
  });

  const [shipType, setShipType] = useState(() => {
    const stored = JSON.parse(localStorage.getItem("settings"));
    return stored?.shipType || sessionStorage.getItem("shipType") || "Cruiser";
  });

  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [showGlorifiedInput, setShowGlorifiedInput] = useState(false);
  const [glorifiedValue, setGlorifiedValue] = useState("");
  const [glorifiedName, setGlorifiedName] = useState("");

  const [showOverlayPrompt, setShowOverlayPrompt] = useState(false);

  function getFilamentTypeId(t, s) {
    return FILAMENT_TYPES[t]?.[s] || 0;
  }

  async function fetchFilamentPrice(typeId) {
    const regionId = 10000002;
    try {
      const res = await fetch(
        `https://esi.evetech.net/latest/markets/${regionId}/orders/?type_id=${typeId}`
      );
      const data = await res.json();
      const sellOrders = data.filter((order) => !order.is_buy_order);
      const lowestSell = sellOrders.sort((a, b) => a.price - b.price)[0];
      return Math.round(lowestSell?.price || 0);
    } catch {
      return 0;
    }
  }

  const fetchEntries = useCallback(async () => {
    const data = await window.api.getEntries("abyssals");
    setEntries(data);
  }, []);

  const updateFilamentPrice = useCallback(async () => {
    const id = getFilamentTypeId(tier, stormType);
    if (id) {
      const price = await fetchFilamentPrice(id);
      setFillamentCost(price);
    }
  }, [tier, stormType]);

  useEffect(() => {
    fetchEntries();
    updateFilamentPrice();
    setEditingId(null);
    setRoom1Isk("");
    setRoom2Isk("");
    setRoom3Isk("");
    setTimeTaken("");
  }, [fetchEntries, updateFilamentPrice]);

  useEffect(() => {
    sessionStorage.setItem("tier", tier);
    sessionStorage.setItem("stormType", stormType);
    sessionStorage.setItem("shipType", shipType);
    updateFilamentPrice();
  }, [tier, stormType, shipType, updateFilamentPrice]);

  useEffect(() => {
    const ipc = window.electron?.ipcRenderer;
    if (!ipc?.on) return;

    const handler = (_event, payload) => {
      if (payload?.table === "abyssals") {
        fetchEntries();
      }
    };

    ipc.on("entries-updated", handler);

    return () => {
      if (ipc.off) ipc.off("entries-updated", handler);
      else if (ipc.removeAllListeners) ipc.removeAllListeners("entries-updated");
    };
  }, [fetchEntries]);

  async function handleDelete(id) {
    if (confirm(`Delete entry #${id}?`)) {
      await window.api.deleteEntry("abyssals", id);
      setEditingId(null);
      setRoom1Isk("");
      setRoom2Isk("");
      setRoom3Isk("");
      setTimeTaken("");
      await fetchEntries();
    }
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setDate(entry.date);
    setRoom1Isk(entry.room1_isk);
    setRoom2Isk(entry.room2_isk);
    setRoom3Isk(entry.room3_isk);
    setTimeTaken(entry.time_taken);
    setFillamentCost(entry.fillament_cost);
    setShipType(entry.ship_type || "Cruiser");
    setTier(entry.tier || tier);
    setStormType(entry.storm_type || stormType);
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if ([room1Isk, room2Isk, room3Isk, timeTaken].some((val) => val === "" || isNaN(val))) {
      alert("Please fill all fields with valid numbers.");
      return;
    }

    const multiplier = shipType === "Frigate" ? 3 : shipType === "Destroyer" ? 2 : 1;

    const entryData = {
      date,
      room1_isk: parseInt(room1Isk),
      room2_isk: parseInt(room2Isk),
      room3_isk: parseInt(room3Isk),
      time_taken: parseInt(timeTaken),
      fillament_cost: parseInt(fillamentCost || 0) * multiplier,
      tier,
      storm_type: stormType,
      ship_type: shipType,
    };

    if (editingId) {
      await window.api.updateEntry("abyssals", { id: editingId, ...entryData });
      setEditingId(null);
    } else {
      await window.api.addEntry("abyssals", entryData);
    }

    setRoom1Isk("");
    setRoom2Isk("");
    setRoom3Isk("");
    setTimeTaken("");
    fetchEntries();
  }

  async function handleAddGlorified() {
    if (glorifiedValue === "" || isNaN(glorifiedValue)) {
      alert("Enter a valid ISK amount for the glorified drop.");
      return;
    }

    if (!glorifiedName.trim()) {
      alert("Please enter a name for the glorified drop.");
      return;
    }

    await window.api.addGlorified({
      date,
      tier,
      storm_type: stormType,
      isk_earned: parseInt(glorifiedValue),
      name: glorifiedName,
    });

    setGlorifiedValue("");
    setGlorifiedName("");
    setStatusMessage("✅ Glorified drop recorded!");
    setTimeout(() => setStatusMessage(""), 3000);
  }

  function openOverlay() {
    sessionStorage.setItem("tier", tier);
    sessionStorage.setItem("stormType", stormType);
    sessionStorage.setItem("shipType", shipType);
    sessionStorage.setItem("filamentPrice", String(fillamentCost || 0));

    const multiplier = shipType === "Frigate" ? 3 : shipType === "Destroyer" ? 2 : 1;
    const finalCost = Math.round((Number(fillamentCost) || 0) * multiplier);

    window.api.openOverlayWithCost(finalCost, shipType, tier, stormType);
    setShowOverlayPrompt(false);
  }

  const today = new Date().toISOString().slice(0, 10);
  const todaysEntries = entries
    .filter((entry) => entry.date === today)
    .sort((a, b) => b.id - a.id)
    .slice(0, 4);

  return (
    <div className="abyssals-page">
      <div className="abyssals-wrap">
        <div className="abyssals-topRow">
          <h1 className="abyssals-title">Abyssals</h1>

          <button
            type="button"
            className="abyssals-overlayBtn"
            onClick={() => setShowOverlayPrompt(true)}
          >
            🚀 Overlay
          </button>
        </div>

        {showOverlayPrompt && (
          <div className="abyssals-modalBackdrop" role="dialog" aria-modal="true">
            <div className="abyssals-modal">
              <div className="abyssals-modalHeader">
                <div className="abyssals-modalTitle">Select Filament</div>
                <button
                  type="button"
                  className="abyssals-modalClose"
                  onClick={() => setShowOverlayPrompt(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="abyssals-modalGrid">
                <label className="abyssals-field">
                  <span className="abyssals-fieldLabel">Tier</span>
                  <select value={tier} onChange={(e) => setTier(e.target.value)}>
                    {Object.keys(FILAMENT_TYPES).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="abyssals-field">
                  <span className="abyssals-fieldLabel">Storm Type</span>
                  <select value={stormType} onChange={(e) => setStormType(e.target.value)}>
                    {Object.keys(FILAMENT_TYPES["T1"]).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="abyssals-field">
                  <span className="abyssals-fieldLabel">Ship Type</span>
                  <select value={shipType} onChange={(e) => setShipType(e.target.value)}>
                    {["Cruiser", "Destroyer", "Frigate"].map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="abyssals-modalActions">
                <button type="button" className="abyssals-primaryBtn" onClick={openOverlay}>
                  Open Overlay
                </button>
                <button
                  type="button"
                  className="abyssals-secondaryBtn"
                  onClick={() => setShowOverlayPrompt(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="abyssals-grid">
          <div className="abyssals-card">
            {statusMessage && <div className="abyssals-status">{statusMessage}</div>}

            <form className="abyssals-form" onSubmit={handleSubmit}>
              <label className="abyssals-field">
                <span className="abyssals-fieldLabel">Date</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>

              <label className="abyssals-field">
                <span className="abyssals-fieldLabel">Filament Tier</span>
                <select value={tier} onChange={(e) => setTier(e.target.value)}>
                  {Object.keys(FILAMENT_TYPES).map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>

              <label className="abyssals-field">
                <span className="abyssals-fieldLabel">Storm Type</span>
                <select value={stormType} onChange={(e) => setStormType(e.target.value)}>
                  {Object.keys(FILAMENT_TYPES["T1"]).map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="abyssals-field">
                <span className="abyssals-fieldLabel">Ship Type</span>
                <select value={shipType} onChange={(e) => setShipType(e.target.value)}>
                  {["Cruiser", "Destroyer", "Frigate"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>

              <label className="abyssals-field">
                <span className="abyssals-fieldLabel">Room 1 ISK</span>
                <input type="number" value={room1Isk} onChange={(e) => setRoom1Isk(e.target.value)} required />
              </label>

              <label className="abyssals-field">
                <span className="abyssals-fieldLabel">Room 2 ISK</span>
                <input type="number" value={room2Isk} onChange={(e) => setRoom2Isk(e.target.value)} required />
              </label>

              <label className="abyssals-field">
                <span className="abyssals-fieldLabel">Room 3 ISK</span>
                <input type="number" value={room3Isk} onChange={(e) => setRoom3Isk(e.target.value)} required />
              </label>

              <label className="abyssals-field">
                <span className="abyssals-fieldLabel">Time (min)</span>
                <input type="number" value={timeTaken} onChange={(e) => setTimeTaken(e.target.value)} required />
              </label>

              <div className="abyssals-filamentRow">
                <div className="abyssals-filamentLeft">
                  <div className="abyssals-fieldLabel">Filament Cost</div>
                  <div className="abyssals-filamentValue">
                    {fillamentCost ? `${Number(fillamentCost).toLocaleString()} ISK` : "—"}
                  </div>
                </div>
                <div className="abyssals-filamentHelp" title="Auto-updated from Jita market">
                  ?
                </div>
              </div>

              <button type="submit" className="abyssals-primaryBtn">
                {editingId ? "Update Entry" : "Add Entry"}
              </button>
            </form>

            <div className="abyssals-actionsRow">
              <button
                type="button"
                className="abyssals-secondaryBtn"
                onClick={() => setShowGlorifiedInput(!showGlorifiedInput)}
              >
                {showGlorifiedInput ? "Cancel" : "Add Glorified Drop"}
              </button>

              <button type="button" className="abyssals-secondaryBtn" onClick={() => navigate("/analytics")}>
                Analytics
              </button>
            </div>

            {showGlorifiedInput && (
              <div className="abyssals-glorified">
                <input
                  type="text"
                  placeholder="Name of Drop"
                  value={glorifiedName}
                  onChange={(e) => setGlorifiedName(e.target.value)}
                />
                <input
                  type="number"
                  placeholder="Glorified Drop ISK"
                  value={glorifiedValue}
                  onChange={(e) => setGlorifiedValue(e.target.value)}
                />
                <button type="button" className="abyssals-primaryBtn" onClick={handleAddGlorified}>
                  Submit Drop
                </button>
              </div>
            )}
          </div>

          <div className="abyssals-entries">
            <h2 className="abyssals-entriesTitle">Today's Entries</h2>

            <div className="abyssals-entriesGrid">
              {todaysEntries.length === 0 ? (
                <div className="abyssals-empty">Ready to start krabbing? Add your first entry.</div>
              ) : (
                todaysEntries.map((entry) => (
                  <div key={entry.id} className="abyssals-entryCard">
                    <div className="abyssals-entryDate">{entry.date}</div>

                    <div className="abyssals-entryRooms">
                      <span>Room 1: {entry.room1_isk.toLocaleString()}</span>
                      <span>Room 2: {entry.room2_isk.toLocaleString()}</span>
                      <span>Room 3: {entry.room3_isk.toLocaleString()}</span>
                    </div>

                    <div className="abyssals-entryInfo">
                      Time: {entry.time_taken} mins | Ship: {entry.ship_type || "Cruiser"} | Filament:{" "}
                      {entry.fillament_cost.toLocaleString()} ISK | Profit:{" "}
                      {(entry.room1_isk + entry.room2_isk + entry.room3_isk - entry.fillament_cost).toLocaleString()}{" "}
                      ISK
                    </div>

                    <div className="abyssals-entryActions">
                      <button type="button" onClick={() => handleEdit(entry)} title="Edit">
                        ✏️
                      </button>
                      <button type="button" onClick={() => handleDelete(entry.id)} title="Delete">
                        ❌
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
