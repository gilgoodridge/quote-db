import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import {authorFields} from '../authorFields'
import DialogHeader from './DialogHeader'
import '../styles/AddQuoteDialog.css'

const authorLookups = {
  dateOfBirth: {type: 'AUTHOR_DATE_OF_BIRTH', label: 'birth date', date: true, maxLength: 10},
  dateOfDeath: {type: 'AUTHOR_DATE_OF_DEATH', label: 'death date', date: true, maxLength: 10},
  placeOfBirth: {type: 'AUTHOR_PLACE_OF_BIRTH', label: 'place of birth', maxLength: 255},
  bio: {type: 'AUTHOR_BIOGRAPHY', label: 'biography', maxLength: 1024},
}

export default function AddAuthorDialog({ author = null, onClose, onCreated, onUpdated, initialValues, onSave, onSnooze, onReject, reviewing = false, publishedAuthor = null }) {
  const dialogRef = useRef(null)
  const submittingRef = useRef(false)
  const lookupRef = useRef(false)
  const activeRef = useRef(true)
  const [fields, setFields] = useState(() => Object.fromEntries(authorFields.map(({ name }) => [name, author?.[name] ?? initialValues?.[name] ?? ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [retryRequest, setRetryRequest] = useState(null)
  const [lookingUp, setLookingUp] = useState(null)
  const [lookupMessage, setLookupMessage] = useState('')
  const [lookupError, setLookupError] = useState('')

  useEffect(() => {
    activeRef.current = true
    dialogRef.current.showModal()
    // Disabled fields can move focus outside the dialog while saving.
    function handleEscape(event) {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      if (!submittingRef.current) dialogRef.current.close()
    }
    document.addEventListener('keydown', handleEscape, true)
    return () => {
      activeRef.current = false
      document.removeEventListener('keydown', handleEscape, true)
    }
  }, [])

  async function lookupField(name) {
    if (lookupRef.current || submittingRef.current || publishedAuthor || retryRequest) return
    const fullName = fields.fullName.trim()
    if (!fullName) return
    lookupRef.current = true
    const lookup = authorLookups[name]
    setLookingUp(name)
    setLookupMessage('')
    setLookupError('')
    try {
      const result = await api.ai.lookup(lookup.type, {fullName})
      if (!activeRef.current) return
      if (result?.status === 'FOUND' && typeof result.value === 'string'
        && result.value.trim() && result.value.length <= lookup.maxLength
        && (!lookup.date || /^\d{4}-\d{2}-\d{2}$/.test(result.value))) {
        setFields((current) => ({...current, [name]: result.value}))
        setLookupMessage(`Gemini suggested this ${lookup.date ? 'date' : lookup.label}. Verify it before saving; AI confidence is not a guarantee.`)
      } else if (result?.status === 'UNKNOWN') {
        setLookupMessage(`Gemini wasn't sure of the ${lookup.date ? 'exact ' : ''}${lookup.label}. The existing ${lookup.date ? 'date' : 'value'} was not changed.`)
      } else {
        throw new Error(`The lookup returned an invalid ${lookup.label} response.`)
      }
    } catch (lookupFailure) {
      if (activeRef.current) setLookupError(`Unable to look up ${lookup.label}: ${lookupFailure.message}`)
    } finally {
      lookupRef.current = false
      if (activeRef.current) setLookingUp(null)
    }
  }

  async function submit(event) {
    event.preventDefault()
    if (submittingRef.current || lookupRef.current) return
    if (!fields.fullName.trim()) {
      setError('Enter a full name, not just whitespace.')
      return
    }
    submittingRef.current = true
    setSaving(true)
    setError('')
    const request = retryRequest ?? Object.fromEntries(
      authorFields.map(({ name }) => [name, fields[name].trim() || null]),
    )
    let savedAuthor
    try {
      savedAuthor = onSave ? await onSave(request) : author
        ? await api.authors.update(author.id, request)
        : await api.authors.create(request)
    } catch (saveError) {
      if (onSave && (!saveError.status || saveError.status >= 500)) setRetryRequest(request)
      setError(!onSave && saveError.status === 409
        ? 'The author already exists'
        : `Unable to ${author ? 'update' : 'add'} author: ${saveError.message}`)
      return
    } finally {
      submittingRef.current = false
      setSaving(false)
    }
    dialogRef.current.close()
    if (author) onUpdated(savedAuthor)
    else onCreated(savedAuthor)
  }

  async function performReviewAction(action, label) {
    if (submittingRef.current || lookupRef.current) return
    submittingRef.current = true
    setSaving(true)
    setError('')
    try {
      await action()
    } catch (actionError) {
      setError(`Unable to ${label}: ${actionError.message}`)
    } finally {
      submittingRef.current = false
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="add-quote-dialog add-author-dialog"
      aria-labelledby="add-author-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        if (!submittingRef.current) dialogRef.current.close()
      }}
    >
      <DialogHeader
        titleId="add-author-title"
        title={reviewing ? 'Review author' : author ? 'Edit author' : 'New author'}
        closeLabel="Close author form"
        disabled={saving}
        onClose={() => {
          if (!submittingRef.current) dialogRef.current.close()
        }}
      />
      <div className="dialog-body">
      {publishedAuthor && <p role="status">Author saved. Retry approval to link the candidate without creating another author.</p>}
      {retryRequest && !publishedAuthor && <p role="status">Retry sends the same author details to safely confirm promotion.</p>}
      <form onSubmit={submit} aria-busy={saving || Boolean(lookingUp)}>
        <fieldset disabled={saving || Boolean(lookingUp) || Boolean(publishedAuthor) || Boolean(retryRequest)}>
          {authorFields.map(({ name, label, required, type, multiline, description }, index) => {
            const props = {
              id: `author-${name}`,
              name,
              value: fields[name],
              required,
              autoFocus: index === 0,
              onChange: (event) => {
                const { value } = event.target
                if (name === 'fullName' || authorLookups[name]) {
                  setLookupMessage('')
                  setLookupError('')
                }
                setFields((current) => ({ ...current, [name]: value }))
              },
            }
            return (
              <div className="author-form-field" key={name}>
                <label htmlFor={props.id} title={description}>{label}{required ? ' *' : ''}</label>
                {authorLookups[name] ? (
                  <div className={`author-lookup-controls${multiline ? ' author-lookup-multiline' : ''}`}>
                    {multiline
                      ? <textarea {...props} rows={4} maxLength={1024} />
                      : <input {...props} type={type || 'text'} maxLength={type === 'date' ? undefined : 255} />}
                    <button type="button" disabled={!fields.fullName.trim() || Boolean(lookingUp)}
                      aria-label={`Look up ${authorLookups[name].label} with AI`}
                      title={`Send the full name to Gemini for an AI suggestion. Verify the ${authorLookups[name].label} before saving.`}
                      onClick={() => lookupField(name)}>
                      {lookingUp === name ? 'Looking up...' : 'Look up with AI'}
                    </button>
                  </div>
                ) : multiline
                  ? <textarea {...props} rows={4} maxLength={1024} />
                  : <input {...props} type={type || 'text'} maxLength={type === 'date' ? undefined : 255} />}
              </div>
            )
          })}
        </fieldset>
        {lookingUp && <p role="status">Asking Gemini for the {authorLookups[lookingUp].date ? 'exact ' : ''}{authorLookups[lookingUp].label}...</p>}
        {lookupMessage && <p role="status">{lookupMessage}</p>}
        {lookupError && <p className="add-quote-error add-author-error" role="alert">{lookupError}</p>}
        {error && (
          <p className="add-quote-error add-author-error" role="alert">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 7v6m0 3v1" />
            </svg>
            <span>{error}</span>
          </p>
        )}
        <div className="add-quote-actions">
          {!reviewing && <button type="button" className="add-quote-cancel" disabled={saving} onClick={() => dialogRef.current.close()}>Cancel</button>}
          {reviewing && !publishedAuthor && (
            <>
              <button type="button" disabled={saving || Boolean(lookingUp) || Boolean(retryRequest)} onClick={() => performReviewAction(onSnooze, 'snooze quotes')}>Snooze quotes</button>
              <button type="button" disabled={saving || Boolean(lookingUp) || Boolean(retryRequest)} onClick={() => performReviewAction(onReject, 'reject author and quotes')}>Reject author and quotes</button>
            </>
          )}
          <button type="submit" className="add-quote-submit" disabled={saving || Boolean(lookingUp) || Boolean(retryRequest) && Boolean(publishedAuthor)}>
            {saving ? 'Saving...' : publishedAuthor ? 'Retry author approval' : retryRequest ? 'Retry author promotion' : 'Save author'}
          </button>
        </div>
        {saving && <p role="status">Saving author...</p>}
      </form>
      </div>
    </dialog>
  )
}
