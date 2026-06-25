import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { prisma } from '../../src/lib/db'
import {
  buildVerifyInstruction,
  buildVerifyMessage,
  extractToken,
  generateToken,
  handleInbound,
  maskPhone,
  normalizePhone,
  TOKEN_TTL_MS,
} from '../../src/lib/wa-verify'

describe('wa-verify: generateToken', () => {
  test('matches WAV- + 8 unambiguous base32 chars', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateToken()).toMatch(/^WAV-[A-HJ-NP-Z2-7]{8}$/)
    }
  })
})

describe('wa-verify: extractToken', () => {
  test('finds a token embedded in a sentence', () => {
    expect(extractToken('halo ini WAV-ABCD2345 kode saya')).toBe('WAV-ABCD2345')
  })

  test('returns the first token when multiple present', () => {
    expect(extractToken('WAV-AAAA2222 dan WAV-BBBB3333')).toBe('WAV-AAAA2222')
  })

  test('returns null when no token present', () => {
    expect(extractToken('tidak ada kode di sini')).toBeNull()
  })

  test('returns null for empty / nullish body', () => {
    expect(extractToken('')).toBeNull()
    expect(extractToken(null)).toBeNull()
    expect(extractToken(undefined)).toBeNull()
  })

  test('does not match a malformed token (wrong length)', () => {
    expect(extractToken('WAV-ABC')).toBeNull()
  })

  test('matches a lowercased token (phone autocorrect) and normalizes to uppercase', () => {
    expect(extractToken('verifikasi nomor saya: wav-abcd2345')).toBe('WAV-ABCD2345')
  })

  test('matches a mixed-case token embedded in a sentence', () => {
    expect(extractToken('Verifikasi nomor saya: Wav-AbCd2345')).toBe('WAV-ABCD2345')
  })
})

describe('wa-verify: buildVerifyMessage / buildVerifyInstruction', () => {
  test('message wraps the token in a natural sentence with token at the end', () => {
    const msg = buildVerifyMessage('WAV-ABCD2345')
    expect(msg).toBe('Verifikasi nomor saya: WAV-ABCD2345')
    // Token tetap terdeteksi matcher walau dikelilingi kata penjelasan.
    expect(extractToken(msg)).toBe('WAV-ABCD2345')
  })

  test('instruction includes the exact message and the server number when provided', () => {
    const instr = buildVerifyInstruction('WAV-ABCD2345', '628123456789')
    expect(instr).toContain('628123456789')
    expect(instr).toContain('Verifikasi nomor saya: WAV-ABCD2345')
  })

  test('instruction omits the target phrase when no server number', () => {
    const instr = buildVerifyInstruction('WAV-ABCD2345', null)
    expect(instr).not.toContain(' ke ')
    expect(instr).toContain('Verifikasi nomor saya: WAV-ABCD2345')
  })
})

describe('wa-verify: normalizePhone', () => {
  test('strips the @c.us suffix and non-digits', () => {
    expect(normalizePhone('6281234566789@c.us')).toBe('6281234566789')
  })

  test('returns empty string for nullish input', () => {
    expect(normalizePhone(null)).toBe('')
    expect(normalizePhone(undefined)).toBe('')
  })
})

describe('wa-verify: maskPhone', () => {
  test('keeps 3 leading + 4 trailing digits, masks the middle', () => {
    expect(maskPhone('6281234566789')).toBe('628******6789')
  })

  test('fully masks short numbers (<= 7 digits)', () => {
    expect(maskPhone('1234567')).toBe('*******')
  })
})

// handleInbound menyentuh DB → seed consumer + request nyata, lalu bersihkan.
const SUFFIX = '-waverify-unit'
let consumerId: string

beforeAll(async () => {
  const c = await prisma.verifyConsumer.create({
    data: {
      name: `unit${SUFFIX}`,
      apiKeyHash: `hash${SUFFIX}`,
      apiKeyPrefix: 'wav_sk_unit',
      webhookSecret: `whsec${SUFFIX}`,
      active: true,
    },
    select: { id: true },
  })
  consumerId = c.id
})

