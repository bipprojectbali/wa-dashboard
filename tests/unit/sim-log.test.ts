import { describe, expect, test } from 'bun:test'
import { appendLog, fmtDuration } from '../../src/frontend/lib/sim-log'
import type { SimLogEntry } from '../../src/frontend/components/sim/sim.types'

describe('appendLog', () => {
  test('appends in chronological order, returns a new array (immutable)', () => {
    const a: SimLogEntry[] = []
    const b = appendLog(a, 'start', { x: 1 }, 1000)
    const c = appendLog(b, 'poll', { y: 2 }, 2000)
    expect(a).toEqual([]) // original untouched
    expect(b.length).toBe(1)
    expect(c.length).toBe(2)
    expect(c[0]).toEqual({ at: 1000, label: 'start', data: { x: 1 } })
    expect(c[1]).toEqual({ at: 2000, label: 'poll', data: { y: 2 } })
  })

  test('data is optional', () => {
    const r = appendLog([], 'no-data', undefined, 5)
    expect(r[0]).toEqual({ at: 5, label: 'no-data', data: undefined })
  })
})

describe('fmtDuration', () => {
  test('milliseconds under 1s', () => {
    expect(fmtDuration(0)).toBe('0ms')
    expect(fmtDuration(820)).toBe('820ms')
  })

  test('seconds with one decimal under 1m', () => {
    expect(fmtDuration(3400)).toBe('3.4s')
    expect(fmtDuration(59_900)).toBe('59.9s')
  })

  test('minutes + seconds at/above 1m', () => {
    expect(fmtDuration(60_000)).toBe('1m 0s')
    expect(fmtDuration(65_000)).toBe('1m 5s')
    expect(fmtDuration(125_000)).toBe('2m 5s')
  })
})
