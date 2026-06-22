import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { scanFileHealth } from '../../lib/file-health-scanner'
import { guardSuperAdmin } from '../../lib/route-helpers'

export const adminFileHealthRouter = new Elysia({ tags: ['Admin — Info'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/file-health',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      return scanFileHealth()
    },
    {
      detail: {
        summary: 'File health scan',
        description:
          'Scans project files across src/, prisma/, tests/, scripts/, docs/ and reports lines, characters, and status (ok/warn/critical/exempt) against the limits defined in docs/FILE-HEALTH.md.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'File health report with summary' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
