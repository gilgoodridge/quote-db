import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import {categoryDimensions} from '../quoteCategories'
import {characterLabel} from '../characterFields'
import NameFilter from './NameFilter'
import AboutAuthorDialog from './AboutAuthorDialog'
import AboutCharacterDialog from './AboutCharacterDialog'
import '../styles/Sidebar.css'

export default function Sidebar({
  onAuthorSelect, selectedAuthorId, selectedCategoryIds, onCategoryIdsChange, refreshKey = 0,
  selectedCharacterId = null, onCharacterSelect, charactersRefreshKey = 0,
  isAuthenticated = false, onAuthorChanged, onCharacterChanged,
}) {
  const [categories, setCategories] = useState(null)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoriesError, setCategoriesError] = useState(null)
  const [categoryAttempt, setCategoryAttempt] = useState(0)
  const [aboutAuthorId, setAboutAuthorId] = useState(null)
  const [aboutCharacterId, setAboutCharacterId] = useState(null)
  const authorTrigger = useRef(null)
  const characterTrigger = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoadingCategories(true)
      setCategoriesError(null)
      try {
        const data = await api.categories.list()
        if (active) setCategories(data)
      } catch (err) {
        if (active) setCategoriesError(`Failed to load categories: ${err.message}`)
      } finally {
        if (active) setLoadingCategories(false)
      }
    }
    load()
    return () => { active = false }
  }, [categoryAttempt])

  function restoreAuthorFocus() {
    if (authorTrigger.current?.isConnected) authorTrigger.current.focus()
    else containerRef.current?.focus()
  }

  function restoreCharacterFocus() {
    if (characterTrigger.current?.isConnected) characterTrigger.current.focus()
    else containerRef.current?.focus()
  }

  return (
    <div className="sidebar" ref={containerRef} tabIndex={-1}>
      <div className="sidebar-header"><h2>Filter Quotes</h2></div>
      <div className="sidebar-content">
        <NameFilter resource="authors" label="Author" selectedId={selectedAuthorId}
          onSelect={onAuthorSelect} refreshKey={refreshKey}
          onDetails={(id, event) => {
            authorTrigger.current = event.currentTarget
            setAboutAuthorId(id)
          }} />
        <NameFilter resource="characters" label="Character" selectedId={selectedCharacterId}
          onSelect={onCharacterSelect} refreshKey={charactersRefreshKey} displayName={characterLabel}
          onDetails={(id, event) => {
            characterTrigger.current = event.currentTarget
            setAboutCharacterId(id)
          }} />
        <section className="sidebar-section categories-section" aria-labelledby="categories-title">
          <h3 id="categories-title">Categories</h3>
          {loadingCategories && <p className="sidebar-message">Loading categories...</p>}
          {categoriesError && (
            <div className="sidebar-error" role="alert">
              <p>{categoriesError}</p>
              <button className="sidebar-retry" onClick={() => setCategoryAttempt((value) => value + 1)}>Retry</button>
            </div>
          )}
          {categories && categoryDimensions.map(({key, field, label, description}) => {
            const selectedIds = selectedCategoryIds[field] ?? []
            return (
              <details className="category-filter" key={key}>
                <summary><span title={description}>{label}</span>
                  {selectedIds.length > 0 && <span className="category-selection-count">{selectedIds.length}</span>}
                </summary>
                {selectedIds.length > 0 && (
                  <button className="category-clear" onClick={() => onCategoryIdsChange({...selectedCategoryIds, [field]: []})}
                    type="button">Clear {label.toLowerCase()}</button>
                )}
                <ul className="category-options">
                  {categories[key].map((option) => (
                    <li key={option.id}>
                      <label title={option.description || undefined}>
                        <input type="checkbox" checked={selectedIds.includes(option.id)} onChange={() => {
                          const nextIds = selectedIds.includes(option.id)
                            ? selectedIds.filter((id) => id !== option.id) : [...selectedIds, option.id]
                          onCategoryIdsChange({...selectedCategoryIds, [field]: nextIds})
                        }} />
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
      {aboutAuthorId != null && (
        <AboutAuthorDialog key={aboutAuthorId} authorId={aboutAuthorId} isAuthenticated={isAuthenticated}
          onClose={() => { setAboutAuthorId(null); restoreAuthorFocus() }} onUpdated={onAuthorChanged} />
      )}
      {aboutCharacterId != null && (
        <AboutCharacterDialog key={aboutCharacterId} characterId={aboutCharacterId} isAuthenticated={isAuthenticated}
          onClose={() => { setAboutCharacterId(null); restoreCharacterFocus() }} onUpdated={onCharacterChanged} />
      )}
    </div>
  )
}
