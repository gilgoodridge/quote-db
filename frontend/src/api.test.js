import assert from 'node:assert/strict'
import {afterEach, test} from 'node:test'
import {api, getGoogleOAuthStartUrl, getLoginReturnState} from './api.js'
import {clearAddQuoteIntent, hasAddQuoteIntent, saveAddQuoteIntent} from './quoteIntent.js'
import {categorySelections} from './quoteCategories.js'

const originalFetch = globalThis.fetch

function pageResponse(content = [], number = 0, totalElements = content.length, size = 100) {
  return new Response(JSON.stringify({
    content,
    page: { number, size, totalElements, totalPages: Math.ceil(totalElements / size) },
  }))
}

test('quote listing preserves optional author filtering and blank-query behavior', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return pageResponse()
  }

  await api.quotes.list()
  await api.quotes.list(7)
  await api.quotes.list(7, ' \t ')
  await api.quotes.list(null, '')
  assert.deepEqual(calls.map(({ url }) => url),
    ['/api/quotes?page=0&size=100', '/api/quotes?authorId=7&page=0&size=100',
      '/api/quotes?authorId=7&page=0&size=100', '/api/quotes?page=0&size=100'])
  assert.ok(calls.every(({ options }) => options.credentials === 'include'))
})

test('author listing omits blank queries and encodes a trimmed full-name query', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({url, options})
    return pageResponse()
  }
  await api.authors.list()
  await api.authors.list(' \t ')
  await api.authors.listPage({query: '  Shake & café?  ', page: 2, size: 10})
  assert.deepEqual(calls.slice(0, 2).map(({url}) => url), [
    '/api/authors?page=0&size=100', '/api/authors?page=0&size=100',
  ])
  const params = new URL(calls[2].url, 'http://localhost').searchParams
  assert.deepEqual([...params], [['query', 'Shake & café?'], ['page', '2'], ['size', '10']])
  assert.ok(calls.every(({options}) => options.credentials === 'include'))
})

test('author search retains its query across all pages and surfaces failures', async () => {
  const calls = []
  const first = Array.from({length: 100}, (_, id) => ({id}))
  globalThis.fetch = async (url) => {
    calls.push(url)
    const number = Number(new URL(url, 'http://localhost').searchParams.get('page'))
    return pageResponse(number === 0 ? first : [{id: 100}], number, 101)
  }
  assert.deepEqual(await api.authors.list(' shake '), [...first, {id: 100}])
  assert.deepEqual(calls, [
    '/api/authors?query=shake&page=0&size=100', '/api/authors?query=shake&page=1&size=100',
  ])
  globalThis.fetch = async () => new Response('Search unavailable', {status: 503})
  await assert.rejects(api.authors.list('shake'), /Search unavailable/)
})

test('quote search encodes plain text and optionally restricts it to an author', async () => {
  const calls = []
  const results = [{ id: 9, text: 'Love life' }, { id: 3, text: 'Life' }]
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return pageResponse(results)
  }
  const query = '  love OR +life & café?  '
  assert.deepEqual(await api.quotes.list(null, query), results)
  assert.deepEqual(await api.quotes.list(7, query), results)
  assert.equal(calls.length, 2)
  for (const [index, call] of calls.entries()) {
    const url = new URL(call.url, 'http://localhost')
    assert.equal(url.pathname, '/api/quotes')
    assert.equal(url.searchParams.get('query'), query.trim())
    assert.equal(url.searchParams.get('authorId'), index === 0 ? null : '7')
    assert.equal([...url.searchParams.keys()].length, index === 0 ? 3 : 4)
    assert.equal(call.options.credentials, 'include')
  }
})

test('quote listing includes repeated category filters with optional author and query', async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    return pageResponse()
  }
  const categoryIds = { toneIds: [2, 3], themeIds: [5], formIds: [], sourceIds: [9] }

  await api.quotes.list(7, ' love ', categoryIds)
  await api.quotes.list(null, '', categoryIds)
  const first = new URL(calls[0], 'http://localhost')
  const second = new URL(calls[1], 'http://localhost')
  assert.deepEqual(first.searchParams.getAll('toneIds'), ['2', '3'])
  assert.equal(first.searchParams.get('themeIds'), '5')
  assert.equal(first.searchParams.get('sourceIds'), '9')
  assert.equal(first.searchParams.get('authorId'), '7')
  assert.equal(first.searchParams.get('query'), 'love')
  assert.equal(second.searchParams.has('authorId'), false)
  assert.equal(second.searchParams.has('query'), false)
  assert.deepEqual(second.searchParams.getAll('toneIds'), ['2', '3'])
})

