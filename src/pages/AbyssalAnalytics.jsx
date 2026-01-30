import { useState, useEffect } from "react";
import "../styles/abyssal-analytics.css";

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
      case "frigate":
        return 3;
      case "destroyer":
        return 2;
      case "cruiser":
        return 1;
      default:
        return 1;
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
        const profitA =
          a.room1_isk + a.room2_isk + a.room3_isk - a.fillament_cost * multA;
        const profitB =
          b.room1_isk + b.room2_isk + b.room3_isk - b.fillament_cost * multB;
        return dir * (profitA - profitB);
      }
      case "time":
        return dir * (a.time_taken - b.time_taken);
      case "tier":
        return (
          dir *
          ((parseInt(a.tier?.replace("T", "")) || 0) -
            (parseInt(b.tier?.replace("T", "")) || 0))
        );
      case "storm_type":
        return dir * a.storm_type.localeCompare(b.storm_type);
      case "date":
      default:
        return dir * (new Date(a.date) - new Date(b.date));
    }
  });

  const abyssalProfit = entries.reduce((sum, e) => {
    const mult = getShipMultiplier(e.ship_type);
    return (
      sum + (e.room1_isk + e.room2_isk + e.room3_isk - e.fillament_cost * mult)
    );
  }, 0);

  const glorifiedProfit = glorified.reduce(
    (sum, drop) => sum + Number(drop.isk_earned || 0),
    0
  );

  const totalProfit = abyssalProfit + glorifiedProfit;

  const totalTimeHours = entries.reduce((sum, e) => sum + e.time_taken / 60, 0);
  const iskPerHour = totalTimeHours > 0 ? abyssalProfit / totalTimeHours : 0;

  const perFilament = entries.reduce((acc, entry) => {
    if (!entry.tier || !entry.storm_type) return acc;
    const filamentName = `${entry.tier} ${entry.storm_type}`;
    const mult = getShipMultiplier(entry.ship_type);
    const profit =
      entry.room1_isk +
      entry.room2_isk +
      entry.room3_isk -
      entry.fillament_cost * mult;
    const timeHours = entry.time_taken / 60;
    if (!acc[filamentName]) acc[filamentName] = { totalProfit: 0, totalTimeHours: 0 };
    acc[filamentName].totalProfit += profit;
    acc[filamentName].totalTimeHours += timeHours;
    return acc;
  }, {});

  const profitByDate = {};
  entries.forEach((e) => {
    const mult = getShipMultiplier(e.ship_type);
    const profit =
      e.room1_isk + e.room2_isk + e.room3_isk - e.fillament_cost * mult;
    const date = e.date;
    if (!profitByDate[date]) profitByDate[date] = 0;
    profitByDate[date] += profit;
  });

  const last4Days = Object.entries(profitByDate)
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, 4);

  const averageISKPerDay =
    last4Days.length > 0
      ? last4Days.reduce((sum, [, profit]) => sum + profit, 0) / last4Days.length
      : 0;

  function GlorifiedDrops() {
    const [editingId, setEditingId] = useState(null);
    const [edited, setEdited] = useState({});

    const grouped = glorified.reduce((acc, drop) => {
      const name = drop.drop_name || "Unknown";
      if (!acc[name]) acc[name] = [];
      acc[name].push(drop);
      return acc;
    }, {});

    const totalGlorified = glorified.reduce(
      (sum, drop) => sum + Number(drop.isk_earned || 0),
      0
    );

    async function handleUpdateGlorified() {
      if (!edited.drop_name || isNaN(edited.isk_earned) || !edited.date) {
        alert("Please enter a name, date and valid ISK amount.");
        return;
      }

      await window.api.updateGlorified({
        id: editingId,
        drop_name: edited.drop_name,
        isk_earned: parseInt(edited.isk_earned),
        date: edited.date,
      });

      setEditingId(null);
      fetchGlorified();
    }

    function handleEdit(drop) {
      setEditingId(drop.id);
      setEdited({ ...drop });
    }

    return Object.keys(grouped).length === 0 ? (
      <p className="abyssalAnalytics-empty">No glorified drops recorded yet.</p>
    ) : (
      <>
        <table className="analytics-glorified-table">
          <thead>
            <tr>
              <th>Drop</th>
              <th>Date</th>
              <th>ISK</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(grouped).map(([name, drops]) => {
              return drops.map((drop, idx) => (
                <tr key={drop.id}>
                  <td>{idx === 0 ? name : ""}</td>
                  <td>
                    {editingId === drop.id ? (
                      <input
                        type="date"
                        value={edited.date || ""}
                        onChange={(e) =>
                          setEdited({ ...edited, date: e.target.value })
                        }
                      />
                    ) : (
                      drop.date
                    )}
                  </td>
                  <td>
                    {editingId === drop.id ? (
                      <input
                        type="number"
                        value={edited.isk_earned || ""}
                        onChange={(e) =>
                          setEdited({ ...edited, isk_earned: e.target.value })
                        }
                      />
                    ) : (
                      Number(drop.isk_earned || 0).toLocaleString()
                    )}
                  </td>
                  <td>
                    {editingId === drop.id ? (
                      <button
                        className="abyssalAnalytics-actionBtn"
                        onClick={handleUpdateGlorified}
                      >
                        💾
                      </button>
                    ) : (
                      <button
                        className="abyssalAnalytics-actionBtn"
                        onClick={() => handleEdit(drop)}
                      >
                        ✏️
                      </button>
                    )}
                    <button
                      className="abyssalAnalytics-actionBtn danger"
                      onClick={() => handleDeleteGlorified(drop.id)}
                    >
                      ❌
                    </button>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>

        <div className="abyssalAnalytics-totalRow">
          <div className="metric small">
            <div className="metric-label">Total Glorified ISK</div>
            <div className="metric-value">
              {totalGlorified.toLocaleString()} ISK
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="abyssalAnalytics-page">
      <div className="abyssalAnalytics-wrap">
        <h1 className="abyssalAnalytics-title">Abyssal Analytics</h1>

        <div className="analytics-summary abyssalAnalytics-card">
          <h2 className="abyssalAnalytics-sectionTitle">Summary Metrics</h2>

          <div className="abyssalAnalytics-metricsGrid">
            <div className="metric">
              <div className="metric-label">Total Runs</div>
              <div className="metric-value">{entries.length}</div>
            </div>

            <div className="metric">
              <div className="metric-label">Total Profit</div>
              <div className="metric-value">{totalProfit.toLocaleString()} ISK</div>
              <div className="metric-sub">
                Abyssals: {abyssalProfit.toLocaleString()} ISK + Glorified:{" "}
                {glorifiedProfit.toLocaleString()} ISK
              </div>
            </div>

            <div className="metric">
              <div className="metric-label">Average ISK / Hour</div>
              <div className="metric-value">{iskPerHour.toLocaleString()} ISK/hour</div>
            </div>

            <div className="metric">
              <div className="metric-label">Average ISK / Day</div>
              <div className="metric-value">{averageISKPerDay.toLocaleString()} ISK</div>
            </div>
          </div>

          <h3 className="abyssalAnalytics-subTitle">Profit Per Hour by Filament Type</h3>

          <div className="abyssalAnalytics-tableWrap">
            <table className="analytics-filament-table">
              <thead>
                <tr>
                  <th>Filament</th>
                  <th>Total Profit</th>
                  <th>ISK/hour</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(perFilament).map(
                  ([filament, { totalProfit, totalTimeHours }]) => {
                    const perHour = totalTimeHours > 0 ? totalProfit / totalTimeHours : 0;
                    return (
                      <tr key={filament}>
                        <td>{filament}</td>
                        <td>{totalProfit.toLocaleString()}</td>
                        <td>{perHour.toLocaleString()}</td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="analytics-glorified-section abyssalAnalytics-card">
          <h2 className="abyssalAnalytics-sectionTitle">Glorified Drops</h2>
          <GlorifiedDrops />
        </div>

        <div className="analytics-entries-section abyssalAnalytics-card">
          <h2 className="abyssalAnalytics-sectionTitle">Abyssals Entries</h2>
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
                  const profit =
                    entry.room1_isk +
                    entry.room2_isk +
                    entry.room3_isk -
                    entry.fillament_cost * mult;

                  return (
                    <tr key={entry.id}>
                      <td>
                        {editingId === entry.id ? (
                          <input
                            type="date"
                            value={editedEntry.date}
                            onChange={(e) =>
                              setEditedEntry({ ...editedEntry, date: e.target.value })
                            }
                          />
                        ) : (
                          entry.date
                        )}
                      </td>
                      <td>
                        {editingId === entry.id ? (
                          <input
                            type="number"
                            value={editedEntry.room1_isk}
                            onChange={(e) =>
                              setEditedEntry({ ...editedEntry, room1_isk: e.target.value })
                            }
                          />
                        ) : (
                          entry.room1_isk
                        )}
                      </td>
                      <td>
                        {editingId === entry.id ? (
                          <input
                            type="number"
                            value={editedEntry.room2_isk}
                            onChange={(e) =>
                              setEditedEntry({ ...editedEntry, room2_isk: e.target.value })
                            }
                          />
                        ) : (
                          entry.room2_isk
                        )}
                      </td>
                      <td>
                        {editingId === entry.id ? (
                          <input
                            type="number"
                            value={editedEntry.room3_isk}
                            onChange={(e) =>
                              setEditedEntry({ ...editedEntry, room3_isk: e.target.value })
                            }
                          />
                        ) : (
                          entry.room3_isk
                        )}
                      </td>
                      <td>
                        {editingId === entry.id ? (
                          <input
                            type="number"
                            value={editedEntry.time_taken}
                            onChange={(e) =>
                              setEditedEntry({ ...editedEntry, time_taken: e.target.value })
                            }
                          />
                        ) : (
                          `${entry.time_taken} mins`
                        )}
                      </td>
                      <td>
                        {editingId === entry.id ? (
                          <input
                            type="number"
                            value={editedEntry.fillament_cost}
                            onChange={(e) =>
                              setEditedEntry({
                                ...editedEntry,
                                fillament_cost: e.target.value,
                              })
                            }
                          />
                        ) : (
                          entry.fillament_cost
                        )}
                      </td>
                      <td>{profit.toLocaleString()} ISK</td>
                      <td>{`${entry.tier || ""} ${entry.storm_type || ""}`.trim()}</td>
                      <td>
                        {editingId === entry.id ? (
                          <select
                            value={editedEntry.ship_type}
                            onChange={(e) =>
                              setEditedEntry({ ...editedEntry, ship_type: e.target.value })
                            }
                          >
                            <option value="">—</option>
                            <option value="frigate">Frigate</option>
                            <option value="destroyer">Destroyer</option>
                            <option value="cruiser">Cruiser</option>
                          </select>
                        ) : (
                          entry.ship_type || "—"
                        )}
                      </td>
                      <td>
                        {editingId === entry.id ? (
                          <button className="abyssalAnalytics-actionBtn" onClick={handleUpdate}>
                            💾
                          </button>
                        ) : (
                          <button
                            className="abyssalAnalytics-actionBtn"
                            onClick={() => handleEdit(entry)}
                          >
                            ✏️
                          </button>
                        )}
                        <button
                          className="abyssalAnalytics-actionBtn danger"
                          onClick={() => handleDelete(entry.id)}
                        >
                          ❌
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
