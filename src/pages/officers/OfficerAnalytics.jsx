import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BarChart3, Coins, Package, RefreshCw, Target } from "lucide-react";
import { parseCargo } from "../../lib/cargoParser";

const panel = {
  background: "rgba(15, 23, 42, 0.82)",
  border: "1px solid rgba(148, 163, 184, 0.16)",
  borderRadius: 14,
  padding: 22,
};

const button = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 16px",
  border: "1px solid rgba(148, 163, 184, 0.24)",
  borderRadius: 8,
  background: "#2563eb",
  color: "#fff",
  fontWeight: 600,
  cursor: "pointer",
};

function formatISK(value) {
  return `${(Number(value) || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 })} ISK`;
}

function percent(numerator, denominator) {
  return denominator ? `${(numerator / denominator * 100).toFixed(1)}%` : "—";
}

async function loadAllOfficerKills() {
  if (typeof window.api?.officerListKills !== "function") {
    throw new Error("Officer Tracking API is unavailable. Restart ISKONOMY.");
  }
  const result = [];
  const limit = 1000;
  for (let offset = 0; ; offset += limit) {
    const page = await window.api.officerListKills({ limit, offset });
    if (!Array.isArray(page)) throw new Error("Invalid officer records returned by the database.");
    result.push(...page);
    if (page.length < limit) break;
  }
  return result;
}

function Metric({ label, value, detail }) {
  return (
    <div style={panel}>
      <div style={{ color: "#94a3b8", fontSize: 13, marginBottom: 12 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700 }}>{value}</div>
      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 7 }}>{detail}</div>
    </div>
  );
}

