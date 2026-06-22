import { test, expect, describe } from 'bun:test'
import { createTestApp } from '../helpers'

const app = createTestApp()

describe('Example API routes', () => {
  test('GET /api/hello returns message', async () => {
    const res = await app.handle(new Request('http://localhost/api/hello'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ message: 'Hello, world!', method: 'GET' })
  })

  test('PUT /api/hello returns message', async () => {
    const res = await app.handle(new Request('http://localhost/api/hello', { method: 'PUT' }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ message: 'Hello, world!', method: 'PUT' })
  })

  test('GET /api/hello/:name returns personalized message', async () => {
    const res = await app.handle(new Request('http://localhost/api/hello/Bun'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ message: 'Hello, Bun!' })
  })
})