test('quote search surfaces backend failures and invalid JSON', async () => {
  globalThis.fetch = async () => new Response('Search unavailable', { status: 503 })
  await assert.rejects(api.quotes.list(null, 'love'), /Request failed \(503\): Search unavailable/)
  globalThis.fetch = async () => new Response('not JSON')
  await assert.rejects(api.quotes.list(7, 'love'), /returned invalid JSON/)
})

test('page clients return content and metadata and send page and size', async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    return pageResponse([{id: 9}], 2, 31, 10)
  }
  const authors = await api.authors.listPage({page: 2, size: 10})
  const quotes = await api.quotes.listPage(7, 'love', {toneIds: [2]}, {page: 2, size: 10})
  assert.equal(authors.page.totalPages, 4)
  assert.deepEqual(quotes.content, [{id: 9}])
  assert.deepEqual(calls, [
    '/api/authors?page=2&size=10',
    '/api/quotes?authorId=7&query=love&toneIds=2&page=2&size=10',
  ])
})

test('existing list clients collect successive pages without losing filters or order', async () => {
  const calls = []
  const first = Array.from({length: 100}, (_, index) => ({id: index + 1}))
  globalThis.fetch = async (url) => {
    calls.push(url)
    const number = Number(new URL(url, 'http://localhost').searchParams.get('page'))
    return pageResponse(number === 0 ? first : [{id: 101}], number, 101)
  }
  assert.deepEqual(await api.authors.list(), [...first, {id: 101}])
  assert.deepEqual(await api.quotes.list(7, 'love', {toneIds: [2, 3]}), [...first, {id: 101}])
  assert.deepEqual(calls, [
    '/api/authors?page=0&size=100',
    '/api/authors?page=1&size=100',
    '/api/quotes?authorId=7&query=love&toneIds=2&toneIds=3&page=0&size=100',
    '/api/quotes?authorId=7&query=love&toneIds=2&toneIds=3&page=1&size=100',
  ])
})

test('pagination failures are visible rather than returning partial lists', async () => {
  let call = 0
  globalThis.fetch = async () => ++call === 1
    ? pageResponse(Array.from({length: 100}, (_, id) => ({id})), 0, 101)
    : new Response('Page unavailable', {status: 503})
  await assert.rejects(api.authors.list(), /Page unavailable/)
  globalThis.fetch = async () => new Response('[]')
  await assert.rejects(api.quotes.list(), /invalid paginated response/)
  globalThis.fetch = async () => pageResponse([], 1)
  await assert.rejects(api.authors.list(), /unexpected page number/)
})

afterEach(() => {
  globalThis.fetch = originalFetch
  delete globalThis.window
})

test('session lookup includes credentials', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response('{"authenticated":false}', { status: 200 })
  }

  assert.deepEqual(await api.auth.me(), { authenticated: false })
  assert.equal(calls[0].url, '/api/auth/me')
  assert.equal(calls[0].options.credentials, 'include')
})

test('OAuth start URL uses the backend API origin', () => {
  globalThis.window = { location: { origin: 'https://quotes.example' } }
  assert.equal(getGoogleOAuthStartUrl(), 'https://quotes.example/oauth2/authorization/google')
  assert.equal(
    getGoogleOAuthStartUrl('https://api.quotes.example/api', 'https://quotes.example'),
    'https://api.quotes.example/oauth2/authorization/google',
  )
})

test('OAuth error cleanup preserves other query parameters and the hash', () => {
  assert.deepEqual(
    getLoginReturnState('https://quotes.example/?keep=one&login=error&keep=two#section'),
    {
      hasLoginParameter: true,
      failed: true,
      cleanedUrl: '/?keep=one&keep=two#section',
    },
  )
})

