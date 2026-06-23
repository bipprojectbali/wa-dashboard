import { describe, expect, it } from 'bun:test'
import { extractPairingCode, pairingCodeOrThrow, pairingErrorMessage } from '@/frontend/lib/wa-pairing'

describe('extractPairingCode', () => {
  it('reads { code }', () => {
    expect(extractPairingCode({ code: 'ABCD-1234' })).toBe('ABCD-1234')
  })

  it('reads { result: string }', () => {
    expect(extractPairingCode({ result: 'WXYZ-9999' })).toBe('WXYZ-9999')
  })

  it('reads { result: { code } }', () => {
    expect(extractPairingCode({ result: { code: 'QRST-5678' } })).toBe('QRST-5678')
  })

  it('returns null when no code present', () => {
    expect(extractPairingCode({ success: false, message: 'session_not_found' })).toBeNull()
    expect(extractPairingCode(undefined)).toBeNull()
  })
})

describe('pairingErrorMessage', () => {
  it('gives actionable hint for session_not_found', () => {
    expect(pairingErrorMessage({ success: false, message: 'session_not_found' })).toContain('Start')
  })

  it('passes through an unknown raw message', () => {
    expect(pairingErrorMessage({ success: false, message: 'boom' })).toBe('boom')
  })

  it('falls back when no message at all', () => {
    expect(pairingErrorMessage({})).toContain('Start')
  })
})

describe('pairingCodeOrThrow', () => {
  it('returns the code on success', () => {
    expect(pairingCodeOrThrow({ success: true, code: 'ABCD-1234' })).toBe('ABCD-1234')
  })

  it('throws on the HTTP-200 success:false marker (the silent-failure bug)', () => {
    expect(() => pairingCodeOrThrow({ success: false, message: 'session_not_found' })).toThrow('Start')
  })

  it('throws when success is true but no code is present', () => {
    expect(() => pairingCodeOrThrow({ success: true })).toThrow()
  })
})
