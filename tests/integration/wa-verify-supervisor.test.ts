import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { createTestApp, createTestSession, prisma, seedTestUser } from '../helpers'

const app = createTestApp()
const EMAIL_SUFFIX = '@wasupervisor.test'

let adminCookie: string
let superCookie: string

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  const adm = await seedTestUser(`adm${EMAIL_SUFFIX}`, 'pass123', 'Admin', 'ADMIN')
  const sup = await seedTestUser(`sup${EMAIL_SUFFIX}`, 'pass123', 'Super', 'SUPER_ADMIN')
  adminCookie = `better-auth.session_token=${await createTestSession(adm.id)}`
  superCookie = `better-auth.session_token=${await createTestSession(sup.id)}`
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  await prisma.$disconnect()
})

function get(cookie?: string) {
  const headers: Record<string, string> = {}
  if (cookie) headers.cookie = cookie
  return app.handle(new Request('http://localhost/api/wa/verify/supervisor', { headers }))
}

describe('GET /api/wa/verify/supervisor', () => {
  test('401 without session', async () => {
    expect((await get()).status).toBe(401)
  })

  test('200 for ADMIN role (guard lowered to guardAdmin)', async () => {
    const res = await get(adminCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.running).toBe('boolean')
    expect(typeof body.pollIntervalMs).toBe('number')
  })

  test('200 for SUPER_ADMIN with supervisor state shape', async () => {
    const res = await get(superCookie)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.running).toBe('boolean')
    expect('sessionId' in body).toBe(true)
    expect('watermark' in body).toBe(true)
    expect(typeof body.pollIntervalMs).toBe('number')
  })
})
