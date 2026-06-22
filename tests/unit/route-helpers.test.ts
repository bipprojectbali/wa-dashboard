import { test, expect, describe } from 'bun:test'
import { guardSuperAdmin, guardQcOrAdmin, guardAuth, getIp, notDeleted, softDelete } from '../../src/lib/route-helpers'
import type { AuthUser } from '../../src/lib/auth-middleware'

const makeUser = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test',
  role: 'USER',
  blocked: false,
  ...overrides,
})

describe('guardSuperAdmin', () => {
  test('returns 401 when authUser is null', () => {
    const res = guardSuperAdmin(null)
    expect(res).not.toBeNull()
    expect(res!.status).toBe(401)
  })

  test('returns 403 when role is not SUPER_ADMIN', async () => {
    for (const role of ['USER', 'QC', 'ADMIN'] as const) {
      const res = guardSuperAdmin(makeUser({ role }))
      expect(res).not.toBeNull()
      expect(res!.status).toBe(403)
    }
  })

  test('returns 403 when blocked even if SUPER_ADMIN', () => {
    const res = guardSuperAdmin(makeUser({ role: 'SUPER_ADMIN', blocked: true }))
    expect(res).not.toBeNull()
    expect(res!.status).toBe(403)
  })

  test('returns null for valid SUPER_ADMIN', () => {
    expect(guardSuperAdmin(makeUser({ role: 'SUPER_ADMIN' }))).toBeNull()
  })

  test('response body is valid JSON', async () => {
    const res = guardSuperAdmin(null)
    const body = await res!.json()
    expect(body.error).toBeDefined()
  })
})

describe('guardQcOrAdmin', () => {
  test('returns 401 when authUser is null', () => {
    expect(guardQcOrAdmin(null)!.status).toBe(401)
  })

  test('returns 403 for USER role', () => {
    expect(guardQcOrAdmin(makeUser({ role: 'USER' }))!.status).toBe(403)
  })

  test('returns 403 when blocked', () => {
    for (const role of ['QC', 'ADMIN', 'SUPER_ADMIN'] as const) {
      expect(guardQcOrAdmin(makeUser({ role, blocked: true }))!.status).toBe(403)
    }
  })

  test('returns null for QC, ADMIN, SUPER_ADMIN', () => {
    for (const role of ['QC', 'ADMIN', 'SUPER_ADMIN'] as const) {
      expect(guardQcOrAdmin(makeUser({ role }))).toBeNull()
    }
  })
})

describe('guardAuth', () => {
  test('returns 401 when authUser is null', () => {
    expect(guardAuth(null)!.status).toBe(401)
  })

  test('returns 403 when blocked', () => {
    for (const role of ['USER', 'QC', 'ADMIN', 'SUPER_ADMIN'] as const) {
      expect(guardAuth(makeUser({ role, blocked: true }))!.status).toBe(403)
    }
  })

  test('returns null for any non-blocked user', () => {
    for (const role of ['USER', 'QC', 'ADMIN', 'SUPER_ADMIN'] as const) {
      expect(guardAuth(makeUser({ role }))).toBeNull()
    }
  })
})

describe('getIp', () => {
  test('extracts first IP from x-forwarded-for', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    })
    expect(getIp(req)).toBe('1.2.3.4')
  })

  test('falls back to x-real-ip', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-real-ip': '9.9.9.9' },
    })
    expect(getIp(req)).toBe('9.9.9.9')
  })

  test('returns "unknown" when no IP header', () => {
    const req = new Request('http://localhost/')
    expect(getIp(req)).toBe('unknown')
  })

  test('trims whitespace from forwarded-for', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '  1.1.1.1  , 2.2.2.2' },
    })
    expect(getIp(req)).toBe('1.1.1.1')
  })
})

describe('notDeleted + softDelete', () => {
  test('notDeleted is { deletedAt: null }', () => {
    expect(notDeleted).toEqual({ deletedAt: null })
  })

  test('softDelete returns deletedAt as Date', () => {
    const before = Date.now()
    const result = softDelete()
    const after = Date.now()
    expect(result.deletedAt).toBeInstanceOf(Date)
    expect(result.deletedAt.getTime()).toBeGreaterThanOrEqual(before)
    expect(result.deletedAt.getTime()).toBeLessThanOrEqual(after)
  })
})
