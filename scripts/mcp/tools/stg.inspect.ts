import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { jsonText } from './shared'
import { BASE_URL, stgFetch, stgResult } from './stg-fetch'
import { registerInspectDataTools } from './stg.inspect.data'

export function registerInspectTools(server: McpServer) {
  server.registerTool(
    'stg_health',
    {
      title: 'STG: Health check',
      description: 'Ping the staging runtime: DB + Redis + uptime. Use to verify STG is up before comparing with local.',
      inputSchema: z.object({}),
    },
    async () =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'health_full', input: {} }),
        }),
      ),
  )

  server.registerTool(
    'stg_ping',
    {
      title: 'STG: Ping /health',
      description: 'Simple GET /health check on staging. Fastest connectivity probe.',
      inputSchema: z.object({}),
    },
    async () => {
      const r = await stgFetch('/health')
      return jsonText({ status: r.status, body: r.data, baseUrl: BASE_URL })
    },
  )

  server.registerTool(
    'stg_api',
    {
      title: 'STG: Raw API call',
      description:
        'Make an arbitrary HTTP request to staging. Use for endpoints not covered by other tools (e.g. /api/version, /api/admin/routes, custom routes).',
      inputSchema: z.object({
        method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('GET'),
        path: z.string().describe('Path relative to BASE_URL, e.g. /api/version'),
        body: z.string().optional().describe('JSON body string for POST/PUT/PATCH'),
        bearerToken: z.string().optional().describe('Override Authorization header (e.g. user session token)'),
      }),
    },
    async ({ method, path, body, bearerToken }) => {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`
      const r = await stgFetch(path, { method, body: body ?? undefined, headers })
      return jsonText({ status: r.status, ok: r.ok, data: r.data })
    },
  )

  server.registerTool(
    'stg_file_health',
    {
      title: 'STG: File health scan',
      description:
        'Run file health scan on staging via /api/admin/file-health (SUPER_ADMIN cookie required, falls back to MCP bearer). Reports line/char counts vs limits in docs/FILE-HEALTH.md.',
      inputSchema: z.object({}),
    },
    async () => stgResult(await stgFetch('/api/admin/file-health')),
  )

  server.registerTool(
    'stg_db_counts',
    {
      title: 'STG: DB table row counts',
      description: 'Row counts for each primary table on staging.',
      inputSchema: z.object({}),
    },
    async () =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'db_count_by_table', input: {} }),
        }),
      ),
  )

  server.registerTool(
    'stg_wa_sessions',
    {
      title: 'STG: WA sessions',
      description: 'List active WhatsApp sessions on staging via the wa_sessions MCP tool (readonly).',
      inputSchema: z.object({}),
    },
    async () =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'wa_sessions', input: {} }),
        }),
      ),
  )

  server.registerTool(
    'stg_wa_sessions_detail',
    {
      title: 'STG: WA sessions (enriched)',
      description:
        'List all container sessions on staging enriched with status, masked phone, name, and orphan flag via GET /api/admin/wa-sessions (SUPER_ADMIN cookie, falls back to MCP bearer). Readonly.',
      inputSchema: z.object({}),
    },
    async () => stgResult(await stgFetch('/api/admin/wa-sessions')),
  )

  server.registerTool(
    'stg_wa_status',
    {
      title: 'STG: WA session status',
      description: 'Get WhatsApp session state for a user id on staging via the wa_status MCP tool (readonly).',
      inputSchema: z.object({ userId: z.string().min(1).describe('WA session id (= dashboard user id)') }),
    },
    async ({ userId }) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'wa_status', input: { userId } }),
        }),
      ),
  )

  server.registerTool(
    'stg_wa_avatar',
    {
      title: 'STG: WA contact avatar',
      description: 'Get a contact profile picture URL on staging via the wa_avatar MCP tool (readonly).',
      inputSchema: z.object({
        userId: z.string().min(1).describe('WA session id (= dashboard user id)'),
        contactId: z.string().min(1).describe('Contact chat id, e.g. 628xxx@c.us'),
      }),
    },
    async ({ userId, contactId }) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'wa_avatar', input: { userId, contactId } }),
        }),
      ),
  )

  server.registerTool(
    'stg_wa_policy',
    {
      title: 'STG: WA anti-ban policy',
      description: 'Get the global anti-ban policy config on staging via the wa_policy_get MCP tool (readonly).',
      inputSchema: z.object({}),
    },
    async () =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'wa_policy_get', input: {} }),
        }),
      ),
  )

  server.registerTool(
    'stg_wa_verify_consumers',
    {
      title: 'STG: WA verify consumers',
      description:
        'List registered WAV (inbound verify) consumers on staging via the wa_verify_consumers MCP tool (readonly, no secrets).',
      inputSchema: z.object({}),
    },
    async () =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'wa_verify_consumers', input: {} }),
        }),
      ),
  )

  server.registerTool(
    'stg_wa_verify_requests',
    {
      title: 'STG: WA verify requests',
      description: 'List recent WAV verify requests on staging via the wa_verify_requests MCP tool (readonly, phone masked).',
      inputSchema: z.object({ limit: z.number().int().min(1).max(200).optional().describe('Max rows (default 50)') }),
    },
    async ({ limit }) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'wa_verify_requests', input: limit ? { limit } : {} }),
        }),
      ),
  )

  server.registerTool(
    'stg_wa_verify_inbound',
    {
      title: 'STG: WA verify inbound log',
      description: 'List raw WAV inbound capture log on staging via the wa_verify_inbound MCP tool (readonly, phone masked).',
      inputSchema: z.object({ limit: z.number().int().min(1).max(200).optional().describe('Max rows (default 50)') }),
    },
    async ({ limit }) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'wa_verify_inbound', input: limit ? { limit } : {} }),
        }),
      ),
  )

  registerInspectDataTools(server)
}
