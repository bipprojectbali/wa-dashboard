import { appLog } from './applog'
import { env } from './env'
import { redis } from './redis'
import * as wa from './wa-client'
import { extractSessionIds } from './wa-sessions'
import { handleInbound, maskPhone, normalizePhone } from './wa-verify'

// Supervisor capture WAV via REST polling (pengganti listener WS yang tak pernah
// tertangkap: WS upgrade 502 di edge Cloudflare). Mekanisme: temukan session
// container yang nomornya == WA_VERIFY_SERVER_NUMBER & CONNECTED, lalu poll
// getChats tiap beberapa detik, ambil pesan inbound lebih baru dari watermark,
// serahkan ke handleInbound. Kontrak publik WAV tidak berubah.

const POLL_INTERVAL_MS = 4000
const RECONCILE_MS = 30_000
const watermarkKey = (sessionId: string) => `wa:verify:watermark:${sessionId}`

interface SupervisorState {
  running: boolean
  serverNumber: string | null
  sessionId: string | null
  watermark: number | null
  lastPollAt: number | null
  lastError: string | null
}

const state: SupervisorState = {
  running: false,
  serverNumber: null,
  sessionId: null,
  watermark: null,
  lastPollAt: null,
  lastError: null,
}

let pollTimer: ReturnType<typeof setInterval> | null = null
let reconcileTimer: ReturnType<typeof setInterval> | null = null
let started = false

interface RawChat {
  // Container memberi `lastMessage.timestamp` (epoch detik); `t` hanya di payload
  // mentah `_data` → fallback. Membaca `t` saja membuat watermark tak pernah maju.
  lastMessage?: { from?: string; body?: string; fromMe?: boolean; timestamp?: number; t?: number }
  // contact.number memberi nomor HP asli bahkan untuk kontak @lid — diteruskan ke
  // handleInbound agar @lid resolution tidak butuh API call tambahan.
  contact?: { number?: string }
}
export interface NewInbound {
  from: string
  body: string
  fromMe: boolean
  contactNumber?: string // dari chat.contact.number — nomor HP asli untuk kontak @lid
}

// Fungsi PURE (mudah di-unit-test tanpa container). Untuk tiap chat ambil
// lastMessage; sertakan bila inbound (fromMe===false) & lebih baru dari watermark
// (timestamp epoch DETIK → ms). Balas pesan lolos + epoch ms terbesar yang dilihat.
export function filterNewInbound(chats: RawChat[], watermarkMs: number): { messages: NewInbound[]; maxTMs: number } {
  const messages: NewInbound[] = []
  let maxTMs = watermarkMs
  for (const chat of chats) {
    const lm = chat.lastMessage
    const ts = lm?.timestamp ?? lm?.t
    if (!lm || typeof ts !== 'number') continue
    const tMs = ts * 1000
    if (tMs > maxTMs) maxTMs = tMs
    if (lm.fromMe === false && tMs > watermarkMs) {
      const contactNumber = chat.contact?.number?.replace(/\D/g, '') || undefined
      messages.push({ from: lm.from ?? '', body: lm.body ?? '', fromMe: false, contactNumber })
    }
  }
  return { messages, maxTMs }
}

// Tarik nomor RAW (belum di-mask) dari getClassInfo untuk dibandingkan dengan
// WA_VERIFY_SERVER_NUMBER. Tak bisa pakai accountOf() di wa-sessions karena itu
// sudah me-mask nomornya.
async function rawServerNumberOf(id: string): Promise<string | null> {
  const info = (await wa.getAccountInfo(id)) as {
    sessionInfo?: { wid?: { user?: string }; me?: { user?: string } }
  }
  return info.sessionInfo?.wid?.user ?? info.sessionInfo?.me?.user ?? null
}

// Cari session container yang nomornya == WA_VERIFY_SERVER_NUMBER & CONNECTED.
// WAV = satu nomor server tunggal → satu session.
async function resolveServerSession(): Promise<string | null> {
  const target = normalizePhone(env.WA_VERIFY_SERVER_NUMBER)
  if (!target) return null
  const ids = extractSessionIds(await wa.getSessions())
  for (const id of ids) {
    try {
      const s = (await wa.getStatus(id)) as { state?: string }
      if (s.state !== 'CONNECTED') continue
      const phone = await rawServerNumberOf(id)
      if (phone && normalizePhone(phone) === target) return id
    } catch {
      // Sesi belum siap → lewati, reconcile berikutnya coba lagi.
    }
  }
  return null
}

async function pollOnce(sessionId: string): Promise<void> {
  const raw = await redis.get(watermarkKey(sessionId)).catch(() => null)
  // Bootstrap: tanpa watermark, set = now agar riwayat lama tak diproses ulang.
  let watermark = raw ? Number(raw) : Date.now()
  if (!raw) await redis.set(watermarkKey(sessionId), String(watermark)).catch(() => {})

  const chatsResp = (await wa.getChats(sessionId)) as { chats?: RawChat[] } | RawChat[]
  const chats = Array.isArray(chatsResp) ? chatsResp : (chatsResp.chats ?? [])
  const { messages, maxTMs } = filterNewInbound(chats, watermark)

  for (const msg of messages) {
    await handleInbound(sessionId, msg)
  }

  if (maxTMs > watermark) {
    watermark = maxTMs
    await redis.set(watermarkKey(sessionId), String(watermark)).catch(() => {})
  }
  state.watermark = watermark
  state.lastPollAt = Date.now()
  state.lastError = null
}

async function reconcile(): Promise<void> {
  try {
    state.sessionId = await resolveServerSession()
  } catch (e) {
    state.lastError = e instanceof Error ? e.message : String(e)
  }
}

// Dipanggil sekali dari boot hook (src/index.tsx). Idempoten. Idle bila env WA
// belum lengkap — semangat sama versi WS lama.
export function startWaVerifySupervisor(): void {
  if (started) return
  started = true
  if (!env.WA_API_BASE_URL || !env.WA_API_KEY || !env.WA_VERIFY_SERVER_NUMBER) {
    appLog('info', 'WA verify supervisor idle (WA env not set)').catch(() => {})
    return
  }
  state.running = true
  state.serverNumber = maskPhone(normalizePhone(env.WA_VERIFY_SERVER_NUMBER))

  reconcile().catch((e) => appLog('warn', 'WA verify reconcile error', String(e)).catch(() => {}))
  reconcileTimer = setInterval(() => {
    reconcile().catch((e) => appLog('warn', 'WA verify reconcile error', String(e)).catch(() => {}))
  }, RECONCILE_MS)

  pollTimer = setInterval(() => {
    if (!state.sessionId) return
    pollOnce(state.sessionId).catch((e) => {
      state.lastError = e instanceof Error ? e.message : String(e)
      appLog('warn', 'WA verify poll error', String(e)).catch(() => {})
    })
  }, POLL_INTERVAL_MS)
}

// Untuk test/shutdown: hentikan loop poll & reconcile.
export function stopWaVerifySupervisor(): void {
  if (pollTimer) clearInterval(pollTimer)
  if (reconcileTimer) clearInterval(reconcileTimer)
  pollTimer = null
  reconcileTimer = null
  state.running = false
  started = false
}

// Inspeksi (endpoint/MCP). Nomor server di-mask — tak mengekspos PII penuh.
export function getSupervisorState(): SupervisorState & { pollIntervalMs: number } {
  return { ...state, pollIntervalMs: POLL_INTERVAL_MS }
}
