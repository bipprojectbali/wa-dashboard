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

  registerInspectDataTools(server)
}
