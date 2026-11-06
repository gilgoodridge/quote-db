import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import {authorFields} from '../authorFields'
import AddAuthorDialog from './AddAuthorDialog'
import '../styles/AboutAuthorDialog.css'

function formatAuthorDate(value) {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC',
  })
}

export default function AboutAuthorDialog({authorId, isAuthenticated, onClose, onUpdated}) {
  const dialogRef = useRef(null)
  const editButtonRef = useRef(null)
  const [author, setAuthor] = useState(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  useEffect(() => {
    let active = true
    async function loadAuthor() {
      try {
        setError('')
        const data = await api.authors.get(authorId)
        if (!active) return
        if (data?.id !== authorId || !data.fullName) {
          throw new Error('The authors endpoint returned an invalid author')
        }
        setAuthor(data)
      } catch (err) {
        if (active) setError(`Unable to load author: ${err.message}`)
      }
    }
    loadAuthor()
    return () => { active = false }
  }, [authorId, attempt])

  function closeEditor() {
    setEditing(false)
    editButtonRef.current?.focus()
  }

  return (
    <>
    <dialog
      ref={dialogRef}
      className="add-quote-dialog about-author-dialog"
      aria-labelledby="about-author-title"
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault()
        if (!editing || !isAuthenticated) dialogRef.current.close()
      }}
    >
      <div className="about-author-header">
        <h2 id="about-author-title">About this Author</h2>
        {author && isAuthenticated && (
          <button
            ref={editButtonRef}
            type="button"
            className="about-author-edit"
            aria-label="Edit author"
            title="Edit author"
            aria-haspopup="dialog"
            onClick={() => {
              setMessage('')
              setEditing(true)
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m16 3 5 5M3 21l5-1L21 7a2 2 0 0 0-5-5L3 15z" />
            </svg>
          </button>
        )}
      </div>
      {error ? (
        <div className="add-quote-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => {
            setError('')
            setAttempt((value) => value + 1)
          }}>Retry author details</button>
        </div>
      ) : !author ? <p role="status">Loading author details...</p> : (
        <dl className="about-author-details">
          {authorFields.map(({name, label, type}) => (
            <div key={name}>
              <dt>{label}</dt>
              <dd>{author[name]
                ? type === 'date' ? formatAuthorDate(author[name]) : author[name]
                : 'Not provided'}</dd>
            </div>
          ))}
          {author.age != null && (
            <div>
              <dt>{author.dateOfDeath ? 'Age at death' : 'Age'}</dt>
              <dd>{author.age}</dd>
            </div>
          )}
        </dl>
      )}
      {message && <p role="status">{message}</p>}
      <div className="add-quote-actions">
        <button type="button" className="add-quote-cancel" autoFocus onClick={() => dialogRef.current.close()}>
          Close
        </button>
      </div>
    </dialog>
      {editing && isAuthenticated && (
        <AddAuthorDialog
          author={author}
          onClose={closeEditor}
          onUpdated={(updated) => {
            setAuthor(updated)
            setEditing(false)
            setMessage('Author updated.')
            editButtonRef.current?.focus()
            onUpdated(updated)
          }}
        />
      )}
    </>
  )
}
