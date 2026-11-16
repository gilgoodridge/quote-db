import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import AddAuthorDialog from './AddAuthorDialog'
import AddCharacterDialog from './AddCharacterDialog'
import {characterLabel} from '../characterFields'
import QuoteCategoryFields from './QuoteCategoryFields'
import DialogHeader from './DialogHeader'
import ExternalLink from './ExternalLink'
import {categoryDimensions, categorySelections} from '../quoteCategories'
import '../styles/AddQuoteDialog.css'

export default function AddQuoteDialog({ onClose, onCreated, onUpdated, onAuthorCreated, onCharacterCreated, initialAuthorId, initialCharacterId, quote, initialValues, review }) {
  const dialogRef = useRef(null)
  const addAuthorButtonRef = useRef(null)
  const addCharacterButtonRef = useRef(null)
  const submittingRef = useRef(false)
  const [authors, setAuthors] = useState([])
  const [loadingAuthors, setLoadingAuthors] = useState(true)
  const [authorError, setAuthorError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [retryRequest, setRetryRequest] = useState(null)
  const [showAddAuthor, setShowAddAuthor] = useState(false)
  const [authorAdded, setAuthorAdded] = useState(false)
  const [characters, setCharacters] = useState([])
  const [loadingCharacters, setLoadingCharacters] = useState(true)
  const [characterError, setCharacterError] = useState('')
  const [characterLoadAttempt, setCharacterLoadAttempt] = useState(0)
  const [showAddCharacter, setShowAddCharacter] = useState(false)
  const [characterAdded, setCharacterAdded] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoryError, setCategoryError] = useState('')
  const [categoryLoadAttempt, setCategoryLoadAttempt] = useState(0)
  const [selections, setSelections] = useState(() => categorySelections(quote ?? initialValues))
  const [fields, setFields] = useState({
    text: quote?.text ?? initialValues?.text ?? '',
    authorId: String(quote?.author.id ?? initialAuthorId ?? ''),
    characterId: String(quote?.character?.id ?? initialValues?.character?.id ?? initialCharacterId ?? ''),
    date: quote?.date ?? initialValues?.date ?? '',
    location: quote?.location ?? initialValues?.location ?? '',
    primaryReference: quote?.primaryReference ?? initialValues?.primaryReference ?? '',
    secondaryReference: quote?.secondaryReference ?? initialValues?.secondaryReference ?? '',
  })

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  useEffect(() => {
    let active = true
    api.authors.list()
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('The authors endpoint returned an invalid list')
        if (active) setAuthors(data)
      })
      .catch((error) => {
        if (active) setAuthorError(`Unable to load authors: ${error.message}`)
      })
      .finally(() => {
        if (active) setLoadingAuthors(false)
      })
    return () => {
      active = false
    }
  }, [loadAttempt])

  useEffect(() => {
    let active = true
    api.characters.list()
      .then((data) => {
        if (!Array.isArray(data)) throw new Error('The characters endpoint returned an invalid list')
        if (active) setCharacters(data)
      })
      .catch((error) => {
        if (active) setCharacterError(`Unable to load characters: ${error.message}`)
      })
      .finally(() => {
        if (active) setLoadingCharacters(false)
      })
    return () => { active = false }
  }, [characterLoadAttempt])

  useEffect(() => {
    let active = true
    api.categories.list()
      .then((data) => {
        if (active) setCatalog(data)
      })
      .catch((error) => {
        if (active) setCategoryError(`Unable to load categories: ${error.message}`)
      })
      .finally(() => {
        if (active) setLoadingCategories(false)
      })
    return () => {
      active = false
    }
  }, [categoryLoadAttempt])

  function updateField(event) {
    const { name, value } = event.target
    setFields((current) => ({ ...current, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    if (submittingRef.current) return
    if (showAddAuthor || showAddCharacter) return
    if (review?.publishedQuote) {
      await saveQuote(null)
      return
    }
    if (retryRequest) {
      await saveQuote(retryRequest)
      return
    }
    if (loadingCharacters || characterError) {
      setSaveError('Load the character options before saving. Your draft has been kept.')
      return
    }
    const character = characters.find((item) => String(item.id) === fields.characterId)
    if (fields.characterId && !character) {
      setSaveError('The selected character is no longer available. Choose another character or no character.')
      return
    }
    if (loadingCategories || categoryError || !catalog) {
      setSaveError('Load the category options before saving. Your draft has been kept.')
      return
    }
    if (categoryDimensions.some(({ key, field }) =>
      selections[field].some((id) => !catalog[key].some((option) => option.id === id)))) {
      setSaveError('A selected category is no longer in the catalog. Reopen the quote to load its current selections.')
      return
    }
    if (!fields.text.trim()) {
      setSaveError('Enter quote text, not just whitespace.')
      return
    }
    const author = authors.find((item) => String(item.id) === fields.authorId)
    if (!author) {
      setSaveError('Choose an author from the list.')
      return
    }
    await saveQuote({
      text: fields.text,
      authorId: author.id,
      characterId: character?.id ?? null,
      date: fields.date || null,
      location: fields.location || null,
      primaryReference: fields.primaryReference || null,
      secondaryReference: fields.secondaryReference || null,
      ...selections,
    })
  }

  async function saveQuote(request) {
    submittingRef.current = true
    setSaving(true)
    setSaveError('')
    let savedQuote
    try {
      savedQuote = review ? await review.onApprove(request) : quote
        ? await api.quotes.update(quote.id, request)
        : await api.quotes.create(request)
    } catch (error) {
      if (review && request && (!error.status || error.status >= 500)) setRetryRequest(request)
      setSaveError(`Unable to ${review ? 'approve' : quote ? 'update' : 'add'} quote: ${error.message}`)
      return
    } finally {
      submittingRef.current = false
      setSaving(false)
    }
    if (quote) onUpdated(savedQuote)
    else onCreated(savedQuote)
  }

  async function reject() {
    if (submittingRef.current || showAddAuthor || showAddCharacter || review.publishedQuote || retryRequest) return
    submittingRef.current = true
    setSaving(true)
    setSaveError('')
    try {
      await review.onReject()
    } catch (error) {
      setSaveError(`Unable to reject candidate: ${error.message}`)
    } finally {
      submittingRef.current = false
      setSaving(false)
    }
  }

  async function snooze() {
    if (submittingRef.current || showAddAuthor || showAddCharacter || review.publishedQuote || retryRequest) return
    submittingRef.current = true
    setSaving(true)
    setSaveError('')
    try {
      await review.onSnooze()
    } catch (error) {
      setSaveError(`Unable to snooze candidate: ${error.message}`)
    } finally {
      submittingRef.current = false
      setSaving(false)
    }
  }

  function closeAddAuthor() {
    setShowAddAuthor(false)
    addAuthorButtonRef.current?.focus()
  }

  function closeAddCharacter() {
    setShowAddCharacter(false)
    addCharacterButtonRef.current?.focus()
  }

  const actionsDisabled = saving || showAddAuthor || showAddCharacter
  const saveDisabled = actionsDisabled || (!retryRequest && !review?.publishedQuote && (
    loadingAuthors || Boolean(authorError) || authors.length === 0 ||
    loadingCharacters || Boolean(characterError) || loadingCategories || Boolean(categoryError)
  ))
  const saveLabel = saving ? 'Saving...' : review?.publishedQuote || retryRequest ? 'Retry approval' : review ? 'Approve' : 'Save quote'

  function reviewActions(inHeader = false) {
    return (
      <>
        <button type="button" className="add-quote-cancel"
          aria-label={inHeader ? 'Reject candidate' : undefined}
          disabled={actionsDisabled || Boolean(review.publishedQuote) || Boolean(retryRequest)} onClick={reject}>Reject</button>
        {review.status === 'PENDING' && (
          <button type="button" className="add-quote-cancel"
            aria-label={inHeader ? 'Snooze candidate' : undefined}
            disabled={actionsDisabled || Boolean(review.publishedQuote) || Boolean(retryRequest)} onClick={snooze}>Snooze</button>
        )}
        <button type="submit" form="quote-form" className="add-quote-submit"
          aria-label={inHeader ? review.publishedQuote ? 'Retry candidate approval' : 'Approve candidate' : undefined}
          disabled={saveDisabled}>{saveLabel}</button>
      </>
    )
  }

  return (
    <>
    <dialog
      ref={dialogRef}
      className="add-quote-dialog"
      aria-labelledby="add-quote-title"
      onClose={onClose}
      onCancel={(event) => {
        if (submittingRef.current || showAddAuthor || showAddCharacter) event.preventDefault()
      }}
    >
      <DialogHeader
        titleId="add-quote-title"
        title={review ? 'Review Quote' : quote ? 'Edit Quote' : 'Add Quote'}
        closeLabel="Close quote form"
        disabled={saving || showAddAuthor || showAddCharacter}
        onClose={() => {
          if (!submittingRef.current && !showAddAuthor && !showAddCharacter) dialogRef.current.close()
        }}
      >
        {review && (
          <div className="quote-review-header-actions" role="group" aria-label="Quote review actions">
            {reviewActions(true)}
          </div>
        )}
      </DialogHeader>
      <div className="dialog-body">
      {review?.publishedQuote && <p role="status">Quote saved. Retry approval to link the candidate without creating another quote.</p>}
      {retryRequest && !review?.publishedQuote && <p role="status">Retry sends the same quote details to safely confirm promotion.</p>}
      <form id="quote-form" onSubmit={submit} aria-busy={saving}>
        <fieldset disabled={saving || Boolean(review?.publishedQuote) || Boolean(retryRequest)}>
          <label htmlFor="quote-text" title="The words of the quote.">Quote text *</label>
          <textarea id="quote-text" name="text" value={fields.text} onChange={updateField} required maxLength={2048} rows={5} autoFocus />

          <label htmlFor="quote-author" title="The writer or real person to whom the quote is attributed.">Author *</label>
          {loadingAuthors && <p role="status">Loading authors...</p>}
          {authorError && (
            <div role="alert">
              <p>{authorError}</p>
              <button
                type="button"
                onClick={() => {
                  setLoadingAuthors(true)
                  setAuthorError('')
                  setLoadAttempt((attempt) => attempt + 1)
                }}
              >
                Retry loading authors
              </button>
            </div>
          )}
          <select id="quote-author" name="authorId" value={fields.authorId} onChange={updateField} required disabled={loadingAuthors || Boolean(authorError)}>
            <option value="">Choose an author</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>{author.knownAs || author.fullName}</option>
            ))}
          </select>
          {!loadingAuthors && !authorError && authors.length === 0 && (
            <p role="status">No authors are available. An author must be added before you can save a quote.</p>
          )}
          <div className="add-author-actions">
            <button
              ref={addAuthorButtonRef}
              type="button"
              disabled={loadingAuthors}
              aria-haspopup="dialog"
              onClick={() => {
                setAuthorAdded(false)
                setShowAddAuthor(true)
              }}
            >
              Add new author
            </button>
          </div>
          {authorAdded && <p role="status">Author added and selected.</p>}

          <label htmlFor="quote-character" title="The fictional speaker, if any. The writer is still the author.">Character</label>
          {loadingCharacters && <p role="status">Loading characters...</p>}
          {characterError && (
            <div className="add-quote-error" role="alert">
              <p>{characterError} Your draft has been kept.</p>
              <button type="button" onClick={() => {
                setLoadingCharacters(true)
                setCharacterError('')
                setCharacterLoadAttempt((attempt) => attempt + 1)
              }}>Retry loading characters</button>
            </div>
          )}
          <select id="quote-character" name="characterId" value={fields.characterId} onChange={updateField}
            disabled={loadingCharacters || Boolean(characterError)}>
            <option value="">No character / narration</option>
            {fields.characterId && !characters.some((item) => String(item.id) === fields.characterId) && (
              <option value={fields.characterId}>{quote?.character ? characterLabel(quote.character) : 'Selected character'} (unavailable)</option>
            )}
            {characters.map((character) => <option key={character.id} value={character.id}>{characterLabel(character)}</option>)}
          </select>
          <div className="add-author-actions">
            <button ref={addCharacterButtonRef} type="button" disabled={loadingCharacters}
              aria-haspopup="dialog" onClick={() => { setCharacterAdded(false); setShowAddCharacter(true) }}>
              Add new character
            </button>
          </div>
          {characterAdded && <p role="status">Character added and selected.</p>}

          <label htmlFor="quote-date" title="The date the quote was written, published, or spoken, if known.">Date</label>
          <input id="quote-date" name="date" type="date" value={fields.date} onChange={updateField} />
          <label htmlFor="quote-location" title="Where to find the quote in its source, such as a chapter, act, or page.">Location</label>
          <input id="quote-location" name="location" value={fields.location} onChange={updateField} maxLength={255} />
          <label htmlFor="quote-primary-reference" title="A source citation or URL supporting the quote.">Primary reference</label>
          <div className="quote-reference-field">
            <input id="quote-primary-reference" name="primaryReference" value={fields.primaryReference} onChange={updateField} maxLength={255} />
            <ExternalLink url={fields.primaryReference} />
          </div>
          <label htmlFor="quote-secondary-reference" title="An additional source citation or URL corroborating the quote.">Secondary reference</label>
          <div className="quote-reference-field">
            <input id="quote-secondary-reference" name="secondaryReference" value={fields.secondaryReference} onChange={updateField} maxLength={255} />
            <ExternalLink url={fields.secondaryReference} />
          </div>
          {loadingCategories && <p role="status">Loading categories...</p>}
          {categoryError && (
            <div className="add-quote-error" role="alert">
              <p>{categoryError} Your draft has been kept.</p>
              <button
                type="button"
                onClick={() => {
                  setLoadingCategories(true)
                  setCategoryError('')
                  setCategoryLoadAttempt((attempt) => attempt + 1)
                }}
              >Retry loading categories</button>
            </div>
          )}
          {!loadingCategories && !categoryError && catalog && (
            <QuoteCategoryFields
              catalog={catalog}
              selections={selections}
              onChange={(field, ids) => setSelections((current) => ({ ...current, [field]: ids }))}
            />
          )}
        </fieldset>
        {saveError && <p className="add-quote-error" role="alert">{saveError}</p>}
        <div className="add-quote-actions">
          {review
            ? reviewActions()
            : <>
              <button type="button" className="add-quote-cancel" disabled={saving} onClick={() => dialogRef.current.close()}>Cancel</button>
              <button type="submit" className="add-quote-submit" disabled={saveDisabled}>{saveLabel}</button>
            </>}
        </div>
        {saving && <p role="status">Saving quote...</p>}
      </form>
      </div>
    </dialog>
    {showAddAuthor && (
      <AddAuthorDialog
        onClose={closeAddAuthor}
        onCreated={(author) => {
          setAuthors((current) => [...current, author])
          setFields((current) => ({ ...current, authorId: String(author.id) }))
          setSaveError('')
          setAuthorAdded(true)
          closeAddAuthor()
          onAuthorCreated?.(author)
        }}
      />
    )}
    {showAddCharacter && (
      <AddCharacterDialog onClose={closeAddCharacter} onCreated={(character) => {
        setCharacters((current) => [...current, character])
        setFields((current) => ({...current, characterId: String(character.id)}))
        setSaveError('')
        setCharacterAdded(true)
        closeAddCharacter()
        onCharacterCreated?.(character)
      }} />
    )}
    </>
  )
}
