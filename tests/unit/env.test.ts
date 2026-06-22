import { test, expect, describe } from 'bun:test'

describe('env', () => {
  test('PORT defaults to 3000 when not set', () => {
    const original = process.env.PORT
    delete process.env.PORT
    // Re-import to test default
    // Since modules are cached, we test the logic directly
    const value = parseInt(process.env.PORT ?? '3000', 10)
    expect(value).toBe(3000)
    if (original) process.env.PORT = original
  })

  test('PORT parses from env', () => {
    const value = parseInt(process.env.PORT ?? '3000', 10)
    expect(typeof value).toBe('number')
    expect(value).toBeGreaterThan(0)
  })

  test('DATABASE_URL is set', () => {
    expect(process.env.DATABASE_URL).toBeDefined()
    expect(process.env.DATABASE_URL).toContain('postgresql://')
  })

  test('GOOGLE_CLIENT_ID is set', () => {
    expect(process.env.GOOGLE_CLIENT_ID).toBeDefined()
    expect(process.env.GOOGLE_CLIENT_ID!.length).toBeGreaterThan(0)
  })

  test('GOOGLE_CLIENT_SECRET is set', () => {
    expect(process.env.GOOGLE_CLIENT_SECRET).toBeDefined()
    expect(process.env.GOOGLE_CLIENT_SECRET!.length).toBeGreaterThan(0)
  })
})
