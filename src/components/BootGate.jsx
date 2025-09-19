// src/components/BootGate.jsx
import { useEffect, useState } from "react";
import { runBootTasks } from "../lib/bootTasks";

// If you already have a fancy loader, import and use it here instead.
function DefaultLoader({ message }) {
  return (
    <div style={{
      minHeight: "100vh",
      display: "grid",
      placeItems: "center",
      background: "#0f1126",
      color: "#cfe8ff",
      fontFamily: "sans-serif",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Starting ISKONOMY!…</div>
        <div style={{ opacity: 0.8, fontSize: "0.95rem" }}>{message}</div>
      </div>
    </div>
  );
}

export default function BootGate({ children, Loader = DefaultLoader }) {
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Preparing…");

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        await runBootTasks({
          onProgress: ({ current, total, label }) => {
            if (!mounted) return;
            const base = label || "Preparing…";
            const suffix = total ? ` (${current}/${total})` : "";
            setMessage(base + suffix);
          },
        });
      } catch (e) {
        console.warn("Boot tasks failed:", e);
        setMessage("Startup tasks failed (check console).");
      } finally {
        if (mounted) setReady(true);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (!ready) return <Loader message={message} />;
  return children;
}
