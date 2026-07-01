import { randomBytes } from 'node:crypto'
import { appLog } from './applog'
import { prisma } from './db'
import * as wa from './wa-client'

// WhatsApp Inbound Verify (WAV) — matcher. Listener menyerahkan tiap pesan masuk
// ke sini; kita cocokkan token one-time dengan VerifyRequest PENDING. Matcher tetap
// murni (tak menyentuh wa-policy langsung); balasan opsional saat match dipicu best-effort
// via modul terpisah `wa-verify-reply` (default MATI, tergate rate anti-ban, idempoten).

// Alfabet base32 tanpa karakter ambigu (tanpa 0/1/8/9, O/I/L/B). Token = WAV- + 8 char.
const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ234567'
const TOKEN_LEN = 8
// Case-insensitive (flag i): keyboard HP kerap meng-autocapitalize/autocorrect, jadi token
// yang diketik user bisa berubah huruf besar/kecil. Hasil match dinormalisasi ke uppercase
// (lihat extractToken) sebelum lookup, karena token tersimpan uppercase.
const TOKEN_REGEX = /\bWAV-[0-9A-Z]{8}\b/i
export const TOKEN_TTL_MS = 5 * 60 * 1000 // 5 menit

export function generateToken(): string {
  const bytes = randomBytes(TOKEN_LEN)
  let out = ''
  for (let i = 0; i < TOKEN_LEN; i++) {
    out += TOKEN_ALPHABET[bytes[i]! % TOKEN_ALPHABET.length]
  }
  return `WAV-${out}`
}

// Cari token dalam isi pesan. Token boleh dikelilingi kata penjelasan (batas kata \b),
// dan boleh huruf besar/kecil — dinormalisasi ke uppercase agar cocok dengan token tersimpan.
// Mengembalikan token utuh (mis. "WAV-ABCD2345") atau null.
export function extractToken(body: string | null | undefined): string | null {
  if (!body) return null
  const m = body.match(TOKEN_REGEX)
  return m ? m[0].toUpperCase() : null
}

// Pesan natural yang dikirim user ke nomor server. Token diletakkan di AKHIR kalimat agar
// batas kata (\b) matcher tetap bersih dan enak dibaca manusia — bukan token telanjang.
export function buildVerifyMessage(token: string): string {
  return `Verifikasi nomor saya: ${token}`
}

// Instruksi yang dikembalikan ke consumer/operator pada response start. Menampilkan kalimat
// PERSIS yang harus dikirim user (lewat buildVerifyMessage) agar tak ada celah salah ketik.
export function buildVerifyInstruction(token: string, serverNumber?: string | null): string {
  const target = serverNumber ? ` ke ${serverNumber}` : ''
  return `Kirim pesan berikut via WhatsApp${target}: "${buildVerifyMessage(token)}"`
}

// Buang suffix WA (@c.us / @g.us) → sisakan digit nomor.
export function normalizePhone(from: string | null | undefined): string {
  if (!from) return ''
  return from.replace(/@.*$/, '').replace(/\D/g, '')
}

// Mask nomor untuk log/penyimpanan PII: tampilkan 3 awal + 4 akhir, sisanya '*'.
// "6281234566789" → "628****6789". Nomor pendek di-mask penuh.
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length <= 7) return '*'.repeat(digits.length)
  const head = digits.slice(0, 3)
  const tail = digits.slice(-4)
  return `${head}${'*'.repeat(digits.length - 7)}${tail}`
}

interface InboundMessage {
  from?: string
  body?: string
  fromMe?: boolean
  id?: unknown
}

// id container bisa string atau objek { _serialized }. Ambil bentuk string aman.
function extractMessageId(id: unknown): string | null {
  if (typeof id === 'string') return id
  if (id && typeof id === 'object') {
    const s = (id as { _serialized?: unknown })._serialized
    if (typeof s === 'string') return s
  }
  return null
}

export interface InboundResult {
  matched: boolean
  consumerId?: string
  requestId?: string
}

