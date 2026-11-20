
import { Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, X, ChartNoAxesColumnIncreasing } from "lucide-react";
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
import DEDGraphs from "./pages/ded-graphs";
import BootGate from "./components/BootGate";
import EventTracking from "./pages/event-tracking";
import EventAnalytics from "./pages/event-analytics";
import IncursionTracker from "./pages/IncursionTracker";
import IncursionAnalytics from "./pages/IncursionAnalytics";
import UpdatePopup from "./components/UpdatePopup";
import OverallAnalytics from "./pages/OverallAnalytics";
import OverallGraphs from "./pages/overall-graphs";
import CrabTracker from "./pages/CrabTracker";
import CrabAnalytics from "./pages/CrabAnalytics";
import CrabGraphs from "./pages/crab-graphs";
import ESIConnections from "./pages/esi/ESIConnections";
import FobTracker from "./pages/fob/FobTracker";
import Killmails from "./pages/killmails/Killmails";
import OfficerTracker from "./pages/officers/OfficerTracker";
import OfficerAnalytics from "./pages/officers/OfficerAnalytics";
import pkg from "../package.json";
import "./styles/global.css";

const ESI_LINK_EVENT = "iskonomy:esi-link";

const ESI_LINK_ACTIONS = {
  character: {
    title: "Linking EVE Character",
    method: "esiLinkCharacter",
  },
  corporation: {
    title: "Linking EVE Corporation",
    method: "esiLinkCorporation",
  },
  "killmail-character": {
    title: "Linking Personal Killmails",
    method: "esiLinkKillmail",
    sourceType: "character",
  },
  "killmail-corporation": {
    title: "Linking Corporation Killmails",
    method: "esiLinkKillmail",
    sourceType: "corporation",
  },
};

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
  let timeoutId;

  try {
    const request = window.api.requestApi({ url });

    const timeout = new Promise((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error("Request timed out")),
        ms
      );
    });

    const res = await Promise.race([request, timeout]);

    if (!res?.ok) return null;

    return res.data ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function AppRoutes() {
  return (
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
      <Route path="/ded-graphs" element={<DEDGraphs />} />
      <Route path="/event-tracking" element={<EventTracking />} />
      <Route path="/event-analytics" element={<EventAnalytics />} />
      <Route path="/incursions" element={<IncursionTracker />} />
      <Route path="/incursions/analytics" element={<IncursionAnalytics />} />
      <Route path="/overall-analytics" element={<OverallAnalytics />} />
      <Route path="/overall-graphs" element={<OverallGraphs />} />
      <Route path="/crabs" element={<CrabTracker />} />
      <Route path="/crabs/analytics" element={<CrabAnalytics />} />
      <Route path="/crabs/graphs" element={<CrabGraphs />} />
      <Route path="/esi-connections" element={<ESIConnections />} />
      <Route path="/fobs" element={<FobTracker />} />
      <Route path="/killmails" element={<Killmails />} />
      <Route path="/officers" element={<OfficerTracker />} />
      <Route path="/officers/analytics" element={<OfficerAnalytics />} />
    </Routes>
  );
}

