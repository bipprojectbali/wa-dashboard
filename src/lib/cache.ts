import { redis } from './redis'

export async function withCache<T>(key: string, ttlSeconds: number, fetcher: () => Promise<T>): Promise<T> {
  try {
    const cached = await redis.get(key)
    if (cached) return JSON.parse(cached) as T
  } catch {}
  const data = await fetcher()
  if (data != null) {
    redis.set(key, JSON.stringify(data), 'EX', ttlSeconds).catch(() => {})
  }
  return data
}

export async function invalidateCache(...keys: string[]) {
  if (keys.length === 0) return
  await Promise.all(keys.map((k) => redis.del(k).catch(() => {})))
}
