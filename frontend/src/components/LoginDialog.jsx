import { useEffect, useRef } from 'react'
import '../styles/LoginDialog.css'

export default function LoginDialog({ onClose, onGoogleLogin, forAddQuote = false, error = '' }) {
  const dialogRef = useRef(null)

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      className="login-dialog"
      aria-labelledby="login-title"
      aria-describedby="login-description"
      onClose={onClose}
    >
      <button
        type="button"
        className="login-close"
        aria-label="Close login"
        onClick={() => dialogRef.current.close()}
        autoFocus
      >
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <h2 id="login-title">Log in to Quotes DB</h2>
      <p id="login-description" className="login-description">
        {forAddQuote
          ? 'Please log in to add a quote. After signing in with Google, the Add Quote form will open.'
          : 'No login is needed to explore quotes. Continue with Google to sign in.'}
      </p>
      {error && <p role="alert">{error}</p>}
      <button type="button" className="google-login-btn" onClick={onGoogleLogin}>
        <svg className="google-login-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
          <path className="google-blue" d="M22.56 12.25c0-.73-.06-1.42-.19-2.09H12v3.96h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.75 3.28-7.95Z" />
          <path className="google-green" d="M12 23c2.97 0 5.46-.98 7.28-2.8l-3.56-2.76c-.98.66-2.24 1.06-3.72 1.06-2.87 0-5.3-1.94-6.17-4.54H2.15v2.84A11 11 0 0 0 12 23Z" />
          <path className="google-yellow" d="M5.83 13.96A6.6 6.6 0 0 1 5.48 12c0-.68.12-1.34.35-1.96V7.2H2.15A11 11 0 0 0 1 12c0 1.78.43 3.47 1.15 4.8l3.68-2.84Z" />
          <path className="google-red" d="M12 5.5c1.62 0 3.06.56 4.21 1.64l3.16-3.16A10.54 10.54 0 0 0 12 1a11 11 0 0 0-9.85 6.2l3.68 2.84C6.7 7.44 9.13 5.5 12 5.5Z" />
        </svg>
        Continue with Google
      </button>
      <button type="button" className="login-browse-btn" onClick={() => dialogRef.current.close()}>
        Keep browsing
      </button>
    </dialog>
  )
}
