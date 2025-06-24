import { useState, useEffect } from "react";



export default function Overlay() {
  const [step, setStep] = useState(0); // 0-3
  const [values, setValues] = useState({ room1: "", room2: "", room3: "", timeTaken: "" });
  const [error, setError] = useState(false); // validation error state

  const inputs = [
    { label: "Room 1 ISK", key: "room1" },
    { label: "Room 2 ISK", key: "room2" },
    { label: "Room 3 ISK", key: "room3" },
    { label: "Time (min)", key: "timeTaken" },
  ];

  async function nextStep() {
    const currentKey = inputs[step].key;
    const val = values[currentKey].trim();

    // Validate: must not be empty and must be numeric
    if (val === "" || isNaN(Number(val))) {
      setError(true);
      return;
    }

    setError(false); // reset error

    if (step < inputs.length - 1) {
      setStep(step + 1);
    } else {
      // Submit entry
      await window.api.addEntry("abyssals", {
        date: new Date().toISOString().slice(0, 10),
        room1_isk: parseInt(values.room1) || 0,
        room2_isk: parseInt(values.room2) || 0,
        room3_isk: parseInt(values.room3) || 0,
        time_taken: parseInt(values.timeTaken) || 0,
        fillament_cost: 0,
      });

      // Reset for next
      setValues({ room1: "", room2: "", room3: "", timeTaken: "" });
      setStep(0);
    }
  }

  // Close the overlay on Escape
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
  console.log('Overlay component mounted'); // you'll see this in DevTools
}, []);

  return (
  <div className="overlay-box draggable-area" style={{ padding: '1rem', background: 'rgba(0,0,0,0.7)', color: 'white' }}>
    {/* 👇 TEST MARKER */}
    <h1 style={{ fontSize: '1.5rem', color: 'yellow', textAlign: 'center' }}>Overlay loaded</h1>

    <div className="field-row" style={{ WebkitAppRegion: "no-drag" }}>
      <input
        autoFocus
        type="number"
        placeholder={inputs[step].label}
        value={values[inputs[step].key]}
        onChange={(e) => {
          setValues({ ...values, [inputs[step].key]: e.target.value });
          if (error) setError(false); // clear error on input
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
