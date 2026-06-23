import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { env } from '../../src/lib/env'
import { redis } from '../../src/lib/redis'
import { invalidatePolicyCache } from '../../src/lib/wa-policy'
import { createTestApp, createTestSession, prisma, seedTestUser } from '../helpers'

const app = createTestApp()
const EMAIL_SUFFIX = '@wapolicy.test'

let adminId: string
let superId: string
let userId: string
let adminCookie: string
let superCookie: string
let userCookie: string

const realFetch = globalThis.fetch

// Default permissive policy fields — individual tests override what they need.
const PERMISSIVE = {
  allowFirstContact: true,
  requireAck: false,
  minIntervalSeconds: 0,
  perRecipientCooldownSeconds: 0,
  maxPerMinute: 1000,
  maxPerHour: 10000,
  maxPerDay: 100000,
} as const

async function setPolicy(fields: Partial<typeof PERMISSIVE> & Record<string, unknown>) {
  await prisma.waPolicy.upsert({
    where: { id: 'global' },
    update: { ...PERMISSIVE, ...fields },
    create: { id: 'global', ...PERMISSIVE, ...fields },
  })
  await invalidatePolicyCache()
}

async function clearRl(uid: string) {
  const keys = await redis.keys(`wa:rl:*${uid}*`).catch(() => [] as string[])
  if (keys.length) await redis.del(...keys).catch(() => {})
  await redis.del(`wa:policy:ack:${uid}`, `wa:known:${uid}`).catch(() => {})
}

function sendReq(cookie: string, body: Record<string, unknown>) {
  return app.handle(
    new Request('http://localhost/api/wa/send', {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  )
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  const adm = await seedTestUser(`adm${EMAIL_SUFFIX}`, 'pass123', 'Admin', 'ADMIN')
  const sup = await seedTestUser(`sup${EMAIL_SUFFIX}`, 'pass123', 'Super', 'SUPER_ADMIN')
  const usr = await seedTestUser(`usr${EMAIL_SUFFIX}`, 'pass123', 'User', 'USER')
  adminId = adm.id
  superId = sup.id
  userId = usr.id
  adminCookie = `better-auth.session_token=${await createTestSession(adminId)}`
  superCookie = `better-auth.session_token=${await createTestSession(superId)}`
  userCookie = `better-auth.session_token=${await createTestSession(userId)}`

  // Stub outbound WA container — getContacts/getChats/sendMessage never hit the network.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (env.WA_API_BASE_URL && url.startsWith(env.WA_API_BASE_URL)) {
      return new Response(JSON.stringify({ success: true, contacts: [], chats: [] }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    return realFetch(input as RequestInfo, init)
  }) as typeof fetch
})

beforeEach(async () => {
  await clearRl(adminId)
})

afterAll(async () => {
  globalThis.fetch = realFetch
  await clearRl(adminId)
  await clearRl(superId)
  await clearRl(userId)
  await redis.del('wa:policy:cache').catch(() => {})
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  await prisma.$disconnect()
})

describe('GET /api/wa/policy', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request('http://localhost/api/wa/policy'))
    expect(res.status).toBe(401)
  })

  test('returns 403 for USER role', async () => {
    const res = await app.handle(new Request('http://localhost/api/wa/policy', { headers: { cookie: userCookie } }))
    expect(res.status).toBe(403)
  })

  test('returns 200 with policy + contract for ADMIN, canEdit=false', async () => {
    await setPolicy({})
    const res = await app.handle(new Request('http://localhost/api/wa/policy', { headers: { cookie: adminCookie } }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.policy).toBeDefined()
    expect(body.usage.minute).toBeDefined()
    expect(Array.isArray(body.contract.sections)).toBe(true)
    expect(body.canEdit).toBe(false)
  })

  test('returns canEdit=true for SUPER_ADMIN', async () => {
    const res = await app.handle(new Request('http://localhost/api/wa/policy', { headers: { cookie: superCookie } }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.canEdit).toBe(true)
  })
})

describe('PUT /api/wa/policy', () => {
  const validBody = {
    allowFirstContact: false,
    maxPerMinute: 5,
    maxPerHour: 30,
    maxPerDay: 150,
    minIntervalSeconds: 10,
    perRecipientCooldownSeconds: 90,
    requireAck: true,
  }

  test('returns 403 for ADMIN (not SUPER_ADMIN)', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/policy', {
        method: 'PUT',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      }),
    )
    expect(res.status).toBe(403)
  })

  test('returns 200 for SUPER_ADMIN and persists', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/policy', {
        method: 'PUT',
        headers: { cookie: superCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, maxPerMinute: 7 }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.policy.maxPerMinute).toBe(7)
    const row = await prisma.waPolicy.findUnique({ where: { id: 'global' } })
    expect(row?.maxPerMinute).toBe(7)
  })

  test('rejects out-of-range values (422)', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/policy', {
        method: 'PUT',
        headers: { cookie: superCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...validBody, maxPerMinute: 0 }),
      }),
    )
    expect([400, 422]).toContain(res.status)
  })
})

