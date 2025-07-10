import { useState, useEffect } from "react";

export default function Overlay() {
  const [step, setStep] = useState(0);
  const [values, setValues] = useState({ room1: "", room2: "", room3: "", timeTaken: "" });
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
  const val = values[currentKey].trim();

  if (val === "" || isNaN(Number(val))) {
    setError(true);
    return;
  }

  setError(false);

  if (step < inputs.length - 1) {
    setStep(step + 1);
  } else {
    if (!shipType || !tier || !stormType) {
  console.error("❌ Missing ship/tier/storm info", { shipType, tier, stormType });
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
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (window.electron?.ipcRenderer) {
      window.electron.ipcRenderer.send("overlay-ready");

      window.electron.ipcRenderer.on("set-filament-settings", (_, settings) => {
      setFilamentCost(settings.fillament_cost || 0);
      setShipType(settings.ship_type || "");
      setTier(settings.tier || "");
      setStormType(settings.storm_type || "");
      console.log("Overlay settings received:", settings);
    });


      return () => {
        window.electron.ipcRenderer.removeAllListeners("set-filament-settings");
      };
    }
  }, []);

  return (
    <div className="overlay-box draggable-area">
      {showInfo && (
        <div className="overlay-info-popup">
          <p>
            Welcome to the ISK Overlay! This will guide you through logging your abyssal run step by step.
            <br />
            Press <strong>ESC</strong> anytime to close the overlay. Click and drag the overlay to move it around.
          </p>
          <button onClick={dismissInfoPopup} className="overlay-info-dismiss">
            ✖ Don't show again
          </button>
        </div>
      )}

      <div className="field-row">
        <input
          autoFocus
          type="number"
          placeholder={inputs[step].label}
          value={values[inputs[step].key]}
          onChange={(e) => {
            setValues({ ...values, [inputs[step].key]: e.target.value });
            if (error) setError(false);
          }}
          onKeyDown={(e) => e.key === "Enter" && nextStep()}
          style={{
            WebkitAppRegion: "no-drag",
            border: error ? "2px solid red" : "1px solid #555",
          }}
        />
        <button
          className="check-btn"
          onClick={nextStep}
          style={{ WebkitAppRegion: "no-drag" }}
        >
          ✔️
        </button>
      </div>
    </div>
  );
}
