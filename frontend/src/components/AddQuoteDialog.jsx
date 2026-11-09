import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import AddAuthorDialog from './AddAuthorDialog'
import QuoteCategoryFields from './QuoteCategoryFields'
import DialogHeader from './DialogHeader'
import {categoryDimensions, categorySelections} from '../quoteCategories'
import '../styles/AddQuoteDialog.css'

export default function AddQuoteDialog({ onClose, onCreated, onUpdated, onAuthorCreated, initialAuthorId, quote }) {
  const dialogRef = useRef(null)
  const addAuthorButtonRef = useRef(null)
  const submittingRef = useRef(false)
  const [authors, setAuthors] = useState([])
  const [loadingAuthors, setLoadingAuthors] = useState(true)
  const [authorError, setAuthorError] = useState('')
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [showAddAuthor, setShowAddAuthor] = useState(false)
  const [authorAdded, setAuthorAdded] = useState(false)
  const [catalog, setCatalog] = useState(null)
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [categoryError, setCategoryError] = useState('')
  const [categoryLoadAttempt, setCategoryLoadAttempt] = useState(0)
  const [selections, setSelections] = useState(() => categorySelections(quote))
  const [fields, setFields] = useState({
    text: quote?.text ?? '',
    authorId: String(quote?.author.id ?? initialAuthorId ?? ''),
    date: quote?.date ?? '',
    location: quote?.location ?? '',
    reference: quote?.reference ?? '',
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
    submittingRef.current = true
    setSaving(true)
    setSaveError('')
    let savedQuote
    try {
      const request = {
        text: fields.text,
        authorId: author.id,
        date: fields.date || null,
        location: fields.location || null,
        reference: fields.reference || null,
        ...selections,
      }
      savedQuote = quote
        ? await api.quotes.update(quote.id, request)
        : await api.quotes.create(request)
    } catch (error) {
      setSaveError(`Unable to ${quote ? 'update' : 'add'} quote: ${error.message}`)
      return
    } finally {
      submittingRef.current = false
      setSaving(false)
    }
    if (quote) onUpdated(savedQuote)
    else onCreated(savedQuote)
  }

  function closeAddAuthor() {
    setShowAddAuthor(false)
    addAuthorButtonRef.current?.focus()
  }

  return (
    <>
    <dialog
      ref={dialogRef}
      className="add-quote-dialog"
      aria-labelledby="add-quote-title"
      onClose={onClose}
      onCancel={(event) => {
        if (submittingRef.current || showAddAuthor) event.preventDefault()
      }}
    >
      <DialogHeader
        titleId="add-quote-title"
        title={quote ? 'Edit Quote' : 'Add Quote'}
        closeLabel="Close quote form"
        disabled={saving || showAddAuthor}
        onClose={() => {
          if (!submittingRef.current && !showAddAuthor) dialogRef.current.close()
        }}
      />
      <div className="dialog-body">
      <p className="add-quote-description">Quote text and author are required. Other fields are optional.</p>
      <form onSubmit={submit} aria-busy={saving}>
        <fieldset disabled={saving}>
          <label htmlFor="quote-text">Quote text (required)</label>
          <textarea id="quote-text" name="text" value={fields.text} onChange={updateField} required maxLength={2048} rows={5} autoFocus />

          <label htmlFor="quote-author">Author (required)</label>
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

          <label htmlFor="quote-date">Date</label>
          <input id="quote-date" name="date" type="date" value={fields.date} onChange={updateField} />
          <label htmlFor="quote-location">Location</label>
          <input id="quote-location" name="location" value={fields.location} onChange={updateField} maxLength={255} />
          <label htmlFor="quote-reference">Reference</label>
          <input id="quote-reference" name="reference" value={fields.reference} onChange={updateField} maxLength={255} />
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
          <button type="button" className="add-quote-cancel" disabled={saving} onClick={() => dialogRef.current.close()}>Cancel</button>
          <button type="submit" className="add-quote-submit" disabled={saving || loadingAuthors || Boolean(authorError) || authors.length === 0 || loadingCategories || Boolean(categoryError)}>
            {saving ? 'Saving...' : 'Save quote'}
          </button>
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
          onAuthorCreated(author)
        }}
      />
    )}
    </>
  )
}
