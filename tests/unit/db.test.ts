import { test, expect, describe, afterAll } from 'bun:test'
import { prisma } from '../helpers'

afterAll(async () => {
  await prisma.$disconnect()
})

describe('Prisma database connection', () => {
  test('connects to database', async () => {
    const result = await prisma.$queryRaw`SELECT 1 as ok`
    expect(result).toEqual([{ ok: 1 }])
  })

  test('user table exists', async () => {
    const count = await prisma.user.count()
    expect(typeof count).toBe('number')
  })

  test('session table exists', async () => {
    const count = await prisma.session.count()
    expect(typeof count).toBe('number')
  })
})
