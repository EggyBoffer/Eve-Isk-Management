import { useState, useEffect, useCallback } from "react";

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
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [room1Isk, setRoom1Isk] = useState("");
  const [room2Isk, setRoom2Isk] = useState("");
  const [room3Isk, setRoom3Isk] = useState("");
  const [timeTaken, setTimeTaken] = useState("");
  const [fillamentCost, setFillamentCost] = useState("");
  const [tier, setTier] = useState(() => {
  const stored = JSON.parse(localStorage.getItem("settings"));
  return stored?.filamentTier || sessionStorage.getItem("tier") || "T3";
});
const [stormType, setStormType] = useState(() => {
  const stored = JSON.parse(localStorage.getItem("settings"));
  return stored?.stormType || sessionStorage.getItem("stormType") || "Firestorm";
});

  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [showGlorifiedInput, setShowGlorifiedInput] = useState(false);
  const [glorifiedValue, setGlorifiedValue] = useState("");
  const [glorifiedName, setGlorifiedName] = useState("");

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
    setFillamentCost("");
  }, [updateFilamentPrice]);

  useEffect(() => {
    sessionStorage.setItem("tier", tier);
    sessionStorage.setItem("stormType", stormType);
    updateFilamentPrice();
  }, [tier, stormType, updateFilamentPrice]);

  async function fetchFilamentPrice(typeId) {
    const regionId = 10000002;
    try {
      const res = await fetch(`https://esi.evetech.net/latest/markets/${regionId}/orders/?type_id=${typeId}`);
      const data = await res.json();
      const sellOrders = data.filter((order) => !order.is_buy_order);
      const lowestSell = sellOrders.sort((a, b) => a.price - b.price)[0];
      return Math.round(lowestSell?.price || 0);
    } catch (err) {
      console.error("Failed to fetch filament price:", err);
      return 0;
    }
  }

  function getFilamentTypeId(tier, stormType) {
    return FILAMENT_TYPES[tier]?.[stormType] || 0;
  }

  async function fetchEntries() {
    const data = await window.api.getEntries("abyssals");
    setEntries(data);
  }

  async function handleDelete(id) {
    if (confirm(`Delete entry #${id}?`)) {
      await window.api.deleteEntry("abyssals", id);
      setEditingId(null);
      setRoom1Isk("");
      setRoom2Isk("");
      setRoom3Isk("");
      setTimeTaken("");
      setFillamentCost("");
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
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if ([room1Isk, room2Isk, room3Isk, timeTaken, fillamentCost].some((val) => val === "" || isNaN(val))) {
      alert("Please fill all fields with valid numbers.");
      return;
    }

    const entryData = {
      date,
      room1_isk: parseInt(room1Isk),
      room2_isk: parseInt(room2Isk),
      room3_isk: parseInt(room3Isk),
      time_taken: parseInt(timeTaken),
      fillament_cost: parseInt(fillamentCost),
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
  name: glorifiedName
});


  setShowGlorifiedInput(false);
  setGlorifiedValue("");
  setGlorifiedName("");
  alert("Glorified drop recorded.");
}


  const today = new Date().toISOString().slice(0, 10);
  const todaysEntries = entries
    .filter((entry) => entry.date === today)
    .sort((a, b) => b.id - a.id)
    .slice(0, 4);

  return (
    <div className="abyssals-background">
      <div className="container">
        <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>Abyssals</h1>
        <div className="abyssals-container">
          <div className="abyssals-form-column">
            <form onSubmit={handleSubmit}>
              <label>
                <span>Date:</span>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </label>
              <label>
                Filament Tier:
                <select value={tier} onChange={(e) => setTier(e.target.value)}>
                  {Object.keys(FILAMENT_TYPES).map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label>
                Storm Type:
                <select value={stormType} onChange={(e) => setStormType(e.target.value)}>
                  {Object.keys(FILAMENT_TYPES["T1"]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Room 1 ISK:</span>
                <input type="number" value={room1Isk} onChange={(e) => setRoom1Isk(e.target.value)} required />
              </label>
              <label>
                <span>Room 2 ISK:</span>
                <input type="number" value={room2Isk} onChange={(e) => setRoom2Isk(e.target.value)} required />
              </label>
              <label>
                <span>Room 3 ISK:</span>
                <input type="number" value={room3Isk} onChange={(e) => setRoom3Isk(e.target.value)} required />
              </label>
              <label>
                <span>Time (min):</span>
                <input type="number" value={timeTaken} onChange={(e) => setTimeTaken(e.target.value)} required />
              </label>
              <label>
                Fillament Cost:
                <span className="fillament-value">{fillamentCost ? `${Number(fillamentCost).toLocaleString()} ISK` : "—"}</span>
                <span className="tooltip-icon" title="Auto-updated from Jita market">?</span>
              </label>
              <button type="submit">{editingId ? "Update Entry" : "Add Entry"}</button>
            </form>

            <button
              onClick={() => setShowGlorifiedInput(!showGlorifiedInput)}
              style={{ marginTop: "1rem" }}
            >
              {showGlorifiedInput ? "Cancel" : "Add Glorified Drop"}
            </button>

            {showGlorifiedInput && (
            <div style={{ marginTop: "1rem" }}>
              <input
                type="text"
                placeholder="Name of Drop"
                value={glorifiedName}
                onChange={(e) => setGlorifiedName(e.target.value)}
                style={{ marginBottom: "0.5rem", display: "block" }}
              />
              <input
                type="number"
                placeholder="Glorified Drop ISK"
                value={glorifiedValue}
                onChange={(e) => setGlorifiedValue(e.target.value)}
              />
              <button onClick={handleAddGlorified}>Submit Drop</button>
            </div>
          )}

          </div>

          <div className="abyssals-entries-column">
            <h2 style={{ textAlign: "center" }}>Today's Entries</h2>
            <div className="entries-grid">
              {todaysEntries.length === 0 ? (
                <div className="no-entries-message">Ready to start krabbing? Add your first entry.</div>
              ) : (
                todaysEntries.map((entry) => (
                  <div key={entry.id} className="entry-card">
                    <div className="entry-date">{entry.date}</div>
                    <div className="entry-rooms">
                      <span>Room 1: {entry.room1_isk.toLocaleString()}</span>
                      <span>Room 2: {entry.room2_isk.toLocaleString()}</span>
                      <span>Room 3: {entry.room3_isk.toLocaleString()}</span>
                    </div>
                    <div className="entry-info">
                      Time: {entry.time_taken} mins | Filament: {entry.fillament_cost.toLocaleString()} ISK | Profit: {((entry.room1_isk + entry.room2_isk + entry.room3_isk) - entry.fillament_cost).toLocaleString()} ISK
                    </div>
                    <div className="entry-actions">
                      <button title="Edit" onClick={() => handleEdit(entry)}>✏️</button>
                      <button title="Delete" onClick={() => handleDelete(entry.id)}>❌</button>
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
