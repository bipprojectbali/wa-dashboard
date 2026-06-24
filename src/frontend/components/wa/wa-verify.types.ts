// Tipe respons endpoint WAV (verifikasi nomor inbound) yang dibagi antar komponen panel.

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
  canEdit: boolean
}

// Hanya muncul sekali saat create / regenerate — plaintext key tak pernah disimpan.
export interface CreatedConsumer {
  consumer: { id: string; name: string; apiKeyPrefix: string; webhookSecret: string }
  apiKey: string
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
}
