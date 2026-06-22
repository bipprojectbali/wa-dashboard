import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { scanProjectStructure } from '../../lib/project-structure-scanner'
import { guardSuperAdmin } from '../../lib/route-helpers'

export const adminProjectStructureRouter = new Elysia({ tags: ['Admin — Info'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/project-structure',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      return scanProjectStructure()
    },
    {
      detail: {
        summary: 'Project file structure',
        description: 'Scans src/, prisma/, tests/ and returns file list with line counts, exports, and imports.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'File structure with summary' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
