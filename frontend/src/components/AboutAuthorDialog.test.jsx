import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react'
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest'
import {api} from '../api'
import App from '../App'
import AboutAuthorDialog from './AboutAuthorDialog'
import AddAuthorDialog from './AddAuthorDialog'
import {authorFields} from '../authorFields'
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
  const edit = await screen.findByRole('button', {name: 'Edit author'})
  expect(edit.textContent.trim()).toBe('Edit')
  expect(edit.closest('.dialog-header-title').querySelector('h2').textContent).toBe('About this Author')
  fireEvent.click(edit)
  return screen.getByRole('dialog', {name: 'Edit author'})
}

function submitEditor() {
  fireEvent.submit(screen.getByRole('button', {name: 'Save author'}).closest('form'))
}

describe('author details', () => {
  describe.each([
    {field: 'placeOfBirth', label: 'Place of birth', lookupLabel: 'place of birth',
      type: 'AUTHOR_PLACE_OF_BIRTH', value: 'Florida, Missouri, United States', limit: 255},
    {field: 'bio', label: 'Biography', lookupLabel: 'biography',
      type: 'AUTHOR_BIOGRAPHY', value: 'An American novelist and humorist known for incisive social commentary.', limit: 1024},
  ])('$label AI lookup', ({field, label, lookupLabel, type, value, limit}) => {
    it.each(['create', 'edit', 'review'])('populates only its editable draft in %s mode', async (mode) => {
      vi.spyOn(api.ai, 'lookup').mockResolvedValue({status: 'FOUND', value})
      const onSave = vi.fn()
      render(<AddAuthorDialog author={mode === 'edit' ? author : null}
        initialValues={{...author, fullName: '  Samuel Clemens  '}} reviewing={mode === 'review'}
        onSave={mode === 'review' ? onSave : undefined}
        onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
      fireEvent.click(screen.getByRole('button', {name: `Look up ${lookupLabel} with AI`}))
      await screen.findByText(`Gemini suggested this ${lookupLabel}. Verify it before saving; AI confidence is not a guarantee.`)
      expect(api.ai.lookup).toHaveBeenCalledWith(type, {fullName: 'Samuel Clemens'})
      expect(screen.getByLabelText(label).value).toBe(value)
      expect(screen.getByLabelText(label).maxLength).toBe(limit)
      expect(screen.getByLabelText(label).required).toBe(false)
      expect(screen.getByLabelText('Date of birth *').value).toBe(author.dateOfBirth)
      expect(screen.getByLabelText('Date of death').value).toBe(author.dateOfDeath)
      expect(screen.getByLabelText(field === 'bio' ? 'Place of birth' : 'Biography').value)
        .toBe(field === 'bio' ? author.placeOfBirth : author.bio)
      expect(api.authors.create).not.toHaveBeenCalled()
      expect(api.authors.update).not.toHaveBeenCalled()
      expect(onSave).not.toHaveBeenCalled()
      fireEvent.change(screen.getByLabelText(label), {target: {value: 'Edited suggestion'}})
      fireEvent.submit(screen.getByRole('button', {name: 'Save author'}).closest('form'))
      await waitFor(() => {
        const save = mode === 'review' ? onSave : mode === 'edit' ? api.authors.update : api.authors.create
        expect(save).toHaveBeenCalled()
        const payload = save.mock.calls[0][mode === 'edit' ? 1 : 0]
        expect(payload[field]).toBe('Edited suggestion')
        expect(payload.dateOfBirth).toBe(author.dateOfBirth)
      })
    })

    it('preserves existing text on uncertainty, quota errors and malformed results, then retries', async () => {
      vi.spyOn(api.ai, 'lookup')
        .mockResolvedValueOnce({status: 'UNKNOWN'})
        .mockRejectedValueOnce(new Error('Gemini quota exceeded'))
        .mockResolvedValueOnce({status: 'FOUND', value: 123})
        .mockResolvedValueOnce({status: 'FOUND', value})
      render(<AddAuthorDialog author={author} onClose={vi.fn()} onUpdated={vi.fn()} />)
      const lookup = () => fireEvent.click(screen.getByRole('button', {name: `Look up ${lookupLabel} with AI`}))
      lookup()
      await screen.findByText(`Gemini wasn't sure of the ${lookupLabel}. The existing value was not changed.`)
      expect(screen.getByLabelText(label).value).toBe(author[field])
      lookup()
      expect((await screen.findByRole('alert')).textContent).toContain('Gemini quota exceeded')
      expect(screen.getByLabelText(label).value).toBe(author[field])
      lookup()
      expect((await screen.findByRole('alert')).textContent).toContain(`invalid ${lookupLabel} response`)
      expect(screen.getByLabelText(label).value).toBe(author[field])
      lookup()
      await screen.findByText(new RegExp(`Gemini suggested this ${lookupLabel}`))
      expect(screen.getByLabelText(label).value).toBe(value)
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('requires a name, blocks competing lookups/saves, and ignores results after dismissal', async () => {
      let resolveLookup
      vi.spyOn(api.ai, 'lookup').mockReturnValue(new Promise((resolve) => { resolveLookup = resolve }))
      const {unmount} = render(<AddAuthorDialog onClose={vi.fn()} onCreated={vi.fn()} />)
      expect(screen.getByRole('button', {name: `Look up ${lookupLabel} with AI`}).disabled).toBe(true)
      fireEvent.change(screen.getByLabelText('Full name *'), {target: {value: author.fullName}})
      fireEvent.click(screen.getByRole('button', {name: `Look up ${lookupLabel} with AI`}))
      await screen.findByText(`Asking Gemini for the ${lookupLabel}...`)
      for (const button of screen.getAllByRole('button', {name: /Look up .* with AI/})) {
        expect(button.disabled).toBe(true)
        fireEvent.click(button)
      }
      expect(api.ai.lookup).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', {name: 'Save author'}).disabled).toBe(true)
      expect(screen.getByRole('button', {name: 'Close author form'}).disabled).toBe(false)
      unmount()
      render(<AddAuthorDialog author={author} onClose={vi.fn()} onUpdated={vi.fn()} />)
      await act(async () => resolveLookup({status: 'FOUND', value}))
      expect(screen.getByLabelText(label).value).toBe(author[field])
    })
  })

  it.each(['create', 'edit', 'review'])('looks up an editable birth date without saving in %s mode', async (mode) => {
    vi.spyOn(api.ai, 'lookup').mockResolvedValue({status: 'FOUND', value: '1775-12-16'})
    const onSave = vi.fn()
    render(<AddAuthorDialog author={mode === 'edit' ? author : null}
      initialValues={{fullName: '  Jane Austen  '}} reviewing={mode === 'review'}
      onSave={mode === 'review' ? onSave : undefined} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', {name: 'Look up birth date with AI'}))
    await screen.findByText(/Gemini suggested this date/)
    expect(api.ai.lookup).toHaveBeenCalledWith('AUTHOR_DATE_OF_BIRTH',
      {fullName: mode === 'edit' ? author.fullName : 'Jane Austen'})
    expect(screen.getByLabelText('Date of birth *').value).toBe('1775-12-16')
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(api.authors.update).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Date of birth *'), {target: {value: '1775-12-17'}})
    expect(screen.getByLabelText('Date of birth *').value).toBe('1775-12-17')
  })

  it('requires a name and prevents duplicate lookups, saves, and edits during lookup', async () => {
    let resolveLookup
    vi.spyOn(api.ai, 'lookup').mockReturnValue(new Promise((resolve) => { resolveLookup = resolve }))
    render(<AddAuthorDialog onClose={vi.fn()} onCreated={vi.fn()} />)
    const lookup = screen.getByRole('button', {name: 'Look up birth date with AI'})
    expect(lookup.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Full name *'), {target: {value: 'Jane Austen'}})
    fireEvent.click(lookup)
    fireEvent.click(lookup)
    expect(api.ai.lookup).toHaveBeenCalledTimes(1)
    expect(screen.getByLabelText('Date of birth *').closest('fieldset').disabled).toBe(true)
    expect(screen.getByRole('button', {name: 'Save author'}).disabled).toBe(true)
    fireEvent.submit(screen.getByRole('button', {name: 'Save author'}).closest('form'))
    expect(api.authors.create).not.toHaveBeenCalled()
    await act(async () => resolveLookup({status: 'UNKNOWN'}))
    expect(screen.getByRole('button', {name: 'Look up birth date with AI'}).disabled).toBe(false)
  })

  it('preserves the date on uncertainty and visible failures and allows retry', async () => {
    vi.spyOn(api.ai, 'lookup')
      .mockResolvedValueOnce({status: 'UNKNOWN'})
      .mockRejectedValueOnce(new Error('Gemini quota or rate limit exceeded'))
      .mockResolvedValueOnce({status: 'FOUND', value: '1835-11-30'})
    render(<AddAuthorDialog author={author} onClose={vi.fn()} onUpdated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', {name: 'Look up birth date with AI'}))
    await screen.findByText(/Gemini wasn't sure/)
    expect(screen.getByLabelText('Date of birth *').value).toBe(author.dateOfBirth)
    fireEvent.click(screen.getByRole('button', {name: 'Look up birth date with AI'}))
    expect((await screen.findByRole('alert')).textContent).toContain('quota or rate limit exceeded')
    expect(screen.getByLabelText('Date of birth *').value).toBe(author.dateOfBirth)
    fireEvent.click(screen.getByRole('button', {name: 'Look up birth date with AI'}))
    await screen.findByText(/Gemini suggested this date/)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('ignores a lookup after closing and keeps promotion retry fields locked', async () => {
    let resolveLookup
    vi.spyOn(api.ai, 'lookup').mockReturnValue(new Promise((resolve) => { resolveLookup = resolve }))
    const {unmount} = render(<AddAuthorDialog author={author} onClose={vi.fn()} onUpdated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', {name: 'Look up birth date with AI'}))
    expect(screen.getByRole('button', {name: 'Close author form'}).disabled).toBe(false)
    unmount()
    await act(async () => resolveLookup({status: 'FOUND', value: '1775-12-16'}))
    render(<AddAuthorDialog reviewing publishedAuthor={author} initialValues={author} onClose={vi.fn()} />)
    expect(screen.getByRole('button', {name: 'Look up birth date with AI'}).closest('fieldset').disabled).toBe(true)
    expect(screen.getByRole('button', {name: 'Look up death date with AI'}).closest('fieldset').disabled).toBe(true)
    expect(screen.getByRole('button', {name: 'Look up place of birth with AI'}).closest('fieldset').disabled).toBe(true)
    expect(screen.getByRole('button', {name: 'Look up biography with AI'}).closest('fieldset').disabled).toBe(true)
  })

  it.each(['create', 'edit', 'review'])('looks up only the editable death date in %s mode', async (mode) => {
    vi.spyOn(api.ai, 'lookup').mockResolvedValue({status: 'FOUND', value: '1910-04-21'})
    const onSave = vi.fn()
    render(<AddAuthorDialog author={mode === 'edit' ? author : null}
      initialValues={{fullName: '  Samuel Clemens  ', dateOfBirth: '1835-11-30'}}
      reviewing={mode === 'review'} onSave={mode === 'review' ? onSave : undefined}
      onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', {name: 'Look up death date with AI'}))
    await screen.findByText(/Gemini suggested this date/)
    expect(api.ai.lookup).toHaveBeenCalledWith('AUTHOR_DATE_OF_DEATH', {fullName: 'Samuel Clemens'})
    expect(screen.getByLabelText('Date of death').value).toBe('1910-04-21')
    expect(screen.getByLabelText('Date of death').required).toBe(false)
    expect(screen.getByLabelText('Date of birth *').value).toBe('1835-11-30')
    expect(api.authors.create).not.toHaveBeenCalled()
    expect(api.authors.update).not.toHaveBeenCalled()
    expect(onSave).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Date of death'), {target: {value: ''}})
    expect(screen.getByLabelText('Date of death').value).toBe('')
  })

  it('preserves both dates on death-date uncertainty/errors and retries only the death lookup', async () => {
    vi.spyOn(api.ai, 'lookup')
      .mockResolvedValueOnce({status: 'UNKNOWN'})
      .mockRejectedValueOnce(new Error('Gemini quota exceeded'))
      .mockResolvedValueOnce({status: 'FOUND', value: '1910-04-21'})
    render(<AddAuthorDialog author={author} onClose={vi.fn()} onUpdated={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', {name: 'Look up death date with AI'}))
    await screen.findByText(/wasn't sure of the exact death date/)
    expect(screen.getByLabelText('Date of death').value).toBe(author.dateOfDeath)
    fireEvent.click(screen.getByRole('button', {name: 'Look up death date with AI'}))
    expect((await screen.findByRole('alert')).textContent).toContain('Unable to look up death date: Gemini quota exceeded')
    expect(screen.getByLabelText('Date of death').value).toBe(author.dateOfDeath)
    expect(screen.getByLabelText('Date of birth *').value).toBe(author.dateOfBirth)
    fireEvent.click(screen.getByRole('button', {name: 'Look up death date with AI'}))
    await screen.findByText(/Gemini suggested this date/)
    expect(screen.queryByRole('alert')).toBeNull()
    expect(api.ai.lookup.mock.calls.every(([type]) => type === 'AUTHOR_DATE_OF_DEATH')).toBe(true)
  })

  it('blocks both lookup buttons and saving while a death lookup is pending', async () => {
    let resolveLookup
    vi.spyOn(api.ai, 'lookup').mockReturnValue(new Promise((resolve) => { resolveLookup = resolve }))
    render(<AddAuthorDialog onClose={vi.fn()} onCreated={vi.fn()} />)
    const deathLookup = screen.getByRole('button', {name: 'Look up death date with AI'})
    expect(deathLookup.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Full name *'), {target: {value: 'Living Author'}})
    fireEvent.click(deathLookup)
    await screen.findByText('Asking Gemini for the exact death date...')
    expect(screen.getByRole('button', {name: 'Look up birth date with AI'}).disabled).toBe(true)
    expect(deathLookup.disabled).toBe(true)
    expect(screen.getByRole('button', {name: 'Save author'}).disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', {name: 'Look up birth date with AI'}))
    expect(api.ai.lookup).toHaveBeenCalledTimes(1)
    await act(async () => resolveLookup({status: 'UNKNOWN'}))
    expect(screen.getByLabelText('Date of death').value).toBe('')
    expect(screen.getByRole('button', {name: 'Look up birth date with AI'}).disabled).toBe(false)
  })

  it.each([null, author])('uses compact labels and hover guidance in create/edit author forms', (existingAuthor) => {
    render(<AddAuthorDialog author={existingAuthor} onClose={vi.fn()} onCreated={vi.fn()} onUpdated={vi.fn()} />)
    const dialog = screen.getByRole('dialog')
    expect(dialog.hasAttribute('aria-describedby')).toBe(false)
    expect(dialog.querySelector('.add-quote-description')).toBeNull()
    for (const {name, label, required, description} of authorFields) {
      const input = screen.getByLabelText(`${label}${required ? ' *' : ''}`)
      expect(input.required).toBe(Boolean(required))
      expect(dialog.querySelector(`label[for="author-${name}"]`).title).toBe(description)
    }
    expect(screen.getByRole('button', {name: 'Save author'}).closest('.dialog-header')).toBeNull()
  })

  it('opens from quote attribution, shows all details read-only, and restores focus on close', async () => {
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
    const closeButton = within(dialog).getByRole('button', {name: 'Close author details'})
    expect(closeButton.title).toBe('Close author details')
    expect(closeButton.closest('.dialog-header')).toBeTruthy()
    expect(dialog.querySelector('.dialog-body').contains(closeButton)).toBe(false)
    fireEvent.click(closeButton)
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
    render(<QuotesList query="quote" isEditor onAuthorUpdated={onAuthorUpdated} />)
    fireEvent.click((await screen.findAllByRole('button', {name: 'Mark Twain'}))[0])
    await openEditor()
    fireEvent.change(screen.getByLabelText('Known as'), {target: {value: updated.knownAs}})
    submitEditor()
    await screen.findByText('Author updated.')
    await waitFor(() => expect(api.quotes.listPage).toHaveBeenCalledTimes(2))
    expect(screen.getAllByRole('button', {name: updated.knownAs})).toHaveLength(2)
    expect(onAuthorUpdated).toHaveBeenCalledWith(updated)
    fireEvent.click(screen.getByRole('button', {name: 'Close author details'}))
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
    render(<AboutAuthorDialog authorId={7} isEditor onClose={vi.fn()} />)
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

  it('can close from the header while details are loading or have failed', async () => {
    api.authors.get.mockReturnValueOnce(new Promise(() => {}))
    const onClose = vi.fn()
    const {unmount} = render(<AboutAuthorDialog authorId={7} onClose={onClose} />)
    const close = screen.getByRole('button', {name: 'Close author details'})
    expect(document.activeElement).toBe(close)
    fireEvent.click(close)
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()

    api.authors.get.mockRejectedValueOnce(new Error('Offline'))
    render(<AboutAuthorDialog authorId={7} onClose={onClose} />)
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', {name: 'Close author details'}))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(api.authors.update).not.toHaveBeenCalled()
  })

  it('prefills all editable fields and saves a full replacement, returning to refreshed details', async () => {
    const updated = {...author, fullName: 'Updated Name', knownAs: null, bio: null}
    api.authors.update.mockResolvedValue(updated)
    const onUpdated = vi.fn()
    const onClose = vi.fn()
    render(<AboutAuthorDialog authorId={7} isEditor onClose={onClose} onUpdated={onUpdated} />)
    const editor = await openEditor()
    for (const [label, value] of [
      ['Full name *', author.fullName], ['Known as', author.knownAs],
      ['Date of birth *', author.dateOfBirth], ['Date of death', author.dateOfDeath],
      ['Place of birth', author.placeOfBirth], ['Nationality', author.nationality], ['Biography', author.bio],
    ]) {
      expect(within(editor).getByLabelText(label).value).toBe(value)
    }
    expect(screen.getByLabelText('Full name *').required).toBe(true)
    const birthDate = screen.getByLabelText('Date of birth *')
    expect(birthDate.required).toBe(true)
    fireEvent.change(birthDate, {target: {value: ''}})
    expect(editor.querySelector('form').checkValidity()).toBe(false)
    fireEvent.change(birthDate, {target: {value: author.dateOfBirth}})
    expect(screen.getByLabelText('Full name *').maxLength).toBe(255)
    expect(screen.getByLabelText('Biography').maxLength).toBe(1024)
    fireEvent.change(screen.getByLabelText('Full name *'), {target: {value: ' Updated Name '}})
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
    render(<AboutAuthorDialog authorId={7} isEditor onClose={onClose} onUpdated={vi.fn()} />)
    await openEditor()
    fireEvent.change(screen.getByLabelText('Full name *'), {target: {value: 'Unsaved'}})
    fireEvent.click(screen.getByRole('button', {name: 'Close author form'}))
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
    render(<AboutAuthorDialog authorId={7} isEditor onClose={vi.fn()} onUpdated={vi.fn()} />)
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
    render(<AboutAuthorDialog authorId={7} isEditor onClose={vi.fn()} onUpdated={vi.fn()} />)
    await openEditor()
    fireEvent.change(screen.getByLabelText('Full name *'), {target: {value: '  '}})
    submitEditor()
    expect(screen.getByRole('alert').textContent).toContain('Enter a full name')
    expect(api.authors.update).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Full name *'), {target: {value: author.fullName}})
    const form = screen.getByRole('button', {name: 'Save author'}).closest('form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    fireEvent.keyDown(document, {key: 'Escape'})
    expect(screen.getByRole('dialog', {name: 'Edit author'})).toBeTruthy()
    expect(screen.getByRole('button', {name: 'Cancel'}).disabled).toBe(true)
    const closeButton = screen.getByRole('button', {name: 'Close author form'})
    expect(closeButton.disabled).toBe(true)
    fireEvent.click(closeButton)
    expect(screen.getByRole('dialog', {name: 'Edit author'})).toBeTruthy()
    expect(api.authors.update).toHaveBeenCalledTimes(1)
    await act(async () => resolveSave(author))
    expect(screen.getByText('Author updated.')).toBeTruthy()
  })

  it('removes editing access when editor access is lost', async () => {
    const {rerender} = render(<AboutAuthorDialog authorId={7} isEditor onClose={vi.fn()} onUpdated={vi.fn()} />)
    await openEditor()
    rerender(<AboutAuthorDialog authorId={7} isEditor={false} onClose={vi.fn()} onUpdated={vi.fn()} />)
    expect(screen.queryByRole('dialog', {name: 'Edit author'})).toBeNull()
    expect(screen.queryByRole('button', {name: 'Edit author'})).toBeNull()
    expect(api.authors.update).not.toHaveBeenCalled()
  })

  it('refreshes quote attribution and the sidebar after saving without changing filters', async () => {
    const updated = {...author, knownAs: 'Updated Display Name'}
    vi.spyOn(api.auth, 'me').mockResolvedValue({authenticated: true, editor: true, name: 'Editor'})
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
    const quotes = screen.getByRole('main')
    fireEvent.click(await within(quotes).findByRole('button', {name: 'Mark Twain'}))
    await openEditor()
    fireEvent.change(screen.getByLabelText('Known as'), {target: {value: updated.knownAs}})
    submitEditor()
    await screen.findByText('Author updated.')
    await within(quotes).findByRole('button', {name: updated.knownAs})
    await waitFor(() => expect(screen.getByRole('button', {name: updated.knownAs, pressed: true})).toBeTruthy())
    expect(api.authors.listPage).toHaveBeenCalledTimes(2)
    await waitFor(() => expect(api.quotes.listPage).toHaveBeenCalledTimes(2))
    expect(api.quotes.listPage).toHaveBeenLastCalledWith(7, '', {toneIds: [], themeIds: [], formIds: [], sourceIds: []}, {page: 0, size: 20})
  })
})
