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
