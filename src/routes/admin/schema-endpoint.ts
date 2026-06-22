import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { guardSuperAdmin } from '../../lib/route-helpers'
import { parseSchema } from '../../lib/schema-parser'

export const adminSchemaRouter = new Elysia({ tags: ['Admin — Info'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/schema',
    async ({ set, authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const fs = await import('node:fs')
      const schemaPath = `${process.cwd()}/prisma/schema.prisma`
      if (!fs.existsSync(schemaPath)) {
        set.status = 404
        return { error: 'Schema not found' }
      }
      const raw = fs.readFileSync(schemaPath, 'utf-8')
      return { schema: parseSchema(raw) }
    },
    {
      detail: {
        summary: 'Database schema',
        description: 'Returns parsed Prisma schema: models, fields, relations, and enums.',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Parsed schema' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
          404: { description: 'schema.prisma file not found' },
        },
      },
    },
  )
