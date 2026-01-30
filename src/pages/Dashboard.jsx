import { useNavigate } from "react-router-dom";
import { useState } from "react";
import pkg from "../../package.json";
import "../styles/dashboard.css";

export default function Dashboard() {
  const navigate = useNavigate();
  const [supportOpen, setSupportOpen] = useState(false);

  const cards = [
    {
      title: "Abyssals",
      desc: "Track runs, filament cost, profit, and glorified drops.",
      to: "/abyssals",
      pill: "Active",
    },
    {
      title: "Incursions",
      desc: "Paste wallet ticks and track ISK/LP across sites.",
      to: "/incursions",
      pill: "Active",
    },
    {
      title: "DED!",
      desc: "Log DED runs and compare profits over time.",
      to: "/ded-tracking",
      pill: "Active",
    },
    {
      title: "Overall Stats",
      desc: "All analytics combined into one big overview page.",
      to: "/overall-analytics",
      pill: "Tools",
    },
    {
      title: "Market",
      desc: "Market utilities and pricing helpers.",
      to: "/market",
      pill: "Tools",
    },
    {
      title: "Misc",
      desc: "Utilities, links, and app extras.",
      to: "/misc",
      pill: "Tools",
    },
  ];

  return (
    <div className="dashboard-container dashboard-page">
      <div className="dashboard-wrap">
        <div className="dashboard-hero">
          <div className="dashboard-heroInner">
            <div className="dashboard-heroText">
              <div className="dashboard-title">ISKONOMY</div>
              <div className="dashboard-subtitle">From plex to profit—stay in control.</div>
            </div>

            <button
              type="button"
              className="dashboard-discordBtn"
              onClick={() => window.api?.openExternal("https://discord.gg/M87HtnjBYg")}
            >
              <img
                src="https://cdn.jsdelivr.net/gh/edent/SuperTinyIcons/images/svg/discord.svg"
                alt="Join Discord"
                className="dashboard-discordIcon"
              />
              Join Discord
            </button>
          </div>
        </div>

        <div className="dashboard-sectionTitle">Quick Launch</div>

        <div className="dashboard-grid">
          {cards.map((c) => (
            <button
              key={c.title}
              type="button"
              className="dashboard-card"
              onClick={() => navigate(c.to)}
            >
              <div className="dashboard-cardHeader">
                <div className="dashboard-cardTitle">{c.title}</div>
                <div
                  className={
                    "dashboard-pill " +
                    (c.pill === "Tools" ? "dashboard-pill--tools" : "dashboard-pill--active")
                  }
                >
                  {c.pill}
                </div>
              </div>
              <div className="dashboard-cardDesc">{c.desc}</div>
            </button>
          ))}
        </div>

        <div className="dashboard-footer">
          <button
            type="button"
            className="dashboard-patchBtn"
            onClick={() => navigate("/patch-notes")}
          >
            Patch Notes
          </button>

          <div className="dashboard-metaRow">
            <div className="dashboard-version">Version {pkg.version}</div>

            <div className="dashboard-support">
              <button
                type="button"
                className="dashboard-supportBtn"
                onClick={() => setSupportOpen((v) => !v)}
                title="Support Development"
              >
                💖
              </button>

              {supportOpen && (
                <div className="dashboard-supportTooltip">
                  <p className="dashboard-supportText">
                    Help out on{" "}
                    <a
                      href="https://github.com/EggyBoffer/Eve-Isk-Management/discussions"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      GitHub
                    </a>
                    <br />
                    or donate ISK to <strong>ISKONOMY Corporation</strong>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
