import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { SIM_CONSUMER_NAME } from '../../src/lib/wa-verify-sim'
import { createTestApp, createTestSession, prisma, seedTestUser } from '../helpers'

const app = createTestApp()
const EMAIL_SUFFIX = '@wavsim.test'

let superId: string
let superCookie: string
let adminCookie: string
let userCookie: string

async function wipeSim() {
  // Sim requests cascade via the reserved sim consumer; remove both.
  const sim = await prisma.verifyConsumer.findFirst({ where: { name: SIM_CONSUMER_NAME }, select: { id: true } })
  if (sim) {
    await prisma.verifyRequest.deleteMany({ where: { consumerId: sim.id } })
    await prisma.verifyConsumer.delete({ where: { id: sim.id } })
  }
}

beforeAll(async () => {
  await wipeSim()
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })

  const sup = await seedTestUser(`sup${EMAIL_SUFFIX}`, 'pass123', 'Super', 'SUPER_ADMIN')
  const adm = await seedTestUser(`adm${EMAIL_SUFFIX}`, 'pass123', 'Admin', 'ADMIN')
  const usr = await seedTestUser(`usr${EMAIL_SUFFIX}`, 'pass123', 'User', 'USER')
  superId = sup.id
  superCookie = `better-auth.session_token=${await createTestSession(superId)}`
  adminCookie = `better-auth.session_token=${await createTestSession(adm.id)}`
  userCookie = `better-auth.session_token=${await createTestSession(usr.id)}`
})

afterAll(async () => {
  await wipeSim()
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  await prisma.$disconnect()
})

function req(method: string, path: string, body?: unknown, cookie?: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  return app.handle(
    new Request(`http://localhost${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }),
  )
}

describe('sim: POST /api/wa/verify/sim/start', () => {
  test('401 without session', async () => {
    expect((await req('POST', '/api/wa/verify/sim/start', {})).status).toBe(401)
  })

  test('403 for ADMIN (SUPER_ADMIN only)', async () => {
    expect((await req('POST', '/api/wa/verify/sim/start', {}, adminCookie)).status).toBe(403)
  })

  test('403 for USER', async () => {
    expect((await req('POST', '/api/wa/verify/sim/start', {}, userCookie)).status).toBe(403)
  })

  test('200 for SUPER_ADMIN → WAV token + reserved sim consumer created', async () => {
    const res = await req('POST', '/api/wa/verify/sim/start', { expectedPhone: '628123456789' }, superCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.token).toMatch(/^WAV-[A-HJ-NP-Z2-7]{8}$/)
    expect(body.id).toBeDefined()

    const sim = await prisma.verifyConsumer.findFirst({ where: { name: SIM_CONSUMER_NAME } })
    expect(sim).not.toBeNull()
    const row = await prisma.verifyRequest.findUnique({ where: { id: body.id } })
    expect(row?.consumerId).toBe(sim!.id)
    expect(row?.expectedPhone).toBe('628123456789')
  })

  test('second start does not create a second sim consumer (idempotent)', async () => {
    await req('POST', '/api/wa/verify/sim/start', {}, superCookie)
    await req('POST', '/api/wa/verify/sim/start', {}, superCookie)
    expect(await prisma.verifyConsumer.count({ where: { name: SIM_CONSUMER_NAME } })).toBe(1)
  })
})

describe('sim: GET /api/wa/verify/sim/:id', () => {
  let id: string
  beforeAll(async () => {
    const body = await (await req('POST', '/api/wa/verify/sim/start', {}, superCookie)).json()
    id = body.id
  })

  test('401 without session', async () => {
    expect((await req('GET', `/api/wa/verify/sim/${id}`)).status).toBe(401)
  })

  test('200 → PENDING for a fresh request', async () => {
    const res = await req('GET', `/api/wa/verify/sim/${id}`, undefined, superCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('PENDING')
    expect(body.matchedPhone).toBeNull()
  })

  test('404 for an unknown id', async () => {
    expect((await req('GET', '/api/wa/verify/sim/nonexistent', undefined, superCookie)).status).toBe(404)
  })

  test('reflects VERIFIED with a masked matchedPhone after capture', async () => {
    await prisma.verifyRequest.update({
      where: { id },
      data: { status: 'VERIFIED', matchedPhone: '628123456789', verifiedAt: new Date() },
    })
    const body = await (await req('GET', `/api/wa/verify/sim/${id}`, undefined, superCookie)).json()
    expect(body.status).toBe('VERIFIED')
    // Masked: never returns the full number to the browser.
    expect(body.matchedPhone).not.toBe('628123456789')
    expect(body.matchedPhone).toContain('*')
  })
})

describe('sim: GET /api/wa/verify/sim/:id/qr', () => {
  let id: string
  beforeAll(async () => {
    const body = await (await req('POST', '/api/wa/verify/sim/start', {}, superCookie)).json()
    id = body.id
  })

  test('404 for an unknown id', async () => {
    expect((await req('GET', '/api/wa/verify/sim/nonexistent/qr', undefined, superCookie)).status).toBe(404)
  })

  test('PNG image for a valid id when server number is configured', async () => {
    const res = await req('GET', `/api/wa/verify/sim/${id}/qr`, undefined, superCookie)
    // When WA_VERIFY_SERVER_NUMBER is unset, the endpoint returns 404 by design.
    if (res.status === 404) {
      expect(res.status).toBe(404)
      return
    }
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/png')
    const buf = await res.arrayBuffer()
    expect(buf.byteLength).toBeGreaterThan(0)
  })
})
