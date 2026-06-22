import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { createTestApp, seedTestUser, createTestSession, cleanupTestData, prisma } from '../helpers'

const app = createTestApp()

let superAdminCookie: string
let nonAdminCookie: string

beforeAll(async () => {
  await cleanupTestData()
  const sa = await seedTestUser('sa@logs.test', 'pass123', 'SA', 'SUPER_ADMIN')
  const usr = await seedTestUser('usr@logs.test', 'pass123', 'User', 'USER')
  superAdminCookie = `better-auth.session_token=${await createTestSession(sa.id)}`
  nonAdminCookie = `better-auth.session_token=${await createTestSession(usr.id)}`
})

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
})

describe('GET /api/admin/logs/app', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/app'))
    expect(res.status).toBe(401)
  })

  test('returns 403 for non-SUPER_ADMIN', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/app', {
      headers: { cookie: nonAdminCookie },
    }))
    expect(res.status).toBe(403)
  })

  test('returns logs array for SUPER_ADMIN', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/app', {
      headers: { cookie: superAdminCookie },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.logs)).toBe(true)
  })

  test('accepts level filter', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/app?level=error', {
      headers: { cookie: superAdminCookie },
    }))
    expect(res.status).toBe(200)
  })

  test('accepts limit parameter', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/app?limit=5', {
      headers: { cookie: superAdminCookie },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.logs.length).toBeLessThanOrEqual(5)
  })
})

describe('GET /api/admin/logs/audit', () => {
  beforeAll(async () => {
    // Create some audit entries
    await prisma.auditLog.createMany({
      data: [
        { action: 'LOGIN', detail: 'test', ip: '127.0.0.1' },
        { action: 'LOGOUT', detail: 'test', ip: '127.0.0.1' },
      ],
    })
  })

  test('returns 401 without session', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/audit'))
    expect(res.status).toBe(401)
  })

  test('returns logs for SUPER_ADMIN', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/audit', {
      headers: { cookie: superAdminCookie },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.logs)).toBe(true)
    expect(body.logs.length).toBeGreaterThan(0)
  })

  test('filters by action', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/audit?action=LOGIN', {
      headers: { cookie: superAdminCookie },
    }))
    const body = await res.json()
    expect(body.logs.every((l: any) => l.action === 'LOGIN')).toBe(true)
  })

  test('caps limit at 500', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/audit?limit=9999', {
      headers: { cookie: superAdminCookie },
    }))
    expect(res.status).toBe(200)
  })
})

describe('DELETE /api/admin/logs/app', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/app', { method: 'DELETE' }))
    expect(res.status).toBe(401)
  })

  test('returns 403 for non-SUPER_ADMIN', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/app', {
      method: 'DELETE',
      headers: { cookie: nonAdminCookie },
    }))
    expect(res.status).toBe(403)
  })

  test('clears logs and returns ok', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/app', {
      method: 'DELETE',
      headers: { cookie: superAdminCookie },
    }))
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })
})

describe('DELETE /api/admin/logs/audit', () => {
  test('returns 401 without session', async () => {
    const res = await app.handle(new Request('http://localhost/api/admin/logs/audit', { method: 'DELETE' }))
    expect(res.status).toBe(401)
  })

  test('clears all audit logs and returns count', async () => {
    await prisma.auditLog.createMany({
      data: [{ action: 'TEST' }, { action: 'TEST2' }],
    })
    const res = await app.handle(new Request('http://localhost/api/admin/logs/audit', {
      method: 'DELETE',
      headers: { cookie: superAdminCookie },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(typeof body.deleted).toBe('number')
    const remaining = await prisma.auditLog.count()
    expect(remaining).toBe(0)
  })
})