test('OAuth success cleanup removes only the login parameter', () => {
  assert.deepEqual(
    getLoginReturnState('https://quotes.example/?login=success&next=%2Fquotes#top'),
    {
      hasLoginParameter: true,
      failed: false,
      cleanedUrl: '/?next=%2Fquotes#top',
    },
  )
})

test('every write and logout fetch fresh CSRF tokens with credentials', async () => {
  const calls = []
  let tokenNumber = 0
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url === '/api/auth/csrf') {
      tokenNumber += 1
      return new Response(JSON.stringify({
        token: `fresh-token-${tokenNumber}`,
        headerName: 'X-CSRF-TOKEN',
      }), { status: 200 })
    }
    return new Response('{}', { status: 200 })
  }

  await api.authors.create({ fullName: 'Ada Lovelace' })
  await api.authors.update(1, { fullName: 'Grace Hopper' })
  const logoutResponse = await api.auth.logout()

  assert.equal(logoutResponse.status, 200)
  assert.equal(tokenNumber, 3)
  assert.deepEqual(
    calls.filter((call) => call.url === '/api/auth/csrf').map((call) => call.options.credentials),
    ['include', 'include', 'include'],
  )
  assert.deepEqual(
    calls.filter((call) => call.url !== '/api/auth/csrf').map((call) => ({
      method: call.options.method,
      credentials: call.options.credentials,
      token: call.options.headers['X-CSRF-TOKEN'],
    })),
    [
      { method: 'POST', credentials: 'include', token: 'fresh-token-1' },
      { method: 'PUT', credentials: 'include', token: 'fresh-token-2' },
      { method: 'POST', credentials: 'include', token: 'fresh-token-3' },
    ],
  )
})

test('resource writes fetch CSRF and surface backend error text', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    if (url === '/api/auth/csrf') {
      return new Response('{"token":"token","headerName":"X-CSRF-TOKEN"}', {
        status: 200,
      })
    }
    return new Response('Author could not be saved', { status: 400 })
  }

  await assert.rejects(
    api.authors.create({ fullName: 'Ada Lovelace' }),
    /Request failed \(400\): Author could not be saved/,
  )
  assert.equal(calls.length, 2)
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[1].options.credentials, 'include')
  assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'token')
})

test('non-OK read responses reject with backend text', async () => {
  globalThis.fetch = async () => new Response('Service unavailable', { status: 503 })

  await assert.rejects(api.auth.me(), /Request failed \(503\): Service unavailable/)
})

test('duplicate author errors expose conflict status and the clear backend message', async () => {
  globalThis.fetch = async (url) => url === '/api/auth/csrf'
    ? new Response('{"token":"token","headerName":"X-CSRF-TOKEN"}')
    : new Response('The author already exists', { status: 409 })

  await assert.rejects(
    api.authors.create({ fullName: 'Jane Austen', dateOfBirth: '1775-12-16' }),
    (error) => {
      assert.equal(error.status, 409)
      assert.match(error.message, /The author already exists/)
      return true
    },
  )
})

test('author creation sends every POST field with session credentials and CSRF', async () => {
  const calls = []
  const author = {
    fullName: 'Mary Anne Evans',
    knownAs: 'George Eliot',
    dateOfBirth: '1819-11-22',
    dateOfDeath: '1880-12-22',
    placeOfBirth: 'Nuneaton',
    nationality: 'English',
    bio: 'Novelist and poet.',
  }
  const saved = { ...author, id: 12 }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(url === '/api/auth/csrf'
      ? { token: 'author-token', headerName: 'X-CSRF-TOKEN' }
      : saved))
  }

  assert.deepEqual(await api.authors.create(author), saved)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, '/api/authors')
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[1].options.credentials, 'include')
  assert.equal(calls[1].options.headers['Content-Type'], 'application/json')
  assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'author-token')
  assert.deepEqual(JSON.parse(calls[1].options.body), author)
})

