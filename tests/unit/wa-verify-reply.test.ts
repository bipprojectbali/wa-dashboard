import { describe, expect, test } from 'bun:test'
import { buildReplyMessage, DEFAULT_VERIFY_REPLY_MESSAGE } from '../../src/lib/wa-verify-reply'

describe('wa-verify-reply: buildReplyMessage', () => {
  test('menghormati teks custom verbatim (di-trim)', () => {
    expect(buildReplyMessage('  Halo, terverifikasi ya  ', 'req-1')).toBe('Halo, terverifikasi ya')
  })

  test('custom kosong / null / whitespace → pakai varian default', () => {
    for (const custom of [null, undefined, '', '   ']) {
      const msg = buildReplyMessage(custom, 'req-abc')
      expect(msg.length).toBeGreaterThan(0)
      // Salah satu varian default (semua memuat kata "verifikasi"/"terverifikasi").
      expect(msg.toLowerCase()).toContain('verifikasi')
    }
  })

  test('deterministik untuk seed sama', () => {
    const a = buildReplyMessage(null, 'same-seed')
    const b = buildReplyMessage(null, 'same-seed')
    expect(a).toBe(b)
  })

  test('seed berbeda bisa memilih varian berbeda (distribusi > 1)', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) seen.add(buildReplyMessage(null, `seed-${i}`))
    expect(seen.size).toBeGreaterThan(1)
  })

  test('tidak pernah menyisipkan nomor/token (zero PII)', () => {
    // Seed menyerupai requestId; pesan default tak boleh mengandung digit panjang atau token.
    const msg = buildReplyMessage(null, '628123456789-WAV-ABCD2345')
    expect(msg).not.toMatch(/\d{6,}/)
    expect(msg).not.toMatch(/WAV-/)
  })

  test('DEFAULT_VERIFY_REPLY_MESSAGE adalah salah satu varian yang mungkin', () => {
    const outputs = new Set<string>()
    for (let i = 0; i < 100; i++) outputs.add(buildReplyMessage(null, `s-${i}`))
    expect(outputs.has(DEFAULT_VERIFY_REPLY_MESSAGE)).toBe(true)
  })
})
