import { test, expect, describe } from 'bun:test'
import { mcpCallBody, unwrapMcpEnvelope } from '../../scripts/mcp/tools/stg-fetch'

// Helper untuk debug-stg memanggil MCP tool lewat JSON-RPC standar (tools/call).
// Protokol lama `{tool, input}` ditolak server /mcp dengan 400 — test ini mengunci
// format baru + unwrapping envelope agar drift protokol tak terulang diam-diam.

describe('mcpCallBody', () => {
  test('membentuk JSON-RPC tools/call yang benar', () => {
    const body = JSON.parse(mcpCallBody('wa_verify_inbound', { limit: 20 }))
    expect(body.jsonrpc).toBe('2.0')
    expect(body.method).toBe('tools/call')
    expect(body.params.name).toBe('wa_verify_inbound')
    expect(body.params.arguments).toEqual({ limit: 20 })
  })

  test('default arguments kosong', () => {
    const body = JSON.parse(mcpCallBody('health_full'))
    expect(body.params.arguments).toEqual({})
  })
})

describe('unwrapMcpEnvelope', () => {
  test('unwrap + parse blok teks JSON dari result.content', () => {
    const r = unwrapMcpEnvelope({
      status: 200,
      ok: true,
      data: { result: { content: [{ type: 'text', text: '{"running":true,"sessionId":"abc"}' }] } },
    })
    expect(r.ok).toBe(true)
    expect(r.data).toEqual({ running: true, sessionId: 'abc' })
  })

  test('teks non-JSON diteruskan apa adanya', () => {
    const r = unwrapMcpEnvelope({
      status: 200,
      ok: true,
      data: { result: { content: [{ type: 'text', text: 'ENOENT: no such file' }] } },
    })
    expect(r.ok).toBe(true)
    expect(r.data).toBe('ENOENT: no such file')
  })

  test('error JSON-RPC level-protokol → ok:false', () => {
    const r = unwrapMcpEnvelope({
      status: 200,
      ok: true,
      data: { error: { message: 'Method not found' } },
    })
    expect(r.ok).toBe(false)
    expect(r.data).toBe('Method not found')
  })

  test('error level-tool (isError) → ok:false dengan pesan', () => {
    const r = unwrapMcpEnvelope({
      status: 200,
      ok: true,
      data: { result: { isError: true, content: [{ type: 'text', text: 'tool blew up' }] } },
    })
    expect(r.ok).toBe(false)
    expect(r.data).toBe('tool blew up')
  })

  test('HTTP gagal diteruskan tanpa diubah', () => {
    const r = unwrapMcpEnvelope({ status: 401, ok: false, data: { error: 'Unauthorized' } })
    expect(r.ok).toBe(false)
    expect(r.status).toBe(401)
  })

  test('envelope tanpa content → ok:false', () => {
    const r = unwrapMcpEnvelope({ status: 200, ok: true, data: { result: {} } })
    expect(r.ok).toBe(false)
    expect(r.data).toBe('empty MCP response')
  })
})
