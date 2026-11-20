import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Building2,
  Crosshair,
  RefreshCw,
  UserRoundPlus,
} from "lucide-react";
import "../../styles/esi/esi.css";

const panel = {
  background: "#151e2b",
  border: "1px solid #304054",
  borderRadius: 14,
  padding: 20,
};

const muted = { color: "#9ca9bc" };

const button = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  cursor: "pointer",
  padding: "10px 14px",
  borderRadius: 9,
  background: "#263e52",
  border: "1px solid #4b6c81",
  color: "#eef3fa",
  fontWeight: 650,
};

const disabledStyle = {
  opacity: 0.5,
  cursor: "not-allowed",
};

const FOB_TYPES = {
  46363: "Guristas Pirates",
  46364: "Blood Raiders",
};

function displayDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  }) + " UTC";
}

function sourceLabel(sourceType) {
  return sourceType === "corporation" ? "Corporation" : "Personal";
}

function getVictimTypeId(kill) {
  return Number(kill.victim_type_id ?? kill.victimTypeId ?? 0);
}

function isConfirmedFob(kill) {
  return (
    kill.classification === "confirmed" &&
    Object.hasOwn(FOB_TYPES, getVictimTypeId(kill))
  );
}

function getKillmailId(kill) {
  return kill.killmail_id ?? kill.killmailId;
}

function getKillmailTime(kill) {
  return kill.killmail_time ?? kill.completedAt;
}

function getFaction(kill) {
  return FOB_TYPES[getVictimTypeId(kill)] ?? null;
}

function getFinalBlowName(kill) {
  return kill.final_blow_name ||
    kill.finalBlowName ||
    "Unknown";
}

function getFinalBlowShipTypeId(kill) {
  return Number(
    kill.final_blow_ship_type_id ??
    kill.finalBlowShipTypeId ??
    0
  );
}

function getFinalBlowCharacterId(kill) {
  return Number(
    kill.final_blow_character_id ??
    kill.finalBlowCharacterId ??
    0
  );
}

function getSystemName(kill) {
  return kill.solar_system_name ||
    kill.solarSystemName ||
    "Unknown system";
}

function KillmailCard({ kill }) {
  const id = getKillmailId(kill);
  const time = getKillmailTime(kill);
  const victimTypeId = getVictimTypeId(kill);
  const finalBlowShipTypeId = getFinalBlowShipTypeId(kill);
  const finalBlowCharacterId = getFinalBlowCharacterId(kill);
  const faction = getFaction(kill);

  const imageUrl = `https://images.evetech.net/types/${victimTypeId}/icon?size=64`;

  const finalBlowImageUrl = finalBlowShipTypeId > 0
    ? `https://images.evetech.net/types/${finalBlowShipTypeId}/icon?size=64`
    : finalBlowCharacterId > 0
      ? `https://images.evetech.net/characters/${finalBlowCharacterId}/portrait?size=64`
      : null;

  return (
    <article
      style={{
        ...panel,
        display: "flex",
        alignItems: "center",
        gap: 16,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 10,
          background: "#101827",
          border: "1px solid #304054",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <img
          src={imageUrl}
          alt={`${faction} FOB icon`}
          loading="lazy"
          style={{
            width: 64,
            height: 64,
            objectFit: "contain",
          }}
        />
      </div>

      <div
        style={{
          flex: "1 1 260px",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            flexWrap: "wrap",
            marginBottom: 5,
          }}
        >
          <strong
            style={{
              color: "#f8fafc",
              fontSize: 16,
            }}
          >
            {faction}
          </strong>

          <span
            style={{
              color: "#93c5fd",
              fontSize: 12,
            }}
          >
            FOB
          </span>
        </div>

        <div
          style={{
            ...muted,
            fontSize: 13,
            marginBottom: 5,
          }}
        >
          {displayDate(time)} · {getSystemName(kill)}
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
            color: "#b9c8db",
            fontSize: 12,
          }}
        >
          <span>Killmail ID {id}</span>


        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flex: "0 1 220px",
          minWidth: 160,
        }}
      >
        {finalBlowImageUrl && (
          <img
            src={finalBlowImageUrl}
            alt="Final-blow ship or pilot"
            loading="lazy"
            style={{
              width: 42,
              height: 42,
              borderRadius: 7,
              border: "1px solid #304054",
              background: "#101827",
              objectFit: "contain",
            }}
          />
        )}

        <div style={{ minWidth: 0 }}>
          <div
            style={{
              ...muted,
              fontSize: 11,
              marginBottom: 4,
            }}
          >
            Final blow
          </div>

          <strong
            style={{
              color: "#e2e8f0",
              fontSize: 13,
              overflowWrap: "anywhere",
            }}
          >
            {getFinalBlowName(kill)}
          </strong>
        </div>
      </div>

      <span className="esi-status esi-valid">
        Confirmed FOB
      </span>
    </article>
  );
}

