import { appLog } from './applog'
import { prisma } from './db'
import { audit } from './route-helpers'
import * as wa from './wa-client'
import { checkAndConsume, getPolicy } from './wa-policy'

// Balasan otomatis WhatsApp saat verifikasi WAV berhasil. Dipicu best-effort dari
// handleInbound (blok pemenang match). Membalas pesan INBOUND user (bukan cold outreach),
// jadi aman: lewat rate-gate (skip aturan kirim-duluan), idempoten, dan tak pernah
// menggagalkan verifikasi bila balasan gagal — hasil tetap tersedia via polling/webhook.

// Teks default; dipakai UI sebagai placeholder & fallback saat operator tak menyetel teks.
export const DEFAULT_VERIFY_REPLY_MESSAGE = 'Nomor Anda berhasil terverifikasi. Terima kasih 🙏'

// Varian ekuivalen dipilih deterministik per-request agar balasan tak seragam identik
// (kurangi sidik-jari template-spam) tanpa perlu Math.random.
const DEFAULT_VARIANTS = [
  DEFAULT_VERIFY_REPLY_MESSAGE,
  'Verifikasi nomor Anda berhasil. Terima kasih 🙏',
  'Nomor Anda sudah terverifikasi. Terima kasih telah mengonfirmasi 🙏',
] as const

// Hash string sederhana & deterministik (djb2) → indeks varian. seed = requestId.
function seedIndex(seed: string, mod: number): number {
  let h = 5381
  for (let i = 0; i < seed.length; i++) h = (h * 33 + seed.charCodeAt(i)) >>> 0
  return h % mod
}

// Teks balasan final. Custom (dari policy) di-hormati verbatim — operator sendiri yang
// mengatur variasi. Kosong/null → rotasi varian default by seed. Tak pernah menyisipkan
// nomor/token (zero PII).
export function buildReplyMessage(custom: string | null | undefined, seed: string): string {
  const trimmed = custom?.trim()
  if (trimmed) return trimmed
  return DEFAULT_VARIANTS[seedIndex(seed, DEFAULT_VARIANTS.length)]!
}

// Kirim balasan best-effort. Semua kegagalan ditelan dengan log — verifikasi tak boleh
// terpengaruh. sessionId = WA session id nomor server; phone = matchedPhone (digit mentah).
export async function sendVerifyReply(requestId: string, sessionId: string, phone: string): Promise<void> {
  const policy = await getPolicy()
  if (!policy.verifyReplyEnabled) return
  if (!phone) return

  // Idempotency claim: hanya satu pemenang yang set replySentAt (guard status VERIFIED &
  // replySentAt masih null). Poller yang re-run atau match dobel → count 0 → berhenti.
  const claim = await prisma.verifyRequest
    .updateMany({
      where: { id: requestId, status: 'VERIFIED', replySentAt: null },
      data: { replySentAt: new Date() },
    })
    .catch(() => ({ count: 0 }))
  if (claim.count !== 1) return

  // Rekonstruksi chatId dari nomor mentah. Pakai @c.us (personal) — hindari @lid yang tak
  // selalu bisa dibalas.
  const chatId = `${phone}@c.us`

  // Gate rate-only: min-interval, cooldown per-nomor, plafon volume tetap ditegakkan; aturan
  // wajib-ack & first-contact dilewati (balasan inbound, bukan kirim-duluan).
  const gate = await checkAndConsume(sessionId, chatId, { skipOutreachGates: true })
  if (!gate.ok) {
    appLog('info', 'WA verify reply skipped (rate)', `request=${requestId} status=${gate.status}`).catch(() => {})
    return
  }

  const message = buildReplyMessage(policy.verifyReplyMessage, requestId)
  try {
    await wa.sendMessage(sessionId, chatId, message)
    appLog('info', 'WA verify reply sent', `request=${requestId}`).catch(() => {})
    audit(null, 'WA_VERIFY_REPLY_SENT', `request=${requestId}`, 'system')
  } catch (e) {
    appLog('warn', 'WA verify reply failed', e instanceof Error ? e.message : String(e)).catch(() => {})
  }
}
