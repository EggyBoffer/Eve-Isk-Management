import { NavLink } from "react-router-dom";
import { Settings } from "lucide-react";
import iskonomylogo from "../assets/iskonomy.png";


export default function Navbar() {
  return (
    <nav style={navStyle}>
      <div style={containerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <img
          src={iskonomylogo}
          alt="ISKonomy logo"
          style={{ height: "55px", width: "70px", objectFit: "contain" }}
        />
        <div style={logoStyle}>ISKONOMY</div>
      </div>
        <div style={linksStyle}>
          <NavLink
            to="/"
            style={({ isActive }) => ({
              ...linkStyle,
              color: isActive ? "#fff" : "#ccc",
              borderBottom: isActive ? "2px solid #61dafb" : "2px solid transparent",
            })}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/abyssals"
            style={({ isActive }) => ({
              ...linkStyle,
              color: isActive ? "#fff" : "#ccc",
              borderBottom: isActive ? "2px solid #61dafb" : "2px solid transparent",
            })}
          >
            Abyssals
          </NavLink>
          <NavLink
            to="/ded-tracking"
            style={({ isActive }) => ({
              ...linkStyle,
              color: isActive ? "#fff" : "#ccc",
              borderBottom: isActive ? "2px solid #61dafb" : "2px solid transparent",
            })}
          >
            DED!
          </NavLink>
          <NavLink
            to="/market"
            style={({ isActive }) => ({
              ...linkStyle,
              color: isActive ? "#fff" : "#ccc",
              borderBottom: isActive ? "2px solid #61dafb" : "2px solid transparent",
            })}
          >
            Market
          </NavLink>
          <NavLink
            to="/misc"
            style={({ isActive }) => ({
              ...linkStyle,
              color: isActive ? "#fff" : "#ccc",
              borderBottom: isActive ? "2px solid #61dafb" : "2px solid transparent",
            })}
          >
            Misc
          </NavLink>
          <NavLink to="/settings" style={getIconLinkStyle}>
            <Settings size={20} />
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

// Styles
const navStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  height: "60px",
  backgroundColor: "#1e1e2f",
  color: "white",
  display: "flex",
  alignItems: "center",
  boxShadow: "0 2px 5px rgba(0,0,0,0.2)",
  zIndex: 1000,
};

const containerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  width: "90%",
  maxWidth: "1200px",
  margin: "0 auto",
};

const logoStyle = {
  fontWeight: "bold",
  fontSize: "1.5rem",
  paddingLeft: "40px",
};

const linksStyle = {
  display: "flex",
  gap: "20px",
};

const linkStyle = {
  color: "#ccc",
  textDecoration: "none",
  fontWeight: "500",
  paddingBottom: "2px",
  transition: "color 0.3s ease, border-bottom 0.3s ease",
};

function getIconLinkStyle({ isActive }) {
  return {
    ...linkStyle,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 5px",
    color: isActive ? "#61dafb" : "#ccc",
    borderBottom: isActive ? "2px solid #61dafb" : "2px solid transparent",
  };
}
