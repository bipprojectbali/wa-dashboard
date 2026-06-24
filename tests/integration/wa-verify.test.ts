import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createTestApp, createTestSession, prisma, seedTestUser } from '../helpers'

const app = createTestApp()
const EMAIL_SUFFIX = '@waverify.test'

let superId: string
let adminId: string
let userId: string
let superCookie: string
let adminCookie: string
let userCookie: string

// Stub outbound webhook delivery — consumer webhookUrl points here; never hit the network.
const realFetch = globalThis.fetch
const WEBHOOK_URL = 'http://webhook.waverify.test/hook'
let webhookHits = 0

beforeAll(async () => {
  await prisma.verifyInboundLog.deleteMany()
  await prisma.verifyRequest.deleteMany()
  await prisma.verifyConsumer.deleteMany({ where: { name: { startsWith: 'wav-it' } } })
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })

  const sup = await seedTestUser(`sup${EMAIL_SUFFIX}`, 'pass123', 'Super', 'SUPER_ADMIN')
  const adm = await seedTestUser(`adm${EMAIL_SUFFIX}`, 'pass123', 'Admin', 'ADMIN')
  const usr = await seedTestUser(`usr${EMAIL_SUFFIX}`, 'pass123', 'User', 'USER')
  superId = sup.id
  adminId = adm.id
  userId = usr.id
  superCookie = `better-auth.session_token=${await createTestSession(superId)}`
  adminCookie = `better-auth.session_token=${await createTestSession(adminId)}`
  userCookie = `better-auth.session_token=${await createTestSession(userId)}`

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.startsWith(WEBHOOK_URL)) {
      webhookHits++
      return new Response('ok', { status: 200 })
    }
    return realFetch(input as RequestInfo, init)
  }) as typeof fetch
})

afterAll(async () => {
  globalThis.fetch = realFetch
  await prisma.verifyInboundLog.deleteMany()
  await prisma.verifyRequest.deleteMany()
  await prisma.verifyConsumer.deleteMany({ where: { name: { startsWith: 'wav-it' } } })
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  await prisma.$disconnect()
})

function json(method: string, path: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return app.handle(
    new Request(`http://localhost${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
  )
}

describe('management: GET /api/wa/verify/consumers', () => {
  test('401 without session', async () => {
    expect((await json('GET', '/api/wa/verify/consumers')).status).toBe(401)
  })

  test('403 for USER role', async () => {
    expect((await json('GET', '/api/wa/verify/consumers', undefined, userCookie)).status).toBe(403)
  })

  test('200 for ADMIN, canEdit=false (not SUPER_ADMIN)', async () => {
    const res = await json('GET', '/api/wa/verify/consumers', undefined, adminCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.consumers)).toBe(true)
    expect(body.canEdit).toBe(false)
  })

  test('200 for SUPER_ADMIN, canEdit=true', async () => {
    const body = await (await json('GET', '/api/wa/verify/consumers', undefined, superCookie)).json()
    expect(body.canEdit).toBe(true)
  })
})

describe('management: POST /api/wa/verify/consumers', () => {
  test('403 for ADMIN (SUPER_ADMIN only)', async () => {
    const res = await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-x' }, adminCookie)
    expect(res.status).toBe(403)
  })

  test('400/422 for missing name', async () => {
    const res = await json('POST', '/api/wa/verify/consumers', {}, superCookie)
    expect([400, 422]).toContain(res.status)
  })

  test('201/200 for SUPER_ADMIN, returns apiKey exactly once', async () => {
    const res = await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-create' }, superCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.apiKey).toMatch(/^wav_sk_/)
    expect(body.consumer.apiKeyPrefix).toBe(body.apiKey.slice(0, 12))

    // The plaintext key is never returned again on list.
    const list = await (await json('GET', '/api/wa/verify/consumers', undefined, superCookie)).json()
    const found = list.consumers.find((c: { id: string }) => c.id === body.consumer.id)
    expect(found).toBeDefined()
    expect(found.apiKey).toBeUndefined()
  })
})

describe('public: POST /api/verify/start (API key auth)', () => {
  let apiKey: string
  let consumerId: string

  beforeAll(async () => {
    const body = await (
      await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-public', webhookUrl: WEBHOOK_URL }, superCookie)
    ).json()
    apiKey = body.apiKey
    consumerId = body.consumer.id
  })

  test('401 without x-api-key', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(401)
  })

  test('401 for an invalid api key', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'wav_sk_invalid' },
        body: JSON.stringify({}),
      }),
    )
    expect(res.status).toBe(401)
  })

  test('200 with a valid key → returns a WAV token', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/verify/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify({ expectedPhone: '628123456789' }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toMatch(/^WAV-[A-HJ-NP-Z2-7]{8}$/)
    expect(body.id).toBeDefined()

    // The request is scoped to this consumer.
    const row = await prisma.verifyRequest.findUnique({ where: { id: body.id } })
    expect(row?.consumerId).toBe(consumerId)
    expect(row?.expectedPhone).toBe('628123456789')
  })
})

describe('public: GET /api/verify/:id isolation between consumers', () => {
  test('a consumer cannot read another consumer request → 404', async () => {
    // Consumer A creates a request.
    const aKey = (
      await (await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-a' }, superCookie)).json()
    ).apiKey
    const bKey = (
      await (await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-b' }, superCookie)).json()
    ).apiKey

    const started = await (
      await app.handle(
        new Request('http://localhost/api/verify/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': aKey },
          body: JSON.stringify({}),
        }),
      )
    ).json()

    // A can read its own request.
    const own = await app.handle(
      new Request(`http://localhost/api/verify/${started.id}`, { headers: { 'x-api-key': aKey } }),
    )
    expect(own.status).toBe(200)

    // B cannot — the row is invisible across consumers.
    const cross = await app.handle(
      new Request(`http://localhost/api/verify/${started.id}`, { headers: { 'x-api-key': bKey } }),
    )
    expect(cross.status).toBe(404)
  })
})

