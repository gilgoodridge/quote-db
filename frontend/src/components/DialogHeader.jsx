import '../styles/DialogHeader.css'

export default function DialogHeader({titleId, title, closeLabel, onClose, disabled = false, autoFocus = false, children}) {
  return (
    <div className="dialog-header">
      <div className="dialog-header-title">
        <h2 id={titleId}>{title}</h2>
        {children}
      </div>
      <div className="dialog-header-actions">
        <button
          type="button"
          className="dialog-close"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={onClose}
          disabled={disabled}
          autoFocus={autoFocus}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}
