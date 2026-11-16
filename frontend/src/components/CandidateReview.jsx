import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import AddAuthorDialog from './AddAuthorDialog'
import AddQuoteDialog from './AddQuoteDialog'
import AboutAuthorDialog from './AboutAuthorDialog'
import DialogHeader from './DialogHeader'
import '../styles/CandidateReview.css'

function normalizeName(name) {
  return name?.trim().toLocaleLowerCase()
}

function ExistingAuthorDialog({candidateName, authors, status, error, onRetry, onClose, onUse, onCreate, onView, onSnooze, onReject, linkingAuthorId, linkError}) {
  const dialogRef = useRef(null)
  const creatingNewAuthorRef = useRef(false)
  const [decision, setDecision] = useState('')
  const [decisionError, setDecisionError] = useState('')

  useEffect(() => {
    dialogRef.current.showModal()
  }, [])

  function createNewAuthor() {
    creatingNewAuthorRef.current = true
    dialogRef.current.close()
    onCreate()
  }

  async function decide(action, label) {
    if (decision || linkingAuthorId != null) return
    setDecision(label)
    setDecisionError('')
    try {
      await action()
    } catch (failure) {
      setDecisionError(`Unable to ${label.toLowerCase()}: ${failure.message}`)
    } finally {
      setDecision('')
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="add-quote-dialog candidate-author-duplicates"
      aria-labelledby="candidate-author-lookup-title"
      onClose={() => {
        if (!creatingNewAuthorRef.current) onClose()
      }}
      onCancel={(event) => {
        event.preventDefault()
        if (linkingAuthorId == null && !decision) dialogRef.current.close()
      }}
    >
      <DialogHeader
        titleId="candidate-author-lookup-title"
        title={status === 'loading'
          ? 'Checking existing authors'
          : status === 'error' ? 'Unable to search authors' : 'Existing author found'}
        closeLabel="Close author lookup"
        disabled={linkingAuthorId != null || Boolean(decision)}
        onClose={() => {
          if (linkingAuthorId == null && !decision) dialogRef.current.close()
        }}
        autoFocus
      />
      <div className="dialog-body">
        {status === 'loading' && <p role="status">Searching existing authors for "{candidateName}"...</p>}
        {status === 'error' && (
          <div className="add-quote-error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={onRetry}>Retry author search</button>
          </div>
        )}
        {status === 'duplicates' && (
          <>
            <p>This author already exists. Would you like to use the existing author?</p>
            <ul className="candidate-author-match-list">
              {authors.map((author) => (
                <li key={author.id}>
                  <span>{author.fullName}{author.knownAs ? ` (${author.knownAs})` : ''}</span>
                  <div>
                    <button type="button" onClick={() => onView(author.id)} disabled={linkingAuthorId != null}>
                      View author details
                    </button>
                    <button type="button" onClick={() => onUse(author)} disabled={linkingAuthorId != null}>
                      {linkingAuthorId === author.id ? 'Linking...' : 'Use this author'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {linkError && <p className="add-quote-error" role="alert">{linkError}</p>}
            <div className="add-quote-actions">
              <button type="button" onClick={createNewAuthor} disabled={linkingAuthorId != null || Boolean(decision)}>Create a new author</button>
            </div>
          </>
        )}
        {decisionError && <p className="add-quote-error" role="alert">{decisionError}</p>}
        <div className="add-quote-actions">
          <button type="button" disabled={linkingAuthorId != null || Boolean(decision)}
            onClick={() => decide(onSnooze, 'Snooze quotes')}>
            {decision === 'Snooze quotes' ? 'Snoozing quotes...' : 'Snooze quotes'}
          </button>
          <button type="button" disabled={linkingAuthorId != null || Boolean(decision)}
            onClick={() => decide(onReject, 'Reject author and quotes')}>
            {decision === 'Reject author and quotes' ? 'Rejecting author and quotes...' : 'Reject author and quotes'}
          </button>
        </div>
      </div>
    </dialog>
  )
}

function ReviewDialog({candidate, candidateAuthor, progress, onClose, onCompleted, onCountsChanged, onAuthorCreated, onQuoteCreated, onCharacterCreated}) {
  const [publishedAuthor, setPublishedAuthor] = useState(progress.authors.get(candidateAuthor.id) ?? null)
  const [publishedQuote, setPublishedQuote] = useState(progress.quotes.get(candidate.id) ?? null)
  const authorApproved = candidateAuthor.status === 'APPROVED' && candidateAuthor.publishedAuthorId != null
  const [reviewAuthor, setReviewAuthor] = useState(!authorApproved && !publishedQuote)
  const [authorId, setAuthorId] = useState(publishedQuote?.author.id ?? (authorApproved ? candidateAuthor.publishedAuthorId : null))
  const [authorLookupAttempt, setAuthorLookupAttempt] = useState(0)
  const [authorLookup, setAuthorLookup] = useState({status: 'loading', authors: [], error: ''})
  const [linkingAuthorId, setLinkingAuthorId] = useState(null)
  const [linkError, setLinkError] = useState('')
  const [viewedAuthorId, setViewedAuthorId] = useState(null)

  async function snoozeAuthor() {
    await api.candidateAuthors.snoozeQuotes(candidateAuthor.id)
    onCompleted('Candidate author quotes snoozed.', 'PENDING')
  }

  async function rejectAuthor() {
    await api.candidateAuthors.reject(candidateAuthor.id)
    onCompleted('Candidate author and quotes rejected.', 'PENDING')
  }

  useEffect(() => {
    if (!reviewAuthor || publishedAuthor) return
    let active = true
    api.authors.list(candidateAuthor.fullName).then((authors) => {
      if (!active) return
      const candidateName = normalizeName(candidateAuthor.fullName)
      const matches = authors.filter((author) =>
        normalizeName(author.fullName) === candidateName || normalizeName(author.knownAs) === candidateName)
      setAuthorLookup({status: matches.length ? 'duplicates' : 'none', authors: matches, error: ''})
    }).catch((failure) => {
      if (active) setAuthorLookup({status: 'error', authors: [], error: `Unable to search existing authors: ${failure.message}`})
    })
    return () => { active = false }
  }, [candidateAuthor.fullName, authorLookupAttempt, publishedAuthor, reviewAuthor])

  async function useExistingAuthor(author) {
    if (linkingAuthorId != null) return
    setLinkingAuthorId(author.id)
    setLinkError('')
    try {
      const result = await api.candidateAuthors.link(candidateAuthor.id, author.id)
      progress.authors.set(candidateAuthor.id, result.author)
      setPublishedAuthor(result.author)
      setAuthorId(result.author.id)
      setReviewAuthor(false)
      onCountsChanged()
    } catch (failure) {
      setLinkError(`Unable to link existing author: ${failure.message}`)
    } finally {
      setLinkingAuthorId(null)
    }
  }

  async function saveAuthor(request) {
    const result = await api.candidateAuthors.promote(candidateAuthor.id, request)
    const author = result.author
    progress.authors.set(candidateAuthor.id, author)
    setPublishedAuthor(author)
    onAuthorCreated?.(author)
    onCountsChanged()
    return author
  }

  async function approve(request) {
    const result = await api.candidateQuotes.promote(candidate.id, request)
    const quote = result.quote
    progress.quotes.set(candidate.id, quote)
    setPublishedQuote(quote)
    onQuoteCreated?.(quote)
    onCountsChanged()
    return quote
  }

  if (reviewAuthor) {
    if (authorLookup.status === 'none' || publishedAuthor) {
      return (
        <AddAuthorDialog reviewing
          initialValues={publishedAuthor ?? {fullName: candidateAuthor.fullName}}
          publishedAuthor={publishedAuthor}
          onSave={saveAuthor}
          onSnooze={snoozeAuthor}
          onReject={rejectAuthor}
          onClose={() => setReviewAuthor(false)}
          onCreated={(author) => {
            setAuthorId(author.id)
            setReviewAuthor(false)
          }}
        />
      )
    }
    return (
      <>
        <ExistingAuthorDialog
          candidateName={candidateAuthor.fullName}
          authors={authorLookup.authors}
          status={authorLookup.status}
          error={authorLookup.error}
          onRetry={() => {
            setAuthorLookup({status: 'loading', authors: [], error: ''})
            setAuthorLookupAttempt((attempt) => attempt + 1)
          }}
          onClose={() => setReviewAuthor(false)}
          onUse={useExistingAuthor}
          onSnooze={snoozeAuthor}
          onReject={rejectAuthor}
          onCreate={() => setAuthorLookup({status: 'none', authors: [], error: ''})}
          onView={setViewedAuthorId}
          linkingAuthorId={linkingAuthorId}
          linkError={linkError}
        />
        {viewedAuthorId != null && (
          <AboutAuthorDialog authorId={viewedAuthorId} isAuthenticated={false} onClose={() => setViewedAuthorId(null)} />
        )}
      </>
    )
  }

  return (
    <AddQuoteDialog
      initialAuthorId={authorId}
      initialValues={publishedQuote ?? {text: candidate.text, primaryReference: candidate.sourceUrl}}
      review={{
        publishedQuote,
        onApprove: approve,
        onReject: async () => {
          await api.candidateQuotes.update(candidate.id, {
            text: candidate.text,
            status: 'REJECTED',
            publishedQuoteId: candidate.publishedQuoteId ?? null,
          })
          onCompleted('Candidate rejected.', candidate.status)
        },
        status: candidate.status,
        onSnooze: async () => {
          await api.candidateQuotes.update(candidate.id, {
            text: candidate.text,
            status: 'SNOOZED',
            publishedQuoteId: candidate.publishedQuoteId ?? null,
          })
          onCompleted('Candidate snoozed.', 'PENDING')
        },
      }}
      onClose={onClose}
      onCreated={() => onCompleted('Candidate approved.', candidate.status)}
      onAuthorCreated={onAuthorCreated}
      onCharacterCreated={onCharacterCreated}
    />
  )
}

export default function CandidateReview({onAuthorCreated, onQuoteCreated, onCharacterCreated, deletedQuoteId = null}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [review, setReview] = useState(null)
  const [counts, setCounts] = useState(null)
  const [countsLoading, setCountsLoading] = useState(true)
  const [countsError, setCountsError] = useState('')
  const [queueStatus, setQueueStatus] = useState('PENDING')
  const pendingButtonRef = useRef(null)
  const snoozedButtonRef = useRef(null)
  const loadingRef = useRef(false)
  const requestVersion = useRef(0)
  const countsVersion = useRef(0)
  // Keep successful publications across dialog cancellation for safe in-session retries.
  const progress = useRef({authors: new Map(), quotes: new Map()})

  async function fetchCounts() {
    const [quotes, snoozedQuotes, authors] = await Promise.all([
      api.candidateQuotes.pendingCount(),
      api.candidateQuotes.snoozedCount(),
      api.candidateAuthors.pendingCount(),
    ])
    return {quotes, snoozedQuotes, authors}
  }

  useEffect(() => {
    for (const [candidateId, publishedQuote] of progress.current.quotes) {
      if (publishedQuote.id === deletedQuoteId) progress.current.quotes.delete(candidateId)
    }
    const version = ++countsVersion.current
    fetchCounts().then((result) => {
      if (version === countsVersion.current) {
        setCounts(result)
        setCountsError('')
      }
    }).catch((failure) => {
      if (version === countsVersion.current) setCountsError(`Unable to load pending candidate counts: ${failure.message}`)
    }).finally(() => {
      if (version === countsVersion.current) setCountsLoading(false)
    })
    return () => {
      countsVersion.current += 1
    }
  }, [deletedQuoteId])

  useEffect(() => () => {
    requestVersion.current += 1
  }, [])

  async function loadCounts() {
    const version = ++countsVersion.current
    setCountsLoading(true)
    setCountsError('')
    try {
      const result = await fetchCounts()
      if (version === countsVersion.current) setCounts(result)
    } catch (failure) {
      if (version === countsVersion.current) setCountsError(`Unable to load pending candidate counts: ${failure.message}`)
    } finally {
      if (version === countsVersion.current) setCountsLoading(false)
    }
  }

  async function next(completedMessage = '', status = 'PENDING') {
    if (loadingRef.current || (review && !completedMessage)) return
    loadingRef.current = true
    const version = ++requestVersion.current
    setLoading(true)
    setQueueStatus(status)
    setError('')
    setMessage(completedMessage)
    if (completedMessage) {
      close()
      loadCounts()
    }
    try {
      const result = await api.candidateQuotes.listPage({status, page: 0, size: 1})
      if (version !== requestVersion.current) return
      if (result.page.number !== 0 || result.page.size !== 1 || result.content.length > 1) {
        throw new Error('The candidates endpoint returned an unexpected page')
      }
      const candidate = result.content[0]
      if (!candidate) {
        setMessage([completedMessage, status === 'SNOOZED' ? 'No snoozed candidates.' : 'No pending candidates.'].filter(Boolean).join(' '))
        return
      }
      const candidateAuthor = await api.candidateAuthors.get(candidate.candidateAuthorId)
      if (version === requestVersion.current) setReview({candidate, candidateAuthor, progress: progress.current})
    } catch (failure) {
      if (version === requestVersion.current) setError(`Unable to load ${status === 'SNOOZED' ? 'snoozed' : 'next'} candidate: ${failure.message}`)
    } finally {
      if (version === requestVersion.current) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }

  function close() {
    setReview(null)
    const buttonRef = queueStatus === 'SNOOZED' ? snoozedButtonRef : pendingButtonRef
    buttonRef.current?.focus()
  }

  return (
    <section className="candidate-review" aria-labelledby="candidate-review-title">
      <h2 id="candidate-review-title">Candidate review</h2>
      {counts && (
        <p className="candidate-review-counts">
          Candidate quotes pending: {counts.quotes}<br />
          Candidate authors pending: {counts.authors}
        </p>
      )}
      {countsLoading && !counts && <p role="status">Loading candidate counts...</p>}
      {countsError && (
        <p role="alert">
          {countsError} <button type="button" onClick={loadCounts} disabled={countsLoading}>Retry counts</button>
        </p>
      )}
      <button ref={pendingButtonRef} type="button" onClick={() => next()} disabled={loading} aria-haspopup="dialog">
        {loading ? 'Loading candidate...' : 'Review next candidate'}
      </button>
      {counts && <p className="candidate-review-counts">Candidate quotes snoozed: {counts.snoozedQuotes}</p>}
      <button ref={snoozedButtonRef} type="button" onClick={() => next('', 'SNOOZED')} disabled={loading} aria-haspopup="dialog">
        Review snoozed
      </button>
      {loading && <p role="status">Loading next candidate...</p>}
      {error && <p role="alert">{error} Try again with {queueStatus === 'SNOOZED' ? 'Review snoozed' : 'Review next candidate'}.</p>}
      {message && <p role="status">{message}</p>}
      {review && (
        <ReviewDialog key={review.candidate.id} {...review} onClose={close}
          onCompleted={next}
          onCountsChanged={loadCounts}
          onAuthorCreated={onAuthorCreated}
          onQuoteCreated={onQuoteCreated}
          onCharacterCreated={onCharacterCreated}
        />
      )}
    </section>
  )
}
