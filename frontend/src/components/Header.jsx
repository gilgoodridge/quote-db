import { useEffect, useRef, useState } from 'react'
import { api, getGoogleOAuthStartUrl, getLoginReturnState } from '../api'
import { clearAddQuoteIntent, hasAddQuoteIntent, saveAddQuoteIntent } from '../quoteIntent'
import AddQuoteDialog from './AddQuoteDialog'
import LoginDialog from './LoginDialog'
import '../styles/Header.css'

export default function Header({ onQuoteCreated, onAuthorCreated, selectedAuthorId }) {
  const [showMenu, setShowMenu] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const [authStatus, setAuthStatus] = useState('loading')
  const [user, setUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [logoutError, setLogoutError] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)
  const [authAttempt, setAuthAttempt] = useState(0)
  const [loginForQuote, setLoginForQuote] = useState(false)
  const [showAddQuote, setShowAddQuote] = useState(false)
  const [quoteActionError, setQuoteActionError] = useState('')
  const [quoteAdded, setQuoteAdded] = useState(false)
  const [loginReturn] = useState(() => getLoginReturnState(window.location.href))
  const loginError = loginReturn.failed ? 'Google sign-in failed. Please try again.' : ''
  const menuButtonRef = useRef(null)
  const addQuoteButtonRef = useRef(null)
  const loginTriggerRef = useRef(null)
  const addQuoteRequestedRef = useRef(false)

  useEffect(() => {
    let active = true

    api.auth.me()
      .then((session) => {
        if (!active) return
        if (session.authenticated === true) {
          setUser(session)
          setAuthStatus('authenticated')
        } else if (session.authenticated === false) {
          setUser(null)
          setAuthStatus('anonymous')
        } else {
          throw new Error('The session endpoint returned an invalid authentication status')
        }
        let pending = false
        try {
          pending = hasAddQuoteIntent(window.sessionStorage)
          clearAddQuoteIntent(window.sessionStorage)
        } catch (error) {
          setQuoteActionError(`Unable to restore the Add Quote action: ${error.message}`)
        }
        if ((pending && !loginReturn.failed) || addQuoteRequestedRef.current) {
          addQuoteRequestedRef.current = false
          if (session.authenticated) {
            setShowAddQuote(true)
          } else {
            loginTriggerRef.current = addQuoteButtonRef.current
            setLoginForQuote(true)
            setShowLogin(true)
          }
        }
      })
      .catch((error) => {
        if (!active) return
        setAuthError(error.message)
        setAuthStatus('error')
      })

    return () => {
      active = false
    }
  }, [authAttempt, loginReturn.failed])

  useEffect(() => {
    if (!loginReturn.hasLoginParameter) return
    window.history.replaceState(
      window.history.state,
      '',
      loginReturn.cleanedUrl,
    )
  }, [loginReturn])

  function closeLogin() {
    setShowLogin(false)
    setLoginForQuote(false)
    loginTriggerRef.current?.focus()
  }

  async function logout() {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await api.auth.logout()
      setUser(null)
      setAuthStatus('anonymous')
    } catch (error) {
      setLogoutError(`Unable to log out: ${error.message}`)
    } finally {
      setLoggingOut(false)
    }
  }

  function startGoogleLogin() {
    try {
      if (loginForQuote) {
        saveAddQuoteIntent(window.sessionStorage)
      } else {
        clearAddQuoteIntent(window.sessionStorage)
      }
    } catch (error) {
      setQuoteActionError(`Unable to prepare sign-in: ${error.message}`)
      return
    }
    window.location.assign(getGoogleOAuthStartUrl())
  }

  function addQuote() {
    setShowMenu(false)
    setQuoteAdded(false)
    setQuoteActionError('')
    if (authStatus === 'authenticated') {
      setShowAddQuote(true)
    } else if (authStatus === 'anonymous') {
      loginTriggerRef.current = addQuoteButtonRef.current
      setLoginForQuote(true)
      setShowLogin(true)
    } else {
      addQuoteRequestedRef.current = true
      if (authStatus === 'error') {
        setAuthError('')
        setAuthStatus('loading')
        setAuthAttempt((attempt) => attempt + 1)
      }
    }
  }

  function closeAddQuote() {
    setShowAddQuote(false)
    addQuoteButtonRef.current?.focus()
  }

  const displayName = user?.name || user?.email || 'Google account'

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">Quotes DB</h1>
        <button type="button" className="quote-of-day-btn">Quote of the Day</button>
      </div>

      <div className="header-center">
        <div className="search-container">
          <input
            type="text"
            placeholder="Search quotes..."
            className="search-input"
            disabled
          />
          <span className="search-icon">🔍</span>
        </div>
      </div>

      <div className="header-right">
        {authStatus === 'loading' && (
          <span className="auth-indicator" role="status">Checking sign-in...</span>
        )}
        {authStatus === 'error' && (
          <span className="auth-indicator auth-indicator-error" role="alert">
            Unable to check sign-in: {authError}
          </span>
        )}
        <button
          ref={addQuoteButtonRef}
          type="button"
          className="add-quote-btn"
          aria-haspopup="dialog"
          onClick={addQuote}
        >
          Add Quote
        </button>

        <div className="menu-container">
          <button
            ref={menuButtonRef}
            className="hamburger-btn"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Menu"
            aria-expanded={showMenu}
            aria-controls="header-menu"
          >
            ☰
          </button>
          {showMenu && (
            <div className="dropdown-menu" id="header-menu">
              {authStatus === 'authenticated' && (
                <div className="account-summary">
                  <span>Signed in as</span>
                  <strong>{displayName}</strong>
                  {user.email && user.name && <span>{user.email}</span>}
                </div>
              )}
              {authStatus === 'anonymous' && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => {
                    setShowMenu(false)
                    setQuoteActionError('')
                    loginTriggerRef.current = menuButtonRef.current
                    setShowLogin(true)
                  }}
                >
                  Login
                </button>
              )}
              {authStatus === 'loading' && (
                <p className="menu-auth-message" role="status">Checking sign-in...</p>
              )}
              {authStatus === 'error' && (
                <p className="menu-auth-message" role="alert">
                  Sign-in status is unavailable. Public browsing is still available.
                </p>
              )}
              {authStatus === 'authenticated' && (
                <button type="button" onClick={logout} disabled={loggingOut}>
                  {loggingOut ? 'Logging out...' : 'Logout'}
                </button>
              )}
              {logoutError && (
                <p className="menu-auth-message auth-indicator-error" role="alert">
                  {logoutError}
                </p>
              )}
              <a href="#" onClick={() => setShowMenu(false)}>
                About
              </a>
            </div>
          )}
        </div>
      </div>
      {loginError && (
        <p className="header-login-error" role="alert">{loginError}</p>
      )}
      {quoteActionError && !showLogin && (
        <p className="header-login-error" role="alert">{quoteActionError}</p>
      )}
      {quoteAdded && <p className="header-quote-success" role="status">Quote added successfully.</p>}
      {showLogin && (
        <LoginDialog onClose={closeLogin} onGoogleLogin={startGoogleLogin} forAddQuote={loginForQuote} error={quoteActionError} />
      )}
      {showAddQuote && (
        <AddQuoteDialog
          initialAuthorId={selectedAuthorId}
          onAuthorCreated={onAuthorCreated}
          onClose={closeAddQuote}
          onCreated={(quote) => {
            closeAddQuote()
            setQuoteAdded(true)
            onQuoteCreated(quote)
          }}
        />
      )}
    </header>
  )
}
