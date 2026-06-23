import { afterEach, describe, expect, test } from 'bun:test'
import { apiFetch } from '../../src/frontend/lib/apiFetch'

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
})

function captureFetch(status = 200, body: unknown = { ok: true }) {
  const calls: { url: string; init?: RequestInit }[] = []
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  }) as typeof fetch
  return calls
}

function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  return new Headers(init?.headers).get(name) ?? undefined
}

describe('apiFetch', () => {
  test('sets JSON Content-Type when a body is present', async () => {
    const calls = captureFetch()
    await apiFetch('/api/x', { method: 'POST', body: JSON.stringify({ a: 1 }) })
    expect(headerOf(calls[0].init, 'content-type')).toBe('application/json')
  })

  test('does not set Content-Type for bodyless requests', async () => {
    const calls = captureFetch()
    await apiFetch('/api/x')
    expect(headerOf(calls[0].init, 'content-type')).toBeUndefined()
  })

  test('caller-supplied Content-Type wins over the default', async () => {
    const calls = captureFetch()
    await apiFetch('/api/x', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'raw',
    })
    expect(headerOf(calls[0].init, 'content-type')).toBe('text/plain')
  })

  test('always sends credentials', async () => {
    const calls = captureFetch()
    await apiFetch('/api/x')
    expect(calls[0].init?.credentials).toBe('include')
  })

  test('throws with server error message on non-ok response', async () => {
    captureFetch(400, { error: 'phoneNumber wajib diisi' })
    await expect(apiFetch('/api/x', { method: 'POST', body: '{}' })).rejects.toThrow('phoneNumber wajib diisi')
  })
})
