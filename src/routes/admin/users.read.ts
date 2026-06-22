import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { prisma } from '../../lib/db'
import { guardSuperAdmin } from '../../lib/route-helpers'

export const adminUsersReadRouter = new Elysia({ tags: ['Admin — Users'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/users',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const users = await prisma.user.findMany({
        select: { id: true, name: true, email: true, role: true, blocked: true, createdAt: true, image: true },
        orderBy: { createdAt: 'asc' },
        take: 500,
      })
      return { users }
    },
    {
      detail: {
        summary: 'List all users',
        description: 'Returns all users with role, blocked status, and createdAt. Requires SUPER_ADMIN.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'User list' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
