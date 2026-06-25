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
    expect(body.consumer.webhookSecret).toMatch(/^whsec_/)

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

describe('management: GET /api/wa/verify/consumers/:id/reveal-secret', () => {
  let id: string
  let createdSecret: string
  beforeAll(async () => {
    const created = await (
      await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-reveal' }, superCookie)
    ).json()
    id = created.consumer.id
    createdSecret = created.consumer.webhookSecret
  })

  test('403 for ADMIN', async () => {
    expect((await json('GET', `/api/wa/verify/consumers/${id}/reveal-secret`, undefined, adminCookie)).status).toBe(403)
  })

  test('404 for unknown id', async () => {
    expect(
      (await json('GET', '/api/wa/verify/consumers/nope/reveal-secret', undefined, superCookie)).status,
    ).toBe(404)
  })

  test('200 for SUPER_ADMIN returns the same plaintext secret', async () => {
    const res = await json('GET', `/api/wa/verify/consumers/${id}/reveal-secret`, undefined, superCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.webhookSecret).toMatch(/^whsec_/)
    expect(body.webhookSecret).toBe(createdSecret)
  })
})

describe('management: inbound log readable by ADMIN, delete SUPER_ADMIN gated', () => {
  test('GET /api/wa/verify/inbound → 200 for ADMIN (guard lowered, masked)', async () => {
    const res = await json('GET', '/api/wa/verify/inbound', undefined, adminCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.inbound)).toBe(true)
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

describe('consumers: pagination + search + active filter', () => {
  beforeAll(async () => {
    // Wipe and seed a deterministic set: 3 active "wav-it-page-foo-*" + 2 inactive "wav-it-page-bar-*".
    await prisma.verifyConsumer.deleteMany({ where: { name: { startsWith: 'wav-it' } } })
    for (const n of ['foo-1', 'foo-2', 'foo-3']) {
      await json('POST', '/api/wa/verify/consumers', { name: `wav-it-page-${n}` }, superCookie)
    }
    for (const n of ['bar-1', 'bar-2']) {
      const c = await (await json('POST', '/api/wa/verify/consumers', { name: `wav-it-page-${n}` }, superCookie)).json()
      await json('PUT', `/api/wa/verify/consumers/${c.consumer.id}`, { name: `wav-it-page-${n}`, active: false }, superCookie)
    }
  })

  test('limit/offset paginate; total reflects full count', async () => {
    const p1 = await (await json('GET', '/api/wa/verify/consumers?limit=2&offset=0', undefined, superCookie)).json()
    expect(p1.total).toBe(5)
    expect(p1.consumers.length).toBe(2)
    const p2 = await (await json('GET', '/api/wa/verify/consumers?limit=2&offset=2', undefined, superCookie)).json()
    expect(p2.consumers.length).toBe(2)
    // No overlap between pages.
    const ids1 = new Set(p1.consumers.map((c: { id: string }) => c.id))
    expect(p2.consumers.some((c: { id: string }) => ids1.has(c.id))).toBe(false)
  })

  test('search narrows by name (case-insensitive)', async () => {
    const res = await (await json('GET', '/api/wa/verify/consumers?search=FOO', undefined, superCookie)).json()
    expect(res.total).toBe(3)
    expect(res.consumers.every((c: { name: string }) => c.name.includes('foo'))).toBe(true)
  })

  test('active=true / active=false filter', async () => {
    const act = await (await json('GET', '/api/wa/verify/consumers?active=true', undefined, superCookie)).json()
    expect(act.total).toBe(3)
    expect(act.consumers.every((c: { active: boolean }) => c.active)).toBe(true)
    const inact = await (await json('GET', '/api/wa/verify/consumers?active=false', undefined, superCookie)).json()
    expect(inact.total).toBe(2)
    expect(inact.consumers.every((c: { active: boolean }) => !c.active)).toBe(true)
  })
})

describe('consumers: POST bulk-delete', () => {
  test('403 for ADMIN', async () => {
    expect((await json('POST', '/api/wa/verify/consumers/bulk-delete', { all: true }, adminCookie)).status).toBe(403)
  })

  test('ids deletes only the selected subset', async () => {
    const a = await (await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-bulk-a' }, superCookie)).json()
    const b = await (await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-bulk-b' }, superCookie)).json()
    const c = await (await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-bulk-c' }, superCookie)).json()

    const res = await json(
      'POST',
      '/api/wa/verify/consumers/bulk-delete',
      { ids: [a.consumer.id, b.consumer.id] },
      superCookie,
    )
    expect(res.status).toBe(200)
    expect((await res.json()).count).toBe(2)

    // a, b gone; c survives — bulk by ids does not touch unselected rows.
    expect(await prisma.verifyConsumer.findUnique({ where: { id: a.consumer.id } })).toBeNull()
    expect(await prisma.verifyConsumer.findUnique({ where: { id: b.consumer.id } })).toBeNull()
    expect(await prisma.verifyConsumer.findUnique({ where: { id: c.consumer.id } })).not.toBeNull()
  })

  test('empty ids is a no-op (count=0)', async () => {
    const res = await json('POST', '/api/wa/verify/consumers/bulk-delete', { ids: [] }, superCookie)
    expect((await res.json()).count).toBe(0)
  })

  test('all=true wipes every consumer', async () => {
    const res = await json('POST', '/api/wa/verify/consumers/bulk-delete', { all: true }, superCookie)
    expect(res.status).toBe(200)
    expect((await res.json()).count).toBeGreaterThanOrEqual(1)
    expect(await prisma.verifyConsumer.count()).toBe(0)
  })
})

describe('requests + inbound: filter + bulk-delete', () => {
  let consumerId: string
  let apiKey: string

  beforeAll(async () => {
    const c = await (
      await json('POST', '/api/wa/verify/consumers', { name: 'wav-it-rq' }, superCookie)
    ).json()
    consumerId = c.consumer.id
    apiKey = c.apiKey
    // Two PENDING requests via start.
    for (let i = 0; i < 2; i++) {
      await app.handle(
        new Request('http://localhost/api/verify/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
          body: JSON.stringify({}),
        }),
      )
    }
    // Seed inbound logs directly (poller normally writes these).
    await prisma.verifyInboundLog.createMany({
      data: [
        { sessionId: 'sess-rq', fromMasked: '6281****1111', tokenFound: 'WAV-AAAA1111', matched: true, consumerId },
        { sessionId: 'sess-rq', fromMasked: '6281****2222', tokenFound: null, matched: false, consumerId: null },
      ],
    })
  })

  test('requests: status filter narrows; total correct', async () => {
    const all = await (await json('GET', '/api/wa/verify/requests', undefined, superCookie)).json()
    expect(all.total).toBeGreaterThanOrEqual(2)
    const pending = await (
      await json('GET', '/api/wa/verify/requests?status=PENDING', undefined, superCookie)
    ).json()
    expect(pending.requests.every((r: { status: string }) => r.status === 'PENDING')).toBe(true)
    const verified = await (
      await json('GET', '/api/wa/verify/requests?status=VERIFIED', undefined, superCookie)
    ).json()
    expect(verified.total).toBe(0)
  })

  test('requests: search by consumer name', async () => {
    const res = await (await json('GET', '/api/wa/verify/requests?search=wav-it-rq', undefined, superCookie)).json()
    expect(res.total).toBeGreaterThanOrEqual(2)
    expect(res.requests.every((r: { consumer: { name: string } }) => r.consumer.name === 'wav-it-rq')).toBe(true)
  })

  test('requests: bulk-delete 403 for ADMIN, ids deletes subset', async () => {
    const list = await (await json('GET', '/api/wa/verify/requests?search=wav-it-rq', undefined, superCookie)).json()
    const id = list.requests[0].id
    expect((await json('POST', '/api/wa/verify/requests/bulk-delete', { ids: [id] }, adminCookie)).status).toBe(403)
    const res = await json('POST', '/api/wa/verify/requests/bulk-delete', { ids: [id] }, superCookie)
    expect((await res.json()).count).toBe(1)
    expect(await prisma.verifyRequest.findUnique({ where: { id } })).toBeNull()
  })

  test('inbound: matched filter + search by masked number', async () => {
    const matched = await (await json('GET', '/api/wa/verify/inbound?matched=true', undefined, superCookie)).json()
    expect(matched.inbound.every((r: { matched: boolean }) => r.matched)).toBe(true)
    const byNum = await (await json('GET', '/api/wa/verify/inbound?search=1111', undefined, superCookie)).json()
    expect(byNum.inbound.every((r: { fromMasked: string }) => r.fromMasked.includes('1111'))).toBe(true)
  })

  test('inbound: bulk-delete all wipes logs (SUPER_ADMIN)', async () => {
    expect((await json('POST', '/api/wa/verify/inbound/bulk-delete', { all: true }, adminCookie)).status).toBe(403)
    const res = await json('POST', '/api/wa/verify/inbound/bulk-delete', { all: true }, superCookie)
    expect(res.status).toBe(200)
    expect(await prisma.verifyInboundLog.count()).toBe(0)
  })
})
