import { describe, expect, test } from 'bun:test'
import type { ChatRow, InboundLogRow, UnifiedMessage } from '../../src/frontend/components/wa/wa-messages.types'
import { filterMessages, mergeMessages } from '../../src/frontend/lib/wa-messages'

describe('mergeMessages', () => {
  test('merges chat + inbound and sorts newest first', () => {
    const chats: ChatRow[] = [
      { id: '628111@c.us', name: 'Alice', lastMessage: { body: 'halo', t: 1000 } },
      { id: '628222@c.us', name: 'Bob', lastMessage: { body: 'hai', t: 3000 } },
    ]
    const inbound: InboundLogRow[] = [
      {
        id: 'log1',
        sessionId: 's1',
        fromMasked: '628***333',
        tokenFound: 'WAV-ABCD1234',
        matched: true,
        consumerId: 'c1',
        createdAt: new Date(2000 * 1000).toISOString(),
      },
    ]
    const rows = mergeMessages(chats, inbound)
    expect(rows.map((r) => r.id)).toEqual(['chat:628222@c.us', 'wav:log1', 'chat:628111@c.us'])
    expect(rows[0].time).toBe(3000 * 1000)
    expect(rows[1].source).toBe('wav')
    expect(rows[1].text).toBe('Token: WAV-ABCD1234')
  })

  test('skips chats without a usable lastMessage', () => {
    const chats: ChatRow[] = [
      { id: '628111@c.us', name: 'NoMsg' },
      { id: '628222@c.us', name: 'EmptyT', lastMessage: { body: 'x' } },
      { id: '628333@c.us', name: 'Ok', lastMessage: { body: 'ok', t: 5 } },
    ]
    const rows = mergeMessages(chats, [])
    expect(rows).toHaveLength(1)
    expect(rows[0].chatId).toBe('628333@c.us')
  })

  test('derives chatId from object id shape', () => {
    const chats: ChatRow[] = [{ id: { _serialized: '628444@c.us' }, lastMessage: { body: 'y', t: 7 } }]
    const rows = mergeMessages(chats, [])
    expect(rows[0].chatId).toBe('628444@c.us')
  })

  test('reads container field `timestamp` (not just `t`)', () => {
    // Container menamai field `timestamp` (epoch detik); `t` absen di objek nyata.
    const chats: ChatRow[] = [
      { id: '628555@c.us', name: 'Real', lastMessage: { body: 'hi', timestamp: 1781680964 } },
    ]
    const rows = mergeMessages(chats, [])
    expect(rows).toHaveLength(1)
    expect(rows[0].time).toBe(1781680964 * 1000)
  })

  test('inbound without token shows fallback text', () => {
    const inbound: InboundLogRow[] = [
      {
        id: 'log2',
        sessionId: 's1',
        fromMasked: '628***999',
        tokenFound: null,
        matched: false,
        consumerId: null,
        createdAt: new Date().toISOString(),
      },
    ]
    const rows = mergeMessages([], inbound)
    expect(rows[0].text).toBe('(inbound)')
  })
})

describe('filterMessages', () => {
  const rows: UnifiedMessage[] = [
    { id: 'a', time: new Date('2026-06-10T08:00:00').getTime(), source: 'chat', from: 'Alice', text: 'meeting now' },
    { id: 'b', time: new Date('2026-06-15T08:00:00').getTime(), source: 'chat', from: 'Bob', text: 'lunch later' },
    { id: 'c', time: new Date('2026-06-20T08:00:00').getTime(), source: 'wav', from: '628***1', text: 'Token: X' },
  ]

  test('search matches from or text, case-insensitive', () => {
    expect(filterMessages(rows, { search: 'ALICE' }).map((r) => r.id)).toEqual(['a'])
    expect(filterMessages(rows, { search: 'lunch' }).map((r) => r.id)).toEqual(['b'])
  })

  test('search miss returns empty', () => {
    expect(filterMessages(rows, { search: 'nonexistent' })).toHaveLength(0)
  })

  test('date range is inclusive on both ends', () => {
    const out = filterMessages(rows, { dateFrom: '2026-06-15', dateTo: '2026-06-20' })
    expect(out.map((r) => r.id)).toEqual(['b', 'c'])
  })

  test('out-of-range rows are dropped', () => {
    expect(filterMessages(rows, { dateFrom: '2026-06-11', dateTo: '2026-06-14' })).toHaveLength(0)
  })

  test('empty filter returns all rows', () => {
    expect(filterMessages(rows, {})).toHaveLength(3)
  })
})
