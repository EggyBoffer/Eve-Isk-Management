
import { createElement, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, RefreshCw, Target, Coins, Users, Clock3, Package, X, BarChart3 } from "lucide-react";
import { parseCargo } from "../../lib/cargoParser";
import { priceItemsJita } from "../../lib/marketClient";

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

function formatDate(value) {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return `${date.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  })} UTC`;
}

function Metric({ icon: Icon, label, value, detail }) {
  return (
    <div style={panel}>
      <div style={{ display: "flex", gap: 9, alignItems: "center", color: "#94a3b8", marginBottom: 12 }}>
        {Icon ? <span>{iconElement(Icon)}</span> : null} {label}
      </div>
      <div style={{ fontSize: 27, fontWeight: 700 }}>{value}</div>
      <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 7 }}>{detail}</div>
    </div>
  );
}

function iconElement(Component) {
  return createElement(Component, { size: 18 });
}

function OfficerIcon({ typeId, name }) {
  const [failed, setFailed] = useState(false);
  const validId = Number(typeId);
  if (!Number.isSafeInteger(validId) || validId <= 0 || failed) {
    return <span style={{ display: "inline-flex", width: 48, height: 48, alignItems: "center", justifyContent: "center", background: "#17243b", borderRadius: 8 }}><Target size={22} /></span>;
  }
  return <img src={`https://images.evetech.net/types/${validId}/icon?size=64`} alt={`${name} NPC icon`} width={48} height={48} loading="lazy" onError={() => setFailed(true)} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "contain", background: "#0f172a" }} />;
}

