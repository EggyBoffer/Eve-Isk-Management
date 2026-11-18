
import { useEffect, useRef } from "react";
import { Link2Off, X } from "lucide-react";
import "../../styles/esi/esiModal.css";

export default function ESIUnlinkModal({
  character,
  busy,
  onCancel,
  onConfirm,
}) {
  const modalRef = useRef(null);
  const cancelRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!character) return;

    previousFocusRef.current = document.activeElement;
    cancelRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();

        if (!busy) {
          onCancel();
        }

        return;
      }

      if (event.key !== "Tab") return;

      const focusable = Array.from(
        modalRef.current?.querySelectorAll(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ) || []
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [character, busy, onCancel]);

  if (!character) return null;

  function handleBackdropClick(event) {
    if (event.target === event.currentTarget && !busy) {
      onCancel();
    }
  }

  return (
    <div
      className="esi-modal-backdrop"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={modalRef}
        className="esi-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="esi-modal-title"
        aria-describedby="esi-modal-description"
      >
        <button
          type="button"
          className="esi-modal-close"
          aria-label="Close confirmation"
          disabled={busy}
          onClick={onCancel}
        >
          <X size={18} />
        </button>

        <div className="esi-modal-heading">
          <div className="esi-modal-icon">
            <Link2Off size={23} />
          </div>

          <div>
            <span className="esi-modal-eyebrow">
              EVE SSO CONNECTION
            </span>

            <h2 id="esi-modal-title">
              Unlink Character?
            </h2>
          </div>
        </div>

        <div
          className="esi-modal-content"
          id="esi-modal-description"
        >
          <p>
            Are you sure you want to unlink{" "}
            <strong>{character.name}</strong> from ISKONOMY?
          </p>

          <p>
            This will remove the character's locally stored
            authorisation credentials. You can link the
            character again at any time.
          </p>
        </div>

        <div className="esi-modal-actions">
          <button
            ref={cancelRef}
            type="button"
            className="esi-modal-cancel"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="esi-modal-confirm"
            disabled={busy}
            onClick={onConfirm}
          >
            <Link2Off size={16} />
            {busy ? "Unlinking..." : "Unlink Character"}
          </button>
        </div>
      </div>
    </div>
  );
}
