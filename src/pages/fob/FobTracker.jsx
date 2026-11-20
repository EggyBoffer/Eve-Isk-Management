import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  RefreshCw,
  Download,
  TrendingUp,
  Target,
  AlertTriangle,
  Receipt,
  Users,
  Info,
} from "lucide-react";

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

const muted = { color: "#94a3b8" };

function formatISK(value) {
  const number = Number(value) || 0;
  const absolute = Math.abs(number);

  if (absolute >= 1e9) {
    return `${(number / 1e9).toFixed(2)}B ISK`;
  }

  if (absolute >= 1e6) {
    return `${(number / 1e6).toFixed(2)}M ISK`;
  }

  return `${Math.round(number).toLocaleString("en-GB")} ISK`;
}

function formatDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) return "Unknown";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

function getFaction(typeId) {
  if (Number(typeId) === 46363) return "Guristas Pirates";
  if (Number(typeId) === 46364) return "Blood Raiders";
  return "Unknown";
}

function Metric({ icon, label, value, detail, tooltip }) {
  const IconComponent = icon;

  return (
    <div style={panel}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: "#94a3b8",
        marginBottom: 12,
      }}>
        <IconComponent size={18} />
        <span>{label}</span>
        {tooltip && (
          <span
            title={tooltip}
            aria-label={tooltip}
            tabIndex={0}
            style={{ display: "inline-flex", cursor: "help", color: "#93c5fd" }}
          >
            <Info size={15} />
          </span>
        )}
      </div>
      <div style={{
        fontSize: 27,
        fontWeight: 700,
        color: "#f8fafc",
      }}>
        {value}
      </div>
      <div style={{
        ...muted,
        fontSize: 12,
        marginTop: 7,
      }}>
        {detail}
      </div>
    </div>
  );
}