test('author editing sends a full replacement with session credentials and CSRF', async () => {
  const calls = []
  const replacement = {
    fullName: 'Updated Author', knownAs: null, dateOfBirth: '1950-05-15',
    dateOfDeath: null, placeOfBirth: null, nationality: 'US', bio: null,
  }
  const saved = {...replacement, id: 12}
  globalThis.fetch = async (url, options) => {
    calls.push({url, options})
    return new Response(JSON.stringify(url === '/api/auth/csrf'
      ? {token: 'author-edit-token', headerName: 'X-CSRF-TOKEN'}
      : saved))
  }

  assert.deepEqual(await api.authors.update(12, replacement), saved)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, '/api/authors/12')
  assert.equal(calls[1].options.method, 'PUT')
  assert.equal(calls[1].options.credentials, 'include')
  assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'author-edit-token')
  assert.deepEqual(JSON.parse(calls[1].options.body), replacement)
})

test('quote creation sends all POST fields with session credentials and CSRF', async () => {
  const calls = []
  const quote = {
    text: 'A new quote',
    authorId: 12,
    date: '2026-10-17',
    location: 'London',
    reference: 'A book, page 42',
    toneIds: [101, 103],
    themeIds: [205],
    formIds: [],
    sourceIds: [304, 305],
  }
  const saved = { ...quote, id: 42, author: { id: 12 } }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(url === '/api/auth/csrf'
      ? { token: 'quote-token', headerName: 'X-CSRF-TOKEN' }
      : saved))
  }

  assert.deepEqual(await api.quotes.create(quote), saved)
  assert.equal(calls.length, 2)
  assert.equal(calls[1].url, '/api/quotes')
  assert.equal(calls[1].options.method, 'POST')
  assert.equal(calls[1].options.credentials, 'include')
  assert.equal(calls[1].options.headers['Content-Type'], 'application/json')
  assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'quote-token')
  assert.deepEqual(JSON.parse(calls[1].options.body), quote)
})

test('quote creation preserves optional null fields and surfaces authentication errors', async () => {
  const quote = { text: 'A quote', authorId: 1, date: null, location: null, reference: null }
  globalThis.fetch = async (url, options) => {
    if (url === '/api/auth/csrf') {
      return new Response('{"token":"token","headerName":"X-CSRF-TOKEN"}')
    }
    assert.deepEqual(JSON.parse(options.body), quote)
    return new Response('{"error":"Login required"}', { status: 401 })
  }

  await assert.rejects(api.quotes.create(quote), /Request failed \(401\).*Login required/)
})

test('quote editing sends a full replacement with credentials and a fresh CSRF token', async () => {
  const calls = []
  const replacement = {
    text: 'Updated quote',
    authorId: 12,
    date: null,
    location: null,
    reference: 'Updated reference',
    toneIds: [101, 103],
    themeIds: [],
    formIds: [201],
    sourceIds: [305],
  }
  const saved = { ...replacement, id: 42, author: { id: 12 } }
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(url === '/api/auth/csrf'
      ? { token: 'edit-token', headerName: 'X-CSRF-TOKEN' }
      : saved))
  }

  assert.deepEqual(await api.quotes.update(42, replacement), saved)
  assert.deepEqual(calls.map(({ url }) => url), ['/api/auth/csrf', '/api/quotes/42'])
  assert.ok(calls.every(({ options }) => options.credentials === 'include'))
  assert.equal(calls[1].options.method, 'PUT')
  assert.equal(calls[1].options.headers['Content-Type'], 'application/json')
  assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'edit-token')
  assert.deepEqual(JSON.parse(calls[1].options.body), replacement)
})

test('quote deletion accepts an empty response and never requests author deletion', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return url === '/api/auth/csrf'
      ? new Response('{"token":"delete-token","headerName":"X-CSRF-TOKEN"}')
      : new Response(null, { status: 204 })
  }

  assert.equal(await api.quotes.delete(42), true)
  assert.deepEqual(calls.map(({ url }) => url), ['/api/auth/csrf', '/api/quotes/42'])
  assert.ok(calls.every(({ options }) => options.credentials === 'include'))
  assert.equal(calls[1].options.method, 'DELETE')
  assert.equal(calls[1].options.headers['X-CSRF-TOKEN'], 'delete-token')
  assert.equal(calls[1].options.body, undefined)
})

