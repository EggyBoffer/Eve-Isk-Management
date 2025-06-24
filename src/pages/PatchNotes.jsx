import { useNavigate } from "react-router-dom";

export default function PatchNotes() {
  const navigate = useNavigate();

  const patches = [
    {
      version: "1.0.0",
      date: "2025-06-22",
      changes: [
        "Initial release of the ISK Tracker!",
        "Dashboard, Abyssals tracker, and Overlay fully functional.",
        "Analytics page with total profit, ISK/hour calculations, and entry management."
      ]
    },
    {
      version: "1.0.1",
      date: "2025-06-23",
      changes: [
        "Bug fixes for delete/edit in Abyssals page.",
        "Styling improvements for smaller entry cards and scrollbars.",
        "Drag and close improvements for the Overlay."
      ]
    }
    // Add more patches as your app evolves!
  ];

  return (
    <div className="patchnotes-container">
      <h1 style={{ textAlign: "center", color: "#61dafb" }}>Patch Notes</h1>
      <div className="patchnotes-list">
        {patches.map((patch) => (
          <div key={patch.version} className="patchnote-card">
            <h2>{patch.version} — {patch.date}</h2>
            <ul>
              {patch.changes.map((change, i) => (
                <li key={i}>✅ {change}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button className="patch-notes-btn" onClick={() => navigate("/")}>Back to Dashboard</button>
    </div>
  );
}
