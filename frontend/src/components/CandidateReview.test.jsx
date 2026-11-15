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
  vi.spyOn(api.candidateAuthors, 'pendingCount').mockResolvedValue(0)
  vi.spyOn(api.candidateQuotes, 'listPage').mockResolvedValue(page([])).mockResolvedValueOnce(page([candidate]))
  vi.spyOn(api.candidateAuthors, 'get').mockResolvedValue(candidateAuthor)
  vi.spyOn(api.candidateAuthors, 'update').mockResolvedValue({...candidateAuthor, status: 'APPROVED'})
  vi.spyOn(api.candidateQuotes, 'update').mockResolvedValue({...candidate, status: 'APPROVED'})
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
  fireEvent.change(screen.getByLabelText('Date of birth (required)'), {target: {value: '1950-01-02'}})
  fireEvent.click(screen.getByRole('button', {name: 'Save author'}))
}

describe('candidate review', () => {
  it('shows the pending candidate quote and author counts', async () => {
    api.candidateQuotes.pendingCount.mockResolvedValue(8)
    api.candidateAuthors.pendingCount.mockResolvedValue(3)
    render(<CandidateReview />)
    expect(await screen.findByText(/Candidate quotes left: 8/)).toBeTruthy()
    expect(screen.getByText(/Candidate authors pending: 3/)).toBeTruthy()
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
    expect(screen.getByLabelText('Author (required)').value).toBe('7')
    expect(screen.getByLabelText('Quote text (required)').value).toBe(candidate.text)
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
    expect(screen.getByLabelText('Full name (required)').value).toBe(candidateAuthor.fullName)
    fireEvent.change(screen.getByLabelText('Full name (required)'), {target: {value: ' Published Author '}})
    saveAuthor()
    await screen.findByRole('dialog', {name: 'Review Quote'})
    await ready()
    expect(api.authors.create).toHaveBeenCalledWith(expect.objectContaining({fullName: author.fullName, dateOfBirth: author.dateOfBirth}))
    expect(api.candidateAuthors.update).toHaveBeenCalledWith(3, {
      fullName: author.fullName, status: 'APPROVED', publishedAuthorId: 7,
    })
    expect(api.authors.create.mock.invocationCallOrder[0]).toBeLessThan(api.candidateAuthors.update.mock.invocationCallOrder[0])
    expect(screen.getByLabelText('Author (required)').value).toBe('7')
    expect(onAuthorCreated).toHaveBeenCalledWith(author)
  })

  it('leaves the quote author empty after cancelling author creation and permits existing author selection', async () => {
    pendingAuthor()
    render(<CandidateReview />)
    await openNext()
    await screen.findByRole('button', {name: 'Close author form'})
    fireEvent.click(screen.getByRole('button', {name: 'Close author form'}))
    await ready()
    expect(screen.getByLabelText('Author (required)').value).toBe('')
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(api.candidateAuthors.update).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Author (required)'), {target: {value: '7'}})
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}))
    await screen.findByText(/Candidate approved\./)
  })

  it('publishes the full edited quote, then links and approves the candidate', async () => {
    const onQuoteCreated = vi.fn()
    render(<CandidateReview onQuoteCreated={onQuoteCreated} />)
    await openNext()
    await ready()
    fireEvent.change(screen.getByLabelText('Quote text (required)'), {target: {value: 'Edited quote'}})
    fireEvent.change(screen.getByLabelText('Location'), {target: {value: 'Chapter 1'}})
    fireEvent.click(screen.getByRole('checkbox', {name: 'Funny'}))
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}))
    await screen.findByText(/Candidate approved\./)
    expect(api.quotes.create).toHaveBeenCalledWith({
      text: 'Edited quote', authorId: 7, characterId: null, date: null, location: 'Chapter 1',
      primaryReference: candidate.sourceUrl, secondaryReference: null, ...emptySelections, toneIds: [1],
    })
    expect(api.candidateQuotes.update).toHaveBeenCalledWith(12, {
      text: 'Edited quote', status: 'APPROVED', publishedQuoteId: 42,
    })
    expect(api.quotes.create.mock.invocationCallOrder[0]).toBeLessThan(api.candidateQuotes.update.mock.invocationCallOrder[0])
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
    fireEvent.change(screen.getByLabelText('Quote text (required)'), {target: {value: ''}})
    fireEvent.click(screen.getByRole('button', {name: 'Reject'}))
    await screen.findByText(/Candidate rejected\./)
    expect(api.candidateQuotes.update).toHaveBeenCalledWith(12, {
      text: candidate.text, status: 'REJECTED', publishedQuoteId: null,
    })
    expect(api.quotes.create).not.toHaveBeenCalled()
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
    expect(screen.getByLabelText('Quote text (required)').value).toBe('Next quote')
    expect(screen.getByLabelText('Author (required)').value).toBe('')
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
    expect(screen.getByLabelText('Quote text (required)').value).toBe('Next quote')
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

  it('keeps the author draft after a publication failure and blocks duplicate submissions and dismissal', async () => {
    pendingAuthor()
    const pending = deferred()
    api.authors.create.mockReturnValueOnce(pending.promise)
    render(<CandidateReview />)
    await openNext()
    await screen.findByRole('dialog', {name: 'Review author'})
    saveAuthor()
    fireEvent.submit(screen.getByRole('button', {name: 'Saving...'}).closest('form'))
    expect(api.authors.create).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', {name: 'Close author form'}).disabled).toBe(true)
    expect(api.candidateAuthors.update).not.toHaveBeenCalled()
    await act(async () => pending.resolve(Promise.reject(new Error('Session expired'))))
    expect((await screen.findByRole('alert')).textContent).toContain('Session expired')
    expect(screen.getByLabelText('Full name (required)').value).toBe(candidateAuthor.fullName)
    saveAuthor()
    await screen.findByRole('dialog', {name: 'Review Quote'})
    await ready()
  })

  it('retries only the author link after partial success, including after closing and reopening', async () => {
    api.candidateQuotes.listPage.mockResolvedValue(page([candidate]))
    pendingAuthor()
    api.candidateAuthors.update.mockRejectedValueOnce(new Error('Link failed'))
    const onAuthorCreated = vi.fn()
    render(<CandidateReview onAuthorCreated={onAuthorCreated} />)
    await openNext()
    await screen.findByRole('dialog', {name: 'Review author'})
    saveAuthor()
    expect((await screen.findByRole('alert')).textContent).toContain('Link failed')
    expect(screen.getByRole('button', {name: 'Retry author approval'})).toBeTruthy()
    expect(screen.getByLabelText('Full name (required)').matches(':disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', {name: 'Close author form'}))
    await ready()
    expect(screen.getByLabelText('Author (required)').value).toBe('')
    fireEvent.click(screen.getByRole('button', {name: 'Close quote form'}))
    await openNext()
    fireEvent.click(screen.getByRole('button', {name: 'Retry author approval'}))
    await screen.findByRole('dialog', {name: 'Review Quote'})
    await ready()
    expect(api.authors.create).toHaveBeenCalledTimes(1)
    expect(api.candidateAuthors.update).toHaveBeenCalledTimes(2)
    expect(onAuthorCreated).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Author (required)').value).toBe('7')
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
    expect(api.candidateAuthors.update).toHaveBeenCalledWith(3, {
      fullName: duplicate.fullName, status: 'APPROVED', publishedAuthorId: duplicate.id,
    })
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Author (required)').value).toBe(String(duplicate.id))
  })

  it('lets the reviewer continue with a new author after finding a possible duplicate', async () => {
    pendingAuthor()
    api.authors.list.mockResolvedValue([{...author, fullName: candidateAuthor.fullName}])
    render(<CandidateReview />)

    await openNext()
    fireEvent.click(screen.getByRole('button', {name: 'Create a new author'}))
    expect(await screen.findByRole('dialog', {name: 'Review author'})).toBeTruthy()
    expect(screen.getByLabelText('Full name (required)').value).toBe(candidateAuthor.fullName)
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

  it('retains the quote draft when publication fails and prevents duplicate writes and cancellation while saving', async () => {
    const pending = deferred()
    api.quotes.create.mockReturnValueOnce(pending.promise)
    render(<CandidateReview />)
    await openNext()
    await ready()
    fireEvent.change(screen.getByLabelText('Quote text (required)'), {target: {value: 'Kept draft'}})
    const form = screen.getByRole('button', {name: 'Approve'}).closest('form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(api.quotes.create).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('button', {name: 'Close quote form'}).disabled).toBe(true)
    const cancel = new Event('cancel', {cancelable: true})
    fireEvent(screen.getByRole('dialog'), cancel)
    expect(cancel.defaultPrevented).toBe(true)
    await act(async () => pending.resolve(Promise.reject(new Error('Publish failed'))))
    expect((await screen.findByRole('alert')).textContent).toContain('Publish failed')
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Quote text (required)').value).toBe('Kept draft')
    expect(api.candidateQuotes.update).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}))
    await screen.findByText(/Candidate approved\./)
  })

  it('retries only the quote link after partial success, including after closing and reopening', async () => {
    api.candidateQuotes.listPage.mockResolvedValueOnce(page([candidate]))
    api.candidateQuotes.update.mockRejectedValueOnce(new Error('Approval failed'))
    const onQuoteCreated = vi.fn()
    render(<CandidateReview onQuoteCreated={onQuoteCreated} />)
    await openNext()
    await ready()
    fireEvent.change(screen.getByLabelText('Quote text (required)'), {target: {value: 'Saved edit'}})
    fireEvent.click(screen.getByRole('button', {name: 'Approve'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Approval failed')
    expect(api.candidateQuotes.listPage).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Quote text (required)').matches(':disabled')).toBe(true)
    expect(screen.getByRole('button', {name: 'Reject'}).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', {name: 'Close quote form'}))
    await openNext()
    expect(screen.getByLabelText('Quote text (required)').value).toBe('Saved edit')
    fireEvent.click(screen.getByRole('button', {name: 'Retry approval'}))
    await screen.findByText(/Candidate approved\./)
    expect(api.quotes.create).toHaveBeenCalledTimes(1)
    expect(api.candidateQuotes.update).toHaveBeenCalledTimes(2)
    expect(api.candidateQuotes.update).toHaveBeenLastCalledWith(12, {
      text: 'Saved edit', status: 'APPROVED', publishedQuoteId: 42,
    })
    expect(onQuoteCreated).toHaveBeenCalledTimes(1)
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
    expect(api.quotes.create).not.toHaveBeenCalled()
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
