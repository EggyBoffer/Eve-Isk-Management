
import { useCallback, useEffect, useState } from "react";
import {
  ShieldCheck,
  ShieldAlert,
  UserRoundPlus,
  RefreshCw,
  Users,
  LockKeyhole,
  Link2Off,
} from "lucide-react";
import ESIUnlinkModal from "./ESIUnlinkModal";
import "../../styles/esi/esi.css";

export default function ESIConnections() {
  const [characters, setCharacters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unlinkTarget, setUnlinkTarget] = useState(null);

  const available = Boolean(
    window.api?.esiLinkCharacter &&
    window.api?.esiListCharacters &&
    window.api?.esiRefreshCharacter &&
    window.api?.esiUnlinkCharacter
  );

  const closeUnlinkModal = useCallback(() => {
    setUnlinkTarget(null);
  }, []);

  async function loadCharacters() {
    if (!available) return;

    const result = await window.api.esiListCharacters();
    setCharacters(Array.isArray(result) ? result : []);
  }

  useEffect(() => {
    let active = true;

    if (available) {
      window.api.esiListCharacters()
        .then((result) => {
          if (active) {
            setCharacters(Array.isArray(result) ? result : []);
          }
        })
        .catch((err) => {
          if (active) {
            setError(err?.message || "Unable to load linked characters.");
          }
        });
    }

    return () => {
      active = false;
    };
  }, [available]);

  async function linkCharacter() {
    if (!available || busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await window.api.esiLinkCharacter();
      await loadCharacters();
      setNotice("Character linked successfully.");
    } catch (err) {
      setError(err?.message || "Character linking failed.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshCharacter(characterId) {
    if (!available || busy) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await window.api.esiRefreshCharacter(characterId);
      await loadCharacters();
      setNotice("Character authorisation checked successfully.");
    } catch (err) {
      setError(err?.message || "Token refresh failed.");
    } finally {
      setBusy(false);
    }
  }

  function requestUnlink(character) {
    if (!available || busy) return;

    setError("");
    setNotice("");
    setUnlinkTarget(character);
  }

  async function confirmUnlink() {
    if (!available || busy || !unlinkTarget) return;

    const character = unlinkTarget;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      await window.api.esiUnlinkCharacter(character.characterId);
      await loadCharacters();
      setNotice(`${character.name} has been unlinked.`);
      setUnlinkTarget(null);
    } catch (err) {
      setError(err?.message || "Unable to unlink character.");
      setUnlinkTarget(null);
    } finally {
      setBusy(false);
    }
  }

  const healthy = characters.filter(
    (character) => character.status === "valid"
  ).length;

  const attention = characters.length - healthy;

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
            Manage your capsuleers, authorisation health and ESI
            permissions in one place.
          </p>
        </div>

        <button
          type="button"
          className="esi-primary"
          disabled={!available || busy}
          onClick={linkCharacter}
        >
          <UserRoundPlus size={18} />
          {busy ? "Please wait..." : "Link Character"}
        </button>
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
        <div className="esi-alert esi-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="esi-alert" role="status">
          {notice}
        </div>
      )}

      {!available && (
        <div className="esi-alert">
          Secure EVE SSO integration is not enabled in this build yet.
          Character linking will become available when the authentication
          service is installed.
        </div>
      )}

      <div className="esi-section-heading">
        <h2>Linked Characters</h2>
        <span>{characters.length} total</span>
      </div>

      {characters.length === 0 ? (
        <section className="esi-empty">
          <div className="esi-empty-icon">
            <Users size={32} />
          </div>

          <h3>No characters linked yet</h3>

          <p>
            Connect your EVE Online characters to prepare for secure,
            multi-character income tracking and future FOB operations.
          </p>

          <button
            type="button"
            className="esi-secondary"
            disabled={!available || busy}
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

                <div>
                  <span>ESI access</span>
                  <strong>Character wallet read</strong>
                </div>
              </div>

              <div className="esi-actions">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    refreshCharacter(character.characterId)
                  }
                >
                  <RefreshCw size={15} />
                  Refresh token
                </button>

                <button
                  type="button"
                  className="esi-danger"
                  disabled={busy}
                  onClick={() => requestUnlink(character)}
                >
                  <Link2Off size={15} />
                  Unlink
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="esi-footnote">
        <ShieldCheck size={15} />
        ESI credentials are stored and encrypted locally.
      </p>

      <ESIUnlinkModal
        character={unlinkTarget}
        busy={busy}
        onCancel={closeUnlinkModal}
        onConfirm={confirmUnlink}
      />
    </div>
  );
}
