
import { useEffect, useState } from "react";
import { runBootTasks } from "../lib/bootTasks";

function DefaultLoader({ message }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#0f1126",
        color: "#cfe8ff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>
          Starting ISKONOMY!…
        </div>
        <div style={{ opacity: 0.8, fontSize: "0.95rem" }}>{message}</div>
      </div>
    </div>
  );
}

export default function BootGate({ children, loader }) {
  const LoaderComp = loader || DefaultLoader;
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Preparing…");

  useEffect(() => {
    let mounted = true;

    const sendProgress = (msg) => {
      try {
        window.api?.bootProgress?.(msg);
      } catch {
        
      }
    };

    const sendDone = () => {
      try {
        window.api?.bootDone?.();
      } catch {
        
      }
    };

    (async () => {
      try {
        sendProgress("Starting ISKONOMY!…");

        await runBootTasks({
          onProgress: ({ current, total, label }) => {
            const base = label || "Preparing…";
            const suffix = total ? ` (${current}/${total})` : "";
            const msg = base + suffix;

            if (mounted) setMessage(msg);
            sendProgress(msg);
          },
        });

        if (mounted) setMessage("Ready.");
        sendProgress("Ready.");
      } catch (e) {
        console.warn("Boot tasks failed:", e);
        const msg = "Startup tasks failed (check console).";
        if (mounted) setMessage(msg);
        sendProgress(msg);
      } finally {
        sendDone();
        if (mounted) setReady(true);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (!ready) return <LoaderComp message={message} />;
  return children;
}