export default function Killmails() {
  const [kills, setKills] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [killmailUrl, setKillmailUrl] = useState("");

  const authAvailable = Boolean(
    window.api?.esiLinkKillmail
  );

  const killsAvailable = Boolean(
    window.api?.fobListKillmails
  );

  const reload = useCallback(async () => {
    const killmails = killsAvailable
      ? await window.api.fobListKillmails({ limit: 500 })
      : [];

    setKills(
      Array.isArray(killmails) ? killmails : []
    );
  }, [killsAvailable]);

  useEffect(() => {
    let active = true;

    setLoading(true);

    reload()
      .catch((err) => {
        if (active) {
          setError(err?.message || "Unable to load killmails.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reload]);

  async function perform(action, message) {
    if (busy || loading) return null;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await action();

      await reload();

      setNotice(
        typeof message === "function"
          ? message(result)
          : message
      );

      return result;
    } catch (err) {
      setError(err?.message || "The operation failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function link(sourceType) {
    return perform(
      () => new Promise((resolve, reject) => {
        window.dispatchEvent(new CustomEvent("iskonomy:esi-link", {
          detail: {
            kind: sourceType === "corporation"
              ? "killmail-corporation"
              : "killmail-character",
            resolve,
            reject,
          },
        }));
      }),
      (result) => {
        if (result?.initialSync?.success === false) {
          return `${sourceLabel(sourceType)} killmail authorisation linked. Initial sync failed: ${result.initialSync.error}`;
        }

        if (result?.initialSync?.success) {
          return `${sourceLabel(sourceType)} killmail authorisation linked. Initial sync imported ${result.initialSync.imported ?? 0} killmails.`;
        }

        return `${sourceLabel(sourceType)} killmail authorisation linked.`;
      }
    );
  }

  function importKillmail(event) {
    event.preventDefault();

    const url = killmailUrl.trim();

    if (!url || !window.api?.fobImportKillmail) return;

    return perform(
      async () => {
        const result = await window.api.fobImportKillmail(url);
        setKillmailUrl("");
        return result;
      },
      (result) => {
        if (result?.duplicate) {
          return "This killmail has already been imported.";
        }

        if (
          result?.killmail &&
          isConfirmedFob(result.killmail)
        ) {
          return "Confirmed FOB killmail imported successfully.";
        }

        return "Killmail processed. This kill is not a confirmed FOB and will not appear in the feed.";
      }
    );
  }

  const visibleKills = useMemo(() => {
    return kills
      .filter(isConfirmedFob)
      .sort((a, b) =>
        new Date(getKillmailTime(b) || 0) -
        new Date(getKillmailTime(a) || 0)
      );
  }, [kills]);

  return (
    <main className="esi-page">
      <header className="esi-heading">
        <div>
          <div className="esi-eyebrow">
            <Crosshair size={14} />
            KILLMAIL MANAGEMENT
          </div>

          <h1>Killmails</h1>

          <p>
            Link EVE killmail access and review confirmed FOB kills.
          </p>
        </div>

        <button
          type="button"
          style={{
            ...button,
            ...(busy || loading ? disabledStyle : {}),
          }}
          disabled={busy || loading}
          onClick={() => perform(
            () => reload(),
            "Killmail records refreshed."
          )}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </header>

      {error && (
        <div className="esi-alert esi-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="esi-alert" role="status">
          {notice}
        </div>
      )}

      <section
        style={{
          ...panel,
          marginBottom: 24,
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          Killmail ESI Connections
        </h2>

        <p style={muted}>
          Link personal or corporation killmail access.
          These permissions are independent of wallet ESI.
        </p>

        {!authAvailable && (
          <p role="alert">
            Killmail ESI authentication is not available in this build.
          </p>
        )}

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 18,
          }}
        >
          <button
            type="button"
            style={{
              ...button,
              ...(!authAvailable || busy || loading
                ? disabledStyle
                : {}),
            }}
            disabled={!authAvailable || busy || loading}
            onClick={() => link("character")}
          >
            <UserRoundPlus size={17} />
            Link Personal Killmails
          </button>

          <button
            type="button"
            style={{
              ...button,
              ...(!authAvailable || busy || loading
                ? disabledStyle
                : {}),
            }}
            disabled={!authAvailable || busy || loading}
            onClick={() => link("corporation")}
          >
            <Building2 size={17} />
            Link Corporation Killmails
          </button>
        </div>
      </section>

      <section
        style={{
          ...panel,
          marginBottom: 24,
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          Import Killmail Manually
        </h2>

        <p style={muted}>
          Paste a direct EVE ESI killmail URL.
          Only confirmed FOB kills appear in the feed.
        </p>

        <form
          onSubmit={importKillmail}
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <input
            aria-label="ESI killmail URL"
            type="url"
            required
            value={killmailUrl}
            onChange={(event) =>
              setKillmailUrl(event.target.value)
            }
            placeholder="https://esi.evetech.net/killmails/ID/HASH/"
            style={{
              flex: "1 1 340px",
              minWidth: 0,
              background: "#101827",
              color: "#eef3fa",
              border: "1px solid #40516a",
              borderRadius: 9,
              padding: "12px",
            }}
          />

          <button
            type="submit"
            style={button}
            disabled={
              busy ||
              loading ||
              !killmailUrl.trim() ||
              !window.api?.fobImportKillmail
            }
          >
            Import Killmail
          </button>
        </form>
      </section>

      <section>
        <div className="esi-section-heading">
          <h2>FOB Kills</h2>

          <span>
            {visibleKills.length} confirmed FOB kills
          </span>
        </div>

        {visibleKills.length === 0 ? (
          <div style={panel}>
            <p style={muted}>
              {loading
                ? "Loading FOB killmails..."
                : "No confirmed FOB kills have been imported yet."}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {visibleKills.map((kill) => (
              <KillmailCard
                key={getKillmailId(kill)}
                kill={kill}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}