test('quote edits and deletes surface authentication and server failures', async () => {
  for (const status of [401, 403, 500]) {
    globalThis.fetch = async (url) => url === '/api/auth/csrf'
      ? new Response('{"token":"token","headerName":"X-CSRF-TOKEN"}')
      : new Response('Quote could not be changed', { status })

    for (const write of [
      () => api.quotes.update(42, { text: 'Quote', authorId: 1 }),
      () => api.quotes.delete(42),
    ]) {
      await assert.rejects(write(), (error) => {
        assert.equal(error.status, status)
        assert.match(error.message, /Quote could not be changed/)
        return true
      })
    }
  }
})

test('failed CSRF lookup prevents quote edits and deletes', async () => {
  const calls = []
  globalThis.fetch = async (url) => {
    calls.push(url)
    return new Response('Sign in again', { status: 401 })
  }

  await assert.rejects(api.quotes.update(42, { text: 'Quote', authorId: 1 }), /Sign in again/)
  await assert.rejects(api.quotes.delete(42), /Sign in again/)
  assert.deepEqual(calls, ['/api/auth/csrf', '/api/auth/csrf'])
})

test('Add Quote intent survives the login redirect and is cleared after use', () => {
  const entries = new Map()
  const storage = {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  }
  assert.equal(hasAddQuoteIntent(storage), false)
  saveAddQuoteIntent(storage)
  assert.equal(hasAddQuoteIntent(storage), true)
  assert.deepEqual([...entries.values()], ['true'])
  clearAddQuoteIntent(storage)
  assert.equal(hasAddQuoteIntent(storage), false)
})

test('intent storage failures propagate so sign-in can show an actionable error', () => {
  const unavailable = () => { throw new Error('Storage blocked') }
  const storage = { getItem: unavailable, setItem: unavailable, removeItem: unavailable }
  assert.throws(() => hasAddQuoteIntent(storage), /Storage blocked/)
  assert.throws(() => saveAddQuoteIntent(storage), /Storage blocked/)
  assert.throws(() => clearAddQuoteIntent(storage), /Storage blocked/)
})

test('category catalogs use the public endpoint and preserve server IDs and labels', async () => {
  const catalog = {
    tones: [{ id: 101, name: 'Funny', description: 'Amuses through wit, irony, absurdity, or playful observation.' }],
    themes: [{ id: 101, name: 'Human nature' }],
    forms: [{ id: 301, name: 'Verse' }],
    sources: [{ id: 401, name: 'Play' }],
  }
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(catalog))
  }
  assert.deepEqual(await api.categories.list(), catalog)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, '/api/categories')
  assert.equal(calls[0].options.credentials, 'include')
})

test('category loading surfaces failed requests and malformed catalogs', async () => {
  globalThis.fetch = async () => new Response('Categories unavailable', { status: 503 })
  await assert.rejects(api.categories.list(), /Categories unavailable/)
  globalThis.fetch = async () => new Response('not JSON')
  await assert.rejects(api.categories.list(), /invalid JSON/)
  const valid = { tones: [], themes: [], forms: [], sources: [] }
  for (const invalid of [
    null, {}, { ...valid, themes: null },
    { ...valid, tones: [{ id: 0, name: 'Funny' }] },
    { ...valid, forms: [{ id: 1, name: '' }] },
    { ...valid, tones: [{ id: 1, name: 'Funny', description: 42 }] },
    { ...valid, sources: [{ id: 1, name: 'Play' }, { id: 1, name: 'Book' }] },
  ]) {
    globalThis.fetch = async () => new Response(JSON.stringify(invalid))
    await assert.rejects(api.categories.list(), /invalid .* catalog/)
  }
})

test('edit selection initialization keeps IDs in their own dimension without sharing arrays', () => {
  const quote = {
    tones: [{ id: 101, name: 'Funny' }, { id: 103, name: 'Insightful' }],
    themes: [{ id: 101, name: 'Human nature' }],
    forms: [],
    sources: [{ id: 401, name: 'Play' }],
  }
  const selections = categorySelections(quote)
  assert.deepEqual(selections, {
    toneIds: [101, 103], themeIds: [101], formIds: [], sourceIds: [401],
  })
  selections.toneIds.pop()
  assert.equal(quote.tones.length, 2)
  assert.deepEqual(categorySelections(), { toneIds: [], themeIds: [], formIds: [], sourceIds: [] })
})
