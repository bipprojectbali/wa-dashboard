import { test, expect, describe } from 'bun:test'
import { createTestApp } from '../helpers'

const app = createTestApp()

describe('GET /health', () => {
  test('returns 200 with status ok', async () => {
    const res = await app.handle(new Request('http://localhost/health'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok' })
  })
})
