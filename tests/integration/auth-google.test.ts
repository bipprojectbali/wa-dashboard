import { test, expect, describe, afterAll } from 'bun:test'
import { createTestApp, cleanupTestData, prisma } from '../helpers'

const app = createTestApp()

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
})

describe('Google OAuth endpoints', () => {
  test('GET /api/auth/sign-in/social redirects to Google', async () => {
    // Better Auth social sign-in needs a POST with provider in body, or GET with query params
    const res = await app.handle(
      new Request('http://localhost/api/auth/sign-in/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: 'google', callbackURL: 'http://localhost:3111/' }),
      }),
    )

    // Better Auth returns 302 redirect to Google or 200 with redirect URL
    expect([200, 302]).toContain(res.status)
    if (res.status === 302) {
      const location = res.headers.get('location')
      expect(location).toContain('accounts.google.com')
    } else {
      const body = await res.json()
      expect(body.url ?? body.redirect).toBeTruthy()
    }
  })

  test('GET /api/auth/callback/google redirects with error when no code', async () => {
    const res = await app.handle(new Request('http://localhost/api/auth/callback/google'))
    expect([302, 400, 422]).toContain(res.status)
  })
})
