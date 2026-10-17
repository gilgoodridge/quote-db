import assert from 'node:assert/strict'
import { afterEach, test } from 'node:test'
import { api, getGoogleOAuthStartUrl, getLoginReturnState } from './api.js'

const originalFetch = globalThis.fetch

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

  await api.authors.create({ givenName: 'Ada' })
  await api.authors.update(1, { givenName: 'Grace' })
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
    api.authors.create({ givenName: 'Ada' }),
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
