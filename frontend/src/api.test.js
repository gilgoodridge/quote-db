import assert from 'node:assert/strict'
import {afterEach, test} from 'node:test'
import {api, getGoogleOAuthStartUrl, getLoginReturnState} from './api.js'
import {clearAddQuoteIntent, hasAddQuoteIntent, saveAddQuoteIntent} from './quoteIntent.js'

const originalFetch = globalThis.fetch

test('quote listing preserves optional author filtering and blank-query behavior', async () => {
  const calls = []
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response('[]')
  }

  await api.quotes.list()
  await api.quotes.list(7)
  await api.quotes.list(7, ' \t ')
  await api.quotes.list(null, '')
  assert.deepEqual(calls.map(({ url }) => url),
    ['/api/quotes', '/api/quotes?authorId=7', '/api/quotes?authorId=7', '/api/quotes'])
  assert.ok(calls.every(({ options }) => options.credentials === 'include'))
})

test('quote search encodes plain text and optionally restricts it to an author', async () => {
  const calls = []
  const results = [{ id: 9, text: 'Love life' }, { id: 3, text: 'Life' }]
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options })
    return new Response(JSON.stringify(results))
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
    assert.equal([...url.searchParams.keys()].length, index === 0 ? 1 : 2)
    assert.equal(call.options.credentials, 'include')
  }
})

test('quote search surfaces backend failures and invalid JSON', async () => {
  globalThis.fetch = async () => new Response('Search unavailable', { status: 503 })
  await assert.rejects(api.quotes.list(null, 'love'), /Request failed \(503\): Search unavailable/)
  globalThis.fetch = async () => new Response('not JSON')
  await assert.rejects(api.quotes.list(7, 'love'), /returned invalid JSON/)
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

test('quote creation sends all POST fields with session credentials and CSRF', async () => {
  const calls = []
  const quote = {
    text: 'A new quote',
    authorId: 12,
    date: '2026-10-17',
    location: 'London',
    reference: 'A book, page 42',
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
