import { errText, jsonText } from './shared'

export const BASE_URL = process.env.BASE_URL?.replace(/\/$/, '') ?? ''
export const MCP_SECRET = process.env.MCP_SECRET ?? ''

export function stgHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    // MCP Streamable HTTP transport (POST /mcp) menolak request tanpa Accept ini
    // dengan 406. Aman untuk endpoint REST lain (Accept tambahan diabaikan di sana).
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${MCP_SECRET}`,
  }
}

export async function stgFetch(path: string, init?: RequestInit) {
  if (!BASE_URL) throw new Error('BASE_URL env not set for debug-stg')
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    ...init,
    headers: { ...stgHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  })
  const body = await res.text()
  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    data = body
  }
  return { status: res.status, ok: res.ok, data }
}

export function stgResult(r: { status: number; ok: boolean; data: unknown }) {
  if (!r.ok) {
    return errText(`STG ${r.status}: ${JSON.stringify(r.data)}`)
  }
  return jsonText(r.data)
}

export type FetchResult = { status: number; ok: boolean; data: unknown }

// Body JSON-RPC standar untuk memanggil satu MCP tool (tools/call). Server /mcp
// (dev & prod) memakai MCP Streamable HTTP — protokol lama `{tool, input}` ditolak
// dengan 400.
export function mcpCallBody(tool: string, input: Record<string, unknown> = {}): string {
  return JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: tool, arguments: input } })
}

// Unwrap envelope respons JSON-RPC menjadi bentuk { status, ok, data } seragam.
// Tiap tool membalas satu blok teks JSON via jsonText → diparse di sini. Dipakai
// untuk respons STG maupun local agar kedua sisi konsisten.
export function unwrapMcpEnvelope(r: FetchResult): FetchResult {
  if (!r.ok) return r
  const envelope = r.data as {
    error?: { message?: string }
    result?: { isError?: boolean; content?: { type: string; text?: string }[] }
  }
  // Error level-protokol JSON-RPC (mis. tool tak dikenal).
  if (envelope?.error) return { status: 502, ok: false, data: envelope.error.message ?? envelope.error }
  const result = envelope?.result
  // Error level-tool (handler melempar → isError + teks pesan).
  if (result?.isError) {
    return { status: 502, ok: false, data: result.content?.find((c) => c.type === 'text')?.text ?? 'unknown tool error' }
  }
  const text = result?.content?.find((c) => c.type === 'text')?.text
  if (text == null) return { status: 502, ok: false, data: 'empty MCP response' }
  try {
    return { status: 200, ok: true, data: JSON.parse(text) }
  } catch {
    // Tool membalas teks non-JSON (mis. pesan ENOENT) → teruskan apa adanya.
    return { status: 200, ok: true, data: text }
  }
}

// Panggil sebuah MCP tool di STG lewat POST /mcp (JSON-RPC) dan unwrap hasilnya.
// Bentuk { status, ok, data } agar stgResult() tetap drop-in.
export async function stgMcpCall(tool: string, input: Record<string, unknown> = {}): Promise<FetchResult> {
  return unwrapMcpEnvelope(await stgFetch('/mcp', { method: 'POST', body: mcpCallBody(tool, input) }))
}
