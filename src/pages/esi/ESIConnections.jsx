
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
} from "lucide-react";
import ESIUnlinkModal from "./ESIUnlinkModal";
import "../../styles/esi/esi.css";

export default function ESIConnections() {
  const [characters, setCharacters] = useState([]);
  const [corporationAuthorisations, setCorporationAuthorisations] = useState([]);
  const [corporations, setCorporations] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState(null);
  const [corporationUnlinkTarget, setCorporationUnlinkTarget] = useState(null);

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

  const loadCorporationDetails = useCallback(async (linkedCharacters) => {
    if (!window.api?.esiGetCharacterCorporation) {
      return;
    }

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
          ? {
              data: result.value,
              error: "",
            }
          : {
              data: null,
              error:
                result.reason?.message ||
                "Corporation lookup failed.",
            };
    });

    setCorporations(next);
  }, []);

  const loadConnections = useCallback(async () => {
    if (!available) {
      return;
    }

    setLoading(true);

    try {
      const [characterResult, corporationResult] = await Promise.all([
        window.api.esiListCharacters(),
        corporationAvailable
          ? window.api.esiListCorporations()
          : Promise.resolve([]),
      ]);

      const linkedCharacters = Array.isArray(characterResult)
        ? characterResult
        : [];

      const linkedCorporations = Array.isArray(corporationResult)
        ? corporationResult
        : [];

      setCharacters(linkedCharacters);
      setCorporationAuthorisations(linkedCorporations);

      await loadCorporationDetails(linkedCharacters);
    } finally {
      setLoading(false);
    }
  }, [
    available,
    corporationAvailable,
    loadCorporationDetails,
  ]);

  useEffect(() => {
    loadConnections().catch((err) => {
      setError(
        err?.message || "Unable to load ESI connections."
      );
    });
  }, [loadConnections]);

  async function runAction(action, successMessage, fallbackError) {
    if (busy || loading) {
      return;
    }

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

  function linkCharacter() {
    if (!available) {
      return;
    }

    return runAction(
      () => window.api.esiLinkCharacter(),
      "Character linked successfully.",
      "Character linking failed."
    );
  }

  function linkCorporation() {
    if (!corporationAvailable) {
      return;
    }

    return runAction(
      () => window.api.esiLinkCorporation(),
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

  function requestUnlink(character) {
    if (busy || loading) {
      return;
    }

    setError("");
    setNotice("");
    setUnlinkTarget(character);
  }

  async function confirmUnlink() {
    if (!unlinkTarget || busy || loading) {
      return;
    }

    const character = unlinkTarget;

    await runAction(
      () => window.api.esiUnlinkCharacter(character.characterId),
      `${character.name} has been unlinked.`,
      "Unable to unlink character."
    );

    setUnlinkTarget(null);
  }

  function requestCorporationUnlink(authorisation) {
    if (busy || loading) {
      return;
    }

    setError("");
    setNotice("");
    setCorporationUnlinkTarget(authorisation);
  }

  async function confirmCorporationUnlink() {
    if (!corporationUnlinkTarget || busy || loading) {
      return;
    }

    const authorisation = corporationUnlinkTarget;

    await runAction(
      () =>
        window.api.esiUnlinkCorporation(
          authorisation.characterId
        ),
      `${authorisation.corporationName} wallet authorisation removed.`,
      "Unable to unlink corporation wallet."
    );

    setCorporationUnlinkTarget(null);
  }

  const healthy = characters.filter(
    (character) => character.status === "valid"
  ).length;

  const attention = characters.length - healthy;

  const healthyCorporationAuthorisations =
    corporationAuthorisations.filter(
      (authorisation) => authorisation.status === "valid"
    );

  const linkedCorporationIds = new Set(
    healthyCorporationAuthorisations.map(
      (authorisation) => Number(authorisation.corporationId)
    )
  );

  const uniqueCorporations = new Set(
    corporationAuthorisations.map(
      (authorisation) => Number(authorisation.corporationId)
    )
  ).size;

  function hasCorporationWallet(corporationId) {
    return linkedCorporationIds.has(Number(corporationId));
  }

  function renderCorporationDetails(character) {
    const lookup = corporations[character.characterId];
    const corporation = lookup?.data;

    const taxPercent = corporation
      ? Number(corporation.taxPercent)
      : null;

    const walletConnected =
      corporation &&
      hasCorporationWallet(corporation.corporationId);

    const requiresWarning =
      corporation &&
      taxPercent === 100 &&
      !walletConnected;

    const recommendsWallet =
      corporation &&
      taxPercent > 20 &&
      taxPercent < 100 &&
      !walletConnected;

    return (
      <div className="esi-details">
        <div>
          <span>
            <Building2 size={14} />
            Corporation
          </span>
          <strong>
            {corporation
              ? `${corporation.name} (${corporation.ticker})`
              : lookup?.error || "Checking corporation..."}
          </strong>
        </div>

        <div>
          <span>Corporation tax</span>
          <strong>
            {corporation
              ? `${corporation.taxPercent}%`
              : "Unknown"}
          </strong>
        </div>

        {walletConnected && (
          <div
            role="status"
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ShieldCheck
              size={16}
              color="#22C55E"
              style={{ flexShrink: 0 }}
            />
            <span>
              Corporation wallet ESI connected.
            </span>
          </div>
        )}

        {requiresWarning && (
          <div
            role="status"
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <AlertTriangle
              size={18}
              color="#F59E0B"
              style={{ flexShrink: 0 }}
            />
            <span>
              100% corporation tax. Personal wallet rewards
              may be zero. Link the corporation wallet to
              reconcile income.
            </span>
          </div>
        )}

        {recommendsWallet && (
          <div
            role="status"
            style={{
              gridColumn: "1 / -1",
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <Info
              size={17}
              color="#F59E0B"
              style={{ flexShrink: 0 }}
            />
            <span>
              Corporation tax exceeds 20%. Corporation wallet
              access is recommended for income reconciliation.
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

          <p>
            Manage your capsuleers, corporations and
            ESI authorisations in one place.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
          }}
        >
          <button
            type="button"
            className="esi-secondary"
            disabled={
              !corporationAvailable ||
              busy ||
              loading
            }
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
          <strong>{characters.length}</strong>
        </div>

        <div className="esi-stat">
          <ShieldCheck size={21} />
          <span>Healthy connections</span>
          <strong>{healthy}</strong>
        </div>

        <div className="esi-stat">
          <ShieldAlert size={21} />
          <span>Attention needed</span>
          <strong>{attention}</strong>
        </div>
      </section>

      {error && (
        <div
          className="esi-alert esi-error"
          role="alert"
        >
          {error}
        </div>
      )}

      {notice && (
        <div
          className="esi-alert"
          role="status"
        >
          {notice}
        </div>
      )}

      {!available && (
        <div className="esi-alert">
          Secure EVE SSO integration is not enabled in
          this build yet.
        </div>
      )}

      {!corporationAvailable && (
        <div className="esi-alert">
          Corporation wallet linking is not available
          in this build.
        </div>
      )}

      <div className="esi-section-heading">
        <h2>Linked Characters</h2>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span>{characters.length} total</span>

          <button
            type="button"
            className="esi-secondary"
            disabled={
              !available ||
              busy ||
              loading
            }
            onClick={refreshLinkedUsers}
          >
            <RefreshCw size={15} />
            {loading
              ? "Refreshing..."
              : "Refresh Linked Users"}
          </button>
        </div>
      </div>

      {characters.length === 0 ? (
        <section className="esi-empty">
          <div className="esi-empty-icon">
            <Users size={32} />
          </div>

          <h3>No characters linked yet</h3>

          <p>
            Connect your EVE Online characters to prepare
            for secure multi-character income tracking
            and future FOB operations.
          </p>

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
          {characters.map((character) => (
            <article
              className="esi-character"
              key={character.characterId}
            >
              <div className="esi-character-top">
                <img
                  src={`https://images.evetech.net/characters/${character.characterId}/portrait?size=256`}
                  alt={character.name}
                  loading="lazy"
                />

                <div className="esi-character-info">
                  <h3>{character.name}</h3>

                  <span
                    className={
                      character.status === "valid"
                        ? "esi-status esi-valid"
                        : "esi-status esi-warning"
                    }
                  >
                    {character.status === "valid" ? (
                      <ShieldCheck size={14} />
                    ) : (
                      <ShieldAlert size={14} />
                    )}

                    {character.status === "valid"
                      ? "Connected"
                      : "Attention required"}
                  </span>

                  <small>
                    Character ID {character.characterId}
                  </small>
                </div>
              </div>

              {renderCorporationDetails(character)}

              <div className="esi-details">
                <div>
                  <span>Authorisation</span>
                  <strong>
                    {character.status === "valid"
                      ? "Valid"
                      : "Requires attention"}
                  </strong>
                </div>

                <div>
                  <span>Last token check</span>
                  <strong>
                    {character.lastValidatedAt
                      ? new Date(
                          character.lastValidatedAt
                        ).toLocaleString()
                      : "Not yet checked"}
                  </strong>
                </div>
              </div>

              <div className="esi-actions">
                <button
                  type="button"
                  disabled={busy || loading}
                  onClick={() =>
                    refreshCharacter(
                      character.characterId
                    )
                  }
                >
                  <RefreshCw size={15} />
                  Refresh token
                </button>

                <button
                  type="button"
                  className="esi-danger"
                  disabled={busy || loading}
                  onClick={() =>
                    requestUnlink(character)
                  }
                >
                  <Link2Off size={15} />
                  Unlink
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div
        className="esi-section-heading"
        style={{ marginTop: 30 }}
      >
        <h2>Linked Corporations</h2>
        <span>{uniqueCorporations} total</span>
      </div>

      {corporationAuthorisations.length === 0 ? (
        <section className="esi-empty">
          <div className="esi-empty-icon">
            <Building2 size={32} />
          </div>

          <h3>No corporation wallets linked yet</h3>

          <p>
            Authorise a character with the appropriate
            corporation wallet roles to enable corporation
            income tracking.
          </p>

          <button
            type="button"
            className="esi-secondary"
            disabled={
              !corporationAvailable ||
              busy ||
              loading
            }
            onClick={linkCorporation}
          >
            <Building2 size={17} />
            Link Corporation
          </button>
        </section>
      ) : (
        <div className="esi-grid">
          {corporationAuthorisations.map(
            (authorisation) => (
              <article
                className="esi-character"
                key={`corporation-${authorisation.characterId}`}
              >
                <div className="esi-character-top">
                  <img
                    src={`https://images.evetech.net/corporations/${authorisation.corporationId}/logo?size=128`}
                    alt={authorisation.corporationName}
                    loading="lazy"
                  />

                  <div className="esi-character-info">
                    <h3>
                      {authorisation.corporationName}
                    </h3>

                    <span
                      className={
                        authorisation.status === "valid"
                          ? "esi-status esi-valid"
                          : "esi-status esi-warning"
                      }
                    >
                      {authorisation.status === "valid" ? (
                        <ShieldCheck size={14} />
                      ) : (
                        <ShieldAlert size={14} />
                      )}

                      {authorisation.status === "valid"
                        ? "Connected"
                        : "Attention required"}
                    </span>

                    <small>
                      Corporation ID{" "}
                      {authorisation.corporationId}
                    </small>
                  </div>
                </div>

                <div className="esi-details">
                  <div>
                    <span>Authorised by</span>
                    <strong>
                      {authorisation.characterName}
                    </strong>
                  </div>

                  <div>
                    <span>Last token check</span>
                    <strong>
                      {authorisation.lastValidatedAt
                        ? new Date(
                            authorisation.lastValidatedAt
                          ).toLocaleString()
                        : "Not yet checked"}
                    </strong>
                  </div>
                </div>

                <div className="esi-actions">
                  <button
                    type="button"
                    disabled={busy || loading}
                    onClick={() =>
                      refreshCorporation(
                        authorisation.characterId
                      )
                    }
                  >
                    <RefreshCw size={15} />
                    Refresh token
                  </button>

                  <button
                    type="button"
                    className="esi-danger"
                    disabled={busy || loading}
                    onClick={() =>
                      requestCorporationUnlink(
                        authorisation
                      )
                    }
                  >
                    <Link2Off size={15} />
                    Unlink
                  </button>
                </div>
              </article>
            )
          )}
        </div>
      )}

      <p className="esi-footnote">
        <ShieldCheck size={15} />
        ESI credentials are stored and encrypted locally.
      </p>

      <ESIUnlinkModal
        character={unlinkTarget}
        busy={busy}
        onCancel={() => setUnlinkTarget(null)}
        onConfirm={confirmUnlink}
      />

      {corporationUnlinkTarget && (
        <div
          role="presentation"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="esi-corporation-unlink-title"
            style={{
              width: "100%",
              maxWidth: 440,
              padding: 24,
              borderRadius: 12,
              background: "#17202C",
              color: "#F3F6FB",
              border: "1px solid #344255",
            }}
          >
            <h3 id="esi-corporation-unlink-title">
              Unlink Corporation Wallet
            </h3>

            <p>
              Remove the corporation wallet authorisation
              for{" "}
              <strong>
                {corporationUnlinkTarget.corporationName}
              </strong>
              , granted by{" "}
              <strong>
                {corporationUnlinkTarget.characterName}
              </strong>
              ?
            </p>

            <p>
              This will remove the locally stored
              corporation wallet credentials for this
              authorising character.
            </p>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
                marginTop: 20,
              }}
            >
              <button
                type="button"
                className="esi-secondary"
                disabled={busy || loading}
                onClick={() =>
                  setCorporationUnlinkTarget(null)
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="esi-danger"
                disabled={busy || loading}
                onClick={confirmCorporationUnlink}
              >
                <Link2Off size={15} />
                Unlink Corporation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
