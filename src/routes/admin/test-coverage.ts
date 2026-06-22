import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { guardSuperAdmin } from '../../lib/route-helpers'
import { scanTestCoverage } from '../../lib/test-coverage-scanner'

export const adminTestCoverageRouter = new Elysia({ tags: ['Admin — Info'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/test-coverage',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      return scanTestCoverage()
    },
    {
      detail: {
        summary: 'Test coverage mapping',
        description:
          'Maps source files to their test files. Coverage: covered (unit), partial (integration only), uncovered.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Coverage report' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
