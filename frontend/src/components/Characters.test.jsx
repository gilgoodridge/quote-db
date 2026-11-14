import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {api} from '../api'
import App from '../App'
import Sidebar from './Sidebar'
import AddQuoteDialog from './AddQuoteDialog'
import AddCharacterDialog from './AddCharacterDialog'
import AboutCharacterDialog from './AboutCharacterDialog'
import QuotesList from './QuotesList'

const author = {id: 7, fullName: 'William Shakespeare'}
const character = {id: 4, fullName: 'Hamlet', knownAs: 'Prince Hamlet', workTitle: 'Hamlet', description: 'First line\nSecond line'}
const other = {id: 5, fullName: 'Hamlet', workTitle: 'Another work'}
const quote = {id: 42, text: 'To be, or not to be', author, character}
const catalog = {tones: [], themes: [], forms: [], sources: []}
const selections = {toneIds: [], themeIds: [], formIds: [], sourceIds: []}
function page(content, number = 0, size = 10, totalElements = content.length) {
  return {content, page: {number, size, totalElements, totalPages: Math.ceil(totalElements / size)}}
}

beforeEach(() => {
  vi.spyOn(api.auth, 'me').mockResolvedValue({authenticated: false})
  vi.spyOn(api.authors, 'list').mockResolvedValue([author])
  vi.spyOn(api.authors, 'listPage').mockResolvedValue(page([author]))
  vi.spyOn(api.authors, 'get').mockResolvedValue(author)
  vi.spyOn(api.characters, 'list').mockResolvedValue([character, other])
  vi.spyOn(api.characters, 'listPage').mockResolvedValue(page([character, other]))
  vi.spyOn(api.characters, 'get').mockResolvedValue(character)
  vi.spyOn(api.characters, 'create').mockResolvedValue(character)
  vi.spyOn(api.characters, 'update').mockResolvedValue(character)
  vi.spyOn(api.categories, 'list').mockResolvedValue(catalog)
  vi.spyOn(api.quotes, 'listPage').mockResolvedValue(page([quote], 0, 20))
  vi.spyOn(api.quotes, 'update').mockResolvedValue(quote)
  vi.spyOn(api.quotes, 'create').mockResolvedValue(quote)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  HTMLDialogElement.prototype.showModal = function () {this.open = true}
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function sidebar(props = {}) {
  return <Sidebar selectedAuthorId={7} selectedCharacterId={4} selectedCategoryIds={selections}
    onAuthorSelect={vi.fn()} onCharacterSelect={vi.fn()} onCategoryIdsChange={vi.fn()} {...props} />
}

function searchCharacters(value) {
  fireEvent.change(screen.getByRole('searchbox', {name: 'Search characters by full name'}), {target: {value}})
  fireEvent.submit(screen.getByRole('search', {name: 'Character search'}))
}

async function readyQuote() {
  await waitFor(() => expect(screen.getByRole('button', {name: 'Save quote'}).disabled).toBe(false))
}

it('combines character and author filters through the app and clears only the selected dimension', async () => {
  render(<App />)
  await screen.findByRole('button', {name: 'Prince Hamlet (Hamlet)'})
  expect(api.quotes.listPage).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', {name: 'Prince Hamlet (Hamlet)'}))
  await screen.findByText(quote.text)
  expect(api.quotes.listPage).toHaveBeenLastCalledWith(null, '', selections, {page: 0, size: 20, characterId: 4})
  fireEvent.click(screen.getByRole('button', {name: 'William Shakespeare', pressed: false}))
  await waitFor(() => expect(api.quotes.listPage).toHaveBeenLastCalledWith(7, '', selections, {page: 0, size: 20, characterId: 4}))
  fireEvent.click(screen.getByRole('button', {name: 'All characters'}))
  await waitFor(() => expect(api.quotes.listPage).toHaveBeenLastCalledWith(7, '', selections, {page: 0, size: 20}))
  expect(screen.queryByRole('button', {name: 'Add new character'})).toBeNull()
})

it('debounces character search independently and preserves selected filters', async () => {
  const onCharacterSelect = vi.fn()
  const onAuthorSelect = vi.fn()
  render(sidebar({onCharacterSelect, onAuthorSelect}))
  await screen.findByRole('button', {name: 'Prince Hamlet (Hamlet)'})
  vi.useFakeTimers()
  const search = screen.getByRole('searchbox', {name: 'Search characters by full name'})
  fireEvent.change(search, {target: {value: 'ham'}})
  await act(async () => vi.advanceTimersByTimeAsync(499))
  expect(api.characters.listPage).toHaveBeenCalledTimes(1)
  await act(async () => vi.advanceTimersByTimeAsync(1))
  expect(api.characters.listPage).toHaveBeenLastCalledWith({query: 'ham', page: 0, size: 10})
  searchCharacters(' hamlet ')
  await act(async () => {})
  await act(async () => vi.advanceTimersByTimeAsync(500))
  expect(api.characters.listPage).toHaveBeenCalledTimes(3)
  fireEvent.change(search, {target: {value: ''}})
  await act(async () => {})
  expect(api.characters.listPage).toHaveBeenLastCalledWith({query: '', page: 0, size: 10})
  expect(onCharacterSelect).not.toHaveBeenCalled()
  expect(onAuthorSelect).not.toHaveBeenCalled()
  expect(api.authors.listPage).toHaveBeenCalledTimes(1)
})

it('keeps character pages on failure, prevents duplicate loads, and retries the same page', async () => {
  api.characters.listPage.mockResolvedValueOnce(page([character], 0, 10, 11))
  render(sidebar())
  await screen.findByRole('button', {name: 'Prince Hamlet (Hamlet)'})
  let rejectMore
  api.characters.listPage.mockImplementationOnce(() => new Promise((_resolve, reject) => {rejectMore = reject}))
  fireEvent.click(screen.getByRole('button', {name: 'More characters'}))
  fireEvent.click(screen.getByRole('button', {name: 'Loading more characters...'}))
  expect(api.characters.listPage).toHaveBeenCalledTimes(2)
  await act(async () => rejectMore(new Error('Offline')))
  expect(screen.getByRole('button', {name: 'Prince Hamlet (Hamlet)'})).toBeTruthy()
  api.characters.listPage.mockResolvedValueOnce(page([other], 1, 10, 11))
  fireEvent.click(screen.getByRole('button', {name: 'Retry loading characters'}))
  await screen.findByRole('button', {name: 'Hamlet (Another work)'})
  expect(api.characters.listPage).toHaveBeenLastCalledWith({query: '', page: 1, size: 10})
  expect(screen.queryByRole('button', {name: 'More characters'})).toBeNull()
})

it('ignores stale character first/more pages and retains the search on refresh', async () => {
  api.characters.listPage.mockResolvedValueOnce(page([character], 0, 10, 11))
  const {rerender} = render(sidebar())
  await screen.findByRole('button', {name: 'Prince Hamlet (Hamlet)'})
  let resolveMore
  let resolveOld
  api.characters.listPage.mockImplementationOnce(() => new Promise((resolve) => {resolveMore = resolve}))
    .mockImplementationOnce(() => new Promise((resolve) => {resolveOld = resolve}))
    .mockResolvedValue(page([]))
  fireEvent.click(screen.getByRole('button', {name: 'More characters'}))
  searchCharacters('old')
  searchCharacters('missing')
  await screen.findByText('No characters found')
  await act(async () => {
    resolveMore(page([other], 1, 10, 11))
    resolveOld(page([character]))
  })
  expect(screen.queryByRole('button', {name: 'Prince Hamlet (Hamlet)'})).toBeNull()
  expect(screen.queryByRole('button', {name: 'Hamlet (Another work)'})).toBeNull()
  rerender(sidebar({charactersRefreshKey: 1}))
  await waitFor(() => expect(api.characters.listPage).toHaveBeenCalledTimes(5))
  expect(api.characters.listPage).toHaveBeenLastCalledWith({query: 'missing', page: 0, size: 10})
})

it('retries first-page errors without losing the character search', async () => {
  render(sidebar())
  await screen.findByRole('button', {name: 'Prince Hamlet (Hamlet)'})
  api.characters.listPage.mockRejectedValueOnce(new Error('Unavailable'))
  searchCharacters('hamlet')
  await screen.findByRole('button', {name: 'Retry loading characters'})
  expect(screen.queryByRole('button', {name: 'Prince Hamlet (Hamlet)'})).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Retry loading characters'}))
  await screen.findByRole('button', {name: 'Prince Hamlet (Hamlet)'})
  expect(api.characters.listPage).toHaveBeenLastCalledWith({query: 'hamlet', page: 0, size: 10})
})

it('shows public character details, preserves line breaks, and never offers anonymous edits', async () => {
  render(<AboutCharacterDialog characterId={4} onClose={vi.fn()} />)
  await screen.findByText('Prince Hamlet')
  expect(screen.getByText('First line Second line').textContent).toBe(character.description)
  expect(screen.queryByRole('button', {name: 'Edit character'})).toBeNull()
})

it('retries character details and restores focus after cancelling and saving edits', async () => {
  api.characters.get.mockRejectedValueOnce(new Error('Offline'))
  const onUpdated = vi.fn()
  const updated = {...character, knownAs: null, workTitle: null, description: null}
  api.characters.update.mockResolvedValue(updated)
  render(<AboutCharacterDialog characterId={4} isAuthenticated onClose={vi.fn()} onUpdated={onUpdated} />)
  await screen.findByRole('alert')
  fireEvent.click(screen.getByRole('button', {name: 'Retry character details'}))
  fireEvent.click(await screen.findByRole('button', {name: 'Edit character'}))
  fireEvent.change(screen.getByLabelText('Known as'), {target: {value: ''}})
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}))
  expect(screen.getByText('Prince Hamlet')).toBeTruthy()
  expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Edit character'}))
  fireEvent.click(screen.getByRole('button', {name: 'Edit character'}))
  for (const label of ['Known as', 'Work title', 'Description']) {
    fireEvent.change(screen.getByLabelText(label), {target: {value: '  '}})
  }
  fireEvent.click(screen.getByRole('button', {name: 'Save character'}))
  await screen.findByText('Character updated.')
  expect(api.characters.update).toHaveBeenCalledWith(4, {fullName: 'Hamlet', knownAs: null, workTitle: null, description: null})
  expect(onUpdated).toHaveBeenCalledWith(updated)
  expect(screen.getAllByText('Not provided')).toHaveLength(3)
})

