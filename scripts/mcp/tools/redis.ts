import { z } from 'zod'
import { redis } from '../../../src/lib/redis'
import { jsonText, type ToolModule } from './shared'

export const redisTools: ToolModule = {
  name: 'redis',
  scope: 'admin',
  register(server) {
    server.registerTool(
      'redis_get',
      {
        title: 'Redis GET',
        description: 'Get a string value by key',
        inputSchema: z.object({ key: z.string() }),
      },
      async ({ key }) => {
        const value = await redis.get(key)
        return jsonText({ key, value })
      },
    )

    server.registerTool(
      'redis_set',
      {
        title: 'Redis SET',
        description: 'Set a string value. Optional TTL in seconds.',
        inputSchema: z.object({
          key: z.string(),
          value: z.string(),
          ttlSeconds: z.number().int().min(1).optional(),
        }),
      },
      async ({ key, value, ttlSeconds }) => {
        if (ttlSeconds) {
          await redis.set(key, value, 'EX', ttlSeconds)
        } else {
          await redis.set(key, value)
        }
        return jsonText({ ok: true, key, ttlSeconds: ttlSeconds ?? null })
      },
    )

    server.registerTool(
      'redis_del',
      {
        title: 'Redis DEL',
        description: 'Delete one or more keys',
        inputSchema: z.object({ keys: z.array(z.string()).min(1) }),
      },
      async ({ keys }) => {
        let removed = 0
        for (const k of keys) {
          const ok = await redis.del(k)
          removed += typeof ok === 'number' ? ok : ok ? 1 : 0
        }
        return jsonText({ ok: true, removed })
      },
    )

    server.registerTool(
      'redis_keys',
      {
        title: 'Redis KEYS',
        description: 'List keys matching a pattern (use sparingly — O(N))',
        inputSchema: z.object({
          pattern: z.string().default('*'),
          limit: z.number().int().min(1).max(1000).default(200),
        }),
      },
      async ({ pattern, limit }) => {
        const keys = await redis.keys(pattern)
        return jsonText({ total: keys.length, keys: keys.slice(0, limit) })
      },
    )

    server.registerTool(
      'redis_info',
      {
        title: 'Redis INFO',
        description: 'Return connection status and a ping round-trip',
        inputSchema: z.object({}),
      },
      async () => {
        const start = Date.now()
        const pong = await redis.ping().catch((e: Error) => `err: ${e.message}`)
        return jsonText({ ping: pong, latencyMs: Date.now() - start })
      },
    )
  },
}
