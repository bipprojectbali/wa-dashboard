import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { jsonText } from './shared'
import { MCP_SECRET, stgFetch, stgResult } from './stg-fetch'

export function registerCompareTools(server: McpServer) {
  server.registerTool(
    'stg_compare_routes',
    {
      title: 'STG vs Local: Compare API routes',
      description:
        'Fetch route metadata from both STG and local, then return a diff summary. Helps detect missing or extra routes after a deploy.',
      inputSchema: z.object({
        localBaseUrl: z.string().default('http://localhost:3111').describe('Local dev server base URL'),
        localSecret: z.string().optional().describe('MCP_SECRET for local (defaults to same as STG secret)'),
      }),
    },
    async ({ localBaseUrl, localSecret }) => {
      const localUrl = localBaseUrl.replace(/\/$/, '')
      const localAuth = `Bearer ${localSecret ?? MCP_SECRET}`
      const [stgRes, localRes] = await Promise.all([
        stgFetch('/api/admin/routes'),
        fetch(`${localUrl}/api/admin/routes`, {
          headers: { Authorization: localAuth },
        }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json().catch(() => null) })),
      ])
      const stgRoutes: string[] = stgRes.ok
        ? (stgRes.data as any)?.routes?.map((r: any) => `${r.method} ${r.path}`) ?? []
        : []
      const localRoutes: string[] = localRes.ok
        ? (localRes.data as any)?.routes?.map((r: any) => `${r.method} ${r.path}`) ?? []
        : []
      const stgSet = new Set(stgRoutes)
      const localSet = new Set(localRoutes)
      return jsonText({
        stgRouteCount: stgRoutes.length,
        localRouteCount: localRoutes.length,
        onlyInStg: stgRoutes.filter((r) => !localSet.has(r)),
        onlyInLocal: localRoutes.filter((r) => !stgSet.has(r)),
        identical: stgRoutes.filter((r) => !localSet.has(r)).length === 0 && localRoutes.filter((r) => !stgSet.has(r)).length === 0,
      })
    },
  )

  server.registerTool(
    'stg_compare_env',
    {
      title: 'STG vs Local: Compare env vars',
      description:
        'Fetch env-map (set/unset status) from STG and local, then diff which vars are missing on either side.',
      inputSchema: z.object({
        localBaseUrl: z.string().default('http://localhost:3111').describe('Local dev server base URL'),
        localSecret: z.string().optional(),
      }),
    },
    async ({ localBaseUrl, localSecret }) => {
      const localUrl = localBaseUrl.replace(/\/$/, '')
      const localAuth = `Bearer ${localSecret ?? MCP_SECRET}`
      const [stgRes, localRes] = await Promise.all([
        stgFetch('/api/admin/env-map'),
        fetch(`${localUrl}/api/admin/env-map`, {
          headers: { Authorization: localAuth },
        }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json().catch(() => null) })),
      ])
      type EnvEntry = { key: string; set: boolean }
      const stgEnv: EnvEntry[] = stgRes.ok ? (stgRes.data as any)?.vars ?? [] : []
      const localEnv: EnvEntry[] = localRes.ok ? (localRes.data as any)?.vars ?? [] : []
      const stgMap = Object.fromEntries(stgEnv.map((e) => [e.key, e.set]))
      const localMap = Object.fromEntries(localEnv.map((e) => [e.key, e.set]))
      const allKeys = [...new Set([...Object.keys(stgMap), ...Object.keys(localMap)])]
      const diff = allKeys.map((key) => ({
        key,
        stg: stgMap[key] ?? null,
        local: localMap[key] ?? null,
        mismatch: stgMap[key] !== localMap[key],
      }))
      return jsonText({
        totalKeys: allKeys.length,
        mismatches: diff.filter((d) => d.mismatch),
        all: diff,
      })
    },
  )

  server.registerTool(
    'stg_compare_schema',
    {
      title: 'STG vs Local: Compare DB schema',
      description:
        'Fetch parsed Prisma schema from both STG and local, diff model/field lists. Useful to detect missing migrations on STG.',
      inputSchema: z.object({
        localBaseUrl: z.string().default('http://localhost:3111'),
        localSecret: z.string().optional(),
      }),
    },
    async ({ localBaseUrl, localSecret }) => {
      const localUrl = localBaseUrl.replace(/\/$/, '')
      const localAuth = `Bearer ${localSecret ?? MCP_SECRET}`
      const [stgRes, localRes] = await Promise.all([
        stgFetch('/api/admin/schema'),
        fetch(`${localUrl}/api/admin/schema`, {
          headers: { Authorization: localAuth },
        }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json().catch(() => null) })),
      ])
      type ModelDef = { name: string; fields: { name: string; type: string }[] }
      const stgModels: ModelDef[] = stgRes.ok ? (stgRes.data as any)?.models ?? [] : []
      const localModels: ModelDef[] = localRes.ok ? (localRes.data as any)?.models ?? [] : []
      const stgMap = Object.fromEntries(stgModels.map((m) => [m.name, m.fields.map((f) => `${f.name}:${f.type}`)]))
      const localMap = Object.fromEntries(localModels.map((m) => [m.name, m.fields.map((f) => `${f.name}:${f.type}`)]))
      const allModels = [...new Set([...Object.keys(stgMap), ...Object.keys(localMap)])]
      const diff = allModels
        .map((model) => {
          const stgFields = new Set(stgMap[model] ?? [])
          const localFields = new Set(localMap[model] ?? [])
          return {
            model,
            onlyInStg: [...stgFields].filter((f) => !localFields.has(f)),
            onlyInLocal: [...localFields].filter((f) => !stgFields.has(f)),
          }
        })
        .filter((d) => d.onlyInStg.length > 0 || d.onlyInLocal.length > 0)
      return jsonText({
        stgModelCount: stgModels.length,
        localModelCount: localModels.length,
        schemaDiff: diff,
        identical: diff.length === 0,
      })
    },
  )

  server.registerTool(
    'stg_compare_migrations',
    {
      title: 'STG vs Local: Compare migrations',
      description:
        'Fetch migration timeline from both STG and local, show which are applied on STG but not local and vice versa.',
      inputSchema: z.object({
        localBaseUrl: z.string().default('http://localhost:3111'),
        localSecret: z.string().optional(),
      }),
    },
    async ({ localBaseUrl, localSecret }) => {
      const localUrl = localBaseUrl.replace(/\/$/, '')
      const localAuth = `Bearer ${localSecret ?? MCP_SECRET}`
      const [stgRes, localRes] = await Promise.all([
        stgFetch('/api/admin/migrations'),
        fetch(`${localUrl}/api/admin/migrations`, {
          headers: { Authorization: localAuth },
        }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json().catch(() => null) })),
      ])
      type Mig = { name: string; appliedAt?: string }
      const stgMigs: Mig[] = stgRes.ok ? (stgRes.data as any)?.migrations ?? [] : []
      const localMigs: Mig[] = localRes.ok ? (localRes.data as any)?.migrations ?? [] : []
      const stgNames = new Set(stgMigs.map((m) => m.name))
      const localNames = new Set(localMigs.map((m) => m.name))
      return jsonText({
        stgCount: stgMigs.length,
        localCount: localMigs.length,
        onlyInStg: stgMigs.filter((m) => !localNames.has(m.name)).map((m) => m.name),
        onlyInLocal: localMigs.filter((m) => !stgNames.has(m.name)).map((m) => m.name),
        identical:
          stgMigs.length === localMigs.length && stgMigs.every((m) => localNames.has(m.name)),
      })
    },
  )

  server.registerTool(
    'stg_compare_users',
    {
      title: 'STG vs Local: Compare user count & roles',
      description:
        'Quick summary of user counts per role on STG vs local. Useful to spot if seed data or migrations diverged.',
      inputSchema: z.object({
        localBaseUrl: z.string().default('http://localhost:3111'),
        localSecret: z.string().optional(),
      }),
    },
    async ({ localBaseUrl, localSecret }) => {
      const localUrl = localBaseUrl.replace(/\/$/, '')
      const localAuth = `Bearer ${localSecret ?? MCP_SECRET}`
      const [stgRes, localRes] = await Promise.all([
        stgFetch('/mcp', {
          method: 'POST',
          body: JSON.stringify({ tool: 'db_list_users', input: { limit: 500 } }),
        }),
        fetch(`${localUrl}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: localAuth },
          body: JSON.stringify({ tool: 'db_list_users', input: { limit: 500 } }),
        }).then(async (r) => ({ status: r.status, ok: r.ok, data: await r.json().catch(() => null) })),
      ])
      type User = { role: string; blocked: boolean }
      function summarizeUsers(users: User[]) {
        const byRole: Record<string, number> = {}
        let blocked = 0
        for (const u of users) {
          byRole[u.role] = (byRole[u.role] ?? 0) + 1
          if (u.blocked) blocked++
        }
        return { total: users.length, byRole, blocked }
      }
      const stgUsers: User[] = stgRes.ok ? (stgRes.data as any)?.users ?? [] : []
      const localUsers: User[] = localRes.ok ? (localRes.data as any)?.users ?? [] : []
      return jsonText({ stg: summarizeUsers(stgUsers), local: summarizeUsers(localUsers) })
    },
  )
}
