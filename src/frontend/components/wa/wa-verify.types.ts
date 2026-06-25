// Tipe respons endpoint WAV (verifikasi nomor inbound) yang dibagi antar komponen panel.

// Ukuran halaman pagination server-side untuk ketiga panel WAV.
export const PAGE_SIZE = 20

export type VerifyStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED'
export type VerifyDelivery = 'PENDING' | 'DELIVERED' | 'FAILED' | 'DISABLED'

export interface VerifyConsumer {
  id: string
  name: string
  apiKeyPrefix: string
  webhookUrl: string | null
  active: boolean
  createdAt: string
  _count: { requests: number }
}

export interface ConsumersResponse {
  consumers: VerifyConsumer[]
  total: number
  canEdit: boolean
}

// Hanya muncul sekali saat create / regenerate — plaintext key tak pernah disimpan.
// webhookSecret disimpan plaintext → bisa di-reveal ulang lewat RevealedSecret.
export interface CreatedConsumer {
  consumer: { id: string; name: string; apiKeyPrefix: string; webhookSecret: string }
  apiKey: string
}

// Respons GET .../:id/reveal-secret — webhookSecret bisa diambil ulang kapan saja (SUPER_ADMIN).
export interface RevealedSecret {
  webhookSecret: string
}

export interface VerifyRequestRow {
  id: string
  consumerId: string
  status: VerifyStatus
  matchedPhone: string | null
  expiresAt: string
  verifiedAt: string | null
  deliveryStatus: VerifyDelivery
  deliveryAttempts: number
  createdAt: string
  consumer: { name: string }
}

export interface RequestsResponse {
  requests: VerifyRequestRow[]
  total: number
}

export interface InboundLogRow {
  id: string
  sessionId: string
  fromMasked: string
  tokenFound: string | null
  matched: boolean
  consumerId: string | null
  createdAt: string
}

export interface InboundResponse {
  inbound: InboundLogRow[]
  total: number
}
