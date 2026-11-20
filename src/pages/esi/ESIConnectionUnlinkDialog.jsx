import { useEffect, useRef } from "react";
import { Link2Off } from "lucide-react";

export default function ESIConnectionUnlinkDialog({
  targetName,
  connections,
  busy,
  error,
  onClose,
  onUnlink,
}) {
  const dialogRef = useRef(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="esi-connection-unlink-title"
      onCancel={(event) => {
        event.preventDefault();

        if (!busy) {
          onClose();
        }
      }}
      style={{
        width: "min(480px, calc(100vw - 40px))",
        maxHeight: "calc(100vh - 40px)",
        boxSizing: "border-box",
        padding: 24,
        borderRadius: 12,
        background: "#17202c",
        color: "#f3f6fb",
        border: "1px solid #344255",
        boxShadow: "0 24px 70px rgba(0, 0, 0, 0.55)",
      }}
    >
      <h2 id="esi-connection-unlink-title" style={{ marginTop: 0 }}>
        Unlink connections
      </h2>

      <p>{targetName}</p>

      {error && <div className="esi-alert esi-error" role="alert">{error}</div>}

      {connections.length === 0 ? (
        <p>No connections left to unlink.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {connections.map(({ id, label, detail }) => (
            <li
              key={id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 12,
                padding: "12px 0",
                borderBottom: "1px solid #344255",
              }}
            >
              <div>
                <strong>{label}</strong>
                {detail && <small style={{ display: "block", marginTop: 4 }}>{detail}</small>}
              </div>

              <button
                type="button"
                className="esi-secondary"
                aria-label={`Unlink ${label}${detail ? ` for ${detail}` : ""}`}
                onClick={() => onUnlink(id)}
                disabled={busy}
              >
                <Link2Off size={15} aria-hidden="true" />
                Unlink
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
        <button type="button" className="esi-secondary" disabled={busy} onClick={onClose}>
          Close
        </button>
      </div>
    </dialog>
  );
}