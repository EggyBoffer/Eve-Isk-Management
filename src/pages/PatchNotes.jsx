import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import pkg from "../../package.json";
import "../styles/patch-notes.css";

export default function PatchNotes() {
  const navigate = useNavigate();

  const patches = [
    {
      version: "0.4.0",
      date: "2026-01-29",
      changes: [
        "Visual Refresh.  The entire app has been resigned to look like an actual modern app and not a windows 98 tool.",
        "Removed Winter nexus - Event has been over for 2 weeks now. ",
        "Winter nexus has now been sidelined until next christmas!",
        "Fixed the update notification to be a bit cleaner.  Previous version was bugged for the last 3 updates so its finally fixed.",
        "Updated some of the logic in loading again to improve loading ",
        "Updated the popup for Abyssals to live on the abyssals page now. ",
        "Added overall statistics page to see what your highest income is, how much you've earnt and much more!",
        "Improved some calculations for isk/hour to look a little more precise",
        "Improved the settings page to be a bit more readable and useable rather than being a scrambled mess",
        "Lots of code improvements and optimisations to improve load speeds",
        "Added back end logging to help with future issues being troubleshooted.",
        "Preperations made for future troubleshooting support",
        "Added some final loading improvements to help with people launching after a long break!",
        "Happy new year all!",
      ],
    },
    {
      version: "0.3.2",
      date: "2025-12-21",
      changes: [
        "Fix for issue affecting Incursion isk/hour that would cause it to use inactive hours to calculate.",
      ],
    },
    {
      version: "0.3.0",
      date: "2025-12-19",
      changes: [
        "Improvements made to loading logic to fix the 'loading' bug you see in instances where the app is loading a lot of data.",
        "Loading should now be all completed during the splash screen not once the app is launched or when switching between pages.",
        "NEW FEATURE",
        "Incursion tracker - Copy your wallet logs directly in and see how much isk and LP you have earnt.",
        "Added highsec and Nullsec names for Winter Nexus",
        "Some Future proofing updates to help with longevity as the app grows.",
        "Some file system changes to help with future proofing. Please report any bugs you notice following from this.",
      ],
    },
    {
      version: "0.2.0",
      date: "2025-12-10",
      changes: [
        "HAPPY HOLIDAYS FROM THE ISKONOMY TEAM!",
        "Added Event tracker for Winter Nexus.",
        "Track your isk/hour from the Winter Nexus event sites!",
        "In the new year, We will be working hard to bring the Exploration tracker and Market tracker.",
      ],
    },
    {
      version: "0.1.2",
      date: "2025-09-28",
      changes: [
        "Change to the logic for how we calculate Drop %. This should resolve drop percentage being totaled and no individual to DED's",
        "Added a DED Level filter to DED Analytics.",
      ],
    },
    {
      version: "0.1.1",
      date: "2025-09-20",
      changes: ["Fix to a error behind the scenes."],
    },
    {
      version: "0.1.0",
      date: "2025-09-19",
      changes: ["In preparation for the app grow, we moved the structure around."],
    },
    {
      version: "0.0.9",
      date: "2025-08-12",
      changes: [
        "Update notification improvements.",
        "Bug fixes for delete/edit in Abyssals page.",
        "Styling improvements for smaller entry cards and scrollbars.",
        "Drag and close improvements for the Overlay.",
      ],
    },
    {
      version: "0.0.1",
      date: "2025-06-22",
      changes: [
        "Initial release of the ISK Tracker!",
        "Dashboard, Abyssals tracker, and Overlay fully functional.",
        "Analytics page with total profit, ISK/hour calculations, and entry management.",
      ],
    },
  ];

  const sorted = useMemo(() => {
    return [...patches].sort((a, b) => new Date(b.date) - new Date(a.date));
  }, []);

  return (
    <div className="patchNotes-page">
      <div className="patchNotes-wrap">
        <div className="patchNotes-hero">
          <div className="patchNotes-heroTitle">Patch Notes</div>
          <div className="patchNotes-heroMeta">
            Installed: <span className="patchNotes-pill">v{pkg.version}</span>
            <span className="patchNotes-sep">•</span>
            Entries: <span className="patchNotes-pill">{sorted.length}</span>
          </div>

          <div className="patchNotes-heroActions">
            <button
              type="button"
              className="patchNotes-btn"
              onClick={() => navigate("/")}
            >
              Back to Dashboard
            </button>
          </div>
        </div>

        <div className="patchNotes-list">
          {sorted.map((patch) => (
            <div key={patch.version} className="patchNotes-card">
              <div className="patchNotes-cardHeader">
                <div className="patchNotes-version">
                  <span className="patchNotes-versionBadge">v{patch.version}</span>
                  <span className="patchNotes-date">{patch.date}</span>
                </div>
              </div>

              <ul className="patchNotes-changes">
                {patch.changes.map((change, i) => (
                  <li key={i} className="patchNotes-changeItem">
                    <span className="patchNotes-bullet">✅</span>
                    <span className="patchNotes-changeText">
                      <ReactMarkdown>{change}</ReactMarkdown>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
