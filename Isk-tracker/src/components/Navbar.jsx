import { NavLink } from "react-router-dom";

export default function Navbar() {
  return (
    <nav style={navStyle}>
      <div style={containerStyle}>
        <div style={logoStyle}>ISK Tracker</div>
        <div style={linksStyle}>
          <NavLink to="/dashboard" style={linkStyle} activeStyle={activeLinkStyle}>
            Dashboard
          </NavLink>
          <NavLink to="/abyssals" style={linkStyle} activeStyle={activeLinkStyle}>
            Abyssals
          </NavLink>
          <NavLink to="/industry" style={linkStyle} activeStyle={activeLinkStyle}>
            Industry
          </NavLink>
          <NavLink to="/market" style={linkStyle} activeStyle={activeLinkStyle}>
            Market
          </NavLink>
          <NavLink to="/misc" style={linkStyle} activeStyle={activeLinkStyle}>
            Misc
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

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
};

const linksStyle = {
  display: "flex",
  gap: "20px",
};

const linkStyle = {
  color: "#ccc",
  textDecoration: "none",
  fontWeight: "500",
};

const activeLinkStyle = {
  color: "#fff",
  borderBottom: "2px solid #61dafb",
};
