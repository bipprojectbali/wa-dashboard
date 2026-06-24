import { describe, expect, test } from 'bun:test'
import { apiKeyMatches, generateApiKey, generateWebhookSecret, hashApiKey } from '../../src/lib/wa-verify-keys'

describe('wa-verify-keys: generateApiKey', () => {
  test('plaintext carries the wav_sk_ prefix and a base64url body', () => {
    const key = generateApiKey()
    expect(key.plaintext.startsWith('wav_sk_')).toBe(true)
    expect(key.plaintext.length).toBeGreaterThan(20)
  })

  test('prefix is the first 12 chars of plaintext (non-sensitive UI id)', () => {
    const key = generateApiKey()
    expect(key.prefix).toBe(key.plaintext.slice(0, 12))
  })

  test('hash matches hashApiKey(plaintext) — deterministic indexed lookup', () => {
    const key = generateApiKey()
    expect(key.hash).toBe(hashApiKey(key.plaintext))
    expect(key.hash).toHaveLength(64) // sha256 hex
  })

  test('two generated keys differ in plaintext and hash', () => {
    const a = generateApiKey()
    const b = generateApiKey()
    expect(a.plaintext).not.toBe(b.plaintext)
    expect(a.hash).not.toBe(b.hash)
  })
})

describe('wa-verify-keys: hashApiKey', () => {
  test('is deterministic for the same input', () => {
    expect(hashApiKey('wav_sk_sample')).toBe(hashApiKey('wav_sk_sample'))
  })

  test('differs for different inputs', () => {
    expect(hashApiKey('wav_sk_a')).not.toBe(hashApiKey('wav_sk_b'))
  })
})

describe('wa-verify-keys: apiKeyMatches', () => {
  test('returns true for the correct key against its stored hash', () => {
    const key = generateApiKey()
    expect(apiKeyMatches(key.plaintext, key.hash)).toBe(true)
  })

  test('returns false for a wrong key', () => {
    const key = generateApiKey()
    const other = generateApiKey()
    expect(apiKeyMatches(other.plaintext, key.hash)).toBe(false)
  })

  test('returns false when stored hash length differs (no throw)', () => {
    const key = generateApiKey()
    expect(apiKeyMatches(key.plaintext, 'short')).toBe(false)
  })
})

describe('wa-verify-keys: generateWebhookSecret', () => {
  test('carries the whsec_ prefix and is unique', () => {
    const a = generateWebhookSecret()
    const b = generateWebhookSecret()
    expect(a.startsWith('whsec_')).toBe(true)
    expect(a).not.toBe(b)
  })
})
