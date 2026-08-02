const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api'

/** Try to get a new access token using the stored refresh token.
 *  Returns the new access token, or null if refresh isn't possible. */
async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem('refresh')
  if (!refresh) return null
  try {
    const res = await fetch(`${BASE_URL}/auth/token/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh }),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (data.access) {
      localStorage.setItem('access', data.access)
      return data.access
    }
  } catch {
    // fall through to null
  }
  return null
}

function clearSession() {
  localStorage.removeItem('access')
  localStorage.removeItem('refresh')
}

async function request(endpoint: string, options: RequestInit = {}, _retried = false): Promise<any> {
  const token = localStorage.getItem('access')

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  }

  // Set default content type to json if not FormData
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json'
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (!response.ok) {
    // Access token likely expired, transparently refresh once and retry.
    if (response.status === 401 && !_retried && localStorage.getItem('refresh')) {
      const newToken = await refreshAccessToken()
      if (newToken) {
        return request(endpoint, options, true)
      }
      // Refresh token is gone/expired too: the session is truly over.
      clearSession()
    }

    // We throw to catch it in our components
    const errorBody = await response.text()
    try {
      const errorJson = JSON.parse(errorBody)
      throw new Error(errorJson.detail || 'API Error')
    } catch {
      throw new Error(response.statusText)
    }
  }

  // Handle 204 No Content
  if (response.status === 204) return null

  // If response is a blob/file, return the blob directly
  const contentType = response.headers.get('content-type')
  if (contentType && !contentType.includes('application/json')) {
    return response.blob()
  }

  return response.json()
}

const prepareBody = (body: any) => body instanceof FormData ? body : JSON.stringify(body)

/**
 * POST that reads a Server-Sent Event body and calls `onDelta` for each chunk
 * of text as it arrives. Used by the assistant so a long answer appears as it
 * is written rather than after a long silence.
 *
 * `signal` lets the caller stop generating mid-answer.
 */
export async function postStream(
  endpoint: string,
  body: any,
  onDelta: (text: string) => void,
  signal?: AbortSignal,
  _retried = false,
): Promise<void> {
  const token = localStorage.getItem('access')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok) {
    if (response.status === 401 && !_retried && localStorage.getItem('refresh')) {
      const newToken = await refreshAccessToken()
      if (newToken) return postStream(endpoint, body, onDelta, signal, true)
      clearSession()
    }
    const text = await response.text()
    try {
      throw new Error(JSON.parse(text).detail || 'API Error')
    } catch (e: any) {
      throw new Error(e?.message || response.statusText)
    }
  }

  if (!response.body) throw new Error('Streaming is not supported by this browser.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  // SSE frames are separated by a blank line; a frame can straddle two reads,
  // so hold anything after the last separator until more arrives.
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split('\n\n')
    buffer = frames.pop() ?? ''

    for (const frame of frames) {
      const line = frame.split('\n').find((l) => l.startsWith('data:'))
      if (!line) continue
      try {
        const event = JSON.parse(line.slice(5).trim())
        if (event.error) throw new Error(event.error)
        if (event.delta) onDelta(event.delta)
        if (event.done) return
      } catch (err: any) {
        if (err instanceof SyntaxError) continue
        throw err
      }
    }
  }
}

export const client = {
  get: (endpoint: string, options?: RequestInit) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint: string, body: any, options?: RequestInit) => request(endpoint, { ...options, method: 'POST', body: prepareBody(body) }),
  put: (endpoint: string, body: any, options?: RequestInit) => request(endpoint, { ...options, method: 'PUT', body: prepareBody(body) }),
  patch: (endpoint: string, body: any, options?: RequestInit) => request(endpoint, { ...options, method: 'PATCH', body: prepareBody(body) }),
  delete: (endpoint: string, options?: RequestInit) => request(endpoint, { ...options, method: 'DELETE' }),
}