// Proses satu pesan masuk. sessionId = WA session id (= dashboard user id).
// Idempoten: updateMany dengan guard status=PENDING memastikan satu pemenang race.
export async function handleInbound(sessionId: string, message: InboundMessage): Promise<InboundResult> {
  // Abaikan pesan sendiri & non-personal (grup) di sini sebagai pertahanan berlapis;
  // listener juga sudah memfilter, tapi matcher tetap defensif.
  if (message.fromMe === true) return { matched: false }
  const from = message.from ?? ''
  // Terima pengirim personal @c.us DAN @lid (varian id pengirim WA pada pesan
  // inbound), tetap tolak grup @g.us & broadcast.
  if (!from.endsWith('@c.us') && !from.endsWith('@lid')) return { matched: false }

  const phone = normalizePhone(from)
  const masked = maskPhone(phone)
  const token = extractToken(message.body)

  if (!token) {
    await writeInboundLog(sessionId, masked, null, false, null)
    return { matched: false }
  }

  const now = new Date()
  const candidate = await prisma.verifyRequest.findFirst({
    where: { token, status: 'PENDING', expiresAt: { gt: now } },
    select: { id: true, consumerId: true, expectedPhone: true },
  })

  if (!candidate) {
    // Token berformat valid tapi tak ada request aktif (kadaluarsa / sudah dipakai / asing).
    await writeInboundLog(sessionId, masked, token, false, null)
    return { matched: false }
  }

  // Fix 1: Resolve @lid → nomor HP asli (best-effort). Kontak @lid tidak punya nomor di chatId-nya;
  // kita tanya container untuk mendapatkan field `number`. Fallback ke digit LID bila gagal.
  let resolvedPhone = phone
  let lidResolved = !from.endsWith('@lid') // @c.us sudah punya nomor asli; @lid perlu resolve
  if (from.endsWith('@lid')) {
    try {
      const contact = await wa.getContactById(sessionId, from)
      if (contact?.result?.number) {
        resolvedPhone = contact.result.number.replace(/\D/g, '')
        lidResolved = true
      } else {
        appLog('warn', 'WA verify @lid unresolved (no number)', `from=${phone}`).catch(() => {})
      }
    } catch (e) {
      appLog('warn', 'WA verify @lid resolve failed', e instanceof Error ? e.message : String(e)).catch(() => {})
    }
  }
  const resolvedMasked = maskPhone(resolvedPhone)

  // Fix 2: Server-side enforcement — server bertanggung jawab atas keamanan, bukan mendelegasikan
  // ke consumer. Bila expectedPhone diset, tolak match jika nomor pengirim tidak sesuai.
  // Pengecualian: @lid yang gagal di-resolve — nomor asli tidak diketahui, tidak bisa dibandingkan.
  if (candidate.expectedPhone && lidResolved) {
    const expected = normalizePhone(candidate.expectedPhone)
    if (expected && resolvedPhone !== expected) {
      appLog(
        'warn',
        'WA verify phone mismatch',
        `request=${candidate.id} expected=${maskPhone(expected)} actual=${resolvedMasked}`,
      ).catch(() => {})
      await writeInboundLog(sessionId, resolvedMasked, token, false, candidate.consumerId)
      return { matched: false }
    }
  }

  // Guard status=PENDING di updateMany → hanya satu pemenang walau pesan dobel.
  const res = await prisma.verifyRequest.updateMany({
    where: { id: candidate.id, status: 'PENDING', expiresAt: { gt: now } },
    data: {
      status: 'VERIFIED',
      matchedPhone: resolvedPhone,
      matchedMessageId: extractMessageId(message.id),
      verifiedAt: now,
    },
  })

  const won = res.count === 1
  await writeInboundLog(sessionId, resolvedMasked, token, won, candidate.consumerId)

  if (won) {
    appLog('info', 'WA verify matched', `consumer=${candidate.consumerId} from=${resolvedMasked}`).catch(() => {})
    // Picu webhook async (best-effort). Dynamic import memutus circular dependency
    // dengan listener/boot dan menjaga matcher tetap murni.
    import('./wa-verify-webhook')
      .then((m) => m.deliverVerified(candidate.id))
      .catch((e) => appLog('warn', 'WA verify webhook dispatch failed', String(e)).catch(() => {}))
    // Balasan otomatis ke user (best-effort, default MATI). Dynamic import menjaga matcher
    // murni & memutus circular dependency. from = chatId asli (@c.us/@lid) dari pesan masuk.
    import('./wa-verify-reply')
      .then((m) => m.sendVerifyReply(candidate.id, sessionId, from))
      .catch((e) => appLog('warn', 'WA verify reply dispatch failed', String(e)).catch(() => {}))
  }

  return { matched: won, consumerId: candidate.consumerId, requestId: candidate.id }
}

async function writeInboundLog(
  sessionId: string,
  fromMasked: string,
  tokenFound: string | null,
  matched: boolean,
  consumerId: string | null,
): Promise<void> {
  await prisma.verifyInboundLog
    .create({ data: { sessionId, fromMasked, tokenFound, matched, consumerId } })
    .catch((e) => appLog('warn', 'WA verify inbound log failed', String(e)).catch(() => {}))
}
