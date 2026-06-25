import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'bun run prisma/seed.ts',
  },
  datasource: {
    // Migration butuh koneksi langsung (session-level: advisory lock + DDL transaction)
    // yang putus di PgBouncer transaction-mode. DIRECT_URL = Postgres asli (:5432);
    // fallback ke DATABASE_URL untuk dev lokal yang tak pakai PgBouncer.
    url: process.env.DIRECT_URL || env('DATABASE_URL'),
  },
})
