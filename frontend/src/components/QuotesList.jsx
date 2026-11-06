import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import AddQuoteDialog from './AddQuoteDialog'
import AboutAuthorDialog from './AboutAuthorDialog'
import {categoryDimensions} from '../quoteCategories'
import '../styles/QuotesList.css'

const EMPTY_CATEGORY_IDS = { toneIds: [], themeIds: [], formIds: [], sourceIds: [] }

function SelectedAuthorHeading({authorId, updatedAuthor, onAuthorClick}) {
  const [loadedAuthor, setAuthor] = useState(null)
  const author = updatedAuthor?.id === authorId ? updatedAuthor : loadedAuthor
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    async function loadAuthor() {
      try {
        setError(null)
        const data = await api.authors.get(authorId)
        if (!active) return
        if (data?.id !== authorId || !data.fullName) {
          throw new Error('The authors endpoint returned an invalid author')
        }
        setAuthor(data)
      } catch (err) {
        if (active) setError(`Unable to load author: ${err.message}`)
      }
    }
    loadAuthor()
    return () => {
      active = false
    }
  }, [authorId, attempt])

  return (
    <header className="selected-author-header">
      {author ? (
        <h2>
          <button type="button" className="author-details-link" aria-haspopup="dialog" onClick={(event) => onAuthorClick(author.id, event)}>
            {author.knownAs || author.fullName}
          </button>
        </h2>
      ) : error ? (
        <div role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => {
            setError(null)
            setAttempt((value) => value + 1)
          }}>Retry author</button>
        </div>
      ) : (
        <p role="status">Loading author...</p>
      )}
    </header>
  )
}

export default function QuotesList({
  authorId = null,
  query = '',
  categoryIds = EMPTY_CATEGORY_IDS,
  refreshKey = 0,
  isAuthenticated = false,
  onAuthorCreated,
  onAuthorUpdated,
}) {
  const [quotes, setQuotes] = useState([])
  const hasCategoryFilters = Object.values(categoryIds).some((ids) => ids?.length > 0)
  const hasFilters = Boolean(authorId || query || hasCategoryFilters)
  const [loading, setLoading] = useState(hasFilters)
  const [error, setError] = useState(null)
  const [expandedQuoteId, setExpandedQuoteId] = useState(null)
  const [editingQuote, setEditingQuote] = useState(null)
  const [deletingQuoteId, setDeletingQuoteId] = useState(null)
  const [actionError, setActionError] = useState('')
  const [actionMessage, setActionMessage] = useState('')
  const [editVersion, setEditVersion] = useState(0)
  const [aboutAuthorId, setAboutAuthorId] = useState(null)
  const [updatedAuthor, setUpdatedAuthor] = useState(null)
  const authorButtonRef = useRef(null)
  const deletingRef = useRef(false)
  const editButtonRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    let active = true
    if (!authorId && !query && !hasCategoryFilters) return

    const fetchQuotes = async () => {
      try {
        setLoading(true)
        setError(null)
        setQuotes([])
        setExpandedQuoteId(null)
        const data = await api.quotes.list(authorId, query, categoryIds)
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
  }, [authorId, query, categoryIds, hasCategoryFilters, refreshKey, editVersion])

  function closeEdit() {
    setEditingQuote(null)
    editButtonRef.current?.focus()
  }

  function openAuthor(id, event) {
    authorButtonRef.current = event.currentTarget
    setAboutAuthorId(id)
  }

  function closeAuthor() {
    setAboutAuthorId(null)
    const target = authorButtonRef.current
    if (target?.isConnected) target.focus()
    else containerRef.current?.focus()
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
    <div className={`quotes-container${authorId ? ' has-selected-author' : ''}`} ref={containerRef} tabIndex={-1} aria-label="Quotes">
      {authorId && <SelectedAuthorHeading key={authorId} authorId={authorId} updatedAuthor={updatedAuthor} onAuthorClick={openAuthor} />}
      {aboutAuthorId != null && (
        <AboutAuthorDialog
          key={aboutAuthorId}
          authorId={aboutAuthorId}
          isAuthenticated={isAuthenticated}
          onClose={closeAuthor}
          onUpdated={(author) => {
            setUpdatedAuthor(author)
            setQuotes((current) => current.map((quote) => quote.author.id === author.id ? {...quote, author} : quote))
            setEditVersion((version) => version + 1)
            onAuthorUpdated?.(author)
          }}
        />
      )}
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
      {!hasFilters ? (
        <div className="empty-state">
          <div className="empty-icon">📖</div>
          <h2>No Author Selected</h2>
          <p>Select an author or category from the left panel, or search all quotes above</p>
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
                : hasCategoryFilters
                  ? 'No quotes match the selected filters'
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
                      <p className="quote-author">
                        <button type="button" className="author-details-link" aria-haspopup="dialog" onClick={(event) => openAuthor(quote.author.id, event)}>
                          {quote.author.knownAs || quote.author.fullName}
                        </button>
                      </p>
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
                        {categoryDimensions.map(({ key, label }) => quote[key]?.length > 0 && (
                          <div key={key} className="detail-field">
                            <span className="detail-label">{label}:</span>
                            <ul className="quote-category-tags" aria-label={label}>
                              {quote[key].map((category) => (
                                <li key={category.id} className="quote-category-tag" title={category.description}>
                                  {category.name}
                                  {category.description && (
                                    <span className="category-description-sr">: {category.description}</span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
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
