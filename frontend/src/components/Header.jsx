import { useRef, useState } from 'react'
import LoginDialog from './LoginDialog'
import '../styles/Header.css'

export default function Header() {
  const [showMenu, setShowMenu] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const menuButtonRef = useRef(null)

  function closeLogin() {
    setShowLogin(false)
    menuButtonRef.current?.focus()
  }

  return (
    <header className="header">
      <div className="header-left">
        <h1 className="logo">Quotes DB</h1>
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
        <button className="quote-of-day-btn">Quote of the Day</button>

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
              <button
                type="button"
                aria-haspopup="dialog"
                onClick={() => {
                  setShowMenu(false)
                  setShowLogin(true)
                }}
              >
                Login
              </button>
              <a href="#" onClick={() => setShowMenu(false)}>
                About
              </a>
            </div>
          )}
        </div>
      </div>
      {showLogin && <LoginDialog onClose={closeLogin} />}
    </header>
  )
}