export default function OfficerTracker() {
  const navigate = useNavigate();
  const [kills, setKills] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState(null);
  const [characterId, setCharacterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState(null);
  const [lootText, setLootText] = useState("");
  const [notes, setNotes] = useState("");
  const [priced, setPriced] = useState(null);
  const [pricing, setPricing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lootError, setLootError] = useState("");

  const loadData = useCallback(async () => {
    if (!window.api?.officerListKills || !window.api?.officerGetSummary) {
      throw new Error("Officer Tracking API is unavailable. Restart ISKONOMY after updating the preload.");
    }
    const [rows, totals, linked, syncStatus] = await Promise.all([
      window.api.officerListKills({ limit: 500 }),
      window.api.officerGetSummary(),
      window.api.esiListCharacters?.() ?? Promise.resolve([]),
      window.api.officerGetSyncStatus?.() ?? Promise.resolve(null),
    ]);
    setKills(Array.isArray(rows) ? rows : []);
    setSummary(totals);
    setCharacters(Array.isArray(linked) ? linked : []);
    setStatus(syncStatus);
  }, []);

  useEffect(() => {
    let active = true;
    loadData().catch((err) => {
      if (active) setError(err?.message || "Unable to load officer records.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [loadData]);

  const characterNames = useMemo(() => new Map(
    characters.map((character) => [Number(character.characterId), character.name || character.characterName])
  ), [characters]);

  const visibleKills = useMemo(() => characterId
    ? kills.filter((kill) => String(kill.characterId) === characterId)
    : kills, [kills, characterId]);

  const displayedKills = visibleKills.reduce((total, kill) => total + (Number(kill.quantity) || 1), 0);
  const displayedLoot = visibleKills.reduce((total, kill) => total + (Number(kill.lootValue) || 0), 0);
  const uniqueCharacters = new Set(visibleKills.map((kill) => kill.characterId)).size;
  const parsed = useMemo(() => parseCargo(lootText), [lootText]);

  function openLoot(kill) {
    setEditing(kill);
    setLootText(kill.lootText || "");
    setNotes(kill.notes || "");
    setPriced(null);
    setLootError("");
  }

  function closeLoot() {
    if (pricing || saving) return;
    setEditing(null);
    setPriced(null);
    setLootError("");
  }

  async function priceLoot() {
    setLootError("");
    setPriced(null);
    if (!parsed.items.length) {
      setLootError("Paste at least one valid cargo item.");
      return;
    }
    if (parsed.unknownLines.length) {
      setLootError("Some cargo lines could not be parsed. Correct them before pricing.");
      return;
    }
    setPricing(true);
    try {
      const result = await priceItemsJita(parsed.items);
      setPriced(result);
    } catch (err) {
      setLootError(err?.message || "Unable to retrieve Jita prices.");
    } finally {
      setPricing(false);
    }
  }

  async function saveLoot() {
    if (!editing || !priced || saving || pricing) return;
    if (typeof window.api?.officerUpdateLoot !== "function") {
      setLootError("Officer loot saving is unavailable. Add officerUpdateLoot to electron/preload.js and restart ISKONOMY.");
      return;
    }
    setSaving(true);
    setLootError("");
    try {
      const saved = await window.api.officerUpdateLoot(editing.id, {
        lootText,
        lootValue: priced.iskTotal,
        notes,
      });
      if (!saved) throw new Error("Officer kill was not found in the database.");
      await loadData();
      setNotice(`Loot saved for ${editing.name}.`);
      setEditing(null);
      setPriced(null);
    } catch (err) {
      setLootError(err?.message || "Unable to save officer loot.");
    } finally {
      setSaving(false);
    }
  }

  async function scanOfficers() {
    if (syncing) return;
    if (!window.api?.officerSync) {
      setError("Officer scanning is unavailable.");
      return;
    }
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const result = await window.api.officerSync(characterId ? { characterId: Number(characterId) } : {});
      await loadData();
      if (result?.skipped) {
        setNotice("An officer scan is already running.");
      } else if (!result?.success) {
        setError(`Officer scan encountered ${result?.errors?.length ?? 1} error(s). Check the Electron console.`);
      } else {
        setNotice(`Scan complete: ${result.scanned ?? 0} wallet entries checked, ${result.detected ?? 0} officers detected.`);
      }
    } catch (err) {
      setError(err?.message || "Officer scan failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", padding: "86px 28px 70px", color: "#f8fafc", background: "linear-gradient(145deg, #080f1d, #111c32)" }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={{ ...panel, marginBottom: 26, background: "linear-gradient(105deg, rgba(27, 48, 65, 0.95), rgba(19, 21, 35, 0.95))", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 800, letterSpacing: 1, color: "#38bdf8", margin: "0 0 10px" }}>Officer Tracking</h1>
            <p style={{ margin: 0, color: "#cbd5e1" }}>Keep track of Officer kills and import loot to track income.</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              style={{ ...button, background: "#1e293b" }}
              onClick={() => navigate("/officers/analytics")}
            >
              <BarChart3 size={17} /> View Analytics
            </button>
            <button
              type="button"
              style={{ ...button, opacity: syncing ? 0.6 : 1 }}
              disabled={syncing}
              onClick={scanOfficers}
            >
              <RefreshCw size={17} /> {syncing ? "Scanning..." : "Scan Wallet Journals"}
            </button>
          </div>
        </header>

        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
          <label htmlFor="officer-character">Character</label>
          <select id="officer-character" value={characterId} onChange={(event) => setCharacterId(event.target.value)} style={{ padding: 10, borderRadius: 8, background: "#17243b", color: "#fff", border: "1px solid #334155", minWidth: 210 }}>
            <option value="">All linked characters</option>
            {characters.map((character) => <option key={character.characterId} value={character.characterId}>{character.name || character.characterName || character.characterId}</option>)}
          </select>
          <button type="button" style={{ ...button, background: "#1e293b" }} onClick={() => navigate("/esi-connections")}>Manage ESI Connections</button>
        </div>

        {error && <div role="alert" style={{ ...panel, color: "#fca5a5", borderColor: "#ef4444", marginBottom: 18 }}><AlertTriangle size={17} style={{ verticalAlign: "middle" }} /> {error}</div>}
        {notice && <div role="status" style={{ ...panel, color: "#86efac", borderColor: "#22c55e", marginBottom: 18 }}>{notice}</div>}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 26 }}>
          <Metric icon={Target} label="Officer Kills" value={displayedKills.toLocaleString("en-GB")} detail="Automatically pulled from ESI" />
          <Metric icon={Coins} label="Recorded Loot Value" value={formatISK(displayedLoot)} detail="Manually imported loot to each kill. " />
          <Metric icon={Users} label="Characters" value={uniqueCharacters} detail="Characters with Officer kills found." />
          <Metric icon={Clock3} label="Last Officer Scan" value={status?.running ? "Running" : status?.lastCompletedAt ? "Completed" : "Not yet run"} detail={formatDate(status?.lastCompletedAt)} />
        </div>

        <section style={panel}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 21 }}>Detected Officer Kills</h2>
            <span style={{ color: "#94a3b8" }}>{visibleKills.length} records{summary?.totalRecords > kills.length ? " (latest 500 loaded)" : ""}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
              <thead><tr style={{ color: "#94a3b8", borderBottom: "1px solid #334155" }}>
                {["Date", "Officer", "Class", "Character", "Quantity", "Loot Value", "Actions"].map((heading) => <th key={heading} style={{ padding: "12px 10px" }}>{heading}</th>)}
              </tr></thead>
              <tbody>
                {visibleKills.map((kill) => (
                  <tr key={kill.id ?? `${kill.journalId}-${kill.typeId}`} style={{ borderBottom: "1px solid rgba(148, 163, 184, 0.12)" }}>
                    <td style={{ padding: "14px 10px", whiteSpace: "nowrap" }}>{formatDate(kill.date)}</td>
                    <td style={{ padding: "14px 10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 190 }}>
                        <OfficerIcon key={kill.typeId} typeId={kill.typeId} name={kill.name || "Officer"} />
                        <strong style={{ color: "#7dd3fc" }}>{kill.name || `NPC ${kill.typeId}`}</strong>
                      </div>
                    </td>
                    <td style={{ padding: "14px 10px" }}>{kill.officerClass || "Unknown"}</td>
                    <td style={{ padding: "14px 10px" }}>{characterNames.get(Number(kill.characterId)) || kill.characterId}</td>
                    <td style={{ padding: "14px 10px" }}>{kill.quantity ?? 1}</td>
                    <td style={{ padding: "14px 10px" }}>{formatISK(kill.lootValue)}</td>
                    <td style={{ padding: "14px 10px" }}>
                      <button type="button" style={{ ...button, background: "#1e293b", whiteSpace: "nowrap" }} onClick={() => openLoot(kill)}><Package size={16} /> {kill.lootText ? "Edit Loot" : "Add Loot"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!loading && visibleKills.length === 0 && <p style={{ padding: "20px 10px", color: "#94a3b8" }}>No officer kills found. Link a character with wallet access, or run a manual scan.</p>}
            {loading && <p style={{ padding: "20px 10px", color: "#94a3b8" }}>Loading officer records...</p>}
          </div>
        </section>
        <p style={{ color: "#94a3b8", fontSize: 12, marginTop: 16 }}>Wallet is scanned every 6 hours and automatically adds kills for officers to this page. You must manually import loot.</p>
      </div>

      {editing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <section role="dialog" aria-modal="true" aria-label={`Loot for ${editing.name}`} style={{ ...panel, width: "min(760px, 100%)", maxHeight: "90vh", overflowY: "auto", background: "#101c30", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <h2 style={{ margin: 0 }}>Loot — {editing.name}</h2>
              <button type="button" aria-label="Close loot editor" disabled={pricing || saving} onClick={closeLoot} style={{ ...button, background: "#1e293b" }}><X size={18} /></button>
            </div>
            <p style={{ color: "#94a3b8" }}>Copy items from your EVE cargo window and paste them below. Review the Jita estimate before saving.</p>
            <label htmlFor="officer-loot-text" style={{ display: "block", marginBottom: 8 }}>Cargo contents</label>
            <textarea id="officer-loot-text" value={lootText} onChange={(event) => { setLootText(event.target.value); setPriced(null); setLootError(""); }} rows={7} style={{ boxSizing: "border-box", width: "100%", padding: 12, background: "#0b1424", border: "1px solid #334155", borderRadius: 8, color: "#fff", resize: "vertical" }} placeholder="Paste cargo contents from EVE..." />
            <div style={{ marginTop: 12, color: "#94a3b8" }}>{parsed.items.length} parsed item types, {parsed.unknownLines.length} unparsed lines</div>
            {parsed.unknownLines.length > 0 && <div style={{ marginTop: 10, color: "#fca5a5" }}>Unparsed: {parsed.unknownLines.join(" | ")}</div>}
            <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" style={button} onClick={priceLoot} disabled={pricing || saving}>{pricing ? "Fetching Jita prices..." : "Calculate Jita Value"}</button>
              {priced && <strong style={{ color: "#86efac" }}>Estimated total: {formatISK(priced.iskTotal)}</strong>}
            </div>
            {priced && (
              <div style={{ overflowX: "auto", marginTop: 18 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                  <thead><tr style={{ color: "#94a3b8" }}><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
                  <tbody>{priced.items.map((item, index) => <tr key={`${item.name}-${index}`} style={{ borderTop: "1px solid #334155" }}>
                    <td style={{ padding: "9px 4px" }}>{item.name}{!item.typeId || !item.unitPrice ? <span style={{ color: "#fca5a5" }}> (price unavailable)</span> : null}</td>
                    <td>{item.qty}</td><td>{formatISK(item.unitPrice)}</td><td>{formatISK(item.total)}</td>
                  </tr>)}</tbody>
                </table>
              </div>
            )}
            <label htmlFor="officer-loot-notes" style={{ display: "block", marginTop: 18, marginBottom: 8 }}>Notes (optional)</label>
            <textarea id="officer-loot-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} maxLength={10000} style={{ boxSizing: "border-box", width: "100%", padding: 12, background: "#0b1424", border: "1px solid #334155", borderRadius: 8, color: "#fff" }} />
            {lootError && <p role="alert" style={{ color: "#fca5a5" }}>{lootError}</p>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 20 }}>
              <button type="button" style={{ ...button, background: "#1e293b" }} onClick={closeLoot} disabled={pricing || saving}>Cancel</button>
              <button type="button" style={button} onClick={saveLoot} disabled={!priced || pricing || saving}>{saving ? "Saving..." : "Save Loot"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
