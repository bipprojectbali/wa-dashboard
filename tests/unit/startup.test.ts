import { test, expect, describe } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Guard anti-drift untuk boot task. Bug nyata: WAV supervisor cuma dipanggil di
// src/index.tsx (entry dev), bukan di src/server.prod.ts (binary produksi) — jadi
// poller verifikasi tak pernah boot di STG/prod, request WAV PENDING selamanya.
// Test ini memastikan KEDUA entry mem-boot lewat sumber tunggal runStartupTasks().

const ROOT = join(import.meta.dir, '..', '..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('startup boot tasks', () => {
  test('runStartupTasks boots WAV supervisor + sweep + audit cleanup', () => {
    const src = read('src/lib/startup.ts')
    expect(src).toContain('startWaVerifySupervisor()')
    expect(src).toContain('sweepWaVerify()')
    expect(src).toContain('cleanupAuditLogs()')
  })

  test('dev entry (index.tsx) calls runStartupTasks', () => {
    const src = read('src/index.tsx')
    expect(src).toContain('runStartupTasks')
    expect(src).toMatch(/runStartupTasks\(\)/)
  })

  test('production entry (server.prod.ts) calls runStartupTasks', () => {
    const src = read('src/server.prod.ts')
    expect(src).toContain('runStartupTasks')
    expect(src).toMatch(/runStartupTasks\(\)/)
  })

  test('runStartupTasks is exported and callable', async () => {
    const mod = await import('../../src/lib/startup')
    expect(typeof mod.runStartupTasks).toBe('function')
  })
})
