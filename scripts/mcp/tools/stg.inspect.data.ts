import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { stgFetch, stgResult } from './stg-fetch'

export function registerInspectDataTools(server: McpServer) {
  server.registerTool(
    'stg_logs_app',
    {
      title: 'STG: App logs',
      description:
        'Tail the Redis app log buffer on staging. Use to see recent request/error activity in STG runtime.',
      inputSchema: z.object({
        level: z.enum(['info', 'warn', 'error']).optional(),
        limit: z.number().int().min(1).max(500).default(100),
        afterId: z.number().int().optional(),
        search: z.string().optional().describe('Substring match on message'),
      }),
    },
    async (input) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'logs_app', input }),
        }),
      ),
  )

  server.registerTool(
    'stg_logs_audit',
    {
      title: 'STG: Audit logs',
      description: 'Fetch audit trail from staging DB. Useful to see user login/logout/role events on STG.',
      inputSchema: z.object({
        userId: z.string().optional(),
        action: z.string().optional(),
        sinceISO: z.string().optional(),
        limit: z.number().int().min(1).max(1000).default(100),
      }),
    },
    async (input) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'logs_audit', input }),
        }),
      ),
  )

  server.registerTool(
    'stg_list_users',
    {
      title: 'STG: List users',
      description:
        'List all users on staging (role, blocked status, createdAt). Compare with local to spot data drift.',
      inputSchema: z.object({
        role: z.enum(['USER', 'QC', 'ADMIN', 'SUPER_ADMIN']).optional(),
        blocked: z.boolean().optional(),
        search: z.string().optional().describe('Substring match on name or email'),
        limit: z.number().int().min(1).max(500).default(50),
      }),
    },
    async (input) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'db_list_users', input }),
        }),
      ),
  )

  server.registerTool(
    'stg_get_user',
    {
      title: 'STG: Get user',
      description: 'Fetch a single user by id or email on staging, including active session count.',
      inputSchema: z.object({
        id: z.string().optional(),
        email: z.string().email().optional(),
      }),
    },
    async (input) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'db_get_user', input }),
        }),
      ),
  )

  server.registerTool(
    'stg_sessions',
    {
      title: 'STG: Sessions',
      description: 'List active sessions on staging. Useful to verify auth state or find stuck sessions.',
      inputSchema: z.object({
        userId: z.string().optional(),
        active: z.boolean().optional().describe('true = not expired, false = expired'),
        limit: z.number().int().min(1).max(500).default(50),
      }),
    },
    async (input) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'db_list_sessions', input }),
        }),
      ),
  )

  server.registerTool(
    'stg_presence',
    {
      title: 'STG: Online users',
      description: 'List currently connected users (WebSocket presence) on staging.',
      inputSchema: z.object({}),
    },
    async () =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'presence_online', input: {} }),
        }),
      ),
  )

  server.registerTool(
    'stg_redis_info',
    {
      title: 'STG: Redis info',
      description: 'Ping Redis on staging and return latency.',
      inputSchema: z.object({}),
    },
    async () =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'redis_info', input: {} }),
        }),
      ),
  )

  server.registerTool(
    'stg_redis_get',
    {
      title: 'STG: Redis GET',
      description: 'Get a Redis key value on staging. Useful to inspect session cache or feature flags.',
      inputSchema: z.object({ key: z.string() }),
    },
    async (input) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'redis_get', input }),
        }),
      ),
  )

  server.registerTool(
    'stg_redis_keys',
    {
      title: 'STG: Redis KEYS',
      description: 'List Redis keys matching a pattern on staging.',
      inputSchema: z.object({
        pattern: z.string().default('*'),
        limit: z.number().int().min(1).max(1000).default(200),
      }),
    },
    async (input) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'redis_keys', input }),
        }),
      ),
  )

  server.registerTool(
    'stg_ticket_list',
    {
      title: 'STG: List tickets',
      description: 'List tickets on staging. Use to compare ticket state between STG and local.',
      inputSchema: z.object({
        status: z
          .enum(['OPEN', 'IN_PROGRESS', 'READY_FOR_QC', 'REOPENED', 'CLOSED', 'ACTIVE', 'ALL'])
          .default('ACTIVE'),
        priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      }),
    },
    async (input) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'ticket_list', input }),
        }),
      ),
  )

  server.registerTool(
    'stg_ticket_get',
    {
      title: 'STG: Get ticket',
      description: 'Fetch a ticket with comments and evidence from staging.',
      inputSchema: z.object({ id: z.string() }),
    },
    async (input) =>
      stgResult(
        await stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'ticket_get', input }),
        }),
      ),
  )
}