afterAll(async () => {
  await prisma.verifyInboundLog.deleteMany({ where: { consumerId } })
  await prisma.verifyRequest.deleteMany({ where: { consumerId } })
  await prisma.verifyConsumer.delete({ where: { id: consumerId } }).catch(() => {})
})

function inbound(body: string, from = '628111222333@c.us') {
  return { from, body, fromMe: false, id: `msg-${Math.random()}` }
}

describe('wa-verify: handleInbound', () => {
  test('matches a PENDING request and flips it to VERIFIED (idempotent on replay)', async () => {
    const token = generateToken()
    const req = await prisma.verifyRequest.create({
      data: { consumerId, token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
      select: { id: true },
    })

    const first = await handleInbound('session-1', inbound(`kode ${token}`))
    expect(first.matched).toBe(true)
    expect(first.requestId).toBe(req.id)

    const after = await prisma.verifyRequest.findUnique({ where: { id: req.id } })
    expect(after?.status).toBe('VERIFIED')
    expect(after?.matchedPhone).toBe('628111222333')

    // Replay pesan yang sama → no-op (sudah bukan PENDING).
    const second = await handleInbound('session-1', inbound(`kode ${token}`))
    expect(second.matched).toBe(false)
  })

  test('matches a lowercased inbound token against the stored uppercase token', async () => {
    const token = generateToken()
    const req = await prisma.verifyRequest.create({
      data: { consumerId, token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
      select: { id: true },
    })
    // Simulasikan autocorrect HP yang menurunkan huruf token jadi kecil.
    const res = await handleInbound('session-1', inbound(`Verifikasi nomor saya: ${token.toLowerCase()}`))
    expect(res.matched).toBe(true)
    expect(res.requestId).toBe(req.id)
    const after = await prisma.verifyRequest.findUnique({ where: { id: req.id } })
    expect(after?.status).toBe('VERIFIED')
  })

  test('does not match an expired request', async () => {
    const token = generateToken()
    await prisma.verifyRequest.create({
      data: { consumerId, token, expiresAt: new Date(Date.now() - 1000) },
    })
    const res = await handleInbound('session-1', inbound(`kode ${token}`))
    expect(res.matched).toBe(false)
  })

  test('accepts a @lid sender (inbound id variant) and verifies', async () => {
    const token = generateToken()
    const req = await prisma.verifyRequest.create({
      data: { consumerId, token, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
      select: { id: true },
    })
    const res = await handleInbound('session-1', inbound(`kode ${token}`, '75218483707904@lid'))
    expect(res.matched).toBe(true)
    expect(res.requestId).toBe(req.id)
    const after = await prisma.verifyRequest.findUnique({ where: { id: req.id } })
    expect(after?.status).toBe('VERIFIED')
    expect(after?.matchedPhone).toBe('75218483707904')
  })

  test('ignores group messages (@g.us)', async () => {
    const res = await handleInbound('session-1', inbound('WAV-AAAA2222', '628000@g.us'))
    expect(res.matched).toBe(false)
  })

  test('ignores own messages (fromMe)', async () => {
    const res = await handleInbound('session-1', { from: '628111@c.us', body: 'WAV-AAAA2222', fromMe: true })
    expect(res.matched).toBe(false)
  })

  test('writes an inbound log row even when no token is found', async () => {
    const before = await prisma.verifyInboundLog.count({ where: { sessionId: 'session-log' } })
    await handleInbound('session-log', inbound('tidak ada token'))
    const after = await prisma.verifyInboundLog.count({ where: { sessionId: 'session-log' } })
    expect(after).toBe(before + 1)
    // Bersihkan baris log yang tak terikat consumerId.
    await prisma.verifyInboundLog.deleteMany({ where: { sessionId: 'session-log' } })
  })
})
