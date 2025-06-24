// App.jsx
import { Routes, Route, useLocation } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Abyssals from "./pages/Abyssals";
import Industry from "./pages/Industry";
import Market from "./pages/Market";
import Misc from "./pages/Misc";
import Analytics from "./pages/Analytics";
import Overlay from "./pages/Overlay";
import PatchNotes from "./pages/PatchNotes";
import "./styles/global.css";

export default function App() {
  const location = useLocation();
  const showNavbar = location.pathname !== "/overlay";

  return (
    <>
      {showNavbar && <Navbar />}
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/abyssals" element={<Abyssals />} />
          <Route path="/industry" element={<Industry />} />
          <Route path="/market" element={<Market />} />
          <Route path="/misc" element={<Misc />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/overlay" element={<Overlay />} />
          <Route path="/patch-notes" element={<PatchNotes />} />
        </Routes>
      </main>
    </>
  );
}
