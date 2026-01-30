import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import Navbar from "./components/Navbar";
import Dashboard from "./pages/Dashboard";
import Abyssals from "./pages/Abyssals";
import DED from "./pages/ded-tracking";
import Market from "./pages/Market";
import Misc from "./pages/Misc";
import Analytics from "./pages/AbyssalAnalytics";
import Overlay from "./pages/Overlay";
import PatchNotes from "./pages/PatchNotes";
import Settings from "./pages/settings";
import DEDAnalytics from "./pages/ded-analytics";
import BootGate from "./components/BootGate";
import EventTracking from "./pages/event-tracking";
import EventAnalytics from "./pages/event-analytics";
import IncursionTracker from "./pages/IncursionTracker";
import IncursionAnalytics from "./pages/IncursionAnalytics";
import UpdatePopup from "./components/UpdatePopup";
import OverallAnalytics from "./pages/OverallAnalytics";
import pkg from "../package.json";
import "./styles/global.css";

function normalizeVer(v) {
  return String(v || "")
    .trim()
    .replace(/^v/i, "")
    .split("+")[0]
    .split("-")[0];
}

function parseVerParts(v) {
  const s = normalizeVer(v);
  if (!s) return null;
  const parts = s.split(".").map((x) => {
    const n = Number(String(x).replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  });
  return parts.length ? parts : null;
}

function isNewerVersion(current, latest) {
  const c = parseVerParts(current);
  const l = parseVerParts(latest);
  if (!c || !l) return false;

  const max = Math.max(c.length, l.length);
  for (let i = 0; i < max; i++) {
    const cv = c[i] || 0;
    const lv = l[i] || 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}

async function fetchJsonWithTimeout(url, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const showNavbar = location.pathname !== "/overlay";

  const [updateOpen, setUpdateOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [updateUrl, setUpdateUrl] = useState("");

  const didRun = useRef(false);

  const forceUpdatePopup = useMemo(() => {
    const q = new URLSearchParams(location.search);
    if (q.get("forceUpdate") === "1") return true;
    return localStorage.getItem("forceUpdatePopup") === "true";
  }, [location.search]);

  useEffect(() => {
    if (didRun.current) return;
    didRun.current = true;

    const dismissed = localStorage.getItem("dismissedLatestVersion") || "";
    const lastCheck = Number(localStorage.getItem("lastUpdateCheckAt") || "0");
    const now = Date.now();

    const cooldownMs = 24 * 60 * 60 * 1000;
    const shouldCheck = forceUpdatePopup || now - lastCheck > cooldownMs;
    if (!shouldCheck) return;

    localStorage.setItem("lastUpdateCheckAt", String(now));

    const run = async () => {
      const latestJsonUrl =
        "https://raw.githubusercontent.com/EggyBoffer/Eve-Isk-Management/main/latest.json";

      const latest = await fetchJsonWithTimeout(latestJsonUrl, 5000);

      if (latest && (latest.version || latest.tag || latest.latest)) {
        const v = normalizeVer(latest.version || latest.tag || latest.latest);
        const url = String(latest.url || latest.downloadUrl || latest.html_url || "").trim();

        if (v) {
          setLatestVersion(v);
          setUpdateUrl(url || "https://github.com/EggyBoffer/Eve-Isk-Management/releases/latest");

          const outdated = isNewerVersion(pkg.version, v);
          if (!outdated) return;

          if (forceUpdatePopup || v !== dismissed) {
            setTimeout(() => setUpdateOpen(true), 250);
          }
          return;
        }
      }

      const api = await fetchJsonWithTimeout(
        "https://api.github.com/repos/EggyBoffer/Eve-Isk-Management/releases/latest",
        5000
      );

      const tag = normalizeVer(api?.tag_name);
      if (!tag) return;

      const url = api?.html_url || "";

      setLatestVersion(tag);
      setUpdateUrl(url);

      const outdated = isNewerVersion(pkg.version, tag);
      if (!outdated) return;

      if (forceUpdatePopup || tag !== dismissed) {
        setTimeout(() => setUpdateOpen(true), 250);
      }
    };

    run();
  }, [forceUpdatePopup]);

  function closeUpdate() {
    setUpdateOpen(false);
  }

  function laterUpdate() {
    if (latestVersion) localStorage.setItem("dismissedLatestVersion", latestVersion);
    setUpdateOpen(false);
  }

  function goPatchNotes() {
    setUpdateOpen(false);
    navigate("/patch-notes");
  }

  function doUpdate() {
    const url = updateUrl || "https://github.com/EggyBoffer/Eve-Isk-Management/releases/latest";
    window.api?.openExternal(url);
  }

  return (
    <>
      {showNavbar && <Navbar />}

      <UpdatePopup
        open={updateOpen && showNavbar}
        currentVersion={pkg.version}
        latestVersion={latestVersion}
        onClose={closeUpdate}
        onLater={laterUpdate}
        onGoPatchNotes={goPatchNotes}
        onUpdate={doUpdate}
      />

      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/abyssals" element={<Abyssals />} />
          <Route path="/ded-tracking" element={<DED />} />
          <Route path="/market" element={<Market />} />
          <Route path="/misc" element={<Misc />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/patch-notes" element={<PatchNotes />} />
          <Route path="/overlay" element={<Overlay />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ded-analytics" element={<DEDAnalytics />} />
          <Route path="/event-tracking" element={<EventTracking />} />
          <Route path="/event-analytics" element={<EventAnalytics />} />
          <Route path="/incursions" element={<IncursionTracker />} />
          <Route path="/incursions/analytics" element={<IncursionAnalytics />} />
          <Route path="/overall-analytics" element={<OverallAnalytics />} />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <BootGate>
      <AppContent />
    </BootGate>
  );
}
