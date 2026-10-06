import { useState } from 'react'
import '../styles/Header.css'

export default function Header() {
  const [showMenu, setShowMenu] = useState(false)

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
            className="hamburger-btn"
            onClick={() => setShowMenu(!showMenu)}
            aria-label="Menu"
          >
            ☰
          </button>
          {showMenu && (
            <div className="dropdown-menu">
              <a href="#" onClick={() => setShowMenu(false)}>
                About
              </a>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
