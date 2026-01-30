import { useState, useEffect } from "react";
import "../styles/overlay.css";

export default function Overlay() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({
    room1: "",
    room2: "",
    room3: "",
    timeTaken: "",
  });
  const [error, setError] = useState(false);

  const [shipType, setShipType] = useState("");
  const [tier, setTier] = useState("");
  const [stormType, setStormType] = useState("");
  const [filamentCost, setFilamentCost] = useState(0);

  const [showInfo, setShowInfo] = useState(() => {
    return localStorage.getItem("hideOverlayInfo") !== "true";
  });

  const inputs = [
    { label: "Room 1 ISK", key: "room1" },
    { label: "Room 2 ISK", key: "room2" },
    { label: "Room 3 ISK", key: "room3" },
    { label: "Time (min)", key: "timeTaken" },
  ];

  async function nextStep() {
    const currentKey = inputs[step].key;
    const val = String(values[currentKey] ?? "").trim();

    if (val === "" || isNaN(Number(val))) {
      setError(true);
      return;
    }

    setError(false);

    if (step < inputs.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    await window.api.addEntry("abyssals", {
      date: new Date().toISOString().slice(0, 10),
      room1_isk: parseInt(values.room1) || 0,
      room2_isk: parseInt(values.room2) || 0,
      room3_isk: parseInt(values.room3) || 0,
      time_taken: parseInt(values.timeTaken) || 0,
      fillament_cost: filamentCost || 0,
      tier,
      storm_type: stormType,
      ship_type: shipType,
    });

    setValues({ room1: "", room2: "", room3: "", timeTaken: "" });
    setStep(0);
  }

  function dismissInfoPopup() {
    localStorage.setItem("hideOverlayInfo", "true");
    setShowInfo(false);
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        window.api.closeOverlay?.();
      }
      if (e.key === "Enter") {
        // stop random "ding" sounds / weird focus behavior
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const ipc = window.electron?.ipcRenderer;
    if (!ipc) return;

    ipc.send("overlay-ready");

    const handler = (_, settings) => {
      setFilamentCost(settings?.fillament_cost || 0);
      setShipType(settings?.ship_type || "");
      setTier(settings?.tier || "");
      setStormType(settings?.storm_type || "");
    };

    ipc.on("set-filament-settings", handler);

    return () => {
      // IMPORTANT: some preload wrappers don't expose removeListener(), but they do expose off()
      if (typeof ipc.off === "function") ipc.off("set-filament-settings", handler);
      else if (typeof ipc.removeAllListeners === "function") ipc.removeAllListeners("set-filament-settings");
    };
  }, []);

  const currentKey = inputs[step].key;

  return (
    <div className="overlay">
      {showInfo && (
        <div className="overlayInfo" role="dialog" aria-modal="false">
          <div className="overlayInfoTitle">ISK Overlay</div>
          <div className="overlayInfoBody">
            This will guide you through logging your abyssal run step by step.
            <br />
            Press <strong>ESC</strong> anytime to close. Drag the empty area to move it.
          </div>

          <button type="button" className="overlayInfoDismiss" onClick={dismissInfoPopup}>
            ✖ Don&apos;t show again
          </button>
        </div>
      )}

      <div className="overlayCenter">
        <div className="overlayRow">
          <input
            className={`overlayInput ${error ? "overlayInputError" : ""}`}
            autoFocus
            type="number"
            placeholder={inputs[step].label}
            value={values[currentKey]}
            onChange={(e) => {
              setValues((v) => ({ ...v, [currentKey]: e.target.value }));
              if (error) setError(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") nextStep();
            }}
          />

          <button type="button" className="overlayCheck" onClick={nextStep} aria-label="Next">
            ✔️
          </button>
        </div>
      </div>
    </div>
  );
}
