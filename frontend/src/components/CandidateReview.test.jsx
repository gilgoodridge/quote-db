import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '../api'
import App from '../App'
import CandidateReview from './CandidateReview'

const author = {id: 7, fullName: 'Published Author', dateOfBirth: '1950-01-02'}
const candidateAuthor = {id: 3, fullName: 'Candidate Author', status: 'APPROVED', publishedAuthorId: 7}
const candidate = {
  id: 12, candidateAuthorId: 3, text: 'Candidate quote', status: 'PENDING',
  sourceUrl: 'https://example.com/source?chapter=1&part=2',
}
const catalog = {tones: [{id: 1, name: 'Funny'}], themes: [], forms: [], sources: []}
const savedQuote = {id: 42, text: candidate.text, author, primaryReference: candidate.sourceUrl}
const emptySelections = {toneIds: [], themeIds: [], formIds: [], sourceIds: []}

function page(content, size = 1) {
  return {content, page: {number: 0, size, totalElements: content.length, totalPages: content.length ? 1 : 0}}
}

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return {promise, resolve}
}

beforeEach(() => {
  vi.spyOn(api.auth, 'me').mockResolvedValue({authenticated: false})
  vi.spyOn(api.auth, 'logout').mockResolvedValue()
  vi.spyOn(api.authors, 'get').mockResolvedValue(author)
  vi.spyOn(api.candidateQuotes, 'pendingCount').mockResolvedValue(0)
  vi.spyOn(api.candidateQuotes, 'snoozedCount').mockResolvedValue(0)
  vi.spyOn(api.candidateAuthors, 'pendingCount').mockResolvedValue(0)
  vi.spyOn(api.candidateQuotes, 'listPage').mockResolvedValue(page([])).mockResolvedValueOnce(page([candidate]))
  vi.spyOn(api.candidateAuthors, 'get').mockResolvedValue(candidateAuthor)
  vi.spyOn(api.candidateAuthors, 'update').mockResolvedValue({...candidateAuthor, status: 'APPROVED'})
  vi.spyOn(api.candidateAuthors, 'promote').mockImplementation(async () => ({candidate: candidateAuthor, author}))
  vi.spyOn(api.candidateAuthors, 'link').mockImplementation(async (id, authorId) => ({
    candidate: candidateAuthor, author: {...author, id: authorId},
  }))
  vi.spyOn(api.candidateAuthors, 'snoozeQuotes').mockResolvedValue(candidateAuthor)
  vi.spyOn(api.candidateAuthors, 'reject').mockResolvedValue({...candidateAuthor, status: 'REJECTED'})
  vi.spyOn(api.candidateQuotes, 'update').mockResolvedValue({...candidate, status: 'APPROVED'})
  vi.spyOn(api.candidateQuotes, 'promote').mockImplementation(async (id, request) => ({
    candidate: {...candidate, text: request.text, status: 'APPROVED'},
    quote: {...savedQuote, ...request, author},
  }))
  vi.spyOn(api.authors, 'list').mockResolvedValue([author])
  vi.spyOn(api.authors, 'listPage').mockResolvedValue(page([author], 10))
  vi.spyOn(api.authors, 'create').mockResolvedValue(author)
  vi.spyOn(api.characters, 'list').mockResolvedValue([])
  vi.spyOn(api.characters, 'listPage').mockResolvedValue(page([], 10))
  vi.spyOn(api.categories, 'list').mockResolvedValue(catalog)
  vi.spyOn(api.quotes, 'create').mockImplementation(async (request) => ({...savedQuote, ...request, author}))
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function openNext() {
  fireEvent.click(screen.getByRole('button', {name: 'Review next candidate'}))
  await waitFor(() => {
    expect(screen.getByRole('dialog').querySelector('h2').textContent).not.toBe('Checking existing authors')
  })
  return screen.getByRole('dialog')
}

async function ready() {
  await waitFor(() => expect(screen.getByRole('button', {name: 'Approve'}).disabled).toBe(false))
}

function pendingAuthor(status = 'PENDING') {
  api.candidateAuthors.get.mockResolvedValue({...candidateAuthor, status, publishedAuthorId: null})
}

function saveAuthor() {
  fireEvent.change(screen.getByLabelText('Date of birth *'), {target: {value: '1950-01-02'}})
  fireEvent.click(screen.getByRole('button', {name: 'Save author'}))
}

describe('candidate review', () => {
  it.each([
    ['Reject candidate', 'REJECTED'],
    ['Snooze candidate', 'SNOOZED'],
    ['Approve candidate', 'APPROVED'],
  ])('runs %s from the fixed header while retaining footer actions', async (name, status) => {
    render(<CandidateReview />)
    await openNext()
    await ready()
    const header = screen.getByRole('group', {name: 'Quote review actions'})
    expect(header.closest('.dialog-header')).toBeTruthy()
    expect(header.closest('.dialog-body')).toBeNull()
    for (const action of ['Reject', 'Snooze', 'Approve']) {
      expect(screen.getByRole('button', {name: action}).closest('.add-quote-actions')).toBeTruthy()
    }
    const approve = within(header).getByRole('button', {name: 'Approve candidate'})
    expect(approve.form).toBe(screen.getByRole('dialog').querySelector('form'))
    fireEvent.click(within(header).getByRole('button', {name}))
    if (status === 'APPROVED') {
      await waitFor(() => expect(api.candidateQuotes.promote).toHaveBeenCalledWith(12, expect.any(Object)))
      expect(api.candidateQuotes.update).not.toHaveBeenCalled()
    } else {
      await waitFor(() => expect(api.candidateQuotes.update).toHaveBeenCalledWith(12,
        expect.objectContaining({status})))
      expect(api.candidateQuotes.promote).not.toHaveBeenCalled()
    }
    expect(api.quotes.create).not.toHaveBeenCalled()
  })

  it('validates header approval and disables both copies during submission', async () => {
    const publication = deferred()
    api.candidateQuotes.promote.mockReturnValueOnce(publication.promise)
    render(<CandidateReview />)
    await openNext()
    await ready()
    const approve = screen.getByRole('button', {name: 'Approve candidate'})
    fireEvent.change(screen.getByLabelText('Quote text *'), {target: {value: ''}})
    fireEvent.click(approve)
    expect(api.candidateQuotes.promote).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Quote text *'), {target: {value: 'Edited quote'}})
    fireEvent.click(approve)
    for (const name of ['Reject', 'Snooze', 'Saving...', 'Reject candidate', 'Snooze candidate', 'Approve candidate']) {
      expect(screen.getByRole('button', {name}).disabled).toBe(true)
    }
    fireEvent.click(approve)
    expect(api.candidateQuotes.promote).toHaveBeenCalledTimes(1)
    await act(async () => publication.resolve({candidate: {...candidate, status: 'APPROVED'}, quote: savedQuote}))
    await screen.findByText(/Candidate approved\./)
  })

  it('shows the pending candidate quote and author counts', async () => {
    api.candidateQuotes.pendingCount.mockResolvedValue(8)
    api.candidateQuotes.snoozedCount.mockResolvedValue(5)
    api.candidateAuthors.pendingCount.mockResolvedValue(3)
    render(<CandidateReview />)
    expect(await screen.findByText(/Candidate quotes pending: 8/)).toBeTruthy()
    expect(screen.getByText('Candidate quotes snoozed: 5')).toBeTruthy()
    expect(screen.getByText(/Candidate authors pending: 3/)).toBeTruthy()
    expect(screen.queryByText('Review the next pending quote before publishing it.')).toBeNull()
    const snoozedCount = screen.getByText('Candidate quotes snoozed: 5')
    expect(snoozedCount.previousElementSibling).toBe(screen.getByRole('button', {name: 'Review next candidate'}))
    expect(snoozedCount.nextElementSibling).toBe(screen.getByRole('button', {name: 'Review snoozed'}))
  })

  it('keeps Coming Soon signed out and shows the review panel only after login', async () => {
    const view = render(<App />)
    await screen.findByText('Coming Soon')
    expect(screen.queryByRole('button', {name: 'Review next candidate'})).toBeNull()
    expect(api.candidateQuotes.listPage).not.toHaveBeenCalled()
    view.unmount()
    api.auth.me.mockResolvedValue({authenticated: true, name: 'Reviewer'})
    render(<App />)
    await screen.findByRole('button', {name: 'Review next candidate'})
    expect(screen.queryByText('Coming Soon')).toBeNull()
    expect(api.candidateQuotes.listPage).not.toHaveBeenCalled()
  })

  it('loads exactly the first pending quote and prefills an approved author, text and source', async () => {
    render(<CandidateReview />)
    await openNext()
    await ready()
    expect(api.candidateQuotes.listPage).toHaveBeenCalledWith({status: 'PENDING', page: 0, size: 1})
    expect(api.candidateAuthors.get).toHaveBeenCalledWith(3)
    expect(screen.getByRole('dialog', {name: 'Review Quote'})).toBeTruthy()
    expect(screen.getByLabelText('Author *').value).toBe('7')
    expect(screen.getByLabelText('Quote text *').value).toBe(candidate.text)
    expect(screen.getByLabelText('Primary reference').value).toBe(candidate.sourceUrl)
    const source = screen.getByRole('link', {name: 'Open source in a new tab'})
    expect(source.href).toBe(candidate.sourceUrl)
    expect(source.target).toBe('_blank')
    expect(source.rel).toBe('noopener noreferrer')
    expect(source.querySelector('svg')).toBeTruthy()
    expect(screen.queryByRole('button', {name: 'Cancel'})).toBeNull()
  })

  it.each(['PENDING', 'REJECTED', 'APPROVED'])('prompts for an unlinked %s author and saves edited name before reviewing the quote', async (status) => {
    pendingAuthor(status)
    const onAuthorCreated = vi.fn()
    render(<CandidateReview onAuthorCreated={onAuthorCreated} />)
    await openNext()
    expect(screen.getByRole('dialog', {name: 'Review author'})).toBeTruthy()
    expect(screen.getByLabelText('Full name *').value).toBe(candidateAuthor.fullName)
    fireEvent.change(screen.getByLabelText('Full name *'), {target: {value: ' Published Author '}})
    saveAuthor()
    await screen.findByRole('dialog', {name: 'Review Quote'})
    await ready()
    expect(api.candidateAuthors.promote).toHaveBeenCalledWith(3,
      expect.objectContaining({fullName: author.fullName, dateOfBirth: author.dateOfBirth}))
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(api.candidateAuthors.update).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Author *').value).toBe('7')
    expect(onAuthorCreated).toHaveBeenCalledWith(author)
  })

  it('snoozes all quotes from the review-author form without creating an author', async () => {
    pendingAuthor()
    render(<CandidateReview />)
    await openNext()
    await screen.findByRole('dialog', {name: 'Review author'})
    fireEvent.click(screen.getByRole('button', {name: 'Snooze quotes'}))
    await screen.findByText('Candidate author quotes snoozed. No pending candidates.')
    expect(api.candidateAuthors.snoozeQuotes).toHaveBeenCalledWith(candidateAuthor.id)
    expect(api.candidateAuthors.reject).not.toHaveBeenCalled()
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(api.candidateAuthors.update).not.toHaveBeenCalled()
    expect(api.candidateQuotes.update).not.toHaveBeenCalled()
    expect(api.candidateQuotes.listPage).toHaveBeenLastCalledWith({status: 'PENDING', page: 0, size: 1})
  })

  it('rejects the author and all its quotes from the review-author form', async () => {
    pendingAuthor()
    render(<CandidateReview />)
    await openNext()
    await screen.findByRole('dialog', {name: 'Review author'})
    fireEvent.click(screen.getByRole('button', {name: 'Reject author and quotes'}))
    await screen.findByText('Candidate author and quotes rejected. No pending candidates.')
    expect(api.candidateAuthors.reject).toHaveBeenCalledWith(candidateAuthor.id)
    expect(api.candidateAuthors.snoozeQuotes).not.toHaveBeenCalled()
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(api.candidateAuthors.update).not.toHaveBeenCalled()
    expect(api.candidateQuotes.update).not.toHaveBeenCalled()
  })

  it('offers author-level decisions when an existing author match is found', async () => {
    pendingAuthor()
    api.authors.list.mockResolvedValue([{...author, fullName: candidateAuthor.fullName}])
    render(<CandidateReview />)
    await openNext()
    expect(await screen.findByRole('dialog', {name: 'Existing author found'})).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'Snooze quotes'}))
    await screen.findByText('Candidate author quotes snoozed. No pending candidates.')
    expect(api.candidateAuthors.snoozeQuotes).toHaveBeenCalledWith(candidateAuthor.id)
    expect(api.candidateAuthors.update).not.toHaveBeenCalled()
  })

  it('keeps author review open with a retryable error when an author decision fails', async () => {
    pendingAuthor()
    api.candidateAuthors.reject.mockRejectedValueOnce(new Error('Update failed'))
    render(<CandidateReview />)
    await openNext()
    await screen.findByRole('dialog', {name: 'Review author'})
    fireEvent.click(screen.getByRole('button', {name: 'Reject author and quotes'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Update failed')
    expect(screen.getByRole('dialog', {name: 'Review author'})).toBeTruthy()
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(1)
  })

  it('leaves the quote author empty after cancelling author creation and permits existing author selection', async () => {
    pendingAuthor()
    render(<CandidateReview />)
    await openNext()
    await screen.findByRole('button', {name: 'Close author form'})
    fireEvent.click(screen.getByRole('button', {name: 'Close author form'}))
    await ready()
    expect(screen.getByLabelText('Author *').value).toBe('')
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(api.candidateAuthors.update).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Author *'), {target: {value: '7'}})
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}))
    await screen.findByText(/Candidate approved\./)
  })

  it('publishes the full edited quote, then links and approves the candidate', async () => {
    const onQuoteCreated = vi.fn()
    render(<CandidateReview onQuoteCreated={onQuoteCreated} />)
    await openNext()
    await ready()
    fireEvent.change(screen.getByLabelText('Quote text *'), {target: {value: 'Edited quote'}})
    fireEvent.change(screen.getByLabelText('Location'), {target: {value: 'Chapter 1'}})
    fireEvent.click(screen.getByText('Tone'))
    fireEvent.click(screen.getByRole('checkbox', {name: 'Funny'}))
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}))
    await screen.findByText(/Candidate approved\./)
    expect(api.candidateQuotes.promote).toHaveBeenCalledWith(12, {
      text: 'Edited quote', authorId: 7, characterId: null, date: null, location: 'Chapter 1',
      primaryReference: candidate.sourceUrl, secondaryReference: null, ...emptySelections, toneIds: [1],
    })
    expect(api.candidateQuotes.update).not.toHaveBeenCalled()
    expect(api.quotes.create).not.toHaveBeenCalled()
    expect(onQuoteCreated).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Review next candidate'}))
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(2)
    expect(api.candidateQuotes.listPage).toHaveBeenLastCalledWith({status: 'PENDING', page: 0, size: 1})
  })

  it('rejects without publishing, even with no author or loaded form options', async () => {
    pendingAuthor()
    api.categories.list.mockRejectedValue(new Error('Catalog offline'))
    render(<CandidateReview />)
    await openNext()
    await screen.findByRole('button', {name: 'Close author form'})
    fireEvent.click(screen.getByRole('button', {name: 'Close author form'}))
    await screen.findByRole('button', {name: 'Retry loading categories'})
    fireEvent.change(screen.getByLabelText('Quote text *'), {target: {value: ''}})
    fireEvent.click(screen.getByRole('button', {name: 'Reject'}))
    await screen.findByText(/Candidate rejected\./)
    expect(api.candidateQuotes.update).toHaveBeenCalledWith(12, {
      text: candidate.text, status: 'REJECTED', publishedQuoteId: null,
    })
    expect(api.candidateQuotes.promote).not.toHaveBeenCalled()
  })

  it('snoozes a pending candidate without publishing and continues the pending queue', async () => {
    api.candidateQuotes.listPage.mockReset().mockResolvedValueOnce(page([candidate])).mockResolvedValue(page([]))
    render(<CandidateReview />)
    await openNext()
    await ready()
    fireEvent.change(screen.getByLabelText('Quote text *'), {target: {value: 'Unsaved edit'}})
    fireEvent.click(screen.getByRole('button', {name: 'Snooze'}))
    await screen.findByText('Candidate snoozed. No pending candidates.')
    expect(api.candidateQuotes.update).toHaveBeenCalledWith(12, {
      text: candidate.text, status: 'SNOOZED', publishedQuoteId: null,
    })
    expect(api.candidateQuotes.promote).not.toHaveBeenCalled()
    expect(api.candidateQuotes.listPage).toHaveBeenLastCalledWith({status: 'PENDING', page: 0, size: 1})
  })

  it('loads snoozed candidates separately and continues that queue after rejection', async () => {
    api.candidateQuotes.listPage.mockReset()
      .mockResolvedValueOnce(page([{...candidate, status: 'SNOOZED'}]))
      .mockResolvedValue(page([]))
    render(<CandidateReview />)
    fireEvent.click(screen.getByRole('button', {name: 'Review snoozed'}))
    await ready()
    expect(api.candidateQuotes.listPage).toHaveBeenCalledWith({status: 'SNOOZED', page: 0, size: 1})
    expect(screen.queryByRole('button', {name: 'Snooze'})).toBeNull()
    expect(screen.queryByRole('button', {name: 'Snooze candidate'})).toBeNull()
    fireEvent.click(screen.getByRole('button', {name: 'Reject'}))
    await screen.findByText('Candidate rejected. No snoozed candidates.')
    expect(api.candidateQuotes.listPage).toHaveBeenLastCalledWith({status: 'SNOOZED', page: 0, size: 1})
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Review snoozed'}))
  })

  it('closes without changing the candidate when cancelled', async () => {
    render(<CandidateReview />)
    await openNext()
    fireEvent.click(screen.getByRole('button', {name: 'Close quote form'}))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.candidateQuotes.update).not.toHaveBeenCalled()
    expect(api.quotes.create).not.toHaveBeenCalled()
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Review next candidate'}))
  })

  it.each(['Approve', 'Reject'])('automatically opens a fresh next review after %s succeeds', async (action) => {
    const nextCandidate = {...candidate, id: 13, text: 'Next quote', candidateAuthorId: 4}
    api.candidateQuotes.listPage.mockResolvedValueOnce(page([nextCandidate]))
    api.candidateAuthors.get.mockResolvedValueOnce(candidateAuthor)
      .mockResolvedValueOnce({...candidateAuthor, id: 4, status: 'PENDING', publishedAuthorId: null})
    render(<CandidateReview />)
    await openNext()
    await ready()
    fireEvent.change(screen.getByLabelText('Location'), {target: {value: 'Old draft location'}})
    fireEvent.click(screen.getByRole('button', {name: action}))
    await screen.findByRole('dialog', {name: 'Review author'})
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(2)
    expect(api.candidateQuotes.listPage).toHaveBeenLastCalledWith({status: 'PENDING', page: 0, size: 1})
    expect(api.candidateAuthors.get).toHaveBeenLastCalledWith(4)
    fireEvent.click(screen.getByRole('button', {name: 'Close author form'}))
    await ready()
    expect(screen.getByLabelText('Quote text *').value).toBe('Next quote')
    expect(screen.getByLabelText('Author *').value).toBe('')
    expect(screen.getByLabelText('Location').value).toBe('')
    fireEvent.click(screen.getByRole('button', {name: 'Close quote form'}))
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(2)
  })

  it('reports an exhausted queue after completing a review', async () => {
    render(<CandidateReview />)
    await openNext()
    await ready()
    fireEvent.click(screen.getByRole('button', {name: 'Reject'}))
    await screen.findByText('Candidate rejected. No pending candidates.')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(2)
  })

  it('keeps completion visible and offers manual retry when automatic next-item loading fails', async () => {
    api.candidateQuotes.listPage.mockRejectedValueOnce(new Error('Queue offline'))
      .mockResolvedValueOnce(page([{...candidate, id: 13, text: 'Next quote'}]))
    render(<CandidateReview />)
    await openNext()
    await ready()
    fireEvent.click(screen.getByRole('button', {name: 'Reject'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Queue offline')
    expect(screen.getByText('Candidate rejected.')).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    await openNext()
    await ready()
    expect(screen.getByLabelText('Quote text *').value).toBe('Next quote')
    expect(api.candidateQuotes.update).toHaveBeenCalledTimes(1)
  })

  it('distinguishes an empty queue from errors and allows retrying', async () => {
    api.candidateQuotes.listPage.mockReset().mockResolvedValue(page([candidate]))
    api.candidateQuotes.listPage.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(page([]))
    render(<CandidateReview />)
    fireEvent.click(screen.getByRole('button', {name: 'Review next candidate'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Offline')
    fireEvent.click(screen.getByRole('button', {name: 'Review next candidate'}))
    await screen.findByText('No pending candidates.')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(api.candidateAuthors.get).not.toHaveBeenCalled()
    await openNext()
    await ready()
  })

  it('surfaces candidate author load failures and retries without writes', async () => {
    api.candidateQuotes.listPage.mockResolvedValue(page([candidate]))
    api.candidateAuthors.get.mockRejectedValueOnce(new Error('Author unavailable'))
    render(<CandidateReview />)
    fireEvent.click(screen.getByRole('button', {name: 'Review next candidate'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Author unavailable')
    expect(screen.queryByRole('dialog')).toBeNull()
    await openNext()
    await ready()
    expect(api.quotes.create).not.toHaveBeenCalled()
  })

  it('keeps the author promotion request unchanged after an ambiguous failure and retries safely', async () => {
    pendingAuthor()
    api.candidateAuthors.promote.mockRejectedValueOnce(new Error('Response lost'))
    render(<CandidateReview />)
    await openNext()
    await screen.findByRole('dialog', {name: 'Review author'})
    saveAuthor()
    expect((await screen.findByRole('alert')).textContent).toContain('Response lost')
    const retry = screen.getByRole('button', {name: 'Retry author promotion'})
    expect(screen.getByLabelText('Full name *').matches(':disabled')).toBe(true)
    fireEvent.click(retry)
    await screen.findByRole('dialog', {name: 'Review Quote'})
    await ready()
    expect(api.candidateAuthors.promote).toHaveBeenCalledTimes(2)
    expect(api.candidateAuthors.promote.mock.calls[0]).toEqual(api.candidateAuthors.promote.mock.calls[1])
    expect(api.authors.create).not.toHaveBeenCalled()
  })

  it('links an existing author through the atomic promotion endpoint', async () => {
    pendingAuthor()
    const onAuthorCreated = vi.fn()
    render(<CandidateReview onAuthorCreated={onAuthorCreated} />)
    api.authors.list.mockResolvedValue([{...author, fullName: candidateAuthor.fullName}])
    await openNext()
    fireEvent.click(await screen.findByRole('button', {name: 'Use this author'}))
    await screen.findByRole('dialog', {name: 'Review Quote'})
    await ready()
    expect(api.candidateAuthors.link).toHaveBeenCalledWith(3, author.id)
    expect(api.candidateAuthors.update).not.toHaveBeenCalled()
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(onAuthorCreated).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Author *').value).toBe('7')
  })

  it('finds an exact duplicate, lets the reviewer inspect it, and links it without creating an author', async () => {
    pendingAuthor()
    const duplicate = {...author, id: 19, fullName: candidateAuthor.fullName}
    api.authors.list.mockResolvedValue([duplicate])
    api.authors.listPage.mockResolvedValue(page([duplicate], 10))
    api.authors.get.mockResolvedValue(duplicate)
    render(<CandidateReview />)

    await openNext()
    expect(api.authors.list).toHaveBeenCalledWith(candidateAuthor.fullName)
    expect(screen.getByText('This author already exists. Would you like to use the existing author?')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'View author details'}))
    const details = await screen.findByRole('dialog', {name: 'About this Author'})
    await within(details).findByText(candidateAuthor.fullName)
    expect(within(details).queryByRole('button', {name: 'Edit author'})).toBeNull()
    fireEvent.click(within(details).getByRole('button', {name: 'Close author details'}))
    expect(screen.getByText('This author already exists. Would you like to use the existing author?')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', {name: 'Use this author'}))
    await screen.findByRole('dialog', {name: 'Review Quote'})
    await ready()
    expect(api.candidateAuthors.link).toHaveBeenCalledWith(3, duplicate.id)
    expect(api.candidateAuthors.update).not.toHaveBeenCalled()
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Author *').value).toBe(String(duplicate.id))
  })

  it('lets the reviewer continue with a new author after finding a possible duplicate', async () => {
    pendingAuthor()
    api.authors.list.mockResolvedValue([{...author, fullName: candidateAuthor.fullName}])
    render(<CandidateReview />)

    await openNext()
    fireEvent.click(screen.getByRole('button', {name: 'Create a new author'}))
    expect(await screen.findByRole('dialog', {name: 'Review author'})).toBeTruthy()
    expect(screen.getByLabelText('Full name *').value).toBe(candidateAuthor.fullName)
  })

  it('keeps author review blocked and offers a retry when duplicate search fails', async () => {
    pendingAuthor()
    api.authors.list.mockRejectedValueOnce(new Error('Author search offline'))
    render(<CandidateReview />)
    fireEvent.click(screen.getByRole('button', {name: 'Review next candidate'}))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Author search offline')
    expect(screen.queryByRole('dialog', {name: 'Review author'})).toBeNull()
    fireEvent.click(screen.getByRole('button', {name: 'Retry author search'}))
    await screen.findByRole('dialog', {name: 'Review author'})
  })

  it('retains and locks the quote request after an ambiguous promotion failure for safe retry', async () => {
    const pending = deferred()
    api.candidateQuotes.promote.mockReturnValueOnce(pending.promise)
    render(<CandidateReview />)
    await openNext()
    await ready()
    fireEvent.change(screen.getByLabelText('Quote text *'), {target: {value: 'Kept draft'}})
    const form = screen.getByRole('button', {name: 'Approve'}).closest('form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(api.candidateQuotes.promote).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', {name: 'Close quote form'}).disabled).toBe(true)
    const cancel = new Event('cancel', {cancelable: true})
    fireEvent(screen.getByRole('dialog'), cancel)
    expect(cancel.defaultPrevented).toBe(true)
    await act(async () => pending.resolve(Promise.reject(new Error('Publish failed'))))
    expect((await screen.findByRole('alert')).textContent).toContain('Publish failed')
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Quote text *').value).toBe('Kept draft')
    expect(screen.getByLabelText('Quote text *').matches(':disabled')).toBe(true)
    expect(api.candidateQuotes.update).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name: 'Retry approval'}))
    await screen.findByText(/Candidate approved\./)
    expect(api.candidateQuotes.promote).toHaveBeenCalledTimes(2)
    expect(api.candidateQuotes.promote.mock.calls[0]).toEqual(api.candidateQuotes.promote.mock.calls[1])
  })

  it('surfaces quote promotion errors and retries atomically', async () => {
    api.candidateQuotes.promote.mockRejectedValueOnce(new Error('Promotion failed'))
    const onQuoteCreated = vi.fn()
    render(<CandidateReview onQuoteCreated={onQuoteCreated} />)
    await openNext()
    await ready()
    fireEvent.change(screen.getByLabelText('Quote text *'), {target: {value: 'Saved edit'}})
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Promotion failed')
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Quote text *').matches(':disabled')).toBe(true)
    expect(screen.getByRole('button', {name: 'Reject'}).disabled).toBe(true)
    expect(screen.getByRole('button', {name: 'Reject candidate'}).disabled).toBe(true)
    expect(screen.getByRole('button', {name: 'Snooze candidate'}).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', {name: 'Retry approval'}))
    await screen.findByText(/Candidate approved\./)
    expect(api.quotes.create).not.toHaveBeenCalled()
    expect(api.candidateQuotes.update).not.toHaveBeenCalled()
    expect(api.candidateQuotes.promote).toHaveBeenCalledTimes(2)
    expect(api.candidateQuotes.promote.mock.calls[0]).toEqual(api.candidateQuotes.promote.mock.calls[1])
    expect(onQuoteCreated).toHaveBeenCalledTimes(1)
  })

  it('refreshes counts and forgets deleted publication IDs so Pending candidates can be published again', async () => {
    const {rerender} = render(<CandidateReview />)
    await openNext()
    await ready()
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}))
    await screen.findByText(/Candidate approved\./)
    expect(api.candidateQuotes.promote).toHaveBeenCalledTimes(1)
    api.candidateQuotes.pendingCount.mockResolvedValue(1)
    api.candidateQuotes.listPage.mockResolvedValueOnce(page([candidate]))
    rerender(<CandidateReview deletedQuoteId={savedQuote.id} />)
    await screen.findByText(/Candidate quotes pending: 1/)
    await openNext()
    await ready()
    expect(screen.getByLabelText('Quote text *').matches(':disabled')).toBe(false)
    expect(screen.getByRole('button', {name: 'Reject'}).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}))
    await screen.findByText(/Candidate approved\./)
    expect(api.candidateQuotes.promote).toHaveBeenCalledTimes(2)
  })

  it('keeps the candidate available when rejection fails and retries without publishing', async () => {
    api.candidateQuotes.update.mockRejectedValueOnce(new Error('Reject failed'))
    render(<CandidateReview />)
    await openNext()
    await ready()
    fireEvent.click(screen.getByRole('button', {name: 'Reject'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Reject failed')
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', {name: 'Reject'}))
    await screen.findByText(/Candidate rejected\./)
    expect(api.candidateQuotes.promote).not.toHaveBeenCalled()
  })

  it('prevents duplicate queue loads and ignores results after logout', async () => {
    api.auth.me.mockResolvedValue({authenticated: true, name: 'Reviewer'})
    const pending = deferred()
    api.candidateQuotes.listPage.mockReset().mockReturnValueOnce(pending.promise)
    render(<App />)
    const button = await screen.findByRole('button', {name: 'Review next candidate'})
    fireEvent.click(button)
    fireEvent.click(button)
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', {name: 'Menu'}))
    fireEvent.click(screen.getByRole('button', {name: 'Logout'}))
    await screen.findByText('Coming Soon')
    await act(async () => pending.resolve(page([candidate])))
    expect(api.candidateAuthors.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it.each(['javascript:alert(1)', 'data:text/html,test', 'not a URL'])('does not turn unsafe or invalid reference %s into a link', async (sourceUrl) => {
    api.candidateQuotes.listPage.mockReset().mockResolvedValue(page([{...candidate, sourceUrl}]))
    render(<CandidateReview />)
    await openNext()
    await ready()
    expect(screen.queryByRole('link', {name: 'Open source in a new tab'})).toBeNull()
  })
})
