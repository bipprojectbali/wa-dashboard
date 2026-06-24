import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { env } from '../../src/lib/env'
import { redis } from '../../src/lib/redis'
import { invalidatePolicyCache } from '../../src/lib/wa-policy'
import { createTestApp, createTestSession, prisma, seedTestUser } from '../helpers'

const app = createTestApp()
const EMAIL_SUFFIX = '@wa.test'

let adminId: string
let userId: string
let adminCookie: string
let userCookie: string

// Intercept outbound calls to the WA container — never touch the real API.
// Captures requested URLs so we can assert the sessionId == user.id (isolation).
const realFetch = globalThis.fetch
let waCalls: string[] = []

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  const adm = await seedTestUser(`adm${EMAIL_SUFFIX}`, 'pass123', 'Admin', 'ADMIN')
  const usr = await seedTestUser(`usr${EMAIL_SUFFIX}`, 'pass123', 'User', 'USER')
  adminId = adm.id
  userId = usr.id
  adminCookie = `better-auth.session_token=${await createTestSession(adminId)}`
  userCookie = `better-auth.session_token=${await createTestSession(userId)}`

  // Permissive policy so the send happy-path here isn't blocked by the anti-ban gate.
  // Anti-ban enforcement itself is covered in wa-policy.test.ts.
  await prisma.waPolicy.upsert({
    where: { id: 'global' },
    update: {
      allowFirstContact: true,
      requireAck: false,
      minIntervalSeconds: 0,
      perRecipientCooldownSeconds: 0,
      maxPerMinute: 1000,
      maxPerHour: 10000,
      maxPerDay: 100000,
    },
    create: {
      id: 'global',
      allowFirstContact: true,
      requireAck: false,
      minIntervalSeconds: 0,
      perRecipientCooldownSeconds: 0,
      maxPerMinute: 1000,
      maxPerHour: 10000,
      maxPerDay: 100000,
    },
  })
  await invalidatePolicyCache()
  await redis.del(`wa:rl:min:${adminId}`, `wa:rl:hour:${adminId}`, `wa:rl:day:${adminId}`).catch(() => {})

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (env.WA_API_BASE_URL && url.startsWith(env.WA_API_BASE_URL)) {
      waCalls.push(url)
      if (url.includes('/qr/') && url.endsWith('/image')) {
        return new Response(new Uint8Array([137, 80, 78, 71]), { headers: { 'content-type': 'image/png' } })
      }
      if (url.includes('/client/getProfilePicUrl/')) {
        // Simulasikan container error untuk nomor tertentu (nomor tanpa foto /
        // identifier @lid) — wwebjs-api membalas non-2xx, bukan { result: null }.
        if (init?.body && typeof init.body === 'string' && init.body.includes('@lid')) {
          return new Response(JSON.stringify({ success: false, error: 'profile pic not found' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          })
        }
        return new Response(JSON.stringify({ success: true, result: 'https://pps.whatsapp.net/x.jpg' }), {
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('/session/requestPairingCode/')) {
        return new Response(JSON.stringify({ success: true, result: '12345678' }), {
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true, state: 'CONNECTED' }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    return realFetch(input as RequestInfo, init)
  }) as typeof fetch
})

afterAll(async () => {
  globalThis.fetch = realFetch
  await redis
    .del(
      `wa:rl:min:${adminId}`,
      `wa:rl:hour:${adminId}`,
      `wa:rl:day:${adminId}`,
      `wa:rl:last:${adminId}`,
      `wa:known:${adminId}`,
      `wa:avatar:${adminId}:628999@c.us`,
      `wa:avatar:${adminId}:100399860170781@lid`,
      'wa:policy:cache',
    )
    .catch(() => {})
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  await prisma.$disconnect()
})

describe('GET /api/wa/session/status', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request('http://localhost/api/wa/session/status'))
    expect(res.status).toBe(401)
  })

  test('returns 403 for USER role', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/session/status', { headers: { cookie: userCookie } }),
    )
    expect(res.status).toBe(403)
  })

  test('returns 200 for ADMIN and uses sessionId == user.id', async () => {
    waCalls = []
    const res = await app.handle(
      new Request('http://localhost/api/wa/session/status', { headers: { cookie: adminCookie } }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(waCalls.some((u) => u.endsWith(`/session/status/${adminId}`))).toBe(true)
  })
})

describe('isolation — user cannot target another sessionId', () => {
  test('status request derives sessionId from cookie, not input', async () => {
    waCalls = []
    await app.handle(
      new Request(`http://localhost/api/wa/session/status?sessionId=${userId}`, {
        headers: { cookie: adminCookie },
      }),
    )
    // Even with a spoofed query param, the container is hit with the admin's own id.
    expect(waCalls.every((u) => u.includes(`/${adminId}`))).toBe(true)
    expect(waCalls.some((u) => u.includes(`/${userId}`))).toBe(false)
  })
})

