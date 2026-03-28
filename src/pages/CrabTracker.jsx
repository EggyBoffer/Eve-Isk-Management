import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/crabs.css";
import { parseCrabBounties, sumCrabBounties } from "../lib/parsers/features/crabs/bountyParser";
import { parseCrabLoot, priceCrabLoot, sumCrabLoot } from "../lib/parsers/features/crabs/lootPricing";
import { getRecentCrabRuns, saveCrabRun } from "../lib/crabStore";
import { priceItemsJita } from "../lib/marketClient";

const BEACON_OPTIONS = [
  {
    value: "CRAB",
    label: "CRAB Beacon",
    typeId: 60244,
    maxDuration: 60,
  },
  {
    value: "CCRAB",
    label: "CCRAB Beacon",
    typeId: 92183,
    maxDuration: 90,
  },
];

function formatISK(n) {
  return `${Math.round(Number(n || 0)).toLocaleString("en-GB")} ISK`;
}

function formatCompactISK(n) {
  const value = Number(n || 0);
  const abs = Math.abs(value);

  if (abs >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 1 : 2).replace(/\.0$/, "")}b`;
  }

  if (abs >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(abs >= 100_000_000 ? 1 : 2).replace(/\.0$/, "")}m`;
  }

  if (abs >= 1_000) {
    return `${(value / 1_000).toFixed(abs >= 100_000 ? 1 : 2).replace(/\.0$/, "")}k`;
  }

  return `${Math.round(value)}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return String(value).replace("T", " ");
}

function getBeaconConfig(beaconType) {
  return BEACON_OPTIONS.find((x) => x.value === beaconType) || BEACON_OPTIONS[0];
}

function parseBountyTimestamp(value) {
  if (!value) return null;
  const match = String(value).match(
    /^(\d{4})\.(\d{2})\.(\d{2})\s+(\d{2}):(\d{2})$/
  );
  if (!match) return null;

  const [, year, month, day, hour, minute] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    0,
    0
  );

  return Number.isNaN(date.getTime()) ? null : date;
}

function getBountySpanMinutes(entries) {
  const times = entries
    .map((entry) => parseBountyTimestamp(entry.entry_time))
    .filter(Boolean)
    .map((date) => date.getTime());

  if (times.length < 2) return 0;

  const min = Math.min(...times);
  const max = Math.max(...times);
  return Math.round((max - min) / 60000);
}

function getPayoutWindowCount(entries) {
  const windows = new Set(
    entries
      .map((entry) => String(entry.entry_time || "").trim())
      .filter(Boolean)
  );
  return windows.size;
}

function getExpectedPayoutWindows(maxDuration) {
  return Math.max(1, Math.ceil(maxDuration / 20));
}

export default function CrabTracker() {
  const navigate = useNavigate();

  const [primaryCharacter, setPrimaryCharacter] = useState("");
  const [beaconType, setBeaconType] = useState("CRAB");
  const [beaconCost, setBeaconCost] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [runDate, setRunDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [bountyText, setBountyText] = useState("");
  const [lootText, setLootText] = useState("");
  const [recentRuns, setRecentRuns] = useState([]);
  const [saving, setSaving] = useState(false);
  const [pricingBeacon, setPricingBeacon] = useState(false);
  const [pricingLoot, setPricingLoot] = useState(false);
  const [parsedLoot, setParsedLoot] = useState([]);
  const [lootUnknownLines, setLootUnknownLines] = useState([]);
  const [lootUnresolvedItems, setLootUnresolvedItems] = useState([]);
  const [importStatus, setImportStatus] = useState(null);

  const parsedBounties = useMemo(() => parseCrabBounties(bountyText), [bountyText]);
  const bountiesTotal = useMemo(() => sumCrabBounties(parsedBounties), [parsedBounties]);
  const lootTotal = useMemo(() => sumCrabLoot(parsedLoot), [parsedLoot]);

  const participants = useMemo(() => {
    const unique = new Set(
      parsedBounties
        .map((entry) => String(entry.character_name || "").trim())
        .filter(Boolean)
    );
    return Array.from(unique);
  }, [parsedBounties]);

  const grossTotal = bountiesTotal + lootTotal;
  const numericBeaconCost = Number(beaconCost || 0);
  const netProfit = grossTotal - numericBeaconCost;
  const selectedBeacon = getBeaconConfig(beaconType);
  const recent10 = useMemo(() => recentRuns.slice(0, 10), [recentRuns]);

  const payoutWindowCount = useMemo(
    () => getPayoutWindowCount(parsedBounties),
    [parsedBounties]
  );

  const bountySpanMinutes = useMemo(
    () => getBountySpanMinutes(parsedBounties),
    [parsedBounties]
  );

  const expectedPayoutWindows = useMemo(
    () => getExpectedPayoutWindows(selectedBeacon.maxDuration),
    [selectedBeacon.maxDuration]
  );

  const trackerWarnings = useMemo(() => {
    const warnings = [];

    if (pricingLoot) {
      warnings.push("Loot pricing is still loading.");
    }

    if (!lootText.trim()) {
      warnings.push("No loot has been pasted for this run yet.");
    }

    if (lootUnresolvedItems.length > 0) {
      warnings.push(
        `Some loot items could not be resolved: ${lootUnresolvedItems.join(", ")}.`
      );
    }

    if (parsedBounties.length > 0 && bountySpanMinutes > selectedBeacon.maxDuration + 5) {
      warnings.push(
        `Bounty entries span ${bountySpanMinutes} minutes, which is longer than the ${selectedBeacon.maxDuration}-minute limit for ${selectedBeacon.label}.`
      );
    }

    if (payoutWindowCount > expectedPayoutWindows) {
      warnings.push(
        `There are ${payoutWindowCount} payout windows pasted, which is more than the usual ${expectedPayoutWindows} for ${selectedBeacon.label}. Check that you have not pasted more than one run.`
      );
    }

    return warnings;
  }, [
    pricingLoot,
    lootText,
    lootUnresolvedItems,
    parsedBounties.length,
    bountySpanMinutes,
    selectedBeacon.maxDuration,
    selectedBeacon.label,
    payoutWindowCount,
    expectedPayoutWindows,
  ]);

  useEffect(() => {
    loadRecentRuns();
  }, []);

  useEffect(() => {
    setDurationMinutes(selectedBeacon.maxDuration);
  }, [beaconType, selectedBeacon.maxDuration]);

  useEffect(() => {
    if (primaryCharacter.trim()) return;
    const firstCharacter = parsedBounties.find(
      (entry) => String(entry.character_name || "").trim()
    )?.character_name;
    if (firstCharacter) {
      setPrimaryCharacter(firstCharacter);
    }
  }, [parsedBounties, primaryCharacter]);

  useEffect(() => {
    let cancelled = false;

    async function loadBeaconPrice() {
      setPricingBeacon(true);

      try {
        const priced = await priceItemsJita([{ typeId: selectedBeacon.typeId, qty: 1 }]);

        if (cancelled) return;

        const unitPrice = Number(priced?.items?.[0]?.unitPrice || 0);
        if (unitPrice > 0) {
          setBeaconCost(String(Math.round(unitPrice)));
        }
      } catch {
      } finally {
        if (!cancelled) setPricingBeacon(false);
      }
    }

    loadBeaconPrice();

    return () => {
      cancelled = true;
    };
  }, [selectedBeacon.typeId]);

  useEffect(() => {
    let cancelled = false;

    async function loadLootPricing() {
      const quickParsed = parseCrabLoot(lootText);
      setLootUnknownLines(quickParsed.unknownLines || []);
      setLootUnresolvedItems([]);

      if (!lootText.trim()) {
        setParsedLoot([]);
        return;
      }

      if (!quickParsed.items.length) {
        setParsedLoot([]);
        return;
      }

      setPricingLoot(true);

      try {
        const priced = await priceCrabLoot(lootText);
        if (cancelled) return;
        setParsedLoot(priced.items || []);
        setLootUnknownLines(priced.unknownLines || []);
        setLootUnresolvedItems(priced.unresolvedItems || []);
      } catch {
        if (cancelled) return;
        setParsedLoot(quickParsed.items || []);
      } finally {
        if (!cancelled) setPricingLoot(false);
      }
    }

    loadLootPricing();

    return () => {
      cancelled = true;
    };
  }, [lootText]);

  async function loadRecentRuns() {
    try {
      const runs = await getRecentCrabRuns(25);
      setRecentRuns(Array.isArray(runs) ? runs : []);
    } catch {
      setRecentRuns([]);
    }
  }

  function clearPaste() {
    setBountyText("");
    setLootText("");
    setParsedLoot([]);
    setLootUnknownLines([]);
    setLootUnresolvedItems([]);
    setImportStatus(null);
  }

  async function handleSave() {
    if (saving || pricingLoot) return;

    setImportStatus(null);

    if (!runDate) {
      setImportStatus({ error: "Run date is required." });
      return;
    }

    if (!parsedBounties.length) {
      setImportStatus({ error: "No valid bounty entries found in pasted text." });
      return;
    }

    if (!Number.isFinite(numericBeaconCost) || numericBeaconCost < 0) {
      setImportStatus({ error: "Beacon cost must be a valid number." });
      return;
    }

    if (pricingLoot) {
      setImportStatus({ error: "Loot pricing is still loading. Wait a moment and try again." });
      return;
    }

    const safeDuration = Math.min(
      Math.max(1, Number(durationMinutes || selectedBeacon.maxDuration)),
      selectedBeacon.maxDuration
    );

    const payload = {
      run_date: runDate,
      primary_character: primaryCharacter.trim(),
      site_type: beaconType,
      beacon_type: selectedBeacon.label,
      beacon_type_id: selectedBeacon.typeId,
      beacon_cost: numericBeaconCost,
      duration_minutes: safeDuration,
      bounties_total: bountiesTotal,
      loot_total: lootTotal,
      gross_total: grossTotal,
      net_profit: netProfit,
      bounties: parsedBounties,
      loot: parsedLoot,
    };

    try {
      setSaving(true);

      const result = await saveCrabRun(payload);

      if (!result?.success) {
        setImportStatus({ error: result?.error || "Failed to save CRAB run." });
        return;
      }

      setPrimaryCharacter("");
      setBeaconType("CRAB");
      setBeaconCost("");
      setDurationMinutes(60);
      setRunDate(new Date().toISOString().slice(0, 16));
      setBountyText("");
      setLootText("");
      setParsedLoot([]);
      setLootUnknownLines([]);
      setLootUnresolvedItems([]);
      setImportStatus({
        ok: `Saved CRAB run with ${parsedBounties.length} bounty entr${parsedBounties.length === 1 ? "y" : "ies"} and ${parsedLoot.length} loot line${parsedLoot.length === 1 ? "" : "s"}.`,
      });

      await loadRecentRuns();
    } catch (err) {
      setImportStatus({ error: err?.message || "Failed to save CRAB run." });
    } finally {
      setSaving(false);
    }
  }

  const statusClass =
    "crabImportStatus" + (importStatus?.error ? " crabImportStatus--error" : "");

  return (
    <div className="crabPage">
      <div className="crabBackdrop" aria-hidden="true" />

      <div className="crabWrap">
        <div className="crabHeader">
          <h1>CRAB Tracker</h1>
          <p>Paste Wallet ticks and Beacon loot to monitor your isk/hour.</p>
        </div>

        <div className="crabTwoCol">
          <div className="crabPanel">
            <div className="crabPanelHead">
              <h2>Run Entry</h2>
              <div className="crabPanelHeadActions">
                <button
                  type="button"
                  className="crabLinkBtn"
                  onClick={() => navigate("/crabs/analytics")}
                >
                  View Analytics →
                </button>
                <div className="crabPill">{parsedBounties.length} entries</div>
              </div>
            </div>

            <div className="crabFieldsGrid">
              <div className="crabField">
                <label>Primary Character</label>
                <input
                  type="text"
                  value={primaryCharacter}
                  onChange={(e) => setPrimaryCharacter(e.target.value)}
                  placeholder="Optional display character"
                />
              </div>

              <div className="crabField">
                <label>Run Date / Time</label>
                <input
                  type="datetime-local"
                  value={runDate}
                  onChange={(e) => setRunDate(e.target.value)}
                />
              </div>

              <div className="crabField">
                <label>Beacon Type</label>
                <select value={beaconType} onChange={(e) => setBeaconType(e.target.value)}>
                  {BEACON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="crabField">
                <label>Beacon Cost</label>
                <input
                  type="number"
                  value={beaconCost}
                  onChange={(e) => setBeaconCost(e.target.value)}
                  placeholder={pricingBeacon ? "Fetching Jita price..." : "0"}
                  min="0"
                />
              </div>

              <div className="crabField">
                <label>Duration (minutes)</label>
                <input
                  type="number"
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(e.target.value)}
                  min="1"
                  max={selectedBeacon.maxDuration}
                />
              </div>
            </div>

            <div className="crabTextBlock">
              <div className="crabTextBlockHead">
                <h3>Bounty Entries</h3>
                <div className="crabSubtle">Paste wallet log lines for all participating characters.</div>
              </div>
              <textarea
                className="crabTextarea"
                value={bountyText}
                onChange={(e) => setBountyText(e.target.value)}
                spellCheck={false}
                placeholder="Paste bounty wallet entries here..."
              />
            </div>

            <div className="crabTextBlock">
              <div className="crabTextBlockHead">
                <h3>Loot</h3>
                <div className="crabSubtle">
                  {pricingLoot ? "Pricing loot from Jita..." : "Paste cargo-style loot lines here."}
                </div>
              </div>
              <textarea
                className="crabTextarea crabTextarea--loot"
                value={lootText}
                onChange={(e) => setLootText(e.target.value)}
                spellCheck={false}
                placeholder="Paste loot lines here..."
              />
            </div>

            <div className="crabInputRow">
              <button className="crabBtn ghost" onClick={clearPaste}>
                Clear Paste
              </button>
              <button className="crabBtn" onClick={handleSave} disabled={saving || pricingLoot}>
                {saving ? "Saving..." : "Save Run"}
              </button>
            </div>

            {trackerWarnings.length > 0 && (
              <div className="crabImportStatus">
                <div className="crabWarn">
                  <ul className="crabWarnList">
                    {trackerWarnings.map((warning, index) => (
                      <li key={`${warning}-${index}`}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {importStatus && (
              <div className={statusClass}>
                {importStatus.error ? (
                  <div className="crabError">{importStatus.error}</div>
                ) : (
                  <div className="crabOk">{importStatus.ok}</div>
                )}
              </div>
            )}
          </div>

          <div className="crabPanel">
            <div className="crabPanelHead">
              <h2>Summary</h2>
              <div className="crabPill">{selectedBeacon.value}</div>
            </div>

            <div className="crabMetricsGrid">
              <div className="crabMetric">
                <div className="crabMetricLabel">Bounties Total</div>
                <div className="crabMetricValue">{formatISK(bountiesTotal)}</div>
              </div>

              <div className="crabMetric">
                <div className="crabMetricLabel">Loot Total</div>
                <div className="crabMetricValue">{formatISK(lootTotal)}</div>
              </div>

              <div className="crabMetric">
                <div className="crabMetricLabel">Beacon Cost</div>
                <div className="crabMetricValue">{formatISK(numericBeaconCost)}</div>
              </div>

              <div className="crabMetric">
                <div className="crabMetricLabel">Net Profit</div>
                <div className="crabMetricValue crabMetricValue--profit">{formatISK(netProfit)}</div>
              </div>

              <div className="crabMetric">
                <div className="crabMetricLabel">Participants</div>
                <div className="crabMetricValue">{participants.length}</div>
              </div>

              <div className="crabMetric">
                <div className="crabMetricLabel">Loot Lines</div>
                <div className="crabMetricValue">{parsedLoot.length}</div>
              </div>

              <div className="crabMetric">
                <div className="crabMetricLabel">Max Duration</div>
                <div className="crabMetricValue">{selectedBeacon.maxDuration} min</div>
              </div>

              <div className="crabMetric">
                <div className="crabMetricLabel">Gross Income</div>
                <div className="crabMetricValue">{formatISK(grossTotal)}</div>
              </div>
            </div>

            <div className="crabSummaryList">
              <div className="crabSummaryRow">
                <span>Beacon</span>
                <strong>{selectedBeacon.label}</strong>
              </div>
              <div className="crabSummaryRow">
                <span>Primary Character</span>
                <strong>{primaryCharacter.trim() || "-"}</strong>
              </div>
              <div className="crabSummaryRow">
                <span>Run Time</span>
                <strong>{formatDateTime(runDate)}</strong>
              </div>
              <div className="crabSummaryRow">
                <span>Payout Windows</span>
                <strong>{payoutWindowCount || "-"}</strong>
              </div>
              <div className="crabSummaryRow">
                <span>Bounty Span</span>
                <strong>{parsedBounties.length > 1 ? `${bountySpanMinutes} min` : "-"}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="crabPanel crabPanelSpacer">
          <div className="crabPanelHead">
            <h2>Parsed Bounty Entries</h2>
            <div className="crabSubtle">
              {parsedBounties.length ? `${parsedBounties.length} parsed` : "Nothing parsed yet"}
            </div>
          </div>

          {parsedBounties.length === 0 ? (
            <div className="crabEmpty">Paste wallet entries to preview wallet lines.</div>
          ) : (
            <div className="crabTableWrap">
              <table className="crabTable">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Character</th>
                    <th>System</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedBounties.map((entry, index) => (
                    <tr key={`${entry.entry_time}-${entry.character_name}-${entry.amount}-${index}`}>
                      <td>{entry.entry_time}</td>
                      <td>{entry.character_name || "Unknown"}</td>
                      <td>{entry.system_name || "-"}</td>
                      <td>{formatISK(entry.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="crabPanel crabPanelSpacer">
          <div className="crabPanelHead">
            <h2>Parsed Loot</h2>
            <div className="crabSubtle">
              {parsedLoot.length ? `${parsedLoot.length} parsed` : "Nothing parsed yet"}
            </div>
          </div>

          {parsedLoot.length === 0 ? (
            <div className="crabEmpty">Paste loot lines to add loot!</div>
          ) : (
            <div className="crabTableWrap">
              <table className="crabTable crabTable--loot">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Qty</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedLoot.map((item, index) => (
                    <tr key={`${item.item_name}-${index}`}>
                      <td>{item.item_name}</td>
                      <td>{item.quantity}</td>
                      <td>{formatISK(item.unit_price)}</td>
                      <td>{formatISK(item.total_price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lootUnknownLines.length > 0 && (
            <div className="crabImportStatus">
              <div className="crabError">
                {lootUnknownLines.length} loot line{lootUnknownLines.length === 1 ? "" : "s"} could not be parsed.
              </div>
            </div>
          )}

          {lootUnresolvedItems.length > 0 && (
            <div className="crabImportStatus">
              <div className="crabError">
                Could not resolve type IDs for: {lootUnresolvedItems.join(", ")}
              </div>
            </div>
          )}
        </div>

        <div className="crabPanel crabPanelSpacer">
          <div className="crabPanelHead">
            <h2>Recent CRAB Runs</h2>
            {recentRuns.length > 10 && (
              <div className="crabSubtle">Showing latest 10 of {recentRuns.length}.</div>
            )}
          </div>

          {recentRuns.length === 0 ? (
            <div className="crabEmpty">No saved CRAB runs yet. Save one to see it here.</div>
          ) : (
            <div className="crabTableWrap crabTableWrap--recent">
              <table className="crabTable crabTable--recent">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Character</th>
                    <th>Type</th>
                    <th>Beacon</th>
                    <th>Duration</th>
                    <th>Bounties</th>
                    <th>Loot</th>
                    <th>Beacon Cost</th>
                    <th>Net Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {recent10.map((run) => (
                    <tr key={run.id}>
                      <td>{formatDateTime(run.run_date)}</td>
                      <td>{run.primary_character || run.participants?.join(", ") || "-"}</td>
                      <td>{run.site_type}</td>
                      <td>{run.beacon_type}</td>
                      <td>{run.duration_minutes}m</td>
                      <td title={formatISK(run.bounties_total)}>{formatCompactISK(run.bounties_total)}</td>
                      <td title={formatISK(run.loot_total)}>{formatCompactISK(run.loot_total)}</td>
                      <td title={formatISK(run.beacon_cost)}>{formatCompactISK(run.beacon_cost)}</td>
                      <td title={formatISK(run.net_profit)}>{formatCompactISK(run.net_profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}