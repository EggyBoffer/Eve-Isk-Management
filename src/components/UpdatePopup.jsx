import "../styles/update-popup.css";

export default function UpdatePopup({ open, currentVersion, latestVersion, onClose, onGoPatchNotes, onUpdate }) {
  if (!open) return null;

  return (
    <div className="updatePopup-backdrop" role="dialog" aria-modal="true">
      <div className="updatePopup-card">
        <div className="updatePopup-titleRow">
          <div className="updatePopup-title">Update available</div>
          <button type="button" className="updatePopup-x" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="updatePopup-body">
          <div className="updatePopup-line">
            Installed: <span className="updatePopup-pill">v{currentVersion}</span>
          </div>
          <div className="updatePopup-line">
            Latest: <span className="updatePopup-pill good">v{latestVersion}</span>
          </div>

          <div className="updatePopup-hint">
            Update is due. Check the Patch Notes for what changed, then hit Update to download the latest build.
          </div>
        </div>

        <div className="updatePopup-actions">
          <button type="button" className="updatePopup-btn ghost" onClick={onGoPatchNotes}>
            Patch Notes
          </button>
          <button type="button" className="updatePopup-btn" onClick={onUpdate}>
            Update
          </button>
          <button type="button" className="updatePopup-btn danger" onClick={onClose}>
            Later
          </button>
        </div>
      </div>
    </div>
  );
}
