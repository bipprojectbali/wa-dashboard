// Tipe respons & bentuk terpadu untuk tab "Pesan" (/wa?tab=messages).
// Sumber tunggal yang dibagi antar komponen WaMessages*.

import type { InboundLogRow } from './wa-verify.types'

// Satu chat dari container getChats. Container kadang membungkus dalam
// { chats: [...] }, kadang array langsung — keduanya ditangani mergeMessages.
export interface ChatRow {
  id?: string | { _serialized?: string; user?: string }
  name?: string
  // Container menamai timestamp `timestamp` (epoch detik) di objek Message
  // ter-normalisasi; `t` hanya ada di payload mentah `_data` → fallback saja.
  lastMessage?: { from?: string; body?: string; fromMe?: boolean; timestamp?: number; t?: number }
}

export interface ChatsResponse {
  success?: boolean
  chats?: ChatRow[]
}

// Satu pesan dalam riwayat chat (drill-down /api/wa/messages).
export interface ChatMessage {
  id?: string | { _serialized?: string }
  from?: string
  body?: string
  fromMe?: boolean
  timestamp?: number
}

export interface ChatMessagesResponse {
  success: boolean
  messages?: ChatMessage[]
  result?: ChatMessage[]
}

export interface SupervisorState {
  running: boolean
  serverNumber: string | null
  sessionId: string | null
  watermark: number | null
  lastPollAt: number | null
  lastError: string | null
  pollIntervalMs: number
}

// Baris terpadu untuk tabel "Pesan": chat terakhir + inbound WAV dinormalisasi
// ke bentuk yang sama. `chatId` hanya ada untuk source 'chat' (mengaktifkan
// drill-down riwayat); baris 'wav' read-only.
export interface UnifiedMessage {
  id: string
  time: number
  source: 'chat' | 'wav'
  from: string
  text: string
  chatId?: string
}

export type { InboundLogRow }
