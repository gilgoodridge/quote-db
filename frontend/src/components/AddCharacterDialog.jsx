import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import {characterFields} from '../characterFields'
import DialogHeader from './DialogHeader'
import '../styles/AddQuoteDialog.css'

export default function AddCharacterDialog({character = null, onClose, onCreated, onUpdated}) {
  const dialogRef = useRef(null)
  const submittingRef = useRef(false)
  const [fields, setFields] = useState(() => Object.fromEntries(
    characterFields.map(({name}) => [name, character?.[name] ?? '']),
  ))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    dialogRef.current.showModal()
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
    let saved
    try {
      const payload = Object.fromEntries(characterFields.map(({name}) => [name, fields[name].trim() || null]))
      saved = character
        ? await api.characters.update(character.id, payload)
        : await api.characters.create(payload)
    } catch (err) {
      setError(`Unable to ${character ? 'update' : 'add'} character: ${err.message}`)
      return
    } finally {
      submittingRef.current = false
      setSaving(false)
    }
    dialogRef.current.close()
    if (character) onUpdated(saved)
    else onCreated(saved)
  }

  return (
    <dialog ref={dialogRef} className="add-quote-dialog" aria-labelledby="character-form-title"
      aria-describedby="character-form-description" onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        if (!submittingRef.current) dialogRef.current.close()
      }}>
      <DialogHeader titleId="character-form-title" title={character ? 'Edit character' : 'New character'}
        closeLabel="Close character form" disabled={saving}
        onClose={() => { if (!submittingRef.current) dialogRef.current.close() }} />
      <div className="dialog-body">
        <p id="character-form-description" className="add-quote-description">
          A character is a fictional speaker, not the author. Full name is required.
          {character
            ? ' Saving replaces all details; clearing optional fields removes them.'
            : ' Saving creates the character immediately, even if you later cancel the quote.'}
        </p>
        <form onSubmit={submit} aria-busy={saving}>
          <fieldset disabled={saving}>
            {characterFields.map(({name, label, required, multiline}, index) => {
              const props = {
                id: `character-${name}`, name, value: fields[name], required, autoFocus: index === 0,
                onChange: (event) => setFields((current) => ({...current, [name]: event.target.value})),
              }
              return (
                <div className="author-form-field" key={name}>
                  <label htmlFor={props.id}>{label}{required ? ' (required)' : ''}</label>
                  {multiline
                    ? <textarea {...props} rows={4} maxLength={1024} />
                    : <input {...props} maxLength={255} />}
                </div>
              )
            })}
          </fieldset>
          {error && <p className="add-quote-error" role="alert">{error}</p>}
          <div className="add-quote-actions">
            <button type="button" className="add-quote-cancel" disabled={saving} onClick={() => dialogRef.current.close()}>Cancel</button>
            <button type="submit" className="add-quote-submit" disabled={saving}>{saving ? 'Saving...' : 'Save character'}</button>
          </div>
          {saving && <p role="status">Saving character...</p>}
        </form>
      </div>
    </dialog>
  )
}
