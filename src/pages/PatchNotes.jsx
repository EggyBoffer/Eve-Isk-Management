import { useNavigate } from "react-router-dom";

export default function PatchNotes() {
  const navigate = useNavigate();

  const patches = [
    {
      version: "0.0.2",
      date: "2025-06-25",
      changes: [
        "Update for way overlay loads to improve functionality in the long run.",
        "Added a fillament selector to the dashboard for when you launch the overlay.", 
        "Added fillament cost to the overlay to save the fillament you select when launching the overlay." ,
        "Added version control and automatic update checks."
      ]
    },
    {
      version: "0.0.1",
      date: "2025-06-23",
      changes: [
        "Bug fixes for delete/edit in Abyssals page.",
        "Styling improvements for smaller entry cards and scrollbars.",
        "Drag and close improvements for the Overlay."
      ]
    },
    {
      version: "0.0.1",
      date: "2025-06-22",
      changes: [
        "Initial release of the ISK Tracker!",
        "Dashboard, Abyssals tracker, and Overlay fully functional.",
        "Analytics page with total profit, ISK/hour calculations, and entry management."
      ]
    },
    
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
