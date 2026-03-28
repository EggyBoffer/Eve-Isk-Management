import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  useEffect(() => {
    fetchEntries();
    fetchGlorified();
  }, []);

  async function fetchEntries() {
    const data = await window.api.getEntries("abyssals");
    setEntries(Array.isArray(data) ? data : []);
  }

  async function fetchGlorified() {
    const data = await window.api.getGlorified();
    setGlorified(Array.isArray(data) ? data : []);
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

  function getEntryProfit(entry) {
    const mult = getShipMultiplier(entry.ship_type);
    return (
      Number(entry.room1_isk || 0) +
      Number(entry.room2_isk || 0) +
      Number(entry.room3_isk || 0) -
      Number(entry.fillament_cost || 0) * mult
    );
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

  const sortedEntries = useMemo(() => {
    return [...entries].sort((a, b) => {
      const dir = sortDirection === "asc" ? 1 : -1;
      switch (sortBy) {
        case "profit":
          return dir * (getEntryProfit(a) - getEntryProfit(b));
        case "time":
          return dir * (Number(a.time_taken || 0) - Number(b.time_taken || 0));
        case "tier":
          return (
            dir *
            ((parseInt(a.tier?.replace("T", "")) || 0) -
              (parseInt(b.tier?.replace("T", "")) || 0))
          );
        case "storm_type":
          return dir * (a.storm_type || "").localeCompare(b.storm_type || "");
        case "date":
        default:
          return dir * (new Date(a.date) - new Date(b.date));
      }
    });
  }, [entries, sortBy, sortDirection]);

  const abyssalProfit = useMemo(
    () => entries.reduce((sum, entry) => sum + getEntryProfit(entry), 0),
    [entries]
  );

  const glorifiedProfit = useMemo(
    () => glorified.reduce((sum, drop) => sum + Number(drop.isk_earned || 0), 0),
    [glorified]
  );

  const totalProfit = abyssalProfit + glorifiedProfit;

  const totalTimeHours = useMemo(
    () => entries.reduce((sum, entry) => sum + Number(entry.time_taken || 0) / 60, 0),
    [entries]
  );

  const iskPerHour = totalTimeHours > 0 ? abyssalProfit / totalTimeHours : 0;

  const perFilamentRows = useMemo(() => {
    const grouped = entries.reduce((acc, entry) => {
      if (!entry.tier || !entry.storm_type) return acc;
      const filamentName = `${entry.tier} ${entry.storm_type}`.trim();
      const profit = getEntryProfit(entry);
      const timeHours = Number(entry.time_taken || 0) / 60;

      if (!acc[filamentName]) {
        acc[filamentName] = {
          filament: filamentName,
          totalProfit: 0,
          totalTimeHours: 0,
          runs: 0,
        };
      }

      acc[filamentName].totalProfit += profit;
      acc[filamentName].totalTimeHours += timeHours;
      acc[filamentName].runs += 1;
      return acc;
    }, {});

    return Object.values(grouped)
      .map((item) => ({
        ...item,
        iskPerHour: item.totalTimeHours > 0 ? item.totalProfit / item.totalTimeHours : 0,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit);
  }, [entries]);

  const totalProfitByFilamentData = useMemo(
    () => perFilamentRows.map((item) => ({ label: item.filament, value: item.totalProfit })),
    [perFilamentRows]
  );

  const runsByFilamentData = useMemo(
    () => perFilamentRows.map((item) => ({ label: item.filament, value: item.runs })),
    [perFilamentRows]
  );

  const profitByDate = useMemo(() => {
    const grouped = {};
    entries.forEach((entry) => {
      const profit = getEntryProfit(entry);
      const date = entry.date;
      if (!grouped[date]) grouped[date] = 0;
      grouped[date] += profit;
    });
    return grouped;
  }, [entries]);

  const last4Days = useMemo(
    () =>
      Object.entries(profitByDate)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .slice(0, 4),
    [profitByDate]
  );

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
                  <td className="analytics-glorified-actionsCell">
                    <div className="analytics-glorified-actions">
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
                    </div>
                  </td>
                </tr>
              ));
            })}
          </tbody>
        </table>

        <div className="abyssalAnalytics-totalRow">
          <div className="metric small">
            <div className="metric-label">Total Glorified ISK</div>
            <div className="metric-value">{totalGlorified.toLocaleString()} ISK</div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="abyssalAnalytics-page">
      <div className="abyssalAnalytics-wrap">
        <div className="abyssalAnalytics-header">
          <h1 className="abyssalAnalytics-title">Abyssal Analytics</h1>
          <div className="abyssalAnalytics-navRow">
            <button
              type="button"
              className="abyssalAnalytics-navBtn abyssalAnalytics-navBtn--secondary"
              onClick={() => navigate("/abyssals")}
            >
              ← Tracker
            </button>
          </div>
        </div>

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

          <div
            className="abyssalAnalytics-graphsGrid"
            style={{ gridTemplateColumns: "1fr" }}
          >
            <GraphCard title="Earnings per Fillament">
              <VerticalBarChart
                data={totalProfitByFilamentData}
                emptyLabel="No filament profit data yet."
                valueFormatter={formatCompactISK}
              />
            </GraphCard>

            <GraphCard title="Runs by Filament">
              <VerticalBarChart
                data={runsByFilamentData}
                emptyLabel="No filament run data yet."
                valueFormatter={formatInteger}
              />
            </GraphCard>
          </div>

          <div className="abyssalAnalytics-tableWrap">
            <table className="analytics-filament-table">
              <thead>
                <tr>
                  <th>Filament</th>
                  <th>Runs</th>
                  <th>Total Profit</th>
                  <th>ISK/hour</th>
                </tr>
              </thead>
              <tbody>
                {perFilamentRows.length ? (
                  perFilamentRows.map((item) => (
                    <tr key={item.filament}>
                      <td>{item.filament}</td>
                      <td>{item.runs.toLocaleString()}</td>
                      <td>{item.totalProfit.toLocaleString()}</td>
                      <td>{item.iskPerHour.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="abyssalAnalytics-emptyCell">
                      No filament analytics yet.
                    </td>
                  </tr>
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
          <h2 className="abyssalAnalytics-sectionTitle">Run history</h2>
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
                  const profit = getEntryProfit(entry);

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

function GraphCard({ title, subtitle, children }) {
  return (
    <section className="abyssalAnalytics-graphCard">
      <div className="abyssalAnalytics-graphHead">
        <h3>{title}</h3>
        <div className="abyssalAnalytics-graphSubTitle">{subtitle}</div>
      </div>
      {children}
    </section>
  );
}

function VerticalBarChart({ data, valueFormatter, emptyLabel }) {
  if (!data.length) {
    return <div className="abyssalAnalytics-chartEmpty">{emptyLabel}</div>;
  }

  const chartWidth = 1200;
  const chartHeight = 360;
  const padTop = 38;
  const padRight = 32;
  const padBottom = 90;
  const padLeft = 120;
  const innerWidth = chartWidth - padLeft - padRight;
  const innerHeight = chartHeight - padTop - padBottom;
  const maxValue = Math.max(...data.map((item) => item.value), 1);
  const tickCount = 4;
  const stepX = innerWidth / data.length;
  const barWidth = Math.max(48, Math.min(140, stepX * 0.42));

  return (
    <div className="abyssalAnalytics-chartShell">
      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="abyssalAnalytics-chartSvg"
        role="img"
      >
        <defs>
          <linearGradient id="abyssalAnalyticsBarGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#61dafb" />
            <stop offset="100%" stopColor="#7b8cff" />
          </linearGradient>
        </defs>

        <line
          x1={padLeft}
          y1={padTop}
          x2={padLeft}
          y2={padTop + innerHeight}
          className="abyssalAnalytics-axis"
        />
        <line
          x1={padLeft}
          y1={padTop + innerHeight}
          x2={padLeft + innerWidth}
          y2={padTop + innerHeight}
          className="abyssalAnalytics-axis"
        />

        {Array.from({ length: tickCount + 1 }).map((_, index) => {
          const ratio = index / tickCount;
          const y = padTop + innerHeight - ratio * innerHeight;
          const tickValue = maxValue * ratio;
          return (
            <g key={index}>
              <line
                x1={padLeft}
                y1={y}
                x2={padLeft + innerWidth}
                y2={y}
                className="abyssalAnalytics-gridLine"
              />
              <text
                x={padLeft - 16}
                y={y + 5}
                textAnchor="end"
                className="abyssalAnalytics-tickText"
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                {valueFormatter(tickValue)}
              </text>
            </g>
          );
        })}

        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * innerHeight;
          const x = padLeft + stepX * index + (stepX - barWidth) / 2;
          const y = padTop + innerHeight - barHeight;
          const centerX = x + barWidth / 2;

          return (
            <g key={item.label}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 10)}
                rx="12"
                fill="url(#abyssalAnalyticsBarGradient)"
              />
              <text
                x={centerX}
                y={Math.max(y - 12, 24)}
                textAnchor="middle"
                className="abyssalAnalytics-valueText"
                style={{ fontSize: 12, fontWeight: 800 }}
              >
                {valueFormatter(item.value)}
              </text>
              <text
                x={centerX}
                y={padTop + innerHeight + 34}
                textAnchor="middle"
                className="abyssalAnalytics-labelText"
                style={{ fontSize: 12, fontWeight: 700 }}
              >
                {truncateLabel(item.label, 18)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function truncateLabel(value, maxLength) {
  if (!value) return "—";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function formatCompactISK(value) {
  return new Intl.NumberFormat("en-GB", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Math.round(value || 0));
}

function formatInteger(value) {
  return Math.round(value || 0).toLocaleString();
}