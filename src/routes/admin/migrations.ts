import { Elysia } from 'elysia'
import { betterAuthPlugin } from '../../lib/auth-middleware'
import { guardSuperAdmin } from '../../lib/route-helpers'

export const adminMigrationsRouter = new Elysia({ tags: ['Admin — Info'] })
  .use(betterAuthPlugin)

  .get(
    '/api/admin/migrations',
    async ({ authUser }) => {
      const guard = guardSuperAdmin(authUser)
      if (guard) return guard
      const fs = await import('node:fs')
      const pathMod = await import('node:path')
      const root = process.cwd()
      const migrationsDir = pathMod.join(root, 'prisma/migrations')

      if (!fs.existsSync(migrationsDir)) {
        return {
          migrations: [],
          summary: { totalMigrations: 0, firstMigration: null, lastMigration: null, totalChanges: 0 },
        }
      }

      const entries = fs
        .readdirSync(migrationsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && /^\d{14}_/.test(e.name))
        .sort((a, b) => a.name.localeCompare(b.name))

      const migrations = entries.map((entry) => {
        const sqlPath = pathMod.join(migrationsDir, entry.name, 'migration.sql')
        let sql = ''
        const changes: string[] = []

        if (fs.existsSync(sqlPath)) {
          sql = fs.readFileSync(sqlPath, 'utf-8')
          for (const m of sql.matchAll(
            /^(CREATE TABLE|ALTER TABLE|CREATE INDEX|CREATE UNIQUE INDEX|DROP TABLE|DROP INDEX|CREATE TYPE|ALTER TYPE)\s+["']?(\w+)["']?/gim,
          )) {
            changes.push(`${m[1]} ${m[2]}`)
          }
          for (const m of sql.matchAll(/CREATE TYPE\s+"(\w+)"/g)) {
            if (!changes.some((c) => c.includes(m[1]))) changes.push(`CREATE TYPE ${m[1]}`)
          }
        }

        const dateStr = entry.name.substring(0, 14)
        const createdAt = new Date(
          `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}T${dateStr.slice(8, 10)}:${dateStr.slice(10, 12)}:${dateStr.slice(12, 14)}.000Z`,
        ).toISOString()
        const name = entry.name.substring(15)

        return { name, folder: entry.name, createdAt, changes, sql: sql.substring(0, 800) }
      })

      const totalChanges = migrations.reduce((s, m) => s + m.changes.length, 0)

      return {
        migrations,
        summary: {
          totalMigrations: migrations.length,
          firstMigration: migrations[0]?.createdAt || null,
          lastMigration: migrations[migrations.length - 1]?.createdAt || null,
          totalChanges,
        },
      }
    },
    {
      detail: {
        summary: 'Migration timeline',
        description:
          'Lists all Prisma migrations with creation date, SQL changes summary, and SQL snippet (first 800 chars).',
        security: [{ cookieAuth: [] }],
        responses: {
          200: { description: 'Migration list with summary' },
          401: { description: 'Unauthenticated' },
          403: { description: 'Forbidden — requires SUPER_ADMIN' },
        },
      },
    },
  )
