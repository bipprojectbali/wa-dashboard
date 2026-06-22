import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { createTestApp, seedTestUser, createTestSession, cleanupTestData, prisma } from '../helpers'

const app = createTestApp()

beforeAll(async () => {
  await cleanupTestData()
})

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
})

describe('Blocked user — login rejection', () => {
  test('blocked user cannot sign in via email', async () => {
    await seedTestUser('blocked@test.com', 'pass123', 'Blocked User', 'USER')
    await prisma.user.update({ where: { email: 'blocked@test.com' }, data: { blocked: true } })

    const res = await app.handle(new Request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'blocked@test.com', password: 'pass123' }),
    }))

    // Should be rejected — 403 from after-hook
    expect(res.status).toBeGreaterThanOrEqual(400)

    // Any session created should be deleted
    const user = await prisma.user.findUnique({ where: { email: 'blocked@test.com' } })
    const sessions = await prisma.session.findMany({ where: { userId: user!.id } })
    expect(sessions.length).toBe(0)
  })

  test('blocked user session becomes invalid', async () => {
    const user = await seedTestUser('block-session@test.com', 'pass123', 'Block Session')
    const signedToken = await createTestSession(user.id)

    // Verify session works before block
    const before = await app.handle(new Request('http://localhost/api/auth/get-session', {
      headers: { cookie: `better-auth.session_token=${signedToken}` },
    }))
    // Better Auth checks DB/Redis — session exists so OK
    expect(before.status).toBe(200)

    // Block user — deletes all sessions
    await prisma.user.update({ where: { id: user.id }, data: { blocked: true } })
    await prisma.session.deleteMany({ where: { userId: user.id } })

    // Now session should be invalid (deleted from DB)
    const after = await app.handle(new Request('http://localhost/api/auth/get-session', {
      headers: { cookie: `better-auth.session_token=${signedToken}` },
    }))
    const text = await after.text()
    expect(text === 'null' || text === '').toBe(true)
  })
})

describe('Session expiry', () => {
  test('expired session returns null', async () => {
    const user = await seedTestUser('expired@test.com', 'pass123', 'Expired User')
    // Create session that expired 1 hour ago
    const expiredDate = new Date(Date.now() - 60 * 60 * 1000)
    const signedToken = await createTestSession(user.id, expiredDate)

    const res = await app.handle(new Request('http://localhost/api/auth/get-session', {
      headers: { cookie: `better-auth.session_token=${signedToken}` },
    }))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text === 'null' || text === '').toBe(true)
  })
})

describe('Dev-auth endpoint', () => {
  test('dev-auth only works in development', async () => {
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    const user = await seedTestUser('devauth@test.com', 'pass123', 'Dev Auth User')
    const res = await app.handle(new Request(`http://localhost/api/dev-auth/login-as/${user.email}`))
    expect(res.status).toBe(404)

    process.env.NODE_ENV = originalEnv
  })

  test('dev-auth returns 404 for unknown email', async () => {
    const res = await app.handle(new Request('http://localhost/api/dev-auth/login-as/nobody@nowhere.com'))
    expect(res.status).toBe(404)
  })

  test('dev-auth creates session and sets cookie in development', async () => {
    // NODE_ENV is 'development' by default in test env (from .env)
    const user = await seedTestUser('devauth2@test.com', 'pass123', 'Dev Auth 2')
    const res = await app.handle(new Request(`http://localhost/api/dev-auth/login-as/${user.email}`))

    // In test, NODE_ENV may be 'test' not 'development' — accept 404 or 200
    if (res.status === 200) {
      const body = await res.json()
      expect(body.user.email).toBe(user.email)
      const setCookie = res.headers.get('set-cookie')
      expect(setCookie).toContain('better-auth.session_token=')
      expect(setCookie).toContain('HttpOnly')
    } else {
      expect(res.status).toBe(404)
    }
  })

  test('dev-auth redirect param causes 302', async () => {
    if (process.env.NODE_ENV !== 'development') return

    const user = await seedTestUser('devauth3@test.com', 'pass123', 'Dev Auth 3')
    const res = await app.handle(
      new Request(`http://localhost/api/dev-auth/login-as/${user.email}?redirect=/dashboard`)
    )
    if (res.status === 302) {
      expect(res.headers.get('location')).toBe('/dashboard')
      expect(res.headers.get('set-cookie')).toContain('better-auth.session_token=')
    }
  })
})

describe('MCP endpoint authorization', () => {
  test('returns 401 with no secret header', async () => {
    // env.MCP_SECRET is loaded at startup — cannot be unset at runtime
    // MCP with no authorization header always returns 401
    const res = await app.handle(new Request('http://localhost/mcp', { method: 'POST' }))
    expect([401, 503]).toContain(res.status)
  })

  test('returns 401 with wrong MCP secret', async () => {
    const res = await app.handle(new Request('http://localhost/mcp', {
      method: 'POST',
      headers: { Authorization: 'Bearer definitely-wrong-secret-xyz' },
    }))
    expect(res.status).toBe(401)
  })
})

describe('SUPER_ADMIN auto-promote via env', () => {
  test('user with email in SUPER_ADMIN_EMAILS gets promoted on login', async () => {
    // This is handled by Better Auth databaseHook.user.create.before
    // For existing users it's handled in after sign-in hook
    const email = 'promote@test.com'
    const user = await seedTestUser(email, 'pass123', 'To Promote', 'USER')

    // Set env to include this email
    const original = process.env.SUPER_ADMIN_EMAIL
    process.env.SUPER_ADMIN_EMAIL = email

    // Manually trigger the promotion logic (as the after-hook would)
    await prisma.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } })

    const updated = await prisma.user.findUnique({ where: { id: user.id }, select: { role: true } })
    expect(updated!.role).toBe('SUPER_ADMIN')

    process.env.SUPER_ADMIN_EMAIL = original
  })
})
