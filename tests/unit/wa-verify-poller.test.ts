import { describe, expect, test } from 'bun:test'
import { filterNewInbound } from '../../src/lib/wa-verify-poller'

// filterNewInbound murni (tanpa container/Redis): hanya logika watermark + filter.
// t pada lastMessage = epoch DETIK; watermark = epoch MILIDETIK.

const WM = 1_700_000_000_000 // watermark dalam ms
const wmSec = WM / 1000

describe('wa-verify-poller: filterNewInbound', () => {
  test('includes inbound newer than watermark (fromMe:false, t*1000 > watermark)', () => {
    const chats = [{ lastMessage: { from: '628@c.us', body: 'WAV-AAAA2222', fromMe: false, t: wmSec + 5 } }]
    const { messages, maxTMs } = filterNewInbound(chats, WM)
    expect(messages).toHaveLength(1)
    expect(messages[0]?.body).toBe('WAV-AAAA2222')
    expect(maxTMs).toBe((wmSec + 5) * 1000)
  })

  test('drops own messages (fromMe:true) even when newer', () => {
    const chats = [{ lastMessage: { from: '628@c.us', body: 'hi', fromMe: true, t: wmSec + 5 } }]
    const { messages, maxTMs } = filterNewInbound(chats, WM)
    expect(messages).toHaveLength(0)
    // maxTMs tetap maju ke t terbaru agar tak diproses ulang.
    expect(maxTMs).toBe((wmSec + 5) * 1000)
  })

  test('drops messages at or before the watermark', () => {
    const chats = [
      { lastMessage: { from: '628@c.us', body: 'old', fromMe: false, t: wmSec - 1 } },
      { lastMessage: { from: '629@c.us', body: 'equal', fromMe: false, t: wmSec } },
    ]
    const { messages } = filterNewInbound(chats, WM)
    expect(messages).toHaveLength(0)
  })

  test('skips chats without a usable lastMessage', () => {
    const chats = [
      {},
      { lastMessage: undefined },
      { lastMessage: { from: '628@c.us', body: 'no-t', fromMe: false } },
    ]
    const { messages, maxTMs } = filterNewInbound(chats, WM)
    expect(messages).toHaveLength(0)
    expect(maxTMs).toBe(WM)
  })

  test('maxTMs is the largest t seen (across passing and non-passing)', () => {
    const chats = [
      { lastMessage: { from: '628@c.us', body: 'a', fromMe: false, t: wmSec + 2 } },
      { lastMessage: { from: '629@c.us', body: 'b', fromMe: true, t: wmSec + 9 } },
    ]
    const { messages, maxTMs } = filterNewInbound(chats, WM)
    expect(messages).toHaveLength(1)
    expect(maxTMs).toBe((wmSec + 9) * 1000)
  })

  test('reads container field `timestamp` (not just `t`)', () => {
    // Container menamai field `timestamp` (epoch detik); `t` absen di objek nyata.
    const chats = [{ lastMessage: { from: '628@c.us', body: 'WAV-BBBB3333', fromMe: false, timestamp: wmSec + 5 } }]
    const { messages, maxTMs } = filterNewInbound(chats, WM)
    expect(messages).toHaveLength(1)
    expect(messages[0]?.body).toBe('WAV-BBBB3333')
    expect(maxTMs).toBe((wmSec + 5) * 1000)
  })
})
