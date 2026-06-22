import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { createTestApp, seedTestUser, createTestSession, prisma } from '../helpers'

const app = createTestApp()
const EMAIL_SUFFIX = '@attach.test'

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

describe('POST /api/tickets/:id/comments', () => {
  let ticketId: string

  beforeAll(async () => {
    const res = await createTicket(adminCookie, { title: 'Comment Test' })
    ticketId = (await res.json()).ticket.id
  })

  test('returns 401 without session', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Hi' }),
      }),
    )
    expect(res.status).toBe(401)
  })

  test('returns 403 for USER role', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { cookie: userCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Hi' }),
      }),
    )
    expect(res.status).toBe(403)
  })

  test('creates comment with correct authorTag', async () => {
    const cases = [
      { cookie: qcCookie, expectedTag: 'QC' },
      { cookie: adminCookie, expectedTag: 'ADMIN' },
      { cookie: saCookie, expectedTag: 'SUPER_ADMIN' },
    ]
    for (const { cookie, expectedTag } of cases) {
      const res = await app.handle(
        new Request(`http://localhost/api/tickets/${ticketId}/comments`, {
          method: 'POST',
          headers: { cookie, 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: `Comment from ${expectedTag}` }),
        }),
      )
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.comment.authorTag).toBe(expectedTag)
    }
  })

  test('rejects empty comment body', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/tickets/${ticketId}/comments`, {
        method: 'POST',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: '   ' }),
      }),
    )
    expect(res.status).toBe(400)
  })

  test('returns 404 for non-existent ticket', async () => {
    const res = await app.handle(
      new Request('http://localhost/api/tickets/nonexistent/comments', {
        method: 'POST',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Hi' }),
      }),
    )
    expect(res.status).toBe(404)
  })
})

describe('POST /api/tickets/:id/evidence', () => {
  let ticketId: string

  beforeAll(async () => {
    const res = await createTicket(adminCookie, { title: 'Evidence Test' })
    ticketId = (await res.json()).ticket.id
  })

  test('attaches evidence with kind and url', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/tickets/${ticketId}/evidence`, {
        method: 'POST',
        headers: { cookie: qcCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'screenshot', url: '/screenshots/bug.png', note: 'visible bug' }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.evidence.kind).toBe('screenshot')
    expect(body.evidence.url).toBe('/screenshots/bug.png')
    expect(body.evidence.note).toBe('visible bug')
  })

  test('requires kind and url', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/tickets/${ticketId}/evidence`, {
        method: 'POST',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'screenshot' }),
      }),
    )
    expect([400, 422]).toContain(res.status)
  })

  test('note is optional', async () => {
    const res = await app.handle(
      new Request(`http://localhost/api/tickets/${ticketId}/evidence`, {
        method: 'POST',
        headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'commit', url: 'abc123' }),
      }),
    )
    expect(res.status).toBe(200)
    expect((await res.json()).evidence.note).toBeNull()
  })
})
