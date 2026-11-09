import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import {categoryDimensions} from '../quoteCategories'
import '../styles/Sidebar.css'

export default function Sidebar({
  onAuthorSelect,
  selectedAuthorId,
  selectedCategoryIds,
  onCategoryIdsChange,
  refreshKey = 0,
}) {
  const [authors, setAuthors] = useState([])
  const [categories, setCategories] = useState(null)
  const [loadingAuthors, setLoadingAuthors] = useState(true)
  const [authorsError, setAuthorsError] = useState(null)
  const [searchText, setSearchText] = useState('')
  const [query, setQuery] = useState('')
  const [authorsAttempt, setAuthorsAttempt] = useState(0)
  const [nextAuthorPage, setNextAuthorPage] = useState(null)
  const [loadingMoreAuthors, setLoadingMoreAuthors] = useState(false)
  const authorsRequest = useRef(0)
  const moreAuthorsPending = useRef(false)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState(null)

  useEffect(() => {
    const nextQuery = searchText.trim()
    if (!nextQuery || nextQuery === query) return
    const timeout = setTimeout(() => setQuery(nextQuery), 500)
    return () => clearTimeout(timeout)
  }, [searchText, query])

  useEffect(() => {
    let active = true
    authorsRequest.current += 1
    moreAuthorsPending.current = false
    const fetchAuthors = async () => {
      try {
        setLoadingMoreAuthors(false)
        setNextAuthorPage(null)
        setAuthors([])
        setLoadingAuthors(true)
        setAuthorsError(null)
        const data = await api.authors.listPage({query, page: 0, size: 10})
        if (!active) return
        setAuthors(data.content)
        setNextAuthorPage(data.page.totalPages > 1 ? 1 : null)
        setAuthorsError(null)
      } catch (err) {
        if (!active) return
        console.error('Failed to fetch authors:', err)
        setAuthorsError(`Failed to load authors: ${err.message}`)
      } finally {
        if (active) setLoadingAuthors(false)
      }
    }

    fetchAuthors()
    return () => {
      active = false
      authorsRequest.current += 1
    }
  }, [refreshKey, query, authorsAttempt])

  async function loadMoreAuthors() {
    if (nextAuthorPage == null || moreAuthorsPending.current || loadingAuthors) return
    const request = authorsRequest.current
    moreAuthorsPending.current = true
    setLoadingMoreAuthors(true)
    setAuthorsError(null)
    try {
      const data = await api.authors.listPage({query, page: nextAuthorPage, size: 10})
      if (request !== authorsRequest.current) return
      setAuthors((current) => [...current, ...data.content.filter(
        (author) => !current.some((existing) => existing.id === author.id),
      )])
      setNextAuthorPage(nextAuthorPage + 1 < data.page.totalPages ? nextAuthorPage + 1 : null)
    } catch (err) {
      if (request !== authorsRequest.current) return
      console.error('Failed to fetch more authors:', err)
      setAuthorsError(`Failed to load more authors: ${err.message}`)
    } finally {
      if (request === authorsRequest.current) {
        moreAuthorsPending.current = false
        setLoadingMoreAuthors(false)
      }
    }
  }

  async function loadCategories() {
    setLoadingCategories(true)
    setCategoriesError(null)
    try {
      setCategories(await api.categories.list())
    } catch (err) {
      console.error('Failed to fetch categories:', err)
      setCategoriesError(`Failed to load categories: ${err.message}`)
    } finally {
      setLoadingCategories(false)
    }
  }

  useEffect(() => {
    let active = true
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true)
        const data = await api.categories.list()
        if (!active) return
        setCategories(data)
        setCategoriesError(null)
      } catch (err) {
        if (!active) return
        console.error('Failed to fetch categories:', err)
        setCategoriesError(`Failed to load categories: ${err.message}`)
      } finally {
        if (active) setLoadingCategories(false)
      }
    }

    fetchCategories()
    return () => {
      active = false
    }
  }, [])

  const handleAuthorClick = (id) => {
    onAuthorSelect(selectedAuthorId === id ? null : id)
  }

  const handleCategoryChange = (field, id) => {
    const currentIds = selectedCategoryIds[field] ?? []
    const nextIds = currentIds.includes(id)
      ? currentIds.filter((selectedId) => selectedId !== id)
      : [...currentIds, id]
    onCategoryIdsChange({ ...selectedCategoryIds, [field]: nextIds })
  }

  const clearCategoryDimension = (field) => {
    onCategoryIdsChange({ ...selectedCategoryIds, [field]: [] })
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>Filter Quotes</h2>
      </div>

      <div className="sidebar-content">
        <section className="sidebar-section authors-section" aria-labelledby="authors-title">
          <h3 id="authors-title">Authors</h3>
          <form className="author-search" role="search" aria-label="Author search" onSubmit={(event) => {
            event.preventDefault()
            setQuery(searchText.trim())
            setAuthorsAttempt((attempt) => attempt + 1)
          }}>
            <input
              type="search"
              aria-label="Search authors by full name"
              placeholder="Search authors..."
              value={searchText}
              onChange={(event) => {
                setSearchText(event.target.value)
                if (!event.target.value.trim()) setQuery('')
              }}
            />
            <button type="submit" aria-label="Search authors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <circle cx="10" cy="10" r="6" />
                <path d="m15 15 6 6" />
              </svg>
            </button>
          </form>
          {loadingAuthors && <p className="sidebar-message">Loading authors...</p>}
          {authorsError && (
            <div className="sidebar-error" role="alert">
              <p>{authorsError}</p>
              <button className="sidebar-retry" onClick={() => {
                if (nextAuthorPage != null) loadMoreAuthors()
                else setAuthorsAttempt((attempt) => attempt + 1)
              }}>
                Retry loading authors
              </button>
            </div>
          )}
          {!loadingAuthors && !authorsError && authors.length === 0 && (
            <p className="sidebar-message">No authors found</p>
          )}
          <ul className="authors-list">
            <li>
              <button
                className={`author-btn ${selectedAuthorId == null ? 'active' : ''}`}
                onClick={() => onAuthorSelect(null)}
                aria-pressed={selectedAuthorId == null}
              >
                All authors
              </button>
            </li>
            {!loadingAuthors && authors.map((author) => (
              <li key={author.id}>
                <button
                  className={`author-btn ${selectedAuthorId === author.id ? 'active' : ''}`}
                  onClick={() => handleAuthorClick(author.id)}
                  aria-pressed={selectedAuthorId === author.id}
                >
                  <span className="author-name">{author.knownAs || author.fullName}</span>
                </button>
              </li>
            ))}
            {nextAuthorPage != null && (
              <li>
                <button
                  type="button"
                  className="sidebar-retry"
                  onClick={loadMoreAuthors}
                  disabled={loadingMoreAuthors}
                >
                  {loadingMoreAuthors ? 'Loading more authors...' : 'More authors'}
                </button>
              </li>
            )}
          </ul>
        </section>

        <section className="sidebar-section categories-section" aria-labelledby="categories-title">
          <h3 id="categories-title">Categories</h3>
          {loadingCategories && <p className="sidebar-message">Loading categories...</p>}
          {categoriesError && (
            <div className="sidebar-error" role="alert">
              <p>{categoriesError}</p>
              <button className="sidebar-retry" onClick={loadCategories}>Retry</button>
            </div>
          )}
          {categories && categoryDimensions.map(({ key, field, label, description }) => {
            const options = categories[key]
            const selectedIds = selectedCategoryIds[field] ?? []
            return (
              <details className="category-filter" key={key}>
                <summary>
                  <span title={description}>{label}</span>
                  {selectedIds.length > 0 && (
                    <span className="category-selection-count">{selectedIds.length}</span>
                  )}
                </summary>
                {selectedIds.length > 0 && (
                  <button
                    className="category-clear"
                    onClick={() => clearCategoryDimension(field)}
                    type="button"
                  >
                    Clear {label.toLowerCase()}
                  </button>
                )}
                <ul className="category-options">
                  {options.map((option) => (
                    <li key={option.id}>
                      <label title={option.description || undefined}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(option.id)}
                          onChange={() => handleCategoryChange(field, option.id)}
                        />
                        <span>{option.name}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </details>
            )
          })}
        </section>
      </div>
    </div>
  )
}
