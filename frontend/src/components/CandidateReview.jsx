import {useEffect, useRef, useState} from 'react'
import {api} from '../api'
import AddAuthorDialog from './AddAuthorDialog'
import AddQuoteDialog from './AddQuoteDialog'
import '../styles/CandidateReview.css'

function ReviewDialog({candidate, candidateAuthor, progress, onClose, onCompleted, onAuthorCreated, onQuoteCreated, onCharacterCreated}) {
  const [publishedAuthor, setPublishedAuthor] = useState(progress.authors.get(candidateAuthor.id) ?? null)
  const [publishedQuote, setPublishedQuote] = useState(progress.quotes.get(candidate.id) ?? null)
  const authorApproved = candidateAuthor.status === 'APPROVED' && candidateAuthor.publishedAuthorId != null
  const [reviewAuthor, setReviewAuthor] = useState(!authorApproved && !publishedQuote)
  const [authorId, setAuthorId] = useState(publishedQuote?.author.id ?? (authorApproved ? candidateAuthor.publishedAuthorId : null))

  async function saveAuthor(request) {
    let author = progress.authors.get(candidateAuthor.id)
    if (!author) {
      author = await api.authors.create(request)
      progress.authors.set(candidateAuthor.id, author)
      setPublishedAuthor(author)
      onAuthorCreated?.(author)
    }
    await api.candidateAuthors.update(candidateAuthor.id, {
      fullName: author.fullName,
      status: 'APPROVED',
      publishedAuthorId: author.id,
    })
    return author
  }

  async function approve(request) {
    let quote = progress.quotes.get(candidate.id)
    if (!quote) {
      quote = await api.quotes.create(request)
      progress.quotes.set(candidate.id, quote)
      setPublishedQuote(quote)
      onQuoteCreated?.(quote)
    }
    await api.candidateQuotes.update(candidate.id, {
      text: quote.text,
      status: 'APPROVED',
      publishedQuoteId: quote.id,
    })
    return quote
  }

  if (reviewAuthor) {
    return (
      <AddAuthorDialog reviewing
        initialValues={publishedAuthor ?? {fullName: candidateAuthor.fullName}}
        publishedAuthor={publishedAuthor}
        onSave={saveAuthor}
        onClose={() => setReviewAuthor(false)}
        onCreated={(author) => {
          setAuthorId(author.id)
          setReviewAuthor(false)
        }}
      />
    )
  }

  return (
    <AddQuoteDialog
      initialAuthorId={authorId}
      initialValues={publishedQuote ?? {text: candidate.text, reference: candidate.sourceUrl}}
      review={{
        publishedQuote,
        onApprove: approve,
        onReject: async () => {
          await api.candidateQuotes.update(candidate.id, {
            text: candidate.text,
            status: 'REJECTED',
            publishedQuoteId: candidate.publishedQuoteId ?? null,
          })
          onCompleted('Candidate rejected.')
        },
      }}
      onClose={onClose}
      onCreated={() => onCompleted('Candidate approved.')}
      onAuthorCreated={onAuthorCreated}
      onCharacterCreated={onCharacterCreated}
    />
  )
}

export default function CandidateReview({onAuthorCreated, onQuoteCreated, onCharacterCreated}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [review, setReview] = useState(null)
  const buttonRef = useRef(null)
  const loadingRef = useRef(false)
  const requestVersion = useRef(0)
  // Keep successful publications across dialog cancellation for safe in-session retries.
  const progress = useRef({authors: new Map(), quotes: new Map()})

  useEffect(() => () => { requestVersion.current += 1 }, [])

  async function next(completedMessage = '') {
    if (loadingRef.current || (review && !completedMessage)) return
    loadingRef.current = true
    const version = ++requestVersion.current
    setLoading(true)
    setError('')
    setMessage(completedMessage)
    if (completedMessage) close()
    try {
      const result = await api.candidateQuotes.listPage({status: 'PENDING', page: 0, size: 1})
      if (version !== requestVersion.current) return
      if (result.page.number !== 0 || result.page.size !== 1 || result.content.length > 1) {
        throw new Error('The candidates endpoint returned an unexpected page')
      }
      const candidate = result.content[0]
      if (!candidate) {
        setMessage([completedMessage, 'No pending candidates.'].filter(Boolean).join(' '))
        return
      }
      const candidateAuthor = await api.candidateAuthors.get(candidate.candidateAuthorId)
      if (version === requestVersion.current) setReview({candidate, candidateAuthor, progress: progress.current})
    } catch (failure) {
      if (version === requestVersion.current) setError(`Unable to load next candidate: ${failure.message}`)
    } finally {
      if (version === requestVersion.current) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }

  function close() {
    setReview(null)
    buttonRef.current?.focus()
  }

  return (
    <section className="candidate-review" aria-labelledby="candidate-review-title">
      <h2 id="candidate-review-title">Candidate review</h2>
      <p>Review the next pending quote before publishing it.</p>
      <button ref={buttonRef} type="button" onClick={() => next()} disabled={loading} aria-haspopup="dialog">
        {loading ? 'Loading candidate...' : 'Review next candidate'}
      </button>
      {loading && <p role="status">Loading next candidate...</p>}
      {error && <p role="alert">{error} Try again with Review next candidate.</p>}
      {message && <p role="status">{message}</p>}
      {review && (
        <ReviewDialog key={review.candidate.id} {...review} onClose={close}
          onCompleted={next}
          onAuthorCreated={onAuthorCreated}
          onQuoteCreated={onQuoteCreated}
          onCharacterCreated={onCharacterCreated}
        />
      )}
    </section>
  )
}
