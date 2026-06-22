import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { getOnlineUserIds } from '../../lib/presence'
import { guardSuperAdmin } from '../../lib/route-helpers'

export const adminPresenceRouter = new Elysia({ tags: ['Admin — Info'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/presence',
    ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      return { online: getOnlineUserIds() }
    },
    {
      detail: {
        summary: 'Online users',
        description: 'Returns IDs of currently connected users via WebSocket presence tracker.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Array of online user IDs' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
