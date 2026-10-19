import { useEffect, useState } from 'react'
import { api } from '../api'
import '../styles/Sidebar.css'

export default function Sidebar({ onAuthorSelect, selectedAuthorId, refreshKey = 0 }) {
  const [authors, setAuthors] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    const fetchAuthors = async () => {
      try {
        setLoading(true)
        const data = await api.authors.list()
        if (!active) return
        setAuthors(data)
        setError(null)
      } catch (err) {
        if (!active) return
        console.error('Failed to fetch authors:', err)
        setError('Failed to load authors')
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchAuthors()
    return () => {
      active = false
    }
  }, [refreshKey])

  const handleAuthorClick = (id) => {
    onAuthorSelect(selectedAuthorId === id ? null : id)
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Authors</h2>
      </div>

      <div className="sidebar-content">
        {loading && <p className="sidebar-message">Loading authors...</p>}
        {error && <p className="sidebar-error">{error}</p>}
        {!loading && authors.length === 0 && (
          <p className="sidebar-message">No authors found</p>
        )}

        <ul className="authors-list">
          {authors.map((author) => (
            <li key={author.id}>
              <button
                className={`author-btn ${selectedAuthorId === author.id ? 'active' : ''}`}
                onClick={() => handleAuthorClick(author.id)}
              >
                <span className="author-name">
                  {author.knownAs || author.fullName}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
