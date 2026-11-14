import {useEffect, useRef, useState} from 'react'
import {api} from '../api'

export default function NameFilter({resource, label, selectedId, onSelect, refreshKey = 0, displayName, onDetails, onCreate}) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [nextPage, setNextPage] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const requestId = useRef(0)
  const morePending = useRef(false)

  useEffect(() => {
    const nextQuery = searchText.trim()
    if (!nextQuery || nextQuery === query) return
    const timeout = setTimeout(() => setQuery(nextQuery), 500)
    return () => clearTimeout(timeout)
  }, [searchText, query])

  useEffect(() => {
    let active = true
    requestId.current += 1
    morePending.current = false
    async function load() {
      try {
        setLoadingMore(false)
        setNextPage(null)
        setItems([])
        setLoading(true)
        setError(null)
        const data = await api[resource].listPage({query, page: 0, size: 10})
        if (!active) return
        setItems(data.content)
        setNextPage(data.page.totalPages > 1 ? 1 : null)
      } catch (err) {
        if (active) setError(`Failed to load ${resource}: ${err.message}`)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false; requestId.current += 1 }
  }, [resource, refreshKey, query, attempt])

  async function loadMore() {
    if (nextPage == null || morePending.current || loading) return
    const request = requestId.current
    morePending.current = true
    setLoadingMore(true)
    setError(null)
    try {
      const data = await api[resource].listPage({query, page: nextPage, size: 10})
      if (request !== requestId.current) return
      setItems((current) => [...current, ...data.content.filter((item) => !current.some((existing) => existing.id === item.id))])
      setNextPage(nextPage + 1 < data.page.totalPages ? nextPage + 1 : null)
    } catch (err) {
      if (request === requestId.current) setError(`Failed to load more ${resource}: ${err.message}`)
    } finally {
      if (request === requestId.current) {
        morePending.current = false
        setLoadingMore(false)
      }
    }
  }

  return (
    <section className="sidebar-section authors-section" aria-labelledby={`${resource}-title`}>
      <h3 id={`${resource}-title`}>{label}s</h3>
      <form className="author-search" role="search" aria-label={`${label} search`} onSubmit={(event) => {
        event.preventDefault()
        setQuery(searchText.trim())
        setAttempt((value) => value + 1)
      }}>
        <input type="search" aria-label={`Search ${resource} by full name`} placeholder={`Search ${resource}...`}
          value={searchText} onChange={(event) => {
            setSearchText(event.target.value)
            if (!event.target.value.trim()) setQuery('')
          }} />
        <button type="submit" aria-label={`Search ${resource}`}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" />
          </svg>
        </button>
      </form>
      {onCreate && <button type="button" className="sidebar-retry" aria-haspopup="dialog" onClick={onCreate}>Add new character</button>}
      {loading && <p className="sidebar-message">Loading {resource}...</p>}
      {error && (
        <div className="sidebar-error" role="alert">
          <p>{error}</p>
          <button className="sidebar-retry" onClick={() => {
            if (nextPage != null) loadMore()
            else setAttempt((value) => value + 1)
          }}>Retry loading {resource}</button>
        </div>
      )}
      {!loading && !error && items.length === 0 && <p className="sidebar-message">No {resource} found</p>}
      <ul className="authors-list">
        <li><button className={`author-btn ${selectedId == null ? 'active' : ''}`}
          onClick={() => onSelect(null)} aria-pressed={selectedId == null}>All {resource}</button></li>
        {!loading && items.map((item) => (
          <li key={item.id} className={onDetails ? 'name-filter-row' : undefined}>
            <button className={`author-btn ${selectedId === item.id ? 'active' : ''}`}
              onClick={() => onSelect(selectedId === item.id ? null : item.id)} aria-pressed={selectedId === item.id}>
              <span className="author-name">{displayName ? displayName(item) : item.knownAs || item.fullName}</span>
            </button>
            {onDetails && <button type="button" className="sidebar-retry" aria-haspopup="dialog"
              aria-label={`About ${displayName(item)}`} onClick={(event) => onDetails(item.id, event)}>Info</button>}
          </li>
        ))}
        {nextPage != null && <li><button type="button" className="sidebar-retry" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? `Loading more ${resource}...` : `More ${resource}`}
        </button></li>}
      </ul>
    </section>
  )
}