export default function OfficerAnalytics() {
  const navigate = useNavigate();
  const [kills, setKills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [officerType, setOfficerType] = useState("all");
  const [characterId, setCharacterId] = useState("all");
  const [characters, setCharacters] = useState([]);

  const refresh = useCallback(async () => {
    const [records, linked] = await Promise.all([
      loadAllOfficerKills(),
      window.api?.esiListCharacters?.() ?? Promise.resolve([]),
    ]);
    setKills(records);
    setCharacters(Array.isArray(linked) ? linked : []);
  }, []);

  useEffect(() => {
    let active = true;
    refresh().catch((err) => {
      if (active) setError(err?.message || "Unable to load officer analytics.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [refresh]);

  async function refreshData() {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    try {
      await refresh();
    } catch (err) {
      setError(err?.message || "Unable to refresh officer analytics.");
    } finally {
      setRefreshing(false);
    }
  }

  const officerTypes = useMemo(() => {
    const map = new Map();
    for (const kill of kills) {
      map.set(String(kill.typeId), kill.name || `NPC ${kill.typeId}`);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [kills]);

  const characterNames = useMemo(() => new Map(
    characters.map((character) => [String(character.characterId), character.name || character.characterName || String(character.characterId)])
  ), [characters]);

  const characterOptions = useMemo(() => [...new Set(kills.map((kill) => String(kill.characterId)))].sort((a, b) =>
    (characterNames.get(a) || a).localeCompare(characterNames.get(b) || b)
  ), [kills, characterNames]);

  const filtered = useMemo(() => kills.filter((kill) =>
    (officerType === "all" || String(kill.typeId) === officerType) &&
    (characterId === "all" || String(kill.characterId) === characterId)
  ), [kills, officerType, characterId]);

  const stats = useMemo(() => {
    const recorded = filtered.filter((kill) => typeof kill.lootText === "string" && kill.lootText.trim().length > 0);
    const totalLoot = recorded.reduce((sum, kill) => sum + (Number(kill.lootValue) || 0), 0);
    const itemMap = new Map();
    let incomplete = 0;

    for (const kill of recorded) {
      const parsed = parseCargo(kill.lootText);
      if (parsed.unknownLines.length || !parsed.items.length) {
        incomplete++;
        continue;
      }
      for (const item of parsed.items) {
        const key = item.name.trim().toLocaleLowerCase("en-GB");
        if (!key) continue;
        if (!itemMap.has(key)) itemMap.set(key, { name: item.name, drops: 0, quantity: 0 });
        const entry = itemMap.get(key);
        entry.drops++;
        entry.quantity += item.qty;
      }
    }

    const validLootRecords = recorded.length - incomplete;
    const items = [...itemMap.values()].map((item) => ({
      ...item,
      rate: validLootRecords ? item.drops / validLootRecords : 0,
    })).sort((a, b) => b.drops - a.drops || a.name.localeCompare(b.name));

    const officers = new Map();
    for (const kill of filtered) {
      const key = String(kill.typeId);
      if (!officers.has(key)) officers.set(key, { name: kill.name || `NPC ${key}`, kills: 0, priced: 0, loot: 0 });
      const entry = officers.get(key);
      entry.kills += Number(kill.quantity) || 1;
      if (typeof kill.lootText === "string" && kill.lootText.trim()) {
        entry.priced++;
        entry.loot += Number(kill.lootValue) || 0;
      }
    }

    return {
      totalKills: filtered.reduce((sum, kill) => sum + (Number(kill.quantity) || 1), 0),
      recorded: recorded.length,
      totalLoot,
      averageLoot: recorded.length ? totalLoot / recorded.length : 0,
      validLootRecords,
      incomplete,
      items,
      officers: [...officers.values()].sort((a, b) => b.kills - a.kills || a.name.localeCompare(b.name)),
    };
  }, [filtered]);

  const selectStyle = {
    background: "#17243b", color: "#fff", border: "1px solid #334155",
    padding: 10, borderRadius: 8, minWidth: 190,
  };

  return (
    <div style={{ minHeight: "100vh", padding: "86px 28px 70px", color: "#f8fafc", background: "linear-gradient(145deg, #080f1d, #111c32)" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={{ ...panel, marginBottom: 24, background: "linear-gradient(105deg, rgba(27, 48, 65, 0.95), rgba(19, 21, 35, 0.95))", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div>
            <h1 style={{ margin: "0 0 10px", fontSize: 36, fontWeight: 800, color: "#38bdf8" }}><BarChart3 size={30} style={{ verticalAlign: "middle", marginRight: 10 }} />Officer Analytics</h1>
            <p style={{ margin: 0, color: "#cbd5e1" }}>Historical officer loot values and observed item drop rates.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button type="button" style={{ ...button, background: "#1e293b" }} onClick={() => navigate("/officers")}><ArrowLeft size={17} /> Officer Tracking</button>
            <button type="button" style={{ ...button, opacity: refreshing ? 0.6 : 1 }} disabled={refreshing} onClick={refreshData}><RefreshCw size={17} /> {refreshing ? "Refreshing..." : "Refresh"}</button>
          </div>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <label htmlFor="officer-analytics-type">Officer</label>
          <select id="officer-analytics-type" style={selectStyle} value={officerType} onChange={(event) => setOfficerType(event.target.value)}>
            <option value="all">All officers</option>
            {officerTypes.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          <label htmlFor="officer-analytics-character">Character</label>
          <select id="officer-analytics-character" style={selectStyle} value={characterId} onChange={(event) => setCharacterId(event.target.value)}>
            <option value="all">All characters</option>
            {characterOptions.map((id) => <option key={id} value={id}>{characterNames.get(id) || id}</option>)}
          </select>
        </div>

        {error && <div role="alert" style={{ ...panel, color: "#fca5a5", borderColor: "#ef4444", marginBottom: 18 }}>{error}</div>}
        {loading ? <div style={panel}>Loading officer analytics...</div> : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 16, marginBottom: 24 }}>
              <Metric label="Average Loot per Recorded Kill" value={formatISK(stats.averageLoot)} detail={`${stats.recorded} kills with imported loot`} />
              <Metric label="Total Historical Loot" value={formatISK(stats.totalLoot)} detail="Saved ISK values; no market repricing" />
              <Metric label="Officer Kills" value={stats.totalKills.toLocaleString("en-GB")} detail={`${stats.recorded} loot records imported`} />
              <Metric label="Unique Loot Items" value={stats.items.length.toLocaleString("en-GB")} detail="From successfully parsed loot records" />
            </div>

            <section style={{ ...panel, marginBottom: 24 }}>
              <h2 style={{ margin: "0 0 12px", fontSize: 21 }}><Package size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Observed Item Drop Rates</h2>
              <p style={{ color: "#94a3b8", fontSize: 13, lineHeight: 1.6 }}>
                Each rate is the percentage of successfully parsed, imported loot records containing that item.
                Kills without imported loot are excluded. These are observed rates, not EVE's official drop probabilities.
                {stats.incomplete > 0 ? ` ${stats.incomplete} imported loot record(s) could not be fully parsed and are excluded from drop rates.` : ""}
              </p>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead><tr style={{ color: "#94a3b8", borderBottom: "1px solid #334155" }}>
                    { ["Item", "Kills With Item", "Total Quantity", "Observed Drop Rate"].map((heading) => <th key={heading} style={{ padding: "12px 10px" }}>{heading}</th>) }
                  </tr></thead>
                  <tbody>
                    {stats.items.map((item) => (
                      <tr key={item.name} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.12)" }}>
                        <td style={{ padding: "12px 10px", color: "#7dd3fc", fontWeight: 600 }}>{item.name}</td>
                        <td style={{ padding: "12px 10px" }}>{item.drops} / {stats.validLootRecords}</td>
                        <td style={{ padding: "12px 10px" }}>{item.quantity.toLocaleString("en-GB")}</td>
                        <td style={{ padding: "12px 10px", minWidth: 170 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <div style={{ height: 7, width: 90, borderRadius: 6, background: "#1e293b", overflow: "hidden" }}><div style={{ height: "100%", width: `${item.rate * 100}%`, background: "#38bdf8" }} /></div>
                            {percent(item.drops, stats.validLootRecords)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.items.length === 0 && <p style={{ color: "#94a3b8" }}>No parsed loot items available for the selected filters.</p>}
              </div>
            </section>

            <section style={panel}>
              <h2 style={{ margin: "0 0 18px", fontSize: 21 }}><Target size={20} style={{ verticalAlign: "middle", marginRight: 8 }} />Loot by Officer</h2>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead><tr style={{ color: "#94a3b8", borderBottom: "1px solid #334155" }}>
                    { ["Officer", "Kills", "Loot Records", "Historical Loot Value", "Average per Loot Record"].map((heading) => <th key={heading} style={{ padding: "12px 10px" }}>{heading}</th>) }
                  </tr></thead>
                  <tbody>
                    {stats.officers.map((officer) => (
                      <tr key={officer.name} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.12)" }}>
                        <td style={{ padding: "12px 10px", color: "#7dd3fc", fontWeight: 600 }}>{officer.name}</td>
                        <td style={{ padding: "12px 10px" }}>{officer.kills}</td>
                        <td style={{ padding: "12px 10px" }}>{officer.priced}</td>
                        <td style={{ padding: "12px 10px" }}>{formatISK(officer.loot)}</td>
                        <td style={{ padding: "12px 10px" }}>{officer.priced ? formatISK(officer.loot / officer.priced) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {stats.officers.length === 0 && <p style={{ color: "#94a3b8" }}>No officer kills found for the selected filters.</p>}
              </div>
            </section>
            <p style={{ marginTop: 16, color: "#94a3b8", fontSize: 12 }}><Coins size={14} style={{ verticalAlign: "middle", marginRight: 6 }} />Officer loot values are saved historical snapshots. This page does not request live market prices.</p>
          </>
        )}
      </div>
    </div>
  );
}