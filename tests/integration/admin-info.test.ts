import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { createTestApp, seedTestUser, createTestSession, cleanupTestData, prisma } from '../helpers'

const app = createTestApp()

let superAdminCookie: string
let nonAdminCookie: string

beforeAll(async () => {
  await cleanupTestData()
  const sa = await seedTestUser('sa@info.test', 'pass123', 'SA', 'SUPER_ADMIN')
  const usr = await seedTestUser('usr@info.test', 'pass123', 'User', 'USER')
  superAdminCookie = `better-auth.session_token=${await createTestSession(sa.id)}`
  nonAdminCookie = `better-auth.session_token=${await createTestSession(usr.id)}`
})

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
})

// Helper: authenticated GET
async function adminGet(path: string, cookie = superAdminCookie) {
  return app.handle(new Request(`http://localhost${path}`, { headers: { cookie } }))
}

describe('GET /api/admin/presence', () => {
  test('returns 401 without session', async () => {
    expect((await app.handle(new Request('http://localhost/api/admin/presence'))).status).toBe(401)
  })
  test('returns 403 for non-SUPER_ADMIN', async () => {
    expect((await adminGet('/api/admin/presence', nonAdminCookie)).status).toBe(403)
  })
  test('returns online array', async () => {
    const res = await adminGet('/api/admin/presence')
    expect(res.status).toBe(200)
    expect(Array.isArray((await res.json()).online)).toBe(true)
  })
})

describe('GET /api/admin/schema', () => {
  test('returns 401 without session', async () => {
    expect((await app.handle(new Request('http://localhost/api/admin/schema'))).status).toBe(401)
  })
  test('returns parsed schema with models and enums', async () => {
    const res = await adminGet('/api/admin/schema')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.schema.models)).toBe(true)
    expect(Array.isArray(body.schema.enums)).toBe(true)
    // Should contain known models
    const modelNames = body.schema.models.map((m: any) => m.name)
    expect(modelNames).toContain('User')
    expect(modelNames).toContain('Session')
    expect(modelNames).toContain('Ticket')
  })
})

describe('GET /api/admin/routes', () => {
  test('returns 401 without session', async () => {
    expect((await app.handle(new Request('http://localhost/api/admin/routes'))).status).toBe(401)
  })
  test('returns routes with summary stats', async () => {
    const res = await adminGet('/api/admin/routes')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.routes)).toBe(true)
    expect(body.summary.total).toBeGreaterThan(0)
    expect(typeof body.summary.byMethod).toBe('object')
    expect(typeof body.summary.byAuth).toBe('object')
    expect(typeof body.summary.byCategory).toBe('object')
  })
  test('routes include required fields', async () => {
    const res = await adminGet('/api/admin/routes')
    const body = await res.json()
    const r = body.routes[0]
    expect(r.method).toBeDefined()
    expect(r.path).toBeDefined()
    expect(r.auth).toBeDefined()
    expect(r.category).toBeDefined()
  })
})

describe('GET /api/admin/env-map', () => {
  test('returns 401 without session', async () => {
    expect((await app.handle(new Request('http://localhost/api/admin/env-map'))).status).toBe(401)
  })
  test('returns variables with isSet status', async () => {
    const res = await adminGet('/api/admin/env-map')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.variables)).toBe(true)
    expect(typeof body.summary.set).toBe('number')
    expect(typeof body.summary.unset).toBe('number')
    // DATABASE_URL should be set in test env
    const dbVar = body.variables.find((v: any) => v.name === 'DATABASE_URL')
    expect(dbVar).toBeDefined()
    expect(dbVar.isSet).toBe(true)
    expect(dbVar.required).toBe(true)
  })
})

describe('GET /api/admin/sessions', () => {
  test('returns 401 without session', async () => {
    expect((await app.handle(new Request('http://localhost/api/admin/sessions'))).status).toBe(401)
  })
  test('returns sessions with summary', async () => {
    const res = await adminGet('/api/admin/sessions')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.sessions)).toBe(true)
    expect(typeof body.summary.totalSessions).toBe('number')
    expect(typeof body.summary.activeSessions).toBe('number')
  })
  test('session entries have required fields', async () => {
    const res = await adminGet('/api/admin/sessions')
    const body = await res.json()
    if (body.sessions.length > 0) {
      const s = body.sessions[0]
      expect(s.id).toBeDefined()
      expect(s.userId).toBeDefined()
      expect(s.userEmail).toBeDefined()
      expect(s.userRole).toBeDefined()
      expect(typeof s.isExpired).toBe('boolean')
      expect(typeof s.isOnline).toBe('boolean')
    }
  })
})

