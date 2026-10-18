import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import '../styles/AddQuoteDialog.css'

const authorFields = [
  { name: 'givenName', label: 'Given name', required: true },
  { name: 'familyName', label: 'Family name', required: true },
  { name: 'preferredName', label: 'Preferred name' },
  { name: 'pseudonym', label: 'Pseudonym' },
  { name: 'dateOfBirth', label: 'Date of birth', type: 'date' },
  { name: 'dateOfDeath', label: 'Date of death', type: 'date' },
  { name: 'placeOfBirth', label: 'Place of birth' },
  { name: 'nationality', label: 'Nationality' },
  { name: 'bio', label: 'Biography', multiline: true },
]

export default function AddAuthorDialog({ onClose, onCreated }) {
  const dialogRef = useRef(null)
  const submittingRef = useRef(false)
  const [fields, setFields] = useState(() => Object.fromEntries(authorFields.map(({ name }) => [name, ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    dialogRef.current.showModal()
    // Disabled fields can move focus outside the dialog while saving.
    function handleEscape(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (!submittingRef.current) dialogRef.current.close()
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => document.removeEventListener('keydown', handleEscape, true)
  }, [])

  async function submit(event) {
    event.preventDefault()
    if (submittingRef.current) return
    if (!fields.givenName.trim() || !fields.familyName.trim()) {
      setError('Enter both a given name and a family name, not just whitespace.')
      return
    }
    submittingRef.current = true
    setSaving(true)
    setError('')
    let author
    try {
      author = await api.authors.create(Object.fromEntries(
        authorFields.map(({ name }) => [name, fields[name].trim() || null]),
      ))
    } catch (saveError) {
      setError(`Unable to add author: ${saveError.message}`)
      return
    } finally {
      submittingRef.current = false
      setSaving(false)
    }
    dialogRef.current.close()
    onCreated(author)
  }

  return (
    <dialog
      ref={dialogRef}
      className="add-quote-dialog add-author-dialog"
      aria-labelledby="add-author-title"
      aria-describedby="add-author-description"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        if (!submittingRef.current) dialogRef.current.close()
      }}
    >
      <h2 id="add-author-title">New author</h2>
      <p id="add-author-description" className="add-quote-description">
        Given name and family name are required. Saving creates the author immediately, even if you later cancel the quote.
      </p>
      <form onSubmit={submit} aria-busy={saving}>
        <fieldset disabled={saving}>
          {authorFields.map(({ name, label, required, type, multiline }, index) => {
            const props = {
              id: `author-${name}`,
              name,
              value: fields[name],
              required,
              autoFocus: index === 0,
              onChange: (event) => {
                const { value } = event.target
                setFields((current) => ({ ...current, [name]: value }))
              },
            }
            return (
              <div className="author-form-field" key={name}>
                <label htmlFor={props.id}>{label}{required ? ' (required)' : ''}</label>
                {multiline
                  ? <textarea {...props} rows={4} maxLength={1024} />
                  : <input {...props} type={type || 'text'} maxLength={type === 'date' ? undefined : 255} />}
              </div>
            )
          })}
        </fieldset>
        {error && <p className="add-quote-error" role="alert">{error}</p>}
        <div className="add-quote-actions">
          <button type="button" className="add-quote-cancel" disabled={saving} onClick={() => dialogRef.current.close()}>Cancel</button>
          <button type="submit" className="add-quote-submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save author'}
          </button>
        </div>
        {saving && <p role="status">Saving author...</p>}
      </form>
    </dialog>
  )
}
