import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";

export default function PatchNotes() {
  const navigate = useNavigate();

  const patches = [
    {
      version: "0.1.0",
      date: "2025-09-19",
      changes: [
        "In preparation for the DED tracker, the Abyssal Analytics button has been moved to the Abyssals page to separate the Analytics sections.",
        "**New Feature** - DED Tracker",
        "Added the DED Tracker, a tool to track income from DED sites. Includes market prices pulled directly from the EVE API (Jita).",
        "Added a cargo parser to the DED Tracker, allowing you to copy and paste your loot can directly into the app to track income.",
        "Updated backend logic for pulling Jita prices. This new system will also be applied to the Abyssals section in the future.",
        "**New Feature** - DED Analytics",
        "DED Analytics provide insights into drop rates, item percentages, ISK/hour, ISK/run, and other key statistics.",
        "Improved the way Abyssal run data is stored for better long-term reliability.",
        "Updated app loading: market prices now refresh automatically during initialization, ensuring up-to-date valuations on startup.",
        "Settings now include options specifically for the DED tracker.",
        "Improvements to the loading model."
      ]
    },
    {
      version: "0.0.8",
      date: "2025-07-10",
      changes: [
        "Fix to fatal error caused by discord button."
      ]
    },
    {
      version: "0.0.7",
      date: "2025-07-10",
      changes: [
        "Fix for the Unknown filament error when adding abyssal entries.",
        "Fix for sorting in the abyssals analytics.",
        "Fix for a odd bug that caused the glorified tracker to glitch out and become unusable after adding one drop.",
        "Added a new setting to allow you to change the default filament tier and storm type.",
        "Fixed an issue where you were unable to edit abyssal entries on analytics page.",
        "Added version check to ensure up to date, This was added minimally before but it never worked, it should now work as expected.",
        "Added a discord button to the top of the dashboard, This will allow you to join the community discord.",
        "Added the option to pick between Frigate, cruiser and destroyer for the abyssal entries, This will allow you to track your abyssal runs more accurately.",
        "Improved calculation logic to calculate isk/hour more accurately, Including the cost of the filaments.",
        "Added Per ship tracking to Analytics",
        "Added default ship type setting.",
        "Polished the UI for the settings page.",
        "Added an ISK/day Summary metric, This will allow you to see how much ISK you are making per day.",
        "ISK/Day will show the last 4 Days, With an average."
      ]
    },
    {
      version: "0.0.5 + 0.0.6",
      date: "2025-07-01",
      changes: [
        "Some changes to the backend to improve workflows.",
        "Some changes to the readme to add preformance metrics",
        "Some discord integrations coming soon to the community discord. Link will be provided soon!",
        "No frontend changes in this patch, but backend changes to improve performance and stability.",
      ]
    },
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
                <li key={i}>
                  ✅ <ReactMarkdown>{change}</ReactMarkdown>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button className="patch-notes-btn" onClick={() => navigate("/")}>
        Back to Dashboard
      </button>
    </div>
  );
}
