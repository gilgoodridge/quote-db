import {act, cleanup, fireEvent, render, screen, waitFor} from '@testing-library/react'
import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import App from '../App'
import {api} from '../api'
import {hasAddQuoteIntent, saveAddQuoteIntent} from '../quoteIntent'

const author = {id: 7, fullName: 'Published Author', dateOfBirth: '1950-01-02'}
const character = {id: 4, fullName: 'Fictional Speaker'}
const quote = {id: 42, text: 'Published quote', author}

function page(content, size = 10) {
  return {content, page: {number: 0, size, totalElements: content.length, totalPages: content.length ? 1 : 0}}
}

beforeEach(() => {
  window.sessionStorage.clear()
  vi.spyOn(api.auth, 'me').mockResolvedValue({
    authenticated: true, editor: false, name: 'Reader', email: 'reader@example.com',
  })
  vi.spyOn(api.auth, 'logout').mockResolvedValue()
  vi.spyOn(api.authors, 'listPage').mockResolvedValue(page([author]))
  vi.spyOn(api.authors, 'list').mockResolvedValue([author])
  vi.spyOn(api.authors, 'get').mockResolvedValue(author)
  vi.spyOn(api.characters, 'listPage').mockResolvedValue(page([character]))
  vi.spyOn(api.characters, 'list').mockResolvedValue([character])
  vi.spyOn(api.characters, 'get').mockResolvedValue(character)
  vi.spyOn(api.quotes, 'listPage').mockResolvedValue(page([quote], 20))
  vi.spyOn(api.quotes, 'create')
  vi.spyOn(api.categories, 'list').mockResolvedValue({tones: [], themes: [], forms: [], sources: []})
  vi.spyOn(api.candidateQuotes, 'pendingCount').mockResolvedValue(0)
  vi.spyOn(api.candidateQuotes, 'snoozedCount').mockResolvedValue(0)
  vi.spyOn(api.candidateAuthors, 'pendingCount').mockResolvedValue(0)
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(() => {
  cleanup()
  window.sessionStorage.clear()
  vi.restoreAllMocks()
})

it('shows a signed-in reader but no published-content editing or review controls', async () => {
  render(<App />)
  fireEvent.click(screen.getByRole('button', {name: 'Menu'}))
  await screen.findByText('Reader')
  expect(screen.getByText('Read-only access')).toBeTruthy()
  expect(screen.getByRole('button', {name: 'Logout'})).toBeTruthy()
  expect(screen.queryByRole('button', {name: 'Login'})).toBeNull()
  expect(screen.queryByRole('button', {name: 'Add Quote'})).toBeNull()
  expect(screen.queryByRole('button', {name: 'Review next candidate'})).toBeNull()
  expect(api.candidateQuotes.pendingCount).not.toHaveBeenCalled()
  fireEvent.click(await screen.findByRole('button', {name: author.fullName, exact: true}))
  await screen.findByText(quote.text)
  expect(screen.queryByRole('button', {name: 'Edit quote'})).toBeNull()
  expect(screen.queryByRole('button', {name: 'Delete quote'})).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: `About ${author.fullName}`}))
  await screen.findByText('January 2, 1950')
  await screen.findByRole('dialog', {name: 'About this Author'})
  await waitFor(() => expect(api.authors.get).toHaveBeenCalledWith(author.id))
  expect(screen.queryByRole('button', {name: 'Edit author'})).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Close author details'}))
  fireEvent.click(screen.getByRole('button', {name: `About ${character.fullName}`}))
  await waitFor(() => expect(api.characters.get).toHaveBeenCalledWith(character.id))
  expect(screen.queryByRole('button', {name: 'Edit character'})).toBeNull()
  fireEvent.click(screen.getByRole('button', {name: 'Close character details'}))
  fireEvent.click(screen.getByRole('button', {name: 'Logout'}))
  await screen.findByRole('button', {name: 'Login'})
  expect(api.auth.logout).toHaveBeenCalledTimes(1)
})

it.each([false, undefined])('does not resume Add Quote for a signed-in user with editor=%s', async (editor) => {
  api.auth.me.mockResolvedValue({authenticated: true, editor, name: 'Reader'})
  saveAddQuoteIntent(window.sessionStorage)
  render(<App />)
  await screen.findByText('Editor access is required to add quotes.')
  expect(screen.queryByRole('dialog', {name: 'Add Quote'})).toBeNull()
  expect(screen.queryByRole('button', {name: 'Add Quote'})).toBeNull()
  expect(hasAddQuoteIntent(window.sessionStorage)).toBe(false)
  expect(api.quotes.create).not.toHaveBeenCalled()
})

it('resumes Add Quote for editors and removes editing access on logout', async () => {
  api.auth.me.mockResolvedValue({authenticated: true, editor: true, name: 'Editor'})
  saveAddQuoteIntent(window.sessionStorage)
  render(<App />)
  await screen.findByRole('dialog', {name: 'Add Quote'})
  await screen.findByRole('button', {name: 'Review next candidate'})
  expect(hasAddQuoteIntent(window.sessionStorage)).toBe(false)
  fireEvent.click(screen.getByRole('button', {name: 'Close quote form'}))
  fireEvent.click(await screen.findByRole('button', {name: author.fullName, exact: true}))
  await screen.findByRole('button', {name: 'Edit quote'})
  expect(screen.getByRole('button', {name: 'Delete quote'})).toBeTruthy()
  fireEvent.click(screen.getByRole('button', {name: 'Menu'}))
  fireEvent.click(screen.getByRole('button', {name: 'Logout'}))
  await screen.findByRole('button', {name: 'Login'})
  expect(screen.queryByRole('button', {name: 'Edit quote'})).toBeNull()
  expect(screen.queryByRole('button', {name: 'Delete quote'})).toBeNull()
  expect(screen.queryByRole('button', {name: 'Review next candidate'})).toBeNull()
})

it('checks editor permission when Add Quote was clicked before session loading completed', async () => {
  let resolveSession
  api.auth.me.mockReturnValue(new Promise((resolve) => { resolveSession = resolve }))
  render(<App />)
  fireEvent.click(screen.getByRole('button', {name: 'Add Quote'}))
  await act(async () => resolveSession({authenticated: true, editor: false, name: 'Reader'}))
  await screen.findByText('Editor access is required to add quotes.')
  expect(screen.queryByRole('dialog')).toBeNull()
})
