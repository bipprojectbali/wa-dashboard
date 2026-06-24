import { appLog } from './applog'
import { prisma } from './db'
import { env } from './env'
import * as wa from './wa-client'
import { extractSessionIds } from './wa-sessions'
import { handleInbound } from './wa-verify'

// Supervisor capture WAV: listener WhatsApp always-on, lepas dari browser.
// Rekonsiliasi periodik membandingkan session di container vs DB (hanya
// ADMIN/SUPER_ADMIN aktif yang didengarkan), lalu memelihara satu WS persisten
// per session valid. Outbound dashboard→container (tahan NAT), mirror wa-bridge.

const RECONCILE_MS = 30_000
const MAX_BACKOFF_MS = 30_000

interface Listener {
  client: WebSocket | null
  retry: number
  closing: boolean
  timer: ReturnType<typeof setTimeout> | null
}

const listeners = new Map<string, Listener>()
let reconcileTimer: ReturnType<typeof setInterval> | null = null
let started = false

function wsUrl(sessionId: string): string {
  const base = env.WA_API_BASE_URL.replace(/^http/, 'ws')
  return `${base}/ws/${sessionId}`
}

// Validasi session id terhadap DB: hanya user ADMIN/SUPER_ADMIN & tidak diblokir
// yang boleh didengarkan. Inilah filter yang mencegah mendengarkan sesi asing.
async function validSessionIds(candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set()
  const rows = await prisma.user.findMany({
    where: { id: { in: candidateIds }, blocked: false, role: { in: ['ADMIN', 'SUPER_ADMIN'] } },
    select: { id: true },
  })
  return new Set(rows.map((r) => r.id))
}

function connect(sessionId: string, listener: Listener) {
  if (listener.client || listener.closing) return
  if (!env.WA_API_BASE_URL || !env.WA_API_KEY) return

  let client: WebSocket
  try {
    client = new WebSocket(wsUrl(sessionId), { headers: { 'x-api-key': env.WA_API_KEY } } as unknown as string[])
  } catch (e) {
    appLog('warn', 'WA verify listener connect failed', `${sessionId}: ${e instanceof Error ? e.message : String(e)}`)
    scheduleReconnect(sessionId, listener)
    return
  }
  listener.client = client

  client.onopen = () => {
    listener.retry = 0
    appLog('info', 'WA verify listener connected', `session=${sessionId}`).catch(() => {})
  }
  client.onmessage = (ev) => {
    onFrame(sessionId, typeof ev.data === 'string' ? ev.data : String(ev.data))
  }
  client.onclose = () => {
    listener.client = null
    if (!listener.closing) scheduleReconnect(sessionId, listener)
  }
  client.onerror = () => {
    // onclose menyusul; reconnect ditangani di sana.
  }
}

function scheduleReconnect(sessionId: string, listener: Listener) {
  if (listener.timer || listener.closing) return
  const delay = Math.min(1000 * 2 ** listener.retry, MAX_BACKOFF_MS)
  listener.retry += 1
  listener.timer = setTimeout(() => {
    listener.timer = null
    if (!listener.closing) connect(sessionId, listener)
  }, delay)
}

// Parse frame container { dataType, data: { message }, sessionId }. Hanya proses
// dataType === 'message'. sessionId dari frame dipakai bila ada, fallback ke key listener.
function onFrame(fallbackSessionId: string, data: string) {
  let frame: { dataType?: string; data?: { message?: unknown }; sessionId?: string }
  try {
    frame = JSON.parse(data)
  } catch {
    return
  }
  if (frame.dataType !== 'message') return
  const message = frame.data?.message
  if (!message || typeof message !== 'object') return
  const sessionId = frame.sessionId ?? fallbackSessionId
  handleInbound(sessionId, message as Record<string, unknown>).catch((e) =>
    appLog('warn', 'WA verify handleInbound error', String(e)).catch(() => {}),
  )
}

function closeListener(sessionId: string, listener: Listener) {
  listener.closing = true
  if (listener.timer) {
    clearTimeout(listener.timer)
    listener.timer = null
  }
  listener.client?.close()
  listener.client = null
  listeners.delete(sessionId)
}

async function reconcile() {
  if (!env.WA_API_BASE_URL || !env.WA_API_KEY) return
  let ids: string[]
  try {
    ids = extractSessionIds(await wa.getSessions())
  } catch {
    // Container tak terjangkau — pertahankan listener yang ada, coba lagi nanti.
    return
  }
  const valid = await validSessionIds(ids)

  // Buka listener untuk session valid yang belum punya.
  for (const id of valid) {
    if (!listeners.has(id)) {
      const listener: Listener = { client: null, retry: 0, closing: false, timer: null }
      listeners.set(id, listener)
      connect(id, listener)
    }
  }
  // Tutup listener yang session-nya tak lagi valid.
  for (const [id, listener] of listeners) {
    if (!valid.has(id)) closeListener(id, listener)
  }
}

// Dipanggil sekali dari boot hook (src/index.tsx). Idempoten.
export function startWaVerifySupervisor(): void {
  if (started) return
  started = true
  if (!env.WA_API_BASE_URL || !env.WA_API_KEY) {
    appLog('info', 'WA verify supervisor idle (WA env not set)').catch(() => {})
    return
  }
  reconcile().catch((e) => appLog('warn', 'WA verify reconcile error', String(e)).catch(() => {}))
  reconcileTimer = setInterval(() => {
    reconcile().catch((e) => appLog('warn', 'WA verify reconcile error', String(e)).catch(() => {}))
  }, RECONCILE_MS)
}

// Untuk test/shutdown: hentikan semua listener & loop.
export function stopWaVerifySupervisor(): void {
  if (reconcileTimer) {
    clearInterval(reconcileTimer)
    reconcileTimer = null
  }
  for (const [id, listener] of listeners) closeListener(id, listener)
  started = false
}
