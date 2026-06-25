import { prisma } from './db'
import { generateToken, normalizePhone, TOKEN_TTL_MS } from './wa-verify'

// Inti start/poll WAV dipakai bersama oleh public router (API key) dan proxy sim
// (cookie SUPER_ADMIN). Behavior identik agar pipeline yang diuji simulasi = pipeline asli.

export interface StartedRequest {
  id: string
  token: string
  expiresAt: Date
}

// Buat VerifyRequest PENDING dengan token unik. Retry kecil bila tabrakan index unik
// token. null bila gagal 5× (pemanggil balas 503).
export async function startVerifyRequest(
  consumerId: string,
  expectedPhone?: string | null,
): Promise<StartedRequest | null> {
  const normalized = expectedPhone ? normalizePhone(expectedPhone) : null
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateToken()
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)
    try {
      return await prisma.verifyRequest.create({
        data: { consumerId, token, expectedPhone: normalized, expiresAt },
        select: { id: true, token: true, expiresAt: true },
      })
    } catch {
      // tabrakan token (sangat jarang) → coba token baru
    }
  }
  return null
}

export interface PolledRequest {
  status: 'PENDING' | 'VERIFIED' | 'EXPIRED'
  matchedPhone: string | null
  verifiedAt: string | null
  expiresAt: string
}

// Poll status request, di-scope consumerId → request milik consumer lain tampak 404 (null).
// Live-cek kadaluarsa: PENDING yang lewat expiresAt dilaporkan EXPIRED tanpa menunggu sweep.
export async function pollVerifyRequest(consumerId: string, id: string): Promise<PolledRequest | null> {
  const req = await prisma.verifyRequest.findFirst({
    where: { id, consumerId },
    select: { status: true, matchedPhone: true, verifiedAt: true, expiresAt: true },
  })
  if (!req) return null
  const expired = req.status === 'PENDING' && req.expiresAt.getTime() < Date.now()
  return {
    status: expired ? 'EXPIRED' : req.status,
    matchedPhone: req.matchedPhone,
    verifiedAt: req.verifiedAt ? req.verifiedAt.toISOString() : null,
    expiresAt: req.expiresAt.toISOString(),
  }
}
