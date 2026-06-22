import { test, expect, describe } from 'bun:test'
import { parsePagination } from '../../src/lib/pagination'

describe('parsePagination', () => {
  test('returns defaults when no query params', () => {
    const result = parsePagination({})
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  test('parses limit from query', () => {
    expect(parsePagination({ limit: '20' }).limit).toBe(20)
  })

  test('caps limit at maxLimit', () => {
    expect(parsePagination({ limit: '999' }).limit).toBe(200)
    expect(parsePagination({ limit: '999' }, 50, 100).limit).toBe(100)
  })

  test('uses custom defaultLimit', () => {
    expect(parsePagination({}, 25).limit).toBe(25)
  })

  test('parses offset', () => {
    expect(parsePagination({ offset: '50' }).offset).toBe(50)
  })

  test('offset defaults to 0', () => {
    expect(parsePagination({ limit: '10' }).offset).toBe(0)
  })

  test('handles non-numeric values gracefully', () => {
    const result = parsePagination({ limit: 'abc', offset: 'xyz' })
    expect(result.limit).toBe(50)
    expect(result.offset).toBe(0)
  })

  test('handles negative limit — uses default', () => {
    // Math.min(NaN-like) → falls back to default
    const result = parsePagination({ limit: '-10' })
    expect(result.limit).toBeGreaterThan(0)
  })
})
