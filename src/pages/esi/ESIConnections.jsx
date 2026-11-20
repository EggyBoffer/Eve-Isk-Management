import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  UserRoundPlus,
  RefreshCw,
  Users,
  LockKeyhole,
  Link2Off,
  Building2,
  AlertTriangle,
  Info,
  Crosshair,
  ShoppingCart,
  Wallet,
} from "lucide-react";
import ESIConnectionUnlinkDialog from "./ESIConnectionUnlinkDialog";
import "../../styles/esi/esi.css";

function sameId(left, right) {
  return Number(left) === Number(right);
}

function corporationIds(authorisations) {
  return new Set(authorisations.map(({ corporationId }) => Number(corporationId)));
}

function CorporationServices({ wallet, killmails, market }) {
  return (
    <div
      aria-label="Corporation ESI services"
      style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}
    >
      {wallet && (
        <span className={`esi-status ${wallet.status === "valid" ? "esi-valid" : "esi-warning"}`}>
          <Wallet size={14} aria-hidden="true" />
          {wallet.status === "valid" ? "Wallet" : "Wallet needs attention"}
        </span>
      )}

      {killmails && (
        <span
          className={`esi-status ${killmails.status === "valid" ? "esi-valid" : "esi-warning"}`}
          title={killmails.status === "valid" && !killmails.syncEnabled
            ? "Corporation Killmails linked. Sync is disabled."
            : undefined}
        >
          <Crosshair size={14} aria-hidden="true" />
          {killmails.status === "valid" ? "Killmails" : "Killmails need attention"}
        </span>
      )}

      {market && (
        <span className="esi-status esi-valid">
          <ShoppingCart size={14} aria-hidden="true" />
          Market
        </span>
      )}
    </div>
  );
}

