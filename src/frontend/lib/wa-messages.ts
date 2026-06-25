// Helper murni (tanpa React/Mantine) untuk tab "Pesan" — bisa di-unit-test
// tanpa komponen. Menggabungkan dua sumber (chat terakhir + inbound WAV) ke
// satu daftar terurut, lalu memfilter di sisi klien (search + rentang tanggal).

import type { ChatRow, InboundLogRow, UnifiedMessage } from '@/frontend/components/wa/wa-messages.types'

function chatIdOf(chat: ChatRow): string {
  if (typeof chat.id === 'string') return chat.id
  return chat.id?._serialized ?? (chat.id?.user ? `${chat.id.user}@c.us` : '')
}

// Normalisasi kedua sumber ke UnifiedMessage, urut terbaru→terlama.
// Chat tanpa lastMessage di-skip (tak ada yang bisa ditampilkan).
// Timestamp container = `lastMessage.timestamp` epoch DETIK (`t` hanya di payload
// mentah `_data`) → ms; inbound createdAt ISO.
export function mergeMessages(chats: ChatRow[], inbound: InboundLogRow[]): UnifiedMessage[] {
  const rows: UnifiedMessage[] = []

  for (const chat of chats) {
    const lm = chat.lastMessage
    const ts = lm?.timestamp ?? lm?.t
    if (!lm || typeof ts !== 'number') continue
    const chatId = chatIdOf(chat)
    rows.push({
      id: `chat:${chatId}`,
      time: ts * 1000,
      source: 'chat',
      from: chat.name ?? lm.from ?? chatId,
      text: lm.body ?? '',
      chatId: chatId || undefined,
    })
  }

  for (const log of inbound) {
    rows.push({
      id: `wav:${log.id}`,
      time: new Date(log.createdAt).getTime(),
      source: 'wav',
      from: log.fromMasked,
      text: log.tokenFound ? `Token: ${log.tokenFound}` : '(inbound)',
    })
  }

  return rows.sort((a, b) => b.time - a.time)
}

export interface MessageFilter {
  search?: string
  dateFrom?: string // 'YYYY-MM-DD' (inklusif, awal hari lokal)
  dateTo?: string // 'YYYY-MM-DD' (inklusif, akhir hari lokal)
}

// Filter klien-side: search case-insensitive (from + text), rentang tanggal
// inklusif. dateFrom/dateTo kosong → tak membatasi sisi itu.
export function filterMessages(rows: UnifiedMessage[], filter: MessageFilter): UnifiedMessage[] {
  const q = filter.search?.trim().toLowerCase() ?? ''
  const fromMs = filter.dateFrom ? new Date(`${filter.dateFrom}T00:00:00`).getTime() : null
  const toMs = filter.dateTo ? new Date(`${filter.dateTo}T23:59:59.999`).getTime() : null

  return rows.filter((r) => {
    if (q && !r.from.toLowerCase().includes(q) && !r.text.toLowerCase().includes(q)) return false
    if (fromMs !== null && r.time < fromMs) return false
    if (toMs !== null && r.time > toMs) return false
    return true
  })
}
