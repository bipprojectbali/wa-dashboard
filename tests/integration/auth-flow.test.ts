import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { createTestApp, seedTestUser, cleanupTestData, prisma } from '../helpers'

const app = createTestApp()

beforeAll(async () => {
  await cleanupTestData()
  await seedTestUser('flow@example.com', 'flow123', 'Flow User')
})

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
})

describe('Full auth flow: sign-in → session → sign-out → session', () => {
  test('complete auth lifecycle', async () => {
    // 1. Sign In
    const signInRes = await app.handle(new Request('http://localhost/api/auth/sign-in/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'flow@example.com', password: 'flow123' }),
    }))
    expect(signInRes.status).toBe(200)

    const signInBody = await signInRes.json()
    expect(signInBody.user.email).toBe('flow@example.com')

    // Extract Better Auth session cookie
    const setCookie = signInRes.headers.get('set-cookie') ?? ''
    const tokenMatch = setCookie.match(/better-auth\.session_token=([^;]+)/)
    const token = tokenMatch?.[1]
    expect(token).toBeDefined()

    // 2. Check session — should be valid
    const sessionRes = await app.handle(new Request('http://localhost/api/auth/get-session', {
      headers: { cookie: `better-auth.session_token=${token}` },
    }))
    expect(sessionRes.status).toBe(200)
    const sessionBody = await sessionRes.json()
    expect(sessionBody.user).toBeDefined()
    expect(sessionBody.user.email).toBe('flow@example.com')

    // 3. Sign Out
    const signOutRes = await app.handle(new Request('http://localhost/api/auth/sign-out', {
      method: 'POST',
      headers: { cookie: `better-auth.session_token=${token}` },
    }))
    expect(signOutRes.status).toBe(200)

    // 4. Check session again — should be null
    const afterSignOutRes = await app.handle(new Request('http://localhost/api/auth/get-session', {
      headers: { cookie: `better-auth.session_token=${token}` },
    }))
    expect(afterSignOutRes.status).toBe(200)
    const afterText = await afterSignOutRes.text()
    // Better Auth returns literal null body when session is gone
    expect(afterText === 'null' || afterText === '').toBe(true)
  })
})
