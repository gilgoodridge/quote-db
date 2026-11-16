import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import {authorFields} from '../authorFields'
import DialogHeader from './DialogHeader'
import '../styles/AddQuoteDialog.css'

export default function AddAuthorDialog({ author = null, onClose, onCreated, onUpdated, initialValues, onSave, onSnooze, onReject, reviewing = false, publishedAuthor = null }) {
  const dialogRef = useRef(null)
  const submittingRef = useRef(false)
  const [fields, setFields] = useState(() => Object.fromEntries(authorFields.map(({ name }) => [name, author?.[name] ?? initialValues?.[name] ?? ''])))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [retryRequest, setRetryRequest] = useState(null)

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
    if (submittingRef.current) return
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
      <form onSubmit={submit} aria-busy={saving}>
        <fieldset disabled={saving || Boolean(publishedAuthor) || Boolean(retryRequest)}>
          {authorFields.map(({ name, label, required, type, multiline, description }, index) => {
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
                <label htmlFor={props.id} title={description}>{label}{required ? ' *' : ''}</label>
                {multiline
                  ? <textarea {...props} rows={4} maxLength={1024} />
                  : <input {...props} type={type || 'text'} maxLength={type === 'date' ? undefined : 255} />}
              </div>
            )
          })}
        </fieldset>
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
              <button type="button" disabled={saving || Boolean(retryRequest)} onClick={() => performReviewAction(onSnooze, 'snooze quotes')}>Snooze quotes</button>
              <button type="button" disabled={saving || Boolean(retryRequest)} onClick={() => performReviewAction(onReject, 'reject author and quotes')}>Reject author and quotes</button>
            </>
          )}
          <button type="submit" className="add-quote-submit" disabled={saving || Boolean(retryRequest) && Boolean(publishedAuthor)}>
            {saving ? 'Saving...' : publishedAuthor ? 'Retry author approval' : retryRequest ? 'Retry author promotion' : 'Save author'}
          </button>
        </div>
        {saving && <p role="status">Saving author...</p>}
      </form>
      </div>
    </dialog>
  )
}
