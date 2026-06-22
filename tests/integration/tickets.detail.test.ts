import { test, expect, describe, beforeAll, afterAll, beforeEach } from 'bun:test'
import { createTestApp, seedTestUser, createTestSession, prisma } from '../helpers'

const app = createTestApp()
const EMAIL_SUFFIX = '@detail.test'

let superAdminId: string
let adminId: string
let qcId: string
let userId: string
let saCookie: string
let adminCookie: string
let qcCookie: string

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_SUFFIX } } })
  const sa = await seedTestUser(`sa${EMAIL_SUFFIX}`, 'pass123', 'SA', 'SUPER_ADMIN')
  const adm = await seedTestUser(`adm${EMAIL_SUFFIX}`, 'pass123', 'Admin', 'ADMIN')
  const qc = await seedTestUser(`qc${EMAIL_SUFFIX}`, 'pass123', 'QC', 'QC')
  await seedTestUser(`usr${EMAIL_SUFFIX}`, 'pass123', 'User', 'USER')
  superAdminId = sa.id
  adminId = adm.id
  qcId = qc.id
  saCookie = `better-auth.session_token=${await createTestSession(superAdminId)}`
  adminCookie = `better-auth.session_token=${await createTestSession(adminId)}`
  qcCookie = `better-auth.session_token=${await createTestSession(qcId)}`
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

describe('GET /api/tickets/:id', () => {
  let ticketId: string

  beforeAll(async () => {
    const res = await createTicket(adminCookie, { title: 'Detail Test' })
    ticketId = (await res.json()).ticket.id
  })

  test('returns 401 without session', async () => {
    const res = await app.handle(new Request(`http://localhost/api/tickets/${ticketId}`))
    expect(res.status).toBe(401)
  })

  test('returns ticket with comments and evidence', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/tickets/${ticketId}`, { headers: { cookie: adminCookie } }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ticket.id).toBe(ticketId)
    expect(Array.isArray(body.ticket.comments)).toBe(true)
    expect(Array.isArray(body.ticket.evidence)).toBe(true)
  })

  test('returns 404 for non-existent ticket', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/tickets/nonexistent-id', { headers: { cookie: adminCookie } }),
    )
    expect(res.status).toBe(404)
  })

  test('returns 404 for soft-deleted ticket', async () => {
    await prisma.ticket.update({ where: { id: ticketId }, data: { deletedAt: new Date() } })
    const res = await app.handle(
      new Request(`http://localhost/api/tickets/${ticketId}`, { headers: { cookie: adminCookie } }),
    )
    expect(res.status).toBe(404)
    await prisma.ticket.update({ where: { id: ticketId }, data: { deletedAt: null } })
  })
})

describe('PATCH /api/tickets/:id — status transitions', () => {
  let ticketId: string

  beforeEach(async () => {
    const res = await createTicket(adminCookie, { title: 'Transition Test' })
    ticketId = (await res.json()).ticket.id
  })

  async function patch(cookie: string, data: Record<string, unknown>) {
    return app.handle(
      new Request(`http://localhost/api/tickets/${ticketId}`, {
        method: 'PATCH',
        headers: { cookie, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }),
    )
  }

  test('ADMIN: OPEN → IN_PROGRESS (allowed)', async () => {
    const res = await patch(adminCookie, { status: 'IN_PROGRESS' })
    expect(res.status).toBe(200)
    expect((await res.json()).ticket.status).toBe('IN_PROGRESS')
  })

  test('QC: OPEN → CLOSED (allowed)', async () => {
    const res = await patch(qcCookie, { status: 'CLOSED' })
    expect(res.status).toBe(200)
    expect((await res.json()).ticket.status).toBe('CLOSED')
  })

  test('QC: OPEN → IN_PROGRESS (forbidden — admin only)', async () => {
    const res = await patch(qcCookie, { status: 'IN_PROGRESS' })
    expect(res.status).toBe(400)
  })

  test('ADMIN: OPEN → CLOSED (forbidden — qc only)', async () => {
    const res = await patch(adminCookie, { status: 'CLOSED' })
    expect(res.status).toBe(400)
  })

  test('CLOSED → REOPENED sets closedAt to null', async () => {
    await patch(qcCookie, { status: 'CLOSED' })
    const res = await patch(qcCookie, { status: 'REOPENED' })
    expect(res.status).toBe(200)
    const ticket = (await res.json()).ticket
    expect(ticket.status).toBe('REOPENED')
    expect(ticket.closedAt).toBeNull()
  })

  test('CLOSED sets closedAt timestamp', async () => {
    const res = await patch(qcCookie, { status: 'CLOSED' })
    expect(res.status).toBe(200)
    const ticket = (await res.json()).ticket
    expect(ticket.closedAt).not.toBeNull()
  })

  test('full flow: OPEN → IN_PROGRESS → READY_FOR_QC → CLOSED', async () => {
    await patch(adminCookie, { status: 'IN_PROGRESS' })
    await patch(adminCookie, { status: 'READY_FOR_QC' })
    const res = await patch(qcCookie, { status: 'CLOSED' })
    expect(res.status).toBe(200)
    expect((await res.json()).ticket.status).toBe('CLOSED')
  })

  test('SUPER_ADMIN has combined QC+ADMIN transitions', async () => {
    const res1 = await patch(saCookie, { status: 'IN_PROGRESS' })
    expect(res1.status).toBe(200)
    const res2 = await patch(saCookie, { status: 'CLOSED' })
    expect(res2.status).toBe(200)
  })
})
