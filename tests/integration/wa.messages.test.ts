import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { env } from '../../src/lib/env'
import { createTestApp, createTestSession, prisma, seedTestUser } from '../helpers'

const app = createTestApp()
const EMAIL_SUFFIX = '@wamsg.test'

let adminId: string
let adminCookie: string
let userCookie: string

// Intercept container calls (never hit the real API) + capture URLs so we can
// assert sessionId == user.id. The fetchMessages stub returns success:true by
// default; chatId '__fail__@c.us' triggers HTTP 200 { success:false } to verify
// the 502 degrade path.
const realFetch = globalThis.fetch
let waCalls: string[] = []

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  const adm = await seedTestUser(`adm${EMAIL_SUFFIX}`, 'pass123', 'Admin', 'ADMIN')
  const usr = await seedTestUser(`usr${EMAIL_SUFFIX}`, 'pass123', 'User', 'USER')
  adminId = adm.id
  adminCookie = `better-auth.session_token=${await createTestSession(adminId)}`
  userCookie = `better-auth.session_token=${await createTestSession(usr.id)}`

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (env.WA_API_BASE_URL && url.startsWith(env.WA_API_BASE_URL)) {
      waCalls.push(url)
      if (url.includes('/client/fetchMessages/')) {
        const failing = typeof init?.body === 'string' && init.body.includes('__fail__@c.us')
        return new Response(
          JSON.stringify(
            failing ? { success: false, error: 'chat not found' } : { success: true, messages: [{ id: 'm1', body: 'hi', fromMe: false, timestamp: 1700000000 }] },
          ),
          { headers: { 'content-type': 'application/json' } },
        )
      }
      return new Response(JSON.stringify({ success: true }), { headers: { 'content-type': 'application/json' } })
    }
    return realFetch(input as RequestInfo, init)
  }) as typeof fetch
})

afterAll(async () => {
  globalThis.fetch = realFetch
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  await prisma.$disconnect()
})

const chatId = '628123@c.us'

describe('GET /api/wa/messages', () => {
  test('401 without session', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/wa/messages?chatId=${encodeURIComponent(chatId)}`),
    )
    expect(res.status).toBe(401)
  })

  test('403 for USER role', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/wa/messages?chatId=${encodeURIComponent(chatId)}`, {
        headers: { cookie: userCookie },
      }),
    )
    expect(res.status).toBe(403)
  })

  test('400/422 when chatId is missing', async () => {
    const res = await app.handle(new Request('http://localhost/api/wa/messages', { headers: { cookie: adminCookie } }))
    expect([400, 422]).toContain(res.status)
  })

  test('200 for ADMIN, uses sessionId == user.id', async () => {
    waCalls = []
    const res = await app.handle(
      new Request(`http://localhost/api/wa/messages?chatId=${encodeURIComponent(chatId)}`, {
        headers: { cookie: adminCookie },
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(Array.isArray(body.messages)).toBe(true)
    expect(waCalls.some((u) => u.endsWith(`/client/fetchMessages/${adminId}`))).toBe(true)
  })

  test('502 when container replies 200 { success:false }', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/wa/messages?chatId=${encodeURIComponent('__fail__@c.us')}`, {
        headers: { cookie: adminCookie },
      }),
    )
    expect(res.status).toBe(502)
  })
})
