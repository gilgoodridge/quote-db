import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '../api'
import QuotesList from './QuotesList'

const author = {id: 7, fullName: 'Samuel Clemens', knownAs: 'Mark Twain'}
const quote = {id: 42, text: 'A quote', author}

function quotePage(content = [quote], number = 0, size = 20, totalElements = content.length) {
  return {content, page: {number, size, totalElements, totalPages: Math.ceil(totalElements / size)}}
}

beforeEach(() => {
  vi.spyOn(api.authors, 'get').mockResolvedValue(author)
  vi.spyOn(api.quotes, 'listPage').mockResolvedValue(quotePage())
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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

describe('selected author heading', () => {
  it('shows the display name once above filtered quotes for anonymous and signed-in users', async () => {
    const {rerender} = render(<QuotesList authorId={7} />)
    await screen.findByText(quote.text)
    await screen.findByRole('heading', {name: 'Mark Twain'})
    expect(screen.getAllByText('Mark Twain')).toHaveLength(1)
    expect(api.authors.get).toHaveBeenCalledWith(7)
    rerender(<QuotesList authorId={7} isAuthenticated />)
    expect(screen.getAllByText('Mark Twain')).toHaveLength(1)
  })

  it('falls back to the full name and remains visible when search and category filters have no matches', async () => {
    api.authors.get.mockResolvedValue({...author, knownAs: null})
    api.quotes.listPage.mockResolvedValue(quotePage([]))
    render(<QuotesList authorId={7} query="missing" categoryIds={{toneIds: [1]}} />)
    await screen.findByRole('heading', {name: 'Samuel Clemens'})
    await screen.findByRole('heading', {name: 'No Quotes Found'})
    expect(screen.queryByText('Mark Twain')).toBeNull()
  })

  it('shows the heading independently of quote loading and failures', async () => {
    let rejectQuotes
    api.quotes.listPage.mockReturnValue(new Promise((resolve, reject) => { rejectQuotes = reject }))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<QuotesList authorId={7} />)
    await screen.findByRole('heading', {name: 'Mark Twain'})
    expect(screen.getByText('Loading quotes...')).toBeTruthy()
    await act(async () => rejectQuotes(new Error('Offline')))
    expect(screen.getByRole('heading', {name: 'Mark Twain'})).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Offline')
  })

  it('keeps individual author names in mixed-author results without fetching an author', async () => {
    render(<QuotesList query="quote" />)
    await screen.findByText('Mark Twain')
    expect(screen.queryByRole('heading', {name: 'Mark Twain'})).toBeNull()
    expect(api.authors.get).not.toHaveBeenCalled()
  })

  it('makes author lookup failures retryable without blocking quotes', async () => {
    api.authors.get.mockRejectedValueOnce(new Error('Offline'))
    render(<QuotesList authorId={7} />)
    await screen.findByText(quote.text)
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to load author: Offline')
    fireEvent.click(screen.getByRole('button', {name: 'Retry author'}))
    await screen.findByRole('heading', {name: 'Mark Twain'})
    expect(screen.queryByRole('alert')).toBeNull()
    expect(api.quotes.listPage).toHaveBeenCalledTimes(1)
  })

  it('ignores outdated author responses after the selection changes', async () => {
    let resolveFirst
    api.authors.get.mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve }))
    api.authors.get.mockResolvedValueOnce({id: 8, fullName: 'Jane Doe'})
    const {rerender} = render(<QuotesList authorId={7} />)
    expect(screen.getByText('Loading author...')).toBeTruthy()
    rerender(<QuotesList authorId={8} />)
    await screen.findByRole('heading', {name: 'Jane Doe'})
    await act(async () => resolveFirst(author))
    expect(screen.queryByText('Mark Twain')).toBeNull()
    expect(screen.getByRole('heading', {name: 'Jane Doe'})).toBeTruthy()
    rerender(<QuotesList query="quote" />)
    await waitFor(() => expect(screen.queryByRole('heading', {name: 'Jane Doe'})).toBeNull())
  })
})
