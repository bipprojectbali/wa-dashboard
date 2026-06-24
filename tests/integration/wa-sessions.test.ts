import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { env } from '../../src/lib/env'
import { createTestApp, createTestSession, prisma, seedTestUser } from '../helpers'

const app = createTestApp()
const EMAIL_SUFFIX = '@wa-sessions.test'

// Sesi orphan: id acak di container yang tak ada di tabel user dashboard.
const ORPHAN_ID = 'VnLCo5GHorphan01'
const RAW_PHONE = '6281234566789'

let superId: string
let adminId: string
let superCookie: string
let adminCookie: string

const realFetch = globalThis.fetch
let waCalls: string[] = []

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  const sup = await seedTestUser(`sup${EMAIL_SUFFIX}`, 'pass123', 'Super', 'SUPER_ADMIN')
  const adm = await seedTestUser(`adm${EMAIL_SUFFIX}`, 'pass123', 'Admin', 'ADMIN')
  superId = sup.id
  adminId = adm.id
  superCookie = `better-auth.session_token=${await createTestSession(superId)}`
  adminCookie = `better-auth.session_token=${await createTestSession(adminId)}`

  // Intercept container calls. getSessions returns the mapped super-admin id +
  // an orphan id; status/getClassInfo/terminate respond per-id.
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (env.WA_API_BASE_URL && url.startsWith(env.WA_API_BASE_URL)) {
      waCalls.push(url)
      if (url.endsWith('/session/getSessions')) {
        // Bentuk respons container wwebjs-api yang sebenarnya: { success, result: [...] }.
        return new Response(JSON.stringify({ success: true, result: [superId, ORPHAN_ID] }), {
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('/session/status/')) {
        return new Response(JSON.stringify({ success: true, state: 'CONNECTED' }), {
          headers: { 'content-type': 'application/json' },
        })
      }
      if (url.includes('/client/getClassInfo/')) {
        return new Response(
          JSON.stringify({
            success: true,
            sessionInfo: { pushname: 'Acme Bot', wid: { user: RAW_PHONE } },
          }),
          { headers: { 'content-type': 'application/json' } },
        )
      }
      if (url.includes('/session/terminate/')) {
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'content-type': 'application/json' },
        })
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'content-type': 'application/json' },
      })
    }
    return realFetch(input as RequestInfo, init)
  }) as typeof fetch
})

afterAll(async () => {
  globalThis.fetch = realFetch
  await prisma.auditLog.deleteMany({ where: { userId: { in: [superId, adminId] } } }).catch(() => {})
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  await prisma.$disconnect()
})

describe('GET /api/admin/wa-sessions', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/wa-sessions'))
    expect(res.status).toBe(401)
  })

  test('returns 403 for ADMIN role', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/admin/wa-sessions', { headers: { cookie: adminCookie } }),
    )
    expect(res.status).toBe(403)
  })

  test('returns enriched list for SUPER_ADMIN with orphan flag + masked phone', async () => {
    waCalls = []
    const res = await app.handle(
      new Request('http://localhost/api/admin/wa-sessions', { headers: { cookie: superCookie } }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.summary.total).toBe(2)
    expect(body.summary.connected).toBe(2)
    expect(body.summary.orphan).toBe(1)

    const mapped = body.sessions.find((s: any) => s.sessionId === superId)
    const orphan = body.sessions.find((s: any) => s.sessionId === ORPHAN_ID)
    expect(mapped.orphan).toBe(false)
    expect(mapped.mappedUserEmail).toBe(`sup${EMAIL_SUFFIX}`)
    expect(orphan.orphan).toBe(true)
    expect(orphan.mappedUserEmail).toBeNull()

    // Phone must be masked — never the full digit string.
    expect(mapped.phone).not.toBe(RAW_PHONE)
    expect(mapped.phone).toContain('*')
    expect(JSON.stringify(body)).not.toContain(RAW_PHONE)
  })
})

describe('POST /api/admin/wa-sessions/:id/terminate', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/admin/wa-sessions/${ORPHAN_ID}/terminate`, { method: 'POST' }),
    )
    expect(res.status).toBe(401)
  })

  test('returns 403 for ADMIN role', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/admin/wa-sessions/${ORPHAN_ID}/terminate`, {
        method: 'POST',
        headers: { cookie: adminCookie },
      }),
    )
    expect(res.status).toBe(403)
  })

  test('terminates raw sessionId for SUPER_ADMIN and writes audit log', async () => {
    waCalls = []
    const res = await app.handle(
      new Request(`http://localhost/api/admin/wa-sessions/${ORPHAN_ID}/terminate`, {
        method: 'POST',
        headers: { cookie: superCookie },
      }),
    )
    expect(res.status).toBe(200)
    // Container hit with the raw id from input (not authUser.id).
    expect(waCalls.some((u) => u.endsWith(`/session/terminate/${ORPHAN_ID}`))).toBe(true)

    // audit() is fire-and-forget — poll briefly for the row.
    let entry = null
    for (let i = 0; i < 20 && !entry; i++) {
      entry = await prisma.auditLog.findFirst({
        where: { userId: superId, action: 'WA_SESSION_TERMINATED' },
        orderBy: { createdAt: 'desc' },
      })
      if (!entry) await new Promise((r) => setTimeout(r, 50))
    }
    expect(entry).not.toBeNull()
    expect(entry?.detail).toBe(`sessionId=${ORPHAN_ID}`)
  })
})
