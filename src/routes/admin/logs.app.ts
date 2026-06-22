import { Elysia, t } from 'elysia'
import { appLog, clearAppLogs, getAppLogs } from '../../lib/applog'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { guardSuperAdmin } from '../../lib/route-helpers'

export const adminLogsAppRouter = new Elysia({ tags: ['Admin — Logs'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/logs/app',
    async ({ request, authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const url = new URL(request.url)
      const level = url.searchParams.get('level') as any
      const limit = parseInt(url.searchParams.get('limit') ?? '100', 10)
      const afterId = parseInt(url.searchParams.get('afterId') ?? '0', 10)
      return { logs: await getAppLogs({ level: level || undefined, limit, afterId: afterId || undefined }) }
    },
    {
      detail: {
        summary: 'Get app logs',
        description: 'Fetch recent app logs from Redis ring buffer (max 500 entries). Filterable by level.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'App log entries' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
      query: t.Object({
        level: t.Optional(
          t.Union([t.Literal('info'), t.Literal('warn'), t.Literal('error')], {
            description: 'Filter by log level',
          }),
        ),
        limit: t.Optional(t.Numeric({ description: 'Max entries to return (default 100)' })),
        afterId: t.Optional(t.Numeric({ description: 'Return entries with id > afterId (for polling)' })),
      }),
    },
  )

  .delete(
    '/api/admin/logs/app',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      await clearAppLogs()
      appLog('info', 'App logs cleared manually')
      return { ok: true }
    },
    {
      detail: {
        summary: 'Clear app logs',
        description: 'Wipes the Redis app log buffer. Irreversible.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Logs cleared' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
