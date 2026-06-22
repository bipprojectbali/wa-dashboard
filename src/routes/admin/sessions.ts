import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { prisma } from '../../lib/db'
import { getOnlineUserIds } from '../../lib/presence'
import { guardSuperAdmin } from '../../lib/route-helpers'

export const adminSessionsRouter = new Elysia({ tags: ['Admin — Info'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/sessions',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const onlineIds = new Set(getOnlineUserIds())
      const sessions = await prisma.session.findMany({
        include: { user: { select: { id: true, name: true, email: true, role: true, blocked: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      })

      const now = new Date()
      const result = sessions.map((s: (typeof sessions)[number]) => ({
        id: s.id,
        userId: s.user.id,
        userName: s.user.name,
        userEmail: s.user.email,
        userRole: s.user.role,
        userBlocked: s.user.blocked,
        isOnline: onlineIds.has(s.user.id),
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        isExpired: s.expiresAt < now,
      }))

      const byRole: Record<string, number> = {}
      const uniqueUsers = new Set<string>()
      let active = 0,
        expired = 0
      for (const s of result) {
        uniqueUsers.add(s.userId)
        byRole[s.userRole] = (byRole[s.userRole] || 0) + 1
        if (s.isExpired) expired++
        else active++
      }

      return {
        sessions: result,
        summary: {
          totalSessions: result.length,
          activeSessions: active,
          expiredSessions: expired,
          onlineUsers: onlineIds.size,
          byRole,
        },
      }
    },
    {
      detail: {
        summary: 'Active sessions',
        description:
          'Lists all sessions (max 200, newest first) with online status and expiry. Includes role breakdown.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Sessions with summary' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