it('validates names and retains failed character drafts; blocks duplicate saves and dismissal', async () => {
  const onClose = vi.fn()
  const onCreated = vi.fn()
  render(<AddCharacterDialog onClose={onClose} onCreated={onCreated} />)
  fireEvent.change(screen.getByLabelText('Full name (required)'), {target: {value: '  '}})
  fireEvent.click(screen.getByRole('button', {name: 'Save character'}))
  expect(screen.getByRole('alert').textContent).toContain('not just whitespace')
  expect(api.characters.create).not.toHaveBeenCalled()
  fireEvent.change(screen.getByLabelText('Full name (required)'), {target: {value: ' Hamlet '}})
  api.characters.create.mockRejectedValueOnce(new Error('Session expired'))
  fireEvent.click(screen.getByRole('button', {name: 'Save character'}))
  await screen.findByText(/Session expired/)
  expect(screen.getByLabelText('Full name (required)').value).toBe(' Hamlet ')
  let resolveSave
  api.characters.create.mockImplementationOnce(() => new Promise((resolve) => {resolveSave = resolve}))
  fireEvent.click(screen.getByRole('button', {name: 'Save character'}))
  fireEvent.submit(screen.getByRole('dialog').querySelector('form'))
  fireEvent.keyDown(document, {key: 'Escape'})
  expect(screen.getByRole('button', {name: 'Close character form'}).disabled).toBe(true)
  expect(onClose).not.toHaveBeenCalled()
  expect(api.characters.create).toHaveBeenCalledTimes(2)
  await act(async () => resolveSave(character))
  expect(onCreated).toHaveBeenCalledWith(character)
})

