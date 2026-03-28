import { NavLink, useNavigate } from "react-router-dom";
import { Settings, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import iskonomylogo from "../assets/iskonomy.png";
import "../styles/navbar.css";

export default function Navbar() {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    function onDocClick(e) {
      if (!moreRef.current) return;
      if (!moreRef.current.contains(e.target)) setMoreOpen(false);
    }

    function onKey(e) {
      if (e.key === "Escape") setMoreOpen(false);
    }

    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return (
    <nav className="navbar">
      <div className="navbar__container">
        <div className="navbar__brand">
          <img src={iskonomylogo} alt="ISKonomy logo" className="navbar__logo" />
          <div className="navbar__title">ISKONOMY</div>
        </div>

        <div className="navbar__links">
          <NavLink
            to="/"
            className={({ isActive }) =>
              "navbar__link" + (isActive ? " navbar__link--active" : "")
            }
          >
            Dashboard
          </NavLink>

          <NavLink
            to="/abyssals"
            className={({ isActive }) =>
              "navbar__link" + (isActive ? " navbar__link--active" : "")
            }
          >
            Abyssals
          </NavLink>

          <NavLink
            to="/ded-tracking"
            className={({ isActive }) =>
              "navbar__link" + (isActive ? " navbar__link--active" : "")
            }
          >
            DED!
          </NavLink>

          <NavLink
            to="/incursions"
            className={({ isActive }) =>
              "navbar__link" + (isActive ? " navbar__link--active" : "")
            }
          >
            Incursions
          </NavLink>

          <NavLink
            to="/crabs"
            className={({ isActive }) =>
              "navbar__link" + (isActive ? " navbar__link--active" : "")
            }
          >
            CRABs
          </NavLink>

          <div ref={moreRef} className="navbar__more">
            <button
              type="button"
              className={"navbar__moreBtn" + (moreOpen ? " navbar__moreBtn--open" : "")}
              onClick={() => setMoreOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={moreOpen ? "true" : "false"}
            >
              More <ChevronDown size={16} />
            </button>

            {moreOpen && (
              <div className="navbar__dropdown" role="menu">
                <button
                  type="button"
                  className="navbar__dropdownItem"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate("/overall-analytics");
                  }}
                  role="menuitem"
                >
                  Overall Stats
                </button>

                <button
                  type="button"
                  className="navbar__dropdownItem"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate("/misc");
                  }}
                  role="menuitem"
                >
                  Misc
                </button>

                <button
                  type="button"
                  className="navbar__dropdownItem"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate("/market");
                  }}
                  role="menuitem"
                >
                  Market
                </button>
              </div>
            )}
          </div>

          <NavLink
            to="/settings"
            className={({ isActive }) =>
              "navbar__iconLink" + (isActive ? " navbar__iconLink--active" : "")
            }
            aria-label="Settings"
            title="Settings"
          >
            <Settings size={20} />
          </NavLink>
        </div>
      </div>
    </nav>
  );
}