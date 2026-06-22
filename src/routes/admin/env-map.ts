import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { ENV_DEFS, ENV_SOURCE_FILES } from '../../lib/env-map-catalog'
import { guardSuperAdmin } from '../../lib/route-helpers'

export const adminEnvMapRouter = new Elysia({ tags: ['Admin — Info'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/env-map',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard

      const root = process.cwd()
      const fileContents: Record<string, string> = {}
      for (const f of ENV_SOURCE_FILES) {
        const absPath = join(root, f)
        if (existsSync(absPath)) fileContents[f] = readFileSync(absPath, 'utf-8')
      }

      const variables = ENV_DEFS.map((def) => {
        const usedBy: string[] = []
        for (const [file, content] of Object.entries(fileContents)) {
          if (content.includes(def.envKey) || content.includes(`env.${def.name}`)) usedBy.push(file)
        }
        return {
          name: def.name,
          required: def.required,
          isSet: !!process.env[def.envKey],
          default: def.default,
          category: def.category,
          description: def.description,
          usedBy,
        }
      })

      const byCategory: Record<string, number> = {}
      let setCount = 0,
        requiredCount = 0
      for (const v of variables) {
        byCategory[v.category] = (byCategory[v.category] || 0) + 1
        if (v.isSet) setCount++
        if (v.required) requiredCount++
      }

      return {
        variables,
        summary: {
          total: variables.length,
          set: setCount,
          unset: variables.length - setCount,
          required: requiredCount,
          byCategory,
        },
      }
    },
    {
      detail: {
        summary: 'Environment variables map',
        description:
          'Lists all env vars referenced in the codebase with their set/unset status, category, and which files use them.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Env var list with summary' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
