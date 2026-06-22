import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { createTestApp, seedTestUser, createTestSession, prisma } from '../helpers'

const app = createTestApp()
const EMAIL_SUFFIX = '@list.test'

let superAdminId: string
let adminId: string
let qcId: string
let userId: string
let saCookie: string
let adminCookie: string
let qcCookie: string
let userCookie: string

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  const sa = await seedTestUser(`sa${EMAIL_SUFFIX}`, 'pass123', 'SA', 'SUPER_ADMIN')
  const adm = await seedTestUser(`adm${EMAIL_SUFFIX}`, 'pass123', 'Admin', 'ADMIN')
  const qc = await seedTestUser(`qc${EMAIL_SUFFIX}`, 'pass123', 'QC', 'QC')
  const usr = await seedTestUser(`usr${EMAIL_SUFFIX}`, 'pass123', 'User', 'USER')
  superAdminId = sa.id
  adminId = adm.id
  qcId = qc.id
  userId = usr.id
  saCookie = `better-auth.session_token=${await createTestSession(superAdminId)}`
  adminCookie = `better-auth.session_token=${await createTestSession(adminId)}`
  qcCookie = `better-auth.session_token=${await createTestSession(qcId)}`
  userCookie = `better-auth.session_token=${await createTestSession(userId)}`
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  await prisma.$disconnect()
})

async function createTicket(cookie: string, overrides: Record<string, unknown> = {}) {
  return app.handle(
    new Request('http://localhost/api/tickets', {
      method: 'POST',
      headers: { cookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test Ticket', description: 'Test description', priority: 'MEDIUM', ...overrides }),
    }),
  )
}

describe('GET /api/tickets', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request('http://localhost/api/tickets'))
    expect(res.status).toBe(401)
  })

  test('returns 403 for USER role', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/tickets', { headers: { cookie: userCookie } }),
    )
    expect(res.status).toBe(403)
  })

  test('returns ticket list for QC/ADMIN/SUPER_ADMIN', async () => {
    for (const cookie of [qcCookie, adminCookie, saCookie]) {
      const res = await app.handle(new Request('http://localhost/api/tickets', { headers: { cookie } }))
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(Array.isArray(body.tickets)).toBe(true)
    }
  })

  test('supports cursor pagination — returns nextCursor when more pages', async () => {
    for (let i = 0; i < 3; i++) {
      await createTicket(adminCookie, { title: `Paging ${i}` })
    }

    const res = await app.handle(
      new Request('http://localhost/api/tickets?limit=2', { headers: { cookie: adminCookie } }),
    )
    const body = await res.json()
    expect(body.tickets.length).toBe(2)
    expect(body.nextCursor).toBeDefined()

    const res2 = await app.handle(
      new Request(`http://localhost/api/tickets?limit=2&cursor=${body.nextCursor}`, {
        headers: { cookie: adminCookie },
      }),
    )
    const body2 = await res2.json()
    expect(body2.tickets.length).toBeGreaterThanOrEqual(1)
    const ids1 = body.tickets.map((t: any) => t.id)
    const ids2 = body2.tickets.map((t: any) => t.id)
    expect(ids1.some((id: string) => ids2.includes(id))).toBe(false)
  })

  test('excludes soft-deleted tickets', async () => {
    const res = await createTicket(adminCookie, { title: 'To Be Deleted' })
    const ticketId = (await res.json()).ticket.id

    await prisma.ticket.update({ where: { id: ticketId }, data: { deletedAt: new Date() } })

    const listRes = await app.handle(
      new Request('http://localhost/api/tickets', { headers: { cookie: adminCookie } }),
    )
    const body = await listRes.json()
    const found = body.tickets.find((t: any) => t.id === ticketId)
    expect(found).toBeUndefined()
  })
})

describe('POST /api/tickets', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Test', description: 'Desc' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  test('returns 403 for USER role', async () => {
    const res = await createTicket(userCookie)
    expect(res.status).toBe(403)
  })

  test('creates ticket with default MEDIUM priority', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/tickets', {
        method: 'POST',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'No Priority', description: 'Desc' }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ticket.priority).toBe('MEDIUM')
  })

  test('validates required fields', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/tickets', {
        method: 'POST',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Missing description' }),
      }),
    )
    expect([400, 422]).toContain(res.status)
  })

  test('creates with correct reporterId', async () => {
    const res = await createTicket(qcCookie, { title: 'QC ticket' })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ticket.reporterId).toBe(qcId)
  })
})