describe('POST /api/wa/policy/ack', () => {
  test('returns 403 for USER role', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/policy/ack', { method: 'POST', headers: { cookie: userCookie } }),
    )
    expect(res.status).toBe(403)
  })

  test('records ack for ADMIN', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/policy/ack', { method: 'POST', headers: { cookie: adminCookie } }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ack.version).toBeGreaterThanOrEqual(1)
  })
})

describe('DELETE /api/wa/policy/ack', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request('http://localhost/api/wa/policy/ack', { method: 'DELETE' }))
    expect(res.status).toBe(401)
  })

  test('returns 403 for USER role', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/policy/ack', { method: 'DELETE', headers: { cookie: userCookie } }),
    )
    expect(res.status).toBe(403)
  })

  test('revokes ack for ADMIN — ack becomes null and send is gated again', async () => {
    await setPolicy({ allowFirstContact: true, requireAck: true })
    // Ack first, then revoke.
    await app.handle(
      new Request('http://localhost/api/wa/policy/ack', { method: 'POST', headers: { cookie: adminCookie } }),
    )
    const del = await app.handle(
      new Request('http://localhost/api/wa/policy/ack', { method: 'DELETE', headers: { cookie: adminCookie } }),
    )
    expect(del.status).toBe(200)
    expect((await del.json()).ack).toBeNull()

    const policy = await app.handle(
      new Request('http://localhost/api/wa/policy', { headers: { cookie: adminCookie } }),
    )
    expect((await policy.json()).ack).toBeNull()

    const send = await sendReq(adminCookie, { chatId: '628777@c.us', content: 'hi' })
    expect(send.status).toBe(403)
    expect((await send.json()).error).toContain('menyetujui kontrak')
  })
})

describe('POST /api/wa/send — enforcement', () => {
  test('403 first-contact when recipient unknown and allowFirstContact=false', async () => {
    await setPolicy({ allowFirstContact: false, requireAck: false })
    const res = await sendReq(adminCookie, { chatId: '628999@c.us', content: 'hi' })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('Kirim duluan diblokir')
  })

  test('200 when recipient is a known contact', async () => {
    await setPolicy({ allowFirstContact: false, requireAck: false })
    // Pre-seed the known-recipient cache so the gate recognizes this chatId.
    await redis.set(`wa:known:${adminId}`, JSON.stringify(['628777@c.us']), 'EX', 300).catch(() => {})
    const res = await sendReq(adminCookie, { chatId: '628777@c.us', content: 'hi' })
    expect(res.status).toBe(200)
  })

  test('403 when requireAck=true and not acknowledged', async () => {
    await setPolicy({ allowFirstContact: true, requireAck: true })
    const res = await sendReq(adminCookie, { chatId: '628777@c.us', content: 'hi' })
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toContain('menyetujui kontrak')
  })

  test('200 after acknowledging when requireAck=true', async () => {
    await setPolicy({ allowFirstContact: true, requireAck: true })
    await app.handle(
      new Request('http://localhost/api/wa/policy/ack', { method: 'POST', headers: { cookie: adminCookie } }),
    )
    const res = await sendReq(adminCookie, { chatId: '628777@c.us', content: 'hi' })
    expect(res.status).toBe(200)
  })

  test('429 when per-minute cap is exceeded', async () => {
    await setPolicy({ allowFirstContact: true, requireAck: false, maxPerMinute: 1 })
    const first = await sendReq(adminCookie, { chatId: '628777@c.us', content: 'one' })
    expect(first.status).toBe(200)
    const second = await sendReq(adminCookie, { chatId: '628777@c.us', content: 'two' })
    expect(second.status).toBe(429)
    const body = await second.json()
    expect(body.retryAfter).toBeGreaterThan(0)
  })

  test('429 per-recipient cooldown blocks repeat to same number', async () => {
    await setPolicy({ allowFirstContact: true, requireAck: false, perRecipientCooldownSeconds: 120 })
    const first = await sendReq(adminCookie, { chatId: '628555@c.us', content: 'one' })
    expect(first.status).toBe(200)
    const second = await sendReq(adminCookie, { chatId: '628555@c.us', content: 'two' })
    expect(second.status).toBe(429)
  })
})
