import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { createTestApp, seedTestUser, createTestSession, cleanupTestData, prisma } from '../helpers'

const app = createTestApp()

let testUserId: string

beforeAll(async () => {
  await cleanupTestData()
  const user = await seedTestUser('logout-test@example.com', 'pass123', 'Logout Tester')
  testUserId = user.id
})

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
})

describe('POST /api/auth/sign-out', () => {
  test('sign-out deletes session from database', async () => {
    const signedToken = await createTestSession(testUserId)
    // Plain token is the part before the first dot-separated signature
    const plainToken = signedToken.split('.')[0]

    let session = await prisma.session.findFirst({ where: { userId: testUserId } })
    expect(session).not.toBeNull()

    const res = await app.handle(new Request('http://localhost/api/auth/sign-out', {
      method: 'POST',
      headers: { cookie: `better-auth.session_token=${signedToken}` },
    }))

    expect(res.status).toBe(200)

    // Session should be deleted by Better Auth
    session = await prisma.session.findUnique({ where: { token: plainToken } })
    expect(session).toBeNull()
  })

  test('sign-out without cookie returns ok', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/sign-out', {
      method: 'POST',
    }))

    expect(res.status).toBe(200)
  })

  test('session is invalid after sign-out', async () => {
    const token = await createTestSession(testUserId)

    await app.handle(new Request('http://localhost/api/auth/sign-out', {
      method: 'POST',
      headers: { cookie: `better-auth.session_token=${token}` },
    }))

    const sessionRes = await app.handle(new Request('http://localhost/api/auth/get-session', {
      headers: { cookie: `better-auth.session_token=${token}` },
    }))

    expect(sessionRes.status).toBe(200)
    const text = await sessionRes.text()
    // Better Auth returns null body or empty when session is gone
    expect(text === 'null' || text === '' || (JSON.parse(text || 'null') === null)).toBe(true)
  })
})
