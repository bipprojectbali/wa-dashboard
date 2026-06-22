import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { createTestApp, seedTestUser, createTestSession, cleanupTestData, prisma } from '../helpers'

const app = createTestApp()

let testUserId: string

beforeAll(async () => {
  await cleanupTestData()
  const user = await seedTestUser('session-test@example.com', 'pass123', 'Session Tester')
  testUserId = user.id
})

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
})

describe('GET /api/auth/get-session', () => {
  test('returns null when no cookie', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/get-session'))
    expect(res.status).toBe(200)
    const body = await res.text()
    // Better Auth returns literal null or empty when no session
    expect(body === 'null' || body === '' || body === '{}').toBe(true)
  })

  test('returns user with valid signed session cookie', async () => {
    const signedToken = await createTestSession(testUserId)
    const res = await app.handle(new Request('http://localhost/api/auth/get-session', {
      headers: { cookie: `better-auth.session_token=${signedToken}` },
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).not.toBeNull()
    expect(body.user).toBeDefined()
    expect(body.user.email).toBe('session-test@example.com')
    expect(body.user.name).toBe('Session Tester')
    expect(body.user.id).toBe(testUserId)
  })
})
