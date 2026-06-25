import { env } from './env'

// Outbound client to the wwebjs-api container. Sole holder of WA_API_KEY —
// the key is injected server-side here and never reaches the browser.

export interface WaResult<T = unknown> {
  success: boolean
  [key: string]: unknown
  result?: T
}

// Upstream (wwebjs-api container) failure. Carries an HTTP status so the route
// layer can surface 502 instead of an opaque 500 — the dashboard route exists,
// it's the upstream container that's unreachable or erroring.
export class WaUpstreamError extends Error {
  readonly status = 502
  constructor(message: string) {
    super(message)
    this.name = 'WaUpstreamError'
  }

  // Elysia calls toResponse() on thrown errors that define it — gives the
  // client a JSON body (502 + reason) instead of an opaque plain-text error.
  toResponse(): Response {
    return new Response(JSON.stringify({ error: this.message, status: this.status }), {
      status: this.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

function baseUrl(): string {
  if (!env.WA_API_BASE_URL) throw new WaUpstreamError('WA_API_BASE_URL env not set')
  return env.WA_API_BASE_URL
}

async function rawFetch(path: string, init?: RequestInit, jsonHeaders = true): Promise<Response> {
  try {
    return await fetch(`${baseUrl()}${path}`, {
      ...init,
      headers: {
        ...(jsonHeaders ? { 'Content-Type': 'application/json' } : {}),
        'x-api-key': env.WA_API_KEY,
        ...(init?.headers as Record<string, string>),
      },
    })
  } catch (e) {
    // Network-level failure (DNS, TLS, container down) — fetch itself rejects.
    throw new WaUpstreamError(`WA container unreachable at ${path}: ${e instanceof Error ? e.message : String(e)}`)
  }
}

export async function waFetch<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const res = await rawFetch(path, init)
  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    data = text
  }
  if (!res.ok) {
    const msg = (data as { error?: string; message?: string })?.error ?? (data as { message?: string })?.message ?? text
    throw new WaUpstreamError(`WA API ${res.status} ${path}: ${msg}`)
  }
  return data as T
}

// Returns raw PNG bytes for the QR image endpoint (binary, not JSON).
export async function waFetchImage(path: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const res = await rawFetch(path, undefined, false)
  if (!res.ok) throw new WaUpstreamError(`WA API ${res.status} ${path}`)
  return { bytes: await res.arrayBuffer(), contentType: res.headers.get('content-type') ?? 'image/png' }
}

// ─── Session ──────────────────────────────────────────────
export const startSession = (id: string) => waFetch(`/session/start/${id}`)
export const getStatus = (id: string) => waFetch(`/session/status/${id}`)
export const getQr = (id: string) => waFetch(`/session/qr/${id}`)
export const getQrImage = (id: string) => waFetchImage(`/session/qr/${id}/image`)
export const restartSession = (id: string) => waFetch(`/session/restart/${id}`)
export const stopSession = (id: string) => waFetch(`/session/stop/${id}`)
export const terminateSession = (id: string) => waFetch(`/session/terminate/${id}`)
export const getSessions = () => waFetch('/session/getSessions')

export const requestPairingCode = (id: string, phoneNumber: string, showNotification = true) =>
  waFetch(`/session/requestPairingCode/${id}`, {
    method: 'POST',
    body: JSON.stringify({ phoneNumber, showNotification }),
  })

// ─── Client ───────────────────────────────────────────────
export const getAccountInfo = (id: string) => waFetch(`/client/getClassInfo/${id}`)
export const getContacts = (id: string) => waFetch(`/client/getContacts/${id}`)
export const getChats = (id: string) => waFetch(`/client/getChats/${id}`)

export const getProfilePicUrl = (id: string, contactId: string) =>
  waFetch<{ success: boolean; result?: string | null }>(`/client/getProfilePicUrl/${id}`, {
    method: 'POST',
    body: JSON.stringify({ contactId }),
  })

export const sendMessage = (id: string, chatId: string, content: string) =>
  waFetch(`/client/sendMessage/${id}`, {
    method: 'POST',
    body: JSON.stringify({ chatId, contentType: 'string', content }),
  })

export const fetchChatMessages = (id: string, chatId: string, limit: number) =>
  waFetch<{ success: boolean; messages?: unknown[]; result?: unknown[] }>(`/client/fetchMessages/${id}`, {
    method: 'POST',
    body: JSON.stringify({ chatId, searchOptions: { limit } }),
  })
