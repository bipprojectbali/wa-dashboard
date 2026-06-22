import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { createTestApp, seedTestUser, createTestSession, cleanupTestData, prisma } from '../helpers'

const app = createTestApp()

let superAdminId: string
let adminId: string
let userId: string
let superAdminCookie: string
let adminCookie: string
let userCookie: string

beforeAll(async () => {
  await cleanupTestData()
  const sa = await seedTestUser('sa@test.com', 'pass123', 'Super Admin', 'SUPER_ADMIN')
  const adm = await seedTestUser('adm@test.com', 'pass123', 'Admin User', 'ADMIN')
  const usr = await seedTestUser('usr@test.com', 'pass123', 'Regular User', 'USER')
  superAdminId = sa.id
  adminId = adm.id
  userId = usr.id
  superAdminCookie = `better-auth.session_token=${await createTestSession(superAdminId)}`
  adminCookie = `better-auth.session_token=${await createTestSession(adminId)}`
  userCookie = `better-auth.session_token=${await createTestSession(userId)}`
})

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
})

describe('GET /api/admin/users', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/users'))
    expect(res.status).toBe(401)
  })

  test('returns 403 for non-SUPER_ADMIN', async () => {
    for (const cookie of [adminCookie, userCookie]) {
      const res = await app.handle(new Request('http://localhost/api/admin/users', {
        headers: { cookie },
      }))
      expect(res.status).toBe(403)
    }
  })

  test('returns user list for SUPER_ADMIN', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/users', {
      headers: { cookie: superAdminCookie },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.users)).toBe(true)
    expect(body.users.length).toBeGreaterThanOrEqual(3)
    // should not expose password
    expect(body.users[0].password).toBeUndefined()
    // should include required fields
    const fields = ['id', 'name', 'email', 'role', 'blocked', 'createdAt']
    for (const f of fields) expect(body.users[0][f]).toBeDefined()
  })
})

describe('PUT /api/admin/users/:id/role', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request(`http://localhost/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ADMIN' }),
    }))
    expect(res.status).toBe(401)
  })

  test('returns 403 for non-SUPER_ADMIN', async () => {
    const res = await app.handle(new Request(`http://localhost/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ADMIN' }),
    }))
    expect(res.status).toBe(403)
  })

  test('successfully changes USER to ADMIN', async () => {
    const res = await app.handle(new Request(`http://localhost/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ADMIN' }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.role).toBe('ADMIN')

    // Verify in DB
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
    expect(dbUser!.role).toBe('ADMIN')

    // Restore
    await prisma.user.update({ where: { id: userId }, data: { role: 'USER' } })
  })

  test('rejects invalid roles', async () => {
    const res = await app.handle(new Request(`http://localhost/api/admin/users/${userId}/role`, {
      method: 'PUT',
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'SUPER_ADMIN' }),
    }))
    // 422 = Elysia body schema validation (SUPER_ADMIN not in union), 400 = app logic
    expect([400, 422]).toContain(res.status)
  })

  test('cannot change own role', async () => {
    const res = await app.handle(new Request(`http://localhost/api/admin/users/${superAdminId}/role`, {
      method: 'PUT',
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ADMIN' }),
    }))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('sendiri')
  })

  test('cannot change role of another SUPER_ADMIN', async () => {
    const sa2 = await seedTestUser('sa2@test.com', 'pass123', 'SA2', 'SUPER_ADMIN')
    const res = await app.handle(new Request(`http://localhost/api/admin/users/${sa2.id}/role`, {
      method: 'PUT',
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'ADMIN' }),
    }))
    expect(res.status).toBe(400)
    await prisma.user.delete({ where: { id: sa2.id } })
  })
})

describe('PUT /api/admin/users/:id/block', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request(`http://localhost/api/admin/users/${userId}/block`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: true }),
    }))
    expect(res.status).toBe(401)
  })

  test('returns 403 for non-SUPER_ADMIN', async () => {
    const res = await app.handle(new Request(`http://localhost/api/admin/users/${userId}/block`, {
      method: 'PUT',
      headers: { cookie: adminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: true }),
    }))
    expect(res.status).toBe(403)
  })

  test('blocks user and deletes their sessions atomically', async () => {
    // Create extra sessions for the user
    await createTestSession(userId)
    await createTestSession(userId)
    const sessionsBefore = await prisma.session.count({ where: { userId } })
    expect(sessionsBefore).toBeGreaterThanOrEqual(2)

    const res = await app.handle(new Request(`http://localhost/api/admin/users/${userId}/block`, {
      method: 'PUT',
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: true }),
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.blocked).toBe(true)

    // All sessions deleted
    const sessionsAfter = await prisma.session.count({ where: { userId } })
    expect(sessionsAfter).toBe(0)

    // DB reflects blocked status
    const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { blocked: true } })
    expect(dbUser!.blocked).toBe(true)

    // Unblock
    await prisma.user.update({ where: { id: userId }, data: { blocked: false } })
    userCookie = `better-auth.session_token=${await createTestSession(userId)}`
  })

  test('unblocking does not delete sessions', async () => {
    // Block first
    await prisma.user.update({ where: { id: userId }, data: { blocked: true } })
    await prisma.session.deleteMany({ where: { userId } })
    const sess = await createTestSession(userId)

    const res = await app.handle(new Request(`http://localhost/api/admin/users/${userId}/block`, {
      method: 'PUT',
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: false }),
    }))
    expect(res.status).toBe(200)

    // Session should still exist (not deleted on unblock)
    const token = sess.split('.')[0]
    const session = await prisma.session.findUnique({ where: { token } })
    expect(session).not.toBeNull()

    await prisma.user.update({ where: { id: userId }, data: { blocked: false } })
    userCookie = `better-auth.session_token=${sess}`
  })

  test('cannot block self', async () => {
    const res = await app.handle(new Request(`http://localhost/api/admin/users/${superAdminId}/block`, {
      method: 'PUT',
      headers: { cookie: superAdminCookie, 'Content-Type': 'application/json' },
      body: JSON.stringify({ blocked: true }),
    }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('sendiri')
  })
})
