import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import {characterFields} from '../characterFields'
import AddCharacterDialog from './AddCharacterDialog'
import DialogHeader from './DialogHeader'
import '../styles/AddQuoteDialog.css'
import '../styles/AboutAuthorDialog.css'

export default function AboutCharacterDialog({characterId, isAuthenticated, onClose, onUpdated}) {
  const dialogRef = useRef(null)
  const editButtonRef = useRef(null)
  const [character, setCharacter] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => { dialogRef.current.showModal() }, [])

  useEffect(() => {
    let active = true
    async function load() {
      try {
        setError('')
        setCharacter(null)
        const data = await api.characters.get(characterId)
        if (!active) return
        if (data?.id !== characterId || !data.fullName) throw new Error('Invalid character response')
        setCharacter(data)
      } catch (err) {
        if (active) setError(`Unable to load character: ${err.message}`)
      }
    }
    load()
    return () => { active = false }
  }, [characterId, attempt])

  function closeEditor() {
    setEditing(false)
    editButtonRef.current?.focus()
  }

  return (
    <>
      <dialog ref={dialogRef} className="add-quote-dialog" aria-labelledby="about-character-title"
        onClose={onClose} onCancel={(event) => {
          event.preventDefault()
          if (!editing || !isAuthenticated) dialogRef.current.close()
        }}>
        <DialogHeader titleId="about-character-title" title="About this Character"
          closeLabel="Close character details" autoFocus disabled={editing && isAuthenticated}
          onClose={() => dialogRef.current.close()}>
          {character && isAuthenticated && (
            <button ref={editButtonRef} type="button" className="about-author-edit"
              aria-label="Edit character" aria-haspopup="dialog"
              onClick={() => { setMessage(''); setEditing(true) }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z" />
              </svg>
              Edit
            </button>
          )}
        </DialogHeader>
        <div className="dialog-body">
          {error ? (
            <div className="add-quote-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => { setError(''); setAttempt((value) => value + 1) }}>Retry character details</button>
            </div>
          ) : !character ? <p role="status">Loading character details...</p> : (
            <dl className="about-author-details">
              {characterFields.map(({name, label}) => (
                <div key={name}><dt>{label}</dt><dd>{character[name] || 'Not provided'}</dd></div>
              ))}
            </dl>
          )}
          {message && <p role="status">{message}</p>}
        </div>
      </dialog>
      {editing && isAuthenticated && (
        <AddCharacterDialog character={character} onClose={closeEditor} onUpdated={(updated) => {
          setCharacter(updated)
          closeEditor()
          setMessage('Character updated.')
          onUpdated?.(updated)
        }} />
      )}
    </>
  )
}