function ActivityChart({ data, days = 7, metric = "income" }) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const entries = new Map((Array.isArray(data) ? data : []).map((row) => [row.date, row]));
  const rows = Array.from({ length: days }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - (days - 1 - index));
    const day = date.toISOString().slice(0, 10);
    return entries.get(day) ?? { date: day, grossIncome: 0, payoutCount: 0, completions: 0 };
  });
  const key = metric === "completions" ? "completions" : "grossIncome";

  const maximum = Math.max(
    1,
    ...rows.map((row) => Number(row[key] ?? (metric === "income" ? row.income : 0)) || 0)
  );

  if (!rows.length) {
    return <p style={muted}>No activity recorded for this period.</p>;
  }

  return (
    <div style={{
      display: "flex",
      alignItems: "end",
      gap: 7,
      height: 230,
      overflowX: "hidden",
      paddingTop: 12,
      paddingBottom: 8,
    }}>
      {rows.map((row) => {
        const income = Number(row[key] ?? (metric === "income" ? row.income : 0)) || 0;
        const height = income === 0 ? 0 : Math.max(3, income / maximum * 170);

        return (
          <div
            key={row.date}
            title={metric === "completions" ? `${row.date}: ${income} FOBs completed` : `${row.date}: ${formatISK(income)} (${row.payoutCount} payouts)`}
            style={{
              minWidth: 0,
              flex: "1 1 0",
              textAlign: "center",
            }}
          >
            <div style={{
              height: 175,
              display: "flex",
              alignItems: "end",
              justifyContent: "center",
            }}>
              <div style={{
                height,
                width: "75%",
                borderRadius: "5px 5px 0 0",
                background: "linear-gradient(180deg, #60a5fa, #2563eb)",
              }} />
            </div>
            <div style={{
              fontSize: 10,
              marginTop: 9,
              color: "#94a3b8",
            }}>
              {row.date.slice(5)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function FobTracker() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [corporations, setCorporations] = useState([]);
  const [selectedCorporation, setSelectedCorporation] = useState("");
  const [killmails, setKillmails] = useState([]);
  const [killmailUrl, setKillmailUrl] = useState("");
  const [period, setPeriod] = useState("30");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastSync, setLastSync] = useState(null);
  const [importFeedback, setImportFeedback] = useState(null);

  const corporationOptions = useMemo(() => {
    const seen = new Set();

    return corporations.filter((corp) => {
      if (corp.status !== "valid") return false;
      if (seen.has(corp.corporationId)) return false;
      seen.add(corp.corporationId);
      return true;
    });
  }, [corporations]);

  const selectedAuthorisation = useMemo(() => {
    return corporations.find(
      (corp) =>
        corp.status === "valid" &&
        String(corp.corporationId) === selectedCorporation
    );
  }, [corporations, selectedCorporation]);

  const loadDashboard = useCallback(async () => {
    if (!window.api?.fobGetAnalyticsDashboard) {
      throw new Error("FOB Analytics API is unavailable.");
    }

    const options = {
      historyDays: Number(period),
      ...(selectedCorporation
        ? { corporationId: Number(selectedCorporation) }
        : {}),
    };

    const [analytics, chartAnalytics, recent] = await Promise.all([
      window.api.fobGetAnalyticsDashboard(options),
      Number(period) < 14
        ? window.api.fobGetAnalyticsDashboard({ ...options, historyDays: 14 })
        : Promise.resolve(null),
      window.api.fobListKillmails({ limit: 100 }),
    ]);

    setDashboard(chartAnalytics
      ? { ...analytics, history: chartAnalytics.history }
      : analytics);
    setKillmails(
      Array.isArray(recent)
        ? recent.filter((kill) => kill.classification === "confirmed").slice(0, 10)
        : []
    );
  }, [period, selectedCorporation]);

  const loadConnections = useCallback(async () => {
    if (!window.api?.esiListCorporations) return;

    const result = await window.api.esiListCorporations();

    setCorporations(Array.isArray(result) ? result : []);
  }, []);

  const loadSyncStatus = useCallback(async () => {
    if (!window.api?.esiGetAutoSyncStatus) return;

    const result = await window.api.esiGetAutoSyncStatus();
    setLastSync(result);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        await Promise.all([
          loadDashboard(),
          loadConnections(),
          loadSyncStatus(),
        ]);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || "Unable to load FOB data.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [loadDashboard, loadConnections, loadSyncStatus]);

  async function syncWallet() {
    if (syncing) return;

    setError("");
    setNotice("");

    if (selectedCorporation && !selectedAuthorisation) {
      setError("The selected corporation wallet is not authorised.");
      return;
    }

    if (selectedCorporation && !window.api?.esiSyncCorporationJournal) {
      setError("Corporation wallet synchronisation is unavailable.");
      return;
    }

    if (!selectedCorporation && !window.api?.esiRunAutoSync) {
      setError("Linked wallet synchronisation is unavailable.");
      return;
    }

    setSyncing(true);

    try {
      const result = selectedCorporation
        ? await window.api.esiSyncCorporationJournal(
          selectedAuthorisation.characterId,
          1,
          20
        )
        : await window.api.esiRunAutoSync();

      await Promise.all([
        loadDashboard(),
        loadSyncStatus(),
      ]);

      if (selectedCorporation) {
        setNotice(
          `Wallet sync completed. ${result?.inserted ?? 0} new entries, ${result?.updated ?? 0} updated.`
        );
      } else {
        const results = Array.isArray(result?.results) ? result.results : [];
        const failed = results.filter((entry) => entry.error || entry.success === false);
        const inserted = results.reduce((sum, entry) => sum + (Number(entry.inserted) || 0), 0);
        const updated = results.reduce((sum, entry) => sum + (Number(entry.updated) || 0), 0);
        setNotice(
          `Linked wallet sync finished. ${inserted} new entries, ${updated} updated across ${results.length} sources.${failed.length ? ` ${failed.length} sources reported errors; check sync status.` : ""}`
        );
      }
    } catch (err) {
      setError(err?.message || "Wallet synchronisation failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function importKillmail(event) {
    event.preventDefault();

    if (importing || !killmailUrl.trim()) return;

    setImporting(true);
    setError("");
    setNotice("");
    setImportFeedback(null);

    try {
      const result = await window.api.fobImportKillmail(
        killmailUrl.trim()
      );

      await loadDashboard();

      setKillmailUrl("");

      const message = result?.refreshed
        ? "FOB killmail details updated."
        : result?.duplicate
          ? "This killmail has already been imported."
          : result?.killmail?.classification === "confirmed"
            ? "FOB killmail imported successfully."
            : "Killmail imported, but not confirmed as a FOB.";
      setNotice(message);
      setImportFeedback({ type: "success", title: message, detail: "" });
    } catch (err) {
      setImportFeedback({
        type: "error",
        title: "Killmail import failed",
        detail: err?.message || "Unable to import this killmail.",
      });
    } finally {
      setImporting(false);
    }
  }

  const summary = dashboard?.summary;
  const history = dashboard?.history?.data || [];
  const factions = dashboard?.completions?.factions || [];
  const income = summary?.income;

  return (
    <div style={{
      minHeight: "100vh",
      padding: "86px 28px 70px",
      color: "#f8fafc",
      background: "linear-gradient(145deg, #080f1d, #111c32)",
    }}>
      <div style={{ maxWidth: 1400, margin: "0 auto" }}>
        <header style={{
          ...panel,
          position: "relative",
          marginBottom: 30,
          background: "linear-gradient(105deg, rgba(27, 48, 65, 0.95), rgba(19, 21, 35, 0.95))",
          padding: "26px 24px",
        }}>
          <div style={{ paddingRight: 190 }}>
            <h1 style={{
              fontSize: 36,
              fontWeight: 800,
              letterSpacing: 1,
              color: "#38bdf8",
              margin: "0 0 10px",
            }}>
              FOBs
            </h1>
            <p style={{ margin: 0, color: "#cbd5e1", fontSize: 15 }}>
              FOB income and completed runs.
            </p>
          </div>
          <button
            type="button"
            style={{
              ...button,
              position: "absolute",
              right: 20,
              top: 20,
              opacity: syncing || (selectedCorporation && !selectedAuthorisation) ? 0.5 : 1,
            }}
            disabled={syncing || (selectedCorporation && !selectedAuthorisation)}
            onClick={syncWallet}
          >
            <RefreshCw size={17} />
            {syncing ? "Syncing..." : selectedCorporation ? "Sync Corporation" : "Sync All Wallets"}
          </button>
        </header>

        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 24,
          alignItems: "center",
        }}>
          <label htmlFor="fob-corporation">Corporation</label>
          <select
            id="fob-corporation"
            value={selectedCorporation}
            onChange={(event) => setSelectedCorporation(event.target.value)}
            style={{
              padding: 10,
              borderRadius: 8,
              background: "#17243b",
              color: "#fff",
              border: "1px solid #334155",
            }}
          >
            <option value="">All linked income</option>
            {corporationOptions.map((corp) => (
              <option
                key={corp.corporationId}
                value={corp.corporationId}
              >
                {corp.corporationName}
              </option>
            ))}
          </select>

          <label htmlFor="fob-period">Period</label>
          <select
            id="fob-period"
            value={period}
            onChange={(event) => setPeriod(event.target.value)}
            style={{
              padding: 10,
              borderRadius: 8,
              background: "#17243b",
              color: "#fff",
              border: "1px solid #334155",
            }}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last 365 days</option>
          </select>
        </div>

        {error && (
          <div role="alert" style={{
            ...panel,
            borderColor: "#ef4444",
            marginBottom: 18,
            color: "#fca5a5",
          }}>
            <AlertTriangle size={17} style={{ verticalAlign: "middle" }} />
            {" "}{error}
          </div>
        )}

        {notice && (
          <div role="status" style={{
            ...panel,
            borderColor: "#22c55e",
            marginBottom: 18,
            color: "#86efac",
          }}>
            {notice}
          </div>
        )}

         {importFeedback && (
           <div
             role={importFeedback.type === "error" ? "alert" : "status"}
             style={{
               position: "fixed",
               top: 24,
               right: 24,
               zIndex: 10000,
               width: "min(420px, calc(100vw - 48px))",
               padding: 16,
               borderRadius: 12,
               border: `1px solid ${importFeedback.type === "error" ? "#ef4444" : "#22c55e"}`,
               background: "#111d32",
               color: "#f8fafc",
               boxShadow: "0 16px 48px rgba(0, 0, 0, 0.45)",
               display: "flex",
               alignItems: "flex-start",
               gap: 12,
             }}
           >
             {importFeedback.type === "error" && (
               <AlertTriangle size={20} color="#f87171" style={{ flexShrink: 0 }} />
             )}
             <div style={{ flex: 1, minWidth: 0 }}>
               <strong>{importFeedback.title}</strong>
               {importFeedback.detail && (
                 <div style={{ color: "#cbd5e1", fontSize: 13, marginTop: 6, overflowWrap: "anywhere" }}>
                   {importFeedback.detail}
                 </div>
               )}
             </div>
             <button
               type="button"
               onClick={() => setImportFeedback(null)}
               aria-label="Dismiss import notification"
               style={{ background: "transparent", border: 0, color: "#cbd5e1", cursor: "pointer", fontSize: 20, lineHeight: 1 }}
             >
               ×
             </button>
           </div>
         )}

        {loading && (
          <p style={muted}>Loading FOB analytics...</p>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: 16,
          marginBottom: 24,
        }}>
          <Metric
            icon={TrendingUp}
            label="Income"
            value={formatISK(income?.gross ?? income?.total)}
            detail="FOB income from ESI"
            tooltip="Includes FOB wallet rewards from linked characters."
          />
          <Metric
            icon={TrendingUp}
            label="Income / FOB"
            value={summary?.averages?.iskPerFob != null
              ? formatISK(summary.averages.iskPerFob)
              : "—"}
            detail="Provisional · imported kills only"
            tooltip="Total ESI wallet income divided by imported FOB kills in the selected period. Missing killmails can greatly inflate this figure; it is not a verified per-FOB payout."
          />
          <Metric
            icon={Target}
            label="FOBs Completed"
            value={summary?.completions?.total ?? 0}
            detail="Confirmed imported FOB kills"
            tooltip="FOB kills pulled from imported killmails."
          />
          <Metric
            icon={Receipt}
            label="Corporation Tax"
            value={formatISK(income?.estimatedTax)}
            detail="Estimated from linked personal payouts"
            tooltip="Tax paid for non-user-managed corps."
          />
          <Metric
            icon={Users}
            label="Characters"
            value={income?.earningCharacters ?? 0}
            detail="Characters earning FOB income"
            tooltip="Characters with FOB income during this period."
          />
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
          marginBottom: 24,
        }}>
          <section style={panel}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <h2 style={{ fontSize: 19, margin: 0 }}>Daily Income</h2>
              <span
                title="Showing last 7 days"
                aria-label="Showing last 7 days"
                tabIndex={0}
                style={{ display: "inline-flex", cursor: "help", color: "#93c5fd" }}
              >
                <Info size={15} />
              </span>
            </div>
            <ActivityChart data={history} days={7} metric="income" />
          </section>

          <section style={panel}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <h2 style={{ fontSize: 19, margin: 0 }}>FOBs Ran</h2>
              <span
                title="Showing last 14 days"
                aria-label="Showing last 14 days"
                tabIndex={0}
                style={{ display: "inline-flex", cursor: "help", color: "#93c5fd" }}
              >
                <Info size={15} />
              </span>
            </div>
            <ActivityChart data={history} days={14} metric="completions" />
          </section>
        </div>

        <section style={{ ...panel, marginBottom: 24 }}>
          <h2 style={{ fontSize: 19, marginTop: 0 }}>
            Confirmed FOB Factions
            </h2>

            {factions.length === 0 ? (
              <p style={muted}>No confirmed FOBs in this period.</p>
            ) : (
              factions.map((faction) => (
                <div
                  key={faction.faction}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "14px 0",
                    borderBottom: "1px solid #334155",
                  }}
                >
                  <span>{faction.faction}</span>
                  <strong>{faction.completions}</strong>
                </div>
              ))
            )}


        </section>

        <section style={{ ...panel, marginBottom: 24 }}>
          <h2 style={{ fontSize: 19, marginTop: 0 }}>
            Import FOB Killmail
          </h2>

          <p style={{ ...muted, fontSize: 13 }}>
            Paste a direct ESI killmail URL to record a completion.
          </p>

          <form
            onSubmit={importKillmail}
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <input
              type="url"
              value={killmailUrl}
              onChange={(event) => setKillmailUrl(event.target.value)}
              placeholder="https://esi.evetech.net/latest/killmails/ID/HASH/"
              required
              style={{
                flex: "1 1 350px",
                padding: 12,
                borderRadius: 8,
                background: "#0f172a",
                color: "#fff",
                border: "1px solid #334155",
              }}
            />
            <button
              type="submit"
              style={button}
              disabled={importing || !killmailUrl.trim()}
            >
              <Download size={17} />
              {importing ? "Importing..." : "Import Killmail"}
            </button>
          </form>
        </section>

        <section style={panel}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <h2 style={{ fontSize: 19, margin: 0 }}>
              Last 10 FOB Kills
            </h2>
            <button
              type="button"
              style={{ ...button, background: "#263e52", padding: "9px 15px" }}
              onClick={() => navigate("/killmails")}
            >
              All Kills
            </button>
          </div>

          <p style={{ ...muted, fontSize: 12 }}>
            Latest confirmed imports, regardless of the income date filter
          </p>

          {killmails.length === 0 ? (
            <p style={muted}>No confirmed FOB killmails imported yet.</p>
          ) : (
            <div style={{
              display: "grid",
              gap: 12,
              marginTop: 20,
            }}>
              {killmails.map((kill) => {
                const id = kill.killmail_id ?? kill.killmailId;
                const typeId = kill.victim_type_id ?? kill.victimTypeId;
                const time = kill.killmail_time ?? kill.completedAt;
                const systemId = kill.solar_system_id ?? kill.solarSystemId;
                const systemName = kill.solar_system_name ?? kill.solarSystemName;
                const finalBlowName = kill.final_blow_name ?? kill.finalBlowName;

                return (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: 14,
                      border: "1px solid #334155",
                      borderRadius: 10,
                      background: "#111d32",
                    }}
                  >
                    <img
                      src={`https://images.evetech.net/types/${typeId}/icon?size=64`}
                      alt=""
                      width="56"
                      height="56"
                      style={{
                        borderRadius: 8,
                        background: "#0f172a",
                      }}
                    />

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{getFaction(typeId)} Stronghold</strong>

                      <div style={{
                        ...muted,
                        fontSize: 12,
                        marginTop: 5,
                      }}>
                        {formatDate(time)}
                      </div>

                      <div style={{
                        ...muted,
                        fontSize: 12,
                        marginTop: 4,
                      }}>
                        Solar system: {systemName || systemId}
                      </div>

                      <div style={{
                        ...muted,
                        fontSize: 12,
                        marginTop: 4,
                      }}>
                        Final blow: {finalBlowName || "Unknown"}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {lastSync && (
          <p style={{
            ...muted,
            fontSize: 12,
            marginTop: 20,
            textAlign: "right",
          }}>
            Wallet syncronisation is handled automatically. 
          </p>
        )}
      </div>
    </div>
  );
}