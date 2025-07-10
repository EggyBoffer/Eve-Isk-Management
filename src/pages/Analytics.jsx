import { useState, useEffect } from "react";

export default function Analytics() {
  const [entries, setEntries] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [editedEntry, setEditedEntry] = useState({
    date: "",
    room1_isk: "",
    room2_isk: "",
    room3_isk: "",
    time_taken: "",
    fillament_cost: "",
    tier: "",
    storm_type: "",
    ship_type: "",
  });
  const [sortBy, setSortBy] = useState("date");
  const [sortDirection, setSortDirection] = useState("desc");
  const [glorified, setGlorified] = useState([]);

  useEffect(() => {
    fetchEntries();
    fetchGlorified();
  }, []);

  async function fetchEntries() {
    const data = await window.api.getEntries("abyssals");
    setEntries(data);
  }

  async function fetchGlorified() {
    const data = await window.api.getGlorified();
    setGlorified(data);
  }

  function getShipMultiplier(shipType) {
    switch (shipType?.toLowerCase()) {
      case "frigate": return 3;
      case "destroyer": return 2;
      case "cruiser": return 1;
      default: return 1;
    }
  }

  function handleSort(field) {
    if (sortBy === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortDirection("desc");
    }
  }

  async function handleDelete(id) {
    if (confirm(`Delete entry #${id}?`)) {
      await window.api.deleteEntry("abyssals", id);
      fetchEntries();
    }
  }

  async function handleDeleteGlorified(id) {
    if (confirm("Delete this glorified drop?")) {
      await window.api.deleteGlorified(id);
      fetchGlorified();
    }
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setEditedEntry({ ...entry });
  }

  async function handleUpdate() {
    if (
      !editedEntry.date ||
      isNaN(editedEntry.room1_isk) ||
      isNaN(editedEntry.room2_isk) ||
      isNaN(editedEntry.room3_isk) ||
      isNaN(editedEntry.time_taken) ||
      isNaN(editedEntry.fillament_cost)
    ) {
      alert("Please enter valid numbers and a date.");
      return;
    }

    await window.api.updateEntry("abyssals", {
      id: editingId,
      date: editedEntry.date,
      room1_isk: parseInt(editedEntry.room1_isk),
      room2_isk: parseInt(editedEntry.room2_isk),
      room3_isk: parseInt(editedEntry.room3_isk),
      time_taken: parseInt(editedEntry.time_taken),
      fillament_cost: parseInt(editedEntry.fillament_cost),
      tier: editedEntry.tier,
      storm_type: editedEntry.storm_type,
      ship_type: editedEntry.ship_type,
    });

    setEditingId(null);
    fetchEntries();
  }

  const sortedEntries = [...entries].sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    switch (sortBy) {
      case "profit": {
        const multA = getShipMultiplier(a.ship_type);
        const multB = getShipMultiplier(b.ship_type);
        const profitA = a.room1_isk + a.room2_isk + a.room3_isk - (a.fillament_cost * multA);
        const profitB = b.room1_isk + b.room2_isk + b.room3_isk - (b.fillament_cost * multB);
        return dir * (profitA - profitB);
      }
      case "time":
        return dir * (a.time_taken - b.time_taken);
      case "tier":
        return dir * ((parseInt(a.tier?.replace("T", "")) || 0) - (parseInt(b.tier?.replace("T", "")) || 0));
      case "storm_type":
        return dir * a.storm_type.localeCompare(b.storm_type);
      case "date":
      default:
        return dir * (new Date(a.date) - new Date(b.date));
    }
  });

  const abyssalProfit = entries.reduce((sum, e) => {
    const mult = getShipMultiplier(e.ship_type);
    return sum + (e.room1_isk + e.room2_isk + e.room3_isk - (e.fillament_cost * mult));
  }, 0);

  const glorifiedProfit = glorified.reduce((sum, drop) => sum + Number(drop.isk_earned || 0), 0);
  const totalProfit = abyssalProfit + glorifiedProfit;

  const totalTimeHours = entries.reduce((sum, e) => sum + e.time_taken / 60, 0);
  const iskPerHour = totalTimeHours > 0 ? abyssalProfit / totalTimeHours : 0;

  const perFilament = entries.reduce((acc, entry) => {
    if (!entry.tier || !entry.storm_type) return acc;
    const filamentName = `${entry.tier} ${entry.storm_type}`;
    const mult = getShipMultiplier(entry.ship_type);
    const profit = entry.room1_isk + entry.room2_isk + entry.room3_isk - (entry.fillament_cost * mult);
    const timeHours = entry.time_taken / 60;
    if (!acc[filamentName]) acc[filamentName] = { totalProfit: 0, totalTimeHours: 0 };
    acc[filamentName].totalProfit += profit;
    acc[filamentName].totalTimeHours += timeHours;
    return acc;
  }, {});

  const profitByDate = {};

