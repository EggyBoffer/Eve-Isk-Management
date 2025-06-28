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
  });

  useEffect(() => {
    fetchEntries();
    fetchGlorified();
  }, []);

  function GlorifiedDrops() {
  const [glorified, setGlorified] = useState([]);

  useEffect(() => {
    window.api.getEntries("glorified").then(setGlorified);
  }, []);

  const totalGlorified = glorified.reduce((sum, drop) => sum + Number(drop.isk_earned || 0), 0);

  return (
    <>
      {glorified.length === 0 ? (
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
    <th>Actions</th>
  </tr>
  </thead>
          <tbody>
            {glorified.map((drop) => (
              <tr key={drop.id}>
                <td>{drop.date}</td>
                <td>{drop.name || "—"}</td>
                <td>{Number(drop.isk_earned || 0).toLocaleString()} ISK</td>
                <td>{drop.tier} {drop.storm_type}</td>
                <td className="analytics-entry-actions">
                  <button title="Delete" onClick={() => handleDeleteGlorified(drop.id)}>❌</button>
                </td>
              </tr>
            ))}
          </tbody>
          </table>
          <p style={{ marginTop: "1rem", fontWeight: "bold" }}>
            Total Glorified ISK: {totalGlorified.toLocaleString()} ISK
          </p>
        </>
      )}
    </>
  );
}

  async function handleDeleteGlorified(id) {
  if (confirm("Delete this glorified drop?")) {
    await window.api.deleteGlorified(id);
    fetchGlorified(); // <- refresh the table
  }
}

  const [glorified, setGlorified] = useState([]);

  async function fetchGlorified() {
    const data = await window.api.getGlorified();
    setGlorified(data);
  }

  async function fetchEntries() {
    const data = await window.api.getEntries("abyssals");
    setEntries(data.sort((a, b) => new Date(b.date) - new Date(a.date))); // newest first
  }

  async function handleDelete(id) {
    if (confirm(`Delete entry #${id}?`)) {
      await window.api.deleteEntry("abyssals", id);
      fetchEntries();
    }
  }

  function handleEdit(entry) {
    setEditingId(entry.id);
    setEditedEntry({ ...entry }); // fill up form
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

    await window.api.updateEntry("abyssals", editingId, {
      date: editedEntry.date,
      room1_isk: parseInt(editedEntry.room1_isk),
      room2_isk: parseInt(editedEntry.room2_isk),
      room3_isk: parseInt(editedEntry.room3_isk),
      time_taken: parseInt(editedEntry.time_taken),
      fillament_cost: parseInt(editedEntry.fillament_cost),
      tier: editedEntry.tier,
      storm_type: editedEntry.storm_type,
    });

    setEditingId(null);
    fetchEntries();
  }

  const abyssalProfit = entries.reduce(
  (sum, e) => sum + (e.room1_isk + e.room2_isk + e.room3_isk - e.fillament_cost),
  0
  );

  const glorifiedProfit = glorified.reduce(
    (sum, drop) => sum + Number(drop.isk_earned || 0),
    0
  );

  const totalProfit = abyssalProfit + glorifiedProfit;


  const totalTimeHours = entries.reduce((sum, e) => sum + e.time_taken / 60, 0);
  const iskPerHour = totalTimeHours > 0 ? abyssalProfit / totalTimeHours : 0;

  // ISK/hour per filament type
  const perFilament = entries.reduce((acc, entry) => {
    const filamentName = `${entry.tier || "Unknown"} ${entry.storm_type || "Unknown"}`;
    const profit = entry.room1_isk + entry.room2_isk + entry.room3_isk - entry.fillament_cost;
    const timeHours = entry.time_taken / 60;
    if (!acc[filamentName]) {
      acc[filamentName] = { totalProfit: 0, totalTimeHours: 0 };
    }
    acc[filamentName].totalProfit += profit;
    acc[filamentName].totalTimeHours += timeHours;
    return acc;
  }, {});

  return (
    <div className="analytics-container" style={{ padding: "2rem", width: "100vw", minHeight: "100vh" }}>
      <h1 style={{ textAlign: "center", marginBottom: "2rem" }}>Analytics</h1>

      {/* Display all Abyssals Entries */}

      <div className="analytics-entries-section">
        <h2>Abyssals Entries</h2>
        {entries.length === 0 ? (
          <p style={{ padding: "1rem" }}>No abyssals tracked yet.</p>
        ) : (
          <div className="analytics-entries-wrapper">
          <table className="analytics-entries-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Room1</th>
                <th>Room2</th>
                <th>Room3</th>
                <th>Time</th>
                <th>Cost</th>
                <th>Profit</th>
                <th>Filament</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => {
                const profit = entry.room1_isk + entry.room2_isk + entry.room3_isk - entry.fillament_cost;
                return (
                  <tr key={entry.id}>
                    <td>
                      {editingId === entry.id ? (
                        <input
                          type="date"
                          value={editedEntry.date}
                          onChange={(e) => setEditedEntry({ ...editedEntry, date: e.target.value })}
                        />
                      ) : (
                        entry.date
                      )}
                    </td>
                    <td>{editingId === entry.id ? <input type="number" value={editedEntry.room1_isk} onChange={(e) => setEditedEntry({ ...editedEntry, room1_isk: e.target.value })} /> : entry.room1_isk}</td>
                    <td>{editingId === entry.id ? <input type="number" value={editedEntry.room2_isk} onChange={(e) => setEditedEntry({ ...editedEntry, room2_isk: e.target.value })} /> : entry.room2_isk}</td>
                    <td>{editingId === entry.id ? <input type="number" value={editedEntry.room3_isk} onChange={(e) => setEditedEntry({ ...editedEntry, room3_isk: e.target.value })} /> : entry.room3_isk}</td>
                    <td>{editingId === entry.id ? <input type="number" value={editedEntry.time_taken} onChange={(e) => setEditedEntry({ ...editedEntry, time_taken: e.target.value })} /> : `${entry.time_taken} mins`}</td>
                    <td>{editingId === entry.id ? <input type="number" value={editedEntry.fillament_cost} onChange={(e) => setEditedEntry({ ...editedEntry, fillament_cost: e.target.value })} /> : entry.fillament_cost}</td>
                    <td>{profit.toLocaleString()} ISK</td>
                    <td>{entry.tier} {entry.storm_type}</td>
                    <td className="analytics-entry-actions">
                      {editingId === entry.id ? <button title="Save" onClick={handleUpdate}>💾</button> : <button title="Edit" onClick={() => handleEdit(entry)}>✏️</button>}
                      <button title="Delete" onClick={() => handleDelete(entry.id)}>❌</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Summary Metrics */}
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
      </div>
      <div className="analytics-glorified-section" style={{ marginTop: "3rem" }}>
        <h2>Glorified Drops</h2>
        <GlorifiedDrops />
      </div>
    </div>
  );
}
