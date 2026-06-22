import { Elysia, t } from 'elysia'
import { appLog } from '../../lib/applog'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { prisma } from '../../lib/db'
import { guardSuperAdmin } from '../../lib/route-helpers'

export const adminLogsAuditRouter = new Elysia({ tags: ['Admin — Logs'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/logs/audit',
    async ({ request, authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const url = new URL(request.url)
      const userId = url.searchParams.get('userId')
      const action = url.searchParams.get('action')
      const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 500)
      const where: Record<string, any> = {}
      if (userId) where.userId = userId
      if (action) where.action = action
      const logs = await prisma.auditLog.findMany({
        where,
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return { logs }
    },
    {
      detail: {
        summary: 'Get audit logs',
        description: 'Persistent audit trail from DB. Filterable by userId and action. Max 500 entries.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Audit log entries' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
      query: t.Object({
        userId: t.Optional(t.String({ description: 'Filter by user ID' })),
        action: t.Optional(t.String({ description: 'Filter by action (e.g. LOGIN, LOGOUT, ROLE_CHANGED)' })),
        limit: t.Optional(t.Numeric({ description: 'Max entries (default 100, max 500)' })),
      }),
    },
  )

  .delete(
    '/api/admin/logs/audit',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const { count } = await prisma.auditLog.deleteMany()
      appLog('info', `Audit logs cleared manually (${count} entries)`)
      return { ok: true, deleted: count }
    },
    {
      detail: {
        summary: 'Clear audit logs',
        description: 'Deletes all audit log rows from the database. Irreversible.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Audit logs cleared with count' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