export default function ESIConnections() {
  const [characters, setCharacters] = useState([]);
  const [corporationAuthorisations, setCorporationAuthorisations] = useState([]);
  const [corporations, setCorporations] = useState({});
  const [killmailAuthorisations, setKillmailAuthorisations] = useState([]);
  const [marketAuthorisations, setMarketAuthorisations] = useState([]);
  const [corporationMarketAuthorisations, setCorporationMarketAuthorisations] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState(null);

  const available = Boolean(
    window.api?.esiLinkCharacter &&
    window.api?.esiListCharacters &&
    window.api?.esiRefreshCharacter &&
    window.api?.esiUnlinkCharacter
  );

  const corporationAvailable = Boolean(
    window.api?.esiListCorporations &&
    window.api?.esiLinkCorporation &&
    window.api?.esiRefreshCorporation &&
    window.api?.esiUnlinkCorporation
  );

  const marketAvailable = Boolean(
    window.api?.esiListMarketAuthorisations &&
    window.api?.esiUnlinkMarket
  );

  const corporationMarketAvailable = Boolean(
    window.api?.esiListCorporationMarketAuthorisations &&
    window.api?.esiUnlinkCorporationMarket
  );

  const loadCorporationDetails = useCallback(async (linkedCharacters) => {
    if (!window.api?.esiGetCharacterCorporation) return;

    const results = await Promise.allSettled(
      linkedCharacters.map((character) =>
        window.api.esiGetCharacterCorporation(character.characterId)
      )
    );

    const next = {};

    linkedCharacters.forEach((character, index) => {
      const result = results[index];

      next[character.characterId] =
        result.status === "fulfilled"
          ? { data: result.value, error: "" }
          : {
              data: null,
              error: result.reason?.message || "Corporation lookup failed.",
            };
    });

    setCorporations(next);
  }, []);

  const loadConnections = useCallback(async () => {
    setLoading(true);

    try {
      const results = await Promise.allSettled([
        window.api?.esiListCharacters?.() ?? [],
        window.api?.esiListCorporations?.() ?? [],
        window.api?.esiListKillmailAuthorisations?.() ?? [],
        window.api?.esiListMarketAuthorisations?.() ?? [],
        window.api?.esiListCorporationMarketAuthorisations?.() ?? [],
      ]);

      const setters = [
        setCharacters,
        setCorporationAuthorisations,
        setKillmailAuthorisations,
        setMarketAuthorisations,
        setCorporationMarketAuthorisations,
      ];

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          setters[index](Array.isArray(result.value) ? result.value : []);
        }
      });

      if (results[0].status === "fulfilled") {
        const wallets = Array.isArray(results[0].value) ? results[0].value : [];
        await loadCorporationDetails(wallets);
      }

      const failure = results.find((result) => result.status === "rejected");
      if (failure) throw failure.reason;
    } finally {
      setLoading(false);
    }
  }, [loadCorporationDetails]);

  useEffect(() => {
    loadConnections().catch((err) => {
      setError(err?.message || "Unable to load all ESI connections.");
    });
  }, [loadConnections]);

  async function runAction(action, successMessage, fallbackError) {
    if (busy || loading) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await action();
      await loadConnections();
      setNotice(successMessage);
    } catch (err) {
      setError(err?.message || fallbackError);
    } finally {
      setBusy(false);
    }
  }

  function requestEsiLink(kind) {
    return new Promise((resolve, reject) => {
      window.dispatchEvent(
        new CustomEvent("iskonomy:esi-link", {
          detail: { kind, resolve, reject },
        })
      );
    });
  }

  function linkCharacter() {
    if (!available) return;

    return runAction(
      () => requestEsiLink("character"),
      "Character linked successfully.",
      "Character linking failed."
    );
  }

  function linkCorporation() {
    if (!corporationAvailable) return;

    return runAction(
      () => requestEsiLink("corporation"),
      "Corporation wallet linked successfully.",
      "Corporation linking failed."
    );
  }

  function refreshCharacter(characterId) {
    return runAction(
      () => window.api.esiRefreshCharacter(characterId),
      "Character authorisation checked successfully.",
      "Character token refresh failed."
    );
  }

  function refreshCorporation(characterId) {
    return runAction(
      () => window.api.esiRefreshCorporation(characterId),
      "Corporation wallet authorisation checked successfully.",
      "Corporation wallet refresh failed."
    );
  }

  function refreshLinkedUsers() {
    return runAction(
      async () => {},
      "Linked users and corporation information refreshed.",
      "Unable to refresh linked users."
    );
  }

  function openUnlink(target) {
    setError("");
    setNotice("");
    setUnlinkTarget(target);
  }

  function closeUnlink() {
    setError("");
    setUnlinkTarget(null);
  }

  const personalKillmails = killmailAuthorisations.filter(
    (entry) => entry.sourceType === "character"
  );

  const corporationKillmails = killmailAuthorisations.filter(
    (entry) => entry.sourceType === "corporation"
  );

  const characterCards = new Map(
    characters.map((character) => [
      Number(character.characterId),
      { ...character, hasWallet: true },
    ])
  );

  for (const { characterId, characterName } of [
    ...marketAuthorisations,
    ...corporationMarketAuthorisations,
    ...personalKillmails,
  ]) {
    const id = Number(characterId);

    if (Number.isSafeInteger(id) && id > 0 && !characterCards.has(id)) {
      characterCards.set(id, { characterId: id, name: characterName, hasWallet: false });
    }
  }

  const healthy = characters.filter((character) => character.status === "valid").length;
  const attention = characters.length - healthy;
  const linkedCorporationIds = corporationIds(
    corporationAuthorisations.filter((authorisation) => authorisation.status === "valid")
  );
  const marketCorporationIds = corporationIds(corporationMarketAuthorisations);

  const killmailsByCorporation = new Map();
  for (const authorisation of corporationKillmails) {
    const corporationId = Number(authorisation.corporationId);
    const previous = killmailsByCorporation.get(corporationId);

    if (
      !previous ||
      (authorisation.status === "valid" &&
        (previous.status !== "valid" || (!previous.syncEnabled && authorisation.syncEnabled)))
    ) {
      killmailsByCorporation.set(corporationId, authorisation);
    }
  }

  const corporationCards = corporationAuthorisations.map((wallet) => ({
    key: `wallet:${wallet.characterId}`,
    corporationId: wallet.corporationId,
    corporationName: wallet.corporationName,
    wallet,
  }));

  const shownCorporations = corporationIds(corporationAuthorisations);

  for (const authorisation of [...corporationKillmails, ...corporationMarketAuthorisations]) {
    const corporationId = Number(authorisation.corporationId);

    if (!Number.isSafeInteger(corporationId) || corporationId <= 0 || shownCorporations.has(corporationId)) {
      continue;
    }

    shownCorporations.add(corporationId);
    corporationCards.push({
      key: `corporation:${corporationId}`,
      corporationId,
      corporationName: authorisation.corporationName,
      wallet: null,
    });
  }

  const connections = [];

  function addConnections(entries, label, method, argsFor, detailFor) {
    if (typeof window.api?.[method] !== "function") return;

    for (const entry of entries) {
      connections.push({
        id: `${method}:${label}:${entry.characterId}`,
        label,
        detail: detailFor?.(entry),
        unlink: () => window.api[method](...argsFor(entry)),
      });
    }
  }

  if (unlinkTarget?.type === "character") {
    const forCharacter = (entry) => sameId(entry.characterId, unlinkTarget.id);
    const characterArgs = (entry) => [Number(entry.characterId)];

    addConnections(
      characters.filter(forCharacter),
      "Personal Wallet",
      "esiUnlinkCharacter",
      characterArgs
    );
    addConnections(
      personalKillmails.filter(forCharacter),
      "Personal Killmails",
      "esiUnlinkKillmail",
      (entry) => ["character", Number(entry.characterId)]
    );
    addConnections(
      marketAuthorisations.filter(forCharacter),
      "Personal Market",
      "esiUnlinkMarket",
      characterArgs
    );
    addConnections(
      corporationKillmails.filter(forCharacter),
      "Corporation Killmails",
      "esiUnlinkKillmail",
      (entry) => ["corporation", Number(entry.characterId)],
      (entry) => entry.corporationName
    );
    addConnections(
      corporationMarketAuthorisations.filter(forCharacter),
      "Corporation Market",
      "esiUnlinkCorporationMarket",
      characterArgs,
      (entry) => entry.corporationName
    );
  }

  if (unlinkTarget?.type === "corporation") {
    const forCorporation = (entry) => sameId(entry.corporationId, unlinkTarget.id);
    const characterArgs = (entry) => [Number(entry.characterId)];
    const authorisingCharacter = (entry) => entry.characterName || `Character ${entry.characterId}`;

    addConnections(
      corporationAuthorisations.filter(forCorporation),
      "Corporation Wallet",
      "esiUnlinkCorporation",
      characterArgs,
      authorisingCharacter
    );
    addConnections(
      corporationKillmails.filter(forCorporation),
      "Corporation Killmails",
      "esiUnlinkKillmail",
      (entry) => ["corporation", Number(entry.characterId)],
      authorisingCharacter
    );
    addConnections(
      corporationMarketAuthorisations.filter(forCorporation),
      "Corporation Market",
      "esiUnlinkCorporationMarket",
      characterArgs,
      authorisingCharacter
    );
  }

  function unlinkConnection(id) {
    const connection = connections.find((entry) => entry.id === id);
    if (!connection) return;

    return runAction(
      connection.unlink,
      `${connection.label} unlinked.`,
      `Unable to unlink ${connection.label}.`
    );
  }

  function renderCorporationDetails(character) {
    const lookup = corporations[character.characterId];
    const corporation = lookup?.data;
    const taxPercent = corporation ? Number(corporation.taxPercent) : null;
    const walletConnected = corporation && linkedCorporationIds.has(Number(corporation.corporationId));
    const requiresWarning = corporation && taxPercent === 100 && !walletConnected;
    const recommendsWallet = corporation && taxPercent > 20 && taxPercent < 100 && !walletConnected;

    return (
      <div className="esi-details">
        <div>
          <span><Building2 size={14} /> Corporation</span>
          <strong>
            {corporation
              ? `${corporation.name} (${corporation.ticker})`
              : lookup?.error || "Checking corporation..."}
          </strong>
        </div>

        <div>
          <span>Corporation tax</span>
          <strong>{corporation ? `${corporation.taxPercent}%` : "Unknown"}</strong>
        </div>

        {walletConnected && (
          <div
            role="status"
            style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8 }}
          >
            <ShieldCheck size={16} color="#22C55E" style={{ flexShrink: 0 }} />
            <span>Corporation wallet ESI connected.</span>
          </div>
        )}

        {requiresWarning && (
          <div
            role="status"
            style={{ gridColumn: "1 / -1", display: "flex", alignItems: "flex-start", gap: 8 }}
          >
            <AlertTriangle size={18} color="#F59E0B" style={{ flexShrink: 0 }} />
            <span>
              100% corporation tax. Personal wallet rewards may be zero.
              Link the corporation wallet to reconcile income.
            </span>
          </div>
        )}

        {recommendsWallet && (
          <div
            role="status"
            style={{ gridColumn: "1 / -1", display: "flex", alignItems: "flex-start", gap: 8 }}
          >
            <Info size={17} color="#F59E0B" style={{ flexShrink: 0 }} />
            <span>
              Corporation tax exceeds 20%. Corporation wallet access is
              recommended for income reconciliation.
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="esi-page">
      <header className="esi-heading">
        <div>
          <div className="esi-eyebrow">
            <LockKeyhole size={14} />
            SECURE ESI CONNECTIONS
          </div>
          <h1>EVE Online Connections</h1>
          <p>Manage your capsuleers, corporations and ESI authorisations in one place.</p>
        </div>

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <button
            type="button"
            className="esi-secondary"
            disabled={!corporationAvailable || busy || loading}
            onClick={linkCorporation}
          >
            <Building2 size={18} />
            Link Corporation
          </button>

          <button
            type="button"
            className="esi-primary"
            disabled={!available || busy || loading}
            onClick={linkCharacter}
          >
            <UserRoundPlus size={18} />
            Link Character
          </button>
        </div>
      </header>

      <section className="esi-overview">
        <div className="esi-stat">
          <Users size={21} />
          <span>Linked capsuleers</span>
          <strong>{characterCards.size}</strong>
        </div>
        <div className="esi-stat">
          <ShieldCheck size={21} />
          <span>Healthy wallets</span>
          <strong>{healthy}</strong>
        </div>
        <div className="esi-stat">
          <ShieldAlert size={21} />
          <span>Wallets needing attention</span>
          <strong>{attention}</strong>
        </div>
      </section>

      {error && !unlinkTarget && <div className="esi-alert esi-error" role="alert">{error}</div>}
      {notice && <div className="esi-alert" role="status">{notice}</div>}

      {!available && (
        <div className="esi-alert">
          Character wallet linking is not available in this build.
        </div>
      )}

      {!corporationAvailable && (
        <div className="esi-alert">
          Corporation wallet linking is not available in this build.
        </div>
      )}

      <div className="esi-section-heading">
        <h2>Linked Characters</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span>{characterCards.size} total</span>
          <button
            type="button"
            className="esi-secondary"
            disabled={busy || loading}
            onClick={refreshLinkedUsers}
          >
            <RefreshCw size={15} />
            {loading ? "Refreshing..." : "Refresh Linked Users"}
          </button>
        </div>
      </div>

      {characterCards.size === 0 ? (
        <section className="esi-empty">
          <div className="esi-empty-icon"><Users size={32} /></div>
          <h3>No characters linked yet</h3>
          <p>Link an EVE Online character to start tracking wallet income.</p>
          <button
            type="button"
            className="esi-secondary"
            disabled={!available || busy || loading}
            onClick={linkCharacter}
          >
            <UserRoundPlus size={17} />
            Link your first character
          </button>
        </section>
      ) : (
        <div className="esi-grid">
          {[...characterCards.values()].map((character) => {
            const { characterId, hasWallet } = character;
            const name = character.name || `Character ${characterId}`;
            const killmails = personalKillmails.find((entry) => sameId(entry.characterId, characterId));
            const hasMarket = marketAuthorisations.some((entry) => sameId(entry.characterId, characterId));
            const hasCorporationMarket = corporationMarketAuthorisations.some(
              (entry) => sameId(entry.characterId, characterId)
            );

            return (
              <article className="esi-character" key={characterId}>
                <div className="esi-character-top">
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    <img
                      src={`https://images.evetech.net/characters/${characterId}/portrait?size=256`}
                      alt={name}
                      loading="lazy"
                    />
                    {killmails?.status === "valid" && killmails.syncEnabled && (
                      <span
                        title="Killmail sync enabled"
                        aria-label="Killmail sync enabled"
                        style={{
                          position: "absolute",
                          top: -5,
                          right: -5,
                          width: 23,
                          height: 23,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "50%",
                          background: "#153c36",
                          border: "1px solid #34d399",
                          color: "#6ee7b7",
                        }}
                      >
                        <Crosshair size={14} />
                      </span>
                    )}
                  </div>

                  <div className="esi-character-info">
                    <h3>
                      {name}
                      {hasMarket && (
                        <span title="Personal Market access linked" style={{ marginInlineStart: 8 }}>
                          <ShoppingCart size={15} role="img" aria-label="Personal Market access linked" />
                        </span>
                      )}
                      {hasCorporationMarket && (
                        <span title="Corporation Market access linked" style={{ marginInlineStart: 8 }}>
                          <Building2 size={15} role="img" aria-label="Corporation Market access linked" />
                        </span>
                      )}
                    </h3>
                    {hasWallet && (
                      <span className={`esi-status ${character.status === "valid" ? "esi-valid" : "esi-warning"}`}>
                        {character.status === "valid" ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
                        {character.status === "valid" ? "Connected" : "Attention required"}
                      </span>
                    )}
                    <small>Character ID {characterId}</small>
                  </div>
                </div>

                {hasWallet && (
                  <>
                    {renderCorporationDetails(character)}

                    <div className="esi-details">
                      <div>
                        <span>Authorisation</span>
                        <strong>{character.status === "valid" ? "Valid" : "Requires attention"}</strong>
                      </div>
                      <div>
                        <span>Last token check</span>
                        <strong>
                          {character.lastValidatedAt
                            ? new Date(character.lastValidatedAt).toLocaleString()
                            : "Not yet checked"}
                        </strong>
                      </div>
                    </div>
                  </>
                )}

                <div className="esi-actions">
                  {hasWallet && (
                    <button
                      type="button"
                      disabled={!available || busy || loading}
                      onClick={() => refreshCharacter(characterId)}
                    >
                      <RefreshCw size={15} />
                      Refresh token
                    </button>
                  )}
                  <button
                    type="button"
                    className="esi-danger"
                    disabled={busy || loading}
                    onClick={() => openUnlink({ type: "character", id: characterId, name })}
                  >
                    <Link2Off size={15} />
                    Unlink
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <div className="esi-section-heading" style={{ marginTop: 30 }}>
        <h2>Linked Corporations</h2>
        <span>{shownCorporations.size} total</span>
      </div>

      {corporationCards.length === 0 ? (
        <section className="esi-empty">
          <div className="esi-empty-icon"><Building2 size={32} /></div>
          <h3>No corporations linked yet</h3>
          <p>Link a corporation wallet to enable corporation income tracking.</p>
          <button
            type="button"
            className="esi-secondary"
            disabled={!corporationAvailable || busy || loading}
            onClick={linkCorporation}
          >
            <Building2 size={17} />
            Link Corporation
          </button>
        </section>
      ) : (
        <div className="esi-grid">
          {corporationCards.map(({ key, corporationId, corporationName, wallet }) => {
            const name = corporationName || `Corporation ${corporationId}`;

            return (
              <article className="esi-character" key={key}>
                <div className="esi-character-top">
                  <img
                    src={`https://images.evetech.net/corporations/${corporationId}/logo?size=128`}
                    alt={name}
                    loading="lazy"
                  />
                  <div className="esi-character-info">
                    <h3>{name}</h3>
                    <small>Corporation ID {corporationId}</small>
                    <CorporationServices
                      wallet={wallet}
                      killmails={killmailsByCorporation.get(Number(corporationId))}
                      market={marketCorporationIds.has(Number(corporationId))}
                    />
                  </div>
                </div>

                {wallet && (
                  <div className="esi-details">
                    <div>
                      <span>Authorised by</span>
                      <strong>{wallet.characterName}</strong>
                    </div>
                    <div>
                      <span>Last token check</span>
                      <strong>
                        {wallet.lastValidatedAt
                          ? new Date(wallet.lastValidatedAt).toLocaleString()
                          : "Not yet checked"}
                      </strong>
                    </div>
                  </div>
                )}

                <div className="esi-actions">
                  {wallet && (
                    <button
                      type="button"
                      disabled={!corporationAvailable || busy || loading}
                      onClick={() => refreshCorporation(wallet.characterId)}
                    >
                      <RefreshCw size={15} />
                      Refresh token
                    </button>
                  )}
                  <button
                    type="button"
                    className="esi-danger"
                    disabled={busy || loading}
                    onClick={() => openUnlink({ type: "corporation", id: corporationId, name })}
                  >
                    <Link2Off size={15} />
                    Unlink
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="esi-footnote">
        <ShieldCheck size={15} />
        ESI credentials are stored and encrypted locally.
      </p>

      {unlinkTarget && (
        <ESIConnectionUnlinkDialog
          targetName={unlinkTarget.name}
          connections={connections}
          busy={busy || loading}
          error={error}
          onClose={closeUnlink}
          onUnlink={unlinkConnection}
        />
      )}
    </div>
  );
}