describe('POST /api/wa/send', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: '628@c.us', content: 'hi' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  test('returns 403 for USER role', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/send', {
        method: 'POST',
        headers: { cookie: userCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: '628@c.us', content: 'hi' }),
      }),
    )
    expect(res.status).toBe(403)
  })

  test('validates missing fields (chatId empty)', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/send', {
        method: 'POST',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: 'hi' }),
      }),
    )
    expect([400, 422]).toContain(res.status)
  })

  test('sends with valid body for ADMIN', async () => {
    waCalls = []
    const res = await app.handle(
      new Request('http://localhost/api/wa/send', {
        method: 'POST',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: '628123@c.us', content: 'hello' }),
      }),
    )
    expect(res.status).toBe(200)
    expect(waCalls.some((u) => u.endsWith(`/client/sendMessage/${adminId}`))).toBe(true)
  })
})

describe('upstream container failure → 502', () => {
  test('non-ok container response surfaces as 502 with message, not 500', async () => {
    const saved = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (env.WA_API_BASE_URL && url.startsWith(env.WA_API_BASE_URL)) {
        return new Response('Unknown subdomain', { status: 404 })
      }
      return realFetch(input as RequestInfo)
    }) as typeof fetch

    const res = await app.handle(
      new Request('http://localhost/api/wa/session/status', { headers: { cookie: adminCookie } }),
    )
    globalThis.fetch = saved

    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toContain('WA API 404')
  })
})

describe('POST /api/wa/session/pairing-code', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/session/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '628123456789' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  test('returns 403 for USER role', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/session/pairing-code', {
        method: 'POST',
        headers: { cookie: userCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '628123456789' }),
      }),
    )
    expect(res.status).toBe(403)
  })

  test('validates missing phoneNumber', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/session/pairing-code', {
        method: 'POST',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect([400, 422]).toContain(res.status)
  })

  test('returns pairing code for ADMIN, uses sessionId == user.id', async () => {
    waCalls = []
    const res = await app.handle(
      new Request('http://localhost/api/wa/session/pairing-code', {
        method: 'POST',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: '628123456789' }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result).toBe('12345678')
    expect(waCalls.some((u) => u.endsWith(`/session/requestPairingCode/${adminId}`))).toBe(true)
  })
})

describe('GET /api/wa/session/qr/image', () => {
  test('proxies PNG bytes for ADMIN', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/session/qr/image', { headers: { cookie: adminCookie } }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/png')
  })

  test('returns 403 for USER role', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/wa/session/qr/image', { headers: { cookie: userCookie } }),
    )
    expect(res.status).toBe(403)
  })
})

describe('GET /api/wa/avatar', () => {
  const contactId = '628999@c.us'

  test('returns 401 without session', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/wa/avatar?contactId=${encodeURIComponent(contactId)}`),
    )
    expect(res.status).toBe(401)
  })

  test('returns 403 for USER role', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/wa/avatar?contactId=${encodeURIComponent(contactId)}`, {
        headers: { cookie: userCookie },
      }),
    )
    expect(res.status).toBe(403)
  })

  test('returns 400/422 when contactId is missing', async () => {
    const res = await app.handle(new Request('http://localhost/api/wa/avatar', { headers: { cookie: adminCookie } }))
    expect([400, 422]).toContain(res.status)
  })

  test('returns 200 with url for ADMIN, uses sessionId == user.id', async () => {
    await redis.del(`wa:avatar:${adminId}:${contactId}`).catch(() => {})
    waCalls = []
    const res = await app.handle(
      new Request(`http://localhost/api/wa/avatar?contactId=${encodeURIComponent(contactId)}`, {
        headers: { cookie: adminCookie },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://pps.whatsapp.net/x.jpg')
    expect(waCalls.some((u) => u.endsWith(`/client/getProfilePicUrl/${adminId}`))).toBe(true)
  })

  test('second request is served from Redis cache (no upstream call)', async () => {
    waCalls = []
    const res = await app.handle(
      new Request(`http://localhost/api/wa/avatar?contactId=${encodeURIComponent(contactId)}`, {
        headers: { cookie: adminCookie },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe('https://pps.whatsapp.net/x.jpg')
    expect(waCalls.some((u) => u.includes('/client/getProfilePicUrl/'))).toBe(false)
  })

  test('degrades upstream error to 200 url:null (no 502) — e.g. @lid / no photo', async () => {
    const lidContact = '100399860170781@lid'
    await redis.del(`wa:avatar:${adminId}:${lidContact}`).catch(() => {})
    waCalls = []
    const res = await app.handle(
      new Request(`http://localhost/api/wa/avatar?contactId=${encodeURIComponent(lidContact)}`, {
        headers: { cookie: adminCookie },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBeNull()
    expect(waCalls.some((u) => u.endsWith(`/client/getProfilePicUrl/${adminId}`))).toBe(true)
  })

  test('cached upstream failure is not re-fetched', async () => {
    const lidContact = '100399860170781@lid'
    waCalls = []
    const res = await app.handle(
      new Request(`http://localhost/api/wa/avatar?contactId=${encodeURIComponent(lidContact)}`, {
        headers: { cookie: adminCookie },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBeNull()
    expect(waCalls.some((u) => u.includes('/client/getProfilePicUrl/'))).toBe(false)
  })
})
