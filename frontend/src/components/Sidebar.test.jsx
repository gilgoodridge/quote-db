import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {api} from '../api'
import Sidebar from './Sidebar'

const author = {id: 7, fullName: 'William Shakespeare', knownAs: 'The Bard'}
const other = {id: 8, fullName: 'Jane Austen'}
const categoryIds = {toneIds: [1], themeIds: [], formIds: [], sourceIds: []}

function authorPage(content, number = 0, totalElements = content.length) {
  return {content, page: {number, size: 10, totalElements, totalPages: Math.ceil(totalElements / 10)}}
}

beforeEach(() => {
  vi.spyOn(api.authors, 'listPage').mockResolvedValue(authorPage([author, other]))
  vi.spyOn(api.categories, 'list').mockResolvedValue({
    tones: [{id: 1, name: 'Funny'}], themes: [], forms: [], sources: [],
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function sidebar(props = {}) {
  return <Sidebar selectedAuthorId={7} selectedCategoryIds={categoryIds}
    onAuthorSelect={vi.fn()} onCategoryIdsChange={vi.fn()} {...props} />
}

function submit(query) {
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: query}})
  fireEvent.submit(screen.getByRole('search', {name: 'Author search'}))
}

it('searches after exactly 500 ms of inactivity and restarts the delay on typing', async () => {
  const onAuthorSelect = vi.fn()
  const onCategoryIdsChange = vi.fn()
  render(sidebar({onAuthorSelect, onCategoryIdsChange}))
  await screen.findByRole('button', {name: 'The Bard'})
  vi.useFakeTimers()
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: 'sha'}})
  await act(async () => vi.advanceTimersByTimeAsync(300))
  expect(api.authors.listPage).toHaveBeenCalledTimes(1)
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: ' shake '}})
  await act(async () => vi.advanceTimersByTimeAsync(499))
  expect(api.authors.listPage).toHaveBeenCalledTimes(1)
  await act(async () => vi.advanceTimersByTimeAsync(1))
  expect(api.authors.listPage).toHaveBeenCalledTimes(2)
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: 'shake', page: 0, size: 10})
  expect(onAuthorSelect).not.toHaveBeenCalled()
  expect(onCategoryIdsChange).not.toHaveBeenCalled()
})

it('submits immediately without a duplicate delayed search', async () => {
  render(sidebar())
  await screen.findByRole('button', {name: 'The Bard'})
  vi.useFakeTimers()
  submit('shake')
  await act(async () => {})
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: 'shake', page: 0, size: 10})
  expect(api.authors.listPage).toHaveBeenCalledTimes(2)
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(api.authors.listPage).toHaveBeenCalledTimes(2)
})

it('clearing and unmounting cancel pending searches', async () => {
  const {unmount} = render(sidebar())
  await screen.findByRole('button', {name: 'The Bard'})
  vi.useFakeTimers()
  submit('shake')
  await act(async () => {})
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: 'jane'}})
  await act(async () => vi.advanceTimersByTimeAsync(250))
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: ''}})
  await act(async () => {})
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: '', page: 0, size: 10})
  expect(api.authors.listPage).toHaveBeenCalledTimes(3)
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(api.authors.listPage).toHaveBeenCalledTimes(3)
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: 'jane'}})
  unmount()
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(api.authors.listPage).toHaveBeenCalledTimes(3)
})

it('submits trimmed queries, clears immediately, and leaves quote filters unchanged', async () => {
  const onAuthorSelect = vi.fn()
  const onCategoryIdsChange = vi.fn()
  render(sidebar({onAuthorSelect, onCategoryIdsChange}))
  await screen.findByRole('button', {name: 'Jane Austen'})
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: ' shake '}})
  expect(api.authors.listPage).toHaveBeenCalledTimes(1)
  api.authors.listPage.mockResolvedValueOnce(authorPage([author]))
  fireEvent.click(screen.getByRole('button', {name: 'Search authors'}))
  await waitFor(() => expect(screen.queryByRole('button', {name: 'Jane Austen'})).toBeNull())
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: 'shake', page: 0, size: 10})
  expect(screen.getByRole('button', {name: 'The Bard'}).getAttribute('aria-pressed')).toBe('true')
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: ''}})
  await screen.findByRole('button', {name: 'Jane Austen'})
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: '', page: 0, size: 10})
  expect(onAuthorSelect).not.toHaveBeenCalled()
  expect(onCategoryIdsChange).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', {name: 'All authors'}))
  expect(onAuthorSelect).toHaveBeenCalledWith(null)
})

it('shows no matches without clearing a selected author and retains query on refresh', async () => {
  const onAuthorSelect = vi.fn()
  const {rerender} = render(sidebar({onAuthorSelect}))
  await screen.findByRole('button', {name: 'The Bard'})
  api.authors.listPage.mockResolvedValue(authorPage([]))
  submit('missing')
  await screen.findByText('No authors found')
  rerender(sidebar({onAuthorSelect, refreshKey: 1}))
  await waitFor(() => expect(api.authors.listPage).toHaveBeenCalledTimes(3))
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: 'missing', page: 0, size: 10})
  expect(screen.getByRole('searchbox').value).toBe('missing')
  expect(onAuthorSelect).not.toHaveBeenCalled()
})

