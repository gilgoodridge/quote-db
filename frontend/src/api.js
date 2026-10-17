const API_BASE = (import.meta.env?.VITE_API_URL || '/api').replace(/\/+$/, '')

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(
      `Request failed (${response.status}): ${message || response.statusText || 'Unknown error'}`,
    )
  }

  return response
}

async function requestJson(path, options) {
  const response = options?.method
    ? await requestWithCsrf(path, options)
    : await request(path, options)
  const body = await response.text()

  try {
    return JSON.parse(body)
  } catch {
    throw new Error(`Request succeeded but returned invalid JSON: ${body || 'Empty response'}`)
  }
}

async function requestWithCsrf(path, { method, headers = {}, body } = {}) {
  const csrfResponse = await request('/auth/csrf')
  const csrf = await csrfResponse.json()

  if (
    typeof csrf.token !== 'string' ||
    !csrf.token ||
    typeof csrf.headerName !== 'string' ||
    !csrf.headerName
  ) {
    throw new Error('The CSRF endpoint returned an invalid token or header name')
  }

  return request(path, {
    method,
    headers: { ...headers, [csrf.headerName]: csrf.token },
    ...(body === undefined ? {} : { body }),
  })
}

export function getGoogleOAuthStartUrl(
  apiBase = API_BASE,
  frontendOrigin = window.location.origin,
) {
  const backendOrigin = new URL(apiBase, frontendOrigin).origin
  return `${backendOrigin}/oauth2/authorization/google`
}

export function getLoginReturnState(href) {
  const url = new URL(href)
  const hasLoginParameter = url.searchParams.has('login')
  const failed = url.searchParams.get('login') === 'error'
  url.searchParams.delete('login')

  return {
    hasLoginParameter,
    failed,
    cleanedUrl: `${url.pathname}${url.search}${url.hash}`,
  }
}

export const api = {
  auth: {
    me: () => requestJson('/auth/me'),
    logout: () => requestWithCsrf('/auth/logout', { method: 'POST' }),
  },
  authors: {
    list: () => requestJson('/authors'),
    get: (id) => requestJson(`/authors/${id}`),
    create: (data) => requestJson('/authors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    update: (id, data) => requestJson(`/authors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    delete: async (id) => {
      await requestWithCsrf(`/authors/${id}`, { method: 'DELETE' })
      return true
    },
  },
  quotes: {
    create: (data) => requestJson('/quotes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    list: (authorId) => {
      const params = authorId ? `?authorId=${authorId}` : ''
      return requestJson(`/quotes${params}`)
    },
  },
}
