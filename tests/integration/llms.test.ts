import { describe, expect, it } from 'bun:test'
import { createTestApp } from '../helpers'

describe('GET /llms.txt', () => {
  const app = createTestApp()

  it('returns 200 with plain-text content type', async () => {
    const res = await app.handle(new Request('http://localhost/llms.txt'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type') ?? '').toContain('text/plain')
  })

  it('body contains the major sections and self-reference', async () => {
    const res = await app.handle(new Request('http://localhost/llms.txt'))
    const body = await res.text()
    expect(body).toContain('## API Routes')
    expect(body).toContain('## Database Schema')
    expect(body).toContain('/llms.txt')
  })
})
