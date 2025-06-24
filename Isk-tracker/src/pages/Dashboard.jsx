import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="dashboard-container">
      {/* Overlay Launch */}
      <button className="overlay-launch-btn" onClick={() => window.api.openOverlay()}>
        🚀 Overlay
      </button>

      {/* Centered title */}
      <h1 className="dashboard-title">ISK Tracker</h1>
      <p className="dashboard-subtitle">Your EVE Online ISK management hub</p>

      {/* Left-aligned links */}
      <div className="dashboard-links">
        <button onClick={() => navigate("/abyssals")}>Abyssals</button>
        <button onClick={() => navigate("/industry")}>Industry</button>
        <button onClick={() => navigate("/market")}>Market</button>
        <button onClick={() => navigate("/misc")}>Misc</button>
        <button onClick={() => navigate("/analytics")}>Analytics</button>
      </div>

      {/* Patch Notes and version */}
      <div className="dashboard-footer">
        <button className="patch-notes-btn" onClick={() => navigate("/patch-notes")}>Patch Notes</button>
        <span className="version-label">Version 1.0.0</span>
      </div>
    </div>
  );
}