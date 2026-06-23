import { UnauthorizedError } from '@/frontend/lib/errors'

export async function apiFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  // Default JSON Content-Type when sending a body — without it fetch sends
  // text/plain and the server won't parse the JSON, failing validation (422).
  // Caller-supplied headers win, so explicit overrides still apply.
  const headers = init?.body ? { 'Content-Type': 'application/json', ...init.headers } : init?.headers
  const res = await fetch(path, { credentials: 'include', ...init, headers })
  if (res.status === 401) throw new UnauthorizedError()
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error ?? `HTTP ${res.status}`)
  }
  return res.json()
}
