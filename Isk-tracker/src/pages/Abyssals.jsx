import { useState, useEffect } from "react";

export default function Abyssals() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [room1Isk, setRoom1Isk] = useState("");
  const [room2Isk, setRoom2Isk] = useState("");
  const [room3Isk, setRoom3Isk] = useState("");
  const [timeTaken, setTimeTaken] = useState(""); // in minutes
  const [fillamentCost, setFillamentCost] = useState("");
  const [entries, setEntries] = useState([]);

  async function fetchEntries() {
    const data = await window.api.getEntries("abyssals");
    setEntries(data);
  }

  useEffect(() => {
    fetchEntries();
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();

    if (
      [room1Isk, room2Isk, room3Isk, timeTaken, fillamentCost].some(
        (val) => val === "" || isNaN(val)
      )
    ) {
      alert("Please fill all fields with valid numbers.");
      return;
    }

    await window.api.addEntry("abyssals", {
      date,
      room1_isk: parseInt(room1Isk),
      room2_isk: parseInt(room2Isk),
      room3_isk: parseInt(room3Isk),
      time_taken: parseInt(timeTaken),
      fillament_cost: parseInt(fillamentCost),
    });

    setRoom1Isk("");
    setRoom2Isk("");
    setRoom3Isk("");
    setTimeTaken("");
    setFillamentCost("");
    fetchEntries();
  }

  return (
  <div className="container">
    <h1>Abyssals</h1>
    <form onSubmit={handleSubmit}>
      <label>
        Date:
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </label>
      <label>
        Room 1 ISK Earned:
        <input
          type="number"
          value={room1Isk}
          onChange={(e) => setRoom1Isk(e.target.value)}
          required
        />
      </label>
      <label>
        Room 2 ISK Earned:
        <input
          type="number"
          value={room2Isk}
          onChange={(e) => setRoom2Isk(e.target.value)}
          required
        />
      </label>
      <label>
        Room 3 ISK Earned:
        <input
          type="number"
          value={room3Isk}
          onChange={(e) => setRoom3Isk(e.target.value)}
          required
        />
      </label>
      <label>
        Time Taken (minutes):
        <input
          type="number"
          value={timeTaken}
          onChange={(e) => setTimeTaken(e.target.value)}
          required
        />
      </label>
      <label>
        Fillament Cost (ISK):
        <input
          type="number"
          value={fillamentCost}
          onChange={(e) => setFillamentCost(e.target.value)}
          required
        />
      </label>
      <button type="submit">Add Entry</button>
    </form>

      <h2>Entries</h2>
      <ul>
        {entries.map((entry) => (
          <li key={entry.id}>
            {entry.date} | Rooms: {entry.room1_isk.toLocaleString()},{" "}
            {entry.room2_isk.toLocaleString()}, {entry.room3_isk.toLocaleString()} ISK | Time:{" "}
            {entry.time_taken} mins | Fillament Cost: {entry.fillament_cost.toLocaleString()} ISK
          </li>
        ))}
      </ul>
    </div>
  );
}
