// Pure helpers for the WhatsApp pairing-code flow. Kept dependency-free (no
// React/Mantine) so the logic can be unit-tested without pulling in App.tsx.
//
// Why this exists: the wwebjs-api container returns HTTP 200 with
// { success: false } for application-level errors (e.g. session not started).
// apiFetch only throws on non-2xx, so without this guard a failed pairing
// request looks identical to success — the UI stays silent. These helpers
// surface that failure as a thrown Error with an actionable message.

export interface PairingResp {
  success?: boolean
  code?: string
  result?: string | { code?: string } | null
  message?: string
  error?: string
}

// The container's pairing response shape varies by version; pull the code out
// of the known variants ({ code }, { result: '...' }, { result: { code } }).
export function extractPairingCode(d: PairingResp | undefined): string | null {
  if (!d) return null
  if (typeof d.code === 'string') return d.code
  if (typeof d.result === 'string') return d.result
  if (d.result && typeof d.result === 'object' && typeof d.result.code === 'string') return d.result.code
  return null
}

// Translate the container's raw failure marker into something the user can act
// on, instead of leaving the request silent.
export function pairingErrorMessage(d: PairingResp | undefined): string {
  const raw = d?.message ?? d?.error
  if (raw === 'session_not_found' || raw === 'session_not_connected') {
    return 'Sesi WhatsApp belum dimulai. Klik "Start" dulu, tunggu sampai status PAIRING / QR muncul, baru minta kode.'
  }
  return raw ?? 'Container tidak mengembalikan kode pairing. Pastikan sesi sudah dimulai (Start).'
}

// Returns the pairing code, or throws an actionable Error when the container
// reported failure / no code. Used as the mutation's source of truth so the
// error surfaces in pairing.error (and the UI alert).
export function pairingCodeOrThrow(d: PairingResp | undefined): string {
  const code = extractPairingCode(d)
  if (d?.success === false || !code) throw new Error(pairingErrorMessage(d))
  return code
}
