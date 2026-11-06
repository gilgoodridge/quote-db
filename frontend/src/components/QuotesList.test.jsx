import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '../api'
import QuotesList from './QuotesList'

const author = {id: 7, fullName: 'Samuel Clemens', knownAs: 'Mark Twain'}
const quote = {id: 42, text: 'A quote', author}

beforeEach(() => {
  vi.spyOn(api.authors, 'get').mockResolvedValue(author)
  vi.spyOn(api.quotes, 'list').mockResolvedValue([quote])
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
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
    api.quotes.list.mockResolvedValue([])
    render(<QuotesList authorId={7} query="missing" categoryIds={{toneIds: [1]}} />)
    await screen.findByRole('heading', {name: 'Samuel Clemens'})
    await screen.findByRole('heading', {name: 'No Quotes Found'})
    expect(screen.queryByText('Mark Twain')).toBeNull()
  })

  it('shows the heading independently of quote loading and failures', async () => {
    let rejectQuotes
    api.quotes.list.mockReturnValue(new Promise((resolve, reject) => { rejectQuotes = reject }))
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
    expect(api.quotes.list).toHaveBeenCalledTimes(1)
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
