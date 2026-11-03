import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '../api'
import AddQuoteDialog from './AddQuoteDialog'
import QuotesList from './QuotesList'

const catalog = {
  tones: [{ id: 101, name: 'Funny' }, { id: 102, name: 'Insightful' }],
  themes: [{ id: 101, name: 'Human nature' }, { id: 202, name: 'Art & beauty' }],
  forms: [{ id: 301, name: 'Metaphor' }, { id: 302, name: 'Verse' }],
  sources: [{ id: 401, name: 'Play' }, { id: 402, name: 'Book' }],
}
for (const options of Object.values(catalog)) {
  for (const option of options) option.description = `Scope of ${option.name}`
}
const author = { id: 7, fullName: 'Test Author' }
const quote = {
  id: 42, text: 'A categorized quote', author, date: '2020-01-02',
  location: 'Act 1', reference: 'Page 2',
  ...catalog,
}
const allSelections = {
  toneIds: [101, 102], themeIds: [101, 202], formIds: [301, 302], sourceIds: [401, 402],
}
const noSelections = { toneIds: [], themeIds: [], formIds: [], sourceIds: [] }

beforeEach(() => {
  vi.spyOn(api.authors, 'list').mockResolvedValue([author])
  vi.spyOn(api.categories, 'list').mockResolvedValue(catalog)
  vi.spyOn(api.quotes, 'list').mockResolvedValue([quote])
  vi.spyOn(api.quotes, 'create').mockResolvedValue(quote)
  vi.spyOn(api.quotes, 'update').mockResolvedValue(quote)
  vi.spyOn(api.quotes, 'delete').mockResolvedValue(true)
  // jsdom does not implement the native modal dialog methods.
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

function renderForm(props = {}) {
  const callbacks = {
    onClose: vi.fn(), onCreated: vi.fn(), onUpdated: vi.fn(), onAuthorCreated: vi.fn(),
  }
  render(<AddQuoteDialog initialAuthorId={7} {...callbacks} {...props} />)
  return callbacks
}

async function ready() {
  await screen.findByRole('checkbox', { name: 'Funny' })
  await waitFor(() => expect(screen.getByRole('button', { name: 'Save quote' }).disabled).toBe(false))
}

describe('quote category editing', () => {
  it('uses backend descriptions as hover text and accessible checkbox descriptions', async () => {
    renderForm()
    await ready()
    for (const options of Object.values(catalog)) {
      for (const option of options) {
        const checkbox = screen.getByRole('checkbox', { name: option.name })
        expect(checkbox.closest('label').title).toBe(option.description)
        expect(document.getElementById(checkbox.getAttribute('aria-describedby')).textContent).toBe(option.description)
      }
    }
  })

  it('still works with an older backend response that has no descriptions', async () => {
    api.categories.list.mockResolvedValue(Object.fromEntries(Object.entries(catalog).map(([key, options]) => [
      key, options.map(({ id, name }) => ({ id, name })),
    ])))
    renderForm()
    await ready()
    const checkbox = screen.getByRole('checkbox', { name: 'Funny' })
    expect(checkbox.closest('label').hasAttribute('title')).toBe(false)
    expect(checkbox.hasAttribute('aria-describedby')).toBe(false)
  })

  it('creates a quote with multiple optional selections in every dimension', async () => {
    const callbacks = renderForm()
    await ready()
    fireEvent.change(screen.getByLabelText('Quote text (required)'), { target: { value: 'New quote' } })
    for (const options of Object.values(catalog)) {
      for (const option of options) fireEvent.click(screen.getByRole('checkbox', { name: option.name }))
    }
    expect(screen.getAllByRole('group', { name: /2 selected/ })).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: 'Save quote' }))
    await waitFor(() => expect(callbacks.onCreated).toHaveBeenCalledWith(quote))
    expect(api.quotes.create).toHaveBeenCalledWith({
      text: 'New quote', authorId: 7, date: null, location: null, reference: null, ...allSelections,
    })
    expect(api.quotes.update).not.toHaveBeenCalled()
  })

  it('allows creating a quote without any selections', async () => {
    renderForm()
    await ready()
    fireEvent.change(screen.getByLabelText('Quote text (required)'), { target: { value: 'Plain quote' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save quote' }))
    await waitFor(() => expect(api.quotes.create).toHaveBeenCalledWith(expect.objectContaining(noSelections)))
  })

  it('prefills and preserves all categories when only scalar fields change', async () => {
    const callbacks = renderForm({ quote })
    await ready()
    expect(screen.getAllByRole('checkbox').every((input) => input.checked)).toBe(true)
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Act 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save quote' }))
    await waitFor(() => expect(callbacks.onUpdated).toHaveBeenCalledWith(quote))
    expect(api.quotes.update).toHaveBeenCalledWith(42, {
      text: quote.text, authorId: 7, date: quote.date, location: 'Act 2', reference: quote.reference,
      ...allSelections,
    })
  })

  it('deselects individual categories and clears each dimension explicitly', async () => {
    renderForm({ quote })
    await ready()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Funny' }))
    expect(screen.getByRole('checkbox', { name: 'Funny' }).checked).toBe(false)
    expect(screen.getByRole('checkbox', { name: 'Insightful' }).checked).toBe(true)
    for (const dimension of ['tone', 'theme', 'form', 'source']) {
      fireEvent.click(screen.getByRole('button', { name: `Clear ${dimension} selections` }))
    }
    expect(screen.getAllByRole('checkbox').every((input) => !input.checked)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save quote' }))
    await waitFor(() => expect(api.quotes.update).toHaveBeenCalledWith(42, expect.objectContaining(noSelections)))
  })

  it('blocks save during catalog loading and retries failures without losing the draft', async () => {
    let resolveCatalog
    api.categories.list.mockRejectedValueOnce(new Error('Service unavailable'))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveCatalog = resolve }))
    renderForm({ quote })
    await screen.findByRole('button', { name: 'Retry loading categories' })
    expect(screen.getByRole('alert').textContent).toContain('Service unavailable')
    expect(screen.getByRole('button', { name: 'Save quote' }).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Quote text (required)'), { target: { value: 'Kept draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading categories' }))
    expect(screen.getByText('Loading categories...')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Save quote' }).disabled).toBe(true)
    await act(async () => resolveCatalog(catalog))
    await ready()
    expect(screen.getByLabelText('Quote text (required)').value).toBe('Kept draft')
    expect(screen.getAllByRole('checkbox').every((input) => input.checked)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save quote' }))
    await waitFor(() => expect(api.quotes.update).toHaveBeenCalledWith(42,
      expect.objectContaining({ text: 'Kept draft', ...allSelections })))
  })

  it('keeps selections and entered values after a rejected write', async () => {
    api.quotes.update.mockRejectedValueOnce(new Error('Unknown toneIds'))
    renderForm({ quote })
    await ready()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Funny' }))
    fireEvent.change(screen.getByLabelText('Location'), { target: { value: 'Kept location' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save quote' }))
    expect((await screen.findByRole('alert')).textContent).toContain('Unknown toneIds')
    expect(screen.getByLabelText('Location').value).toBe('Kept location')
    expect(screen.getByRole('checkbox', { name: 'Funny' }).checked).toBe(false)
    expect(screen.getByRole('checkbox', { name: 'Insightful' }).checked).toBe(true)
    expect(screen.getByRole('button', { name: 'Save quote' }).disabled).toBe(false)
  })

  it('preserves selections while creating and selecting a new author', async () => {
    const newAuthor = { id: 8, fullName: 'New Author', dateOfBirth: '1950-01-01' }
    vi.spyOn(api.authors, 'create').mockResolvedValue(newAuthor)
    const callbacks = renderForm({ quote })
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Add new author' }))
    fireEvent.change(screen.getByLabelText('Full name (required)'), { target: { value: newAuthor.fullName } })
    fireEvent.change(screen.getByLabelText('Date of birth (required)'), { target: { value: newAuthor.dateOfBirth } })
    fireEvent.click(screen.getByRole('button', { name: 'Save author' }))
    await screen.findByText('Author added and selected.')
    expect(callbacks.onAuthorCreated).toHaveBeenCalledWith(newAuthor)
    expect(screen.getAllByRole('checkbox').every((input) => input.checked)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save quote' }))
    await waitFor(() => expect(api.quotes.update).toHaveBeenCalledWith(42,
      expect.objectContaining({ authorId: 8, ...allSelections })))
  })

  it('does not discard categories missing from a stale catalog', async () => {
    api.categories.list.mockResolvedValue({ ...catalog, tones: [catalog.tones[0]] })
    renderForm({ quote })
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Save quote' }))
    expect((await screen.findByRole('alert')).textContent).toContain('no longer in the catalog')
    expect(api.quotes.update).not.toHaveBeenCalled()
  })

  it('cancels without writing or changing the original quote', async () => {
    const callbacks = renderForm({ quote })
    await ready()
    fireEvent.click(screen.getByRole('button', { name: 'Clear tone selections' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(callbacks.onClose).toHaveBeenCalled()
    expect(quote.tones).toHaveLength(2)
    expect(api.quotes.update).not.toHaveBeenCalled()
  })
})

describe('category display on quote cards', () => {
  it('shows category labels in expanded details for public all-author search results', async () => {
    render(<QuotesList query="categorized" />)
    const row = await screen.findByRole('button', { name: /A categorized quote/ })
    expect(screen.queryByRole('list', { name: 'Tone' })).toBeNull()
    fireEvent.click(row)
    for (const [label, key] of [['Tone', 'tones'], ['Theme', 'themes'], ['Form', 'forms'], ['Source', 'sources']]) {
      const tags = within(screen.getByRole('list', { name: label })).getAllByRole('listitem')
      expect(tags.map((tag) => tag.firstChild.textContent)).toEqual(catalog[key].map((option) => option.name))
      expect(tags.map((tag) => tag.title)).toEqual(catalog[key].map((option) => option.description))
      for (const tag of tags) expect(tag.textContent).toContain(tag.title)
    }
    expect(screen.queryByRole('button', { name: 'Edit quote' })).toBeNull()
    expect(api.categories.list).not.toHaveBeenCalled()
  })

  it('keeps uncategorized quote details free of empty category groups', async () => {
    api.quotes.list.mockResolvedValue([{ ...quote, tones: [], themes: [], forms: [], sources: [] }])
    render(<QuotesList authorId={7} />)
    fireEvent.click(await screen.findByRole('button', { name: /A categorized quote/ }))
    expect(screen.getByText('Act 1')).toBeTruthy()
    for (const label of ['Tone', 'Theme', 'Form', 'Source']) {
      expect(screen.queryByRole('list', { name: label })).toBeNull()
    }
  })

  it('opens a categorized quote for editing from the card and preserves selections on save', async () => {
    render(<QuotesList authorId={7} isAuthenticated onAuthorCreated={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Edit quote' }))
    await ready()
    expect(screen.getAllByRole('checkbox').every((input) => input.checked)).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Save quote' }))
    await screen.findByText('Quote updated.')
    expect(api.quotes.update).toHaveBeenCalledWith(42, expect.objectContaining(allSelections))
    await waitFor(() => expect(api.quotes.list).toHaveBeenCalledTimes(2))
  })
})
