import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Abyssals from "./pages/Abyssals";
import Industry from "./pages/Industry";
import Market from "./pages/Market";
import Misc from "./pages/Misc";
import Analytics from "./pages/Analytics";
import "./styles/global.css";

export default function App() {
  return (
    <Router>
      <Navbar />
      <main style={{ paddingTop: "70px" }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/abyssals" element={<Abyssals />} />
          <Route path="/industry" element={<Industry />} />
          <Route path="/market" element={<Market />} />
          <Route path="/misc" element={<Misc />} />
          <Route path="/analytics" element={<Analytics />} />
        </Routes>
      </main>
    </Router>
  );
}
