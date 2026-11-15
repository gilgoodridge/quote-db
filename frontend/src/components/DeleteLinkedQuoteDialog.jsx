import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import DialogHeader from './DialogHeader'

export default function DeleteLinkedQuoteDialog({quote, onClose, onDeleted}) {
  const dialogRef = useRef(null)
  const savingRef = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  async function remove(candidateStatus) {
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setError('')
    try {
      await api.quotes.delete(quote.id, {candidateStatus})
      onDeleted(quote)
    } catch (failure) {
      setError(`Unable to delete quote: ${failure.message}`)
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="delete-linked-quote-dialog"
      aria-labelledby="delete-linked-quote-title"
      aria-describedby="delete-linked-quote-description"
      aria-busy={saving}
      onClose={onClose}
      onCancel={(event) => {
        if (savingRef.current) event.preventDefault()
      }}
    >
      <DialogHeader
        titleId="delete-linked-quote-title"
        title="Quote linked to candidates"
        closeLabel="Cancel quote deletion"
        onClose={() => dialogRef.current.close()}
        disabled={saving}
        autoFocus
      />
      <div className="dialog-body">
        <p id="delete-linked-quote-description">
          This quote is linked to candidate review data. Choose what happens to all linked candidate quotes
          before deleting the published quote. Their publication links will be cleared; candidate text,
          source information and authors will be kept. If deletion fails, no changes are saved.
        </p>
        <blockquote>{quote.text}</blockquote>
        {error && <p className="quote-action-error" role="alert">{error}</p>}
        {saving && <p role="status">Updating candidates and deleting quote...</p>}
        <div className="delete-linked-quote-actions">
          <button type="button" disabled={saving} onClick={() => remove('REJECTED')}>
            Reject candidates and delete quote
          </button>
          <button type="button" disabled={saving} onClick={() => remove('PENDING')}>
            Return candidates to Pending and delete quote
          </button>
          <button type="button" disabled={saving} onClick={() => dialogRef.current.close()}>
            Cancel
          </button>
        </div>
      </div>
    </dialog>
  )
}
