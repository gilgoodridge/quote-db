import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import AddQuoteDialog from './AddQuoteDialog'
import '../styles/QuotesList.css'

export default function QuotesList({ authorId, query = '', refreshKey = 0, isAuthenticated = false, onAuthorCreated }) {
  const [quotes, setQuotes] = useState([])
  const [loading, setLoading] = useState(Boolean(authorId || query))
  const [error, setError] = useState(null)
  const [expandedQuoteId, setExpandedQuoteId] = useState(null)
  const [editingQuote, setEditingQuote] = useState(null)
  const [deletingQuoteId, setDeletingQuoteId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [editVersion, setEditVersion] = useState(0)
  const deletingRef = useRef(false)
  const editButtonRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    let active = true
    if (!authorId && !query) return

    const fetchQuotes = async () => {
      try {
        setLoading(true)
        setError(null)
        setQuotes([])
        setExpandedQuoteId(null)
        const data = await api.quotes.list(authorId, query)
        if (!active) return
        if (!Array.isArray(data)) throw new Error('The quotes endpoint returned an invalid quote list')
        setQuotes(data)
        setError(null)
        setExpandedQuoteId(null)
      } catch (err) {
        if (!active) return
        console.error('Failed to fetch quotes:', err)
        setError(`Failed to ${query ? 'search' : 'load'} quotes: ${err.message}`)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchQuotes()
    return () => {
      active = false
    }
  }, [authorId, query, refreshKey, editVersion])

  function closeEdit() {
    setEditingQuote(null)
    editButtonRef.current?.focus()
  }

  async function deleteQuote(quote) {
    if (!isAuthenticated || deletingRef.current) return
    if (!window.confirm(`Delete this quote? This cannot be undone. The author will not be deleted.\n\n${quote.text}`)) return
    deletingRef.current = true
    setDeletingQuoteId(quote.id)
    setActionError('')
    setActionMessage('')
    try {
      await api.quotes.delete(quote.id)
      setQuotes((current) => current.filter((item) => item.id !== quote.id))
      setExpandedQuoteId((current) => current === quote.id ? null : current)
      setActionMessage('Quote deleted.')
      containerRef.current?.focus()
    } catch (err) {
      setActionError(`Unable to delete quote: ${err.message}`)
    } finally {
      deletingRef.current = false
      setDeletingQuoteId(null)
    }
  }

  const toggleQuoteExpanded = (id) => {
    setExpandedQuoteId(expandedQuoteId === id ? null : id)
  }

  const formatDate = (dateString) => {
    if (!dateString) return null
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  }

  const isHttpsUrl = (str) => {
    if (!str) return false
    try {
      const url = new URL(str)
      return url.protocol === 'https:'
    } catch {
      return false
    }
  }

  const renderReference = (reference) => {
    if (isHttpsUrl(reference)) {
      return (
        <a href={reference} target="_blank" rel="noopener noreferrer" className="reference-link">
          {reference}
        </a>
      )
    }
    return reference
  }

  return (
    <div className="quotes-container" ref={containerRef} tabIndex={-1} aria-label="Quotes">
      {actionError && <p className="quote-action-error" role="alert">{actionError}</p>}
      {actionMessage && <p className="quote-action-message" role="status">{actionMessage}</p>}
      {isAuthenticated && editingQuote && (
        <AddQuoteDialog
          quote={editingQuote}
          onClose={closeEdit}
          onAuthorCreated={onAuthorCreated}
          onUpdated={() => {
            setEditingQuote(null)
            setActionMessage('Quote updated.')
            setEditVersion((version) => version + 1)
            containerRef.current?.focus()
          }}
        />
      )}
      {!authorId && !query ? (
        <div className="empty-state">
          <div className="empty-icon">📖</div>
          <h2>No Author Selected</h2>
          <p>Select an author from the left panel or search all quotes above</p>
        </div>
      ) : (
        <>
          {query && (
            <p className="search-summary" role="status">
              Results for “{query}” {authorId ? 'within the selected author' : 'across all authors'}
            </p>
          )}
          {loading && (
            <div className="loading-state" role="status">
              <p>Loading quotes...</p>
            </div>
          )}
          {error && (
            <div className="error-state" role="alert">
              <p>{error}</p>
            </div>
          )}
          {!loading && !error && quotes.length === 0 && (
            <div className="empty-state">
              <div className="empty-icon">✨</div>
              <h2>No Quotes Found</h2>
              <p>{query
                ? 'No quotes match this search. Try different words; common words and words shorter than three characters may be ignored.'
                : 'This author has no quotes yet'}</p>
            </div>
          )}
          {!loading && !error && quotes.length > 0 && (
            <div className="quotes-content">
              <ul className="quotes-list">
                {quotes.map((quote) => (
                  <li key={quote.id} className="quote-item">
                    <div className="quote-card-header">
                      <button
                        className={`quote-row ${expandedQuoteId === quote.id ? 'expanded' : ''}`}
                        aria-expanded={expandedQuoteId === quote.id}
                        onClick={() => toggleQuoteExpanded(quote.id)}
                      >
                        <span className="expand-arrow">▶</span>
                        <blockquote className="quote-text">
                          {quote.text}
                        </blockquote>
                      </button>
                      {isAuthenticated && (
                        <div className="quote-actions">
                          <button
                            type="button"
                            className="quote-action"
                            aria-label="Edit quote"
                            title="Edit quote"
                            aria-haspopup="dialog"
                            disabled={deletingQuoteId !== null}
                            onClick={(event) => {
                              editButtonRef.current = event.currentTarget
                              setActionError('')
                              setActionMessage('')
                              setEditingQuote(quote)
                            }}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="quote-action quote-delete"
                            aria-label="Delete quote"
                            title="Delete quote"
                            disabled={deletingQuoteId !== null}
                            onClick={() => deleteQuote(quote)}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <path d="m6 6 12 12M6 18 18 6" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </div>
                    {deletingQuoteId === quote.id && <p className="quote-action-message" role="status">Deleting quote...</p>}
                    {!authorId && (
                      <p className="quote-author">{quote.author.knownAs || quote.author.fullName}</p>
                    )}
                    {expandedQuoteId === quote.id && (
                      <div className="quote-details">
                        <div className="detail-field">
                          <span className="detail-label">Full Text:</span>
                          <p className="detail-value">{quote.text}</p>
                        </div>
                        {quote.date && (
                          <div className="detail-field">
                            <span className="detail-label">Date:</span>
                            <p className="detail-value">{formatDate(quote.date)}</p>
                          </div>
                        )}
                        {quote.location && (
                          <div className="detail-field">
                            <span className="detail-label">Location:</span>
                            <p className="detail-value">{quote.location}</p>
                          </div>
                        )}
                        {quote.reference && (
                          <div className="detail-field">
                            <span className="detail-label">Reference:</span>
                            <p className="detail-value">
                              {renderReference(quote.reference)}
                            </p>
                          </div>
                        )}
                        {quote.authorAgeAtQuote && (
                          <div className="detail-field">
                            <span className="detail-label">Author Age:</span>
                            <p className="detail-value">{quote.authorAgeAtQuote} years old</p>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  )
}
