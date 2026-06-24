import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createTestApp, createTestSession, prisma, seedTestUser } from '../helpers'
import { handleInbound } from '../../src/lib/wa-verify'
import { deliverVerified } from '../../src/lib/wa-verify-webhook'

// E2E alur inti WAV: start → pesan masuk dicocokkan matcher → poll VERIFIED → webhook terkirim.
// Webhook di matcher bersifat fire-and-forget (dynamic import), jadi assertion webhook di sini
// memanggil deliverVerified() langsung agar deterministik (bukan menunggu race async).

const app = createTestApp()
const EMAIL_SUFFIX = '@waverifye2e.test'
const WEBHOOK_URL = 'http://webhook.waverifye2e.test/hook'

const realFetch = globalThis.fetch
let webhookHits = 0
let superCookie: string
let adminCookie: string

beforeAll(async () => {
  await prisma.verifyInboundLog.deleteMany()
  await prisma.verifyRequest.deleteMany()
  await prisma.verifyConsumer.deleteMany({ where: { name: { startsWith: 'wav-e2e' } } })
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })

  const sup = await seedTestUser(`sup${EMAIL_SUFFIX}`, 'pass123', 'Super', 'SUPER_ADMIN')
  const adm = await seedTestUser(`adm${EMAIL_SUFFIX}`, 'pass123', 'Admin', 'ADMIN')
  superCookie = `better-auth.session_token=${await createTestSession(sup.id)}`
  adminCookie = `better-auth.session_token=${await createTestSession(adm.id)}`

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
  await prisma.verifyConsumer.deleteMany({ where: { name: { startsWith: 'wav-e2e' } } })
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  await prisma.$disconnect()
})

function adminJson(method: string, path: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return app.handle(
    new Request(`http://localhost${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }),
  )
}

async function createConsumer(name: string, webhookUrl?: string): Promise<{ id: string; apiKey: string }> {
  const body = await (
    await adminJson('POST', '/api/wa/verify/consumers', { name, webhookUrl }, superCookie)
  ).json()
  return { id: body.consumer.id, apiKey: body.apiKey }
}

function start(apiKey: string, expectedPhone?: string) {
  return app.handle(
    new Request('http://localhost/api/verify/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
      body: JSON.stringify(expectedPhone ? { expectedPhone } : {}),
    }),
  )
}

function poll(apiKey: string, id: string) {
  return app.handle(new Request(`http://localhost/api/verify/${id}`, { headers: { 'x-api-key': apiKey } }))
}

describe('e2e: start → inbound match → poll VERIFIED → webhook', () => {
  test('user sends token, request flips to VERIFIED with the sender phone', async () => {
    const { apiKey } = await createConsumer('wav-e2e-match', WEBHOOK_URL)
    const { id, token } = await (await start(apiKey, '628111000111')).json()

    // Token PENDING sebelum pesan masuk.
    const before = await (await poll(apiKey, id)).json()
    expect(before.status).toBe('PENDING')

    // User mengirim token via WhatsApp dari nomornya ke nomor server.
    const result = await handleInbound('wav-e2e-session', {
      from: '628111000111@c.us',
      body: `Halo, ini kode saya: ${token}`,
      fromMe: false,
      id: 'msg-e2e-1',
    })
    expect(result.matched).toBe(true)
    expect(result.requestId).toBe(id)

    const after = await (await poll(apiKey, id)).json()
    expect(after.status).toBe('VERIFIED')
    expect(after.matchedPhone).toBe('628111000111')
    expect(after.verifiedAt).toBeTruthy()
  })

  test('inbound from server self (fromMe) does not match', async () => {
    const { apiKey } = await createConsumer('wav-e2e-self', WEBHOOK_URL)
    const { id, token } = await (await start(apiKey)).json()

    const result = await handleInbound('wav-e2e-session', {
      from: '628222000222@c.us',
      body: token,
      fromMe: true,
    })
    expect(result.matched).toBe(false)
    expect((await (await poll(apiKey, id)).json()).status).toBe('PENDING')
  })

  test('webhook is delivered to the consumer webhookUrl after a match', async () => {
    const before = webhookHits
    const { id, apiKey } = await createConsumer('wav-e2e-hook', WEBHOOK_URL)
    const { id: reqId, token } = await (await start(apiKey)).json()
    void id

    await handleInbound('wav-e2e-session', { from: '628333000333@c.us', body: token, fromMe: false })
    // Panggil langsung agar deterministik (matcher memicunya fire-and-forget).
    await deliverVerified(reqId)

    expect(webhookHits).toBeGreaterThan(before)
    const row = await prisma.verifyRequest.findUnique({ where: { id: reqId } })
    expect(row?.deliveryStatus).toBe('DELIVERED')
  })

  test('a second sender cannot override an already-VERIFIED request (idempotent)', async () => {
    const { apiKey } = await createConsumer('wav-e2e-race', WEBHOOK_URL)
    const { id, token } = await (await start(apiKey)).json()

    const first = await handleInbound('wav-e2e-session', { from: '628444000444@c.us', body: token, fromMe: false })
    const second = await handleInbound('wav-e2e-session', { from: '628555000555@c.us', body: token, fromMe: false })
    expect(first.matched).toBe(true)
    expect(second.matched).toBe(false)

    const after = await (await poll(apiKey, id)).json()
    expect(after.matchedPhone).toBe('628444000444') // pemenang pertama tetap.
  })
})

describe('e2e: GET /api/verify/:id expiry is live-checked', () => {
  test('a past expiresAt reports EXPIRED without a sweep', async () => {
    const { apiKey } = await createConsumer('wav-e2e-expired')
    const { id } = await (await start(apiKey)).json()

    // Geser expiry ke masa lalu — status DB masih PENDING, endpoint harus melaporkan EXPIRED.
    await prisma.verifyRequest.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } })

    const res = await poll(apiKey, id)
    expect(res.status).toBe(200)
    expect((await res.json()).status).toBe('EXPIRED')
  })
})

