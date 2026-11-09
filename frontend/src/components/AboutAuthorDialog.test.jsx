import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '../api'
import App from '../App'
import AboutAuthorDialog from './AboutAuthorDialog'
import QuotesList from './QuotesList'

const author = {
  id: 7, fullName: 'Samuel Clemens', knownAs: 'Mark Twain',
  dateOfBirth: '1835-11-30', dateOfDeath: '1910-04-21',
  placeOfBirth: 'Florida, Missouri', nationality: 'American',
  bio: 'A writer.\nAlso a humorist.', age: 74,
}
const quote = {id: 42, text: 'A quote', author}

function quotePage(content) {
  return {content, page: {number: 0, size: 20, totalElements: content.length, totalPages: content.length ? 1 : 0}}
}

beforeEach(() => {
  vi.spyOn(api.authors, 'get').mockResolvedValue(author)
  vi.spyOn(api.authors, 'update').mockResolvedValue(author)
  vi.spyOn(api.authors, 'create').mockResolvedValue(author)
  vi.spyOn(api.quotes, 'listPage').mockResolvedValue(quotePage([quote]))
  HTMLDialogElement.prototype.showModal = function () {
    this.open = true
    this.querySelector('[autofocus], button')?.focus()
  }
  HTMLDialogElement.prototype.close = function () {
    this.open = false
    this.dispatchEvent(new Event('close'))
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function openEditor() {
  fireEvent.click(await screen.findByRole('button', {name: 'Edit author'}))
  return screen.getByRole('dialog', {name: 'Edit author'})
}

function submitEditor() {
  fireEvent.submit(screen.getByRole('button', {name: 'Save author'}).closest('form'))
}

describe('author details', () => {
  it('opens from the selected heading, shows all details read-only, and restores focus on close', async () => {
    render(<QuotesList authorId={7} />)
    const trigger = await screen.findByRole('button', {name: 'Mark Twain'})
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog', {name: 'About this Author'})
    await within(dialog).findByText('Samuel Clemens')
    for (const value of ['Mark Twain', 'November 30, 1835', 'April 21, 1910', 'Florida, Missouri', 'American', '74']) {
      expect(within(dialog).getByText(value)).toBeTruthy()
    }
    expect(within(dialog).getByText(/A writer/).textContent).toBe(author.bio)
    expect(within(dialog).getByText('Age at death')).toBeTruthy()
    expect(within(dialog).queryByRole('textbox')).toBeNull()
    expect(within(dialog).queryByRole('button', {name: 'Edit author'})).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', {name: 'Close'}))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('opens from a mixed-author result without selecting an author or expanding the quote', async () => {
    render(<QuotesList query="quote" />)
    fireEvent.click(await screen.findByRole('button', {name: 'Mark Twain'}))
    const dialog = screen.getByRole('dialog', {name: 'About this Author'})
    await within(dialog).findByText('Samuel Clemens')
    expect(api.authors.get).toHaveBeenCalledWith(7)
    expect(screen.getByRole('button', {name: /A quote/}).getAttribute('aria-expanded')).toBe('false')
    expect(api.quotes.listPage).toHaveBeenCalledTimes(1)
  })

  it('updates every matching name in mixed-author results after editing', async () => {
    const updated = {...author, knownAs: 'Updated Display Name'}
    const onAuthorUpdated = vi.fn()
    api.quotes.listPage.mockResolvedValue(quotePage([quote, {...quote, id: 43, text: 'Another quote'}]))
    api.authors.update.mockImplementation(async () => {
      api.quotes.listPage.mockResolvedValue(quotePage([
        {...quote, author: updated}, {...quote, id: 43, text: 'Another quote', author: updated},
      ]))
      return updated
    })
    render(<QuotesList query="quote" isAuthenticated onAuthorUpdated={onAuthorUpdated} />)
    fireEvent.click((await screen.findAllByRole('button', {name: 'Mark Twain'}))[0])
    await openEditor()
    fireEvent.change(screen.getByLabelText('Known as'), {target: {value: updated.knownAs}})
    submitEditor()
    await screen.findByText('Author updated.')
    await waitFor(() => expect(api.quotes.listPage).toHaveBeenCalledTimes(2))
    expect(screen.getAllByRole('button', {name: updated.knownAs})).toHaveLength(2)
    expect(onAuthorUpdated).toHaveBeenCalledWith(updated)
    fireEvent.click(screen.getByRole('button', {name: 'Close'}))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect([
      ...screen.getAllByRole('button', {name: updated.knownAs}),
      document.querySelector('[aria-label="Quotes"]'),
    ]).toContain(document.activeElement)
  })

  it('shows missing details explicitly and includes a zero age', async () => {
    api.authors.get.mockResolvedValue({id: 7, fullName: 'New Author', dateOfBirth: '2026-11-06', age: 0})
    render(<AboutAuthorDialog authorId={7} onClose={vi.fn()} />)
    await screen.findByText('New Author')
    expect(screen.getAllByText('Not provided')).toHaveLength(5)
    expect(screen.getByText('Age')).toBeTruthy()
    expect(screen.getByText('0')).toBeTruthy()
  })

  it('shows loading and retryable errors, including malformed author responses', async () => {
    let rejectLoad
    api.authors.get.mockReturnValueOnce(new Promise((resolve, reject) => { rejectLoad = reject }))
    api.authors.get.mockResolvedValueOnce({id: 8, fullName: 'Wrong author'})
    render(<AboutAuthorDialog authorId={7} isAuthenticated onClose={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toBe('Loading author details...')
    expect(screen.queryByRole('button', {name: 'Edit author'})).toBeNull()
    await act(async () => rejectLoad(new Error('Offline')))
    expect(screen.getByRole('alert').textContent).toContain('Offline')
    fireEvent.click(screen.getByRole('button', {name: 'Retry author details'}))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('invalid author'))
    fireEvent.click(screen.getByRole('button', {name: 'Retry author details'}))
    await screen.findByText('Samuel Clemens')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('prefills all editable fields and saves a full replacement, returning to refreshed details', async () => {
    const updated = {...author, fullName: 'Updated Name', knownAs: null, bio: null}
    api.authors.update.mockResolvedValue(updated)
    const onUpdated = vi.fn()
    const onClose = vi.fn()
    render(<AboutAuthorDialog authorId={7} isAuthenticated onClose={onClose} onUpdated={onUpdated} />)
    const editor = await openEditor()
    for (const [label, value] of [
      ['Full name (required)', author.fullName], ['Known as', author.knownAs],
      ['Date of birth (required)', author.dateOfBirth], ['Date of death', author.dateOfDeath],
      ['Place of birth', author.placeOfBirth], ['Nationality', author.nationality], ['Biography', author.bio],
    ]) {
      expect(within(editor).getByLabelText(label).value).toBe(value)
    }
    expect(screen.getByLabelText('Full name (required)').required).toBe(true)
    const birthDate = screen.getByLabelText('Date of birth (required)')
    expect(birthDate.required).toBe(true)
    fireEvent.change(birthDate, {target: {value: ''}})
    expect(editor.querySelector('form').checkValidity()).toBe(false)
    fireEvent.change(birthDate, {target: {value: author.dateOfBirth}})
    expect(screen.getByLabelText('Full name (required)').maxLength).toBe(255)
    expect(screen.getByLabelText('Biography').maxLength).toBe(1024)
    fireEvent.change(screen.getByLabelText('Full name (required)'), {target: {value: ' Updated Name '}})
    fireEvent.change(screen.getByLabelText('Known as'), {target: {value: ''}})
    fireEvent.change(screen.getByLabelText('Biography'), {target: {value: ''}})
    submitEditor()
    await screen.findByText('Author updated.')
    expect(api.authors.update).toHaveBeenCalledWith(7, {
      fullName: 'Updated Name', knownAs: null, dateOfBirth: author.dateOfBirth,
      dateOfDeath: author.dateOfDeath, placeOfBirth: author.placeOfBirth,
      nationality: author.nationality, bio: null,
    })
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(onUpdated).toHaveBeenCalledWith(updated)
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByText('Updated Name')).toBeTruthy()
    expect(screen.queryByRole('dialog', {name: 'Edit author'})).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Edit author'}))
  })

  it('cancels edits and dismisses with Escape without modifying details or closing About', async () => {
    const onClose = vi.fn()
    render(<AboutAuthorDialog authorId={7} isAuthenticated onClose={onClose} onUpdated={vi.fn()} />)
    await openEditor()
    fireEvent.change(screen.getByLabelText('Full name (required)'), {target: {value: 'Unsaved'}})
    fireEvent.click(screen.getByRole('button', {name: 'Cancel'}))
    expect(screen.getByText('Samuel Clemens')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Edit author'}))
    await openEditor()
    fireEvent.keyDown(document, {key: 'Escape'})
    expect(screen.queryByRole('dialog', {name: 'Edit author'})).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    expect(api.authors.update).not.toHaveBeenCalled()
    fireEvent(screen.getByRole('dialog'), new Event('cancel', {cancelable: true}))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('preserves drafts after conflicts, expired authentication, and server failures', async () => {
    api.authors.update
      .mockRejectedValueOnce(Object.assign(new Error('Conflict'), {status: 409}))
      .mockRejectedValueOnce(Object.assign(new Error('Login required'), {status: 401}))
      .mockRejectedValueOnce(new Error('Server error'))
    render(<AboutAuthorDialog authorId={7} isAuthenticated onClose={vi.fn()} onUpdated={vi.fn()} />)
    await openEditor()
    fireEvent.change(screen.getByLabelText('Biography'), {target: {value: 'Draft biography'}})
    for (const message of ['The author already exists', 'Login required', 'Server error']) {
      submitEditor()
      await waitFor(() => expect(screen.getByRole('alert').textContent).toContain(message))
      expect(screen.getByLabelText('Biography').value).toBe('Draft biography')
    }
    expect(screen.getByRole('dialog', {name: 'Edit author'})).toBeTruthy()
  })

  it('rejects whitespace names and prevents duplicate saves or dismissal while saving', async () => {
    let resolveSave
    api.authors.update.mockReturnValue(new Promise((resolve) => { resolveSave = resolve }))
    render(<AboutAuthorDialog authorId={7} isAuthenticated onClose={vi.fn()} onUpdated={vi.fn()} />)
    await openEditor()
    fireEvent.change(screen.getByLabelText('Full name (required)'), {target: {value: '  '}})
    submitEditor()
    expect(screen.getByRole('alert').textContent).toContain('Enter a full name')
    expect(api.authors.update).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Full name (required)'), {target: {value: author.fullName}})
    const form = screen.getByRole('button', {name: 'Save author'}).closest('form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    fireEvent.keyDown(document, {key: 'Escape'})
    expect(screen.getByRole('dialog', {name: 'Edit author'})).toBeTruthy()
    expect(screen.getByRole('button', {name: 'Cancel'}).disabled).toBe(true)
    expect(api.authors.update).toHaveBeenCalledTimes(1)
    await act(async () => resolveSave(author))
    expect(screen.getByText('Author updated.')).toBeTruthy()
  })

  it('removes editing access when authentication is lost', async () => {
    const {rerender} = render(<AboutAuthorDialog authorId={7} isAuthenticated onClose={vi.fn()} onUpdated={vi.fn()} />)
    await openEditor()
    rerender(<AboutAuthorDialog authorId={7} isAuthenticated={false} onClose={vi.fn()} onUpdated={vi.fn()} />)
    expect(screen.queryByRole('dialog', {name: 'Edit author'})).toBeNull()
    expect(screen.queryByRole('button', {name: 'Edit author'})).toBeNull()
    expect(api.authors.update).not.toHaveBeenCalled()
  })

  it('refreshes the heading, sidebar, and quote results after saving without changing filters', async () => {
    const updated = {...author, knownAs: 'Updated Display Name'}
    vi.spyOn(api.auth, 'me').mockResolvedValue({authenticated: true, name: 'Editor'})
    vi.spyOn(api.authors, 'listPage').mockResolvedValue({
      content: [author], page: {number: 0, size: 10, totalElements: 1, totalPages: 1},
    })
    vi.spyOn(api.categories, 'list').mockResolvedValue({tones: [], themes: [], forms: [], sources: []})
    api.authors.update.mockImplementation(async () => {
      api.authors.listPage.mockResolvedValue({
        content: [updated], page: {number: 0, size: 10, totalElements: 1, totalPages: 1},
      })
      api.quotes.listPage.mockResolvedValue(quotePage([{...quote, author: updated}]))
      return updated
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', {name: 'Mark Twain'}))
    const heading = await screen.findByRole('heading', {name: 'Mark Twain'})
    fireEvent.click(within(heading).getByRole('button'))
    await openEditor()
    fireEvent.change(screen.getByLabelText('Known as'), {target: {value: updated.knownAs}})
    submitEditor()
    await screen.findByText('Author updated.')
    await screen.findByRole('heading', {name: updated.knownAs})
    await waitFor(() => expect(screen.getByRole('button', {name: updated.knownAs, pressed: true})).toBeTruthy())
    expect(api.authors.listPage).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(api.quotes.listPage).toHaveBeenCalledTimes(2))
    expect(api.quotes.listPage).toHaveBeenLastCalledWith(7, '', {toneIds: [], themeIds: [], formIds: [], sourceIds: []}, {page: 0, size: 20})
  })
})