it('shows retryable errors, hides stale results, and supports resubmission', async () => {
  render(sidebar())
  await screen.findByRole('button', {name: 'The Bard'})
  api.authors.listPage.mockRejectedValueOnce(new Error('Search unavailable'))
  submit('shake')
  await screen.findByRole('alert')
  expect(screen.getByRole('alert').textContent).toContain('Search unavailable')
  expect(screen.queryByText('No authors found')).toBeNull()
  expect(screen.queryByRole('button', {name: 'The Bard'})).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Retry loading authors'}))
  await screen.findByRole('button', {name: 'The Bard'})
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: 'shake', page: 0, size: 10})
  submit('shake')
  await waitFor(() => expect(api.authors.listPage).toHaveBeenCalledTimes(4))
})

it('ignores outdated responses while a newer query is loading', async () => {
  render(sidebar())
  await screen.findByRole('button', {name: 'The Bard'})
  let resolveOld
  let resolveNew
  api.authors.listPage.mockImplementationOnce(() => new Promise((resolve) => {resolveOld = resolve}))
    .mockImplementationOnce(() => new Promise((resolve) => {resolveNew = resolve}))
  submit('shake')
  await waitFor(() => expect(api.authors.listPage).toHaveBeenLastCalledWith({query: 'shake', page: 0, size: 10}))
  submit('jane')
  await waitFor(() => expect(api.authors.listPage).toHaveBeenLastCalledWith({query: 'jane', page: 0, size: 10}))
  await act(async () => resolveOld(authorPage([author])))
  expect(screen.getByText('Loading authors...')).toBeTruthy()
  expect(screen.queryByRole('button', {name: 'The Bard'})).toBeNull()
  await act(async () => resolveNew(authorPage([other])))
  await screen.findByRole('button', {name: 'Jane Austen'})
  expect(screen.queryByRole('button', {name: 'The Bard'})).toBeNull()
})

it('loads only ten initially and appends more pages on demand until the last page', async () => {
  const authors = Array.from({length: 23}, (_, index) => ({id: index + 1, fullName: `Author ${index + 1}`}))
  api.authors.listPage.mockImplementation(async ({page}) =>
    authorPage(authors.slice(page * 10, (page + 1) * 10), page, 23))
  render(sidebar())
  await screen.findByRole('button', {name: 'Author 10'})
  expect(screen.queryByRole('button', {name: 'Author 11'})).toBeNull()
  expect(api.authors.listPage).toHaveBeenCalledTimes(1)
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: '', page: 0, size: 10})
  fireEvent.click(screen.getByRole('button', {name: 'More authors'}))
  await screen.findByRole('button', {name: 'Author 20'})
  expect(screen.getByRole('button', {name: 'Author 1'})).toBeTruthy()
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: '', page: 1, size: 10})
  fireEvent.click(screen.getByRole('button', {name: 'More authors'}))
  await screen.findByRole('button', {name: 'Author 23'})
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: '', page: 2, size: 10})
  expect(screen.queryByRole('button', {name: 'More authors'})).toBeNull()
})

it('retains loaded authors on a more-page failure and retries the same query and page', async () => {
  api.authors.listPage.mockResolvedValueOnce(authorPage([author], 0, 11))
  render(sidebar())
  await screen.findByRole('button', {name: 'The Bard'})
  api.authors.listPage.mockResolvedValueOnce(authorPage([author], 0, 11))
  submit('shake')
  await waitFor(() => expect(api.authors.listPage).toHaveBeenCalledTimes(2))
  api.authors.listPage.mockRejectedValueOnce(new Error('Page unavailable'))
  fireEvent.click(screen.getByRole('button', {name: 'More authors'}))
  await screen.findByRole('alert')
  expect(screen.getByRole('button', {name: 'The Bard'})).toBeTruthy()
  expect(screen.getByRole('alert').textContent).toContain('Page unavailable')
  api.authors.listPage.mockResolvedValueOnce(authorPage([other], 1, 11))
  fireEvent.click(screen.getByRole('button', {name: 'Retry loading authors'}))
  await screen.findByRole('button', {name: 'Jane Austen'})
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: 'shake', page: 1, size: 10})
  expect(screen.queryByRole('alert')).toBeNull()
})

it('ignores pending more pages on a new search and resets pages on refresh and clearing', async () => {
  api.authors.listPage.mockResolvedValue(authorPage([author], 0, 11))
  const {rerender} = render(sidebar())
  await screen.findByRole('button', {name: 'The Bard'})
  let resolveMore
  api.authors.listPage.mockImplementationOnce(() => new Promise((resolve) => {resolveMore = resolve}))
  fireEvent.click(screen.getByRole('button', {name: 'More authors'}))
  expect(screen.getByRole('button', {name: 'Loading more authors...'}).disabled).toBe(true)
  expect(screen.getByRole('button', {name: 'The Bard'})).toBeTruthy()
  api.authors.listPage.mockResolvedValue(authorPage([other]))
  submit('jane')
  await screen.findByRole('button', {name: 'Jane Austen'})
  await act(async () => resolveMore(authorPage([author], 1, 11)))
  expect(screen.queryByRole('button', {name: 'The Bard'})).toBeNull()
  rerender(sidebar({refreshKey: 1}))
  await waitFor(() => expect(api.authors.listPage).toHaveBeenCalledTimes(4))
  expect(api.authors.listPage).toHaveBeenLastCalledWith({query: 'jane', page: 0, size: 10})
  fireEvent.change(screen.getByRole('searchbox'), {target: {value: ''}})
  await waitFor(() => expect(api.authors.listPage).toHaveBeenLastCalledWith({query: '', page: 0, size: 10}))
})