function TelemetryDisclosure({ onContinue, saving, error }) {
  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 20000,
        background: "rgba(3, 8, 17, 0.88)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="telemetry-disclosure-title"
        aria-describedby="telemetry-disclosure-description"
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#151e2b",
          border: "1px solid #40516a",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.55)",
          color: "#eef3fa",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 18,
          }}
        >
          <ChartNoAxesColumnIncreasing
            size={26}
            color="#7dd3fc"
          />
          <h2
            id="telemetry-disclosure-title"
            style={{
              margin: 0,
              fontSize: 21,
              fontWeight: 700,
            }}
          >
            Help Improve ISKONOMY
          </h2>
        </div>

        <div
          id="telemetry-disclosure-description"
          style={{
            fontSize: 14,
            lineHeight: 1.7,
            color: "#cbd5e1",
          }}
        >
          <p>
            ISKONOMY collects basic usage statistics to help
            us understand how many installations are active
            and how often the application is launched.
          </p>

          <p>
            No EVE character information, ESI data, financial
            information, operating system details or error
            reports are collected.
          </p>

          <p>
            You can disable usage statistics at any time in
            <strong> Settings → Privacy &amp; Usage Analytics</strong>.
          </p>
        </div>

        {error && (
          <p
            role="alert"
            style={{
              color: "#fca5a5",
              fontSize: 13,
              marginTop: 14,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={saving}
          onClick={onContinue}
          style={{
            width: "100%",
            marginTop: 22,
            padding: "12px 16px",
            borderRadius: 9,
            border: "1px solid #38bdf8",
            background: "#0369a1",
            color: "#ffffff",
            fontWeight: 700,
            cursor: saving ? "wait" : "pointer",
            opacity: saving ? 0.65 : 1,
          }}
        >
          {saving ? "Saving preference..." : "OK, Continue"}
        </button>
      </section>
    </div>
  );
}

function EsiLinkPopup({ session, cancelling, status, onCancel }) {
  if (!session) return null;

  return (
    <div
      role="presentation"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(3, 8, 17, 0.78)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="esi-link-title"
        aria-describedby="esi-link-description"
        style={{
          width: "100%",
          maxWidth: 420,
          background: "#151e2b",
          border: "1px solid #40516a",
          borderRadius: 16,
          padding: 26,
          boxShadow: "0 24px 70px rgba(0, 0, 0, 0.55)",
          color: "#eef3fa",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 20,
          }}
        >
          <h2
            id="esi-link-title"
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            {session.title}
          </h2>

          <button
            type="button"
            aria-label="Cancel linking"
            disabled={cancelling}
            onClick={onCancel}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              background: "transparent",
              color: "#aebbd0",
              cursor: cancelling ? "not-allowed" : "pointer",
              padding: 5,
            }}
          >
            <X size={19} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <LoaderCircle
            size={22}
            color="#7dd3fc"
            style={{
              animation: "esi-link-spin 1.2s linear infinite",
            }}
          />

          <strong style={{ fontSize: 14 }}>
            {status}
          </strong>
        </div>

        <p
          id="esi-link-description"
          style={{
            color: "#aebbd0",
            fontSize: 14,
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          Complete the authorisation in your browser.
          This window will close automatically when linking finishes.
        </p>

        <button
          type="button"
          disabled={cancelling}
          onClick={onCancel}
          style={{
            width: "100%",
            padding: "12px 16px",
            borderRadius: 9,
            border: "1px solid #52647a",
            background: "#263447",
            color: "#f1f5f9",
            fontWeight: 650,
            cursor: cancelling ? "not-allowed" : "pointer",
            opacity: cancelling ? 0.65 : 1,
          }}
        >
          {cancelling ? "Cancelling..." : "Cancel Linking"}
        </button>

        <style>
          {`
            @keyframes esi-link-spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}
        </style>
      </section>
    </div>
  );
}

function MainAppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const showNavbar = location.pathname !== "/overlay";

  const [updateOpen, setUpdateOpen] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [updateUrl, setUpdateUrl] = useState("");

  const [linkSession, setLinkSession] = useState(null);
  const [linkStatus, setLinkStatus] = useState(
    "Waiting for EVE authorisation..."
  );
  const [linkCancelling, setLinkCancelling] = useState(false);

  const [telemetryDisclosureOpen, setTelemetryDisclosureOpen] =
    useState(false);
  const [telemetrySaving, setTelemetrySaving] = useState(false);
  const [telemetryError, setTelemetryError] = useState("");

  const didRun = useRef(false);
  const activeLinkRef = useRef(null);

  const forceUpdatePopup = useMemo(() => {
    const q = new URLSearchParams(location.search);

    if (q.get("forceUpdate") === "1") return true;

    return localStorage.getItem("forceUpdatePopup") === "true";
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;

    async function checkTelemetryDisclosure() {
      try {
        const status = await window.api.telemetryGetStatus();

        if (!cancelled && !status.acknowledged) {
          setTelemetryDisclosureOpen(true);
        }
      } catch (error) {
        if (!cancelled) {
          console.error(
            "[TELEMETRY] Unable to load preferences:",
            error
          );
        }
      }
    }

    void checkTelemetryDisclosure();

    return () => {
      cancelled = true;
    };
  }, []);

  async function acknowledgeTelemetryDisclosure() {
    if (telemetrySaving) return;

    setTelemetrySaving(true);
    setTelemetryError("");

    try {
      await window.api.telemetrySetEnabled(true);
      setTelemetryDisclosureOpen(false);
    } catch {
      setTelemetryError(
        "Unable to save your preference. Please try again."
      );
    } finally {
      setTelemetrySaving(false);
    }
  }

  useEffect(() => {
    if (didRun.current) return;

    didRun.current = true;

    const dismissed =
      localStorage.getItem("dismissedLatestVersion") || "";

    const lastCheck = Number(
      localStorage.getItem("lastUpdateCheckAt") || "0"
    );

    const now = Date.now();
    const cooldownMs = 24 * 60 * 60 * 1000;
    const shouldCheck =
      forceUpdatePopup || now - lastCheck > cooldownMs;

    if (!shouldCheck) return;

    localStorage.setItem("lastUpdateCheckAt", String(now));

    const run = async () => {
      const latestJsonUrl =
        "https://raw.githubusercontent.com/EggyBoffer/Eve-Isk-Management/main/latest.json";

      const latest = await fetchJsonWithTimeout(
        latestJsonUrl,
        5000
      );

      if (latest && (latest.version || latest.tag || latest.latest)) {
        const v = normalizeVer(
          latest.version || latest.tag || latest.latest
        );

        const url = String(
          latest.url ||
          latest.downloadUrl ||
          latest.html_url ||
          ""
        ).trim();

        if (v) {
          setLatestVersion(v);
          setUpdateUrl(
            url ||
            "https://github.com/EggyBoffer/Eve-Isk-Management/releases/latest"
          );

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

  const startLink = useCallback(async (event) => {
    const detail = event.detail;
    const config = ESI_LINK_ACTIONS[detail?.kind];

    if (
      !config ||
      typeof detail?.resolve !== "function" ||
      typeof detail?.reject !== "function"
    ) {
      return;
    }

    if (activeLinkRef.current) {
      detail.reject(
        new Error("EVE linking is already in progress")
      );
      return;
    }

    const method = window.api?.[config.method];

    if (typeof method !== "function") {
      detail.reject(
        new Error("EVE linking is unavailable")
      );
      return;
    }

    const session = {
      title: config.title,
      cancelled: false,
      finished: false,
    };

    activeLinkRef.current = session;
    setLinkSession(session);
    setLinkCancelling(false);
    setLinkStatus("Waiting for EVE authorisation...");

    try {
      const result = config.sourceType
        ? await method(config.sourceType)
        : await method();

      session.finished = true;

      if (session.cancelled) {
        detail.reject(
          new Error("EVE authentication was cancelled")
        );
      } else {
        detail.resolve(result);
      }
    } catch (error) {
      session.finished = true;
      detail.reject(error);
    } finally {
      if (activeLinkRef.current === session) {
        activeLinkRef.current = null;
        setLinkSession(null);
        setLinkCancelling(false);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener(ESI_LINK_EVENT, startLink);

    return () => {
      window.removeEventListener(ESI_LINK_EVENT, startLink);
    };
  }, [startLink]);

  async function cancelLink() {
    const session = activeLinkRef.current;

    if (!session || session.finished || linkCancelling) {
      return;
    }

    setLinkCancelling(true);
    setLinkStatus("Cancelling EVE authorisation...");

    try {
      const cancelled = await window.api.esiCancelLinking();

      if (cancelled) {
        session.cancelled = true;
      } else {
        setLinkStatus(
          "Authorisation has finished. Completing linking..."
        );
        setLinkCancelling(false);
      }
    } catch {
      setLinkStatus(
        "Unable to cancel. Please try again."
      );
      setLinkCancelling(false);
    }
  }

  function closeUpdate() {
    setUpdateOpen(false);
  }

  function laterUpdate() {
    if (latestVersion) {
      localStorage.setItem(
        "dismissedLatestVersion",
        latestVersion
      );
    }

    setUpdateOpen(false);
  }

  function goPatchNotes() {
    setUpdateOpen(false);
    navigate("/patch-notes");
  }

  function doUpdate() {
    const url =
      updateUrl ||
      "https://github.com/EggyBoffer/Eve-Isk-Management/releases/latest";

    window.api?.openExternal(url);
  }

  return (
    <>
      {showNavbar && <Navbar />}

      <UpdatePopup
        open={updateOpen && showNavbar && !telemetryDisclosureOpen}
        currentVersion={pkg.version}
        latestVersion={latestVersion}
        onClose={closeUpdate}
        onLater={laterUpdate}
        onGoPatchNotes={goPatchNotes}
        onUpdate={doUpdate}
      />

      <main>
        <BootGate>
          <AppRoutes />
        </BootGate>
      </main>

      <EsiLinkPopup
        session={linkSession}
        cancelling={linkCancelling}
        status={linkStatus}
        onCancel={cancelLink}
      />

      {telemetryDisclosureOpen && (
        <TelemetryDisclosure
          onContinue={acknowledgeTelemetryDisclosure}
          saving={telemetrySaving}
          error={telemetryError}
        />
      )}
    </>
  );
}

export default function App() {
  const location = useLocation();

  if (location.pathname === "/overlay") {
    return (
      <main>
        <AppRoutes />
      </main>
    );
  }

  return <MainAppContent />;
}