it('preserves an existing character on scalar-only quote edits and explicitly clears it', async () => {
  const {unmount} = render(<AddQuoteDialog quote={quote} onClose={vi.fn()} onUpdated={vi.fn()} />)
  await readyQuote()
  expect(screen.getByLabelText('Character (optional)').value).toBe('4')
  fireEvent.change(screen.getByLabelText('Location'), {target: {value: 'Act II'}})
  fireEvent.click(screen.getByRole('button', {name: 'Save quote'}))
  await waitFor(() => expect(api.quotes.update).toHaveBeenCalledWith(42, expect.objectContaining({authorId: 7, characterId: 4, location: 'Act II'})))
  unmount()
  render(<AddQuoteDialog quote={quote} onClose={vi.fn()} onUpdated={vi.fn()} />)
  await readyQuote()
  fireEvent.change(screen.getByLabelText('Character (optional)'), {target: {value: ''}})
  fireEvent.click(screen.getByRole('button', {name: 'Save quote'}))
  await waitFor(() => expect(api.quotes.update).toHaveBeenLastCalledWith(42, expect.objectContaining({characterId: null})))
})

it('prefills the selected character on create and permits narration', async () => {
  render(<AddQuoteDialog initialAuthorId={7} initialCharacterId={4} onClose={vi.fn()} onCreated={vi.fn()} />)
  await readyQuote()
  expect(screen.getByLabelText('Character (optional)').value).toBe('4')
  fireEvent.change(screen.getByLabelText('Quote text (required)'), {target: {value: 'Narration'}})
  fireEvent.change(screen.getByLabelText('Character (optional)'), {target: {value: ''}})
  fireEvent.click(screen.getByRole('button', {name: 'Save quote'}))
  await waitFor(() => expect(api.quotes.create).toHaveBeenCalledWith(expect.objectContaining({characterId: null, authorId: 7})))
})

