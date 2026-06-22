import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { guardSuperAdmin } from '../../lib/route-helpers'
import { ROUTES_CATALOG } from '../../lib/routes-catalog'

export const adminRoutesListRouter = new Elysia({ tags: ['Admin — Info'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/routes',
    ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const byMethod: Record<string, number> = {}
      const byAuth: Record<string, number> = {}
      const byCategory: Record<string, number> = {}
      for (const r of ROUTES_CATALOG) {
        byMethod[r.method] = (byMethod[r.method] || 0) + 1
        byAuth[r.auth] = (byAuth[r.auth] || 0) + 1
        byCategory[r.category] = (byCategory[r.category] || 0) + 1
      }
      return {
        routes: ROUTES_CATALOG,
        summary: { total: ROUTES_CATALOG.length, byMethod, byAuth, byCategory },
      }
    },
    {
      detail: {
        summary: 'All routes metadata',
        description: 'Returns all HTTP, WebSocket, and frontend routes with auth level and category.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Routes with summary' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
