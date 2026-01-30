import { useNavigate } from "react-router-dom";
import "../styles/misc.css";

export default function Misc() {
  const navigate = useNavigate();

  const items = [
    { title: "Patch Notes", desc: "See what changed between releases.", onClick: () => navigate("/patch-notes"), pill: "Info" },
    { title: "Settings", desc: "Configure options and manage app behaviour.", onClick: () => navigate("/settings"), pill: "App" },
    { title: "Abyssal Analytics", desc: "Break down your Abyssal performance over time.", onClick: () => navigate("/analytics"), pill: "Stats" },
    { title: "DED Analytics", desc: "Performance breakdown for DED runs.", onClick: () => navigate("/ded-analytics"), pill: "Stats" },
    { title: "Incursion Analytics", desc: "Track ISK/LP trends for incursions.", onClick: () => navigate("/incursions/analytics"), pill: "Stats" },
    { title: "Discord", desc: "Join the community and get help.", onClick: () => window.api?.openExternal("https://discord.gg/M87HtnjBYg"), pill: "Link" },
    { title: "GitHub Discussions", desc: "Feature requests, bugs, and suggestions.", onClick: () => window.api?.openExternal("https://github.com/EggyBoffer/Eve-Isk-Management/discussions"), pill: "Link" },
  ];

  return (
    <div className="misc-page">
      <div className="misc-wrap">
        <div className="misc-header">
          <div>
            <div className="misc-title">Misc</div>
            <div className="misc-subtitle">Utilities, links, and analytics shortcuts.</div>
          </div>
        </div>

        <div className="misc-grid">
          {items.map((it) => (
            <button key={it.title} type="button" className="misc-card" onClick={it.onClick}>
              <div className="misc-cardHeader">
                <div className="misc-cardTitle">{it.title}</div>
                <div className={"misc-pill " + pillClass(it.pill)}>{it.pill}</div>
              </div>
              <div className="misc-cardDesc">{it.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function pillClass(kind) {
  if (kind === "Link") return "misc-pill--link";
  if (kind === "Stats") return "misc-pill--stats";
  if (kind === "App") return "misc-pill--app";
  return "misc-pill--info";
}
