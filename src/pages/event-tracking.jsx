
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ded-tracking.css";

import { parseCargo } from "../lib/cargoParser.js";
import { priceEventItems } from "../lib/eventPricing.js";
import { parseBountyTicks } from "../lib/eventWalletParser.js";
import {
  addEventRun,
  deleteEventRun,
  importEventRunsFromFile,
  loadEventRuns,
} from "../lib/eventRunsStore.js";
import {
  addBountyTicks,
  loadEventBounties,
} from "../lib/eventBountiesStore.js";

const DEFAULT_SITES = ["Wightstorm Muster Point", "Wightstorm Forward Base", "Wightstorm Transit Site", "Event Site"];

export default function EventTracking() {
  const [siteType, setSiteType] = useState(DEFAULT_SITES[0]);
  const [clearTime, setClearTime] = useState("");
  const [cargoText, setCargoText] = useState("");
  const [runs, setRuns] = useState([]);
  const [bounties, setBounties] = useState([]);
  const [preview, setPreview] = useState({ items: [], unknownLines: [] });
  const [pricing, setPricing] = useState({ isLoading: false, error: "" });

  const [bountyText, setBountyText] = useState("");
  const [bountyStatus, setBountyStatus] = useState(null); 

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    setRuns(loadEventRuns());
    setBounties(loadEventBounties());

    const onStorage = (e) => {
      if (e.key === "event:runs:v1") setRuns(loadEventRuns());
      if (e.key === "event:bounties:v1") setBounties(loadEventBounties());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const shownRuns = runs.slice(0, 5);
  const showingCount = shownRuns.length;
  const totalCount = runs.length;

  const summary = useMemo(
    () => computeSummary(runs, bounties),
    [runs, bounties]
  );

  const handleImportClick = () => fileInputRef.current?.click();
  const handleImportChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const merged = await importEventRunsFromFile(file);
      setRuns(merged);
    } catch (err) {
      alert(`Import failed: ${err?.message || String(err)}`);
    } finally {
      e.target.value = "";
    }
  };

  const handleDelete = (id) => {
    deleteEventRun(id);
    setRuns(loadEventRuns());
  };

  const handleReset = () => {
    setSiteType(DEFAULT_SITES[0]);
    setClearTime("");
    setCargoText("");
    setPreview({ items: [], unknownLines: [] });
    setPricing({ isLoading: false, error: "" });
  };

  const handleSubmitRun = async (e) => {
    e.preventDefault();
    setPricing({ isLoading: true, error: "" });

    try {
      const minutes = clearTime === "" ? 0 : Number(clearTime);
      const { items: parsedItems } = parseCargo(cargoText);

      // Price with event logic (Shard override + Jita)
      await priceEventItems(parsedItems).then(({ items: pricedItems, lootISK }) => {
        addEventRun({
          siteType,
          clearTimeMinutes: Number.isFinite(minutes) ? minutes : 0,
          cargoText: cargoText.trim(),
          items: pricedItems,
          lootISK,
        });
      });

      // IMPORTANT: reload from store instead of manually pushing, to avoid duplicates
      setRuns(loadEventRuns());

      setClearTime("");
      setCargoText("");
      setPreview({ items: [], unknownLines: [] });
      setPricing({ isLoading: false, error: "" });
    } catch (err) {
      setPricing({ isLoading: false, error: err?.message || String(err) });
    }
  };

  const handleSubmitBounties = (e) => {
    e.preventDefault();
    setBountyStatus(null);

    try {
      const ticks = parseBountyTicks(bountyText);
      if (!ticks.length) {
        setBountyStatus({
          added: 0,
          skipped: 0,
          error: "No bounty ticks found in pasted text.",
        });
        return;
      }

      const result = addBountyTicks(ticks);
      setBountyStatus({ ...result, error: "" });
      setBountyText("");
      setBounties(loadEventBounties());
    } catch (err) {
      setBountyStatus({
        added: 0,
        skipped: 0,
        error: err?.message || String(err),
      });
    }
  };

  return (
    <div className="ded-tracking-page event-page">
      {/* hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={handleImportChange}
      />

      <div className="ded-header">
        <h1>Event Tracking</h1>
        <p>
          Track your isk/hour from the event! Copy your cargo and bounty straight from your wallet.
        </p>
      </div>

      {/* Top row: two input areas side-by-side */}
      <div className="event-row">
        {/* ---- Site loot logging card ---- */}
        <div className="event-input-box loot-box">
          <div className="ded-card-title-row">
            {pricing.isLoading && <span className="ded-badge">Pricing items…</span>}
          </div>

          <form className="ded-form" onSubmit={handleSubmitRun}>
            <div className="ded-form-row">
              <label className="ded-label">
                <span>Event Site</span>
                <input
                  className="ded-input"
                  list="event-site-list"
                  value={siteType}
                  onChange={(e) => setSiteType(e.target.value)}
                />
                <datalist id="event-site-list">
                  {DEFAULT_SITES.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>

              <label className="ded-label">
                <span>Clear Time (minutes)</span>
                <input
                  className="ded-input"
                  type="number"
                  min="0"
                  step="1"
                  value={clearTime}
                  onChange={(e) => setClearTime(e.target.value)}
                  placeholder="e.g. 8"
                  required
                />
              </label>
            </div>

            <label className="ded-label">
              <span>Cargo Contents (Copy from loot)</span>
              <textarea
                className="ded-input"
                value={cargoText}
                onChange={(e) => {
                  const v = e.target.value;
                  setCargoText(v);
                  setPreview(parseCargo(v));
                }}
                placeholder="Paste the loot for this single site..."
                rows={8}
                required
              />
              <small className="ded-help">
                <strong>Note:</strong> <code>Nation Stormhive Shard</code> is valued
                at <strong>1,000,000 ISK</strong> per unit. All other items use Jita
                sell to calculate.
              </small>
            </label>

            {preview.items.length > 0 && (
              <div className="ded-preview">
                <div className="ded-preview-row">
                  <strong>Cargo items:</strong>
                  <span>
                    {preview.items.reduce((s, it) => s + it.qty, 0)} total units
                  </span>
                </div>
                <ul className="ded-preview-list">
                  {preview.items.map((it) => (
                    <li key={it.name}>
                      {it.name} — <strong>{it.qty}</strong>
                    </li>
                  ))}
                </ul>
                {preview.unknownLines.length > 0 && (
                  <div className="ded-preview-unknown">
                    Couldn’t parse {preview.unknownLines.length} line(s):
                    <pre>{preview.unknownLines.join("\n")}</pre>
                  </div>
                )}
              </div>
            )}

            <div className="ded-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleReset}
                disabled={pricing.isLoading}
              >
                Reset
              </button>
              <button
                type="submit"
                className="btn-primary"
                disabled={pricing.isLoading}
              >
                {pricing.isLoading ? "Saving…" : "Save Event Run"}
              </button>
            </div>

            {pricing.error && (
              <div className="ded-error">Pricing failed: {pricing.error}</div>
            )}
          </form>
        </div>

        {/* ---- Bounty import card ---- */}
        <div className="event-input-box bounty-box">
          <div className="ded-card-title-row">
          </div>

          <form className="ded-form" onSubmit={handleSubmitBounties}>
            <label className="ded-label">
              <span>Dank Tick Log</span>
              <textarea
                className="ded-input"
                value={bountyText}
                onChange={(e) => setBountyText(e.target.value)}
                placeholder={`Paste your bounties from your wallet.`}
                rows={8}
              />
              <small className="ded-help">
                Add your bounty payouts here copying from your wallet. Duplicates are ignored.
              </small>
            </label>

            <div className="ded-actions">
              <button type="submit" className="btn-primary">
                Add Bounties
              </button>
            </div>

            {bountyStatus && (
              <>
                {bountyStatus.error && (
                  <div className="ded-error">{bountyStatus.error}</div>
                )}
                {!bountyStatus.error && (
                  <div className="ded-preview">
                    <div className="ded-preview-row">
                      <strong>Bounty import complete</strong>
                      <span>
                        Added {bountyStatus.added}, Skipped {bountyStatus.skipped} duplicate
                        {bountyStatus.skipped === 1 ? "" : "s"}.
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </form>
        </div>
      </div>

      {(runs.length > 0 || bounties.length > 0) && (
      <div className="ded-card event-summary-card">
        <div className="ded-card-title-row event-summary-header">
          <h2 className="ded-card-title">
            ❄ Event Income Summary
          </h2>
          <span className="event-summary-tag">Winter Event</span>
        </div>
        <div className="event-summary-grid">
          <div className="event-summary-block">
            <div className="event-summary-label">All Time</div>
            <div className="event-summary-total">
              {formatISK(summary.allTime.totalISK)}
            </div>
            <div className="event-summary-lines">
              <span className="event-summary-line">
                ❄ Loot: {formatISK(summary.allTime.lootISK)}
              </span>
              <span className="event-summary-line">
                ☃ Bounties: {formatISK(summary.allTime.bountyISK)}
              </span>
            </div>
          </div>

          <div className="event-summary-block">
            <div className="event-summary-label">Last 24 Hours</div>
            <div className="event-summary-total">
              {formatISK(summary.last24h.totalISK)}
            </div>
            <div className="event-summary-lines">
              <span className="event-summary-line">
                ❄ Loot: {formatISK(summary.last24h.lootISK)}
              </span>
              <span className="event-summary-line">
                ☃ Bounties: {formatISK(summary.last24h.bountyISK)}
              </span>
            </div>
          </div>
        </div>
      </div>
    )}


      {/* ---- Recent runs list ---- */}
      <div className="ded-run-list">
        {totalCount === 0 ? (
          <em>No event runs logged yet — save your first run to populate this list.</em>
        ) : (
          <>
            <table className="ded-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Site</th>
                  <th>Time (min)</th>
                  <th>Items</th>
                  <th>Loot ISK</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shownRuns.map((run) => (
                  <tr key={run.id}>
                    <td>{new Date(run.createdAt).toLocaleString()}</td>
                    <td>{run.siteType}</td>
                    <td>{run.clearTimeMinutes}</td>
                    <td>{run.items?.length ?? 0}</td>
                    <td>{formatISK(run.lootISK || 0)}</td>
                    <td>
                      <button className="btn-danger" onClick={() => handleDelete(run.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ded-run-footer">
              <span className="ded-muted">
                Showing {showingCount} of {totalCount} run{totalCount === 1 ? "" : "s"}
              </span>
              <button
                className="btn-analytics-link"
                onClick={() => navigate("/event-analytics")}
              >
                View Analytics →
              </button>
            </div>
          </>
        )}
      </div>

      {/* Floating cog (currently just for import trigger, keeping it minimal) */}
      <div className="ded-fab">
        <button
          aria-label="Event import"
          className="ded-fab-button"
          onClick={handleImportClick}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M19.4 13.5a7.6 7.6 0 0 0 .05-3l1.68-1.22-1.9-3.29-1.98.58a7.63 7.63 0 0 0-2.6-1.5l-.4-2.03H9.75l-.4 2.03a7.63 7.63 0 0 0-2.6 1.5l-1.98-.58L2.87 9.3 4.55 10.5a7.6 7.6 0 0 0 0 3l-1.68 1.22 1.9 3.29 1.98-.58a7.63 7.63 0 0 0 2.6 1.5l.4 2.03h3.12l.4-2.03a7.63 7.63 0 0 0 2.6-1.5l1.98.58 1.9-3.29L19.4 13.5Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* -------- helpers -------- */

function formatISK(v) {
  try {
    return `${new Intl.NumberFormat().format(Math.round(v))} ISK`;
  } catch {
    return `${Math.round(v)} ISK`;
  }
}

function computeSummary(runs, bounties) {
  const now = Date.now();
  const cutoff = now - 24 * 60 * 60 * 1000;

  let lootAll = 0;
  let loot24 = 0;

  for (const r of runs) {
    const loot = Number(r.lootISK) || 0;
    lootAll += loot;
    const t = timeMsFrom(r.createdAt);
    if (t != null && t >= cutoff) loot24 += loot;
  }

  let bountyAll = 0;
  let bounty24 = 0;

  for (const b of bounties) {
    const tick = Number(b.tickISK) || 0;
    bountyAll += tick;
    const t = timeMsFrom(b.walletTimestamp);
    if (t != null && t >= cutoff) bounty24 += tick;
  }

  return {
    allTime: {
      lootISK: lootAll,
      bountyISK: bountyAll,
      totalISK: lootAll + bountyAll,
    },
    last24h: {
      lootISK: loot24,
      bountyISK: bounty24,
      totalISK: loot24 + bounty24,
    },
  };
}

function timeMsFrom(v) {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : null;
}