entries.forEach(e => {
  const mult = getShipMultiplier(e.ship_type);
  const profit = e.room1_isk + e.room2_isk + e.room3_isk - (e.fillament_cost * mult);
  const date = e.date;

  if (!profitByDate[date]) profitByDate[date] = 0;
  profitByDate[date] += profit;
});

// Get last 4 days sorted descending
const last4Days = Object.entries(profitByDate)
  .sort((a, b) => new Date(b[0]) - new Date(a[0]))
  .slice(0, 4);

const averageISKPerDay = last4Days.length > 0
  ? last4Days.reduce((sum, [, profit]) => sum + profit, 0) / last4Days.length
  : 0;


  function GlorifiedDrops() {
  const [editingId, setEditingId] = useState(null);
  const [editedDrop, setEditedDrop] = useState({
    date: "",
    name: "",
    isk_earned: "",
    tier: "",
    storm_type: "",
  });

  const grouped = glorified.reduce((acc, drop) => {
    const key = `${drop.name}-${drop.isk_earned}-${drop.tier}-${drop.storm_type}`;
    if (!acc[key]) {
      acc[key] = { ...drop, count: 1 };
    } else {
      acc[key].count += 1;
    }
    return acc;
  }, {});

  const totalGlorified = Object.values(grouped).reduce(
    (sum, drop) => sum + drop.count * Number(drop.isk_earned || 0),
    0
  );

  const handleEditGlorified = (drop) => {
    setEditingId(drop.id);
    setEditedDrop({ ...drop });
  };

  const handleUpdateGlorified = async () => {
    if (
      !editedDrop.date ||
      !editedDrop.name ||
      isNaN(editedDrop.isk_earned)
    ) {
      alert("Please enter valid details.");
      return;
    }

    // Reuse add-glorified route for update if needed; else create a new handler in backend
    await window.api.deleteGlorified(editedDrop.id); // Delete old
    await window.api.addGlorified(editedDrop);       // Re-insert updated

    setEditingId(null);
    fetchGlorified();
  };

  return Object.keys(grouped).length === 0 ? (
    <p style={{ padding: "0.5rem" }}>No glorified drops recorded yet.</p>
  ) : (
    <>
      <table className="analytics-glorified-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Name</th>
            <th>ISK Earned</th>
            <th>Filament</th>
            <th>Count</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(grouped).map((drop, index) => (
            <tr key={index}>
              <td>
                {editingId === drop.id ? (
                  <input
                    type="date"
                    value={editedDrop.date}
                    onChange={(e) =>
                      setEditedDrop({ ...editedDrop, date: e.target.value })
                    }
                  />
                ) : (
                  drop.date
                )}
              </td>
              <td>
                {editingId === drop.id ? (
                  <input
                    type="text"
                    value={editedDrop.name}
                    onChange={(e) =>
                      setEditedDrop({ ...editedDrop, name: e.target.value })
                    }
                  />
                ) : (
                  drop.name || "—"
                )}
              </td>
              <td>
                {editingId === drop.id ? (
                  <input
                    type="number"
                    value={editedDrop.isk_earned}
                    onChange={(e) =>
                      setEditedDrop({
                        ...editedDrop,
                        isk_earned: e.target.value,
                      })
                    }
                  />
                ) : (
                  <>
                    {Number(drop.isk_earned).toLocaleString()} ISK
                    {drop.count > 1 && ` (x${drop.count})`}
                  </>
                )}
              </td>
              <td>
                {editingId === drop.id ? (
                  <>
                    <select
                      value={editedDrop.tier}
                      onChange={(e) =>
                        setEditedDrop({ ...editedDrop, tier: e.target.value })
                      }
                    >
                      <option value="">—</option>
                      {["T0", "T1", "T2", "T3", "T4", "T5", "T6"].map((tier) => (
                        <option key={tier} value={tier}>
                          {tier}
                        </option>
                      ))}
                    </select>
                    <select
                      value={editedDrop.storm_type}
                      onChange={(e) =>
                        setEditedDrop({
                          ...editedDrop,
                          storm_type: e.target.value,
                        })
                      }
                    >
                      <option value="">—</option>
                      {["Firestorm", "Dark", "Gamma", "Electrical", "Exotic"].map(
                        (type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        )
                      )}
                    </select>
                  </>
                ) : (
                  `${drop.tier || ""} ${drop.storm_type || ""}`.trim()
                )}
              </td>
              <td>{drop.count}</td>
              <td>
                {editingId === drop.id ? (
                  <button onClick={handleUpdateGlorified}>💾</button>
                ) : (
                  <button onClick={() => handleEditGlorified(drop)}>✏️</button>
                )}
                <button onClick={() => handleDeleteGlorified(drop.id)}>❌</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginTop: "1rem", fontWeight: "bold" }}>
        Total Glorified ISK: {totalGlorified.toLocaleString()} ISK
      </p>
    </>
  );
}


  return (
    <div className="analytics-container" style={{ padding: "2rem", width: "100vw", minHeight: "100vh" }}>
      <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>Analytics</h1>

      <div className="analytics-entries-section">
        <h2>Abyssals Entries</h2>
        <div className="analytics-entries-wrapper">
          <table className="analytics-entries-table">
            <thead>
              <tr>
                <th onClick={() => handleSort("date")}>Date</th>
                <th>Room1</th>
                <th>Room2</th>
                <th>Room3</th>
                <th onClick={() => handleSort("time")}>Time</th>
                <th>Cost</th>
                <th onClick={() => handleSort("profit")}>Profit</th>
                <th onClick={() => handleSort("tier")}>Filament</th>
                <th>Ship</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedEntries.map((entry) => {
                const mult = getShipMultiplier(entry.ship_type);
                const profit = entry.room1_isk + entry.room2_isk + entry.room3_isk - (entry.fillament_cost * mult);
                return (
                  <tr key={entry.id}>
                    <td>{editingId === entry.id ? <input type="date" value={editedEntry.date} onChange={(e) => setEditedEntry({ ...editedEntry, date: e.target.value })} /> : entry.date}</td>
                    <td>{editingId === entry.id ? <input type="number" value={editedEntry.room1_isk} onChange={(e) => setEditedEntry({ ...editedEntry, room1_isk: e.target.value })} /> : entry.room1_isk}</td>
                    <td>{editingId === entry.id ? <input type="number" value={editedEntry.room2_isk} onChange={(e) => setEditedEntry({ ...editedEntry, room2_isk: e.target.value })} /> : entry.room2_isk}</td>
                    <td>{editingId === entry.id ? <input type="number" value={editedEntry.room3_isk} onChange={(e) => setEditedEntry({ ...editedEntry, room3_isk: e.target.value })} /> : entry.room3_isk}</td>
                    <td>{editingId === entry.id ? <input type="number" value={editedEntry.time_taken} onChange={(e) => setEditedEntry({ ...editedEntry, time_taken: e.target.value })} /> : `${entry.time_taken} mins`}</td>
                    <td>{editingId === entry.id ? <input type="number" value={editedEntry.fillament_cost} onChange={(e) => setEditedEntry({ ...editedEntry, fillament_cost: e.target.value })} /> : entry.fillament_cost}</td>
                    <td>{profit.toLocaleString()} ISK</td>
                    <td>{`${entry.tier || ""} ${entry.storm_type || ""}`.trim()}</td>
                    <td>{editingId === entry.id ? (
                      <select value={editedEntry.ship_type} onChange={(e) => setEditedEntry({ ...editedEntry, ship_type: e.target.value })}>
                        <option value="">—</option>
                        <option value="frigate">Frigate</option>
                        <option value="destroyer">Destroyer</option>
                        <option value="cruiser">Cruiser</option>
                      </select>
                    ) : entry.ship_type || "—"}</td>
                    <td>
                      {editingId === entry.id ? (
                        <button onClick={handleUpdate}>💾</button>
                      ) : (
                        <button onClick={() => handleEdit(entry)}>✏️</button>
                      )}
                      <button onClick={() => handleDelete(entry.id)}>❌</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="analytics-summary" style={{ marginTop: "2rem" }}>
        <h2>Summary Metrics</h2>
        <p>Total Runs: {entries.length}</p>
        <p>Total Profit: {totalProfit.toLocaleString()} ISK</p>
        <p style={{ fontSize: "0.85rem", color: "#aaa" }}>
          (Abyssals: {abyssalProfit.toLocaleString()} ISK + Glorified: {glorifiedProfit.toLocaleString()} ISK)
        </p>
        <p>Average ISK/hour: {iskPerHour.toLocaleString()} ISK/hour</p>

        <h3>Profit Per Hour by Filament Type</h3>
        <table className="analytics-filament-table">
          <thead>
            <tr>
              <th>Filament</th>
              <th>Total Profit</th>
              <th>ISK/hour</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(perFilament).map(([filament, { totalProfit, totalTimeHours }]) => {
              const perHour = totalTimeHours > 0 ? totalProfit / totalTimeHours : 0;
              return (
                <tr key={filament}>
                  <td>{filament}</td>
                  <td>{totalProfit.toLocaleString()} ISK</td>
                  <td>{perHour.toLocaleString()} ISK/hour</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <h3>ISK Earned Per Day (Last 4 Days)</h3>
        <table className="analytics-filament-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Total Profit</th>
            </tr>
          </thead>
          <tbody>
            {last4Days.map(([date, profit]) => (
              <tr key={date}>
                <td>{date}</td>
                <td>{profit.toLocaleString()} ISK</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: "0.5rem", fontWeight: "bold" }}>
          Average ISK/day: {averageISKPerDay.toLocaleString()} ISK
        </p>


        <h3>Profit by Ship Type</h3>
        <table className="analytics-filament-table">
          <thead>
            <tr>
              <th>Ship Type</th>
              <th>Runs</th>
              <th>Total Profit</th>
              <th>ISK/hour</th>
            </tr>
          </thead>
          <tbody>
            {["Frigate", "Destroyer", "Cruiser"].map((type) => {
              const filtered = entries.filter(e => e.ship_type?.toLowerCase() === type.toLowerCase());
              const totalProfit = filtered.reduce((sum, e) => {
                const mult = getShipMultiplier(e.ship_type);
                return sum + (e.room1_isk + e.room2_isk + e.room3_isk - e.fillament_cost * mult);
              }, 0);
              const totalTime = filtered.reduce((sum, e) => sum + e.time_taken / 60, 0);
              const iskPerHour = totalTime > 0 ? totalProfit / totalTime : 0;

              return (
                <tr key={type}>
                  <td>{type}</td>
                  <td>{filtered.length}</td>
                  <td>{totalProfit.toLocaleString()} ISK</td>
                  <td>{iskPerHour.toLocaleString()} ISK/hour</td>
                </tr>
              );
            })}
          </tbody>
        </table>

      </div>

      <div className="analytics-glorified-section" style={{ marginTop: "3rem" }}>
        <h2>Glorified Drops</h2>
        <GlorifiedDrops />
      </div>
    </div>
  );
}
