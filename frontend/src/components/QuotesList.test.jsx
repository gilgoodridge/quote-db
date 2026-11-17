import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '../api'
import QuotesList from './QuotesList'

const author = {id: 7, fullName: 'Samuel Clemens', knownAs: 'Mark Twain'}
const quote = {id: 42, text: 'A quote', author}

function quotePage(content = [quote], number = 0, size = 20, totalElements = content.length) {
  return {content, page: {number, size, totalElements, totalPages: Math.ceil(totalElements / size)}}
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
  vi.spyOn(api.authors, 'get').mockResolvedValue(author)
  vi.spyOn(api.quotes, 'listPage').mockResolvedValue(quotePage())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('quote references', () => {
  it('shows original references while adding the quote only to eligible link destinations', async () => {
    const primaryReference = 'https://example.com/source?part=1'
    const secondaryReference = 'https://example.com/source#chapter'
    api.quotes.listPage.mockResolvedValue(quotePage([{
      ...quote, text: 'One two three four five six seven eight nine',
      primaryReference, secondaryReference,
    }]))
    render(<QuotesList authorId={7} />)
    fireEvent.click(await screen.findByRole('button', {name: /One two three four/}))
    const primary = screen.getByRole('link', {name: primaryReference})
    const secondary = screen.getByRole('link', {name: secondaryReference})
    expect(primary.getAttribute('href')).toBe(`${primaryReference}#:~:text=One%20two%20three%20four,six%20seven%20eight%20nine`)
    expect(primary.textContent).toBe(primaryReference)
    expect(primary.target).toBe('_blank')
    expect(primary.rel).toBe('noopener noreferrer')
    expect(secondary.getAttribute('href')).toBe(secondaryReference)
  })
})

describe('quote pagination', () => {
  it('loads only the requested page and shows one-based navigation with bounded links', async () => {
    vi.spyOn(api.quotes, 'list')
    api.quotes.listPage.mockImplementation(async (_author, _query, _categories, {page, size}) =>
      quotePage([{...quote, id: page + 1, text: `Quote on page ${page + 1}`}], page, size, 41))
    const categoryIds = {toneIds: [2, 3], themeIds: [4]}
    render(<QuotesList authorId={7} query="love" categoryIds={categoryIds} />)
    await screen.findByText('Quote on page 1')
    const nav = screen.getByRole('navigation', {name: 'Quote pagination'})
    expect(within(nav).getByText('Page 1 of 3')).toBeTruthy()
    expect(screen.getByRole('button', {name: 'Previous'}).disabled).toBe(true)
    expect(screen.getByLabelText('Quotes per page').value).toBe('20')
    expect(api.quotes.listPage).toHaveBeenLastCalledWith(7, 'love', categoryIds, {page: 0, size: 20})
    fireEvent.click(screen.getByRole('button', {name: 'Next'}))
    await screen.findByText('Quote on page 2')
    expect(screen.queryByText('Quote on page 1')).toBeNull()
    expect(within(nav).getByText('Page 2 of 3')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', {name: 'Next'}))
    await screen.findByText('Quote on page 3')
    expect(screen.getByRole('button', {name: 'Next'}).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', {name: 'Previous'}))
    await screen.findByText('Quote on page 2')
    expect(api.quotes.listPage).toHaveBeenLastCalledWith(7, 'love', categoryIds, {page: 1, size: 20})
    expect(api.quotes.list).not.toHaveBeenCalled()
  })

  it('offers exactly the allowed sizes and resets to API page zero on size changes', async () => {
    api.quotes.listPage.mockImplementation(async (_author, _query, _categories, {page, size}) =>
      quotePage([quote], page, size, 201))
    render(<QuotesList query="quote" />)
    await screen.findByText('Page 1 of 11')
    const select = screen.getByLabelText('Quotes per page')
    expect(within(select).getAllByRole('option').map((option) => option.value)).toEqual(['10', '20', '50', '100'])
    for (const size of [10, 50, 100, 20]) {
      fireEvent.click(screen.getByRole('button', {name: 'Next'}))
      await screen.findByText(`Page 2 of ${Math.ceil(201 / Number(select.value))}`)
      fireEvent.change(select, {target: {value: String(size)}})
      await screen.findByText(`Page 1 of ${Math.ceil(201 / size)}`)
      expect(api.quotes.listPage).toHaveBeenLastCalledWith(null, 'quote', expect.any(Object), {page: 0, size})
    }
  })

  it('resets pages on author, search, or category changes while retaining page size', async () => {
    api.quotes.listPage.mockImplementation(async (_author, _query, _categories, {page, size}) =>
      quotePage([quote], page, size, 60))
    const {rerender} = render(<QuotesList authorId={7} />)
    await screen.findByText('Page 1 of 3')
    fireEvent.change(screen.getByLabelText('Quotes per page'), {target: {value: '10'}})
    await screen.findByText('Page 1 of 6')
    for (const props of [{authorId: 8}, {authorId: 8, query: 'love'}, {authorId: 8, query: 'love', categoryIds: {toneIds: [2]}}]) {
      fireEvent.click(screen.getByRole('button', {name: 'Next'}))
      await screen.findByText('Page 2 of 6')
      rerender(<QuotesList {...props} />)
      await screen.findByText('Page 1 of 6')
      expect(api.quotes.listPage).toHaveBeenLastCalledWith(props.authorId, props.query ?? '', props.categoryIds ?? expect.any(Object), {page: 0, size: 10})
    }
    rerender(<QuotesList />)
    expect(screen.queryByRole('navigation', {name: 'Quote pagination'})).toBeNull()
  })

  it('disables navigation during loading, retries the failed page, and ignores stale responses', async () => {
    let resolveOld
    api.quotes.listPage.mockResolvedValueOnce(quotePage([quote], 0, 20, 40))
    api.quotes.listPage.mockReturnValueOnce(new Promise((resolve) => {resolveOld = resolve}))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const {rerender} = render(<QuotesList query="first" />)
    await screen.findByText('Page 1 of 2')
    fireEvent.click(screen.getByRole('button', {name: 'Next'}))
    expect(screen.getByRole('button', {name: 'Next'}).disabled).toBe(true)
    expect(screen.getByRole('button', {name: 'Previous'}).disabled).toBe(true)
    api.quotes.listPage.mockRejectedValueOnce(new Error('Offline'))
    rerender(<QuotesList query="second" />)
    expect((await screen.findByRole('alert')).textContent).toContain('Offline')
    api.quotes.listPage.mockResolvedValueOnce(quotePage([{...quote, text: 'Current result'}]))
    fireEvent.click(screen.getByRole('button', {name: 'Retry quotes'}))
    await screen.findByText('Current result')
    await act(async () => resolveOld(quotePage([{...quote, text: 'Stale result'}], 1, 20, 40)))
    expect(screen.queryByText('Stale result')).toBeNull()
    expect(api.quotes.listPage).toHaveBeenLastCalledWith(null, 'second', expect.any(Object), {page: 0, size: 20})
  })

  it('shows zero results without inventing a page and keeps paging disabled', async () => {
    api.quotes.listPage.mockResolvedValue(quotePage([]))
    render(<QuotesList query="missing" />)
    await screen.findByText('0 quotes')
    expect(screen.getByRole('button', {name: 'Next'}).disabled).toBe(true)
    expect(screen.getByRole('button', {name: 'Previous'}).disabled).toBe(true)
    expect(screen.getByRole('heading', {name: 'No Quotes Found'})).toBeTruthy()
  })

  it('retries a failed next page without changing its number, size, or filters', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    api.quotes.listPage.mockResolvedValueOnce(quotePage([quote], 0, 20, 40))
    api.quotes.listPage.mockRejectedValueOnce(new Error('Page unavailable'))
    api.quotes.listPage.mockResolvedValueOnce(quotePage([{...quote, text: 'Second page'}], 1, 20, 40))
    render(<QuotesList authorId={7} query="love" categoryIds={{toneIds: [2]}} />)
    await screen.findByText('Page 1 of 2')
    fireEvent.click(screen.getByRole('button', {name: 'Next'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Page unavailable')
    fireEvent.click(screen.getByRole('button', {name: 'Retry quotes'}))
    await screen.findByText('Second page')
    expect(screen.getByText('Page 2 of 2')).toBeTruthy()
    expect(api.quotes.listPage).toHaveBeenLastCalledWith(7, 'love', {toneIds: [2]}, {page: 1, size: 20})
  })

  it('refreshes totals after deletion and returns to the last remaining page', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    vi.spyOn(api.quotes, 'delete').mockResolvedValue(true)
    api.quotes.listPage.mockResolvedValueOnce(quotePage([quote], 0, 20, 21))
    api.quotes.listPage.mockResolvedValueOnce(quotePage([{...quote, id: 43}], 1, 20, 21))
    api.quotes.listPage.mockResolvedValueOnce(quotePage([], 1, 20, 20))
    api.quotes.listPage.mockResolvedValueOnce(quotePage([quote], 0, 20, 20))
    render(<QuotesList authorId={7} isAuthenticated />)
    await screen.findByText('Page 1 of 2')
    fireEvent.click(screen.getByRole('button', {name: 'Next'}))
    await screen.findByText('Page 2 of 2')
    fireEvent.click(screen.getByRole('button', {name: 'Delete quote'}))
    await screen.findByText('Page 1 of 1')
    expect(api.quotes.delete).toHaveBeenCalledWith(43)
    expect(api.quotes.listPage).toHaveBeenLastCalledWith(7, '', expect.any(Object), {page: 0, size: 20})
    expect(screen.getByText('Quote deleted.')).toBeTruthy()
  })
})

describe('deleting quotes linked to candidates', () => {
  function conflict(status = 409, code = 'QUOTE_LINKED_TO_CANDIDATES') {
    return Object.assign(new Error('Quote is linked to candidate review data'), {status, code})
  }

  async function attemptDelete(props = {}) {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<QuotesList authorId={7} isAuthenticated {...props} />)
    const button = await screen.findByRole('button', {name: 'Delete quote'})
    button.focus()
    fireEvent.click(button)
    return button
  }

  it.each([
    ['Reject candidates and delete quote', 'REJECTED'],
    ['Return candidates to Pending and delete quote', 'PENDING'],
  ])('supports %s only after the specific conflict', async (label, candidateStatus) => {
    vi.spyOn(api.quotes, 'delete').mockRejectedValueOnce(conflict()).mockResolvedValueOnce(true)
    const onCandidatesChanged = vi.fn()
    await attemptDelete({onCandidatesChanged})
    const dialog = await screen.findByRole('dialog', {name: 'Quote linked to candidates'})
    expect(api.quotes.delete).toHaveBeenCalledTimes(1)
    api.quotes.listPage.mockResolvedValue(quotePage([]))
    fireEvent.click(within(dialog).getByRole('button', {name: label}))
    await screen.findByText('Quote deleted.')
    expect(api.quotes.delete).toHaveBeenLastCalledWith(42, {candidateStatus})
    expect(onCandidatesChanged).toHaveBeenCalledWith(42)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByText(quote.text)).toBeNull()
    expect(document.activeElement).toBe(screen.getByLabelText('Quotes'))
  })

  it('cancels without changing candidates or retrying deletion and restores focus', async () => {
    vi.spyOn(api.quotes, 'delete').mockRejectedValueOnce(conflict())
    const button = await attemptDelete()
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', {name: 'Cancel'}))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(api.quotes.delete).toHaveBeenCalledTimes(1)
    expect(document.activeElement).toBe(button)
    expect(screen.getByText(quote.text)).toBeTruthy()
  })

  it.each([[409, undefined], [409, 'OTHER_CONFLICT'], [403, 'QUOTE_LINKED_TO_CANDIDATES']])(
    'does not offer recovery for status %s and code %s',
    async (status, code) => {
      vi.spyOn(api.quotes, 'delete').mockRejectedValueOnce(Object.assign(new Error('Other failure'), {status, code}))
      await attemptDelete()
      expect((await screen.findByRole('alert')).textContent).toContain('Other failure')
      expect(screen.queryByRole('dialog')).toBeNull()
      expect(screen.getByText(quote.text)).toBeTruthy()
    },
  )

  it('keeps failures retryable, blocks duplicate writes and dismissal while saving', async () => {
    let rejectRecovery
    vi.spyOn(api.quotes, 'delete').mockRejectedValueOnce(conflict())
      .mockImplementationOnce(() => new Promise((_resolve, reject) => { rejectRecovery = reject }))
      .mockResolvedValueOnce(true)
    const onCandidatesChanged = vi.fn()
    await attemptDelete({onCandidatesChanged})
    const dialog = await screen.findByRole('dialog')
    const reject = within(dialog).getByRole('button', {name: 'Reject candidates and delete quote'})
    fireEvent.click(reject)
    fireEvent.click(reject)
    expect(within(dialog).getAllByRole('button').every((button) => button.disabled)).toBe(true)
    expect(fireEvent(dialog, new Event('cancel', {cancelable: true}))).toBe(false)
    expect(api.quotes.delete).toHaveBeenCalledTimes(2)
    await act(async () => rejectRecovery(new Error('Deletion failed; transaction rolled back')))
    expect(within(dialog).getByRole('alert').textContent).toContain('transaction rolled back')
    expect(screen.getAllByText(quote.text)).toHaveLength(2)
    expect(onCandidatesChanged).not.toHaveBeenCalled()
    api.quotes.listPage.mockResolvedValue(quotePage([]))
    fireEvent.click(reject)
    await screen.findByText('Quote deleted.')
    expect(api.quotes.delete).toHaveBeenCalledTimes(3)
    expect(onCandidatesChanged).toHaveBeenCalledOnce()
  })

  it('does not send a request after cancelling the initial confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.spyOn(api.quotes, 'delete')
    render(<QuotesList authorId={7} isAuthenticated />)
    fireEvent.click(await screen.findByRole('button', {name: 'Delete quote'}))
    expect(api.quotes.delete).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('per-quote author attribution', () => {
  it('shows the author beneath every filtered quote for anonymous and signed-in users', async () => {
    api.quotes.listPage.mockResolvedValue(quotePage([quote, {...quote, id: 43, text: 'Another quote'}]))
    const {rerender} = render(<QuotesList authorId={7} />)
    await screen.findByText(quote.text)
    expect(screen.getAllByRole('button', {name: 'Mark Twain'})).toHaveLength(2)
    expect(screen.queryByRole('heading', {name: 'Mark Twain'})).toBeNull()
    expect(api.authors.get).not.toHaveBeenCalled()
    rerender(<QuotesList authorId={7} isAuthenticated />)
    expect(screen.getAllByRole('button', {name: 'Mark Twain'})).toHaveLength(2)
  })

  it('falls back to the full name in the quote response', async () => {
    api.quotes.listPage.mockResolvedValue(quotePage([{...quote, author: {...author, knownAs: null}}]))
    render(<QuotesList authorId={7} />)
    const link = await screen.findByRole('button', {name: 'Samuel Clemens'})
    expect(link.closest('.quote-author').textContent).toBe('Samuel Clemens')
    expect(screen.queryByText('Mark Twain')).toBeNull()
  })

  it('does not show an author heading when there are no matching quotes', async () => {
    api.quotes.listPage.mockResolvedValue(quotePage([]))
    render(<QuotesList authorId={7} query="missing" categoryIds={{toneIds: [1]}} />)
    await screen.findByRole('heading', {name: 'No Quotes Found'})
    expect(screen.queryByText('Mark Twain')).toBeNull()
    expect(api.authors.get).not.toHaveBeenCalled()
  })

  it('does not fetch or show a selected author heading during quote loading or failures', async () => {
    let rejectQuotes
    api.quotes.listPage.mockReturnValue(new Promise((resolve, reject) => { rejectQuotes = reject }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<QuotesList authorId={7} />)
    expect(screen.getByText('Loading quotes...')).toBeTruthy()
    await act(async () => rejectQuotes(new Error('Offline')))
    expect(screen.queryByText('Mark Twain')).toBeNull()
    expect(screen.getByRole('alert').textContent).toContain('Offline')
    expect(api.authors.get).not.toHaveBeenCalled()
  })

  it('keeps individual author names in mixed-author results without fetching an author', async () => {
    render(<QuotesList query="quote" />)
    await screen.findByText('Mark Twain')
    expect(screen.queryByRole('heading', {name: 'Mark Twain'})).toBeNull()
    expect(api.authors.get).not.toHaveBeenCalled()
  })

  it('ignores outdated quote attributions after the author selection changes', async () => {
    let resolveFirst
    api.quotes.listPage.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
    api.quotes.listPage.mockResolvedValueOnce(quotePage([{...quote, author: {id: 8, fullName: 'Jane Doe'}}]))
    const {rerender} = render(<QuotesList authorId={7} />)
    rerender(<QuotesList authorId={8} />)
    await screen.findByRole('button', {name: 'Jane Doe'})
    await act(async () => resolveFirst(quotePage()))
    expect(screen.queryByText('Mark Twain')).toBeNull()
    expect(screen.getByRole('button', {name: 'Jane Doe'})).toBeTruthy()
  })
})
