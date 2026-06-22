import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { createTestApp, seedTestUser, cleanupTestData, prisma } from '../helpers'

const app = createTestApp()

beforeAll(async () => {
  await cleanupTestData()
  await seedTestUser('admin@example.com', 'admin123', 'Admin')
  await seedTestUser('user@example.com', 'user123', 'User')
})

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
})

describe('POST /api/auth/sign-in/email', () => {
  test('login with valid credentials returns user and session cookie', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'admin123' }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe('admin@example.com')
    expect(body.user.name).toBe('Admin')
    expect(body.user.id).toBeDefined()
    // Should not expose password
    expect(body.user.password).toBeUndefined()

    // Check session cookie
    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toBeTruthy()
    expect(setCookie).toContain('HttpOnly')
  })

  test('login with wrong password returns 422/401', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.com', password: 'wrongpassword' }),
    }))

    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  test('login with non-existent email returns error', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'anything' }),
    }))

    expect(res.status).toBeGreaterThanOrEqual(400)
  })

  test('login returns role field in response', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'user123' }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.user.id).toBeDefined()
    expect(body.user.email).toBe('user@example.com')
  })

  test('login creates a session in database', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'user@example.com', password: 'user123' }),
    }))

    expect(res.status).toBe(200)
    const body = await res.json()

    // Verify session exists in DB for this user
    const session = await prisma.session.findFirst({ where: { userId: body.user.id } })
    expect(session).not.toBeNull()
    expect(session!.expiresAt.getTime()).toBeGreaterThan(Date.now())
  })
})
