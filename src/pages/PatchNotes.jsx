import { useNavigate } from "react-router-dom";

export default function PatchNotes() {
  const navigate = useNavigate();

  const patches = [
    {
      version: "0.0.4",
      date: "2025-06-27",
      changes: [
        "App renamed to ISKONOMY!",
        "Added logo to app to match new name!",
        "Fix an issue with scrollbar showing on overlay, This should no longer show.",
        "Fix an issue with editing entries not working, This should now function as expected.",
        "Added Settings page, and removed the old toolbar from the app.",
        "Added a setting to allow you to change the default filament tier and storm type.",
        "Fixed an issue with dragging the overlay, It should now work as expected.",
        "Added a glorified tracker to the app, This will allow you to track your glorified drops.",
        "Due to some file structure changes, App may have lost all previous data, This is a one time thing, and will not happen again.",
        "Updated analytics page to show total profit from both abyssals and glorified drops.",
        "Added Glorified tracker to the analytics page, This will allow you to see your total glorified drops.",
        "Added Splash Screen to the app, This will show when the app is loading.",
        "Added better image processing for the app, This will improve the performance of the app.",
        "Added a info screen that loads of first launch of the overlay, Explaining how to use the overlay. You can turn this off in the settings, and will only display once.",
        "Changed the way the overlay loads, This will improve the performance of the overlay.",
        "Added some cool loading animations to the splash screen.",

      ]
    },
    {
      version: "0.0.3",
      date: "2025-06-26",
      changes: [
        "Added scroll bar to Analytics page to handle large data sets.",
        "Fixed a minor issue with analytics page.",
        "Fixed a minor issue with the Dashboard and Abyssals page having more space used than it needed.",
        "Limited 'Abyssals Entries' page to only show 4 entries at a time, Then scroll for the rest to improve readability.",
      ]
    },
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
