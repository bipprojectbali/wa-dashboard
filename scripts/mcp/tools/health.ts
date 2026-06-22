import { z } from 'zod'
import { prisma } from '../../../src/lib/db'
import { redis } from '../../../src/lib/redis'
import { jsonText, type ToolModule } from './shared'

export const healthTools: ToolModule = {
  name: 'health',
  scope: 'readonly',
  register(server) {
    server.registerTool(
      'health_full',
      {
        title: 'Full health check',
        description: 'Ping database + Redis, report uptime and environment',
        inputSchema: z.object({}),
      },
      async () => {
        const started = Date.now()
        const [dbOk, redisOk] = await Promise.all([
          prisma.$queryRaw`SELECT 1`.then(() => true).catch(() => false),
          redis.ping().then((r: string) => r === 'PONG').catch(() => false),
        ])
        return jsonText({
          status: dbOk && redisOk ? 'ok' : 'degraded',
          db: dbOk ? 'ok' : 'down',
          redis: redisOk ? 'ok' : 'down',
          uptimeSeconds: Math.round(process.uptime()),
          nodeEnv: process.env.NODE_ENV ?? 'development',
          checkDurationMs: Date.now() - started,
          pid: process.pid,
        })
      },
    )
  },
}
