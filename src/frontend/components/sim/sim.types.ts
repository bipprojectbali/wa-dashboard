// Tipe respons proxy simulasi WAV + entri log timeline. Sumber tunggal untuk panel sim.

export interface SimStartResp {
  id: string
  token: string
  sendTo: string | null
  waMeUrl: string | null
  expiresAt: string
  instruction: string
}

export interface SimStatusResp {
  status: 'PENDING' | 'VERIFIED' | 'EXPIRED'
  matchedPhone: string | null
  verifiedAt: string | null
  expiresAt: string
}

export interface SimLogEntry {
  at: number // epoch ms
  label: string
  data?: unknown // raw request/response untuk inspeksi developer
}