describe('management: PUT /api/wa/verify/consumers/:id', () => {
  let id: string
  beforeAll(async () => {
    id = (await (await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-upd' }, superCookie)).json()).consumer.id
  })

  test('403 for ADMIN', async () => {
    expect((await json('PUT', `/api/wa/verify/consumers/${id}`, { name: 'wav-it-upd2' }, adminCookie)).status).toBe(403)
  })

  test('404 for unknown id', async () => {
    expect((await json('PUT', '/api/wa/verify/consumers/nonexistent', { name: 'x' }, superCookie)).status).toBe(404)
  })

  test('200 for SUPER_ADMIN updates name + active', async () => {
    const res = await json(
      'PUT',
      `/api/wa/verify/consumers/${id}`,
      { name: 'wav-it-renamed', active: false },
      superCookie,
    )
    expect(res.status).toBe(200)
    const list = await (await json('GET', '/api/wa/verify/consumers', undefined, superCookie)).json()
    const found = list.consumers.find((c: { id: string }) => c.id === id)
    expect(found.name).toBe('wav-it-renamed')
    expect(found.active).toBe(false)
  })

  test('200 updates webhookUrl (set then clear)', async () => {
    const set = await json(
      'PUT',
      `/api/wa/verify/consumers/${id}`,
      { name: 'wav-it-renamed', webhookUrl: 'https://hook.example.test/wav' },
      superCookie,
    )
    expect(set.status).toBe(200)
    let list = await (await json('GET', '/api/wa/verify/consumers', undefined, superCookie)).json()
    expect(list.consumers.find((c: { id: string }) => c.id === id).webhookUrl).toBe('https://hook.example.test/wav')

    const clear = await json(
      'PUT',
      `/api/wa/verify/consumers/${id}`,
      { name: 'wav-it-renamed', webhookUrl: null },
      superCookie,
    )
    expect(clear.status).toBe(200)
    list = await (await json('GET', '/api/wa/verify/consumers', undefined, superCookie)).json()
    expect(list.consumers.find((c: { id: string }) => c.id === id).webhookUrl).toBeNull()
  })
})

describe('management: POST /api/wa/verify/consumers/:id/regenerate-key', () => {
  let id: string
  let firstKey: string
  beforeAll(async () => {
    const created = await (await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-regen' }, superCookie)).json()
    id = created.consumer.id
    firstKey = created.apiKey
  })

  test('403 for ADMIN', async () => {
    expect((await json('POST', `/api/wa/verify/consumers/${id}/regenerate-key`, undefined, adminCookie)).status).toBe(
      403,
    )
  })

  test('404 for unknown id', async () => {
    expect((await json('POST', '/api/wa/verify/consumers/nope/regenerate-key', undefined, superCookie)).status).toBe(404)
  })

  test('200 rotates key — old key stops working, new key works', async () => {
    const res = await json('POST', `/api/wa/verify/consumers/${id}/regenerate-key`, undefined, superCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.apiKey).toMatch(/^wav_sk_/)
    expect(body.apiKey).not.toBe(firstKey)

    const startWith = (key: string) =>
      app.handle(
        new Request('http://localhost/api/verify/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': key },
          body: JSON.stringify({}),
        }),
      )
    expect((await startWith(firstKey)).status).toBe(401)
    expect((await startWith(body.apiKey)).status).toBe(200)
  })
})

describe('management: inbound log + delete are SUPER_ADMIN gated', () => {
  test('GET /api/wa/verify/inbound → 403 for ADMIN', async () => {
    expect((await json('GET', '/api/wa/verify/inbound', undefined, adminCookie)).status).toBe(403)
  })

  test('GET /api/wa/verify/inbound → 200 for SUPER_ADMIN', async () => {
    const res = await json('GET', '/api/wa/verify/inbound', undefined, superCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.inbound)).toBe(true)
  })

  test('GET /api/wa/verify/requests → 200 for ADMIN (masked)', async () => {
    const res = await json('GET', '/api/wa/verify/requests', undefined, adminCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.requests)).toBe(true)
  })

  test('DELETE consumer → 403 for ADMIN, 200/404 for SUPER_ADMIN', async () => {
    const created = await (
      await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-del' }, superCookie)
    ).json()
    expect((await json('DELETE', `/api/wa/verify/consumers/${created.consumer.id}`, undefined, adminCookie)).status).toBe(
      403,
    )
    expect(
      (await json('DELETE', `/api/wa/verify/consumers/${created.consumer.id}`, undefined, superCookie)).status,
    ).toBe(200)
    // Deleting again → 404.
    expect(
      (await json('DELETE', `/api/wa/verify/consumers/${created.consumer.id}`, undefined, superCookie)).status,
    ).toBe(404)
  })
})