describe('GET /api/admin/migrations', () => {
  test('returns 401 without session', async () => {
    expect((await app.handle(new Request('http://localhost/api/admin/migrations'))).status).toBe(401)
  })
  test('returns migration timeline', async () => {
    const res = await adminGet('/api/admin/migrations')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.migrations)).toBe(true)
    expect(typeof body.summary.totalMigrations).toBe('number')
    expect(body.migrations.length).toBeGreaterThan(0)
    // Each migration has required fields
    const m = body.migrations[0]
    expect(m.name).toBeDefined()
    expect(m.folder).toBeDefined()
    expect(m.createdAt).toBeDefined()
    expect(Array.isArray(m.changes)).toBe(true)
  })
})

describe('GET /api/admin/project-structure', () => {
  test('returns 401 without session', async () => {
    expect((await app.handle(new Request('http://localhost/api/admin/project-structure'))).status).toBe(401)
  })
  test('returns files with categorization', async () => {
    const res = await adminGet('/api/admin/project-structure')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.files)).toBe(true)
    expect(body.summary.totalFiles).toBeGreaterThan(0)
    expect(body.summary.totalLines).toBeGreaterThan(0)
    // Should find app.ts
    const appFile = body.files.find((f: any) => f.path === 'src/app.ts')
    expect(appFile).toBeDefined()
    expect(appFile.lines).toBeGreaterThan(0)
    expect(appFile.category).toBe('backend')
  })
})

describe('GET /api/admin/test-coverage', () => {
  test('returns 401 without session', async () => {
    expect((await app.handle(new Request('http://localhost/api/admin/test-coverage'))).status).toBe(401)
  })
  test('returns coverage report', async () => {
    const res = await adminGet('/api/admin/test-coverage')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.sourceFiles)).toBe(true)
    expect(Array.isArray(body.testFiles)).toBe(true)
    expect(typeof body.summary.coveragePercent).toBe('number')
    expect(body.summary.coveragePercent).toBeGreaterThanOrEqual(0)
    expect(body.summary.coveragePercent).toBeLessThanOrEqual(100)
  })
})

describe('GET /api/admin/dependencies', () => {
  test('returns 401 without session', async () => {
    expect((await app.handle(new Request('http://localhost/api/admin/dependencies'))).status).toBe(401)
  })
  test('returns package dependency graph', async () => {
    const res = await adminGet('/api/admin/dependencies')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.packages)).toBe(true)
    expect(body.summary.total).toBeGreaterThan(0)
    // better-auth should be in the list
    const ba = body.packages.find((p: any) => p.name === 'better-auth')
    expect(ba).toBeDefined()
    expect(ba.type).toBe('runtime')
  })
})

describe('GET /api/admin/file-health', () => {
  test('returns 401 without session', async () => {
    expect((await app.handle(new Request('http://localhost/api/admin/file-health'))).status).toBe(401)
  })
  test('returns 403 for non-SUPER_ADMIN', async () => {
    expect((await adminGet('/api/admin/file-health', nonAdminCookie)).status).toBe(403)
  })
  test('returns file health report with summary and worstOffenders', async () => {
    const res = await adminGet('/api/admin/file-health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.files)).toBe(true)
    expect(Array.isArray(body.worstOffenders)).toBe(true)
    expect(body.summary.totalFiles).toBeGreaterThan(0)
    expect(body.summary.totalLines).toBeGreaterThan(0)
    expect(body.summary.totalChars).toBeGreaterThan(0)
    expect(body.summary.hardLimitLines).toBe(500)
    expect(body.summary.hardLimitChars).toBe(20_000)
    expect(typeof body.summary.byStatus).toBe('object')
    expect(typeof body.summary.byCategory).toBe('object')
    // Each file must have the contract fields
    const f = body.files[0]
    expect(typeof f.path).toBe('string')
    expect(typeof f.category).toBe('string')
    expect(typeof f.lines).toBe('number')
    expect(typeof f.chars).toBe('number')
    expect(typeof f.limitLines).toBe('number')
    expect(typeof f.limitChars).toBe('number')
    expect(['ok', 'warn', 'critical', 'exempt']).toContain(f.status)
  })
  test('correctly classifies test files under tests/ as test category', async () => {
    const res = await adminGet('/api/admin/file-health')
    const body = await res.json()
    const testFile = body.files.find((f: any) => f.path === 'tests/integration/admin-info.test.ts')
    expect(testFile).toBeDefined()
    expect(testFile.category).toBe('test')
    expect(testFile.limitLines).toBe(400)
  })
  test('worstOffenders excludes exempt files', async () => {
    const res = await adminGet('/api/admin/file-health')
    const body = await res.json()
    for (const f of body.worstOffenders) {
      expect(f.exempt).toBe(false)
    }
  })
})

describe('GET /api/version', () => {
  test('returns name and version', async () => {
    const res = await app.handle(new Request('http://localhost/api/version'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(typeof body.name).toBe('string')
    expect(typeof body.version).toBe('string')
    expect(body.name.length).toBeGreaterThan(0)
    expect(body.version).toMatch(/^\d+\.\d+\.\d+/)
  })
})