describe('e2e: POST /api/wa/verify/requests/:id/replay', () => {
  test('403 for ADMIN (SUPER_ADMIN only)', async () => {
    const { apiKey } = await createConsumer('wav-e2e-replay-auth', WEBHOOK_URL)
    const { id } = await (await start(apiKey)).json()
    expect((await adminJson('POST', `/api/wa/verify/requests/${id}/replay`, undefined, adminCookie)).status).toBe(403)
  })

  test('409 not_verified when the request is still PENDING', async () => {
    const { apiKey } = await createConsumer('wav-e2e-replay-pending', WEBHOOK_URL)
    const { id } = await (await start(apiKey)).json()
    const res = await adminJson('POST', `/api/wa/verify/requests/${id}/replay`, undefined, superCookie)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('not_verified')
  })

  test('409 no_webhook when the consumer has no webhookUrl', async () => {
    const { apiKey } = await createConsumer('wav-e2e-replay-nohook')
    const { id, token } = await (await start(apiKey)).json()
    await handleInbound('wav-e2e-session', { from: '628666000666@c.us', body: token, fromMe: false })

    const res = await adminJson('POST', `/api/wa/verify/requests/${id}/replay`, undefined, superCookie)
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('no_webhook')
  })

  test('200 ok replays the webhook for a VERIFIED request', async () => {
    const before = webhookHits
    const { apiKey } = await createConsumer('wav-e2e-replay-ok', WEBHOOK_URL)
    const { id, token } = await (await start(apiKey)).json()
    await handleInbound('wav-e2e-session', { from: '628777000777@c.us', body: token, fromMe: false })

    const res = await adminJson('POST', `/api/wa/verify/requests/${id}/replay`, undefined, superCookie)
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    expect(webhookHits).toBeGreaterThan(before)
  })
})
