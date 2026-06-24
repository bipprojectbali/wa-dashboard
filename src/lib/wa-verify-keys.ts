import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { env } from './env'

// API key consumer untuk WhatsApp Inbound Verify (WAV). Plaintext ditampilkan
// SEKALI saat pembuatan; DB hanya menyimpan hash deterministik (HMAC-SHA256)
// agar bisa di-lookup ber-index tanpa iterasi, plus prefix untuk identifikasi UI.

const KEY_PREFIX = 'wav_sk_'
const PREFIX_DISPLAY_LEN = 12 // panjang apiKeyPrefix yang disimpan untuk UI

export interface GeneratedKey {
  plaintext: string // ditampilkan sekali ke consumer
  hash: string // disimpan di DB (unique, ber-index)
  prefix: string // disimpan di DB untuk identifikasi non-sensitif
}

// Hash deterministik: HMAC(key, BETTER_AUTH_SECRET). Deterministik agar lookup
// bisa `WHERE apiKeyHash = ?` (ber-index), bukan iterasi+compare seperti bcrypt.
export function hashApiKey(plaintext: string): string {
  return createHmac('sha256', env.BETTER_AUTH_SECRET).update(plaintext).digest('hex')
}

export function generateApiKey(): GeneratedKey {
  const plaintext = KEY_PREFIX + randomBytes(24).toString('base64url')
  return {
    plaintext,
    hash: hashApiKey(plaintext),
    prefix: plaintext.slice(0, PREFIX_DISPLAY_LEN),
  }
}

// Banding hash input vs hash tersimpan dengan timingSafeEqual (anti timing attack).
// Panjang hash hex selalu sama (64 char), tapi guard panjang tetap dijaga.
export function apiKeyMatches(plaintext: string, storedHash: string): boolean {
  const candidate = Buffer.from(hashApiKey(plaintext), 'utf8')
  const stored = Buffer.from(storedHash, 'utf8')
  if (candidate.length !== stored.length) return false
  return timingSafeEqual(candidate, stored)
}

// Secret untuk menandatangani webhook ke consumer (HMAC payload). Bukan API key —
// ini rahasia per-consumer yang dipakai consumer memverifikasi keaslian webhook.
export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString('base64url')}`
}
