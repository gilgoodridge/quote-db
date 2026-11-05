import {useEffect, useState} from 'react'
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
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState(null)

  useEffect(() => {
    let active = true
    const fetchAuthors = async () => {
      try {
        setLoadingAuthors(true)
        const data = await api.authors.list()
        if (!active) return
        setAuthors(data)
        setAuthorsError(null)
      } catch (err) {
        if (!active) return
        console.error('Failed to fetch authors:', err)
        setAuthorsError('Failed to load authors')
      } finally {
        if (active) setLoadingAuthors(false)
      }
    }

    fetchAuthors()
    return () => {
      active = false
    }
  }, [refreshKey])

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
          {loadingAuthors && <p className="sidebar-message">Loading authors...</p>}
          {authorsError && <p className="sidebar-error">{authorsError}</p>}
          {!loadingAuthors && authors.length === 0 && (
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
            {authors.map((author) => (
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