it('retries failed character options without losing drafts or silently clearing assignments', async () => {
  api.characters.list.mockRejectedValueOnce(new Error('Offline'))
  render(<AddQuoteDialog quote={quote} onClose={vi.fn()} onUpdated={vi.fn()} />)
  await screen.findByRole('button', {name: 'Retry loading characters'})
  expect(screen.getByRole('button', {name: 'Save quote'}).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Location'), {target: {value: 'Kept location'}})
  fireEvent.click(screen.getByRole('button', {name: 'Retry loading characters'}))
  await readyQuote()
  expect(screen.getByLabelText('Character (optional)').value).toBe('4')
  expect(screen.getByLabelText('Location').value).toBe('Kept location')
  api.quotes.update.mockRejectedValueOnce(new Error('Invalid characterId'))
  fireEvent.click(screen.getByRole('button', {name: 'Save quote'}))
  await screen.findByText(/Invalid characterId/)
  expect(screen.getByLabelText('Character (optional)').value).toBe('4')
})

it('does not silently clear a character missing from loaded options', async () => {
  api.characters.list.mockResolvedValue([])
  render(<AddQuoteDialog quote={quote} onClose={vi.fn()} onUpdated={vi.fn()} />)
  await readyQuote()
  expect(screen.getByLabelText('Character (optional)').value).toBe('4')
  fireEvent.click(screen.getByRole('button', {name: 'Save quote'}))
  expect(screen.getByRole('alert').textContent).toContain('no longer available')
  expect(api.quotes.update).not.toHaveBeenCalled()
})

it('creates and selects a character in a nested form without changing the quote draft', async () => {
  const created = {...other, id: 6}
  api.characters.create.mockResolvedValue(created)
  const onCharacterCreated = vi.fn()
  render(<AddQuoteDialog quote={quote} onClose={vi.fn()} onUpdated={vi.fn()} onCharacterCreated={onCharacterCreated} />)
  await readyQuote()
  fireEvent.change(screen.getByLabelText('Location'), {target: {value: 'Kept location'}})
  fireEvent.click(screen.getByRole('button', {name: 'Add new character'}))
  expect(screen.getByRole('button', {name: 'Close quote form'}).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Full name (required)'), {target: {value: 'Hamlet'}})
  fireEvent.click(screen.getByRole('button', {name: 'Save character'}))
  await screen.findByText('Character added and selected.')
  expect(onCharacterCreated).toHaveBeenCalledWith(created)
  expect(screen.getByLabelText('Location').value).toBe('Kept location')
  expect(screen.getByLabelText('Character (optional)').value).toBe('6')
  expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Add new character'}))
})

it('shows character attribution on quotes and opens details without expanding the quote', async () => {
  render(<QuotesList query="be" />)
  const trigger = await screen.findByRole('button', {name: 'Prince Hamlet'})
  expect(trigger.closest('.quote-author').textContent).toBe('Prince Hamlet in Hamlet by William Shakespeare')
  expect(trigger.closest('.quote-author').querySelector('i').textContent).toBe('Hamlet')
  expect(document.querySelectorAll('.quote-author')).toHaveLength(1)
  trigger.focus()
  fireEvent.click(trigger)
  await screen.findByRole('heading', {name: 'About this Character'})
  expect(screen.queryByText('Full Text:')).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Close character details'}))
  expect(document.activeElement).toBe(trigger)
  expect(screen.getByRole('button', {name: 'William Shakespeare'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button', {name: 'William Shakespeare'}))
  await screen.findByRole('heading', {name: 'About this Author'})
  expect(screen.queryByText('Full Text:')).toBeNull()
})

it('omits the work phrase when unavailable and uses full names when known-as names are missing', async () => {
  api.quotes.listPage.mockResolvedValue(page([{...quote, character: {...character, knownAs: null, workTitle: null}}], 0, 20))
  render(<QuotesList query="be" />)
  const trigger = await screen.findByRole('button', {name: 'Hamlet'})
  expect(trigger.closest('.quote-author').textContent).toBe('Hamlet by William Shakespeare')
  expect(document.querySelectorAll('.quote-author')).toHaveLength(1)
})

it('uses the same attribution with or without a selected author', async () => {
  api.quotes.listPage.mockResolvedValue(page([{...quote, character: null}], 0, 20))
  const {rerender} = render(<QuotesList query="be" />)
  const authorLink = await screen.findByRole('button', {name: 'William Shakespeare'})
  expect(authorLink.closest('.quote-author').textContent).toBe('William Shakespeare')
  api.quotes.listPage.mockResolvedValue(page([quote], 0, 20))
  rerender(<QuotesList authorId={7} />)
  const characterLink = await screen.findByRole('button', {name: 'Prince Hamlet'})
  expect(characterLink.closest('.quote-author').textContent).toBe('Prince Hamlet in Hamlet by William Shakespeare')
  expect(characterLink.closest('.quote-author').querySelector('i').textContent).toBe('Hamlet')
  expect(document.querySelectorAll('.quote-author')).toHaveLength(1)
})

it('resets quote pages on character changes while preserving author, text and category filters', async () => {
  api.quotes.listPage.mockImplementation(async (_author, _query, _categories, {page: number, size}) => page([quote], number, size, 45))
  const filters = {authorId: 7, query: 'be', categoryIds: {toneIds: [1]}}
  const {rerender} = render(<QuotesList {...filters} characterId={4} />)
  await screen.findByText('Page 1 of 3')
  fireEvent.click(screen.getByRole('button', {name: 'Next'}))
  await screen.findByText('Page 2 of 3')
  api.characters.get.mockResolvedValue(other)
  rerender(<QuotesList {...filters} characterId={5} />)
  await screen.findByText('Page 1 of 3')
  expect(api.quotes.listPage).toHaveBeenLastCalledWith(7, 'be', {toneIds: [1]}, {page: 0, size: 20, characterId: 5})
})

it('does not fetch or show a character heading when there are no matching quotes', async () => {
  api.quotes.listPage.mockResolvedValue(page([], 0, 20))
  render(<QuotesList characterId={4} />)
  await screen.findByText('No Quotes Found')
  expect(screen.queryByRole('heading', {name: /Character:/})).toBeNull()
  expect(api.characters.get).not.toHaveBeenCalled()
  expect(api.quotes.listPage).toHaveBeenCalledTimes(1)
})

it('refreshes per-quote character attribution after editing and a later external refresh', async () => {
  const firstUpdate = {...character, knownAs: 'First update'}
  api.characters.update.mockResolvedValue(firstUpdate)
  const {rerender} = render(<QuotesList characterId={4} isAuthenticated />)
  fireEvent.click(await screen.findByRole('button', {name: 'Prince Hamlet'}))
  fireEvent.click(await screen.findByRole('button', {name: 'Edit character'}))
  fireEvent.change(screen.getByLabelText('Known as'), {target: {value: 'First update'}})
  api.quotes.listPage.mockResolvedValue(page([{...quote, character: firstUpdate}], 0, 20))
  fireEvent.click(screen.getByRole('button', {name: 'Save character'}))
  await screen.findByText('Character updated.')
  fireEvent.click(screen.getByRole('button', {name: 'Close character details'}))
  await screen.findByRole('button', {name: 'First update'})
  api.quotes.listPage.mockResolvedValue(page([{...quote, character: {...character, knownAs: 'External update'}}], 0, 20))
  rerender(<QuotesList characterId={4} isAuthenticated charactersRefreshKey={1} />)
  await screen.findByRole('button', {name: 'External update'})
  expect(screen.queryByRole('heading', {name: /Character:/})).toBeNull()
})

it('refreshes character filters and quote attribution after editing details through the app', async () => {
  api.auth.me.mockResolvedValue({authenticated: true, name: 'Editor'})
  const updated = {...character, knownAs: 'Updated Prince'}
  api.characters.update.mockResolvedValue(updated)
  render(<App />)
  fireEvent.click(await screen.findByRole('button', {name: 'Prince Hamlet (Hamlet)'}))
  await screen.findByText(quote.text)
  fireEvent.click(screen.getByRole('button', {name: 'About Prince Hamlet (Hamlet)'}))
  fireEvent.click(await screen.findByRole('button', {name: 'Edit character'}))
  fireEvent.change(screen.getByLabelText('Known as'), {target: {value: 'Updated Prince'}})
  api.characters.listPage.mockResolvedValue(page([updated, other]))
  api.characters.get.mockResolvedValue(updated)
  api.quotes.listPage.mockResolvedValue(page([{...quote, character: updated}], 0, 20))
  fireEvent.click(screen.getByRole('button', {name: 'Save character'}))
  await screen.findByText('Character updated.')
  fireEvent.click(screen.getByRole('button', {name: 'Close character details'}))
  await screen.findByRole('button', {name: 'Updated Prince'})
  expect(screen.queryByRole('heading', {name: /Character:/})).toBeNull()
  expect(screen.getByRole('button', {name: 'Updated Prince (Hamlet)'})).toBeTruthy()
  expect(screen.getByRole('button', {name: 'Updated Prince'})).toBeTruthy()
  expect(api.quotes.listPage).toHaveBeenLastCalledWith(null, '', selections, {page: 0, size: 20, characterId: 4})
})

it('creates characters from the signed-in sidebar and opens their public details', async () => {
  const onCharacterChanged = vi.fn()
  render(sidebar({isAuthenticated: true, onCharacterChanged}))
  fireEvent.click(screen.getByRole('button', {name: 'Add new character'}))
  const dialog = screen.getByRole('dialog')
  fireEvent.change(within(dialog).getByLabelText('Full name (required)'), {target: {value: 'Hamlet'}})
  fireEvent.click(within(dialog).getByRole('button', {name: 'Save character'}))
  await waitFor(() => expect(onCharacterChanged).toHaveBeenCalledWith(character))
  fireEvent.click(screen.getByRole('button', {name: 'About Prince Hamlet (Hamlet)'}))
  await screen.findByText('First line Second line')
})
